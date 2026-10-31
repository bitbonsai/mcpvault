import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { buildRobotsTxt, buildSitemapXml, SITE_ROUTES } from "../../src/routes/seo";

const app = createApp({ siteUrl: "https://example.test" });

describe("GET /sitemap.xml", () => {
  test("returns 200 application/xml with every route", async () => {
    const res = await app.request("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    const body = await res.text();
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    for (const route of SITE_ROUTES) {
      expect(body).toContain(`<loc>https://example.test${route}</loc>`);
    }
  });

  test("matches the pure builder function (no drift between routes and content)", async () => {
    const res = await app.request("/sitemap.xml");
    const body = await res.text();
    expect(body).toBe(buildSitemapXml("https://example.test", SITE_ROUTES));
  });

  test("unsupported method is not treated as a page route", async () => {
    const res = await app.request("/sitemap.xml", { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("GET /robots.txt", () => {
  test("returns 200 text/plain and references the sitemap it actually serves", async () => {
    const res = await app.request("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
    expect(body).toContain("Sitemap: https://example.test/sitemap.xml");
    expect(body).toContain("Crawl-delay: 1");
    // Shell-review carry-over: the first port silently dropped this comment.
    expect(body).toContain("# LLM-specific crawlers");
  });

  test("matches the pure builder function", async () => {
    const res = await app.request("/robots.txt");
    expect(await res.text()).toBe(buildRobotsTxt("https://example.test"));
  });
});

describe("GET /sitemap-0.xml", () => {
  test("301s to /sitemap.xml instead of reproducing production's broken 200 (headers-baseline finding)", async () => {
    const res = await app.request("/sitemap-0.xml", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/sitemap.xml");
  });
});

describe("robots.txt byte parity with website/public/robots.txt", () => {
  test("is byte-identical to the production static file for the production siteUrl", async () => {
    const res = await createApp().request("/robots.txt");
    const body = await res.text();
    // Two crawler groups under two different comments, and no trailing
    // newline -- copied verbatim from `website/public/robots.txt` rather
    // than re-derived, per the Phase 2 review.
    expect(body).toBe(
      "User-agent: *\nAllow: /\n\n# Sitemaps\nSitemap: https://mcpvault.org/sitemap.xml\n\n# AI crawlers\n" +
        "User-agent: GPTBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: CCBot\nAllow: /\n\n" +
        "User-agent: Claude-Web\nAllow: /\n\nUser-agent: anthropic-ai\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\n" +
        "# LLM-specific crawlers\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: YouBot\nAllow: /\n\n" +
        "User-agent: FacebookBot\nAllow: /\n\n# Crawl delay for all bots\nCrawl-delay: 1",
    );
  });
});

describe("default siteUrl", () => {
  test("createApp() with no options points the sitemap at production", async () => {
    const res = await createApp().request("/sitemap.xml");
    const body = await res.text();
    expect(body).toContain("<loc>https://mcpvault.org/</loc>");
  });
});
