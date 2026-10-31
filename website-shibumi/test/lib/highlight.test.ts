/**
 * `highlight.ts` caching (Phase 2 review): every call site passes one of a
 * small, fixed set of build-time-known literal (lang, code) pairs, so
 * `highlightCode()` must run Shiki's `codeToHtml()` at most once per unique
 * pair, not once per request.
 *
 * Asserted via Promise identity rather than mocking `shiki` module-wide:
 * `mock.module("shiki", ...)` would leak into every other test file in this
 * same `bun test` process (module mocks are process-global, not scoped to
 * this file), breaking the real Shiki-highlighted assertions in
 * `install.test.tsx`/`features.test.tsx`/`how-it-works.test.tsx`. Caching
 * means a second call for the same (lang, code) never creates a new
 * `codeToHtml()` call, which shows up directly as returning the exact same
 * Promise reference the first call returned.
 */
import { describe, expect, test } from "bun:test";
import { highlightCode } from "../../src/lib/highlight";

describe("highlightCode", () => {
  test("returns the same Promise reference for a repeated (lang, code) pair", () => {
    const first = highlightCode('{"cached":1}', "json");
    const second = highlightCode('{"cached":1}', "json");
    expect(second).toBe(first);
  });

  test("both calls still resolve to the same rendered HTML", async () => {
    const first = await highlightCode('{"resolved":true}', "json");
    const second = await highlightCode('{"resolved":true}', "json");
    expect(second).toBe(first);
    expect(first).toContain("resolved");
  });

  test("does not cache across different lang or code inputs", () => {
    const jsonA = highlightCode('{"a":1}', "json");
    const jsonB = highlightCode('{"a":2}', "json");
    const tsA = highlightCode('{"a":1}', "ts");
    expect(jsonA).not.toBe(jsonB);
    expect(jsonA).not.toBe(tsA);
  });

  test("concurrent calls for the same input share the in-flight Promise", () => {
    const [a, b] = [highlightCode('{"concurrent":true}', "json"), highlightCode('{"concurrent":true}', "json")];
    expect(a).toBe(b);
  });
});
