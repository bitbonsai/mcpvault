#!/usr/bin/env node
import { createServer } from "./src/createServer.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
// Get package.json version
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = existsSync(join(scriptDir, "package.json"))
    ? join(scriptDir, "package.json")
    : join(scriptDir, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
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
}
catch {
    console.error(`Error: vault path does not exist: ${vaultPath}`);
    process.exit(1);
}
// Keep both sides of each session so transport closes also release the MCP
// server, and process shutdown can close every active connection cleanly.
const sessions = new Map();
const activeServers = new Set();
function authenticate(req) {
    const key = req.headers["x-api-key"];
    return key === API_KEY;
}
function sendJson(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}
const httpServer = createHttpServer(async (req, res) => {
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
        // Keep this endpoint safe to expose to an unauthenticated health checker.
        // In particular, do not leak the host's absolute vault path.
        sendJson(res, 200, { status: "ok", version: VERSION });
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
    let body = undefined;
    if (req.method === "POST") {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString();
        if (raw) {
            try {
                body = JSON.parse(raw);
            }
            catch {
                sendJson(res, 400, { error: "Invalid JSON body" });
                return;
            }
        }
    }
    // Get or create session
    const sessionId = req.headers["mcp-session-id"];
    let session;
    let isNewSession = false;
    if (sessionId && sessions.has(sessionId)) {
        session = sessions.get(sessionId);
    }
    else if (!sessionId && req.method === "POST" && body && body.method === "initialize") {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
        });
        const mcpServer = createServer(vaultPath, { version: VERSION });
        // The MCP Server owns the transport callbacks after connect(), so attach
        // cleanup to the server rather than overwriting transport.onclose.
        await mcpServer.connect(transport);
        session = { transport, server: mcpServer };
        activeServers.add(mcpServer);
        mcpServer.onclose = () => {
            activeServers.delete(mcpServer);
            if (transport.sessionId) {
                sessions.delete(transport.sessionId);
            }
        };
        isNewSession = true;
    }
    else if (!sessionId && req.method === "POST") {
        sendJson(res, 400, { error: "Missing Mcp-Session-Id header. Send initialize request first." });
        return;
    }
    else {
        sendJson(res, 400, { error: "Invalid or missing session" });
        return;
    }
    // sessionId is assigned while the initialize request is handled, not when
    // the transport connects. Store a new session only after handleRequest.
    try {
        await session.transport.handleRequest(req, res, body);
        if (isNewSession) {
            const createdSessionId = session.transport.sessionId;
            if (!createdSessionId) {
                throw new Error("Initialize completed without a session ID");
            }
            sessions.set(createdSessionId, session);
        }
    }
    catch (error) {
        console.error("Transport error:", error);
        if (isNewSession) {
            await session.server.close().catch(() => { });
        }
        if (!res.headersSent) {
            sendJson(res, 500, { error: "Internal server error" });
        }
    }
});
httpServer.listen(PORT, () => {
    const address = httpServer.address();
    const listeningPort = typeof address === "object" && address ? address.port : PORT;
    console.log(`mcpvault v${VERSION} listening on http://localhost:${listeningPort}`);
    console.log(`Vault: ${vaultPath}`);
    console.log(`MCP endpoint: http://localhost:${listeningPort}/mcp`);
    console.log(`Health check: http://localhost:${listeningPort}/health`);
    console.log(`Auth: X-API-Key header required`);
});
let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);
    // Stop accepting requests first. Active SSE connections finish when their
    // MCP servers close below, allowing httpServer.close() to complete.
    const httpClosed = new Promise((resolveClose, rejectClose) => {
        httpServer.close((error) => error ? rejectClose(error) : resolveClose());
    });
    const serverResults = await Promise.allSettled([...activeServers].map((server) => server.close()));
    const httpResult = await Promise.allSettled([httpClosed]);
    const failed = serverResults.some((result) => result.status === "rejected")
        || httpResult[0]?.status === "rejected";
    sessions.clear();
    activeServers.clear();
    process.exit(failed ? 1 : 0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
