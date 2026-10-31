import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { createApp } from "../../src/app";
import { SITE_ROUTES, SITE_URL } from "../../src/routes/seo";

let publicDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  publicDir = await mkdtemp(join(tmpdir(), "shibumi-app-test-"));
  await writeFile(join(publicDir, "llm.txt"), "hello from llm.txt\n");
  await writeFile(join(publicDir, "index.md"), "# MCPVault\n");
  app = createApp({ publicDir });
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

describe("GET /healthz", () => {
  test("returns 200 with ok status and no-store", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("page redirects", () => {
  test("redirects every bare page path to its trailing-slash route", async () => {
    for (const route of SITE_ROUTES) {
      if (route === "/") continue;
      const barePath = route.slice(0, -1);
      const res = await app.request(`${barePath}?source=test`, { redirect: "manual" });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(`${route}?source=test`);
    }
  });

  test("renders trailing slashes in page links and canonical URLs", async () => {
    const barePaths = SITE_ROUTES.filter((route) => route !== "/").map((route) => route.slice(0, -1));
    for (const route of SITE_ROUTES) {
      const body = await (await app.request(route)).text();
      expect(body).toContain(`<link rel="canonical" href="${SITE_URL}${route}"/>`);
      for (const barePath of barePaths) {
        expect(body).not.toContain(`href="${barePath}"`);
      }
    }
  });
});

describe("security headers", () => {
  test("are present on responses", async () => {
    const res = await app.request("/healthz");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("referrer-policy")).toBeTruthy();
  });

  test("are present on 404 responses", async () => {
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("static serving", () => {
  test("serves a file from publicDir with cache headers", async () => {
    const res = await app.request("/llm.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello from llm.txt\n");
    expect(res.headers.get("content-length")).toBe("19");
    // llm.txt shares the .md baseline headers, not the static default.
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  test("serves markdown endpoints with markdown charset and revalidate cache-control", async () => {
    const res = await app.request("/index.md");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("# MCPVault\n");
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  });

  test("HEAD returns headers without a body", async () => {
    const res = await app.request("/llm.txt", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("19");
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  test("rejects path traversal", async () => {
    const res = await app.request("/%2e%2e/%2e%2e/etc/passwd");
    expect([400, 404]).toContain(res.status);
  });

  test("rejects encoded null bytes", async () => {
    const res = await app.request("/llm.txt%00.mp4");
    expect([400, 404]).toContain(res.status);
  });

  test("still serves publicDir root correctly when the option carries a trailing separator", async () => {
    const trailingSlashApp = createApp({ publicDir: `${publicDir}${sep}` });
    const res = await trailingSlashApp.request("/llm.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello from llm.txt\n");
  });

  test("still serves publicDir root correctly when the option is a relative path", async () => {
    const relativeApp = createApp({
      publicDir: relative(process.cwd(), publicDir),
    });
    const res = await relativeApp.request("/llm.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello from llm.txt\n");
  });
});

describe("X-Robots-Tag", () => {
  test("is set on ordinary page/static responses (Cloudflare Pages _headers parity, PR #188)", async () => {
    const res = await app.request("/llm.txt");
    expect(res.headers.get("x-robots-tag")).toBe("index, follow");
  });

  test("is set on 404 responses too", async () => {
    const res = await app.request("/nope");
    expect(res.headers.get("x-robots-tag")).toBe("index, follow");
  });
});

describe("error handling", () => {
  test("unknown routes return 404", async () => {
    const res = await app.request("/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not Found");
  });

  test("unhandled errors return 500", async () => {
    const throwing = createApp({ publicDir });
    throwing.get("/__boom", () => {
      throw new Error("boom");
    });
    const res = await throwing.request("/__boom");
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Internal Server Error");
  });
});
