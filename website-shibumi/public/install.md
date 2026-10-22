# Install MCPVault

Choose your MCP client and add one local server entry.

## Step 1: Configure your MCP client

### Claude Desktop / ChatGPT+

Add to your MCP configuration file:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["@bitbonsai/mcpvault@latest", "/path/to/your/vault"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add-json obsidian --scope user '{"type":"stdio","command":"npx","args":["@bitbonsai/mcpvault@latest","/path/to/your/vault"]}'
```

**Configuration scopes:**
- `--scope user` - Available across all your projects (recommended)
- `--scope project` - Team-shared via .mcp.json file
- `--scope local` - Current project only (private)

### OpenCode

**Option 1: CLI (interactive)**

```bash
opencode mcp add
```

Select **local**, then enter the command: `npx -y @bitbonsai/mcpvault@latest /path/to/your/vault`

**Option 2: Config file**

Add to your `opencode.json` (project root) or `~/.config/opencode/opencode.json` (global):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["npx", "-y", "@bitbonsai/mcpvault@latest", "/path/to/your/vault"]
    }
  }
}
```

### Gemini CLI

**Option 1: CLI**

```bash
gemini mcp add obsidian -- npx @bitbonsai/mcpvault@latest /path/to/your/vault
```

**Option 2: Config file**

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["@bitbonsai/mcpvault@latest", "/path/to/your/vault"]
    }
  }
}
```

### OpenAI Codex (TOML)

```toml
[mcp_servers.obsidian]
command = "npx"
args = ["-y", "@bitbonsai/mcpvault@latest", "/path/to/your/vault"]
```

### Optional no-path mode (uses current directory)

If your client launches MCPVault from inside your vault folder, you can omit the vault path.

```bash
npx @bitbonsai/mcpvault@latest
```

```json
"args": ["@bitbonsai/mcpvault@latest"]
```

### Optional read-only mode

Add `--read-only` after the vault path to expose only read tools. Mutating tools are omitted from discovery and rejected if called directly.

```json
"args": ["@bitbonsai/mcpvault@latest", "/path/to/your/vault", "--read-only"]
```

The CLI also accepts `--read-only true` and `--read-only=true` for configuration systems that require explicit boolean values. Omit the option, or set it to `false`, for normal read/write access.

### Optional default exclusions

Repeat `--exclude <subtree>` to hide vault-relative folders from search and directory listings in every session. Per-call `excludePaths` add to these defaults. Direct read and write tools remain available for excluded paths.

```json
"args": ["@bitbonsai/mcpvault@latest", "/path/to/your/vault", "--exclude", "Archive", "--exclude", "Snapshots/Old"]
```

MCPVault does not read Obsidian's `.obsidian/app.json`; exclusions stay explicit in the server configuration.

Supported note file types: `.md`, `.markdown`, `.txt`, `.base`, `.canvas`.

<details>
<summary>Config File Locations (optional)</summary>

| Platform | Path |
|----------|------|
| Claude Desktop (macOS) | ~/Library/Application Support/Claude/claude_desktop_config.json |
| Claude Desktop (Windows) | %APPDATA%\Claude\claude_desktop_config.json |
| Claude Code | ~/.claude.json (user scope) |
| ChatGPT+ (macOS) | ~/Library/Application Support/ChatGPT/chatgpt_config.json |
| ChatGPT+ (Windows) | %APPDATA%\ChatGPT\chatgpt_config.json |
| Gemini CLI | ~/.gemini/settings.json |
| OpenCode (per project) | opencode.json |
| OpenCode (global) | ~/.config/opencode/opencode.json |
| OpenAI Codex (macOS/Linux) | ~/.codex/config.toml |
| OpenAI Codex (Windows) | %USERPROFILE%\.codex\config.toml |

</details>

<details>
<summary>Need your vault path? (optional)</summary>

- macOS: In Finder, right-click your vault folder while holding `Option`, then choose `Copy "..." as Pathname`.
- Windows: In File Explorer, hold `Shift`, right-click your vault folder, then choose `Copy as path`.
- Linux: Open a terminal in your vault folder and run `pwd`.

Replace `/path/to/your/vault` with the full absolute path.

</details>

`npx` downloads MCPVault when the client starts the server.

## Step 2: Test with MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
mcp-inspector npx @bitbonsai/mcpvault@latest /path/to/vault
```

MCP Inspector opens a web interface at http://localhost:5173 for testing MCP methods.

## Client support

The examples above cover Claude Desktop, ChatGPT+, Claude Code, OpenCode, Gemini CLI, Cursor, and Windsurf. Other clients can use MCPVault if they support local stdio MCP servers.

## Data flow

- MCPVault reads files from the vault path you configure.
- MCPVault has no hosted service that receives your vault files.
- Path checks keep file tools inside the configured vault.
- Your AI client or provider may receive note content used in requests.
- Your provider's retention and training terms apply to content it receives.

## Verify the connection

Restart your client, then ask it to list MCPVault tools or search for a known note.
