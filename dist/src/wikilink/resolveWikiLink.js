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
export const parseWikiLink = (wikiLinkText) => {
    let text = wikiLinkText.trim();
    const wasBracketed = text.startsWith('[[');
    if (wasBracketed) {
        text = text.slice(2);
    }
    if (text.endsWith(']]')) {
        text = text.slice(0, -2);
    }
    // Inside [[ ]] only: unescape Obsidian's table-authoring artifact `\|` → `|`.
    // Pipe is a reserved grammar character, so `\|` is unambiguous there.
    if (wasBracketed) {
        text = text.replace(/\\\|/g, '|');
    }
    // Strip |display text if present
    const pipeIndex = text.indexOf('|');
    if (pipeIndex !== -1) {
        text = text.slice(0, pipeIndex);
    }
    // Strip and ignore any #fragment suffix
    const hashIndex = text.indexOf('#');
    const rest = hashIndex !== -1 ? text.slice(hashIndex + 1) : '';
    const document = (hashIndex !== -1 ? text.slice(0, hashIndex) : text).trim();
    if (document.includes('\\') || rest.includes('\\')) {
        throw new Error(`Invalid wiki-link syntax: unexpected backslash in [[${wikiLinkText}]]. Only \\| inside [[ ]] is a recognized escape.`);
    }
    return { document };
};
