/**
 * `GET /benchmarks/` -- the MCP v2 benchmarks page.
 *
 * Shape mirrors routes/features.tsx: trailing-slash form to match
 * `SITE_ROUTES` (routes/seo.ts), and `Accept: text/markdown` (without
 * `text/html`) serves `public/benchmarks.md` verbatim.
 */
import type { Hono } from "hono";
import { join } from "node:path";
import { prefersMarkdown } from "../lib/content-negotiation";
import { packageVersion } from "../lib/version";
import { BenchmarksPage } from "../pages/Benchmarks";

const CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function registerBenchmarksRoute(app: Hono, publicDir: string): void {
  app.get("/benchmarks/", async (c) => {
    if (prefersMarkdown(c.req.header("accept"))) {
      const file = Bun.file(join(publicDir, "benchmarks.md"));
      if (await file.exists()) {
        return new Response(file, {
          status: 200,
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "cache-control": CACHE_CONTROL,
          },
        });
      }
    }

    return c.html(<BenchmarksPage currentPath={c.req.path} version={packageVersion} />, 200, {
      "cache-control": CACHE_CONTROL,
    });
  });
}
