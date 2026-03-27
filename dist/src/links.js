/**
 * Wiki-link parser and utilities for Obsidian vault.
 * Handles [[links]], [[links|aliases]], and [[links#headings]].
 */
// Matches [[target]], [[target|alias]], [[target#heading]], [[target#heading|alias]]
const WIKI_LINK_REGEX = /\[\[([^\[\]|#]+?)(?:#([^\[\]|]+?))?(?:\|([^\[\]]+?))?\]\]/g;
/**
 * Extract all wiki-links from markdown content.
 */
export function extractWikiLinks(content) {
    const links = [];
    let match;
    // Reset regex state
    WIKI_LINK_REGEX.lastIndex = 0;
    while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
        const raw = match[0];
        const target = match[1].trim();
        const heading = match[2]?.trim();
        const alias = match[3]?.trim();
        links.push({
            raw,
            target,
            ...(alias && { alias }),
            ...(heading && { heading }),
            offset: match.index,
        });
    }
    return links;
}
/**
 * Normalize a note name for comparison purposes.
 * Obsidian resolves links case-insensitively and strips .md extension.
 */
export function normalizeNoteName(name) {
    return name
        .replace(/\.md$/i, '')
        .replace(/\\/g, '/')
        .toLowerCase()
        .trim();
}
/**
 * Get just the note name from a path (e.g., "folder/My Note.md" → "My Note")
 */
export function noteNameFromPath(path) {
    const parts = path.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1] || '';
    return filename.replace(/\.md$/i, '');
}
/**
 * Insert a wiki-link into content at a sensible location.
 * If `afterText` is provided, inserts the link after that text.
 * Otherwise appends to the end of the content.
 */
export function insertWikiLink(content, targetNote, options = {}) {
    const { alias, afterText, newLine = true } = options;
    const link = alias ? `[[${targetNote}|${alias}]]` : `[[${targetNote}]]`;
    if (afterText) {
        const index = content.indexOf(afterText);
        if (index !== -1) {
            const insertAt = index + afterText.length;
            const prefix = newLine ? '\n' : ' ';
            return content.slice(0, insertAt) + prefix + link + content.slice(insertAt);
        }
    }
    // Append to end
    const separator = content.endsWith('\n') ? '' : '\n';
    return content + separator + '\n' + link + '\n';
}
