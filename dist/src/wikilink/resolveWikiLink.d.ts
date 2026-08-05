/**
 * The parsed components of an Obsidian wiki link.
 *
 * @example
 * parseWikiLink('[[Doc Name#Heading|Display]]')
 * // { document: 'Doc Name' }
 */
export interface ParsedWikiLink {
    /**
     * The document name as it appears inside [[ ]] — without brackets,
     * without display text, without any `#fragment` suffix.
     * Append `.md` to get the filesystem filename.
     */
    document: string;
}
/**
 * Parse an Obsidian wiki link string into its components.
 *
 * Handles all wiki link forms:
 * - `[[Document Name]]`
 * - `[[Document Name|Display Text]]`
 * - `[[Document Name\|Display]]` — table-authored escape; `\|` unescapes to `|`
 * - Bare names without brackets (backslashes preserved as-is)
 *
 * A `#Heading` or `#^block-id` suffix is accepted but ignored: the fragment
 * is stripped and only the document name is returned.
 *
 * Throws on malformed input: if the parsed `document` still contains a
 * literal `\` after processing, the input is rejected rather than
 * heuristically interpreted.
 *
 * @param wikiLinkText - The raw wiki link string, with or without brackets
 * @returns The parsed basename
 * @throws Error when parsed components contain an unexpected backslash
 *
 * @see {@link ParsedWikiLink}
 */
export declare const parseWikiLink: (wikiLinkText: string) => ParsedWikiLink;
//# sourceMappingURL=resolveWikiLink.d.ts.map