# obsidian-vault-mcp

A safe, link-aware MCP server for Obsidian vaults. Forked from [mcpvault](https://github.com/bitbonsai/mcpvault) with soft-delete safety and full wiki-link/backlink support added.

Works with Claude Code, Claude Desktop, or any MCP-compatible client. Obsidian does not need to be running — this reads and writes your vault's markdown files directly on disk.

## What it does

- Read, create, and edit notes in your Obsidian vault
- Search notes with BM25 ranking
- Manage tags and YAML frontmatter
- **Discover backlinks** — find every note that links to a given note via `[[wiki-links]]`
- **Trace outgoing links** — list all `[[links]]` from a note with resolved file paths
- **Suggest connections** — surface notes that should probably be linked based on shared tags, shared link targets, and unreciprocated backlinks
- **Insert links** — add `[[wiki-links]]` into notes at specific locations
- **Vault index** — in-memory index built on startup for fast link/backlink/tag lookups, with incremental updates on writes

## Safety model

Nothing is ever permanently lost. All destructive operations go through a `_trash/` folder inside your vault.

- **Soft delete.** `delete_note` moves files to `_trash/` with a timestamped `deleted-` prefix. The original is always recoverable.
- **Overwrite auto-backup.** When `write_note` is used in `overwrite` mode on an existing note, the original is automatically copied to `_trash/` before the new content is written.
- **Append by default.** `write_note` defaults to `append` mode — existing content is preserved unless you explicitly choose `overwrite`.
- **Vault sandboxing.** All paths are validated to stay within the vault directory. Symlink escape attempts are blocked.
- **System file protection.** `.obsidian/`, `.git/`, `node_modules/`, and dotfiles are inaccessible.

The `_trash/` folder can be cleaned up manually whenever you like. For additional safety, consider keeping your vault under git version control.

### Trash format

Files in `_trash/` are named: `deleted-YYYYMMDD-HHMMSS-OriginalName.md`

For example, deleting `Projects/Website.md` on March 26, 2026 at 3:30pm produces:
```
_trash/deleted-20260326-153012-Website.md
```

## Requirements

- Node.js >= 20.0.0
- npm >= 10.9.0

## Installation

```bash
# Clone or copy the project
cd ~/Repos
git clone <your-repo-url> obsidian-vault-mcp
cd obsidian-vault-mcp

# Install dependencies and build
npm install
npm run build
```

Verify it works:

```bash
node dist/server.js --help
```

## Configuration

### Finding your vault path

Your Obsidian vault is just a folder. Common macOS locations:

- `~/Documents/YourVaultName`
- `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/YourVaultName` (iCloud sync)
- `~/Obsidian/YourVaultName`

Open Obsidian, click the vault name in the bottom-left corner, and note the path shown.

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": [
        "/Users/you/Repos/obsidian-vault-mcp/dist/server.js",
        "/Users/you/Documents/MyVault"
      ]
    }
  }
}
```

Or use the CLI:

```bash
claude mcp add obsidian -- node ~/Repos/obsidian-vault-mcp/dist/server.js ~/Documents/MyVault
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": [
        "/Users/you/Repos/obsidian-vault-mcp/dist/server.js",
        "/Users/you/Documents/MyVault"
      ]
    }
  }
}
```

### Other MCP clients

Any MCP client that supports stdio transport can use this server. The command is:

```bash
node /path/to/obsidian-vault-mcp/dist/server.js /path/to/your/vault
```

## Verifying it works

After configuring, restart your client and try:

- "What files are in my Obsidian vault?"
- "Show me backlinks for my note called ProjectX"
- "Create a new note with today's date"

On startup, you'll see an index message in stderr:

```
[obsidian-vault-mcp] Indexed 142 notes with 387 links in 45ms
```

## Available tools

### Reading

| Tool | Description |
|------|-------------|
| `read_note` | Read a single note (content + frontmatter) |
| `read_multiple_notes` | Batch read up to 10 notes |

### Writing

| Tool | Description |
|------|-------------|
| `write_note` | Create or update a note (defaults to **append**; overwrite auto-backs up original to `_trash/`) |
| `patch_note` | Replace a specific string in a note (surgical edit) |

### Navigation

| Tool | Description |
|------|-------------|
| `list_directory` | List files and folders in the vault |
| `move_note` | Move or rename a note |
| `delete_note` | **Soft delete** — moves the note to `_trash/` with a timestamped prefix |

### Search

| Tool | Description |
|------|-------------|
| `search_notes` | Full-text BM25 search across content and/or frontmatter |

### Tags & Frontmatter

| Tool | Description |
|------|-------------|
| `update_frontmatter` | Update YAML frontmatter without changing content |
| `get_frontmatter` | Read just the frontmatter from a note |
| `manage_tags` | Add, remove, or list tags on a note |
| `list_all_tags` | List every tag in the vault with counts |

### Wiki-Links & Backlinks

| Tool | Description |
|------|-------------|
| `get_backlinks` | Find all notes that link TO a given note |
| `get_outgoing_links` | List all `[[links]]` from a note with resolved paths |
| `suggest_links` | Suggest connections based on shared tags and link patterns |
| `insert_link` | Insert a `[[wiki-link]]` into a note |

### Vault Info & Index

| Tool | Description |
|------|-------------|
| `get_notes_info` | Get metadata without reading content |
| `get_vault_stats` | Vault-wide statistics including link graph stats |
| `reindex_vault` | Rebuild the index after editing outside Claude |
| `get_index_stats` | Index statistics: notes, links, tags, orphaned notes |

## How the index works

On startup the server scans every `.md` file and builds an in-memory index of notes, outgoing `[[wiki-links]]`, backlinks, and tags. When you write or edit notes through Claude, the index updates incrementally. If you edit directly in Obsidian, call `reindex_vault` to sync.

Link formats supported: `[[Note Name]]`, `[[Note Name|display text]]`, `[[Note Name#heading]]`.

## Architecture

```
server.ts              — Entry point (stdio transport, index build on startup)
src/createServer.ts    — Tool definitions and request handlers
src/vault-index.ts     — In-memory index (links, backlinks, tags)
src/links.ts           — Wiki-link parser and utilities
src/filesystem.ts      — File operations with path validation and soft-delete
src/search.ts          — BM25 search
src/frontmatter.ts     — YAML frontmatter handling (gray-matter)
src/pathfilter.ts      — Path filtering and security
src/uri.ts             — Obsidian URI generation
src/types.ts           — TypeScript type definitions
```

## Credits

Forked from [mcpvault](https://github.com/bitbonsai/mcpvault) by bitbonsai. Original project provides file operations, search, frontmatter handling, and path security. This fork adds the vault index, link/backlink tools, soft-delete safety, and overwrite auto-backup.

## License

MIT
