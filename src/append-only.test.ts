import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { FileSystemService } from "./filesystem.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("append-only overwrite protection", () => {
  let vault: string;

  beforeEach(async () => {
    vault = await mkdtemp(join(tmpdir(), "mcpvault-append-only-"));
  });

  afterEach(async () => {
    await rm(vault, { recursive: true, force: true });
  });

  test("refuses overwrite of a configured append-only file", async () => {
    const fs = new FileSystemService(vault, undefined, undefined, ["log.md"]);
    await fs.writeNote({ path: "log.md", content: "entry 1\n", mode: "append" });
    await expect(
      fs.writeNote({ path: "log.md", content: "wiped\n", mode: "overwrite" })
    ).rejects.toThrow(/append-only/i);
  });

  test("still allows append and prepend on a configured file", async () => {
    const fs = new FileSystemService(vault, undefined, undefined, ["log.md"]);
    await fs.writeNote({ path: "log.md", content: "a\n", mode: "append" });
    await fs.writeNote({ path: "log.md", content: "b\n", mode: "prepend" });
    const note = await fs.readNote("log.md");
    expect(note.content).toContain("a\n");
    expect(note.content).toContain("b\n");
  });

  test("does not affect files that are not configured", async () => {
    const fs = new FileSystemService(vault, undefined, undefined, ["log.md"]);
    await fs.writeNote({ path: "notes.md", content: "v1", mode: "overwrite" });
    await fs.writeNote({ path: "notes.md", content: "v2", mode: "overwrite" });
    expect((await fs.readNote("notes.md")).content).toBe("v2");
  });

  test("no protection by default (backward compatible)", async () => {
    const fs = new FileSystemService(vault);
    await fs.writeNote({ path: "log.md", content: "v1", mode: "overwrite" });
    await fs.writeNote({ path: "log.md", content: "v2", mode: "overwrite" });
    expect((await fs.readNote("log.md")).content).toBe("v2");
  });
});
