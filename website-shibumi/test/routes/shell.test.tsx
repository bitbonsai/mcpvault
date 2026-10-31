/**
 * Route assertions for the shared shell (Layout, Nav, Footer, ThemeToggle).
 *
 * There is no public page route mounted on these yet -- full pages land in
 * Phase 2 groups 2-6 -- so this mounts a throwaway route on a bare Hono
 * instance the same way a real page will, and asserts on the actual HTTP
 * response (status, headers, body), not just the component's return value.
 */
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { Footer } from "../../src/components/Footer";
import { Nav } from "../../src/components/Nav";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { Layout } from "../../src/layouts/Layout";

function testApp() {
  const app = new Hono();
  app.get("/", (c) =>
    c.html(
      <Layout page="home" version="9.9.9">
        <Nav currentPath={c.req.path} version="9.9.9" />
        <main id="main-content">home content</main>
        <Footer />
        <ThemeToggle />
      </Layout>,
    ),
  );
  app.get("/install/", (c) =>
    c.html(
      <Layout page="install" title="Install" canonical="https://mcpvault.org/install/" version="9.9.9">
        <Nav currentPath={c.req.path} version="9.9.9" />
        <main id="main-content">install content</main>
        <Footer />
      </Layout>,
    ),
  );
  return app;
}

describe("Layout", () => {
  test("responds 200 text/html with a doctype", async () => {
    const res = await testApp().request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body.startsWith("<!doctype html>")).toBe(true);
  });

  test("sets canonical, Open Graph, and default metadata", async () => {
    const body = await (await testApp().request("/")).text();
    expect(body).toContain('<link rel="canonical" href="https://mcpvault.org/"/>');
    expect(body).toContain('<meta property="og:title" content="MCPVault - MCP Server for Obsidian Vaults"/>');
    expect(body).toContain('<meta name="theme-color" content="#0a0a0a"/>');
  });

  test("per-page title and canonical override the defaults", async () => {
    const body = await (await testApp().request("/install/")).text();
    expect(body).toContain("<title>Install | MCPVault</title>");
    expect(body).toContain('<link rel="canonical" href="https://mcpvault.org/install/"/>');
  });

  test("sets data-page on body for page-scoped CSS", async () => {
    const body = await (await testApp().request("/")).text();
    expect(body).toContain('data-page="home"');
  });

  test("renders structured data unescaped inside application/ld+json", async () => {
    const body = await (await testApp().request("/")).text();
    // The audit case: Hono's JSX renderer HTML-escapes plain string
    // children even inside <script>. A regression here would show up as
    // `&quot;@type&quot;` instead of `"@type"`.
    expect(body).toContain('"@type":"SoftwareApplication"');
    expect(body).toContain('"softwareVersion":"9.9.9"');
    expect(body).not.toContain("&quot;");
  });

  test("structured data script has no literal </script> to break out of the tag", async () => {
    const body = await (await testApp().request("/")).text();
    const start = body.indexOf('<script type="application/ld+json">');
    const end = body.indexOf("</script>", start);
    const scriptBody = body.slice(start, end);
    expect(scriptBody).not.toContain("</script");
  });

  test("includes a skip link targeting #main-content", async () => {
    const body = await (await testApp().request("/")).text();
    expect(body).toContain('data-component="skip-link"');
    expect(body).toContain('href="#main-content"');
    expect(body).toContain('id="main-content"');
  });

  test("includes the Counter.dev analytics script (shell-review carry-over)", async () => {
    const body = await (await testApp().request("/")).text();
    expect(body).toContain('src="https://cdn.counter.dev/script.js"');
    expect(body).toContain('data-id="56795b69-4872-4bfc-a640-4c0a9de06db8"');
  });
});

describe("Nav", () => {
  test("marks the current route active and links stay HTML links (works with no JS)", async () => {
    const body = await (await testApp().request("/install/")).text();
    expect(body).toContain('href="/install/" class="nav-link nav-link-active"');
    expect(body).toContain('href="/features/" class="nav-link"');
  });

  test("mobile menu panel is present but hidden without JavaScript", async () => {
    const body = await (await testApp().request("/")).text();
    expect(body).toContain('id="mobile-menu" hidden');
    expect(body).toContain('aria-label="Toggle mobile menu"');
    expect(body).toContain('aria-expanded="false"');
  });

  test("version badge reflects the injected package version", async () => {
    const body = await (await testApp().request("/")).text();
    expect(body).toContain("v9.9.9");
  });
});

describe("Footer", () => {
  test("renders the current year and quick links", async () => {
    const body = await (await testApp().request("/")).text();
    const year = new Date().getFullYear();
    expect(body).toContain(`© ${year} bitbonsai`);
    expect(body).toContain('href="/install/">Installation</a>');
  });
});

describe("ThemeToggle", () => {
  test("renders in the default dark state matching <html class=\"dark\">", () => {
    const html = ThemeToggle({}).toString();
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('aria-label="Switch to light mode"');
    expect(html).toContain("Dark mode active");
  });

  test("light state flips aria-label and status text", () => {
    const html = ThemeToggle({ theme: "light" }).toString();
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('aria-label="Switch to dark mode"');
    expect(html).toContain("Light mode active");
  });

  test("does not carry the dead, unstyled class=\"theme-toggle\" (shell-review carry-over)", () => {
    const html = ThemeToggle({}).toString();
    expect(html).not.toContain('class="theme-toggle"');
    expect(html).toContain('data-component="theme-toggle"');
  });

  test("names the themeToggle Alpine.data() module and its init()/toggle() methods (Phase 3, still unmounted)", () => {
    const html = ThemeToggle({}).toString();
    expect(html).toContain('x-data="themeToggle"');
    expect(html).toContain('x-init="init()"');
    expect(html).toContain('x-on:click="toggle()"');
  });

  test("only the icon matching the server-rendered theme is visible without JavaScript", () => {
    // Dark (default): the first icon span rendered (the dark icon) has no
    // static "hidden" class; the second (the light icon) does.
    const darkHtml = ThemeToggle({}).toString();
    const darkVisibleIndex = darkHtml.indexOf('<span class="icon" aria-hidden="true"');
    const darkHiddenIndex = darkHtml.indexOf('<span class="icon hidden" aria-hidden="true"');
    expect(darkVisibleIndex).toBeGreaterThan(-1);
    expect(darkHiddenIndex).toBeGreaterThan(darkVisibleIndex);

    // Light: the roles flip -- the hidden icon now comes first.
    const lightHtml = ThemeToggle({ theme: "light" }).toString();
    const lightHiddenIndex = lightHtml.indexOf('<span class="icon hidden" aria-hidden="true"');
    const lightVisibleIndex = lightHtml.indexOf('<span class="icon" aria-hidden="true"');
    expect(lightHiddenIndex).toBeGreaterThan(-1);
    expect(lightVisibleIndex).toBeGreaterThan(lightHiddenIndex);
  });
});
