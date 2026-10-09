/**
 * `GET /` -- the Home page.
 *
 * Content negotiation: `Accept: text/markdown` (without `text/html`) serves
 * `public/index.md` verbatim instead of the rendered page, per the plan's
 * Markdown-representation rule. Browsers get the Hono JSX page.
 */
import type { Hono } from "hono";
import { join } from "node:path";
import { prefersMarkdown } from "../lib/content-negotiation";
import { packageVersion } from "../lib/version";
import { HomePage } from "../pages/Home";

const CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function registerHomeRoute(app: Hono, publicDir: string, turnstileSiteKey = ""): void {
  app.get("/", async (c) => {
    if (prefersMarkdown(c.req.header("accept"))) {
      const file = Bun.file(join(publicDir, "index.md"));
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

    return c.html(<HomePage currentPath={c.req.path} version={packageVersion} turnstileSiteKey={turnstileSiteKey} />, 200, {
      "cache-control": CACHE_CONTROL,
    });
  });
}
