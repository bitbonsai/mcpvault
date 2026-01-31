<div align="center">
  <img width="256" height="256" alt="image" src="https://github.com/user-attachments/assets/1e21d898-811b-42c2-a810-bf921dde0f58" />
</div>

# MCP-Obsidian

A universal AI bridge for Obsidian vaults using the Model Context Protocol (MCP) standard. Connect any MCP-compatible AI assistant to your knowledge base - works with Claude, ChatGPT, and future AI tools. This server provides safe read/write access to your notes while preventing YAML frontmatter corruption.

<div align="center">
  
[https://mcp-obsidian.org](https://mcp-obsidian.org)

</div>

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/jbxr/mcp-obsidian?style=flat&logo=github&logoColor=white&color=9065ea&labelColor=262626)](https://github.com/jbxr/mcp-obsidian)
[![npm version](https://img.shields.io/npm/v/@mauricio.wolff/mcp-obsidian?style=flat&logo=npm&logoColor=white&color=9065ea&labelColor=262626)](https://www.npmjs.com/package/@mauricio.wolff/mcp-obsidian)
[![npm downloads](https://img.shields.io/npm/dt/@mauricio.wolff/mcp-obsidian?style=flat&logo=npm&logoColor=white&color=9065ea&labelColor=262626)](https://www.npmjs.com/package/@mauricio.wolff/mcp-obsidian)

</div>



## Universal Compatibility
Works with any MCP-compatible AI assistant including Claude Desktop, Claude Code, ChatGPT Desktop (Enterprise+), IntelliJ IDEA 2025.1+, Cursor IDE, Windsurf IDE, and future AI platforms that adopt the MCP standard.

https://github.com/user-attachments/assets/657ac4c6-1cd2-4cc3-829f-fd095a32f71c

## Quick Start (5 minutes)

1. **Install Node.js runtime:**
   ```bash
   # Download from https://nodejs.org (v18.0.0 or later)
   # or use a package manager like nvm, brew, apt, etc.
   ```

2. **Test the server:**

   If using the published package:
   ```bash
   npx @modelcontextprotocol/inspector npx @mauricio.wolff/mcp-obsidian@latest /path/to/your/vault
   ```

3. **Configure your AI client:**

   **Claude Desktop** - Copy this to `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "obsidian": {
         "command": "npx",
         "args": ["@mauricio.wolff/mcp-obsidian@latest", "/path/to/your/vault"]
       }
     }
   }
   ```

   **Claude Code** - Copy this to `~/.claude.json`:
   ```json
   {
     "mcpServers": {
       "obsidian": {
         "command": "npx",
         "args": ["@mauricio.wolff/mcp-obsidian@latest", "/path/to/your/vault"],
         "env": {}
       }
     }
   }
   ```

   Replace `/path/to/your/vault` with your actual Obsidian vault path.

   For other platforms, see [detailed configuration guides](#ai-client-configuration) below.

4. **Test with your AI:**
   - "List files in my Obsidian vault"
   - "Read my note called 'project-ideas.md'"
   - "Create a new note with today's date"

**Success indicators:** Your AI should be able to list files and read notes from your vault.

## Claude Desktop Extension (.mcpb)

**One-Click Installation for Claude Desktop (Recommended for Claude users)**

MCP-Obsidian is now available as a Claude Desktop Extension (.mcpb) for seamless installation:

### What is an MCPB Extension?

MCPB (MCP Bundle) extensions are packaged MCP servers that can be installed in Claude Desktop with a single click - similar to browser extensions. No manual configuration or command-line setup required!

### Installing the Extension

1. **Download the latest release:**
   - Visit the [Releases page](https://github.com/jbxr/mcp-obsidian/releases)
   - Download the `mcp-obsidian-X.X.X.mcpb` file

2. **Install in Claude Desktop:**
   - **Option 1:** Double-click the downloaded `.mcpb` file
   - **Option 2:** Open Claude Desktop → Settings → MCP → Add Server → Browse and select the `.mcpb` file

3. **Configure your vault:**
   - When prompted, select your Obsidian vault directory
   - Claude Desktop will automatically configure and start the server

4. **Start using:**
   - The server will appear in Claude's available tools
   - Try: "List files in my Obsidian vault" or "Read my note called 'ideas.md'"

### Benefits of MCPB Installation

- ✅ **No command-line required** - Simple GUI installation
- ✅ **Automatic updates** - Claude Desktop can manage updates
- ✅ **Easy configuration** - Visual interface for vault selection
- ✅ **Portable** - Share the `.mcpb` file with team members
- ✅ **Secure** - All code runs locally on your machine

### Alternative: NPX Installation

If you prefer the traditional method or use other MCP clients (ChatGPT, Claude Code, etc.), continue with the [Quick Start](#quick-start-5-minutes) instructions above.

## Why MCP-Obsidian?

### Universal AI Compatibility
Built on the open Model Context Protocol standard, MCP-Obsidian is not locked to any single AI provider. As more AI assistants adopt MCP, your investment in this tool grows more valuable. Today it works with Claude and ChatGPT - tomorrow it will work with whatever AI tools emerge.

### Future-Proof Your Knowledge Base
Instead of waiting for each AI company to build Obsidian integrations, MCP-Obsidian provides a universal adapter that works with any MCP-compatible assistant. One tool, endless possibilities.

### Open Standard, No Lock-in
MCP is an open protocol. You're not tied to any specific vendor or platform. Your notes remain yours, accessible through any compatible AI assistant.

## Features

- ✅ Safe frontmatter parsing and validation using gray-matter
- ✅ Path filtering to exclude `.obsidian` directory and other system files
- ✅ **Complete MCP toolkit**: 11 methods covering all vault operations
  - File operations: `read_note`, `write_note`, `delete_note`, `move_note`
  - Directory operations: `list_directory`
  - Batch operations: `read_multiple_notes`
  - Search: `search_notes` with content and frontmatter support
  - Metadata: `get_frontmatter`, `update_frontmatter`, `get_notes_info`
  - Tag management: `manage_tags` (add, remove, list)
- ✅ Write modes: `overwrite`, `append`, `prepend` for flexible content editing
- ✅ Tag management: add, remove, and list tags in notes
- ✅ Safe deletion with confirmation requirement to prevent accidents
- ✅ Automatic path trimming to handle whitespace in inputs
- ✅ TypeScript support with Node.js runtime (using tsx for execution)
- ✅ Comprehensive error handling and validation
- ✅ **Token-optimized responses**: 40-60% smaller responses with minified field names and compact JSON (v0.6.3+)
- ✅ **Optional pretty-printing**: Set `prettyPrint: true` for human-readable debugging
- ✅ **Performance optimized**: No unnecessary token consumption, efficient for large vaults
- ✅ **Zero dependencies**: No Obsidian plugins required, works with any vault structure

## Prerequisites

- [Node.js](https://nodejs.org) runtime (v18.0.0 or later)
- An Obsidian vault (local directory with `.md` files)
- MCP-compatible AI client (Claude Desktop, ChatGPT Desktop, Claude Code, etc.)

## Installation

### For End Users (Recommended)

No installation needed! Use `npx` to run directly:

```bash
npx @mauricio.wolff/mcp-obsidian@latest /path/to/your/obsidian/vault
```

### For Developers

1. Clone this repository
2. Use the correct Node.js version:
```bash
nvm use  # Uses Node 24 from .nvmrc
```
3. Install dependencies with npm:
```bash
npm install  # Corepack automatically uses npm 10.9.0
```

4. Test locally with MCP inspector:
```bash
npx @modelcontextprotocol/inspector npm start /path/to/your/vault
```

**Pro tip:** Use MCP Inspector to test all server functionality before configuring with AI clients:
```bash
# Install globally for easier access
npm install -g @modelcontextprotocol/inspector

# Test with any vault
mcp-inspector npx @mauricio.wolff/mcp-obsidian@latest /path/to/your/vault
```

## Usage

### Running the Server

**End users:**
```bash
npx @mauricio.wolff/mcp-obsidian@latest /path/to/your/obsidian/vault
```

**Developers:**
```bash
npm start /path/to/your/obsidian/vault
```

### AI Client Configuration

#### Claude Desktop

Add to your Claude Desktop configuration file:

**Single Vault:**
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["@mauricio.wolff/mcp-obsidian@latest", "/Users/yourname/Documents/MyVault"]
    }
  }
}
```

**Multiple Vaults:**
```json
{
  "mcpServers": {
    "obsidian-personal": {
      "command": "npx",
      "args": ["@mauricio.wolff/mcp-obsidian@latest", "/Users/yourname/Documents/PersonalVault"]
    },
    "obsidian-work": {
      "command": "npx",
      "args": ["@mauricio.wolff/mcp-obsidian@latest", "/Users/yourname/Documents/WorkVault"]
    }
  }
}
```

**Configuration File Locations:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `C:\Users\{username}\AppData\Roaming\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

*You can also access this through Claude Desktop → Settings → Developer → Edit Config*

#### ChatGPT Desktop

**Requirements:** ChatGPT Enterprise, Education, or Team subscription (not available for individual Plus users)

ChatGPT uses MCP through Deep Research and developer mode. Configuration is done through the ChatGPT interface:

1. Access ChatGPT developer mode (beta feature)
2. Configure MCP servers through the built-in MCP client
3. Create custom connectors for your organization

*Note: ChatGPT Desktop's MCP integration is currently limited to enterprise subscriptions and uses a different setup process than file-based configuration.*

#### Claude Code

Claude Code uses `.claude.json` configuration file:

**User-scoped (recommended):**
Edit `~/.claude.json`:
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["@mauricio.wolff/mcp-obsidian@latest", "/path/to/your/vault"],
      "env": {}
    }
  }
}
```

**Project-scoped:**
Edit `.claude.json` in your project or add to the projects section:
```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "obsidian": {
          "command": "npx",
          "args": ["@mauricio.wolff/mcp-obsidian@latest", "/path/to/your/vault"]
        }
      }
    }
  }
}
```

**Using Claude Code CLI:**
```bash
claude mcp add obsidian --scope user npx @mauricio.wolff/mcp-obsidian /path/to/your/vault
```

#### Goose Desktop

On Goose Desktop settings, click **Add custom extension**, and on the command field add:

```bash
npx @mauricio.wolff/mcp-obsidian@latest /path/to/your/vault
```

#### Other MCP-Compatible Clients (2025)

**Confirmed MCP Support:**
- **IntelliJ IDEA 2025.1+** - Native MCP client support
- **Cursor IDE** - Built-in MCP compatibility
- **Windsurf IDE** - Full MCP integration
- **Zed, Replit, Codeium, Sourcegraph** - In development
- **Microsoft Copilot Studio** - Native MCP support with one-click server connections

Most modern MCP clients use similar JSON configuration patterns. Refer to your specific client's documentation for exact setup instructions.

### Examples

#### Ask your AI assistant about your notes:
- "What files are in my Obsidian vault?"
- "Read my note called 'project-ideas.md'"
- "Show me all notes with 'AI' in the title"

#### Have your AI assistant help with note management:
- "Create a new note called 'meeting-notes.md' with today's date in the frontmatter"
- "Append today's journal entry to my daily note"
- "Prepend an urgent task to my todo list"
- "Add the tags 'project' and 'urgent' to my task note"
- "List all tags in my research note"
- "Remove the 'draft' tag from my completed article"
- "List all markdown files in my 'Projects' folder"
- "Delete the old draft note 'draft-ideas.md' (with confirmation)"

#### Advanced Use Cases:
- **Knowledge Synthesis**: "Summarize all my research notes tagged with 'machine-learning' from the last month"
- **Project Management**: "Update the status in all project notes to 'completed' and add today's date"
- **Content Analysis**: "Find all notes that mention 'API design' and create a comprehensive guide"
- **Smart Tagging**: "Review my untagged notes and suggest appropriate tags based on content"

## Troubleshooting

### Common Issues

#### "command not found: npx"
- **Solution:** Install Node.js runtime from [nodejs.org](https://nodejs.org)
- **Alternative:** Use global install: `npm install -g @mauricio.wolff/mcp-obsidian`

#### "Usage: node server.ts /path/to/vault"
- **Cause:** No vault path provided
- **Solution:** Specify the full path to your Obsidian vault directory

#### "Permission denied" errors
- **Cause:** Insufficient file system permissions
- **Solution:** Ensure the vault directory is readable/writable by your user

#### "Path traversal not allowed"
- **Cause:** Trying to access files outside the vault
- **Solution:** All file paths must be relative to the vault root

#### AI client not recognizing the server
1. Check the configuration file path is correct for your OS
2. Ensure JSON syntax is valid (use a JSON validator)
3. Restart your AI client after configuration changes
4. Check your AI client's logs for error messages
5. Verify your AI client supports MCP (Model Context Protocol)

#### ".obsidian files still showing up"
- **Expected:** The path filter automatically excludes `.obsidian/**` patterns
- **If still seeing them:** The filter is working as designed for security

### Debug Mode

Run with error logging:
```bash
npx @mauricio.wolff/mcp-obsidian /path/to/vault 2>debug.log
```

### Getting Help

- [Open an issue](https://github.com/jbxr/mcp-obsidian/issues) on GitHub
- Include your OS, Node.js version, and error messages
- Provide the vault directory structure (without sensitive content)

## Testing

Run the test suite:
```bash
npm test
```

## API Methods

### `read_note`
Read a note from the vault with parsed frontmatter.

**Request:**
```json
{
  "name": "read_note",
  "arguments": {
    "path": "project-ideas.md",
    "prettyPrint": false
  }
}
```

**Response (optimized for tokens):**
```json
{"fm":{"title":"Project Ideas","tags":["projects","brainstorming"],"created":"2023-01-15T10:30:00.000Z"},"content":"# Project Ideas\n\n## AI Tools\n- MCP server for Obsidian\n- Voice note transcription\n\n## Web Apps\n- Task management system"}
```

**Response (with prettyPrint: true):**
```json
{
  "fm": {
    "title": "Project Ideas",
    "tags": ["projects", "brainstorming"],
    "created": "2023-01-15T10:30:00.000Z"
  },
  "content": "# Project Ideas\n\n## AI Tools\n- MCP server for Obsidian\n- Voice note transcription\n\n## Web Apps\n- Task management system"
}
```

### `write_note`
Write a note to the vault with optional frontmatter and write mode.

**Write Modes:**
- `overwrite` (default): Replace entire file content
- `append`: Add content to the end of existing file
- `prepend`: Add content to the beginning of existing file

**Request (Overwrite):**
```json
{
  "name": "write_note",
  "arguments": {
    "path": "meeting-notes.md",
    "content": "# Team Meeting\n\n## Agenda\n- Project updates\n- Next milestones",
    "frontmatter": {
      "title": "Team Meeting Notes",
      "date": "2023-12-01",
      "tags": ["meetings", "team"]
    },
    "mode": "overwrite"
  }
}
```

**Request (Append):**
```json
{
  "name": "write_note",
  "arguments": {
    "path": "daily-log.md",
    "content": "\n\n## 3:00 PM Update\n- Completed project review\n- Started new feature",
    "mode": "append"
  }
}
```

**Response:**
```json
{
  "message": "Successfully wrote note: meeting-notes.md (mode: overwrite)"
}
```

### `list_directory`
List files and directories in the vault.

**Request:**
```json
{
  "name": "list_directory",
  "arguments": {
    "path": "Projects",
    "prettyPrint": false
  }
}
```

**Response (optimized):**
```json
{"dirs":["AI-Tools","Web-Development"],"files":["project-template.md","roadmap.md"]}
```

### `delete_note`
Delete a note from the vault (requires confirmation for safety).

**Request:**
```json
{
  "name": "delete_note",
  "arguments": {
    "path": "old-draft.md",
    "confirmPath": "old-draft.md"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "path": "old-draft.md",
  "message": "Successfully deleted note: old-draft.md. This action cannot be undone."
}
```

**Response (Confirmation Failed):**
```json
{
  "success": false,
  "path": "old-draft.md",
  "message": "Deletion cancelled: confirmation path does not match. For safety, both 'path' and 'confirmPath' must be identical."
}
```

**⚠️ Safety Note:** The `confirmPath` parameter must exactly match the `path` parameter to proceed with deletion. This prevents accidental deletions.

### `get_frontmatter`
Extract only the frontmatter from a note without reading the full content.

**Request:**
```json
{
  "name": "get_frontmatter",
  "arguments": {
    "path": "project-ideas.md",
    "prettyPrint": false
  }
}
```

**Response (optimized, returns frontmatter directly):**
```json
{"title":"Project Ideas","tags":["projects","brainstorming"],"created":"2023-01-15T10:30:00.000Z"}
```

### `manage_tags`
Add, remove, or list tags in a note. Tags are managed in the frontmatter and inline tags are detected.

**Request (List Tags):**
```json
{
  "name": "manage_tags",
  "arguments": {
    "path": "research-notes.md",
    "operation": "list"
  }
}
```

**Request (Add Tags):**
```json
{
  "name": "manage_tags",
  "arguments": {
    "path": "research-notes.md",
    "operation": "add",
    "tags": ["machine-learning", "ai", "important"]
  }
}
```

**Request (Remove Tags):**
```json
{
  "name": "manage_tags",
  "arguments": {
    "path": "research-notes.md",
    "operation": "remove",
    "tags": ["draft", "temporary"]
  }
}
```

**Response:**
```json
{
  "path": "research-notes.md",
  "operation": "add",
  "tags": ["research", "ai", "machine-learning", "important"],
  "success": true,
  "message": "Successfully added tags"
}
```

### `search_notes`
Search for notes in the vault by content or frontmatter.

**Request:**
```json
{
  "name": "search_notes",
  "arguments": {
    "query": "machine learning",
    "limit": 5,
    "searchContent": true,
    "searchFrontmatter": false,
    "caseSensitive": false,
    "prettyPrint": false
  }
}
```

**Response (optimized with minified field names):**
```json
[{"p":"ai-research.md","t":"AI Research Notes","ex":"...machine learning...","mc":2,"ln":15}]
```

**Field names:**
- `p` = path
- `t` = title
- `ex` = excerpt (21 chars context)
- `mc` = match count
- `ln` = line number

### `move_note`
Move or rename a note in the vault.

**Request:**
```json
{
  "name": "move_note",
  "arguments": {
    "oldPath": "drafts/article.md",
    "newPath": "published/article.md",
    "overwrite": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "oldPath": "drafts/article.md",
  "newPath": "published/article.md",
  "message": "Successfully moved note from drafts/article.md to published/article.md"
}
```

### `read_multiple_notes`
Read multiple notes in a batch (maximum 10 files).

**Request:**
```json
{
  "name": "read_multiple_notes",
  "arguments": {
    "paths": ["note1.md", "note2.md", "note3.md"],
    "includeContent": true,
    "includeFrontmatter": true,
    "prettyPrint": false
  }
}
```

**Response (optimized, shortened field names):**
```json
{"ok":[{"path":"note1.md","frontmatter":{"title":"Note 1"},"content":"# Note 1\n\nContent here..."}],"err":[{"path":"note2.md","error":"File not found"}]}
```

**Field names:**
- `ok` = successful reads
- `err` = failed reads

### `update_frontmatter`
Update frontmatter of a note without changing content.

**Request:**
```json
{
  "name": "update_frontmatter",
  "arguments": {
    "path": "research-note.md",
    "frontmatter": {
      "status": "completed",
      "updated": "2025-09-23"
    },
    "merge": true
  }
}
```

**Response:**
```json
{
  "message": "Successfully updated frontmatter for: research-note.md"
}
```

### `get_notes_info`
Get metadata for notes without reading full content.

**Request:**
```json
{
  "name": "get_notes_info",
  "arguments": {
    "paths": ["note1.md", "note2.md"],
    "prettyPrint": false
  }
}
```

**Response (optimized, returns array directly):**
```json
[{"path":"note1.md","size":1024,"modified":1695456000000,"hasFrontmatter":true}]
```

## Security Considerations

This MCP server implements several security measures to protect your Obsidian vault:

### Path Security
- **Path Traversal Protection:** All file paths are validated to prevent access outside the vault
- **Relative Path Enforcement:** Paths are normalized and restricted to the vault directory
- **Symbolic Link Safety:** Resolved paths are checked against vault boundaries

### File Filtering
- **Automatic Exclusions:** `.obsidian`, `.git`, `node_modules`, and system files are filtered
- **Extension Whitelist:** Only `.md`, `.markdown`, and `.txt` files are accessible by default
- **Hidden File Protection:** Dot files and system directories are automatically excluded

### Content Validation
- **YAML Frontmatter Validation:** Frontmatter is parsed and validated before writing
- **Function/Symbol Prevention:** Dangerous JavaScript objects are blocked from frontmatter
- **Data Type Checking:** Only safe data types (strings, numbers, arrays, objects) allowed

### Best Practices
- **Least Privilege:** Server only accesses the specified vault directory
- **Read-Only by Default:** Consider running with read-only permissions for sensitive vaults
- **Backup Recommended:** Always backup your vault before using write operations
- **Network Isolation:** Server uses stdio transport (no network exposure)

### What's NOT Protected
- **File Content:** The server can read/write any allowed file content
- **Vault Structure:** Directory structure is visible to AI assistants
- **File Metadata:** Creation times, file sizes, etc. are accessible

**⚠️ Important:** Only grant vault access to trusted AI conversations. The server provides full read/write access to your notes within the security boundaries above.

## Architecture

- `server.ts` - MCP server entry point
- `src/frontmatter.ts` - YAML frontmatter handling with gray-matter
- `src/filesystem.ts` - Safe file operations with path validation
- `src/pathfilter.ts` - Directory and file filtering
- `src/search.ts` - Note search functionality with content and frontmatter support
- `src/types.ts` - TypeScript type definitions

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

### Building the MCPB Bundle

For developers who want to build the Claude Desktop Extension:

```bash
# Build the TypeScript code and create the .mcpb bundle
npm run build:mcpb

# This will create: mcp-obsidian-X.X.X.mcpb
```

The bundle includes:
- Compiled JavaScript from `dist/`
- Runtime dependencies from `node_modules/`
- `manifest.json` with extension metadata
- `icon.png` for the extension UI

The `.mcpbignore` file controls which files are excluded from the bundle (similar to `.gitignore`).

## License

MIT
