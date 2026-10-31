/**
 * `GET /client/alpine.js` -- the bundled Alpine client script.
 *
 * Mirrors `/styles/*`'s shape (`app.tsx`): a small dedicated route rather
 * than the generic static handler, because this asset isn't a file that
 * already exists on disk -- `buildClientScript()` compiles
 * `src/client/alpine.ts` (TypeScript, ESM, imports `@alpinejs/csp`) to
 * browser JS on first request and caches the result in memory for every
 * request after that.
 */
import type { Hono } from "hono";
import { join } from "node:path";
import { buildClientScript } from "../lib/client-bundle";

const CLIENT_SCRIPT_CACHE_CONTROL = "public, max-age=3600";

export function registerClientRoute(app: Hono, clientDir: string): void {
  app.get("/client/alpine.js", async (c) => {
    const code = await buildClientScript(join(clientDir, "alpine.ts"));
    c.header("content-type", "text/javascript; charset=utf-8");
    c.header("cache-control", CLIENT_SCRIPT_CACHE_CONTROL);
    return c.body(code);
  });
}
