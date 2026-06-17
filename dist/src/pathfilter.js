export class PathFilter {
    ignoredPatterns;
    allowedExtensions;
    constructor(config) {
        this.ignoredPatterns = [
            '.obsidian',
            '.obsidian/**',
            '.git',
            '.git/**',
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
            '.base', // Obsidian Bases (YAML)
            '.canvas', // Obsidian Canvas (JSON)
            ...config?.allowedExtensions || []
        ];
    }
    simpleGlobMatch(pattern, path) {
        // Normalize pattern path separators (Windows compatibility)
        const normalizedPattern = pattern.replace(/\\/g, '/');
        // Convert glob pattern to regex, escaping special regex chars first
        let regexPattern = normalizedPattern
            .replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') // Escape all regex special chars
            .replace(/\\\*\\\*/g, '.*') // ** matches any number of directories (unescape)
            .replace(/\\\*/g, '[^/]*') // * matches anything except / (unescape)
            .replace(/\\\?/g, '[^/]'); // ? matches single character except / (unescape)
        // Ensure we match the full path
        regexPattern = '^' + regexPattern + '$';
        const regex = new RegExp(regexPattern);
        return regex.test(path);
    }
    isAllowed(path) {
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
            const hasAllowedExtension = this.allowedExtensions.some(ext => normalizedPath.toLowerCase().endsWith(ext.toLowerCase()));
            if (!hasAllowedExtension) {
                return false;
            }
        }
        return true;
    }
    isAllowedForListing(path) {
        if (typeof path !== "string") {
            throw new Error("path is required and must be a string");
        }
        // Normalize path separators
        const normalizedPath = path.replace(/\\/g, '/');
        // Listing includes non-note files, but still blocks restricted system paths
        return !this.isIgnoredPath(normalizedPath);
    }
    isIgnoredPath(normalizedPath) {
        // Check if path matches any ignored pattern
        for (const pattern of this.ignoredPatterns) {
            if (this.simpleGlobMatch(pattern, normalizedPath)) {
                return true;
            }
        }
        return false;
    }
    isFile(path) {
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
    filterPaths(paths) {
        return paths.filter(path => this.isAllowed(path));
    }
}
