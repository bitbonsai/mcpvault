import { test, expect } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Issue #159: the stdio server never exited when its transport closed
// (client disconnect, host with no MCP lifecycle controls), leaving
// orphaned processes behind. These tests spawn the real entry point and
// verify it exits promptly on stdin EOF and on termination signals.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
// Exercise the actual published entry point (dist/server.js), which is what
// real MCP hosts spawn. Requires `npm run build` to have run first.
const builtServer = join(repoRoot, "dist", "server.js");

async function spawnServer(vaultPath: string): Promise<ChildProcessWithoutNullStreams> {
  return spawn(process.execPath, [builtServer, vaultPath], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`process did not exit within ${timeoutMs}ms`));
    }, timeoutMs);

    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

test("stdio server exits when the client closes stdin (EOF)", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "mcpvault-shutdown-"));
  const child = await spawnServer(vaultPath);

  try {
    const exitPromise = waitForExit(child, 4000);
    // Give the server a moment to finish booting before simulating the
    // client disconnecting.
    await new Promise((resolve) => setTimeout(resolve, 500));
    child.stdin.end();

    const exitCode = await exitPromise;
    expect(exitCode).toBe(0);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    await rm(vaultPath, { recursive: true }).catch(() => {});
  }
}, 10000);

test("stdio server exits on SIGTERM", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "mcpvault-shutdown-"));
  const child = await spawnServer(vaultPath);

  try {
    const exitPromise = waitForExit(child, 4000);
    await new Promise((resolve) => setTimeout(resolve, 500));
    child.kill("SIGTERM");

    const exitCode = await exitPromise;
    expect(exitCode).toBe(0);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    await rm(vaultPath, { recursive: true }).catch(() => {});
  }
}, 10000);
