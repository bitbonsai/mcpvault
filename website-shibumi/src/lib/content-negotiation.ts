/**
 * Minimal Accept-header negotiation for the Markdown/HTML dual
 * representation described in the migration plan: HTML is the browser
 * default, and `Accept: text/markdown` may return the matching Markdown
 * source where available.
 *
 * Deliberately simple rather than a full RFC 9110 q-value parser: real
 * browsers always send `text/html` (explicitly, or via the wildcard
 * "any type" range that follows it), so checking for an explicit
 * `text/markdown` preference without `text/html` present is enough to
 * separate "a browser navigated here" from "a markdown-aware client (curl,
 * an LLM tool, `Accept: text/markdown`) requested this page" -- without
 * misclassifying a bare wildcard accept header.
 */
export function prefersMarkdown(acceptHeader: string | null | undefined): boolean {
  if (!acceptHeader) return false;
  const accept = acceptHeader.toLowerCase();
  return accept.includes("text/markdown") && !accept.includes("text/html");
}
