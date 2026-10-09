/**
 * Content-Security-Policy for every response.
 *
 * `hono/secure-headers` defaults emit NO CSP header at all, so without this
 * module the `@alpinejs/csp` build's whole point -- shipping without
 * `'unsafe-eval'` -- was unenforced. This policy is strict: no
 * `'unsafe-eval'`, no wildcard sources, and every third-party origin the
 * pages actually use is listed explicitly.
 *
 * Inline `<script>` accounting (script-src):
 * - The font-loader one-liner in `Layout.tsx` is allowed by SHA-256 hash.
 *   The script source is exported from here as `FONT_LOADER_SCRIPT` and
 *   imported by the layout, so the markup and the hash in the header can
 *   never drift apart.
 * - The JSON-LD `<script type="application/ld+json">` is a data block:
 *   per CSP3 it is never fetched or executed, so script-src does not apply
 *   to it. Its hash is still included belt-and-braces (computed from the
 *   same `structuredDataJson(packageVersion)` the layout renders), so even
 *   a browser that mis-applied script-src to data blocks would not break
 *   structured data.
 *
 * Third-party origins:
 * - script-src  https://cdn.counter.dev       Counter.dev analytics script
 * - script-src  https://challenges.cloudflare.com  Turnstile widget
 * - frame-src   https://challenges.cloudflare.com  Turnstile challenge frame
 * - connect-src https://t.counter.dev         Counter.dev beacon/fetch target
 * - style-src   https://fonts.googleapis.com  Google Fonts stylesheet
 * - font-src    https://fonts.gstatic.com     Google Fonts font files
 * - img-src     https://img.shields.io        Hero/footer badges
 *
 * img-src also needs `data:` for the inline-SVG noise texture in
 * `shared.css` (`url("data:image/svg+xml,...")`).
 *
 * Inline `style="..."` attributes exist in server markup (html element
 * background, terminal ANSI spans, typing-dot animation delays), so
 * style-src-attr allows 'unsafe-inline' while style-src-elem stays strict
 * (no inline <style> elements anywhere). The plain style-src fallback keeps
 * 'unsafe-inline' so browsers without the elem/attr split render correctly;
 * modern browsers use the stricter elem/attr directives instead. CSS
 * injection via attributes is a far smaller risk class than script eval,
 * and no request data is ever rendered into a style attribute.
 *
 * frame-ancestors 'self' deliberately matches the X-Frame-Options:
 * SAMEORIGIN default that secure-headers already emits.
 */
import { createHash } from "node:crypto";
import { packageVersion } from "./version";

/**
 * The inline font-loader script rendered by `Layout.tsx`. It flips the
 * Google Fonts stylesheet from media="print" to media="all" once parsed
 * (async CSS loading trick). Must stay byte-identical to the hash below.
 */
export const FONT_LOADER_SCRIPT = "document.getElementById('jetbrains-font').media = 'all';";

/** schema.org SoftwareApplication structured data, rendered as JSON-LD by the layout. */
export function structuredData(version: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MCPVault",
    description: "Local MCP server for reading, searching, and editing notes in an Obsidian vault.",
    url: "https://mcpvault.org/",
    downloadUrl: "https://www.npmjs.com/package/@bitbonsai/mcpvault",
    softwareVersion: version,
    operatingSystem: ["macOS", "Windows", "Linux"],
    applicationCategory: "DeveloperApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "bitbonsai",
      url: "https://github.com/bitbonsai",
    },
    maintainer: {
      "@type": "Organization",
      name: "bitbonsai",
      url: "https://github.com/bitbonsai",
    },
    codeRepository: "https://github.com/bitbonsai/mcpvault",
  };
}

/** Serialized JSON-LD body with `<` escaped so `</script>` can never break out. */
export function structuredDataJson(version: string): string {
  return JSON.stringify(structuredData(version)).replace(/</g, "\\u003c");
}

/** CSP source expression for an inline script body: 'sha256-<base64>'. */
export function scriptHash(source: string): string {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

export const contentSecurityPolicy = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    scriptHash(FONT_LOADER_SCRIPT),
    scriptHash(structuredDataJson(packageVersion)),
    "https://cdn.counter.dev",
    "https://challenges.cloudflare.com",
  ],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  styleSrcElem: ["'self'", "https://fonts.googleapis.com"],
  styleSrcAttr: ["'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https://img.shields.io"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  mediaSrc: ["'self'"],
  connectSrc: ["'self'", "https://t.counter.dev"],
  frameSrc: ["https://challenges.cloudflare.com"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
};
