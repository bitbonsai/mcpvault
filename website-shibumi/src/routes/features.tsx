/**
 * `GET /features/` -- the Features page.
 *
 * Registered at the trailing-slash form to match `SITE_ROUTES`
 * (routes/seo.ts) and PRs #187/#188's redirect convention; the
 * non-trailing-slash -> trailing-slash redirect middleware itself is
 * Phase 4 scope (it must cover every route, not just this one).
 *
 * Content negotiation matches the Home route: `Accept: text/markdown`
 * (without `text/html`) serves `public/features.md` verbatim.
 */
import type { Hono } from "hono";
import { join } from "node:path";
import { prefersMarkdown } from "../lib/content-negotiation";
import { packageVersion } from "../lib/version";
import { FeaturesPage } from "../pages/Features";

const CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function registerFeaturesRoute(app: Hono, publicDir: string): void {
  app.get("/features/", async (c) => {
    if (prefersMarkdown(c.req.header("accept"))) {
      const file = Bun.file(join(publicDir, "features.md"));
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

    return c.html(<FeaturesPage currentPath={c.req.path} version={packageVersion} />, 200, {
      "cache-control": CACHE_CONTROL,
    });
  });
}
