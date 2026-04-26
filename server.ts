#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./src/createServer.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8")
);
const VERSION = packageJson.version;

// Handle --version and --help flags
const cliArgs = process.argv.slice(2);
const firstArg = cliArgs[0];

if (firstArg === "--version" || firstArg === "-v") {
  console.log(VERSION);
  process.exit(0);
}

if (firstArg === "--help" || firstArg === "-h") {
  console.log(`
mcpvault v${VERSION}

Universal AI bridge for Obsidian vaults - connect any MCP-compatible assistant

Usage:
  npx @bitbonsai/mcpvault [vault-path] [--read-only]

Arguments:
  [vault-path]    Optional path to your Obsidian vault directory
                  Defaults to current working directory when omitted

Options:
  --version, -v   Show version number
  --help, -h      Show this help message
  --read-only     Disable all mutating tools (write_note, patch_note,
                  delete_note, move_note, move_file, update_frontmatter,
                  manage_tags). Read tools remain available.

Examples:
  npx @bitbonsai/mcpvault
  npx @bitbonsai/mcpvault ~/Documents/MyVault
  npx @bitbonsai/mcpvault ./Vault --read-only
  npx @bitbonsai/mcpvault /path/to/obsidian/vault
  npx @bitbonsai/mcpvault "/path/with spaces/Obsidian Vault"
`);
  process.exit(0);
}

// Extract --read-only flag (can appear at any position) and remove it from
// the path-arg list so it doesn't get joined into the vault-path string.
const readOnly = cliArgs.includes("--read-only");
const pathArgs = cliArgs.filter((a) => a !== "--read-only");

// Join trailing args to support vault paths with spaces.
// When omitted, default to current working directory.
const vaultPathArg = pathArgs.join(' ').trim();
const vaultPath = resolve(vaultPathArg || process.cwd());

const server = createServer(vaultPath, { version: VERSION, readOnly });
const transport = new StdioServerTransport();
await server.connect(transport);
