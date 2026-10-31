import type { CallToolResult } from '@modelcontextprotocol/server';
import type { FileSystemService } from '../filesystem.js';
export interface WikiLinkToolArgs {
    document: string;
    prettyPrint?: boolean;
}
/**
 * Handle the `wiki_link` MCP tool call.
 *
 * Resolves an Obsidian wiki-link reference against the vault and returns the
 * matching note. Designed to keep the MCP server request handler slim — all
 * wiki-link specific concerns live here.
 *
 * Response channels per MCP spec 2025-11-25:
 * - Invalid syntax or no match → `isError: true` with an actionable message.
 * - One or more matches → success; `structuredContent` carries `document`,
 *   `path` (the resolved pick), and `alternatives` (the other matched paths,
 *   present only when more than one file shares the basename).
 */
export declare function handleWikiLinkTool(fileSystem: FileSystemService, args: WikiLinkToolArgs): Promise<CallToolResult>;
//# sourceMappingURL=wikiLinkTool.d.ts.map