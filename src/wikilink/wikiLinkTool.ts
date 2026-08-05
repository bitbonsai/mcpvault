import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { FileSystemService } from '../filesystem.js';
import { parseWikiLink } from './resolveWikiLink.js';

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
export async function handleWikiLinkTool(
  fileSystem: FileSystemService,
  args: WikiLinkToolArgs,
): Promise<CallToolResult> {
  const indent = args.prettyPrint ? 2 : undefined;

  let parsed: ReturnType<typeof parseWikiLink>;
  try {
    parsed = parseWikiLink(args.document);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid wiki-link syntax';
    return {
      content: [{ type: 'text', text: message }],
      structuredContent: { rawInput: args.document },
      isError: true,
    };
  }

  const paths = await fileSystem.findPathForWikiLink(parsed.document);

  if (paths.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No file found for [[${parsed.document}]]. Use search_notes or list_directory to find the correct name.`,
      }],
      structuredContent: {
        document: parsed.document,
      },
      isError: true,
    };
  }

  const resolvedPath = paths[0] as string;
  const alternatives = paths.slice(1);
  const note = await fileSystem.readNote(resolvedPath);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        path: resolvedPath,
        fm: note.frontmatter,
        content: note.content,
      }, null, indent),
    }],
    structuredContent: {
      document: parsed.document,
      path: resolvedPath,
      ...(alternatives.length > 0 && { alternatives }),
    },
  };
}
