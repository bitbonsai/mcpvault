/**
 * Hono application factory for the Shibumi-stack MCPVault website.
 *
 * Phase 1 skeleton: /healthz, static serving, security headers, request
 * logging, error handling, and the dedicated video route. No pages yet.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { join, normalize, resolve, sep } from "node:path";
import { contentSecurityPolicy } from "./lib/csp";
import { registerBenchmarksRoute } from "./routes/benchmarks";
import { registerClientRoute } from "./routes/client";
import { registerDemoRoute } from "./routes/demo";
import { registerDownloadsRoute, type DownloadsRouteOptions } from "./routes/downloads";
import { registerFeaturesRoute } from "./routes/features";
import { registerHomeRoute } from "./routes/home";
import { registerHowItWorksRoute } from "./routes/how-it-works";
import { registerInstallRoute } from "./routes/install";
import { registerSeoRoutes, SITE_ROUTES, SITE_URL } from "./routes/seo";
import { registerSkillRoute } from "./routes/skill";
import { registerSubscribeRoute, type SubscribeRouteOptions } from "./routes/subscribe";
import { registerUnsubscribeRoute } from "./routes/unsubscribe";
import type { UnsubscribeRouteOptions } from "./routes/unsubscribe";
import { registerVideoRoutes } from "./routes/video";

export interface AppOptions {
  /** Directory served for static assets and video. Defaults to ../public. */
  publicDir?: string;
  /** Directory served for plain CSS under /styles/*. Defaults to ./styles. */
  stylesDir?: string;
  /** Directory holding client TS entry points bundled for the browser. Defaults to ./client. */
  clientDir?: string;
  /** Base URL used to build sitemap.xml/robots.txt. Defaults to production. */
  siteUrl?: string;
  /** Overrides for `GET /api/unsubscribe`'s Resend client/env; used in tests. */
  unsubscribe?: UnsubscribeRouteOptions;
  /** Overrides for `POST /api/subscribe`'s Resend client/env/welcome template; used in tests. */
  subscribe?: SubscribeRouteOptions;
  /** Public Cloudflare Turnstile site key rendered on the newsletter form. */
  turnstileSiteKey?: string;
  /** Overrides for `GET /api/downloads.json`'s fetchImpl/timeouts/cache; used in tests. */
  downloads?: DownloadsRouteOptions;
}

// Outside production the hour-long TTL makes every local CSS tweak invisible
// until a hard refresh; dev serves no-store instead. Production keeps the
// baseline-matching header.
const STATIC_CACHE_CONTROL =
  process.env.NODE_ENV === "production" ? "public, max-age=3600" : "no-store";
// Matches the page/markdown routes' CACHE_CONTROL (routes/home.tsx et al.):
// static .md files under publicDir (e.g. /index.md) must send the same
// charset and revalidation semantics as their content-negotiated siblings.
const MARKDOWN_STATIC_CACHE_CONTROL = "public, max-age=0, must-revalidate";

/**
 * True if `filePath` is `base` itself or a real descendant of it.
 *
 * `base` must already be an absolute, resolved directory with any trailing
 * separator stripped (see `resolve()` calls in `createApp`) — comparing raw,
 * possibly-relative, possibly-trailing-slash caller input against a
 * `normalize(join(...))` result lets a sibling directory that merely shares
 * a name prefix (`public` vs `public-evil`) slip past a naive `startsWith`,
 * and a trailing separator on `base` breaks the match for every legitimate
 * path. Resolving both sides once up front and appending exactly one
 * separator here closes both gaps.
 */
function isWithinBase(filePath: string, base: string): boolean {
  if (filePath === base) return true;
  const baseWithSep = base.endsWith(sep) ? base : base + sep;
  return filePath.startsWith(baseWithSep);
}

/** Minimal request logger; silent under bun test. */
function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = performance.now();
    await next();
    if (process.env.NODE_ENV !== "test") {
      const durationMs = (performance.now() - startedAt).toFixed(1);
      console.log(
        `${new Date().toISOString()} ${c.req.method} ${c.req.path} ${c.res.status} ${durationMs}ms`,
      );
    }
  };
}

export function createApp(options: AppOptions = {}): Hono {
  // Resolved once, up front: makes both base dirs absolute, strips any
  // trailing separator, and collapses any ".." a caller-supplied option
  // might contain, so the prefix checks below compare like with like
  // regardless of how publicDir/stylesDir were supplied.
  const publicDir = resolve(options.publicDir ?? join(import.meta.dir, "..", "public"));
  const stylesDir = resolve(options.stylesDir ?? join(import.meta.dir, "styles"));
  const clientDir = options.clientDir ?? join(import.meta.dir, "client");
  const siteUrl = options.siteUrl ?? SITE_URL;
  const turnstileSiteKey = options.turnstileSiteKey ?? process.env.TURNSTILE_SITE_KEY ?? "";
  const app = new Hono();

  app.use(requestLogger());
  // Non-CSP headers are the secure-headers defaults; the explicit CSP (no
  // 'unsafe-eval', matching the @alpinejs/csp build) is defined in lib/csp.ts.
  app.use(secureHeaders({ contentSecurityPolicy }));

  // Cloudflare Pages' public/_headers set `X-Robots-Tag: index, follow` on
  // every response (PR #188); that rule dies at cutover since Pages is no
  // longer in front of this origin, so it is replicated here as a Hono
  // header instead of assumed to survive.
  app.use("*", async (c, next) => {
    await next();
    // Mutate the existing Response's headers directly (same pattern
    // `hono/secure-headers` uses) rather than `c.header()`: that helper
    // recreates the Response from `.body` once finalized, and re-deriving
    // a stream from a Bun.file().slice() Range body that way drops the
    // slice and re-streams the whole file (confirmed against the video
    // Range tests).
    c.res.headers.set("X-Robots-Tag", "index, follow");
  });

  // Production 301s bare page paths to their trailing-slash form (Cloudflare
  // rules from PRs #187/#188); replicated here so behavior survives cutover.
  // Only the known page routes redirect — anything else must fall through to 404.
  const trailingSlashPages = new Set(SITE_ROUTES.filter((path) => path !== "/").map((path) => path.slice(0, -1)));
  app.use("*", async (c, next) => {
    const { pathname, search } = new URL(c.req.url);
    if (trailingSlashPages.has(pathname)) {
      return c.redirect(`${pathname}/${search}`, 301);
    }
    await next();
  });

  app.get("/healthz", (c) => {
    c.header("cache-control", "no-store");
    return c.json({ status: "ok" });
  });

  // Video before generic static: Range support via Bun.file().slice(),
  // deliberately not hono serveStatic (incomplete Bun Range support).
  registerVideoRoutes(app, publicDir);

  // Explicit sitemap.xml/robots.txt routes; Astro's sitemap integration
  // does not carry over (see routes/seo.ts for why this can't be assumed).
  registerSeoRoutes(app, siteUrl);

  // Home page (Phase 2, group 2). Registered before generic static serving
  // so "/" resolves to the page, not a directory-index lookup.
  registerHomeRoute(app, publicDir, turnstileSiteKey);

  // Features page (Phase 2, group 3).
  registerFeaturesRoute(app, publicDir);
  registerBenchmarksRoute(app, publicDir);

  // Install page (Phase 2, group 4).
  registerInstallRoute(app, publicDir);

  // How It Works page (Phase 2, group 5).
  registerHowItWorksRoute(app, publicDir);

  // Skill page (Phase 2, group 6).
  registerSkillRoute(app, publicDir);

  // Demo page shell (Phase 2, group 7) plus its Alpine interactivity
  // (Phase 3 step 1: InteractiveDemo/ResponseRenderer).
  registerDemoRoute(app, publicDir);

  // Bundled Alpine client script for the demo page's interactivity.
  registerClientRoute(app, clientDir);

  // GET /api/unsubscribe (Phase 4, ported ahead of schedule): preserves
  // current production behavior exactly. Signed tokens are a documented
  // follow-up, not added here.
  registerUnsubscribeRoute(app, options.unsubscribe ?? {});

  // POST /api/subscribe (Phase 4, ported ahead of schedule): Zod-validated
  // body parsing, injectable Resend client, tracked idempotent welcome email.
  registerSubscribeRoute(app, options.subscribe ?? {});

  // GET /api/downloads.json (Phase 4, ported ahead of schedule): Shields
  // endpoint badge JSON for the Hero and footer npm badges.
  registerDownloadsRoute(app, options.downloads ?? {});

  // Plain CSS under /styles/*, rooted and traversal-safe, same shape as the
  // generic static handler below but scoped to src/styles (source == the
  // served asset; there is no build/bundle step for this plain-CSS approach).
  app.on(["GET", "HEAD"], "/styles/*", async (c, next) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(c.req.url).pathname);
    } catch {
      return c.text("Bad Request", 400);
    }
    if (pathname.includes("\0")) return c.text("Bad Request", 400);

    const relative = pathname.slice("/styles".length);
    const filePath = normalize(join(stylesDir, relative));
    if (!isWithinBase(filePath, stylesDir)) {
      return c.notFound();
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) return await next();

    const headers = new Headers({
      "content-type": "text/css; charset=utf-8",
      "content-length": String(file.size),
      "cache-control": STATIC_CACHE_CONTROL,
    });
    const body = c.req.method === "HEAD" ? null : file;
    return new Response(body, { status: 200, headers });
  });

  // Generic static serving from publicDir, rooted and traversal-safe.
  app.on(["GET", "HEAD"], "/*", async (c, next) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(c.req.url).pathname);
    } catch {
      return c.text("Bad Request", 400);
    }
    if (pathname.includes("\0")) return c.text("Bad Request", 400);

    const filePath = normalize(join(publicDir, pathname));
    if (!isWithinBase(filePath, publicDir)) {
      return c.notFound();
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) return await next();

    const isMarkdown = pathname.endsWith(".md");
    // /llm.txt shares the .md files' baseline headers (public, max-age=0,
    // must-revalidate) rather than the long-lived static default.
    const isLlmText = pathname === "/llm.txt";
    const headers = new Headers({
      "content-type": isMarkdown
        ? "text/markdown; charset=utf-8"
        : isLlmText
          ? "text/plain; charset=utf-8"
          : file.type || "application/octet-stream",
      "content-length": String(file.size),
      "cache-control": isMarkdown || isLlmText ? MARKDOWN_STATIC_CACHE_CONTROL : STATIC_CACHE_CONTROL,
    });
    const body = c.req.method === "HEAD" ? null : file;
    return new Response(body, { status: 200, headers });
  });

  app.notFound((c) => c.text("Not Found", 404));

  app.onError((err, c) => {
    console.error(`unhandled error on ${c.req.method} ${c.req.path}:`, err);
    return c.text("Internal Server Error", 500);
  });

  return app;
}

export default createApp();
