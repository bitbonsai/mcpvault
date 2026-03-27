import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { FileSystemService } from "./filesystem.js";
import { FrontmatterHandler, parseFrontmatter } from "./frontmatter.js";
import { PathFilter } from "./pathfilter.js";
import { SearchService } from "./search.js";
import { VaultIndex } from "./vault-index.js";
import { insertWikiLink } from "./links.js";
import { resolve } from "path";
import { readFile, stat } from "node:fs/promises";
export function createServer(vaultPath, options = {}) {
    const { name = "obsidian-vault-mcp", version = "1.0.0", pathFilter = new PathFilter(), frontmatterHandler = new FrontmatterHandler(), } = options;
    const resolvedVaultPath = resolve(vaultPath);
    const fileSystem = new FileSystemService(resolvedVaultPath, pathFilter, frontmatterHandler);
    const searchService = new SearchService(resolvedVaultPath, pathFilter);
    const vaultIndex = new VaultIndex(resolvedVaultPath, pathFilter);
    const server = new Server({ name, version }, {
        capabilities: { tools: {} },
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                // ── Reading ──────────────────────────────────────────────
                {
                    name: "read_note",
                    description: "Read a note from the Obsidian vault",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "read_multiple_notes",
                    description: "Read multiple notes in a batch (max 10 files)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            paths: { type: "array", items: { type: "string" }, description: "Array of note paths to read", maxItems: 10 },
                            includeContent: { type: "boolean", description: "Include note content (default: true)", default: true },
                            includeFrontmatter: { type: "boolean", description: "Include frontmatter (default: true)", default: true },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["paths"]
                    }
                },
                // ── Writing (safe — no delete) ───────────────────────────
                {
                    name: "write_note",
                    description: "Write a note to the Obsidian vault. Use this to CREATE new notes or to REPLACE an entire note's content. When using 'overwrite' mode on an existing note, the original is automatically backed up to _trash/ before writing. To change only part of a note, use patch_note instead. Defaults to 'append' mode.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root (e.g. 'Projects/Website.md')" },
                            content: { type: "string", description: "The full markdown content to write (do NOT include frontmatter here — use the frontmatter parameter)" },
                            frontmatter: { type: "object", description: "YAML frontmatter as a JSON object (optional). Example: {\"tags\": [\"project\"], \"status\": \"active\"}" },
                            mode: { type: "string", enum: ["overwrite", "append", "prepend"], description: "Write mode: 'append' (default — adds to end), 'prepend' (adds to start), 'overwrite' (replaces all content, auto-backs up original to _trash/)", default: "append" }
                        },
                        required: ["path", "content"]
                    }
                },
                {
                    name: "patch_note",
                    description: "Find-and-replace within a note. Use this to change a SPECIFIC PART of a note without rewriting the whole thing. You must provide the exact text to find (oldString) and the text to replace it with (newString). To rewrite an entire note, use write_note with mode 'overwrite' instead.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            oldString: { type: "string", description: "The exact existing text to find in the note (must match precisely, including whitespace)" },
                            newString: { type: "string", description: "The replacement text to insert where oldString was found" },
                            replaceAll: { type: "boolean", description: "Replace all occurrences if oldString appears multiple times (default: false — fails if multiple matches found)", default: false }
                        },
                        required: ["path", "oldString", "newString"]
                    }
                },
                // ── Navigation & Organization ────────────────────────────
                {
                    name: "list_directory",
                    description: "List files and directories in the vault",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path relative to vault root (default: '/')", default: "/" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        }
                    }
                },
                {
                    name: "move_note",
                    description: "Move or rename a note in the vault",
                    inputSchema: {
                        type: "object",
                        properties: {
                            oldPath: { type: "string", description: "Current path of the note" },
                            newPath: { type: "string", description: "New path for the note" },
                            overwrite: { type: "boolean", description: "Allow overwriting existing file (default: false)", default: false }
                        },
                        required: ["oldPath", "newPath"]
                    }
                },
                {
                    name: "delete_note",
                    description: "Soft-delete a note: moves it to the _trash/ folder with a timestamped 'deleted-' prefix. The original file is removed from its location but can always be recovered from _trash/.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note to delete" }
                        },
                        required: ["path"]
                    }
                },
                // ── Search ───────────────────────────────────────────────
                {
                    name: "search_notes",
                    description: "Search for notes in the vault by content or frontmatter using BM25 ranking",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query text" },
                            limit: { type: "number", description: "Maximum number of results (default: 5, max: 20)", default: 5 },
                            searchContent: { type: "boolean", description: "Search in note content (default: true)", default: true },
                            searchFrontmatter: { type: "boolean", description: "Search in frontmatter (default: false)", default: false },
                            caseSensitive: { type: "boolean", description: "Case sensitive search (default: false)", default: false },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["query"]
                    }
                },
                // ── Frontmatter & Tags ───────────────────────────────────
                {
                    name: "update_frontmatter",
                    description: "Update frontmatter of a note without changing content",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note" },
                            frontmatter: { type: "object", description: "Frontmatter object to update" },
                            merge: { type: "boolean", description: "Merge with existing frontmatter (default: true)", default: true }
                        },
                        required: ["path", "frontmatter"]
                    }
                },
                {
                    name: "get_frontmatter",
                    description: "Extract frontmatter from a note without reading the content",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "manage_tags",
                    description: "Add, remove, or list tags in a note",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            operation: { type: "string", enum: ["add", "remove", "list"], description: "Operation to perform" },
                            tags: { type: "array", items: { type: "string" }, description: "Tags to add/remove (required for add/remove)" }
                        },
                        required: ["path", "operation"]
                    }
                },
                {
                    name: "list_all_tags",
                    description: "List all tags across the vault with occurrence counts",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        }
                    }
                },
                // ── Vault Info ───────────────────────────────────────────
                {
                    name: "get_notes_info",
                    description: "Get metadata for notes without reading full content",
                    inputSchema: {
                        type: "object",
                        properties: {
                            paths: { type: "array", items: { type: "string" }, description: "Array of note paths" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["paths"]
                    }
                },
                {
                    name: "get_vault_stats",
                    description: "Get vault statistics including total notes, folders, size, recently modified files, and link graph stats",
                    inputSchema: {
                        type: "object",
                        properties: {
                            recentCount: { type: "number", description: "Number of recently modified files to return (default: 5, max: 20)", default: 5 },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        }
                    }
                },
                // ── Wiki-Links & Backlinks (NEW) ─────────────────────────
                {
                    name: "get_backlinks",
                    description: "Find all notes that link TO the specified note via [[wiki-links]]. Essential for understanding how a note connects to the rest of your vault.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note (e.g. 'Projects/My Project.md')" },
                            prettyPrint: { type: "boolean", description: "Format JSON with indentation (default: false)", default: false }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "get_outgoing_links",
                    description: "List all [[wiki-links]] from a specific note, with resolved paths for each target.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note" },
                            prettyPrint: { type: "boolean", description: "Format JSON with indentation (default: false)", default: false }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "suggest_links",
                    description: "Suggest notes that should probably be linked to the given note, based on shared tags, shared link targets, and un-reciprocated backlinks. Great for discovering connections you haven't made yet.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note" },
                            limit: { type: "number", description: "Max suggestions (default: 10)", default: 10 },
                            prettyPrint: { type: "boolean", description: "Format JSON with indentation (default: false)", default: false }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "insert_link",
                    description: "Insert a [[wiki-link]] into an existing note. Optionally specify where to insert it (after a specific string) or it appends to the end.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note to insert the link into" },
                            targetNote: { type: "string", description: "Name of the note to link to (without .md extension)" },
                            alias: { type: "string", description: "Optional display text for the link" },
                            afterText: { type: "string", description: "Insert the link after this text (optional, otherwise appends)" }
                        },
                        required: ["path", "targetNote"]
                    }
                },
                // ── Index Management ─────────────────────────────────────
                {
                    name: "reindex_vault",
                    description: "Rebuild the in-memory vault index. Use this after making changes to notes outside of Claude (e.g. editing in Obsidian directly). The index powers backlinks, outgoing links, and link suggestions.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prettyPrint: { type: "boolean", description: "Format JSON with indentation (default: false)", default: false }
                        }
                    }
                },
                {
                    name: "get_index_stats",
                    description: "Get statistics about the vault index: total notes indexed, total links, total tags, orphaned notes (no links in or out), and build time.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prettyPrint: { type: "boolean", description: "Format JSON with indentation (default: false)", default: false }
                        }
                    }
                }
            ]
        };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name: toolName, arguments: args } = request.params;
        const trimmedArgs = trimPaths(args);
        // Ensure index is built before link-related operations
        const linkTools = ['get_backlinks', 'get_outgoing_links', 'suggest_links', 'get_index_stats'];
        if (linkTools.includes(toolName) && !vaultIndex.isBuilt) {
            await vaultIndex.build();
        }
        try {
            switch (toolName) {
                // ── Reading ──────────────────────────────────────────
                case "read_note": {
                    const note = await fileSystem.readNote(trimmedArgs.path);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({ fm: note.frontmatter, content: note.content }, null, indent) }]
                    };
                }
                case "read_multiple_notes": {
                    const result = await fileSystem.readMultipleNotes({
                        paths: trimmedArgs.paths,
                        includeContent: trimmedArgs.includeContent,
                        includeFrontmatter: trimmedArgs.includeFrontmatter
                    });
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ok: result.successful, err: result.failed }, null, indent) }]
                    };
                }
                // ── Writing ─────────────────────────────────────────
                case "write_note": {
                    const fm = parseFrontmatter(trimmedArgs.frontmatter);
                    const mode = trimmedArgs.mode || 'append';
                    await fileSystem.writeNote({
                        path: trimmedArgs.path,
                        content: trimmedArgs.content,
                        ...(fm !== undefined && { frontmatter: fm }),
                        mode
                    });
                    // Update index incrementally
                    if (vaultIndex.isBuilt) {
                        try {
                            const fullPath = resolve(resolvedVaultPath, trimmedArgs.path);
                            const content = await readFile(fullPath, 'utf-8');
                            const stats = await stat(fullPath);
                            vaultIndex.indexNote(trimmedArgs.path, content, stats.mtime.getTime(), stats.size);
                        }
                        catch { /* index update is best-effort */ }
                    }
                    const modeNote = mode === 'overwrite' ? ' (original backed up to _trash/)' : '';
                    return {
                        content: [{ type: "text", text: `Successfully wrote note: ${trimmedArgs.path} (mode: ${mode})${modeNote}` }]
                    };
                }
                case "patch_note": {
                    const result = await fileSystem.patchNote({
                        path: trimmedArgs.path,
                        oldString: trimmedArgs.oldString,
                        newString: trimmedArgs.newString,
                        replaceAll: trimmedArgs.replaceAll
                    });
                    // Update index incrementally
                    if (vaultIndex.isBuilt && result.success) {
                        try {
                            const fullPath = resolve(resolvedVaultPath, trimmedArgs.path);
                            const content = await readFile(fullPath, 'utf-8');
                            const stats = await stat(fullPath);
                            vaultIndex.indexNote(trimmedArgs.path, content, stats.mtime.getTime(), stats.size);
                        }
                        catch { /* best-effort */ }
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                // ── Navigation ──────────────────────────────────────
                case "list_directory": {
                    const listing = await fileSystem.listDirectory(trimmedArgs.path || '');
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({ dirs: listing.directories, files: listing.files }, null, indent) }]
                    };
                }
                case "move_note": {
                    const result = await fileSystem.moveNote({
                        oldPath: trimmedArgs.oldPath,
                        newPath: trimmedArgs.newPath,
                        overwrite: trimmedArgs.overwrite
                    });
                    // Re-index after move
                    if (vaultIndex.isBuilt && result.success) {
                        await vaultIndex.build(); // Full rebuild since paths changed
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                case "delete_note": {
                    const result = await fileSystem.softDeleteNote(trimmedArgs.path);
                    // Re-index after delete
                    if (vaultIndex.isBuilt && result.success) {
                        await vaultIndex.build();
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                // ── Search ──────────────────────────────────────────
                case "search_notes": {
                    const results = await searchService.search({
                        query: trimmedArgs.query,
                        limit: trimmedArgs.limit,
                        searchContent: trimmedArgs.searchContent,
                        searchFrontmatter: trimmedArgs.searchFrontmatter,
                        caseSensitive: trimmedArgs.caseSensitive
                    });
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(results, null, indent) }]
                    };
                }
                // ── Frontmatter & Tags ──────────────────────────────
                case "update_frontmatter": {
                    const fm = parseFrontmatter(trimmedArgs.frontmatter);
                    if (!fm)
                        throw new Error('frontmatter is required');
                    await fileSystem.updateFrontmatter({
                        path: trimmedArgs.path,
                        frontmatter: fm,
                        merge: trimmedArgs.merge
                    });
                    return {
                        content: [{ type: "text", text: `Successfully updated frontmatter for: ${trimmedArgs.path}` }]
                    };
                }
                case "get_frontmatter": {
                    const note = await fileSystem.readNote(trimmedArgs.path);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(note.frontmatter, null, indent) }]
                    };
                }
                case "manage_tags": {
                    const result = await fileSystem.manageTags({
                        path: trimmedArgs.path,
                        operation: trimmedArgs.operation,
                        tags: trimmedArgs.tags
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                case "list_all_tags": {
                    const tags = await fileSystem.listAllTags();
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(tags, null, indent) }]
                    };
                }
                // ── Vault Info ──────────────────────────────────────
                case "get_notes_info": {
                    const result = await fileSystem.getNotesInfo(trimmedArgs.paths);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, indent) }]
                    };
                }
                case "get_vault_stats": {
                    const recentCount = Math.min(trimmedArgs.recentCount || 5, 20);
                    const vaultStats = await fileSystem.getVaultStats(recentCount);
                    const indexStats = vaultIndex.isBuilt ? vaultIndex.getStats() : null;
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({
                                    notes: vaultStats.totalNotes,
                                    folders: vaultStats.totalFolders,
                                    size: vaultStats.totalSize,
                                    recent: vaultStats.recentlyModified,
                                    ...(indexStats && {
                                        index: {
                                            totalLinks: indexStats.totalLinks,
                                            totalTags: indexStats.totalTags,
                                            orphanedNotes: indexStats.orphanedNotes,
                                        }
                                    })
                                }, null, indent) }]
                    };
                }
                // ── Wiki-Links & Backlinks ──────────────────────────
                case "get_backlinks": {
                    const backlinks = vaultIndex.getBacklinks(trimmedArgs.path);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({
                                    target: trimmedArgs.path,
                                    backlinkCount: backlinks.length,
                                    backlinks: backlinks.map(bl => ({
                                        from: bl.sourcePath,
                                        name: bl.sourceName,
                                        linkCount: bl.links.length,
                                        links: bl.links.map(l => ({
                                            raw: l.raw,
                                            ...(l.alias && { alias: l.alias }),
                                            ...(l.heading && { heading: l.heading }),
                                        }))
                                    }))
                                }, null, indent) }]
                    };
                }
                case "get_outgoing_links": {
                    const links = vaultIndex.getOutgoingLinks(trimmedArgs.path);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({
                                    source: trimmedArgs.path,
                                    linkCount: links.length,
                                    links: links.map(l => ({
                                        target: l.target,
                                        resolved: l.resolvedPath,
                                        exists: l.resolvedPath !== null,
                                        ...(l.alias && { alias: l.alias }),
                                        ...(l.heading && { heading: l.heading }),
                                    }))
                                }, null, indent) }]
                    };
                }
                case "suggest_links": {
                    const suggestions = vaultIndex.suggestLinks(trimmedArgs.path, trimmedArgs.limit || 10);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({
                                    source: trimmedArgs.path,
                                    suggestionCount: suggestions.length,
                                    suggestions: suggestions.map(s => ({
                                        path: s.path,
                                        name: s.name,
                                        reason: s.reason,
                                        score: s.score,
                                    }))
                                }, null, indent) }]
                    };
                }
                case "insert_link": {
                    const notePath = trimmedArgs.path;
                    const targetNote = trimmedArgs.targetNote;
                    // Read current content
                    const note = await fileSystem.readNote(notePath);
                    // Insert the link
                    const updatedContent = insertWikiLink(note.content, targetNote, {
                        alias: trimmedArgs.alias,
                        afterText: trimmedArgs.afterText,
                    });
                    // Write back
                    await fileSystem.writeNote({
                        path: notePath,
                        content: updatedContent,
                        frontmatter: note.frontmatter,
                        mode: 'overwrite'
                    });
                    // Update index
                    if (vaultIndex.isBuilt) {
                        try {
                            const fullPath = resolve(resolvedVaultPath, notePath);
                            const content = await readFile(fullPath, 'utf-8');
                            const stats = await stat(fullPath);
                            vaultIndex.indexNote(notePath, content, stats.mtime.getTime(), stats.size);
                        }
                        catch { /* best-effort */ }
                    }
                    const linkText = trimmedArgs.alias
                        ? `[[${targetNote}|${trimmedArgs.alias}]]`
                        : `[[${targetNote}]]`;
                    return {
                        content: [{ type: "text", text: `Inserted ${linkText} into ${notePath}` }]
                    };
                }
                // ── Index Management ────────────────────────────────
                case "reindex_vault": {
                    await vaultIndex.build();
                    const stats = vaultIndex.getStats();
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({
                                    message: "Vault index rebuilt successfully",
                                    ...stats
                                }, null, indent) }]
                    };
                }
                case "get_index_stats": {
                    const stats = vaultIndex.getStats();
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(stats, null, indent) }]
                    };
                }
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        }
        catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                isError: true
            };
        }
    });
    return { server, index: vaultIndex };
}
function trimPaths(args) {
    const trimmed = { ...args };
    if (trimmed.path && typeof trimmed.path === 'string')
        trimmed.path = trimmed.path.trim();
    if (trimmed.oldPath && typeof trimmed.oldPath === 'string')
        trimmed.oldPath = trimmed.oldPath.trim();
    if (trimmed.newPath && typeof trimmed.newPath === 'string')
        trimmed.newPath = trimmed.newPath.trim();
    if (trimmed.paths && Array.isArray(trimmed.paths)) {
        trimmed.paths = trimmed.paths.map((p) => typeof p === 'string' ? p.trim() : p);
    }
    return trimmed;
}
