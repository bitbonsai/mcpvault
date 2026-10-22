import { test, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./createServer.js";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

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

test("server registers 18 tools", async () => {
  const server = createServer(testVaultPath, { version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  const result = await client.listTools();
  expect(result.tools).toHaveLength(18);

  const toolNames = result.tools.map((t) => t.name).sort();
  expect(toolNames).toEqual([
    "delete_note",
    "get_frontmatter",
    "get_note_outline",
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
    "read_note_lines",
    "search_notes",
    "update_frontmatter",
    "wiki_link",
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

async function connectClient(options: Parameters<typeof createServer>[1] = {}) {
  const server = createServer(testVaultPath, { version: "1.0.0", ...options });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return { server, client };
}

test("default exclusions hide discovery results without blocking direct reads", async () => {
  await mkdir(join(testVaultPath, "Archive"), { recursive: true });
  await mkdir(join(testVaultPath, "Active"), { recursive: true });
  await writeFile(join(testVaultPath, "Archive/hidden.md"), "# Hidden\n\nshared needle");
  await writeFile(join(testVaultPath, "Active/visible.md"), "# Visible\n\nshared needle");

  const { server, client } = await connectClient({ excludePaths: [" Archive/ "] });
  try {
    const rootListing = await client.callTool({
      name: "list_directory",
      arguments: { path: "." },
    });
    const listed = JSON.parse((rootListing.content as any)[0].text);
    expect(listed.dirs).toEqual(["Active"]);

    const excludedListing = await client.callTool({
      name: "list_directory",
      arguments: { path: "Active/../Archive" },
    });
    expect(excludedListing.isError).toBe(true);
    expect((excludedListing.content as any)[0].text).toContain("excluded by server configuration");

    const search = await client.callTool({
      name: "search_notes",
      arguments: { query: "shared needle" },
    });
    expect(JSON.parse((search.content as any)[0].text).map((result: any) => result.p)).toEqual([
      "Active/visible.md",
    ]);

    const additionalPerCallExclude = await client.callTool({
      name: "search_notes",
      arguments: { query: "shared needle", excludePaths: ["Active"] },
    });
    expect(JSON.parse((additionalPerCallExclude.content as any)[0].text)).toEqual([]);

    const directWrite = await client.callTool({
      name: "write_note",
      arguments: { path: "Archive/hidden.md", content: "updated hidden content" },
    });
    expect(directWrite.isError).toBeFalsy();

    const directRead = await client.callTool({
      name: "read_note",
      arguments: { path: "Archive/hidden.md" },
    });
    expect(directRead.isError).toBeFalsy();
    expect((directRead.content as any)[0].text).toContain("updated hidden content");
  } finally {
    await client.close();
    await server.close();
  }
});

test("wiki_link returns isError on invalid syntax (backslash in parsed)", async () => {
  const { server, client } = await connectClient();
  try {
    const result = await client.callTool({
      name: "wiki_link",
      arguments: { document: "[[Foo\\\\|Bar]]" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as any)[0].text as string;
    expect(text).toMatch(/Invalid wiki-link syntax/);
    expect((result.structuredContent as any).rawInput).toBe("[[Foo\\\\|Bar]]");
  } finally {
    await client.close();
    await server.close();
  }
});

test("wiki_link returns isError on zero match with document echo", async () => {
  const { server, client } = await connectClient();
  try {
    await writeFile(join(testVaultPath, "Other.md"), "# Other");
    const result = await client.callTool({
      name: "wiki_link",
      arguments: { document: "Missing" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as any)[0].text as string;
    expect(text).toContain("Missing");
    expect(text).toContain("search_notes");
    const sc = result.structuredContent as any;
    expect(sc.document).toBe("Missing");
  } finally {
    await client.close();
    await server.close();
  }
});

test("wiki_link single match omits alternatives", async () => {
  const { server, client } = await connectClient();
  try {
    await writeFile(join(testVaultPath, "Note.md"), "# Note\n\nbody");
    const result = await client.callTool({
      name: "wiki_link",
      arguments: { document: "Note" },
    });
    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as any;
    expect(sc.document).toBe("Note");
    expect(sc.path).toBe("Note.md");
    expect("alternatives" in sc).toBe(false);
    expect(sc.ambiguous).toBeUndefined();
    expect(sc.matches).toBeUndefined();
  } finally {
    await client.close();
    await server.close();
  }
});

test("wiki_link multi match resolves first sorted path and lists alternatives", async () => {
  const { server, client } = await connectClient();
  try {
    await writeFile(join(testVaultPath, "Note.md"), "# Root Note");
    await mkdir(join(testVaultPath, "deep"), { recursive: true });
    await writeFile(join(testVaultPath, "deep/Note.md"), "# Deep Note");
    const result = await client.callTool({
      name: "wiki_link",
      arguments: { document: "[[Note]]" },
    });
    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as any;
    expect(sc.path).toBe("Note.md");
    expect(sc.alternatives).toEqual(["deep/Note.md"]);
    expect(sc.ambiguous).toBeUndefined();
    expect(sc.matches).toBeUndefined();
  } finally {
    await client.close();
    await server.close();
  }
});

test("wiki_link unescapes table-authored \\| inside brackets", async () => {
  const { server, client } = await connectClient();
  try {
    await writeFile(join(testVaultPath, "My Document.md"), "# My Document\n\ncontent");
    const result = await client.callTool({
      name: "wiki_link",
      arguments: { document: "[[My Document\\|Displayed]]" },
    });
    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as any;
    expect(sc.document).toBe("My Document");
    expect(sc.path).toBe("My Document.md");
  } finally {
    await client.close();
    await server.close();
  }
});

test("wiki_link resolves path-qualified link to the exact file", async () => {
  const { server, client } = await connectClient();
  try {
    await writeFile(join(testVaultPath, "Note.md"), "# Root Note");
    await mkdir(join(testVaultPath, "deep"), { recursive: true });
    await writeFile(join(testVaultPath, "deep/Note.md"), "# Deep Note");
    const result = await client.callTool({
      name: "wiki_link",
      arguments: { document: "[[deep/Note]]" },
    });
    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as any;
    expect(sc.document).toBe("deep/Note");
    expect(sc.path).toBe("deep/Note.md");
    expect("alternatives" in sc).toBe(false);
  } finally {
    await client.close();
    await server.close();
  }
});

test("read-only mode exposes read tools and rejects every vault mutation", async () => {
  await writeFile(join(testVaultPath, "existing.md"), "# Existing\n\nSafe content");

  const server = createServer(testVaultPath, {
    version: "1.0.0",
    readOnly: true,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "read-only-client", version: "1.0.0" });
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  try {
    const listedTools = await client.listTools();
    const toolNames = listedTools.tools.map((tool) => tool.name);
    expect(toolNames).toHaveLength(11);
    expect(toolNames).toContain("read_note");
    expect(toolNames).toContain("search_notes");
    expect(toolNames).not.toContain("write_note");
    expect(toolNames).not.toContain("manage_tags");

    const readResult = await client.callTool({
      name: "read_note",
      arguments: { path: "existing.md" },
    });
    expect(readResult.isError).toBeFalsy();
    expect((readResult.content as any)[0].text).toContain("Safe content");

    const mutations = [
      { name: "write_note", arguments: { path: "blocked.md", content: "blocked" } },
      { name: "patch_note", arguments: { path: "existing.md", oldString: "Safe", newString: "Changed" } },
      { name: "delete_note", arguments: { path: "existing.md", confirmPath: "existing.md" } },
      { name: "move_note", arguments: { oldPath: "existing.md", newPath: "moved.md" } },
      { name: "move_file", arguments: { oldPath: "existing.md", newPath: "moved.md", confirmOldPath: "existing.md", confirmNewPath: "moved.md" } },
      { name: "update_frontmatter", arguments: { path: "existing.md", frontmatter: { status: "changed" } } },
      { name: "manage_tags", arguments: { path: "existing.md", operation: "list" } },
    ];

    for (const mutation of mutations) {
      const result = await client.callTool(mutation);
      expect(result.isError, `${mutation.name} should be blocked`).toBe(true);
      expect((result.content as any)[0].text).toContain("read-only mode");
    }

    await expect(readFile(join(testVaultPath, "blocked.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(testVaultPath, "existing.md"), "utf8")).toBe(
      "# Existing\n\nSafe content",
    );
  } finally {
    await client.close();
    await server.close();
  }
});

test("failed directory move_note is followed by list, read, and a valid move", async () => {
  await mkdir(join(testVaultPath, "dir-source"));
  await mkdir(join(testVaultPath, "dir-target"));
  await writeFile(join(testVaultPath, "dir-source/nested.md"), "nested");
  await writeFile(join(testVaultPath, "keep.md"), "---\ntitle: Keep\n---\n\nKeep body\n");

  const { server, client } = await connectClient();
  try {
    const sourceMove = await client.callTool({
      name: "move_note",
      arguments: { oldPath: "dir-source", newPath: "should-not-exist/out.md" },
    });
    expect(sourceMove.isError).toBe(true);
    const sourceBody = JSON.parse((sourceMove.content as any)[0].text);
    expect(sourceBody.success).toBe(false);
    expect(sourceBody.message).toContain("Source path is a directory: dir-source");
    expect(sourceBody.message).toContain("file path");

    const targetMove = await client.callTool({
      name: "move_note",
      arguments: { oldPath: "keep.md", newPath: "dir-target", overwrite: true },
    });
    expect(targetMove.isError).toBe(true);
    const targetBody = JSON.parse((targetMove.content as any)[0].text);
    expect(targetBody.success).toBe(false);
    expect(targetBody.message).toContain("Target path is a directory: dir-target");
    expect(targetBody.message).not.toContain("overwrite");

    const listingResult = await client.callTool({
      name: "list_directory",
      arguments: {},
    });
    expect(listingResult.isError).toBeFalsy();
    const listing = JSON.parse((listingResult.content as any)[0].text);
    expect(listing.files).toContain("keep.md");
    expect(listing.dirs).toEqual(expect.arrayContaining(["dir-source", "dir-target"]));
    expect(listing.dirs).not.toContain("should-not-exist");

    const readResult = await client.callTool({
      name: "read_note",
      arguments: { path: "keep.md" },
    });
    expect(readResult.isError).toBeFalsy();
    const note = JSON.parse((readResult.content as any)[0].text);
    expect(note.fm.title).toBe("Keep");
    expect(note.content).toContain("Keep body");

    const validMove = await client.callTool({
      name: "move_note",
      arguments: { oldPath: "keep.md", newPath: "moved/keep.md" },
    });
    expect(validMove.isError).toBeFalsy();
    const moved = JSON.parse((validMove.content as any)[0].text);
    expect(moved.success).toBe(true);
    expect(await readFile(join(testVaultPath, "moved/keep.md"), "utf8")).toContain("Keep body");
    await expect(readFile(join(testVaultPath, "keep.md"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(testVaultPath, "dir-source/nested.md"), "utf8")).toBe("nested");
  } finally {
    await client.close();
    await server.close();
  }
}, 10_000);
