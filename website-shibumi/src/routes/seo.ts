/**
 * Explicit `/sitemap.xml` and `/robots.txt` routes.
 *
 * Astro's `@astrojs/sitemap` integration is gone in the Shibumi app, and
 * the Phase 0 production baseline (`test/baseline/headers-baseline.json`)
 * recorded that `sitemap.xml`/`sitemap-0.xml` were already broken on
 * mcpvault.org -- both returned an HTML SPA-fallback page (200 text/html)
 * instead of XML, even though `robots.txt` advertises
 * `Sitemap: https://mcpvault.org/sitemap.xml`. These must be built, not
 * assumed to carry over, per the migration plan (Phase 2, group 1).
 *
 * Both routes are generated from one canonical route list so they can
 * never drift from each other.
 */
import type { Hono } from "hono";

export const SITE_URL = "https://mcpvault.org";

/** Every public page route, trailing-slash form (matches PRs #187/#188). */
export const SITE_ROUTES: readonly string[] = ["/", "/install/", "/features/", "/demo/", "/how-it-works/", "/skill/", "/benchmarks/"];

const XML_CACHE_CONTROL = "public, max-age=3600";
const ROBOTS_CACHE_CONTROL = "public, max-age=14400, must-revalidate";

export function buildSitemapXml(baseUrl: string, routes: readonly string[]): string {
  const urls = routes.map((route) => `  <url><loc>${baseUrl}${route}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Two groups, two different comments and no trailing newline -- this must
// stay byte-identical to the production `website/public/robots.txt` file
// (confirmed against Phase 2 review), not just semantically equivalent.
const AI_CRAWLER_GROUP = ["GPTBot", "Google-Extended", "CCBot", "Claude-Web", "anthropic-ai", "ChatGPT-User"];
const LLM_CRAWLER_GROUP = ["PerplexityBot", "YouBot", "FacebookBot"];

export function buildRobotsTxt(baseUrl: string): string {
  const aiRules = AI_CRAWLER_GROUP.map((agent) => `User-agent: ${agent}\nAllow: /`).join("\n\n");
  const llmRules = LLM_CRAWLER_GROUP.map((agent) => `User-agent: ${agent}\nAllow: /`).join("\n\n");
  return `User-agent: *\nAllow: /\n\n# Sitemaps\nSitemap: ${baseUrl}/sitemap.xml\n\n# AI crawlers\n${aiRules}\n\n# LLM-specific crawlers\n${llmRules}\n\n# Crawl delay for all bots\nCrawl-delay: 1`;
}

export function registerSeoRoutes(app: Hono, baseUrl: string = SITE_URL): void {
  app.get("/sitemap.xml", (c) =>
    c.text(buildSitemapXml(baseUrl, SITE_ROUTES), 200, {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": XML_CACHE_CONTROL,
    }),
  );

  app.get("/robots.txt", (c) =>
    c.text(buildRobotsTxt(baseUrl), 200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": ROBOTS_CACHE_CONTROL,
    }),
  );

  // Production served /sitemap-0.xml too (the same broken 200 text/html SPA
  // fallback as /sitemap.xml -- see the headers baseline finding). Since
  // /sitemap.xml now serves real XML (an approved migration deviation, see
  // the plan), the -0 alias 301s to it rather than duplicating the sitemap
  // body under a second URL; recorded as a further deviation in the plan.
  app.get("/sitemap-0.xml", (c) => c.redirect("/sitemap.xml", 301));
}
