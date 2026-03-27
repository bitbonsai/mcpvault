/**
 * Wiki-link parser and utilities for Obsidian vault.
 * Handles [[links]], [[links|aliases]], and [[links#headings]].
 */
export interface WikiLink {
    /** Raw match text e.g. "[[Note Name|alias]]" */
    raw: string;
    /** Target note name (without extension) */
    target: string;
    /** Optional alias text */
    alias?: string;
    /** Optional heading/block reference */
    heading?: string;
    /** Character offset in content */
    offset: number;
}
/**
 * Extract all wiki-links from markdown content.
 */
export declare function extractWikiLinks(content: string): WikiLink[];
/**
 * Normalize a note name for comparison purposes.
 * Obsidian resolves links case-insensitively and strips .md extension.
 */
export declare function normalizeNoteName(name: string): string;
/**
 * Get just the note name from a path (e.g., "folder/My Note.md" → "My Note")
 */
export declare function noteNameFromPath(path: string): string;
/**
 * Insert a wiki-link into content at a sensible location.
 * If `afterText` is provided, inserts the link after that text.
 * Otherwise appends to the end of the content.
 */
export declare function insertWikiLink(content: string, targetNote: string, options?: {
    alias?: string;
    afterText?: string;
    newLine?: boolean;
}): string;
//# sourceMappingURL=links.d.ts.map