/**
 * Route assertions for `GET /` (Phase 2, group 2 -- "home").
 *
 * Uses the real `createApp()` factory (not a throwaway Hono instance like
 * shell.test.tsx) so the Markdown-negotiation branch, static-file fallback,
 * and CSS route are all exercised the way a real request would hit them.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/app";
import { packageVersion } from "../../src/lib/version";

let publicDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  publicDir = await mkdtemp(join(tmpdir(), "shibumi-home-test-"));
  await writeFile(join(publicDir, "index.md"), "# MCPVault\n\nMarkdown counterpart fixture.\n");
  app = createApp({ publicDir });
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

describe("GET / (HTML)", () => {
  test("responds 200 text/html", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("renders the shared shell around the page", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain('data-component="nav"');
    expect(body).toContain('data-component="footer"');
    expect(body).toContain('data-page="home"');
  });

  test("loads the page-specific stylesheet after the shared one", async () => {
    const body = await (await app.request("/")).text();
    const sharedIndex = body.indexOf('href="/styles/shared.css"');
    const homeIndex = body.indexOf('href="/styles/home.css"');
    expect(sharedIndex).toBeGreaterThan(-1);
    expect(homeIndex).toBeGreaterThan(sharedIndex);
  });

  test("renders Hero with the injected version and the fixed npm downloads link", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain(`v${packageVersion}`);
    expect(body).toContain("AI + Obsidian =");
    expect(body).toContain("Connect MCP clients to your Obsidian vault.");
    // Phase 0 content fix: the downloads badge anchor must point at the
    // scoped package, not the nonexistent unscoped `mcpvault` package.
    const npmDownloadsAnchor = body.indexOf('alt="npm downloads"');
    const precedingMarkup = body.slice(0, npmDownloadsAnchor);
    const anchorStart = precedingMarkup.lastIndexOf("<a ");
    expect(body.slice(anchorStart, npmDownloadsAnchor)).toContain('href="https://www.npmjs.com/package/@bitbonsai/mcpvault"');
  });

  test("renders SpecPreviewCallout, UpdateCallout, and NewsletterSignup", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain('data-component="spec-preview-callout"');
    expect(body).toContain("MCP v2");
    expect(body).toContain('data-component="update-callout"');
    expect(body).toContain("Recent updates");
    expect(body).toContain('data-component="newsletter-signup"');
    expect(body).toContain('action="/api/subscribe"');
  });

  test("newsletter form degrades to a real POST with no JavaScript", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain('method="post" action="/api/subscribe"');
    expect(body).toContain('name="website"');
  });
});

describe("GET / (Alpine interactivity, Phase 3)", () => {
  test("loads the bundled Alpine client script", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain('<script type="module" src="/client/alpine.js">');
  });

  test("names the nav module and mobile menu wiring", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain('x-data="nav"');
    expect(body).toContain('x-on:click="toggle()"');
    expect(body).toContain('x-bind:hidden="!open"');
  });

  test("names the newsletterSignup module and binds the email field/submit handler", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain('x-data="newsletterSignup"');
    expect(body).toContain('x-model="email"');
    expect(body).toContain('x-model="website"');
    expect(body).toContain('submit()');
  });

  test("still keeps the no-JS form action/method for the newsletter form", async () => {
    const body = await (await app.request("/")).text();
    expect(body).toContain('method="post" action="/api/subscribe"');
  });
});

describe("GET / (Markdown negotiation)", () => {
  test("Accept: text/markdown without text/html serves the Markdown counterpart", async () => {
    const res = await app.request("/", { headers: { accept: "text/markdown" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(await res.text()).toContain("Markdown counterpart fixture.");
  });

  test("a normal browser Accept header still gets the rendered page", async () => {
    const res = await app.request("/", {
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("falls back to the HTML page when index.md is missing", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "shibumi-home-empty-"));
    const emptyApp = createApp({ publicDir: emptyDir });
    const res = await emptyApp.request("/", { headers: { accept: "text/markdown" } });
    expect(res.headers.get("content-type")).toContain("text/html");
    await rm(emptyDir, { recursive: true, force: true });
  });
});

describe("GET /styles/home.css", () => {
  test("serves the page stylesheet with a CSS content type", async () => {
    const res = await app.request("/styles/home.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    const body = await res.text();
    expect(body).toContain('[data-component="hero"]');
    expect(body).toContain('[data-page="home"]');
  });
});
