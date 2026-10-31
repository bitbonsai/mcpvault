/**
 * Black-box test of the real `server.ts` entrypoint's SIGTERM handling:
 * spawns the actual Bun process (not `createApp()` in-process) so the
 * drain-then-force-close wiring in `server.ts` itself — not just the pure
 * `waitForDrain` helper — is exercised end to end.
 */
import { afterEach, describe, expect, test } from "bun:test";

const SERVER_ENTRY = new URL("../../server.ts", import.meta.url).pathname;

let child: ReturnType<typeof Bun.spawn> | undefined;

afterEach(() => {
  if (child && !child.killed) child.kill("SIGKILL");
  child = undefined;
});

async function waitForListening(proc: ReturnType<typeof Bun.spawn>, port: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.status === 200) return;
    } catch {
      // Not listening yet; retry.
    }
    await Bun.sleep(25);
  }
  throw new Error(`server on port ${port} never became healthy`);
}

function spawnServer(port: number, drainTimeoutMs: number): ReturnType<typeof Bun.spawn> {
  return Bun.spawn(["bun", SERVER_ENTRY], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      SHUTDOWN_DRAIN_TIMEOUT_MS: String(drainTimeoutMs),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function readAllText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text();
}

describe("SIGTERM shutdown drain", () => {
  test("waits for a fast in-flight request to finish, then exits 0", async () => {
    const port = 34_501;
    child = spawnServer(port, 5_000);
    await waitForListening(child, port);

    const slowRequest = fetch(`http://127.0.0.1:${port}/__test__/slow?ms=200`);

    // Give the request a moment to actually be in flight before signaling.
    await Bun.sleep(50);
    child.kill("SIGTERM");

    const res = await slowRequest;
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("slow-ok");

    const exitCode = await child.exited;
    expect(exitCode).toBe(0);

    const stderr = await readAllText(child.stderr as ReadableStream<Uint8Array>);
    expect(stderr).not.toContain("forcing close");
  }, 10_000);

  test("force-closes and still exits 0 once the drain timeout is exceeded", async () => {
    const port = 34_502;
    child = spawnServer(port, 150); // shorter than the slow request below
    await waitForListening(child, port);

    const slowRequest = fetch(`http://127.0.0.1:${port}/__test__/slow?ms=5000`).catch(() => undefined);

    await Bun.sleep(50);
    const killedAt = Date.now();
    child.kill("SIGTERM");

    const exitCode = await child.exited;
    const elapsed = Date.now() - killedAt;

    expect(exitCode).toBe(0);
    // Must exit close to the drain timeout, not wait out the 5s slow request.
    expect(elapsed).toBeLessThan(2_000);

    const stderr = await readAllText(child.stderr as ReadableStream<Uint8Array>);
    expect(stderr).toContain("forcing close");

    await slowRequest;
  }, 10_000);
});
