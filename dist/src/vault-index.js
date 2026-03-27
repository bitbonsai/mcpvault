/**
 * In-memory vault index for fast lookups of notes, links, backlinks, and tags.
 * Built on startup, updated incrementally on writes, with a manual reindex tool.
 */
import { join, resolve, relative } from 'path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { FrontmatterHandler } from './frontmatter.js';
import { extractWikiLinks, normalizeNoteName, noteNameFromPath } from './links.js';
/** Simple fast string hash (djb2) */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return hash;
}
export class VaultIndex {
    vaultPath;
    pathFilter;
    /** Map from relative path → IndexedNote */
    notes = new Map();
    /** Map from normalized note name → set of paths that link TO it */
    backlinks = new Map();
    /** Map from tag → set of paths */
    tagIndex = new Map();
    /** Map from normalized name → path (for resolving link targets) */
    nameToPath = new Map();
    frontmatterHandler = new FrontmatterHandler();
    _isBuilt = false;
    _noteCount = 0;
    _linkCount = 0;
    _buildTimeMs = 0;
    constructor(vaultPath, pathFilter) {
        this.vaultPath = vaultPath;
        this.pathFilter = pathFilter;
        this.vaultPath = resolve(vaultPath);
    }
    get isBuilt() { return this._isBuilt; }
    get noteCount() { return this._noteCount; }
    get linkCount() { return this._linkCount; }
    get buildTimeMs() { return this._buildTimeMs; }
    /**
     * Build the complete index by scanning the vault.
     */
    async build() {
        const start = Date.now();
        this.notes.clear();
        this.backlinks.clear();
        this.tagIndex.clear();
        this.nameToPath.clear();
        const files = await this.findMarkdownFiles(this.vaultPath);
        const prefixLen = this.vaultPath.length + 1;
        // Read and index in parallel batches
        const BATCH_SIZE = 10;
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (fullPath) => {
                const relativePath = fullPath.substring(prefixLen).replace(/\\/g, '/');
                if (!this.pathFilter.isAllowed(relativePath))
                    return;
                try {
                    const content = await readFile(fullPath, 'utf-8');
                    const stats = await stat(fullPath);
                    this.indexNote(relativePath, content, stats.mtime.getTime(), stats.size);
                }
                catch {
                    // Skip unreadable files
                }
            }));
        }
        this._isBuilt = true;
        this._noteCount = this.notes.size;
        this._linkCount = Array.from(this.notes.values())
            .reduce((sum, n) => sum + n.outgoingLinks.length, 0);
        this._buildTimeMs = Date.now() - start;
    }
    /**
     * Index (or re-index) a single note from its content.
     */
    indexNote(relativePath, content, modified, size) {
        const name = noteNameFromPath(relativePath);
        const normalizedName = normalizeNoteName(relativePath);
        const contentHash = hashString(content);
        // Parse frontmatter
        const parsed = this.frontmatterHandler.parse(content);
        // Extract outgoing wiki-links from body content
        const outgoingLinks = extractWikiLinks(parsed.content);
        // Extract tags
        const tags = [];
        if (Array.isArray(parsed.frontmatter?.tags)) {
            tags.push(...parsed.frontmatter.tags.map((t) => String(t).toLowerCase()));
        }
        else if (typeof parsed.frontmatter?.tags === 'string') {
            tags.push(parsed.frontmatter.tags.toLowerCase());
        }
        // Inline tags
        const inlineTagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/\-]*)/g;
        let tagMatch;
        while ((tagMatch = inlineTagRegex.exec(parsed.content)) !== null) {
            tags.push(tagMatch[1].toLowerCase());
        }
        const uniqueTags = [...new Set(tags)];
        // Remove old backlinks and tag entries for this path
        this.removeFromIndexes(relativePath);
        const indexed = {
            path: relativePath,
            name,
            normalizedName,
            outgoingLinks,
            tags: uniqueTags,
            frontmatter: parsed.frontmatter || {},
            modified,
            size,
            contentHash,
        };
        this.notes.set(relativePath, indexed);
        this.nameToPath.set(normalizedName, relativePath);
        // Also index by just the note name (for short-form link resolution)
        const shortNormalized = normalizeNoteName(name);
        if (!this.nameToPath.has(shortNormalized)) {
            this.nameToPath.set(shortNormalized, relativePath);
        }
        // Update backlink index
        for (const link of outgoingLinks) {
            const targetNormalized = normalizeNoteName(link.target);
            if (!this.backlinks.has(targetNormalized)) {
                this.backlinks.set(targetNormalized, new Set());
            }
            this.backlinks.get(targetNormalized).add(relativePath);
        }
        // Update tag index
        for (const tag of uniqueTags) {
            if (!this.tagIndex.has(tag)) {
                this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag).add(relativePath);
        }
    }
    /**
     * Remove a note from all indexes.
     */
    removeFromIndexes(relativePath) {
        const existing = this.notes.get(relativePath);
        if (!existing)
            return;
        // Remove from backlinks
        for (const link of existing.outgoingLinks) {
            const targetNormalized = normalizeNoteName(link.target);
            this.backlinks.get(targetNormalized)?.delete(relativePath);
        }
        // Remove from tag index
        for (const tag of existing.tags) {
            this.tagIndex.get(tag)?.delete(relativePath);
        }
    }
    /**
     * Get all notes that link TO the given note.
     */
    getBacklinks(notePath) {
        const results = [];
        // Check by full path and by note name
        const normalizedPath = normalizeNoteName(notePath);
        const noteName = normalizeNoteName(noteNameFromPath(notePath));
        const sourcePathsFromPath = this.backlinks.get(normalizedPath) || new Set();
        const sourcePathsFromName = this.backlinks.get(noteName) || new Set();
        const allSourcePaths = new Set([...sourcePathsFromPath, ...sourcePathsFromName]);
        for (const sourcePath of allSourcePaths) {
            const sourceNote = this.notes.get(sourcePath);
            if (!sourceNote)
                continue;
            // Find the specific links pointing to our target
            const relevantLinks = sourceNote.outgoingLinks.filter(link => {
                const linkNormalized = normalizeNoteName(link.target);
                return linkNormalized === normalizedPath || linkNormalized === noteName;
            });
            if (relevantLinks.length > 0) {
                results.push({
                    sourcePath,
                    sourceName: sourceNote.name,
                    links: relevantLinks,
                });
            }
        }
        return results;
    }
    /**
     * Get outgoing links from a specific note.
     */
    getOutgoingLinks(notePath) {
        const note = this.notes.get(notePath);
        if (!note)
            return [];
        return note.outgoingLinks.map(link => {
            const targetNormalized = normalizeNoteName(link.target);
            const resolvedPath = this.nameToPath.get(targetNormalized) || null;
            return {
                target: link.target,
                resolvedPath,
                ...(link.alias && { alias: link.alias }),
                ...(link.heading && { heading: link.heading }),
            };
        });
    }
    /**
     * Find notes that share tags or links with the given note (potential connections).
     */
    suggestLinks(notePath, limit = 10) {
        const note = this.notes.get(notePath);
        if (!note)
            return [];
        const scores = new Map();
        // Score by shared tags
        for (const tag of note.tags) {
            const notesWithTag = this.tagIndex.get(tag);
            if (!notesWithTag)
                continue;
            for (const candidatePath of notesWithTag) {
                if (candidatePath === notePath)
                    continue;
                // Already linked? Skip.
                const isAlreadyLinked = note.outgoingLinks.some(l => normalizeNoteName(l.target) === normalizeNoteName(noteNameFromPath(candidatePath)));
                if (isAlreadyLinked)
                    continue;
                const entry = scores.get(candidatePath) || { score: 0, reasons: [] };
                entry.score += 2;
                entry.reasons.push(`shared tag #${tag}`);
                scores.set(candidatePath, entry);
            }
        }
        // Score by shared link targets (notes that link to the same things you do)
        for (const link of note.outgoingLinks) {
            const targetNormalized = normalizeNoteName(link.target);
            const backlinkSources = this.backlinks.get(targetNormalized);
            if (!backlinkSources)
                continue;
            for (const siblingPath of backlinkSources) {
                if (siblingPath === notePath)
                    continue;
                const isAlreadyLinked = note.outgoingLinks.some(l => normalizeNoteName(l.target) === normalizeNoteName(noteNameFromPath(siblingPath)));
                if (isAlreadyLinked)
                    continue;
                const entry = scores.get(siblingPath) || { score: 0, reasons: [] };
                entry.score += 1;
                entry.reasons.push(`both link to [[${link.target}]]`);
                scores.set(siblingPath, entry);
            }
        }
        // Score notes that link to this note but aren't linked back (reciprocal opportunity)
        const backlinkers = this.getBacklinks(notePath);
        for (const bl of backlinkers) {
            if (bl.sourcePath === notePath)
                continue;
            const isAlreadyLinked = note.outgoingLinks.some(l => normalizeNoteName(l.target) === normalizeNoteName(noteNameFromPath(bl.sourcePath)));
            if (isAlreadyLinked)
                continue;
            const entry = scores.get(bl.sourcePath) || { score: 0, reasons: [] };
            entry.score += 3;
            entry.reasons.push('links to you but you don\'t link back');
            scores.set(bl.sourcePath, entry);
        }
        return Array.from(scores.entries())
            .map(([path, { score, reasons }]) => {
            const candidate = this.notes.get(path);
            return {
                path,
                name: candidate?.name || noteNameFromPath(path),
                reason: [...new Set(reasons)].join('; '),
                score,
            };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    /**
     * Find unlinked mentions — placeholder for future content-aware search.
     * Would require reading file content at query time.
     */
    findUnlinkedMentions(_notePath) {
        // This would need to re-read all note content to find plain-text mentions
        // that aren't already wiki-linked. Left as a future enhancement.
        return [];
    }
    /**
     * Get all notes with a specific tag.
     */
    getNotesByTag(tag) {
        const normalized = tag.toLowerCase().replace(/^#/, '');
        return Array.from(this.tagIndex.get(normalized) || []);
    }
    /**
     * Get index stats.
     */
    getStats() {
        // Orphaned notes = notes with no incoming or outgoing links
        let orphaned = 0;
        for (const [path, note] of this.notes) {
            const hasOutgoing = note.outgoingLinks.length > 0;
            const hasIncoming = this.getBacklinks(path).length > 0;
            if (!hasOutgoing && !hasIncoming)
                orphaned++;
        }
        return {
            totalNotes: this.notes.size,
            totalLinks: this._linkCount,
            totalTags: this.tagIndex.size,
            orphanedNotes: orphaned,
            buildTimeMs: this._buildTimeMs,
        };
    }
    /**
     * Get all indexed notes (for iteration).
     */
    getAllNotes() {
        return Array.from(this.notes.values());
    }
    /**
     * Get a single indexed note by path.
     */
    getNote(path) {
        return this.notes.get(path);
    }
    /**
     * Resolve a note name to its path.
     */
    resolveNoteName(name) {
        return this.nameToPath.get(normalizeNoteName(name)) || null;
    }
    async findMarkdownFiles(dirPath) {
        const files = [];
        try {
            const entries = await readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    const relativePath = relative(this.vaultPath, fullPath).replace(/\\/g, '/');
                    if (this.pathFilter.isAllowedForListing(relativePath)) {
                        files.push(...await this.findMarkdownFiles(fullPath));
                    }
                }
                else if (entry.isFile() && entry.name.endsWith('.md')) {
                    files.push(fullPath);
                }
            }
        }
        catch {
            // Skip unreadable directories
        }
        return files;
    }
}
