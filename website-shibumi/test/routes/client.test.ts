/**
 * Route assertions for `GET /client/alpine.js` (Phase 3 step 1). Confirms
 * the bundle actually contains Alpine's own source (i.e. it isn't a stub
 * or an empty file), never references a CDN, and serves with a JS content
 * type -- the parts of "vendor Alpine locally" this app controls without a
 * real browser.
 */
import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";

const app = createApp();

describe("GET /client/alpine.js", () => {
  test("responds 200 with a JavaScript content type", async () => {
    const res = await app.request("/client/alpine.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  });

  test("sets a public cache-control header", async () => {
    const res = await app.request("/client/alpine.js");
    expect(res.headers.get("cache-control")).toContain("public");
  });

  test("bundles Alpine's own source in, loading no CDN script at runtime", async () => {
    const body = await (await app.request("/client/alpine.js")).text();
    expect(body.length).toBeGreaterThan(1000);
    expect(body).not.toContain("unpkg.com");
    expect(body).not.toContain("jsdelivr.net");
    expect(body).not.toContain("cdn.jsdelivr");
  });

  test("registers the interactiveDemo module and starts Alpine", async () => {
    const body = await (await app.request("/client/alpine.js")).text();
    expect(body).toContain("interactiveDemo");
  });

  test("registers the nav, newsletterSignup, and terminal modules (Phase 3)", async () => {
    const body = await (await app.request("/client/alpine.js")).text();
    // Minified output renames local identifiers, but Alpine.data()'s string
    // keys survive minification unchanged.
    expect(body).toContain('"nav"');
    expect(body).toContain('"newsletterSignup"');
    expect(body).toContain('"terminal"');
  });

  test("caches the bundle across requests (identical bytes, no rebuild)", async () => {
    const first = await (await app.request("/client/alpine.js")).text();
    const second = await (await app.request("/client/alpine.js")).text();
    expect(second).toBe(first);
  });

  test("POST is not treated as a page route", async () => {
    const res = await app.request("/client/alpine.js", { method: "POST" });
    expect(res.status).toBe(404);
  });
});
