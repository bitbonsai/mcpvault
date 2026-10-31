/**
 * Route assertions for `GET /features/` (Phase 2, group 3 -- "features").
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
  publicDir = await mkdtemp(join(tmpdir(), "shibumi-features-test-"));
  await writeFile(join(publicDir, "features.md"), "# MCPVault Features\n\nMarkdown counterpart fixture.\n");
  app = createApp({ publicDir });
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

describe("GET /features/ (HTML)", () => {
  test("responds 200 text/html", async () => {
    const res = await app.request("/features/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("renders the shared shell around the page", async () => {
    const body = await (await app.request("/features/")).text();
    expect(body).toContain('data-component="nav"');
    expect(body).toContain('data-component="footer"');
    expect(body).toContain('data-page="features"');
  });

  test("sets page-specific title, description, and canonical", async () => {
    const body = await (await app.request("/features/")).text();
    expect(body).toContain("<title>Features | MCPVault</title>");
    expect(body).toContain('content="Review MCPVault search, frontmatter, file tools, path restrictions, supported clients, and access methods."');
    expect(body).toContain('<link rel="canonical" href="https://mcpvault.org/features/"/>');
  });

  test("loads the page-specific stylesheet after the shared one", async () => {
    const body = await (await app.request("/features/")).text();
    const sharedIndex = body.indexOf('href="/styles/shared.css"');
    const featuresIndex = body.indexOf('href="/styles/features.css"');
    expect(sharedIndex).toBeGreaterThan(-1);
    expect(featuresIndex).toBeGreaterThan(sharedIndex);
  });

  test("renders FeatureGrid with all ten cards and the highlighted code sample", async () => {
    const body = await (await app.request("/features/")).text();
    expect(body).toContain('data-component="feature-grid"');
    expect(body).toContain("Core features");
    expect(body).toContain("Full-text search");
    expect(body).toContain("MCP client support");
    // Server-side Shiki highlighting, not react-syntax-highlighter.
    expect(body).toContain('class="shiki');
    expect(body).toContain("Notes/GTD.md");
  });

  test("renders ComparisonTable with every feature row and the CTA links", async () => {
    const body = await (await app.request("/features/")).text();
    expect(body).toContain('data-component="comparison-table"');
    expect(body).toContain("Compare access methods");
    expect(body).toContain("Frontmatter updates");
    expect(body).toContain("Access boundary");
    expect(body).toContain('href="/install/"');
    expect(body).toContain('href="https://github.com/bitbonsai/mcpvault"');
  });

  test("renders FAQ with every question as a no-JS <details> disclosure", async () => {
    const body = await (await app.request("/features/")).text();
    expect(body).toContain('data-component="faq"');
    expect(body).toContain("<details");
    expect(body).toContain("Does my data leave my computer?");
    expect(body).toContain("What if the AI makes a mistake?");
  });

  test("renders the injected package version in the structured data", async () => {
    const body = await (await app.request("/features/")).text();
    expect(body).toContain(`"softwareVersion":"${packageVersion}"`);
  });
});

describe("GET /features/ (Markdown negotiation)", () => {
  test("Accept: text/markdown without text/html serves the Markdown counterpart", async () => {
    const res = await app.request("/features/", { headers: { accept: "text/markdown" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(await res.text()).toContain("Markdown counterpart fixture.");
  });

  test("a normal browser Accept header still gets the rendered page", async () => {
    const res = await app.request("/features/", {
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("falls back to the HTML page when features.md is missing", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "shibumi-features-empty-"));
    const emptyApp = createApp({ publicDir: emptyDir });
    const res = await emptyApp.request("/features/", { headers: { accept: "text/markdown" } });
    expect(res.headers.get("content-type")).toContain("text/html");
    await rm(emptyDir, { recursive: true, force: true });
  });
});

describe("GET /styles/features.css", () => {
  test("serves the page stylesheet with a CSS content type", async () => {
    const res = await app.request("/styles/features.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    const body = await res.text();
    expect(body).toContain('[data-component="feature-grid"]');
    expect(body).toContain('[data-component="comparison-table"]');
    expect(body).toContain('[data-component="faq"]');
  });
});

describe("GET /features (no trailing slash)", () => {
  test("is not silently served as the features page", async () => {
    const res = await app.request("/features");
    // Phase 4 owns the redirect middleware; for now this must not be a
    // second, divergent way to reach the same content without one.
    expect(res.status).not.toBe(200);
  });
});
