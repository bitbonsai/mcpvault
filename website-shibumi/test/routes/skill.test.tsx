/**
 * Route assertions for `GET /skill/` (Phase 2, group 6 -- "skill").
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
  publicDir = await mkdtemp(join(tmpdir(), "shibumi-skill-test-"));
  await writeFile(join(publicDir, "skill.md"), "# Obsidian Skill\n\nMarkdown counterpart fixture.\n");
  app = createApp({ publicDir });
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

describe("GET /skill/ (HTML)", () => {
  test("responds 200 text/html", async () => {
    const res = await app.request("/skill/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("renders the shared shell around the page", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain('data-component="nav"');
    expect(body).toContain('data-component="footer"');
    expect(body).toContain('data-page="skill"');
  });

  test("sets page-specific title, description, and canonical", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain("<title>Skill | MCPVault</title>");
    expect(body).toContain('content="Install an Obsidian skill that routes file operations to MCPVault, app actions to Obsidian CLI, and sync tasks to Git."');
    expect(body).toContain('<link rel="canonical" href="https://mcpvault.org/skill/"/>');
  });

  test("loads the page-specific stylesheet after the shared one", async () => {
    const body = await (await app.request("/skill/")).text();
    const sharedIndex = body.indexOf('href="/styles/shared.css"');
    const pageIndex = body.indexOf('href="/styles/skill.css"');
    expect(sharedIndex).toBeGreaterThan(-1);
    expect(pageIndex).toBeGreaterThan(sharedIndex);
  });

  test("renders the hero, install command, and mini feature cards", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain('data-component="skill-content"');
    expect(body).toContain("Obsidian Skill");
    expect(body).toContain("npx skills add bitbonsai/mcpvault");
    expect(body).toContain("Search notes");
    expect(body).toContain("Run Git sync");
  });

  test("renders the copy button with a data-copy hook and no inline script", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain('data-copy="npx skills add bitbonsai/mcpvault"');
    expect(body).toContain("copy-btn");
    expect(body).not.toContain("astro:page-load");
  });

  test("renders every Routing Matrix row with checkmarks and dashes", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain("Routing Matrix");
    expect(body).toContain("Read note");
    expect(body).toContain("Resolve [[wiki links]]");
    expect(body).toContain("Automated backup");
    expect(body).toContain("skill-routing-check");
    expect(body).toContain("skill-routing-dash");
  });

  test("renders the Flow Cheat Sheet, expandable playbook, and example conversation", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain("Flow Cheat Sheet");
    expect(body).toContain("Expanded Flow Playbook");
    expect(body).toContain("Safe note rename flow");
    expect(body).toContain("https://github.com/bitbonsai/mcpvault/issues/176");
    expect(body).toContain("Vault synced to origin/main. No force push used.");
  });

  test("renders What It Is, Git-Based Vault Sync, and the recommended .gitignore", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain("What It Is");
    expect(body).toContain("Git-Based Vault Sync");
    expect(body).toContain(".obsidian/workspace.json");
    expect(body).toContain("Obsidian Git");
  });

  test("renders When To Use, Workflow Patterns, and Safety Defaults", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain("When To Use");
    expect(body).toContain("search my vault for...");
    expect(body).toContain("Not a fit for");
    expect(body).toContain("Workflow Patterns");
    expect(body).toContain("Search, then open");
    expect(body).toContain("Safety Defaults");
    expect(body).toContain("Structured command arguments");
  });

  test("renders Quick Start with the SKILL.md frontmatter sample and installation CTA", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain("Quick Start");
    expect(body).toContain("name: obsidian");
    expect(body).toContain('href="/install/"');
    expect(body).toContain("Installation");
  });

  test("renders the injected package version in the structured data", async () => {
    const body = await (await app.request("/skill/")).text();
    expect(body).toContain(`"softwareVersion":"${packageVersion}"`);
  });
});

describe("GET /skill/ (Markdown negotiation)", () => {
  test("Accept: text/markdown without text/html serves the Markdown counterpart", async () => {
    const res = await app.request("/skill/", { headers: { accept: "text/markdown" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(await res.text()).toContain("Markdown counterpart fixture.");
  });

  test("a normal browser Accept header still gets the rendered page", async () => {
    const res = await app.request("/skill/", {
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("falls back to the HTML page when skill.md is missing", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "shibumi-skill-empty-"));
    const emptyApp = createApp({ publicDir: emptyDir });
    const res = await emptyApp.request("/skill/", { headers: { accept: "text/markdown" } });
    expect(res.headers.get("content-type")).toContain("text/html");
    await rm(emptyDir, { recursive: true, force: true });
  });
});

describe("GET /styles/skill.css", () => {
  test("serves the page stylesheet with a CSS content type", async () => {
    const res = await app.request("/styles/skill.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    const body = await res.text();
    expect(body).toContain('[data-component="skill-content"]');
  });
});

describe("GET /skill (no trailing slash)", () => {
  test("301s to the trailing-slash form", async () => {
    const res = await app.request("/skill", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toContain("/skill/");
  });
});

describe("GET /skill/ (unsupported method)", () => {
  test("POST is not treated as a page route", async () => {
    const res = await app.request("/skill/", { method: "POST" });
    expect(res.status).toBe(404);
  });
});
