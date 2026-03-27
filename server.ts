#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./src/createServer.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let VERSION = "1.0.0";
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "package.json"), "utf-8")
  );
  VERSION = packageJson.version;
} catch {
  // Fallback if package.json not found (e.g. running from dist/)
  try {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, "../package.json"), "utf-8")
    );
    VERSION = packageJson.version;
  } catch { /* use default */ }
}

// Parse CLI args
const cliArgs = process.argv.slice(2);

const flags = new Set<string>();
const positionalArgs: string[] = [];

for (const arg of cliArgs) {
  if (arg.startsWith('--') || arg.startsWith('-')) {
    flags.add(arg);
  } else {
    positionalArgs.push(arg);
  }
}

if (flags.has("--version") || flags.has("-v")) {
  console.log(VERSION);
  process.exit(0);
}

if (flags.has("--help") || flags.has("-h")) {
  console.log(`
obsidian-vault-mcp v${VERSION}

Safe, link-aware MCP server for Obsidian vaults.
Full wiki-link and backlink support. All destructive operations
use soft-delete — originals are moved to _trash/, never permanently removed.

Usage:
  npx obsidian-vault-mcp [vault-path]

Arguments:
  [vault-path]    Path to your Obsidian vault directory
                  Defaults to current working directory

Options:
  --version, -v   Show version number
  --help, -h      Show this help message

Safety:
  - delete_note moves files to _trash/ (soft delete, always recoverable)
  - write_note in overwrite mode auto-backs up the original to _trash/
  - append and prepend modes never replace existing content
  - _trash/ folder can be cleaned up manually whenever you like

Examples:
  npx obsidian-vault-mcp ~/Documents/MyVault
  npx obsidian-vault-mcp ./Vault
  npx obsidian-vault-mcp "/path/with spaces/Obsidian Vault"
`);
  process.exit(0);
}

// Join positional args to support vault paths with spaces
const vaultPathArg = positionalArgs.join(' ').trim();
const vaultPath = resolve(vaultPathArg || process.cwd());

// Create server and build index
const { server, index } = createServer(vaultPath, { version: VERSION });

// Build vault index before accepting connections
const indexStart = Date.now();
await index.build();
const indexTime = Date.now() - indexStart;
process.stderr.write(`[obsidian-vault-mcp] Indexed ${index.noteCount} notes with ${index.linkCount} links in ${indexTime}ms\n`);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
