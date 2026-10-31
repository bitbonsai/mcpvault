# MCPVault website migration to Shibumi Stack

## Status

p0–p6 done; `staging` deployed at `staging.mcpvault.org`. Route, asset, API, install, video playback/range, responsive screenshot, and browser console checks passed 2026-08-13. Production registration and explicit maintainer cutover remain. Do not change production hosting until the maintainer approves cutover.

## Why

The current website is restored on Astro 5 + `@astrojs/cloudflare` 12 after the Astro 7 / adapter 14 upgrade produced Workers-style artifacts that Cloudflare Pages accepted but served as 404s. The rollback restored production but reopened nine website dependency advisories.

The target is a small, portable Shibumi-style application running on the existing Hetzner server:

- Bun runtime and package manager
- Hono routes and server-rendered TSX
- Alpine for browser state
- Zod at request boundaries
- plain CSS with explicit component roots
- native cross-document View Transitions
- rootless Podman behind the existing Cloudflare proxy

No database is needed. Do not add Drizzle or persistent storage.

## Approved deviations from production

Deliberate, maintainer-approved differences the visual/parity gates must not flag:

- npm downloads badge anchor (Hero) and the footer npm icon link point at `@bitbonsai/mcpvault` (production links both to the nonexistent unscoped `mcpvault` package).
- Newsletter "Stay in the loop" eyebrow drops the decorative dash (`.eyebrow-line`) present in `NewsletterSignup.astro` (commit `16489cd`).
- `sitemap.xml` serves real XML (production serves an SPA HTML fallback).
- `sitemap-0.xml` 301s to `/sitemap.xml` instead of reproducing production's broken 200 `text/html` SPA fallback (Phase 2 review, headers-baseline finding); the two URLs no longer serve duplicate bodies.
- Footer gains a "Built with Shibumi Stack" credit linking to https://shibumi.site (maintainer request 2026-08-10, commit `582c67c`).
- Nav is glass: background opacity 0.7 + 16px backdrop blur, links nowrap/ellipsis (maintainer requests 2026-08-10, commits `4ca8324`, `f927416`; production nav is 0.95 opaque, no blur).
- The install-page Terminal is demo-purpose only (maintainer decision 2026-08-10): implementation deliberately simplified versus the 48k `Terminal.astro`; visual result stays close but is not held to pixel parity, and over-engineered internals (typing animations, complex state) may be dropped.

## Non-goals

- No visual redesign during migration. Preserve the current information architecture, copy, responsive behavior, and interaction design.
- No MCP server/package behavior changes or npm version bump.
- No Cloudflare Workers runtime.
- No dependency on an unpublished Shibumi package. Reuse and dogfood the public `shibumistack.dev` source patterns; upstream reusable improvements separately.
- Do not disable Cloudflare Pages until the Hetzner deployment has been stable and rollback-tested.

## Target architecture

```text
Cloudflare proxy
      |
Hetzner origin TLS / existing reverse proxy
      |
rootless Podman container (Bun + Hono)
      |-- server-rendered TSX pages
      |-- static assets and Markdown
      |-- GET  /api/downloads.json
      |-- POST /api/subscribe
      `-- GET  /api/unsubscribe
```

The server is stateless. Runtime configuration is limited to `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, host/port, and optional trusted-proxy settings.

## Proposed website structure

```text
website/
  Containerfile
  compose.yaml or deploy/quadlet/
  package.json
  bun.lock
  server.ts
  src/
    app.tsx
    layouts/
      Layout.tsx
    components/
      *.tsx
    pages/
      Home.tsx
      Install.tsx
      Features.tsx
      Demo.tsx
      HowItWorks.tsx
      Skill.tsx
    routes/
      downloads.ts
      subscribe.ts
      unsubscribe.ts
    content/
      *.md
    client/
      alpine.ts
    styles/
      shared.css
      home.css
      install.css
      features.css
      demo.css
      how-it-works.css
      skill.css
  public/
    llm.txt
    media and icons
  test/
    routes/
    integration/
    visual/
```

## Rendering and browser decisions

### TSX and partials

Use Hono JSX functional components and a shared `Layout`. Components are ordinary server-rendered `.tsx` functions, not React components. Use Hono's JSX renderer and escaping defaults; audit every use of raw HTML.

Read the package version from the root `package.json` once at startup. Preserve the current URLs, canonical metadata, Open Graph data, structured data, and Markdown endpoints.

### Markdown

Reuse the content-discovery and content-negotiation ideas from public `shibumistack.dev`:

- HTML is the browser default.
- Existing `website/public/*.md` URLs and `llm.txt` remain stable.
- `Accept: text/markdown` may return the matching Markdown source where available.
- Rich TSX pages and Markdown representations remain synchronized until a later project proves a single canonical source can represent both without losing browser content.

### Alpine

Use Alpine only where state is required:

- mobile navigation
- theme toggle
- interactive demo and response rendering
- terminal controls/copy behavior
- newsletter submission state

Keep state/data in named modules rather than large inline `x-data` expressions. Bundle or vendor Alpine locally; do not introduce a runtime CDN dependency.

Use the `@alpinejs/csp` build so the CSP ships without `'unsafe-eval'`. The standard Alpine build evaluates attribute strings via the `Function()` constructor, which a strict CSP blocks. The CSP build restricts attributes to naming registered `Alpine.data()` modules and their methods, which matches the named-modules rule above. If the interactive demo proves impossible under the restricted syntax, fall back to the standard build plus `'unsafe-eval'` and document the trade-off explicitly.

### View Transitions

Use native cross-document View Transitions (`@view-transition { navigation: auto; }`) with normal multi-page navigation and graceful fallback. Do not recreate Astro's client router or add a custom SPA router unless a measured UX regression proves it necessary.

### Pragmatic CSS scoping

Use plain cached stylesheets, not CSS Modules or CSS-in-JS:

- global tokens/reset/layout in `shared.css`
- one stylesheet per route
- every component has a unique root such as `data-component="hero"` or `.c-hero`
- every component selector is rooted under that namespace
- page-only selectors are rooted under a page identifier
- preserve reduced-motion, focus, high-contrast, and mobile behavior

Example:

```css
[data-component="hero"] { ... }
[data-component="hero"] .title { ... }
```

Convert Tailwind utilities and Astro scoped styles deliberately; do not ship both old and new styling systems.

### Syntax highlighting and icons

Replace React-only highlighting with server-side Shiki output cached at startup, or preserve pre-rendered highlighted markup where static. Replace `lucide-react` with an audited inline SVG helper or a runtime-neutral Lucide package. Preserve accessible labels and `aria-hidden` behavior.

## Dynamic route parity

### `GET /api/downloads.json`

- Preserve the Shields endpoint schema exactly.
- Fetch totals for both npm package names.
- Add explicit upstream timeouts and a bounded in-memory cache.
- Preserve the current cache headers.
- Return a last-known value or controlled error if npm is unavailable; never hang the badge request.

### `POST /api/subscribe`

- Parse JSON and form-urlencoded bodies.
- Validate and normalize email with Zod.
- Inject the Resend client in tests.
- Check every Resend `{ error }` result.
- Send the welcome email reliably; do not use an untracked fire-and-forget promise.
- Use an idempotency key to prevent duplicate welcome emails on retries.
- Keep secrets outside the image.

### `GET /api/unsubscribe`

- Preserve current behavior during parity migration.
- Add tests for missing email, normalization, Resend errors, and successful removal.
- Track signed unsubscribe tokens as a separate security follow-up rather than silently changing existing links during migration.

## Migration phases

### Phase 0 — establish safety and baseline

1. Merge the visual-regression guardrail in PR #190.
2. Confirm current production pages, video, posters, badges, and all three APIs are healthy.
3. Capture deterministic baseline screenshots for all six routes at desktop and mobile sizes; store them in the repo under `website/test/visual/baseline/`.
4. Record current Lighthouse/accessibility results, and save essential response headers as machine-readable `website/test/baseline/headers-baseline.json` so later phases can diff automatically instead of eyeballing.
5. Audit the Hetzner host without changing it:
   - architecture and OS
   - current reverse proxy and TLS ownership
   - rootless Podman/systemd conventions
   - available ports, firewall, disk, and memory
   - Cloudflare origin configuration
6. Choose a staging hostname and rollback DNS target.

Gate: no migration work starts without usable visual baselines and a known production rollback.

### Phase 1 — build a parallel Shibumi application

1. Develop in a dedicated worktree/branch.
2. Create the Hono/Bun/TSX skeleton alongside the live Astro website so Cloudflare Pages remains untouched.
3. Add `/healthz`, static serving, error handling, security headers, request logging, and graceful shutdown.
4. Add route tests using `app.request()` before porting pages.
5. Commit a separate Bun lockfile and make CI use `bun install --frozen-lockfile`.
6. Build a dedicated video route on `Bun.file(path).slice(start, end)` handling `HEAD`, full `GET`, and `Range` requests with correct `206 Partial Content`, `Content-Range`, and `Accept-Ranges` headers, plus tests. Decided upfront: do not rely on Hono's `serveStatic` for video — its Bun Range support has been incomplete, and Safari refuses to play video without Range support.

Gate: skeleton builds, tests, audits, starts in a container, and shuts down cleanly.

### Phase 2 — migrate server-rendered pages

Port in reviewable groups while preserving URLs and semantics:

1. Shared shell: `Layout`, navigation, footer, theme, metadata, plus explicit `sitemap.xml` and `robots.txt` routes (Astro's sitemap integration goes away, so these must be built, not just checked in QA).
2. Home: Hero, FeatureGrid/Card, CodeExample/CodeBlock, FAQ, UpdateCallout, SpecPreviewCallout, NewsletterSignup.
3. Features: ComparisonTable and associated content.
4. Install: Terminal and copy/tab behavior.
5. How It Works.
6. Skill: SkillsContent.
7. Demo shell and response examples, leaving interactivity for Phase 3.

For every group:

- port TSX markup
- port scoped/page CSS
- preserve Markdown counterpart
- add route assertions
- capture local desktop/mobile screenshots
- compare with baseline before continuing

Gate: all direct routes render without JavaScript and match current content and responsive layout.

### Phase 3 — replace browser interactivity

1. Port `InteractiveDemo.tsx` and `ResponseRenderer.tsx` to Alpine modules.
2. Port navigation, theme, terminal, copy, and newsletter behavior.
3. Add cross-document View Transitions and reduced-motion fallback.
4. Verify browser back/forward, deep links, keyboard operation, focus restoration, and no-JS fallback.
5. Remove React, Astro client directives, and React-only dependencies only after parity tests pass.

Gate: functional browser tests pass at desktop and mobile widths with no console errors or hydration/runtime warnings.

### Phase 4 — migrate APIs and static assets

1. Port and test the three Hono API routes.
2. Replicate the Cloudflare trailing-slash and route-redirect behavior from PRs #187/#188 as Hono middleware with tests, so redirects do not depend on Cloudflare rules surviving the origin switch.
3. Preserve all public Markdown and LLM files.
4. Preserve media filenames and caching semantics.
5. Test normal and byte-range video requests through the Phase 1 dedicated video route; playback must work in a real browser.
6. Test every external badge source and the local downloads badge payload.
7. Remove Astro, `@astrojs/cloudflare`, Tailwind, React, and obsolete build configuration.
8. Run Bun audit and Dependabot review; target zero open website advisories.

Gate: container serves every page, asset, Markdown file, and API with expected status, content type, cache headers, and body.

### Phase 5 — container and staging deployment

1. Build a minimal, pinned Bun container image.
2. Run rootless and non-root with:
   - read-only root filesystem where practical
   - dropped capabilities
   - `no-new-privileges`
   - 512 MB memory limit
   - conservative CPU limit
   - health check on `/healthz`
   - restart through systemd/Quadlet or the host's established Podman convention
3. Publish immutable commit-SHA images to GHCR.
4. Deploy to the staging hostname behind Cloudflare with Full (strict) origin TLS.
5. Supply Resend secrets via a mode-0600 environment file or systemd credentials.
6. Verify logs, restart after reboot, health failures, and rollback to the previous image.

Gate: staging survives restart/reboot tests and has no direct public origin exposure beyond the intended proxy path.

### Phase 6 — mandatory deployed-preview QA

Run against the actual staging hostname, not localhost:

- Playwright screenshot comparisons for all six routes at desktop and mobile sizes
- maintainer visual inspection and explicit approval
- direct and trailing-slash route checks
- video poster, metadata, byte-range request, and actual playback
- all static images, fonts, icons, and downloadable Markdown
- GitHub/npm/support badges and `/api/downloads.json`
- newsletter validation/error path; use a controlled Resend test configuration
- unsubscribe validation/error path
- keyboard navigation, visible focus, reduced motion, and theme persistence
- browser console/network errors
- page metadata, canonical URLs, robots, sitemap, and structured data
- Cloudflare cache behavior and origin headers

Make screenshots deterministic: disable animations, freeze video at its poster/first frame, and mask or stub counters that legitimately change. Store approved baselines and fail CI on unexpected pixel differences.

Gate: green automated tests are insufficient. The maintainer must inspect deployed screenshots and approve the staging site.

### Phase 7 — cutover and observation

1. Build and deploy an immutable production image from the approved commit.
2. Confirm production health through the Hetzner origin before DNS/proxy changes.
3. Switch the Cloudflare origin to Hetzner.
4. Run the full route/asset/API/browser smoke suite against `mcpvault.org`.
5. Monitor logs, health, errors, CPU, memory, and response times closely.
6. Keep the previous Cloudflare Pages production deployment available for at least seven days.
7. Do not remove rollback DNS/configuration until the observation window ends.

Rollback immediately if pages, media, APIs, TLS, or visual checks regress: restore the previous Cloudflare Pages origin first, investigate second.

### Phase 8 — cleanup and upstream learning

Status 2026-08-23: steps 1-3 executed (PR deleting `website/`, AGENTS.md and RELEASING.md pointers moved to `website-shibumi/`). Cloudflare Pages was already absent from PR checks; confirm the Pages project is disconnected in the dashboard (step 2, maintainer). Steps 4-5 remain.

1. Remove the parallel Astro website only after the observation window.
2. Disable obsolete Cloudflare Pages production deployment hooks only after rollback is no longer needed.
3. Update `website/AGENTS.md`, root commands, README contributor guidance, and deployment documentation.
4. Update `.triage/` state and close website dependency alerts only after GitHub confirms them resolved.
5. Port generally useful TSX partials, Alpine, CSS-scoping, and visual-test patterns back to Shibumi in separate Shibumi PRs. MCPVault must not depend on those upstream changes landing.

## Test matrix

### Unit/route

- every HTML and Markdown route
- 404 and unsupported method handling
- content negotiation
- package-version injection
- safe escaping/raw HTML boundaries
- download aggregation success, timeout, partial upstream failure, and cache
- subscription body formats, validation, normalization, Resend errors, idempotency
- unsubscribe missing/success/error paths

### Integration/container

- clean image build from lockfile
- non-root process and read-only filesystem
- health and graceful shutdown
- root/static/index routes
- content types and cache headers
- video `HEAD`, full `GET`, and `Range` request
- no secrets in image layers or logs
- restart and rollback

### Browser/visual

- Chromium desktop and mobile baselines for `/`, `/install`, `/features`, `/demo`, `/how-it-works`, `/skill`
- navigation and browser history
- Alpine interactions
- theme persistence
- video playback
- newsletter UI states
- reduced motion and keyboard focus
- zero console/page errors

### Security

- `bun audit` clean
- Dependabot clean for website manifest
- CSP ships without `'unsafe-eval'` (Alpine CSP build); headers reviewed for video, Shields, and Resend
- CSRF decision documented for subscription endpoint
- request size limits on newsletter endpoints; primary rate limiting as a Cloudflare WAF rule on `/api/subscribe` (the container is stateless, so in-memory app limits reset on every restart and are best-effort only)
- deploy webhook verifies GitHub HMAC signature with constant-time comparison, validates image tags as commit SHAs, and rejects everything else
- origin restricted appropriately behind Cloudflare
- container runs without root or unnecessary capabilities

## Acceptance criteria

- Production design/content parity approved from deployed screenshots.
- All six browser routes, Markdown routes, video, badges, and three APIs work on the staging and production domains.
- Website dependency audit has no known advisories.
- No Astro, React, Tailwind, or Cloudflare runtime adapter remains.
- Container is stateless, non-root, resource-limited, health-checked, restart-safe, and rollback-tested.
- Cloudflare is only DNS/proxy/cache; no Worker is required.
- Existing Cloudflare Pages deployment remains a tested rollback during the observation window.
- Root MCP package, npm version, and release process remain unchanged.

## Deploy: shibumi-server, in-situ builds (decided 2026-08-10)

Deployment uses the maintainer's own `shibumi-server` (~/bit/shibumi-server, dogfooding it as its first production install) instead of a registry pipeline. No GHCR, no image publishing from CI; the CI that remains is test-only.

Flow: signed GitHub **push** webhook → Caddy routes `/hooks/github/mcpvault-web` to shibumi-server on loopback → it verifies HMAC/repository/branch/SHA (replay-cached delivery IDs), fetches the exact commit, builds the image in situ with rootless podman compose, health-checks the new container, and keeps the active image plus two rollback images. Resource guards refuse builds when host memory/disk are low; builds are killed on timeout.

```text
GitHub push webhook
      |
Cloudflare → Caddy (host HTTPS)
      |-- /hooks/github/mcpvault-web → shibumi-server (127.0.0.1)
      `-- everything else            → mcpvault-web container (127.0.0.1:9100)
```

- App ships `website-shibumi/compose.yaml` carrying the same hardening as the container gate verified (read-only, cap-drop ALL, no-new-privileges, 512MB/0.5 CPU, healthcheck).
- Resend secrets + webhook secret live in mode-0600 env files on the host, never in the repo or image.
- Reverse proxy open decision resolved: **Caddy** fronts the host behind Cloudflare.
- Cost accepted: ~30-90s CPU burst per deploy on the host; rollback depth = retained images (2).

## Open decisions before implementation

- Reverse proxy: resolved — Caddy (maintainer decision 2026-08-10).
- Which staging hostname should be used?
- Deploy mechanism: resolved — shibumi-server with in-situ podman builds per the "Deploy" section above (GHCR pipeline dropped 2026-08-10).
- Should HTML/Markdown content remain manually dual-maintained initially, or can a narrow subset safely use Markdown as canonical source? Note: Bun ships native `Bun.markdown` (`.html()/.ansi()/.render()/.react()`, verified on 1.3.14), so canonical-markdown rendering needs zero added dependencies and `marked` can be dropped.
- Should reusable Shibumi TSX/Alpine work be developed upstream first or extracted after MCPVault proves it (webhook receiver is a candidate for upstreaming into shibumi-server)?
