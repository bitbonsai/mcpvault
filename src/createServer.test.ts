import { test, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./createServer.js";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

let testVaultPath: string;

beforeEach(async () => {
  testVaultPath = await mkdtemp(join(tmpdir(), "mcpvault-test-"));
});

afterEach(async () => {
  try {
    await rm(testVaultPath, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});

test("createServer returns a Server instance", () => {
  const server = createServer(testVaultPath, { version: "1.0.0" });
  expect(server).toBeDefined();
  expect(typeof server.connect).toBe("function");
});

test("server registers 15 tools", async () => {
  const server = createServer(testVaultPath, { version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  const result = await client.listTools();
  expect(result.tools).toHaveLength(15);

  const toolNames = result.tools.map((t) => t.name).sort();
  expect(toolNames).toEqual([
    "delete_note",
    "get_frontmatter",
    "get_notes_info",
    "get_vault_stats",
    "list_all_tags",
    "list_directory",
    "manage_tags",
    "move_file",
    "move_note",
    "patch_note",
    "read_multiple_notes",
    "read_note",
    "search_notes",
    "update_frontmatter",
    "write_note",
  ]);

  await client.close();
  await server.close();
});

test("server can read and write notes via tools", async () => {
  const server = createServer(testVaultPath, { version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  // Write a note
  await client.callTool({ name: "write_note", arguments: { path: "test.md", content: "# Hello World" } });

  // Read it back
  const result = await client.callTool({ name: "read_note", arguments: { path: "test.md" } });
  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.content).toContain("Hello World");

  await client.close();
  await server.close();
});

test("custom options are applied", () => {
  const server = createServer(testVaultPath, {
    name: "custom-name",
    version: "2.0.0",
  });
  expect(server).toBeDefined();
});

test("excludePatterns blocks notes in excluded folders", async () => {
  const server = createServer(testVaultPath, {
    version: "1.0.0",
    excludePatterns: ["Private", "Private/**"]
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  // Write directly to disk (bypassing the server) so the file exists
  const { join } = await import("path");
  await mkdir(join(testVaultPath, "Private"), { recursive: true });
  await writeFile(join(testVaultPath, "Private", "secret.md"), "secret content");

  // Server should refuse to read it
  const result = await client.callTool({ name: "read_note", arguments: { path: "Private/secret.md" } });
  expect((result as any).isError).toBe(true);

  await client.close();
  await server.close();
});

test("excludePatterns hides excluded notes from search_notes", async () => {
  const server = createServer(testVaultPath, {
    version: "1.0.0",
    excludePatterns: ["Private", "Private/**"]
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  const { join } = await import("path");
  await mkdir(join(testVaultPath, "Private"), { recursive: true });
  await writeFile(join(testVaultPath, "Private", "secret.md"), "# Secret\n\ncontains secretkeyword");
  await writeFile(join(testVaultPath, "public.md"), "# Public\n\ncontains secretkeyword");

  const result = await client.callTool({ name: "search_notes", arguments: { query: "secretkeyword", limit: 10 } });
  const parsed = JSON.parse((result.content as any)[0].text);

  const paths = parsed.map((r: any) => r.p);
  expect(paths).not.toContain("Private/secret.md");
  expect(paths).toContain("public.md");

  await client.close();
  await server.close();
});

test("excludePatterns hides excluded dirs from list_directory", async () => {
  const server = createServer(testVaultPath, {
    version: "1.0.0",
    excludePatterns: ["Private", "Private/**"]
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  const { join } = await import("path");
  await mkdir(join(testVaultPath, "Private"), { recursive: true });
  await mkdir(join(testVaultPath, "public"), { recursive: true });
  await writeFile(join(testVaultPath, "Private", "secret.md"), "secret");
  await writeFile(join(testVaultPath, "public", "note.md"), "public");

  const result = await client.callTool({ name: "list_directory", arguments: {} });
  const parsed = JSON.parse((result.content as any)[0].text);

  expect(parsed.dirs).not.toContain("Private");
  expect(parsed.dirs).toContain("public");

  await client.close();
  await server.close();
}); 