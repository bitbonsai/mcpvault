/**
 * Route assertions for `GET /how-it-works/` (Phase 2, group 5 --
 * "how-it-works").
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
  publicDir = await mkdtemp(join(tmpdir(), "shibumi-how-it-works-test-"));
  await writeFile(join(publicDir, "how-it-works.md"), "# How MCPVault Works\n\nMarkdown counterpart fixture.\n");
  app = createApp({ publicDir });
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

describe("GET /how-it-works/ (HTML)", () => {
  test("responds 200 text/html", async () => {
    const res = await app.request("/how-it-works/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("renders the shared shell around the page", async () => {
    const body = await (await app.request("/how-it-works/")).text();
    expect(body).toContain('data-component="nav"');
    expect(body).toContain('data-component="footer"');
    expect(body).toContain('data-page="how-it-works"');
  });

  test("sets page-specific title, description, and canonical", async () => {
    const body = await (await app.request("/how-it-works/")).text();
    expect(body).toContain("<title>How It Works | MCPVault</title>");
    expect(body).toContain('content="Follow MCPVault search, batch read, and frontmatter update requests from prompt to tool response."');
    expect(body).toContain('<link rel="canonical" href="https://mcpvault.org/how-it-works/"/>');
  });

  test("loads the page-specific stylesheet after the shared one", async () => {
    const body = await (await app.request("/how-it-works/")).text();
    const sharedIndex = body.indexOf('href="/styles/shared.css"');
    const pageIndex = body.indexOf('href="/styles/how-it-works.css"');
    expect(sharedIndex).toBeGreaterThan(-1);
    expect(pageIndex).toBeGreaterThan(sharedIndex);
  });

  test("renders both usage examples with their prompts, tags, and descriptions", async () => {
    const body = await (await app.request("/how-it-works/")).text();
    expect(body).toContain('data-component="how-it-works"');
    expect(body).toContain("Usage examples");
    expect(body).toContain("Search &amp; Read Notes");
    expect(body).toContain("Find my productivity notes and summarize the key concepts");
    expect(body).toContain("Update Metadata");
    expect(body).toContain("Mark all my project notes as completed");
    expect(body).toContain("Batch update frontmatter across multiple notes");
  });

  test("highlights JSON response segments server-side, not via react-syntax-highlighter", async () => {
    const body = await (await app.request("/how-it-works/")).text();
    expect(body).toContain('class="shiki');
    expect(body).toContain("Getting Things Done.md");
    expect(body).toContain("status");
    expect(body).toContain("completed");
  });

  test("renders the installation CTA linking to /install", async () => {
    const body = await (await app.request("/how-it-works/")).text();
    expect(body).toContain("What these examples cover");
    expect(body).toContain('href="/install/"');
    expect(body).toContain("Installation");
  });

  test("renders the injected package version in the structured data", async () => {
    const body = await (await app.request("/how-it-works/")).text();
    expect(body).toContain(`"softwareVersion":"${packageVersion}"`);
  });
});

describe("GET /how-it-works/ (Markdown negotiation)", () => {
  test("Accept: text/markdown without text/html serves the Markdown counterpart", async () => {
    const res = await app.request("/how-it-works/", { headers: { accept: "text/markdown" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(await res.text()).toContain("Markdown counterpart fixture.");
  });

  test("a normal browser Accept header still gets the rendered page", async () => {
    const res = await app.request("/how-it-works/", {
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("falls back to the HTML page when how-it-works.md is missing", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "shibumi-how-it-works-empty-"));
    const emptyApp = createApp({ publicDir: emptyDir });
    const res = await emptyApp.request("/how-it-works/", { headers: { accept: "text/markdown" } });
    expect(res.headers.get("content-type")).toContain("text/html");
    await rm(emptyDir, { recursive: true, force: true });
  });
});

describe("GET /styles/how-it-works.css", () => {
  test("serves the page stylesheet with a CSS content type", async () => {
    const res = await app.request("/styles/how-it-works.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    const body = await res.text();
    expect(body).toContain('[data-component="how-it-works"]');
  });
});

describe("GET /how-it-works (no trailing slash)", () => {
  test("is not silently served as the how-it-works page", async () => {
    const res = await app.request("/how-it-works");
    // Phase 4 owns the redirect middleware; for now this must not be a
    // second, divergent way to reach the same content without one.
    expect(res.status).not.toBe(200);
  });
});

describe("GET /how-it-works/ (unsupported method)", () => {
  test("POST is not treated as a page route", async () => {
    const res = await app.request("/how-it-works/", { method: "POST" });
    expect(res.status).toBe(404);
  });
});
