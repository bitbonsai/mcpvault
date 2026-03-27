/**
 * In-memory vault index for fast lookups of notes, links, backlinks, and tags.
 * Built on startup, updated incrementally on writes, with a manual reindex tool.
 */
import type { PathFilter } from './pathfilter.js';
import { type WikiLink } from './links.js';
export interface IndexedNote {
    /** Relative path from vault root */
    path: string;
    /** Note name without extension */
    name: string;
    /** Normalized name for lookups */
    normalizedName: string;
    /** Outgoing wiki-links */
    outgoingLinks: WikiLink[];
    /** Tags (frontmatter + inline) */
    tags: string[];
    /** Frontmatter data */
    frontmatter: Record<string, any>;
    /** Last modified timestamp */
    modified: number;
    /** File size in bytes */
    size: number;
    /** Content hash for change detection */
    contentHash: number;
}
export declare class VaultIndex {
    private vaultPath;
    private pathFilter;
    /** Map from relative path → IndexedNote */
    private notes;
    /** Map from normalized note name → set of paths that link TO it */
    private backlinks;
    /** Map from tag → set of paths */
    private tagIndex;
    /** Map from normalized name → path (for resolving link targets) */
    private nameToPath;
    private frontmatterHandler;
    private _isBuilt;
    private _noteCount;
    private _linkCount;
    private _buildTimeMs;
    constructor(vaultPath: string, pathFilter: PathFilter);
    get isBuilt(): boolean;
    get noteCount(): number;
    get linkCount(): number;
    get buildTimeMs(): number;
    /**
     * Build the complete index by scanning the vault.
     */
    build(): Promise<void>;
    /**
     * Index (or re-index) a single note from its content.
     */
    indexNote(relativePath: string, content: string, modified: number, size: number): void;
    /**
     * Remove a note from all indexes.
     */
    private removeFromIndexes;
    /**
     * Get all notes that link TO the given note.
     */
    getBacklinks(notePath: string): Array<{
        sourcePath: string;
        sourceName: string;
        links: WikiLink[];
    }>;
    /**
     * Get outgoing links from a specific note.
     */
    getOutgoingLinks(notePath: string): Array<{
        target: string;
        resolvedPath: string | null;
        alias?: string;
        heading?: string;
    }>;
    /**
     * Find notes that share tags or links with the given note (potential connections).
     */
    suggestLinks(notePath: string, limit?: number): Array<{
        path: string;
        name: string;
        reason: string;
        score: number;
    }>;
    /**
     * Find unlinked mentions — placeholder for future content-aware search.
     * Would require reading file content at query time.
     */
    findUnlinkedMentions(_notePath: string): Array<{
        inNote: string;
        mentionText: string;
        lineNumber: number;
    }>;
    /**
     * Get all notes with a specific tag.
     */
    getNotesByTag(tag: string): string[];
    /**
     * Get index stats.
     */
    getStats(): {
        totalNotes: number;
        totalLinks: number;
        totalTags: number;
        orphanedNotes: number;
        buildTimeMs: number;
    };
    /**
     * Get all indexed notes (for iteration).
     */
    getAllNotes(): IndexedNote[];
    /**
     * Get a single indexed note by path.
     */
    getNote(path: string): IndexedNote | undefined;
    /**
     * Resolve a note name to its path.
     */
    resolveNoteName(name: string): string | null;
    private findMarkdownFiles;
}
//# sourceMappingURL=vault-index.d.ts.map