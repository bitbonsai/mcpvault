/**
 * Shared page shell. Ported from Layout.astro.
 *
 * Scope for this group (Phase 2, group 1 -- "shared shell"): markup, head
 * metadata, canonical/OG/structured-data, skip link, and the background
 * watermark. Deliberately NOT ported here (later phases):
 *  - The old vanilla theme-init/mobile-menu/scroll-animation `<script>` --
 *    Phase 3 replaces it with named Alpine.data() modules per the plan.
 *
 * Native cross-document View Transitions (`@view-transition { navigation:
 * auto; }`, Phase 3 item 3) are NOT Astro's `<ClientRouter />` / SPA router --
 * plain multi-page navigation stays, the browser just animates the swap.
 * Declared once in `shared.css` (loaded on every page) rather than here,
 * since it's a pure CSS at-rule with no markup/head tag of its own.
 *  - `.terminal-window` styles -- those belong to the Install page/group,
 *    not the shell, even though Layout.astro carried them globally.
 *
 * `clientScript` (added Phase 3 step 1) stays an explicit per-page prop
 * rather than an unconditional shell-wide `<script>`, so a page can still
 * ship zero client JS by simply omitting it -- but every page currently in
 * the router passes `"/client/alpine.js"`, since `Nav`'s mobile menu alone
 * (present on every page) now names an Alpine.data() module.
 *
 * Raw-HTML audit: the only non-escaped output below is the JSON-LD
 * `<script>` body. Hono's JSX renderer HTML-escapes every string child
 * (there is no special case for `<script>`/`<style>` tags), so a plain
 * string child here would corrupt the JSON (e.g. turn `"` into `&quot;`,
 * which browsers do NOT decode back inside `<script>` text). We build the
 * JSON ourselves, escape `<` to prevent a `</script>` breakout, and mark it
 * with `raw()` -- safe because the input is fully server-controlled (no
 * request data), never user input.
 *
 * Shell-review carry-over: the Counter.dev analytics `<script>` from
 * Layout.astro (lines 497-498) was silently dropped in the first port of
 * this file. It carries no request/user data (fixed `src`/`data-id`), so a
 * plain JSX attribute is fine -- no raw() needed.
 */
import { raw } from "hono/html";
import { BackgroundWatermark } from "../components/BackgroundWatermark";
import { FONT_LOADER_SCRIPT, structuredDataJson } from "../lib/csp";
import { packageVersion } from "../lib/version";

const SITE_URL = "https://mcpvault.org";
const DEFAULT_TITLE = "MCPVault - MCP Server for Obsidian Vaults";
const DEFAULT_DESCRIPTION =
  "Run MCPVault locally to let MCP-compatible assistants read, search, and edit notes in an Obsidian vault.";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

export interface LayoutProps {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  /** Sets `data-page` on <body> so page CSS can scope under it. */
  page?: string;
  /** Extra stylesheet for this route, e.g. "/styles/home.css". */
  pageStylesheet?: string;
  /** Bundled Alpine client script for this route, e.g. "/client/alpine.js". Omitted on pages with no client-side interactivity yet. */
  clientScript?: string;
  version?: string;
  children?: unknown;
}

export function Layout({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION, image = DEFAULT_IMAGE, canonical = `${SITE_URL}/`, page, pageStylesheet, clientScript, version = packageVersion, children }: LayoutProps) {
  const fullTitle = title.includes("MCPVault") ? title : `${title} | MCPVault`;
  // Built by lib/csp.ts so the CSP header's belt-and-braces hash is computed
  // from the exact same serialization this layout renders.
  const jsonLd = structuredDataJson(version);

  return (
    <>
      {raw("<!doctype html>")}
      <html lang="en" class="dark" style="background-color: #0a0a0a;">
        <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <title>{fullTitle}</title>
        <meta name="title" content={fullTitle} />
        <meta name="description" content={description} />

        <link rel="canonical" href={canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={image} />
        <meta property="og:site_name" content="MCPVault" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={canonical} />
        <meta property="twitter:title" content={fullTitle} />
        <meta property="twitter:description" content={description} />
        <meta property="twitter:image" content={image} />
        <meta property="twitter:creator" content="@mauriciowolff" />

        <meta
          name="keywords"
          content="obsidian, mcp, ai, claude, chatgpt, model context protocol, knowledge management, pkm, vault, notes, markdown, mcp server, ai assistant"
        />
        <meta name="author" content="Mauricio Wolff (bitbonsai)" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />

        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="color-scheme" content="dark" />

        <link rel="preload" href="/video-poster-small.webp" as="image" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link id="jetbrains-font" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&display=swap" rel="stylesheet" media="print" />
        <noscript>
          <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&display=swap" rel="stylesheet" />
        </noscript>
        {/*
          Raw-HTML audit: this string contains `'`, which Hono's JSX escaper
          converts to `&#39;` like any other text child. Browsers do NOT
          decode HTML entities inside <script> text, so an escaped version
          would run as broken JS (`document.getElementById(&#39;...&#39;)`).
          `raw()` is safe here: the string is a fixed literal, not user input.
        */}
        <script>{raw(FONT_LOADER_SCRIPT)}</script>

        <link rel="stylesheet" href="/styles/shared.css" />
        {pageStylesheet ? <link rel="stylesheet" href={pageStylesheet} /> : null}

        <script type="application/ld+json">{raw(jsonLd)}</script>
      </head>
      <body data-page={page}>
        <a href="#main-content" data-component="skip-link">
          Skip to content
        </a>

        <BackgroundWatermark />

        <div data-component="app-shell">{children}</div>

        {clientScript ? <script type="module" src={clientScript}></script> : null}

        <script defer src="https://cdn.counter.dev/script.js" data-id="56795b69-4872-4bfc-a640-4c0a9de06db8" data-utcoffset="1"></script>
      </body>
      </html>
    </>
  );
}

