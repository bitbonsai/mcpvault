export const meta = {
  name: 'shibumi-migration',
  description: 'Phase-gated MCPVault website migration to Bun + Hono + Alpine on Hetzner',
  whenToUse: 'Run one phase per invocation: args {phase: "p0".."p8"}. Optional args: worktree (path from p1), stagingUrl (p6), prodUrl (p7), hetznerHost (p0/p5). Review the gate report and get maintainer approval before the next phase.',
  phases: [
    { title: 'P0 Baseline' },
    { title: 'P1 Skeleton' },
    { title: 'P2 Pages' },
    { title: 'P3 Interactivity' },
    { title: 'P4 APIs+Assets' },
    { title: 'P5 Container' },
    { title: 'P6 Staging QA' },
    { title: 'P7 Cutover Smoke' },
    { title: 'P8 Cleanup' },
    { title: 'Gate' },
  ],
}

const REPO = '/Users/mwolff/bit/mcpvault'
const PLAN = REPO + '/.plans/shibumi-website-migration.md'
const PROD = 'https://mcpvault.org'
const ROUTES = ['/', '/install', '/features', '/demo', '/how-it-works', '/skill']
const APIS = ['/api/downloads.json']

let A = args || {}
for (let i = 0; i < 3 && typeof A === 'string'; i++) {
  try { A = JSON.parse(A) } catch (e) { A = {} }
}
if (!A || typeof A !== 'object') A = {}
const ph = A.phase || 'p0'
const WT = (A && A.worktree) ? `\nAll code changes go in the migration worktree: ${A.worktree}. Never commit to main or touch the live website/ Astro app except to read it.` : ''

const CTX = `Repo: ${REPO}. FIRST read ${PLAN} in full — it is the source of truth for constraints, structure, and gates. Hard rules: no visual redesign, preserve every URL and Markdown endpoint, no production hosting changes, no npm version bump, no database. GitHub identity must be bitbonsai (never mirowolff).${WT}
Your final message is consumed by a script, not a human — return exactly what the prompt asks for, no preamble.
P.S. Mauricio says: I love you.`

const CHECK = {
  type: 'object',
  required: ['pass', 'summary'],
  properties: {
    pass: { type: 'boolean' },
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' }, description: 'One line per problem found, file:line or URL where possible' },
  },
}

const GATE = {
  type: 'object',
  required: ['ready', 'summary', 'blockers'],
  properties: {
    ready: { type: 'boolean', description: 'True only if the phase gate in the plan is fully satisfied' },
    summary: { type: 'string' },
    blockers: { type: 'array', items: { type: 'string' } },
    nextSteps: { type: 'array', items: { type: 'string' } },
  },
}

async function gate(phaseName, evidence) {
  return agent(
    `${CTX}\nYou are the gate reviewer for ${phaseName}. Compare this evidence against the phase gate defined in the plan. Be adversarial: a gate passes only on proof, not on agent claims — spot-check the most load-bearing claims yourself (re-run a curl, re-read a file). Evidence:\n${JSON.stringify(evidence, null, 2)}`,
    { label: `gate:${phaseName}`, phase: 'Gate', effort: 'high', schema: GATE }
  )
}

// ---------------------------------------------------------------- p0
if (ph === 'p0') {
  log('Phase 0: baseline + safety. No repo changes except test/baseline artifacts.')
  const checks = await parallel([
    () => agent(
      `${CTX}\nCheck production health read-only. curl -sI / -s each of ${ROUTES.join(', ')} plus trailing-slash variants, ${APIS.join(', ')}, every website/public/*.md URL, /llm.txt, robots.txt, sitemap. Also HEAD + Range request (bytes=0-1023) on the demo video. Record status, content-type, cache-control per URL. Save the full table as ${REPO}/website/test/baseline/headers-baseline.json (create dirs). pass=false if any URL is unhealthy.`,
      { label: 'prod-health', phase: 'P0 Baseline', model: 'sonnet', effort: 'low', schema: CHECK }
    ),
    () => agent(
      `${CTX}\nCheck badge sources read-only: GitHub/npm/support badges referenced in the website source, and validate ${PROD}/api/downloads.json against the Shields endpoint schema (schemaVersion, label, message, color). Confirm it aggregates both npm package names. pass=false on any broken badge or schema drift.`,
      { label: 'badges', phase: 'P0 Baseline', model: 'sonnet', effort: 'low', schema: CHECK }
    ),
    () => agent(
      `${CTX}\nUse the agent-browser skill to capture deterministic baseline screenshots of ${PROD}${ROUTES.join(', ' + PROD)} at 1440x900 and 390x844. Disable animations via prefers-reduced-motion / injected CSS, let the video sit on its poster frame, and note (do not mask yet) any live counters. Save PNGs under ${REPO}/website/test/visual/baseline/ named route-viewport.png. Afterwards close the session and kill Chrome for Testing helpers: pkill -f '/[a]gent-browser-darwin-arm64'; pkill -f '[G]oogle Chrome for Testing'; verify with pgrep. pass=false if any screenshot failed.`,
      { label: 'baseline-shots', phase: 'P0 Baseline', model: 'sonnet', effort: 'medium', schema: CHECK }
    ),
    () => agent(
      `${CTX}\nReport read-only status of PR #190 (gh pr view 190: state, reviews, CI). Do NOT merge — merging is the maintainer's call. Also run a Lighthouse or equivalent accessibility/performance snapshot of ${PROD}/ if a tool is available locally, and store results under ${REPO}/website/test/baseline/. pass=false if PR #190 is unmerged (it is a plan gate) — list it as a finding, not something to fix.`,
      { label: 'pr190+lighthouse', phase: 'P0 Baseline', model: 'sonnet', effort: 'low', schema: CHECK }
    ),
    () => (A && A.hetznerHost)
      ? agent(
          `${CTX}\nAudit the Hetzner host ${A.hetznerHost} over SSH READ-ONLY (uname, os-release, existing reverse proxy config, TLS ownership, rootless podman + systemd/quadlet conventions, listening ports, firewall, df -h, free -m, Cloudflare origin setup). Change nothing. Return findings and note which reverse-proxy/deploy convention the plan's open decision should adopt.`,
          { label: 'hetzner-audit', phase: 'P0 Baseline', model: 'sonnet', effort: 'medium', schema: CHECK }
        )
      : Promise.resolve({ pass: false, summary: 'Hetzner audit skipped: pass args.hetznerHost to run it.', findings: ['hetzner host audit not run'] }),
  ])
  log('Baseline checks done — running gate review.')
  const g = await gate('Phase 0', checks.filter(Boolean))
  return { phase: 'p0', checks: checks.filter(Boolean), gate: g }
}

// ---------------------------------------------------------------- p1
if (ph === 'p1') {
  log('Phase 1: parallel Shibumi skeleton in a dedicated worktree.')
  const skeleton = await agent(
    `${CTX}\ngit fetch origin first, then create the migration branch shibumi based on origin/main in a NEW worktree using the wt CLI (worktrunk; fall back to git worktree add if wt is unavailable) — local main may be behind and must not be checked out or modified. Inside it, scaffold the Shibumi app per the plan's "Proposed website structure" section in a new website-shibumi/ directory alongside the live website/: Bun + Hono, server.ts with /healthz, static serving, security headers, request logging, graceful shutdown, error handling; a dedicated video route per the plan's Phase 1 item 6 built on Bun.file(path).slice(start, end) handling HEAD, full GET, and Range with correct 206/Content-Range/Accept-Ranges plus tests against a >5MB fixture (decided: do NOT use hono serveStatic for video, its Bun Range support has been incomplete); bun.lock committed; route tests with bun:test using app.request(); Containerfile; CI job using bun install --frozen-lockfile that does NOT touch the existing website deploy workflow. No pages yet. Also copy the untracked Phase 0 baseline artifacts from the main checkout (${REPO}/website/test/visual/baseline/*.png, ${REPO}/website/test/baseline/*) into the same paths in the worktree and commit them — the plan requires baselines stored in the repo. Run bun test and bun audit. Commit as bitbonsai. Return the absolute worktree path on the first line, then what you built and test results.`,
    { label: 'skeleton', phase: 'P1 Skeleton', effort: 'high' }
  )
  const worktree = (skeleton || '').split('\n')[0].trim()
  const [review, container] = await parallel([
    () => agent(
      `${CTX}\nReview the skeleton commit(s) on shibumi in worktree ${worktree} (git log/show). Check: security headers sane, graceful shutdown real (SIGTERM handled, in-flight requests drain), video route returns correct 206/Content-Range for Range and open-ended Range requests, no secrets anywhere, lockfile committed, tests meaningful, CI isolated from the live Astro deploy. Findings one line each, severity-tagged.`,
      { label: 'review:skeleton', phase: 'P1 Skeleton', effort: 'high', schema: CHECK }
    ),
    () => agent(
      `${CTX}\nIn worktree ${worktree}: build the container image and smoke-test it. podman is NOT installed on this Mac — use docker (colima is running, docker daemon confirmed working); the Containerfile must stay podman-compatible for the Hetzner host, docker is only the local test runtime (docker build -f Containerfile). Run the container, curl /healthz, send SIGTERM and confirm clean shutdown, then remove the container and image. pass=false on any failure with exact error output.`,
      { label: 'container-smoke', phase: 'P1 Skeleton', model: 'sonnet', effort: 'medium', schema: CHECK }
    ),
  ])
  const g = await gate('Phase 1', { review, container })
  return { phase: 'p1', worktree, review, container, gate: g }
}

// ---------------------------------------------------------------- p2
if (ph === 'p2') {
  if (!A || !A.worktree) return { error: 'Pass args.worktree (from p1 result).' }
  const GROUPS = [
    { name: 'shell', routes: [], detail: 'Layout.tsx, Nav, Footer, ThemeToggle markup, head metadata, canonical URLs, Open Graph, structured data, sitemap + robots routes', effort: 'high' },
    { name: 'home', routes: ['/'], detail: 'Hero, FeatureGrid, FeatureCard, CodeExample, CodeBlock (server-side Shiki cached at startup), FAQ, UpdateCallout, SpecPreviewCallout, NewsletterSignup markup. One deliberate content fix found in Phase 0: the npm downloads badge anchor (Hero.astro:151) links to the nonexistent unscoped https://www.npmjs.com/package/mcpvault — port it pointing at https://www.npmjs.com/package/@bitbonsai/mcpvault instead. Also apply the shell-review carry-overs in this same commit: port the Counter.dev analytics script from website/src/layouts/Layout.astro:497-498 into Layout.tsx (MEDIUM finding — silently dropped); restore the "# LLM-specific crawlers" comment in the generated robots.txt (src/routes/seo.ts:33); make footer gutters responsive like Footer.astro px-4 sm:px-6 lg:px-8 (shared.css:325 is fixed 4rem 1rem); scope body overflow-x:hidden to the home page only, not globally (shared.css:49); remove the dead class="theme-toggle" from ThemeToggle.tsx or root its CSS on it, one convention only', effort: 'high' },
    { name: 'features', routes: ['/features/'], detail: 'ComparisonTable and features content', effort: 'medium' },
    { name: 'install', routes: ['/install/'], detail: 'Terminal markup and tab/copy structure (Alpine behavior lands in Phase 3)', effort: 'high' },
    { name: 'how-it-works', routes: ['/how-it-works/'], detail: 'HowItWorks', effort: 'medium' },
    { name: 'skill', routes: ['/skill/'], detail: 'SkillsContent', effort: 'high' },
    { name: 'demo', routes: ['/demo/'], detail: 'InteractiveDemo/ResponseRenderer static shell only, interactivity in Phase 3', effort: 'medium' },
  ]
  const done = []
  for (const grp of GROUPS) {
    log(`Porting group: ${grp.name}`)
    const port = await agent(
      `${CTX}\nPort group "${grp.name}" (${grp.detail}) from the Astro site at ${REPO}/website/src into the Hono/Bun app per the plan's Phase 2 rules: TSX markup via Hono JSX (audit every raw-HTML use), page + component CSS converted from Tailwind/Astro-scoped styles into the plan's data-component/page-root convention, Markdown counterpart preserved, lucide-react icons replaced with inline SVG helper preserving aria attributes. Add bun:test route assertions for the affected routes (status, key content, content negotiation). Run bun test. Commit as bitbonsai. Return files touched and test results.`,
      { label: `port:${grp.name}`, phase: 'P2 Pages', model: 'sonnet', effort: grp.effort }
    )
    // Visual verification happens live: the maintainer has both sites open (prod +
    // localhost:8788 watch server) and eyeballs each group as it commits. One full
    // automated pixel pass still runs later in the QA phase.
    done.push({ group: grp.name, port })
    log(`Group ${grp.name} committed — testable now at http://localhost:8788${(grp.routes && grp.routes[0]) || '/'}`)
  }
  const review = await agent(
    `${CTX}\nReview all Phase 2 commits on shibumi in worktree ${A.worktree}. Focus: raw-HTML/escaping boundaries, no leftover Tailwind classes, CSS rooted per the component-namespace convention, URLs and metadata unchanged vs the Astro source, no-JS rendering intact. Findings one line each, severity-tagged.`,
    { label: 'review:pages', phase: 'P2 Pages', effort: 'high', schema: CHECK }
  )
  const g = await gate('Phase 2', { groups: done, review })
  return { phase: 'p2', groups: done, review, gate: g }
}

// ---------------------------------------------------------------- p3
if (ph === 'p3') {
  if (!A || !A.worktree) return { error: 'Pass args.worktree.' }
  const steps = [
    { name: 'demo', prompt: 'Port InteractiveDemo.tsx and ResponseRenderer.tsx to Alpine named modules (Alpine.data) in src/client/. Vendor the @alpinejs/csp build locally (no CDN, no standard Alpine build) — the CSP build forbids inline expressions, so attributes may only name registered modules/methods. If a piece of the demo is genuinely impossible under that restriction, stop and report it as a blocker instead of silently switching builds. Preserve response rendering exactly.', effort: 'high' },
    { name: 'chrome-behaviors', prompt: 'Port navigation (mobile menu), theme toggle with persistence, Terminal tab/copy behavior, and newsletter submission UI states to Alpine named modules. For the Terminal (maintainer decisions: demo-purpose, keep it simple): add a lightweight typing animation for the command lines and keep per-tab state (selected tab, animation progress) in the component Alpine.data scope or a shared Alpine.store — do NOT add nanostores or any second state library; Alpine is the single state layer. Also port the .fade-in-on-scroll behavior properly: production animates it via a JS IntersectionObserver on scroll, but the p2 CSS made it auto-animate on features/install; wire the observer (plain JS module, no Alpine needed) and root the currently un-rooted duplicated .fade-in-on-scroll class per the CSS scoping convention (or document it as a shared helper in shared.css).', effort: 'medium' },
    { name: 'view-transitions', prompt: 'Add native cross-document View Transitions (@view-transition { navigation: auto; }) with reduced-motion fallback. No SPA router.', effort: 'medium' },
  ]
  const ported = []
  for (const s of steps) {
    ported.push({
      step: s.name,
      result: await agent(`${CTX}\n${s.prompt} All logic lives in named Alpine.data() modules — the vendored @alpinejs/csp build cannot evaluate inline expressions. Add or update tests where testable server-side. Run bun test. Commit as bitbonsai.`,
        { label: `port:${s.name}`, phase: 'P3 Interactivity', model: 'sonnet', effort: s.effort }),
    })
  }
  const [browser, cleanup] = await parallel([
    () => agent(
      `${CTX}\nFunctional browser test in worktree ${A.worktree}: start the dev server, use agent-browser at desktop and mobile widths to exercise mobile nav, theme toggle + persistence across navigation, interactive demo end-to-end, terminal copy, newsletter client-side validation states, back/forward history, deep links, keyboard operation and focus visibility, and confirm zero console errors. Also verify every page still renders with JavaScript disabled. Kill dev server and Chrome for Testing helpers afterwards. pass=false on any failure.`,
      { label: 'browser-functional', phase: 'P3 Interactivity', model: 'sonnet', effort: 'high', schema: CHECK }
    ),
    () => agent(
      `${CTX}\nIn worktree ${A.worktree}: confirm the new app has no React, no Astro client directives, no react-only deps in website-shibumi/package.json, and grep for leftover client:load/client:visible/useState imports. Report only — removal from the OLD website/ dir happens in Phase 8. pass=false if the new app still depends on React.`,
      { label: 'dep-check', phase: 'P3 Interactivity', model: 'sonnet', effort: 'low', schema: CHECK }
    ),
  ])
  const g = await gate('Phase 3', { ported, browser, cleanup })
  return { phase: 'p3', ported, browser, cleanup, gate: g }
}

// ---------------------------------------------------------------- p4
if (ph === 'p4') {
  if (!A || !A.worktree) return { error: 'Pass args.worktree.' }
  const apis = await parallel([
    () => agent(
      `${CTX}\nPort GET /api/downloads.json per the plan: exact Shields schema, totals for both npm package names, explicit upstream timeouts, bounded in-memory cache with last-known-value fallback, current cache headers preserved. Full bun:test coverage: success, timeout, partial upstream failure, cache hit, stale fallback. Commit as bitbonsai.`,
      { label: 'api:downloads', phase: 'P4 APIs+Assets', model: 'sonnet', effort: 'high' }
    ),
    () => agent(
      `${CTX}\nPort POST /api/subscribe per the plan: JSON + form-urlencoded parsing, Zod email validation/normalization, injectable Resend client, every {error} result checked, tracked (awaited or queued, never fire-and-forget) welcome email with an Idempotency-Key so retries cannot double-send, request size limit, secrets only via env. Full test coverage listed in the plan's test matrix. Commit as bitbonsai.`,
      { label: 'api:subscribe', phase: 'P4 APIs+Assets', model: 'sonnet', effort: 'high' }
    ),
    () => agent(
      `${CTX}\nPort GET /api/unsubscribe preserving current behavior exactly (signed tokens are a documented follow-up, do not add them). Tests: missing email, normalization, Resend error, successful removal. Commit as bitbonsai.`,
      { label: 'api:unsubscribe', phase: 'P4 APIs+Assets', model: 'sonnet', effort: 'medium' }
    ),
  ])
  const [assets, redirects, security] = await parallel([
    () => agent(
      `${CTX}\nVerify static parity AT CURRENT BRANCH HEAD (several header/Containerfile fix commits landed after the first pass — build fresh, do not reuse prior conclusions) in worktree ${A.worktree} against a locally running container: every website/public/*.md URL, llm.txt, media filenames, content types, cache headers, video HEAD + full GET + Range=bytes 206 responses through the Phase 1 dedicated video route. Compare headers against ${REPO}/website/test/baseline/headers-baseline.json and list every diff. pass=false on missing asset or header regression that matters (allow server-identity headers to differ).`,
      { label: 'assets-parity', phase: 'P4 APIs+Assets', model: 'sonnet', effort: 'medium', schema: CHECK }
    ),
    () => agent(
      `${CTX}\nTrailing-slash and redirect parity: read the Cloudflare route/redirect fixes from PRs #187 and #188 (gh pr view/diff) and the current production behavior for each route with and without trailing slash. The trailing-slash 301 middleware already exists in app.tsx (commit 069b9ee) — verify it against the PR rules rather than re-implementing. Then fix the confirmed header-parity drifts from the Phase 2 review, matching website/test/baseline/headers-baseline.json exactly: (a) .md static responses need "text/markdown; charset=utf-8" and "public, max-age=0, must-revalidate" (currently no charset + max-age=3600); (b) page HTML routes send no cache-control, baseline says "public, max-age=0, must-revalidate"; (c) decide /sitemap-0.xml (currently 404, production served it; serve the same XML or 301 to /sitemap.xml and record the deviation in the plan); (d) make robots.txt byte-identical to website/public/robots.txt; (e) fix src/lib/highlight.ts to actually cache Shiki output at startup as its doc comment claims (currently codeToHtml runs per request); (f) note the Cloudflare Pages _headers X-Robots-Tag "index, follow" dies at cutover — replicate it as a Hono header. Add tests. Commit as bitbonsai.`,
      { label: 'redirect-parity', phase: 'P4 APIs+Assets', model: 'sonnet', effort: 'medium' }
    ),
    () => agent(
      `${CTX}\nSecurity work + review of the new app in worktree ${A.worktree} at CURRENT branch HEAD. The CSP may already be implemented and committed (src/lib/csp.ts + secureHeaders wiring) — if so, verify it rather than re-implementing. Otherwise FIRST implement (not just review): an explicit Content-Security-Policy header — hono/secure-headers defaults emit NO CSP, so the @alpinejs/csp build's no-unsafe-eval benefit is currently unenforced. Write a strict policy (no unsafe-eval; account for the inline font-loader script + JSON-LD (nonce or hash or refactor), Google Fonts stylesheet, Counter.dev script, shields.io images, self video/styles/scripts), add tests asserting the header and that no unsafe-eval is present, verify every page still works in a real browser (agent-browser, own port, never 8788, sweep Chrome helpers after), commit as bitbonsai. THEN review: confirm the vendored Alpine is the @alpinejs/csp build (any inline x-data expression that forces the standard build is a finding); headers vs video, Shields fetches, Resend calls; CSRF posture for /api/subscribe documented; request size limits in the app plus a documented Cloudflare WAF rate rule for /api/subscribe; bun audit output; no secrets in code, image layers, or logs. Findings one line each, severity-tagged. pass=false on any high-severity finding.`,
      { label: 'security-review', phase: 'P4 APIs+Assets', effort: 'high', schema: CHECK }
    ),
  ])
  const g = await gate('Phase 4', { apis, assets, redirects, security })
  return { phase: 'p4', apis, assets, redirects, security, gate: g }
}

// ---------------------------------------------------------------- p5
if (ph === 'p5') {
  if (!A || !A.worktree) return { error: 'Pass args.worktree. Pass args.hetznerHost to include the staging deploy.' }
  const build = await agent(
    `${CTX}\nHarden the container per the plan's Phase 5. Carry-forwards from the Phase 1 review: digest-pin the oven/bun base image (currently tag-pinned 1.3.14-alpine); add a bounded drain timeout to server.ts shutdown (then server.stop(true)) plus an automated shutdown-drain test; harden the publicDir prefix check in src/app.tsx against trailing-separator/relative paths. Then: minimal pinned Bun base image, non-root user, read-only rootfs where practical, dropped capabilities, no-new-privileges, 512MB memory + conservative CPU limits, /healthz health check, systemd Quadlet unit (or the host convention found in the Phase 0 audit). Add a GitHub Actions job publishing immutable commit-SHA-tagged images to GHCR as ghcr.io/bitbonsai/mcpvault-web (the app's name is mcpvault-web; no workflow-file changes to the existing website deploy). Verify the image locally: podman is NOT installed on this Mac, use docker via the running colima VM (docker build/run with equivalent flags: --read-only, --cap-drop=ALL, --security-opt no-new-privileges, --memory 512m, non-root user); keep the Quadlet unit and image podman-compatible for the Hetzner host. Check: non-root, read-only, healthcheck passing, clean SIGTERM. Commit as bitbonsai.`,
    { label: 'container-harden', phase: 'P5 Container', model: 'sonnet', effort: 'high' }
  )
  const webhook = await agent(
    `${CTX}\nBuild the deploy webhook receiver per the plan's "Deploy webhook" section: a small standalone Bun script (host systemd service, OUTSIDE the website container) that accepts GitHub workflow_run/package webhooks. Must: verify X-Hub-Signature-256 HMAC with constant-time comparison and reject with 401 before any side effects; filter on repo/workflow/branch/success; validate the commit SHA against ^[0-9a-f]{7,40}$ and never interpolate raw payload strings into shell commands; serialize deploys with a lock; podman pull the SHA tag, restart the Quadlet unit, poll /healthz, auto-rollback to the previous tag on timeout; read the webhook secret from a mode-0600 env file or systemd credential; log every attempt to journald. Full bun:test coverage for signature verification (valid, invalid, missing), payload filtering, SHA validation, and lock behavior with the podman calls stubbed. Write it as a self-contained module suitable for later upstreaming to shibumi-server. Commit as bitbonsai.`,
    { label: 'deploy-webhook', phase: 'P5 Container', model: 'sonnet', effort: 'high' }
  )
  let deploy = { pass: false, summary: 'Staging deploy skipped: pass args.hetznerHost.', findings: [] }
  if (A.hetznerHost) {
    deploy = await agent(
      `${CTX}\nDeploy the GHCR image to staging on ${A.hetznerHost} per the plan: rootless podman via Quadlet, Resend secrets via mode-0600 env file or systemd credentials (NEVER echo secret values, never write them into the repo or logs), staging hostname behind Cloudflare with Full (strict) TLS, no direct public origin exposure beyond the proxy path. Install the deploy webhook receiver as a host systemd service on its dedicated path, register the GitHub webhook (workflow_run completed, not push) with a fresh secret, and verify an end-to-end webhook-triggered redeploy including the auto-rollback path. Then verify: logs clean, container restarts after unit restart, health-check failure handling, and manual rollback to the previous image tag. pass=false with exact errors on any failure.`,
      { label: 'staging-deploy', phase: 'P5 Container', model: 'sonnet', effort: 'high', schema: CHECK }
    )
  }
  const g = await gate('Phase 5', { build, webhook, deploy })
  return { phase: 'p5', build, webhook, deploy, gate: g }
}

// ---------------------------------------------------------------- p6
if (ph === 'p6') {
  if (!A || !A.stagingUrl) return { error: 'Pass args.stagingUrl (the deployed staging hostname — this phase must not run against localhost).' }
  const S = A.stagingUrl
  log(`Phase 6 QA against ${S}. All checks target the deployed host, not localhost.`)
  const shotSuffix = `Afterwards close agent-browser sessions and kill Chrome for Testing helpers (pkill -f '/[a]gent-browser-darwin-arm64'; pkill -f '[G]oogle Chrome for Testing').`
  const qa = await parallel([
    () => agent(`${CTX}\nScreenshot ${S}${ROUTES.join(', ' + S)} at 1440x900 and 390x844 with agent-browser, deterministic (animations off, video on poster frame, mask live counters), and pixel-compare against ${REPO}/website/test/visual/baseline/. Save the new shots under website/test/visual/staging/. List every route with visible differences. ${shotSuffix}`, { label: 'qa:visual', phase: 'P6 Staging QA', model: 'sonnet', effort: 'medium', schema: CHECK }),
    () => agent(`${CTX}\nOn ${S}: every route direct and with trailing slash, every public .md URL, llm.txt, robots, sitemap, structured data present in HTML, canonical URLs and OG metadata matching production values from the baseline. Compare response headers to website/test/baseline/headers-baseline.json.`, { label: 'qa:routes-meta', phase: 'P6 Staging QA', model: 'sonnet', effort: 'low', schema: CHECK }),
    () => agent(`${CTX}\nOn ${S}: video poster, metadata, HEAD, Range request 206, and REAL playback in agent-browser (play, seek, confirm currentTime advances). All images, fonts, icons load with correct types. ${shotSuffix}`, { label: 'qa:video-assets', phase: 'P6 Staging QA', model: 'sonnet', effort: 'medium', schema: CHECK }),
    () => agent(`${CTX}\nOn ${S}: GitHub/npm/support badges render, /api/downloads.json matches Shields schema and production values within reason. Newsletter subscribe happy path + validation/error paths using the controlled Resend test configuration ONLY (never the production audience); unsubscribe validation/error paths. pass=false if any API misbehaves.`, { label: 'qa:apis', phase: 'P6 Staging QA', model: 'sonnet', effort: 'medium', schema: CHECK }),
    () => agent(`${CTX}\nOn ${S} with agent-browser: full keyboard navigation with visible focus on every interactive element, reduced-motion honored, theme toggle persists across navigation and reload, browser back/forward and deep links work, zero console and zero failed network requests across all six routes. ${shotSuffix}`, { label: 'qa:a11y-behavior', phase: 'P6 Staging QA', model: 'sonnet', effort: 'high', schema: CHECK }),
    () => agent(`${CTX}\nOn ${S}: Cloudflare cache behavior (cf-cache-status per asset class), origin header hygiene, TLS mode evidence, and confirm the origin is not directly reachable except through the intended proxy path (test the origin IP/port from outside expectations documented in the plan; read-only).`, { label: 'qa:cloudflare', phase: 'P6 Staging QA', model: 'sonnet', effort: 'low', schema: CHECK }),
  ])
  const g = await gate('Phase 6', qa.filter(Boolean))
  return {
    phase: 'p6',
    qa: qa.filter(Boolean),
    gate: g,
    note: 'Green automation is insufficient per the plan: the maintainer must inspect the staging screenshots in website/test/visual/staging/ and explicitly approve before Phase 7.',
  }
}

// ---------------------------------------------------------------- p7
if (ph === 'p7') {
  if (!A || !A.prodUrl) return { error: 'Pass args.prodUrl. Run this AFTER the maintainer performs the Cloudflare origin switch — the switch itself is a human action, not this workflow.' }
  const P = A.prodUrl
  const smoke = await parallel([
    () => agent(`${CTX}\nSmoke ${P}: all six routes + trailing slashes, all .md URLs, llm.txt, robots, sitemap, all three APIs, video HEAD/Range/playback via agent-browser, badges. Kill Chrome for Testing helpers afterwards. pass=false triggers the plan's rollback rule.`, { label: 'smoke:full', phase: 'P7 Cutover Smoke', model: 'sonnet', effort: 'high', schema: CHECK }),
    () => agent(`${CTX}\nScreenshot ${P} all six routes both viewports with agent-browser and compare to the approved staging baselines in website/test/visual/staging/. Kill Chrome for Testing helpers afterwards. pass=false on visual regression.`, { label: 'smoke:visual', phase: 'P7 Cutover Smoke', model: 'sonnet', effort: 'medium', schema: CHECK }),
    () => agent(`${CTX}\nCheck origin health signals available from here: response times across 20 sequential requests per route, error rates, and (if args-provided SSH host is reachable) container logs, CPU, and memory on the origin. Read-only.`, { label: 'smoke:health', phase: 'P7 Cutover Smoke', model: 'sonnet', effort: 'low', schema: CHECK }),
  ])
  const failed = smoke.filter(Boolean).some(c => !c.pass)
  if (failed) log('SMOKE FAILURE: per the plan, restore the previous Cloudflare Pages origin FIRST, investigate second.')
  const g = await gate('Phase 7', smoke.filter(Boolean))
  return { phase: 'p7', smoke: smoke.filter(Boolean), gate: g, rollbackRequired: failed }
}

// ---------------------------------------------------------------- p8
if (ph === 'p8') {
  if (!A || !A.worktree) return { error: 'Pass args.worktree. Run only after the 7-day observation window.' }
  const cleanup = await agent(
    `${CTX}\nPhase 8 cleanup in worktree ${A.worktree}: remove the old Astro website/ (Astro, @astrojs/cloudflare, Tailwind, React, obsolete build config), promote website-shibumi/ to website/, run bun audit, and confirm zero website advisories. Do NOT touch Cloudflare Pages deployment hooks — that is the maintainer's call. Commit as bitbonsai.`,
    { label: 'cleanup', phase: 'P8 Cleanup', model: 'sonnet', effort: 'medium' }
  )
  const [docs, triage, upstream] = await parallel([
    () => agent(`${CTX}\nUpdate website/AGENTS.md, root command docs, README contributor guidance, and deployment documentation to describe the Bun/Hono/Podman setup. Commit as bitbonsai.`, { label: 'docs', phase: 'P8 Cleanup', model: 'sonnet', effort: 'medium' }),
    () => agent(`${CTX}\nUpdate ${REPO}/.triage/ state: note the migration, and list which website dependency alerts GitHub now shows resolved (gh api, read-only) — close them in the state file only if GitHub confirms. Report remaining alerts.`, { label: 'triage-state', phase: 'P8 Cleanup', model: 'sonnet', effort: 'low', schema: CHECK }),
    () => agent(`${CTX}\nWrite ${REPO}/.plans/shibumi-upstream-notes.md: which TSX partials, Alpine module patterns, CSS-scoping conventions, and visual-test patterns from this migration are worth separate upstream Shibumi PRs, with file references. MCPVault must not depend on those landing.`, { label: 'upstream-notes', phase: 'P8 Cleanup', effort: 'medium' }),
  ])
  const g = await gate('Phase 8', { cleanup, docs, triage, upstream })
  return { phase: 'p8', cleanup, docs, triage, upstream, gate: g }
}

return { error: `Unknown phase "${ph}". Use p0..p8.` }
