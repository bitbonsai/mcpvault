# Agent Instructions

## Project Overview

MCPVault is a Model Context Protocol (MCP) server that provides a universal AI bridge for Obsidian vaults. It enables any MCP-compatible AI assistant (Claude, ChatGPT, Gemini, etc.) to safely read and write notes in Obsidian vaults while preserving YAML frontmatter and enforcing security boundaries.

## Commands

```bash
# MCP server
npm run build          # Compile TypeScript to dist/
npm test               # Run test suite (Vitest)
npm run test:watch     # Tests in watch mode
npm start /path/vault  # Run server locally with tsx

# Single test
npm test -- path/to/test.test.ts
npm test -- -t "test name pattern"

# Publishing
npm run publish:dry     # Dry run
npm run publish:beta    # Publish with beta tag
npm run publish:latest  # Publish as latest

# Website
npm run website         # Start Astro dev server with Bun (http://localhost:4321)

# MCP Inspector
npx @modelcontextprotocol/inspector npm start /path/to/vault
```

## Architecture

### File Structure

```
server.ts              # MCP server entry point, tool registration, request handlers
src/
  filesystem.ts        # FileSystemService — all file operations with security
  frontmatter.ts       # FrontmatterHandler — YAML parsing via gray-matter
  pathfilter.ts        # PathFilter — security layer for path validation
  search.ts            # SearchService — full-text search with token-optimized output
  uri.ts               # Obsidian URI generation
  types.ts             # All TypeScript interfaces
  *.test.ts            # Co-located test files
website/               # Astro 5 website (separate package, see website/AGENTS.md)
```

### Core Components

**server.ts** — Entry point. Registers 16 MCP tools, handles CLI args (--help, --version, vault path), initializes services, routes tool calls. Auto-trims whitespace from all path arguments. Exits on stdin EOF / SIGTERM / SIGINT (graceful `server.close()`), otherwise hosts orphan the process (#159).

**FileSystemService** (`src/filesystem.ts`) — Orchestrates file ops with security. Path resolution and traversal prevention. Implements: read, write, patch, delete, move, list, batch read, frontmatter update, tag management, vault stats. Uses native `fs/promises`.

**FrontmatterHandler** (`src/frontmatter.ts`) — Parses/stringifies YAML frontmatter via `gray-matter`. Validates structure (blocks functions, symbols, invalid types). Preserves original content.

**PathFilter** (`src/pathfilter.ts`) — Blocks `.obsidian/`, `.git/`, `node_modules/`, system files, dot files. Note tools allow `.md`, `.markdown`, `.txt`; directory listings may include other file types by filename. Checks path components independently.

**SearchService** (`src/search.ts`) — Content and frontmatter search with multi-word matching and BM25 relevance reranking. Returns token-optimized results with minified field names: `{p, t, ex, mc, ln, uri}`. Max 20 results.

### 16 MCP Tools

| Tool | Description |
|------|-------------|
| read_note | Read a single note with frontmatter |
| write_note | Create or overwrite (supports overwrite, append, prepend modes) |
| patch_note | Efficient partial update via find-and-replace |
| list_directory | List files and folders in the vault |
| delete_note | Delete a note (requires path confirmation) |
| search_notes | Full-text search across vault content |
| move_note | Move or rename a note |
| move_file | Move or rename any file (binary-safe, file-only, requires path confirmation) |
| read_multiple_notes | Batch read up to 10 notes |
| update_frontmatter | Safely update YAML frontmatter |
| get_notes_info | Get metadata without reading content |
| get_frontmatter | Extract frontmatter only |
| manage_tags | Add, remove, or list tags |
| get_vault_stats | Vault statistics: total notes, folders, size, recent files |
| list_all_tags | List all tags across the vault with occurrence counts |
| wiki_link | Resolve Obsidian [[wiki links]] (incl. path-qualified [[folder/Note]]) and return the note |

### Design Patterns

- **Service layer**: Each service has single responsibility, dependency-injected into server.ts, independently testable
- **Security-first**: All paths validated through PathFilter, `resolvePath()` prevents traversal, confirmation required for destructive ops
- **Token optimization**: Minified field names by default (`fm` not `frontmatter`), optional `prettyPrint` parameter, compact search format
- **Error handling**: Structured results with `success` boolean, failed batch ops return partial results (`ok` + `err` arrays)

### Key Implementation Details

- **Paths**: Always relative to vault root. Leading slashes stripped. Whitespace trimmed automatically.
- **Frontmatter**: Always use FrontmatterHandler for read/write. `originalContent` field has raw file content. Empty frontmatter = no YAML block.
- **Write modes**: overwrite (default), append (content to end, merge frontmatter), prepend (content to beginning, merge frontmatter)
- **Patch**: Exact string match including whitespace/newlines. `replaceAll: false` (default) fails on multiple matches to prevent accidents.
- **Version**: Read from `package.json` at runtime. Used in MCP server init, --version flag, and website nav badge.

## Website (Dual Content)

The `website/` directory is a separate Astro package. It serves content in two formats that **must be kept in sync**:

| Format | Location | Audience |
|--------|----------|----------|
| HTML (rich, interactive) | `website/src/components/` | Browsers |
| Markdown (plain text) | `website/public/*.md` + `llm.txt` | LLMs and AI agents |

When updating content, always update both. See `website/AGENTS.md` for full details and file mapping.

## Testing

Vitest with globals enabled, node environment. Test files co-located as `*.test.ts`.

When writing tests:
- Test both success and error cases
- Test path security (traversal, access denied)
- Test frontmatter parsing edge cases
- Use `Promise.allSettled` patterns for batch operations

## Security

When modifying file operations:
- Always validate paths through PathFilter
- Always use `resolvePath()` to prevent traversal
- Never expose system directories or configuration
- Validate frontmatter before writing
- Require confirmation for destructive operations

## Config Files

- `tsconfig.json` — Main TypeScript config (strict mode, ES2022 target, module/moduleResolution `nodenext`)
- `tsconfig.build.json` — Build config (excludes tests, outputs to `dist/`)
- `vitest.config.ts` — Test config (globals, node environment)

## Gotchas

- `dist/` is committed. Every src change needs `npm run build` + commit dist in the SAME change; src-only merges leave dist stale (happened twice: fde15eb engine swap, PR #151).
- TypeScript toolchain upgrades change dist output (TS7 altered `.d.ts.map` sourcemaps only) — rebuild + commit dist after any TS bump or the dirty tree blocks automation that requires clean main.
- Claude Code discovers skills only under `.claude/skills/`; repo keeps them in `skills/`. Committed symlink `.claude/skills/triage -> ../../skills/triage` bridges it — same pattern for any new skill.
- `pathFilter.isAllowed` + `normalizePath` must guard EVERY new tool's path input (PR #146 blocker: `readNoteLines` skipped them = read `.obsidian/` files). Mirror `readNote`'s guard block.
- Outline/heading parsing must be fence-aware: headings inside code fences do not count. Support backtick and tilde fences with up to three leading spaces, and require closing fences to use the same marker with at least the opening length.
