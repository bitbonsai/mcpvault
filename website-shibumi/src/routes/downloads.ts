/**
 * `GET /api/downloads.json` -- Shields.io "endpoint" badge JSON.
 *
 * Ported from `website/src/pages/api/downloads.json.ts`. Sums lifetime npm
 * downloads across both names MCPVault has published under (the old
 * unscoped-author package and the current `@bitbonsai` scope) and renders
 * the Shields `schemaVersion: 1` endpoint payload the Hero badge and
 * footer npm badge both fetch.
 *
 * Adds, per the migration plan (`GET /api/downloads.json` parity section):
 * - an explicit per-upstream-request timeout (`AbortController`), so a
 *   slow or hanging npm registry response never hangs the badge request;
 * - a bounded, single-entry in-memory cache so repeat badge fetches within
 *   `cacheTtlMs` don't re-hit the npm registry on every request;
 * - a last-known-value fallback: if every upstream fetch fails on a cache
 *   refresh, serve the last successful total (even if stale) instead of a
 *   misleading zero; only emit a controlled `isError` payload once nothing
 *   has ever succeeded.
 * - the same `Cache-Control` header on every response shape, per "preserve
 *   the current cache headers" in the migration plan.
 */
import type { Hono } from "hono";

/** Both npm names MCPVault's package has been published under. */
export const NPM_PACKAGES: readonly string[] = ["@mauricio.wolff/mcp-obsidian", "@bitbonsai/mcpvault"];

const DEFAULT_TIMEOUT_MS = 5_000;
// Mirrors the Cache-Control freshness window below: refetch npm at most every 15 minutes.
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

// Unchanged from the Astro route: shields.io respects s-maxage; 15 minutes is a reasonable refresh interval.
const CACHE_CONTROL = "public, s-maxage=900, max-age=900";

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export interface DownloadsRouteOptions {
  /** Injectable so tests never touch the real npm registry (same pattern as `newsletter.ts`'s `fetchImpl`). */
  fetchImpl?: typeof fetch;
  /** Per-upstream-request timeout in ms; aborts a hanging npm registry response. */
  timeoutMs?: number;
  /** How long a successful total is served from cache before the next refetch. */
  cacheTtlMs?: number;
  /** Package names to sum; defaults to `NPM_PACKAGES`. */
  packages?: readonly string[];
}

interface CachedTotal {
  total: number;
  cachedAt: number;
}

/**
 * One package's all-time npm download count, or `null` on any failure
 * (non-OK status, network error, malformed body, or timeout). Never throws,
 * so a single bad package never takes down the aggregate response.
 */
async function fetchPackageDownloads(
  fetchImpl: typeof fetch,
  pkg: string,
  range: string,
  timeoutMs: number,
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://api.npmjs.org/downloads/point/${range}/${encodeURIComponent(pkg)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { downloads?: number } | null;
    return data ? data.downloads ?? 0 : null;
  } catch {
    return null; // network error, or AbortError from the timeout above
  } finally {
    clearTimeout(timer);
  }
}

function shieldsPayload(message: string, extra?: Record<string, unknown>) {
  return { schemaVersion: 1, label: "downloads", message, ...extra };
}

export function registerDownloadsRoute(app: Hono, options: DownloadsRouteOptions = {}): void {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const packages = options.packages ?? NPM_PACKAGES;

  // Bounded: exactly one entry, the last successful aggregate total -- never a growing map.
  let cache: CachedTotal | null = null;

  app.get("/api/downloads.json", async (c) => {
    const now = Date.now();

    if (cache && now - cache.cachedAt < cacheTtlMs) {
      return c.json(shieldsPayload(formatCount(cache.total)), 200, { "Cache-Control": CACHE_CONTROL });
    }

    const today = new Date().toISOString().split("T")[0];
    // npm launched in 2010; this range captures all-time downloads.
    const range = `2010-01-01:${today}`;

    const results = await Promise.all(packages.map((pkg) => fetchPackageDownloads(fetchImpl, pkg, range, timeoutMs)));

    if (results.every((count) => count === null)) {
      // Total upstream failure: serve the last known value rather than a
      // misleading zero. Only once nothing has ever succeeded do we emit a
      // controlled error payload -- still schema-valid, never a hang or a 5xx.
      if (cache) {
        return c.json(shieldsPayload(formatCount(cache.total)), 200, { "Cache-Control": CACHE_CONTROL });
      }
      return c.json(shieldsPayload("N/A", { isError: true }), 200, { "Cache-Control": CACHE_CONTROL });
    }

    const total = results.reduce((sum: number, count) => sum + (count ?? 0), 0);
    cache = { total, cachedAt: now };
    return c.json(shieldsPayload(formatCount(total)), 200, { "Cache-Control": CACHE_CONTROL });
  });
}
