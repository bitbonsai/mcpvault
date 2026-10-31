# MCPVault features

MCPVault works directly with vault files. These tools and path checks define what clients can do with them.

## Core features

### Full-text search

Search matches note filenames and content, supports multiple words, and ranks results with BM25.

### Frontmatter updates

AST-aware YAML updates preserve raw formatting for unmodified fields. Dates, quotes, and time values keep their original form while only changed keys are rewritten.

### Note and file operations

Tools read, write, patch, move, list, and delete notes. Patch updates replace exact text instead of rewriting full files.

### Vault boundary

Path checks block traversal, symlink escapes, dotfiles, `.obsidian`, `.git`, and `node_modules`.

### Runs on Node.js

MCP clients launch the server as a local Node.js process over stdio.

### Compact responses

Search and batch responses use short field names by default. Set `prettyPrint` for expanded output.

### TypeScript API

The package exports TypeScript declarations and public types for library use.

### MIT licensed

Source code, tests, and issue tracking are public on GitHub.

### 18 MCP tools

Tools cover note reads and writes, exact patches, file moves, search, tags, frontmatter, outlines, line ranges, and vault statistics.

### MCP client support

Setup guides cover Claude Desktop, ChatGPT+ Desktop, Claude Code, OpenCode, Gemini CLI, OpenAI Codex, Cursor, Windsurf, and IntelliJ.

## Compare access methods

The main difference is where each approach runs and which layer controls access to vault files.

| Feature | MCPVault | Plugin + REST API | General file access |
|---|---|---|---|
| Setup | Run `npx` with the vault path | Install and configure a REST API plugin | Configure filesystem access in each client |
| Obsidian running | Not required | Required | Not required |
| Plugin dependency | None | Community REST API plugin | None |
| Frontmatter updates | AST-aware; preserves unchanged formatting | Depends on plugin endpoint | Depends on file editing tool |
| Search | Filename and content search with BM25 ranking | Search exposed by plugin | Depends on client or shell tool |
| Connection | Local stdio | Local HTTP | Local process |
| Move operations | Built-in note and file moves with vault path checks | Depends on plugin endpoint | Depends on file editing tool |
| Access boundary | Vault-scoped path and symlink checks | Follows plugin and Obsidian settings | Follows client filesystem permissions |

MCPVault provides 18 tools, requires no Obsidian plugin, and supports five note file types.

## FAQ

### Does my data leave my computer?

MCPVault reads and writes files on your machine and has no hosted service. Your AI client or provider may receive note content used in requests.

### Does Obsidian need to be running?

No. MCPVault uses filesystem access, so Obsidian can be closed.

### Can I use multiple vaults?

Yes. Configure one MCP server entry for each vault path.

### What file types are supported?

Read and write tools support `.md`, `.markdown`, `.txt`, `.base`, and `.canvas` files. `list_directory` may show other filenames, but note tools do not read those files as notes.

### Is search semantic?

No. Search uses lexical matching with BM25 ranking, not embeddings or a vector index. For semantic search, pair MCPVault with a separate vector-search MCP server such as Qdrant's [mcp-server-qdrant](https://github.com/qdrant/mcp-server-qdrant) or Chroma's [chroma-mcp](https://github.com/chroma-core/chroma-mcp).

### What if the AI makes a mistake?

Use backups or version control for recovery. Deletions require path confirmation, and file operations are restricted to the configured vault.
