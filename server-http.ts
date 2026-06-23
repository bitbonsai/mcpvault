#!/usr/bin/env node

import { createServer } from "./src/createServer.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";

// Get package.json version
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(scriptDir, "package.json"), "utf-8")
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
mcpvault (HTTP mode) v${VERSION}

Universal AI bridge for Obsidian vaults over Streamable HTTP

Usage:
  npx @bitbonsai/mcpvault-http [vault-path]

Arguments:
  [vault-path]    Optional path to your Obsidian vault directory
                  Defaults to MCPVAULT_VAULT_PATH env var or cwd

Environment variables:
  MCPVAULT_API_KEY    Required. API key for authentication (sent as X-API-Key header)
  MCPVAULT_PORT       Port to listen on (default: 3000)
  MCPVAULT_VAULT_PATH Default vault path if no CLI argument provided

Options:
  --version, -v   Show version number
  --help, -h      Show this help message

Examples:
  MCPVAULT_API_KEY=mysecret npx @bitbonsai/mcpvault-http ~/vault
  MCPVAULT_API_KEY=mysecret MCPVAULT_PORT=8080 npx @bitbonsai/mcpvault-http

Docker:
  docker run -e MCPVAULT_API_KEY=mysecret -v /path/to/vault:/vault -p 3000:3000 \\
    bitbonsai/mcpvault-http /vault
`);
  process.exit(0);
}

// Config from env
const API_KEY = process.env.MCPVAULT_API_KEY;
if (!API_KEY) {
  console.error("Error: MCPVAULT_API_KEY environment variable is required.");
  console.error("Set it to a secret value clients will send as X-API-Key header.");
  process.exit(1);
}

const PORT = parseInt(process.env.MCPVAULT_PORT || "3000", 10);
const vaultPathArg = cliArgs.join(' ').trim();
const vaultPath = resolve(vaultPathArg || process.env.MCPVAULT_VAULT_PATH || process.cwd());

// Validate vault path
try {
  const stats = (await import("fs/promises")).stat(vaultPath);
  if (!(await stats).isDirectory()) {
    console.error(`Error: vault path is not a directory: ${vaultPath}`);
    process.exit(1);
  }
} catch {
  console.error(`Error: vault path does not exist: ${vaultPath}`);
  process.exit(1);
}

// Track active sessions for cleanup
const sessions = new Map<string, StreamableHTTPServerTransport>();

function authenticate(req: IncomingMessage): boolean {
  const key = req.headers["x-api-key"];
  return key === API_KEY;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Mcp-Session-Id",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  // CORS headers on all responses
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Health check
  if (req.url === "/health") {
    sendJson(res, 200, { status: "ok", version: VERSION, vault: vaultPath });
    return;
  }

  // Auth check
  if (!authenticate(req)) {
    sendJson(res, 401, { error: "Unauthorized. Provide X-API-Key header." });
    return;
  }

  // Only /mcp endpoint is supported
  if (!req.url?.startsWith("/mcp")) {
    sendJson(res, 404, { error: "Not found. Use /mcp for MCP requests, /health for health check." });
    return;
  }

  // Collect request body for POST
  let body: unknown = undefined;
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return;
      }
    }
  }

  // Get or create session
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && sessions.has(sessionId)) {
    transport = sessions.get(sessionId)!;
  } else if (req.method === "POST" && body && (body as any).method === "initialize") {
    // New session
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const mcpServer = createServer(vaultPath, { version: VERSION });
    // Cast needed: exactOptionalPropertyTypes doesn't allow assigning
    // (() => void) | undefined to () => void, but the SDK handles it.
    await mcpServer.connect(transport as any);
    sessions.set(transport.sessionId!, transport);

    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };
  } else if (!sessionId && req.method === "POST") {
    sendJson(res, 400, { error: "Missing Mcp-Session-Id header. Send initialize request first." });
    return;
  } else {
    sendJson(res, 400, { error: "Invalid or missing session" });
    return;
  }

  // Delegate to transport
  try {
    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error("Transport error:", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" });
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`mcpvault v${VERSION} listening on http://localhost:${PORT}`);
  console.log(`Vault: ${vaultPath}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Auth: X-API-Key header required`);
});
