import type { PathFilterConfig } from "./types.js";

export class PathFilter {
  // Restricted directory/file names denied at ANY depth, not just the vault
  // root. The glob patterns below are anchored, so `node_modules/**` only
  // matched a root-level node_modules; nested ones (e.g.
  // `tools/cli/node_modules/...`) were traversed, polluting the tag index, and
  // nested `.git`/`.obsidian` leaked their contents (#128). Names are compared
  // lowercased against each path segment.
  private static readonly RESTRICTED_SEGMENTS = new Set([
    '.obsidian',
    '.git',
    'node_modules',
    '.ds_store',
    'thumbs.db',
  ]);

  private ignoredPatterns: string[];
  private allowedExtensions: string[];

  constructor(config?: Partial<PathFilterConfig>) {
    this.ignoredPatterns = [
      '.obsidian',
      '.obsidian/**',
      '.git',
      '.git/**',
      '.trash',
      '.trash/**',
      'node_modules',
      'node_modules/**',
      '.DS_Store',
      'Thumbs.db',
      ...config?.ignoredPatterns || []
    ];

    this.allowedExtensions = [
      '.md',
      '.markdown',
      '.txt',
      '.base',    // Obsidian Bases (YAML)
      '.canvas',  // Obsidian Canvas (JSON)
      ...config?.allowedExtensions || []
    ];
  }

  private simpleGlobMatch(pattern: string, path: string): boolean {
    // Normalize pattern path separators (Windows compatibility)
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Convert glob pattern to regex, escaping special regex chars first
    let regexPattern = normalizedPattern
      .replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')  // Escape all regex special chars
      .replace(/\\\*\\\*/g, '.*')  // ** matches any number of directories (unescape)
      .replace(/\\\*/g, '[^/]*')   // * matches anything except / (unescape)
      .replace(/\\\?/g, '[^/]');   // ? matches single character except / (unescape)

    // Ensure we match the full path
    regexPattern = '^' + regexPattern + '$';

    // Case-insensitive: on case-insensitive filesystems (macOS, Windows) the OS
    // resolves ".Git" to ".git", so the deny-list must match regardless of case.
    const regex = new RegExp(regexPattern, 'i');
    return regex.test(path);
  }

  /**
   * Canonicalize a path for restricted-directory matching. On Windows the
   * filesystem strips trailing dots and spaces from each path segment, so
   * ".git." and ".git " both resolve to ".git". Fold those away (and collapse
   * "./" / duplicate separators) before matching the deny-list, otherwise the
   * restriction can be bypassed with an equivalent name.
   */
  private canonicalizeForMatch(normalizedPath: string): string {
    return normalizedPath
      .split('/')
      .filter(seg => seg !== '' && seg !== '.')
      .map(seg => seg.replace(/[. ]+$/, ''))
      .join('/');
  }

  isAllowed(path: string): boolean {
    if (typeof path !== "string") {
      throw new Error("path is required and must be a string");
    }

    // Normalize path separators
    const normalizedPath = path.replace(/\\/g, '/');

    if (this.isIgnoredPath(normalizedPath)) {
      return false;
    }

    // For files, check extension if allowedExtensions is configured
    if (this.allowedExtensions.length > 0 && this.isFile(normalizedPath)) {
      const hasAllowedExtension = this.allowedExtensions.some(ext =>
        normalizedPath.toLowerCase().endsWith(ext.toLowerCase())
      );
      if (!hasAllowedExtension) {
        return false;
      }
    }

    return true;
  }

  isAllowedForListing(path: string): boolean {
    if (typeof path !== "string") {
      throw new Error("path is required and must be a string");
    }

    // Normalize path separators
    const normalizedPath = path.replace(/\\/g, '/');

    // Listing includes non-note files, but still blocks restricted system paths
    return !this.isIgnoredPath(normalizedPath);
  }

  private isIgnoredPath(normalizedPath: string): boolean {
    // Match against the canonical form so case- and trailing dot/space-variants
    // (".Git/config", ".git./config", ".git /config") cannot bypass the deny-list
    // on case-insensitive / Windows filesystems.
    const canonicalPath = this.canonicalizeForMatch(normalizedPath);

    // Deny hidden paths and restricted directories/files at any depth. Dotfiles
    // are outside the public vault-note surface even when their suffix looks
    // like an allowed note extension (for example, `.secrets.md`).
    for (const segment of canonicalPath.split('/')) {
      if (
        segment.startsWith('.') ||
        PathFilter.RESTRICTED_SEGMENTS.has(segment.toLowerCase())
      ) {
        return true;
      }
    }

    // Check if path matches any ignored pattern
    for (const pattern of this.ignoredPatterns) {
      if (
        this.simpleGlobMatch(pattern, normalizedPath) ||
        this.simpleGlobMatch(pattern, canonicalPath)
      ) {
        return true;
      }
    }

    return false;
  }

  private isFile(path: string): boolean {
    // A path is a file if it has a file extension at the end
    // Paths ending with '/' are always directories
    if (path.endsWith('/')) {
      return false;
    }

    // Get the last component of the path
    const lastSlashIndex = path.lastIndexOf('/');
    const lastComponent = lastSlashIndex === -1 ? path : path.substring(lastSlashIndex + 1);

    // Check if the last component has a file extension
    // A file extension is a dot followed by 1-10 alphanumeric characters at the end
    // This distinguishes "file.md" (file) from "1. Project" (directory with dot in name)
    const lastDotIndex = lastComponent.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      // No dot, or dot at the start (like .gitignore) - treat as no extension
      return false;
    }

    const extension = lastComponent.substring(lastDotIndex + 1);
    // Extension should be 1-10 characters and contain only alphanumeric characters
    // This allows .md, .txt, .markdown but not ". Project" (space after dot)
    return extension.length >= 1 && extension.length <= 10 && /^[a-zA-Z0-9]+$/.test(extension);
  }

  filterPaths(paths: string[]): string[] {
    return paths.filter(path => this.isAllowed(path));
  }
}
