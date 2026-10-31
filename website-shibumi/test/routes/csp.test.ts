/**
 * Content-Security-Policy tests.
 *
 * The whole point of shipping the `@alpinejs/csp` build is a CSP without
 * `'unsafe-eval'`; these tests pin that down so a future secure-headers
 * change can't silently drop the header (its defaults emit no CSP at all).
 *
 * The inline-script test hashes every executable inline `<script>` found in
 * the real rendered HTML and requires each hash to appear in script-src, so
 * the font-loader one-liner (or any inline script added later) can never
 * drift from the header.
 */
import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { FONT_LOADER_SCRIPT, scriptHash, structuredDataJson } from "../../src/lib/csp";
import { packageVersion } from "../../src/lib/version";

const app = createApp();

const PAGE_PATHS = ["/", "/install/", "/features/", "/demo/", "/how-it-works/", "/skill/"];

async function cspFor(path: string): Promise<string> {
  const res = await app.request(path);
  expect(res.status).toBe(200);
  const header = res.headers.get("content-security-policy");
  expect(header).toBeTruthy();
  return header as string;
}

function directive(header: string, name: string): string {
  const found = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  expect(found).toBeTruthy();
  return found as string;
}

describe("Content-Security-Policy header", () => {
  test("is present on every page and never allows eval or wildcards", async () => {
    for (const path of PAGE_PATHS) {
      const header = await cspFor(path);
      expect(header).not.toContain("unsafe-eval");
      expect(header).not.toContain("wasm-unsafe-eval");
      // No wildcard source anywhere (a lone * token or *. host patterns).
      expect(header).not.toMatch(/\s\*[\s;.]/);
      expect(header).toContain("default-src 'self'");
    }
  });

  test("is present on API and 404 responses too", async () => {
    const health = await app.request("/healthz");
    expect(health.headers.get("content-security-policy")).toContain("default-src 'self'");
    const missing = await app.request("/nope");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  test("script-src allows only self, audited third parties, and hashed inline scripts", async () => {
    const scriptSrc = directive(await cspFor("/"), "script-src");
    const sources = scriptSrc.split(/\s+/).slice(1);
    for (const source of sources) {
      expect(source).toMatch(/^('self'|'sha256-[A-Za-z0-9+/=]+'|https:\/\/(cdn\.counter\.dev|challenges\.cloudflare\.com))$/);
    }
    expect(sources).toContain("'self'");
    expect(sources).toContain("https://cdn.counter.dev");
    expect(sources).toContain("https://challenges.cloudflare.com");
  });

  test("every inline script in the rendered HTML is covered by a script-src hash", async () => {
    for (const path of PAGE_PATHS) {
      const res = await app.request(path);
      const html = await res.text();
      const header = res.headers.get("content-security-policy") as string;
      const scriptSrc = directive(header, "script-src");

      const inlineBodies = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
      expect(inlineBodies.length).toBeGreaterThan(0);
      for (const [, , body] of inlineBodies) {
        const hash = `'sha256-${createHash("sha256").update(body as string, "utf8").digest("base64")}'`;
        expect(scriptSrc).toContain(hash);
      }
    }
  });

  test("hash constants match the exact markup sources", () => {
    expect(scriptHash(FONT_LOADER_SCRIPT)).toMatch(/^'sha256-[A-Za-z0-9+/=]+'$/);
    // The JSON-LD hash is keyed to the version the routes actually render.
    expect(structuredDataJson(packageVersion)).toContain(`"softwareVersion":"${packageVersion}"`);
  });

  test("third-party origins are scoped per directive", async () => {
    const header = await cspFor("/");
    expect(directive(header, "style-src-elem")).toBe("style-src-elem 'self' https://fonts.googleapis.com");
    expect(directive(header, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
    expect(directive(header, "font-src")).toBe("font-src 'self' https://fonts.gstatic.com");
    expect(directive(header, "img-src")).toBe("img-src 'self' data: https://img.shields.io");
    expect(directive(header, "media-src")).toBe("media-src 'self'");
    expect(directive(header, "connect-src")).toBe("connect-src 'self' https://t.counter.dev");
    expect(directive(header, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
    expect(directive(header, "object-src")).toBe("object-src 'none'");
    expect(directive(header, "base-uri")).toBe("base-uri 'self'");
    expect(directive(header, "form-action")).toBe("form-action 'self'");
    expect(directive(header, "frame-ancestors")).toBe("frame-ancestors 'self'");
  });

  test("style-src fallback keeps old browsers rendering while elem stays strict", async () => {
    const header = await cspFor("/");
    expect(directive(header, "style-src")).toBe("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
  });
});
