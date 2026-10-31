/**
 * Bun entrypoint: serves the Hono app with graceful shutdown.
 */
import app from "./src/app";
import { waitForDrain } from "./src/lib/shutdown";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";
// Bounded wait for in-flight requests to finish before force-closing
// sockets; keep this comfortably under the orchestrator's kill grace
// period (systemd TimeoutStopSec / Podman --stop-timeout / Kubernetes
// terminationGracePeriodSeconds) so a stuck request can never turn a
// restart/redeploy into a hang.
const DRAIN_TIMEOUT_MS = Number(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS ?? 10_000);

let pendingRequests = 0;

const server = Bun.serve({
  port,
  hostname,
  async fetch(req, srv) {
    pendingRequests++;
    try {
      // Test-only hook so the shutdown-drain integration test can hold a
      // request open for a controlled duration without adding a slow route
      // to the real Hono app. Only reachable when NODE_ENV=test, which the
      // Containerfile never sets (ENV NODE_ENV=production) — dead code in
      // every real deployment.
      if (process.env.NODE_ENV === "test") {
        const url = new URL(req.url);
        if (url.pathname === "/__test__/slow") {
          const ms = Number(url.searchParams.get("ms") ?? 0);
          await Bun.sleep(ms);
          return new Response("slow-ok");
        }
      }
      return await app.fetch(req, srv);
    } finally {
      pendingRequests--;
    }
  },
});

console.log(`website-shibumi listening on http://${hostname}:${port}`);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);

  server.stop(); // stop accepting new connections; let in-flight requests finish

  const { drained, polls } = await waitForDrain(() => pendingRequests, DRAIN_TIMEOUT_MS);
  if (!drained) {
    console.warn(
      `drain timeout after ${DRAIN_TIMEOUT_MS}ms with ${pendingRequests} request(s) still in flight; forcing close`,
    );
  } else if (polls > 0) {
    console.log(`drained ${polls} poll(s) after ${signal}`);
  }

  server.stop(true); // force-close any remaining connections/sockets
  console.log("server stopped");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
