import { expect, test } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const builtServer = join(repoRoot, "dist", "server-http.js");
const apiKey = "http-test-key";

interface RunningServer {
  child: ChildProcessWithoutNullStreams;
  port: number;
  logs: () => string;
}

async function spawnHttpServer(vaultPath: string): Promise<RunningServer> {
  const child = spawn(process.execPath, [builtServer, vaultPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MCPVAULT_API_KEY: apiKey,
      MCPVAULT_PORT: "0",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`HTTP server did not start in time:\n${output}`));
    }, 5000);

    const inspect = () => {
      const match = /listening on http:\/\/localhost:(\d+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    };

    child.stdout.on("data", inspect);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`HTTP server exited early (${code}):\n${output}`));
    });
  });

  return { child, port, logs: () => output };
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs = 5000): Promise<number | null> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("HTTP server did not exit in time")), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function stopServer(server: RunningServer): Promise<number | null> {
  const exit = waitForExit(server.child);
  server.child.kill("SIGTERM");
  return exit;
}

function mcpHeaders(sessionId?: string): Record<string, string> {
  return {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
  };
}

test("HTTP initialize registers the session for the next request", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "mcpvault-http-"));
  const server = await spawnHttpServer(vaultPath);
  const baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const healthBody = await health.json() as Record<string, unknown>;
    expect(healthBody.status).toBe("ok");
    expect(healthBody.version).toEqual(expect.any(String));
    expect(healthBody).not.toHaveProperty("vault");

    const initialize = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: mcpHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "mcpvault-http-test", version: "1.0.0" },
        },
      }),
    });
    expect(initialize.status, await initialize.text()).toBe(200);
    const sessionId = initialize.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const initialized = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: mcpHeaders(sessionId!),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(initialized.status).toBe(202);

    const tools = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: mcpHeaders(sessionId!),
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });
    const toolsBody = await tools.text();
    expect(tools.status, toolsBody).toBe(200);
    expect(toolsBody).toContain("read_note");
    expect(toolsBody).not.toContain("Invalid or missing session");

    expect(await stopServer(server), server.logs()).toBe(0);
  } finally {
    if (server.child.exitCode === null) server.child.kill("SIGKILL");
    await rm(vaultPath, { recursive: true, force: true });
  }
}, 15000);

test("HTTP server exits cleanly on SIGTERM without active sessions", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "mcpvault-http-shutdown-"));
  const server = await spawnHttpServer(vaultPath);

  try {
    expect(await stopServer(server), server.logs()).toBe(0);
  } finally {
    if (server.child.exitCode === null) server.child.kill("SIGKILL");
    await rm(vaultPath, { recursive: true, force: true });
  }
}, 10000);
