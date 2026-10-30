/**
 * Route assertions for `GET /install/` (Phase 2, group 4 -- "install").
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
  publicDir = await mkdtemp(join(tmpdir(), "shibumi-install-test-"));
  await writeFile(join(publicDir, "install.md"), "# Install MCPVault\n\nMarkdown counterpart fixture.\n");
  app = createApp({ publicDir });
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

describe("GET /install/ (HTML)", () => {
  test("responds 200 text/html", async () => {
    const res = await app.request("/install/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("renders the shared shell around the page", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('data-component="nav"');
    expect(body).toContain('data-component="footer"');
    expect(body).toContain('data-page="install"');
  });

  test("sets page-specific title, description, and canonical", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain("<title>Install | MCPVault</title>");
    expect(body).toContain('content="Configuration examples for running MCPVault with Claude Desktop, ChatGPT+, Claude Code, Gemini CLI, OpenCode, and OpenAI Codex."');
    expect(body).toContain('<link rel="canonical" href="https://mcpvault.org/install/"/>');
  });

  test("loads the page-specific stylesheet after the shared one", async () => {
    const body = await (await app.request("/install/")).text();
    const sharedIndex = body.indexOf('href="/styles/shared.css"');
    const installIndex = body.indexOf('href="/styles/install.css"');
    expect(sharedIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(sharedIndex);
  });

  test("renders the Terminal section with every platform tab", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('data-component="terminal"');
    expect(body).toContain("Install MCPVault");
    expect(body).toContain('data-tab="standard"');
    expect(body).toContain('data-tab="claude-code"');
    expect(body).toContain('data-tab="gemini-cli"');
    expect(body).toContain('data-tab="opencode"');
    expect(body).toContain('data-tab="codex"');
    expect(body).toContain("Default exclusions:");
    expect(body).toContain("--exclude &lt;subtree&gt;");
  });

  test("keeps the Node.js minimum aligned in HTML and Markdown", async () => {
    const body = await (await app.request("/install/")).text();
    const markdown = await Bun.file(new URL("../../public/install.md", import.meta.url)).text();
    for (const content of [body, markdown]) {
      expect(content).toContain("Requires Node.js 22.12.0 or later.");
    }
  });

  test("renders server-side highlighted JSON config samples, not react-syntax-highlighter", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('class="shiki');
    expect(body).toContain("@bitbonsai/mcpvault@latest");
  });

  test("only the standard config panel is visible without JavaScript", async () => {
    const body = await (await app.request("/install/")).text();
    const standardIndex = body.indexOf('data-content="standard"');
    const claudeCodeIndex = body.indexOf('data-content="claude-code"');
    expect(standardIndex).toBeGreaterThan(-1);
    expect(claudeCodeIndex).toBeGreaterThan(-1);
    // Check the static `class` attribute specifically, not the whole opening
    // tag: Phase 3's `x-bind:class="{ hidden: activeTab !== '...' }"` also
    // contains the substring "hidden" (Alpine's own gating expression), on
    // every panel including "standard" -- that's the no-JS-safe default
    // (Alpine never runs), not a visible class.
    const standardTagEnd = body.indexOf(">", standardIndex);
    const standardTag = body.slice(body.lastIndexOf("<div", standardIndex), standardTagEnd);
    expect(standardTag).toMatch(/class="config-content"/);
    // ...but every other config panel's static class does.
    const claudeCodeTagEnd = body.indexOf(">", claudeCodeIndex);
    const claudeCodeTag = body.slice(body.lastIndexOf("<div", claudeCodeIndex), claudeCodeTagEnd);
    expect(claudeCodeTag).toMatch(/class="config-content hidden"/);
  });

  test("preserves the hand-colored CLI command and TOML markup as raw HTML", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('<span style="color: #cba6f7;">claude</span>');
    expect(body).toContain('<span style="color: #cba6f7;">[mcp_servers.obsidian]</span>');
  });

  test("renders the MCP Inspector step, platform compatibility, privacy, and success sections", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain("Test with MCP Inspector");
    expect(body).toContain("mcp-inspector npx @bitbonsai/mcpvault@latest /path/to/vault");
    expect(body).toContain("Other clients can use MCPVault if they support local stdio MCP servers.");
    expect(body).toContain("What &quot;private&quot; means:");
    expect(body).toContain("Verify the connection");
  });

  test("preserves every copy-to-clipboard control's data-copy attribute for Phase 3's Alpine wiring", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('data-copy="npm install -g @modelcontextprotocol/inspector"');
    expect(body).toContain("data-copy=\"{&quot;mcpServers&quot;");
  });
});

describe("GET /install/ (Alpine interactivity, Phase 3)", () => {
  test("loads the bundled Alpine client script", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('<script type="module" src="/client/alpine.js">');
  });

  test("names the terminal module on the section root and starts the typing animation", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('x-data="terminal"');
    expect(body).toContain('x-init="startTyping()"');
  });

  // Hono's JSX renderer HTML-escapes attribute values, so a literal `'`
  // becomes `&#39;` in the served markup -- same helper as demo.test.tsx.
  function q(id: string): string {
    return `&#39;${id}&#39;`;
  }

  test("every config tab names selectTab and binds its own active class", async () => {
    const body = await (await app.request("/install/")).text();
    for (const id of ["standard", "claude-code", "gemini-cli", "opencode", "codex"]) {
      expect(body).toContain(`x-on:click="selectTab(${q(id)})"`);
      expect(body).toContain(`x-bind:class="{ active: activeTab === ${q(id)} }"`);
    }
  });

  test("every config panel binds its own hidden class", async () => {
    const body = await (await app.request("/install/")).text();
    for (const id of ["standard", "claude-code", "gemini-cli", "opencode", "codex"]) {
      expect(body).toContain(`x-bind:class="{ hidden: activeTab !== ${q(id)} }"`);
    }
  });

  test("every copy button reads its payload from its own data-copy attribute, not an inline literal", async () => {
    const body = await (await app.request("/install/")).text();
    const copyOnClickCount = body.match(/x-on:click="copy\(\$el\.dataset\.copy\)"/g) ?? [];
    // 8 copy-code-btn (standard, claude-code CLI, opencode CLI, opencode
    // config, gemini CLI, gemini config, codex) + 2 inspector-copy-btn.
    expect(copyOnClickCount.length).toBe(9);
  });

  test("the inspector command lines carry typed-progress bindings for the typing animation", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('x-text="typed[0]"');
    expect(body).toContain('x-text="typed[1]"');
  });

  test("names the nav module (shared shell)", async () => {
    const body = await (await app.request("/install/")).text();
    expect(body).toContain('x-data="nav"');
  });
});

describe("GET /install/ (Markdown negotiation)", () => {
  test("Accept: text/markdown without text/html serves the Markdown counterpart", async () => {
    const res = await app.request("/install/", { headers: { accept: "text/markdown" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(await res.text()).toContain("Markdown counterpart fixture.");
  });

  test("a normal browser Accept header still gets the rendered page", async () => {
    const res = await app.request("/install/", {
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("falls back to the HTML page when install.md is missing", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "shibumi-install-empty-"));
    const emptyApp = createApp({ publicDir: emptyDir });
    const res = await emptyApp.request("/install/", { headers: { accept: "text/markdown" } });
    expect(res.headers.get("content-type")).toContain("text/html");
    await rm(emptyDir, { recursive: true, force: true });
  });
});

describe("GET /styles/install.css", () => {
  test("serves the page stylesheet with a CSS content type", async () => {
    const res = await app.request("/styles/install.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    const body = await res.text();
    expect(body).toContain('[data-component="terminal"]');
    expect(body).toContain(".config-tab.active");
  });
});

describe("GET /install (no trailing slash)", () => {
  test("is not silently served as the install page", async () => {
    const res = await app.request("/install");
    // Phase 4 owns the redirect middleware; for now this must not be a
    // second, divergent way to reach the same content without one.
    expect(res.status).not.toBe(200);
  });
});

describe("GET /install/ (unsupported method)", () => {
  test("POST is rejected, not silently rendered", async () => {
    const res = await app.request("/install/", { method: "POST" });
    expect(res.status).not.toBe(200);
  });
});
