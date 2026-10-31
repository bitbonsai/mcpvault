import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/app";

let stylesDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  stylesDir = await mkdtemp(join(tmpdir(), "shibumi-styles-test-"));
  await writeFile(join(stylesDir, "shared.css"), '[data-component="nav"] { display: flex; }\n');
  app = createApp({ stylesDir });
});

afterAll(async () => {
  await rm(stylesDir, { recursive: true, force: true });
});

describe("GET /styles/*", () => {
  test("serves a stylesheet with an explicit CSS content type", async () => {
    const res = await app.request("/styles/shared.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(await res.text()).toContain('[data-component="nav"]');
  });

  test("missing stylesheet falls through to 404, not the public dir", async () => {
    const res = await app.request("/styles/does-not-exist.css");
    expect(res.status).toBe(404);
  });

  test("rejects path traversal out of stylesDir", async () => {
    const res = await app.request("/styles/%2e%2e/%2e%2e/etc/passwd");
    expect([400, 404]).toContain(res.status);
  });
});

describe("shared.css and home.css (shell-review carry-overs)", () => {
  const realApp = createApp();

  test("footer gutters are responsive (px-4 sm:px-6 lg:px-8), not a fixed 1rem", async () => {
    const body = await (await realApp.request("/styles/shared.css")).text();
    const footerBlock = body.slice(body.indexOf('[data-component="footer"] {'));
    expect(footerBlock).toContain("padding: 4rem 1rem;");
    expect(body).toContain("@media (min-width: 640px)");
    expect(body).toContain("@media (min-width: 1024px)");
  });

  test("body overflow-x: hidden is not a global rule", async () => {
    const body = await (await realApp.request("/styles/shared.css")).text();
    const bodyBlock = body.slice(body.indexOf("body {"), body.indexOf("body {") + body.slice(body.indexOf("body {")).indexOf("}"));
    expect(bodyBlock).not.toContain("overflow-x");
  });

  test("home.css scopes overflow-x: hidden to the home page only", async () => {
    const body = await (await realApp.request("/styles/home.css")).text();
    expect(body).toContain('[data-page="home"] {');
    const pageBlock = body.slice(body.indexOf('[data-page="home"] {'));
    expect(pageBlock).toContain("overflow-x: hidden;");
  });

  test("shared.css opts into native cross-document View Transitions, gated behind a reduced-motion fallback", async () => {
    const body = await (await realApp.request("/styles/shared.css")).text();
    expect(body).toContain("@media not (prefers-reduced-motion: reduce)");
    const mediaBlock = body.slice(body.indexOf("@media not (prefers-reduced-motion: reduce)"));
    expect(mediaBlock).toContain("@view-transition");
    expect(mediaBlock).toContain("navigation: auto;");
  });
});
