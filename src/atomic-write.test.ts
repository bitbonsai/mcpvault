import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { FileSystemService } from "./filesystem.js";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("atomic + serialized note writes", () => {
  let vault: string;
  let fs: FileSystemService;

  beforeEach(async () => {
    vault = await mkdtemp(join(tmpdir(), "mcpvault-atomic-"));
    fs = new FileSystemService(vault);
  });

  afterEach(async () => {
    await rm(vault, { recursive: true, force: true });
  });

  test("concurrent appends to the same note do not clobber each other", async () => {
    await fs.writeNote({ path: "log.md", content: "start\n", mode: "overwrite" });

    const count = 25;
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        fs.writeNote({ path: "log.md", content: `line-${i}\n`, mode: "append" })
      )
    );

    const note = await fs.readNote("log.md");
    for (let i = 0; i < count; i++) {
      expect(note.content).toContain(`line-${i}\n`);
    }
  });

  test("no temp files are left behind after a successful write", async () => {
    await fs.writeNote({ path: "note.md", content: "hello", mode: "overwrite" });
    const entries = await readdir(vault);
    expect(entries).toContain("note.md");
    expect(entries.filter((e) => e.includes(".tmp-"))).toEqual([]);
  });
});
