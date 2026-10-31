/**
 * `fetchImpl` is injected so these tests never touch the real npm registry
 * (same pattern as `test/client/newsletter.test.ts`'s fake `fetch`).
 */
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { formatCount, NPM_PACKAGES, registerDownloadsRoute } from "../../src/routes/downloads";

const CACHE_CONTROL = "public, s-maxage=900, max-age=900";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Resolves per package name based on whether the request URL contains `mcp-obsidian` (the old package) or not (the new `@bitbonsai/mcpvault`). */
function fetchByPackage(counts: { old: number; scoped: number }): typeof fetch {
  return (async (url: string | URL) => {
    const href = String(url);
    return href.includes("mcp-obsidian")
      ? jsonResponse({ downloads: counts.old })
      : jsonResponse({ downloads: counts.scoped });
  }) as unknown as typeof fetch;
}

describe("formatCount", () => {
  test("small counts render as-is", () => expect(formatCount(0)).toBe("0"));
  test("under 1000 renders as-is", () => expect(formatCount(999)).toBe("999"));
  test("thousands render with a k suffix", () => expect(formatCount(1500)).toBe("1.5k"));
  test("whole thousands drop the trailing .0", () => expect(formatCount(2000)).toBe("2k"));
  test("millions render with an M suffix", () => expect(formatCount(2_500_000)).toBe("2.5M"));
  test("whole millions drop the trailing .0", () => expect(formatCount(3_000_000)).toBe("3M"));
});

describe("GET /api/downloads.json", () => {
  test("success: sums totals across both npm package names", async () => {
    const app = new Hono();
    registerDownloadsRoute(app, { fetchImpl: fetchByPackage({ old: 100, scoped: 400 }) });

    const res = await app.request("/api/downloads.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(await res.json()).toEqual({ schemaVersion: 1, label: "downloads", message: "500" });
  });

  test("timeout: an upstream that never resolves is aborted, not hung", async () => {
    const hangingFetch = (async (_url: string, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;

    const app = new Hono();
    registerDownloadsRoute(app, { fetchImpl: hangingFetch, timeoutMs: 20 });

    const startedAt = performance.now();
    const res = await app.request("/api/downloads.json");
    const elapsedMs = performance.now() - startedAt;

    // Bounded by the explicit 20ms upstream timeout, not left to hang on a
    // default/absent timeout (this assertion would fail if the abort wiring
    // were removed and the promise above just hung forever).
    expect(elapsedMs).toBeLessThan(500);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    // No cache yet on a cold start with every upstream timing out: controlled error, not a hang or a 5xx.
    expect(await res.json()).toEqual({ schemaVersion: 1, label: "downloads", message: "N/A", isError: true });
  });

  test("partial upstream failure: a failing package contributes 0, the other still counts", async () => {
    const partialFetch = (async (url: string | URL) => {
      const href = String(url);
      if (href.includes("mcp-obsidian")) return jsonResponse({ downloads: 250 });
      return new Response("Internal Server Error", { status: 500 });
    }) as unknown as typeof fetch;

    const app = new Hono();
    registerDownloadsRoute(app, { fetchImpl: partialFetch });

    const res = await app.request("/api/downloads.json");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ schemaVersion: 1, label: "downloads", message: "250" });
  });

  test("total upstream failure with no prior cache returns a controlled error, never a 5xx", async () => {
    const failingFetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const app = new Hono();
    registerDownloadsRoute(app, { fetchImpl: failingFetch });

    const res = await app.request("/api/downloads.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(await res.json()).toEqual({ schemaVersion: 1, label: "downloads", message: "N/A", isError: true });
  });

  test("cache hit: a second request within the TTL never re-hits npm", async () => {
    let calls = 0;
    const countingFetch = (async () => {
      calls++;
      return jsonResponse({ downloads: 10 });
    }) as unknown as typeof fetch;

    const app = new Hono();
    registerDownloadsRoute(app, { fetchImpl: countingFetch }); // default cacheTtlMs

    const first = await app.request("/api/downloads.json");
    const firstBody = await first.json();
    expect(calls).toBe(NPM_PACKAGES.length);

    const second = await app.request("/api/downloads.json");
    const secondBody = await second.json();
    expect(calls).toBe(NPM_PACKAGES.length); // unchanged: served from cache, no new upstream calls
    expect(secondBody).toEqual(firstBody);
    expect(second.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
  });

  test("stale fallback: a refresh where every upstream fails serves the last known total", async () => {
    let mode: "ok" | "fail" = "ok";
    const flakyFetch = (async () => {
      if (mode === "fail") throw new Error("network down");
      return jsonResponse({ downloads: 300 });
    }) as unknown as typeof fetch;

    const app = new Hono();
    // cacheTtlMs < 0: the cached value is never fresh enough for a fast-path
    // hit, so every request re-attempts an upstream fetch, exercising the
    // fallback-to-last-known-value path on every subsequent call.
    registerDownloadsRoute(app, { fetchImpl: flakyFetch, cacheTtlMs: -1 });

    const first = await app.request("/api/downloads.json");
    const firstBody = (await first.json()) as { message: string };
    expect(firstBody.message).toBe(formatCount(600));

    mode = "fail";
    const second = await app.request("/api/downloads.json");
    const secondBody = (await second.json()) as { message: string; isError?: boolean };

    expect(second.status).toBe(200);
    expect(secondBody.message).toBe(firstBody.message); // stale, but not "N/A"
    expect(secondBody.isError).toBeUndefined();
    expect(second.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
  });
});
