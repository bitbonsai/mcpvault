import { test, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./createServer.js";
import { mkdtemp, rm } from "fs/promises";
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

// ----------------------------------------------------------------------------
// readOnly mode (--read-only CLI flag)
// ----------------------------------------------------------------------------

test("readOnly: false (default) -- mutating tools succeed", async () => {
  const server = createServer(testVaultPath, { version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const result = await client.callTool({
    name: "write_note",
    arguments: { path: "writable.md", content: "# Writable" },
  });
  expect((result as any).isError).toBeFalsy();
  expect((result.content as any)[0].text).toContain("Successfully wrote");

  await client.close();
  await server.close();
});

test("readOnly: true -- write_note returns error without touching disk", async () => {
  const server = createServer(testVaultPath, { version: "1.0.0", readOnly: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const result = await client.callTool({
    name: "write_note",
    arguments: { path: "blocked.md", content: "# Should not exist" },
  });
  expect((result as any).isError).toBe(true);
  expect((result.content as any)[0].text).toContain("read-only mode");
  expect((result.content as any)[0].text).toContain("write_note");

  // Verify the file was NOT created
  const { existsSync } = await import("fs");
  expect(existsSync(join(testVaultPath, "blocked.md"))).toBe(false);

  await client.close();
  await server.close();
});

test("readOnly: true -- read tools still work", async () => {
  // Pre-create a note in non-read-only mode
  const writeServer = createServer(testVaultPath, { version: "1.0.0" });
  const [wt1, wt2] = InMemoryTransport.createLinkedPair();
  const writeClient = new Client({ name: "writer", version: "1.0.0" });
  await Promise.all([writeClient.connect(wt1), writeServer.connect(wt2)]);
  await writeClient.callTool({
    name: "write_note",
    arguments: { path: "preexisting.md", content: "# Pre-existing\n\nBody." },
  });
  await writeClient.close();
  await writeServer.close();

  // Now open a read-only server and read the note
  const roServer = createServer(testVaultPath, { version: "1.0.0", readOnly: true });
  const [ct1, ct2] = InMemoryTransport.createLinkedPair();
  const roClient = new Client({ name: "reader", version: "1.0.0" });
  await Promise.all([roClient.connect(ct1), roServer.connect(ct2)]);

  const result = await roClient.callTool({
    name: "read_note",
    arguments: { path: "preexisting.md" },
  });
  expect((result as any).isError).toBeFalsy();
  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.content).toContain("Body.");

  await roClient.close();
  await roServer.close();
});

test("readOnly: true -- all 7 mutating tools are blocked", async () => {
  const server = createServer(testVaultPath, { version: "1.0.0", readOnly: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const mutatingTools = [
    { name: "write_note",         args: { path: "a.md", content: "x" } },
    { name: "patch_note",         args: { path: "a.md", oldString: "x", newString: "y" } },
    { name: "delete_note",        args: { path: "a.md", confirmPath: "a.md" } },
    { name: "move_note",          args: { oldPath: "a.md", newPath: "b.md" } },
    { name: "move_file",          args: { oldPath: "a.bin", newPath: "b.bin", confirmOldPath: "a.bin", confirmNewPath: "b.bin" } },
    { name: "update_frontmatter", args: { path: "a.md", frontmatter: { tag: "x" } } },
    { name: "manage_tags",        args: { path: "a.md", operation: "add", tags: ["foo"] } },
  ];

  for (const tool of mutatingTools) {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    expect((result as any).isError, `expected ${tool.name} to be blocked`).toBe(true);
    expect((result.content as any)[0].text).toContain("read-only mode");
  }

  await client.close();
  await server.close();
});
