import { test, expect, beforeEach, afterEach, describe, vi } from "vitest";
import { FileSystemService, classifyWriteError } from "./filesystem.js";
import { PathFilter } from "./pathfilter.js";
import { writeFile, readFile, readdir, mkdir, mkdtemp, rm, symlink } from "fs/promises";
import { join, relative } from "path";
import { tmpdir, homedir } from "os";

// ESM namespace exports are not configurable, so spyOn cannot reach the
// bindings filesystem.ts already imported. Faults are injected at the
// node:fs/promises boundary and cleared in each test's finally.
const fsFaults = vi.hoisted(() => ({
  readFile: undefined as Error | undefined,
  writeFile: undefined as Error | undefined,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: (...args: any[]) => {
      if (fsFaults.readFile) {
        throw fsFaults.readFile;
      }
      return (actual.readFile as any)(...args);
    },
    writeFile: (...args: any[]) => {
      if (fsFaults.writeFile) {
        throw fsFaults.writeFile;
      }
      return (actual.writeFile as any)(...args);
    },
  };
});

let testVaultPath: string;
let fileSystem: FileSystemService;

beforeEach(async () => {
  testVaultPath = await mkdtemp(join(tmpdir(), "mcpvault-test-"));
  fileSystem = new FileSystemService(testVaultPath);
});

afterEach(async () => {
  try {
    await rm(testVaultPath, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ============================================================================
// PATCH TESTS
// ============================================================================

test("patch note with single occurrence", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nThis is the old content.\n\nMore text here.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "old content",
    newString: "new content",
    replaceAll: false
  });

  expect(result.success).toBe(true);
  expect(result.matchCount).toBe(1);
  expect(result.message).toContain("Successfully replaced 1 occurrence");

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).toContain("new content");
  expect(updatedNote.content).not.toContain("old content");
});

test("patch note with multiple occurrences requires replaceAll", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nrepeat word repeat word repeat";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "repeat",
    newString: "unique",
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.matchCount).toBe(3);
  expect(result.message).toContain("Found 3 occurrences");
  expect(result.message).toContain("Use replaceAll=true");
});

test("patch note with replaceAll replaces all occurrences", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nrepeat word repeat word repeat";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "repeat",
    newString: "unique",
    replaceAll: true
  });

  expect(result.success).toBe(true);
  expect(result.matchCount).toBe(3);
  expect(result.message).toContain("Successfully replaced 3 occurrences");

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).not.toContain("repeat");
  expect(updatedNote.content.match(/unique/g)?.length).toBe(3);
});

test("patch note fails when string not found", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nSome content here.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "non-existent string",
    newString: "replacement",
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.matchCount).toBe(0);
  expect(result.message).toContain("String not found");
});

// ============================================================================
// GET NOTE OUTLINE TESTS
// ============================================================================

describe("getNoteOutline", () => {
  test("returns headings with level, text, and line number", async () => {
    const testPath = "outline-test.md";
    const content = "# Heading 1\n\nSome text.\n\n## Heading 2\n\nMore text.\n\n### Heading 3\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({ level: 1, text: "Heading 1", line: 1 });
    expect(headings[1]).toEqual({ level: 2, text: "Heading 2", line: 5 });
    expect(headings[2]).toEqual({ level: 3, text: "Heading 3", line: 9 });
  });

  test("returns empty array for note with no headings", async () => {
    const testPath = "no-headings.md";
    await writeFile(join(testVaultPath, testPath), "Just some plain text.\n\nNo headings here.");

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(0);
  });

  test("ignores heading markers inside code blocks and inline text", async () => {
    const testPath = "mixed.md";
    const content = "# Real Heading\n\nText with # not a heading\n\n## Another Real Heading\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("throws on path outside vault", async () => {
    await expect(fileSystem.getNoteOutline("../outside.md")).rejects.toThrow();
  });

  test("ignores heading markers inside fenced code blocks (backtick and tilde fences)", async () => {
    const testPath = "fenced.md";
    const content = [
      "# Real Heading",
      "",
      "```",
      "# not a heading",
      "## also not a heading",
      "```",
      "",
      "~~~",
      "# still not a heading",
      "~~~",
      "",
      "## Another Real Heading"
    ].join("\n");
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("a shorter fence run does not close a longer opening fence", async () => {
    const testPath = "fence-mismatched-length.md";
    const content = [
      "# Real Heading",
      "",
      "````",
      "```",
      "# not a heading (still inside the 4-backtick fence)",
      "````",
      "",
      "## Another Real Heading"
    ].join("\n");
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("a longer fence run closes a shorter opening fence", async () => {
    const testPath = "fence-longer-closer.md";
    const content = [
      "# Real Heading",
      "```",
      "# not a heading",
      "````",
      "## Another Real Heading"
    ].join("\n");
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("a fence marker followed by trailing text (e.g. a language tag) is not a valid closer", async () => {
    const testPath = "fence-trailing-text.md";
    const content = [
      "# Real Heading",
      "```",
      "```json",
      "# not a heading (still inside, the line above had trailing text)",
      "```",
      "## Another Real Heading"
    ].join("\n");
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("a closer with only trailing whitespace after the markers still closes the fence", async () => {
    const testPath = "fence-trailing-whitespace.md";
    const content = [
      "# Real Heading",
      "```",
      "# not a heading",
      "```   ",
      "## Another Real Heading"
    ].join("\n");
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("ignores heading markers inside a fence indented up to 3 spaces", async () => {
    const testPath = "fence-indented.md";
    const content = [
      "# Real Heading",
      "  ```",
      "  # not a heading",
      "  ```",
      "## Another Real Heading"
    ].join("\n");
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("a mismatched fence character (backtick vs tilde) does not close the block", async () => {
    const testPath = "fence-mismatched-char.md";
    const content = [
      "# Real Heading",
      "```",
      "~~~",
      "# not a heading (tilde run doesn't close a backtick fence)",
      "```",
      "## Another Real Heading"
    ].join("\n");
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real Heading");
    expect(headings[1]?.text).toBe("Another Real Heading");
  });

  test("does not misdetect a YAML comment in frontmatter as a heading (LF)", async () => {
    const testPath = "frontmatter-lf.md";
    const content = "---\ntitle: Test\n# not a heading, a YAML comment\n---\n\n# Real Heading\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Real Heading");
  });

  test("does not misdetect a YAML comment in frontmatter as a heading (CRLF)", async () => {
    const testPath = "frontmatter-crlf.md";
    const content = "---\r\ntitle: Test\r\n# not a heading, a YAML comment\r\n---\r\n\r\n# Real Heading\r\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Real Heading");
  });

  test("recognizes a heading indented by up to 3 spaces", async () => {
    const testPath = "heading-indented.md";
    const content = "# Real Heading\n   ## Indented Heading\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[1]).toMatchObject({ level: 2, text: "Indented Heading" });
  });

  test("does not recognize a heading indented by 4 or more spaces", async () => {
    const testPath = "heading-over-indented.md";
    const content = "# Real Heading\n    ## Not A Heading (4 spaces)\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Real Heading");
  });

  test("an empty heading (bare #, no text) is still returned, with empty text", async () => {
    const testPath = "heading-empty.md";
    const content = "#\n## Real Heading\n### \n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(3);
    expect(headings[0]).toMatchObject({ level: 1, text: "" });
    expect(headings[1]).toMatchObject({ level: 2, text: "Real Heading" });
    expect(headings[2]).toMatchObject({ level: 3, text: "" });
  });

  test("an optional closing sequence of #s is stripped from the heading text", async () => {
    const testPath = "heading-closing-sequence.md";
    const content = "## Heading ##\n### Another #####\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Heading");
    expect(headings[1]?.text).toBe("Another");
  });

  test("a closing-looking # run with no preceding space is kept as literal text", async () => {
    const testPath = "heading-fake-closer.md";
    const content = "# Heading###\n";
    await writeFile(join(testVaultPath, testPath), content);

    const headings = await fileSystem.getNoteOutline(testPath);

    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Heading###");
  });
});

// ============================================================================
// READ NOTE LINES TESTS
// ============================================================================

describe("readNoteLines", () => {
  test("reads a specific line range", async () => {
    const testPath = "lines-test.md";
    const content = "line 1\nline 2\nline 3\nline 4\nline 5";
    await writeFile(join(testVaultPath, testPath), content);

    const result = await fileSystem.readNoteLines({ path: testPath, startLine: 2, endLine: 4 });

    expect(result).toBe("line 2\nline 3\nline 4");
  });

  test("reads a single line", async () => {
    const testPath = "single-line.md";
    await writeFile(join(testVaultPath, testPath), "line 1\nline 2\nline 3");

    const result = await fileSystem.readNoteLines({ path: testPath, startLine: 2, endLine: 2 });

    expect(result).toBe("line 2");
  });

  test("reads from line 1", async () => {
    const testPath = "from-start.md";
    await writeFile(join(testVaultPath, testPath), "first\nsecond\nthird");

    const result = await fileSystem.readNoteLines({ path: testPath, startLine: 1, endLine: 2 });

    expect(result).toBe("first\nsecond");
  });

  test("throws on path outside vault", async () => {
    await expect(fileSystem.readNoteLines({ path: "../outside.md", startLine: 1, endLine: 1 })).rejects.toThrow();
  });

  test("clamps startLine below 1 up to line 1, instead of wrapping via negative indexing", async () => {
    const testPath = "clamp-start.md";
    await writeFile(join(testVaultPath, testPath), "first\nsecond\nthird");

    const result = await fileSystem.readNoteLines({ path: testPath, startLine: 0, endLine: 2 });

    expect(result).toBe("first\nsecond");
  });

  test("clamps endLine past EOF down to the last line", async () => {
    const testPath = "clamp-end.md";
    await writeFile(join(testVaultPath, testPath), "first\nsecond\nthird");

    const result = await fileSystem.readNoteLines({ path: testPath, startLine: 2, endLine: 999 });

    expect(result).toBe("second\nthird");
  });

  test("clamps endLine below startLine up to startLine, returning a single line", async () => {
    const testPath = "clamp-inverted.md";
    await writeFile(join(testVaultPath, testPath), "first\nsecond\nthird");

    const result = await fileSystem.readNoteLines({ path: testPath, startLine: 3, endLine: 1 });

    expect(result).toBe("third");
  });
});

test("patch note with multiline replacement", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\n## Section A\nOld content\nOld lines\n\n## Section B\nOther content";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "## Section A\nOld content\nOld lines",
    newString: "## Section A\nNew content\nNew improved lines",
    replaceAll: false
  });

  expect(result.success).toBe(true);
  expect(result.matchCount).toBe(1);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).toContain("New content");
  expect(updatedNote.content).toContain("New improved lines");
  expect(updatedNote.content).not.toContain("Old content");
});

test("patch note with frontmatter preserved", async () => {
  const testPath = "test-note.md";
  const content = `---
title: My Note
tags: [test]
---

# Content

Old text here.`;

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "Old text here.",
    newString: "New text here.",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.frontmatter.title).toBe("My Note");
  expect(updatedNote.frontmatter.tags).toEqual(["test"]);
  expect(updatedNote.content).toContain("New text here.");
});

test("patch note fails when oldString equals newString", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nSome content";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "same",
    newString: "same",
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain("must be different");
});

test("patch note fails for filtered paths", async () => {
  const testPath = ".obsidian/config.json";

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "old",
    newString: "new",
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain("Access denied");
});

test("patch note fails when file doesn't exist", async () => {
  const testPath = "non-existent-note.md";

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "old",
    newString: "new",
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain("File not found");
});

test("patch note fails with empty oldString", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nSome content.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "",
    newString: "new",
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.message).toMatch(/empty|filled|required/i);
});

test("patch note allows empty newString to delete matched text", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nSome content.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "content",
    newString: "",
    replaceAll: false
  });

  expect(result.success).toBe(true);
  expect(result.matchCount).toBe(1);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toBe("# Test Note\n\nSome .");
});

test("patch note fails with undefined newString", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nSome content.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "content",
    newString: undefined as any,
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.message).toMatch(/empty|filled|required/i);

  // Verify the note was NOT corrupted
  const note = await fileSystem.readNote(testPath);
  expect(note.content).not.toContain("undefined");
  expect(note.content).toContain("Some content.");
});

test("patch note fails with null newString", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nSome content.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "content",
    newString: null as any,
    replaceAll: false
  });

  expect(result.success).toBe(false);
  expect(result.message).toMatch(/empty|filled|required/i);

  // Verify the note was NOT corrupted
  const note = await fileSystem.readNote(testPath);
  expect(note.content).not.toContain("null");
  expect(note.content).toContain("Some content.");
});

test("writeNote rejects undefined content", async () => {
  const testPath = "test-note.md";

  await expect(fileSystem.writeNote({
    path: testPath,
    content: undefined as any
  })).rejects.toThrow(/Content is required/);
});

test("writeNote rejects null content", async () => {
  const testPath = "test-note.md";

  await expect(fileSystem.writeNote({
    path: testPath,
    content: null as any
  })).rejects.toThrow(/Content is required/);
});

test("writeNote append with undefined content does not corrupt note", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nOriginal content.";

  await writeFile(join(testVaultPath, testPath), content);

  await expect(fileSystem.writeNote({
    path: testPath,
    content: undefined as any,
    mode: 'append'
  })).rejects.toThrow(/Content is required/);

  // Verify the note was NOT corrupted
  const note = await fileSystem.readNote(testPath);
  expect(note.content).not.toContain("undefined");
  expect(note.content).toContain("Original content.");
});

test("patch note handles regex special characters literally", async () => {
  const testPath = "test-note.md";
  const content = "Price: $10.50 (special)";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "$10.50",
    newString: "$15.75",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).toContain("$15.75");
  expect(updatedNote.content).not.toContain("$10.50");
});

test("patch note inserts newString containing $' literally without duplicating tail", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nOld line here.\n\nTail content that must not be duplicated.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "Old line here.",
    newString: "It's a bash snippet: echo $'hello'",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.originalContent).toContain("It's a bash snippet: echo $'hello'");
  expect(updatedNote.originalContent.match(/Tail content that must not be duplicated\./g)?.length).toBe(1);
});

test("patch note inserts newString containing $& literally", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nOld line here.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "Old line here.",
    newString: "Matched with $& pattern",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.originalContent).toContain("Matched with $& pattern");
  expect(updatedNote.originalContent).not.toContain("Old line here.");
});

test("patch note inserts newString containing $` literally", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nOld line here.\n\nAfter text.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "Old line here.",
    newString: "Backtick pattern $` stays literal",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.originalContent).toContain("Backtick pattern $` stays literal");
  expect(updatedNote.originalContent.match(/# Test/g)?.length).toBe(1);
});

test("patch note inserts newString containing $$ literally", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nPrice: TBD";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "Price: TBD",
    newString: "Price: $$100",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.originalContent).toContain("Price: $$100");
});

test("patch note with replaceAll inserts $ patterns literally", async () => {
  const testPath = "test-note.md";
  const content = "# Test\n\nTODO item\nTODO item\n\nTail content.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "TODO item",
    newString: "Costs $' and $& and $$",
    replaceAll: true
  });

  expect(result.success).toBe(true);
  expect(result.matchCount).toBe(2);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.originalContent.match(/Costs \$' and \$& and \$\$/g)?.length).toBe(2);
  expect(updatedNote.originalContent.match(/Tail content\./g)?.length).toBe(1);
});

test("patch note works with fenced code blocks", async () => {
  const testPath = "code-fence-test.md";
  const content = "# Example\n\n```rust\nfn main() {\n    println!(\"hello\");\n}\n```\n";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "println!(\"hello\");",
    newString: "println!(\"hello world\");",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.originalContent).toContain("println!(\"hello world\");");
});

test("patch note works with markdown tables", async () => {
  const testPath = "table-test.md";
  const content = "| Tool | Status |\n|---|---|\n| patch_note | flaky |\n";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "| patch_note | flaky |",
    newString: "| patch_note | stable |",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.originalContent).toContain("| patch_note | stable |");
});

test("patch note preserves tabs and spaces", async () => {
  const testPath = "test-note.md";
  const content = "Line with\ttabs\n  Line with spaces\n\tTabbed line";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "tabs",
    newString: "TABS",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).toContain("Line with\tTABS");
  expect(updatedNote.content).toContain("\tTabbed line");
  expect(updatedNote.content).toContain("  Line with spaces");
});

test("patch note is case sensitive", async () => {
  const testPath = "test-note.md";
  const content = "Hello world, hello again";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "hello",
    newString: "hi",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).toContain("Hello world");
  expect(updatedNote.content).toContain("hi again");
});

test("patch note handles many replacements efficiently", async () => {
  const testPath = "test-note.md";
  const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: replace_me`);
  const content = lines.join("\n");

  await writeFile(join(testVaultPath, testPath), content);

  const startTime = Date.now();
  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "replace_me",
    newString: "replaced",
    replaceAll: true
  });
  const duration = Date.now() - startTime;

  expect(result.success).toBe(true);
  expect(result.matchCount).toBe(100);
  expect(duration).toBeLessThan(1000);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).not.toContain("replace_me");
  expect(updatedNote.content.match(/replaced/g)?.length).toBe(100);
});

test("patch note works with path containing spaces", async () => {
  const testPath = "folder name/note with spaces.md";
  const content = "# Test Note\n\nOld content here.";

  await mkdir(join(testVaultPath, "folder name"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "Old content",
    newString: "New content",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const updatedNote = await fileSystem.readNote(testPath);
  expect(updatedNote.content).toContain("New content");
});

// ============================================================================
// DELETE TESTS
// ============================================================================

test("delete note with correct confirmation", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nThis is a test note to be deleted.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath
  });

  expect(result.success).toBe(true);
  expect(result.path).toBe(testPath);
  expect(result.message).toContain("Successfully deleted");
  expect(result.message).toContain("cannot be undone");
});

test("reject deletion with incorrect confirmation", async () => {
  const testPath = "test-note.md";
  const content = "# Test Note\n\nThis note should not be deleted.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: "wrong-path.md"
  });

  expect(result.success).toBe(false);
  expect(result.path).toBe(testPath);
  expect(result.message).toContain("confirmation path does not match");

  const fileStillExists = await fileSystem.exists(testPath);
  expect(fileStillExists).toBe(true);
});

test("handle deletion of non-existent file", async () => {
  const testPath = "non-existent.md";

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath
  });

  expect(result.success).toBe(false);
  expect(result.path).toBe(testPath);
  expect(result.message).toContain("File not found");
});

test("reject deletion of filtered paths", async () => {
  const testPath = ".obsidian/app.json";

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath
  });

  expect(result.success).toBe(false);
  expect(result.path).toBe(testPath);
  expect(result.message).toContain("Access denied");
});

test("handle directory deletion attempt", async () => {
  const testPath = "test-directory";

  await mkdir(join(testVaultPath, testPath));

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath
  });

  expect(result.success).toBe(false);
  expect(result.path).toBe(testPath);
  expect(result.message).toContain("is not a file");
});

test("delete note with local trash mode", async () => {
  const testPath = "trash-test.md";
  const content = "# Trash Test\n\nThis note should be moved to vault trash.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath,
    trashMode: 'local'
  });

  expect(result.success).toBe(true);
  expect(result.message).toContain("vault trash");

  const originalExists = await fileSystem.exists(testPath);
  expect(originalExists).toBe(false);

  // .trash/ is filtered from vault visibility; verify via raw fs
  const trashedContent = await readFile(join(testVaultPath, ".trash/trash-test.md"), "utf-8");
  expect(trashedContent).toBe(content);
});

test("delete note with system trash mode", async () => {
  const testPath = "system-trash-test.md";
  const content = "# System Trash Test\n\nThis note should be moved to system trash.";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath,
    trashMode: 'system'
  });

  expect(result.success).toBe(true);
  expect(result.message).toContain("system trash");

  const originalExists = await fileSystem.exists(testPath);
  expect(originalExists).toBe(false);
});

test("delete note with frontmatter", async () => {
  const testPath = "note-with-frontmatter.md";
  const content = `---
title: Test Note
tags: [test, delete]
---

# Test Note

This note has frontmatter and should be deleted successfully.`;

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath
  });

  expect(result.success).toBe(true);
  expect(result.path).toBe(testPath);
  expect(result.message).toContain("Successfully deleted");
});

// ============================================================================
// FRONTMATTER INTEGRATION TESTS
// ============================================================================

test("write_note with frontmatter", async () => {
  await fileSystem.writeNote({
    path: "test.md",
    content: "This is test content.",
    frontmatter: {
      title: "Test Note",
      tags: ["test", "example"],
      created: "2023-01-01"
    }
  });

  const note = await fileSystem.readNote("test.md");

  expect(note.frontmatter.title).toBe("Test Note");
  expect(note.frontmatter.tags).toEqual(["test", "example"]);
  expect(note.frontmatter.created).toBe("2023-01-01");
  expect(note.content.trim()).toBe("This is test content.");
});

test("write_note with append mode preserves frontmatter", async () => {
  await fileSystem.writeNote({
    path: "append-test.md",
    content: "Original content.",
    frontmatter: { title: "Original", status: "draft" }
  });

  await fileSystem.writeNote({
    path: "append-test.md",
    content: "\nAppended content.",
    frontmatter: { updated: "2023-12-01" },
    mode: "append"
  });

  const note = await fileSystem.readNote("append-test.md");

  expect(note.frontmatter.title).toBe("Original");
  expect(note.frontmatter.status).toBe("draft");
  // Verify raw file preserves plain date format (gray-matter parses unquoted dates as Date objects)
  const rawFile = await readFile(join(testVaultPath, "append-test.md"), "utf-8");
  expect(rawFile).toContain("updated: 2023-12-01");
  expect(rawFile).not.toContain("T00:00:00.000Z");
  expect(note.content.trim()).toBe("Original content.\n\nAppended content.");
});

test("update_frontmatter merges with existing", async () => {
  await fileSystem.writeNote({
    path: "update-test.md",
    content: "Test content.",
    frontmatter: {
      title: "Original Title",
      tags: ["original"],
      status: "draft"
    }
  });

  await fileSystem.updateFrontmatter({
    path: "update-test.md",
    frontmatter: {
      title: "Updated Title",
      priority: "high"
    },
    merge: true
  });

  const note = await fileSystem.readNote("update-test.md");

  expect(note.frontmatter.title).toBe("Updated Title");
  expect(note.frontmatter.tags).toEqual(["original"]);
  expect(note.frontmatter.status).toBe("draft");
  expect(note.frontmatter.priority).toBe("high");
  expect(note.content.trim()).toBe("Test content.");
});

test("update_frontmatter replaces when merge is false", async () => {
  await fileSystem.writeNote({
    path: "replace-test.md",
    content: "Test content.",
    frontmatter: {
      title: "Original Title",
      tags: ["original"],
      status: "draft"
    }
  });

  await fileSystem.updateFrontmatter({
    path: "replace-test.md",
    frontmatter: {
      title: "New Title",
      priority: "high"
    },
    merge: false
  });

  const note = await fileSystem.readNote("replace-test.md");

  expect(note.frontmatter.title).toBe("New Title");
  expect(note.frontmatter.priority).toBe("high");
  expect(note.frontmatter.tags).toBeUndefined();
  expect(note.frontmatter.status).toBeUndefined();
});

test("manage_tags add operation", async () => {
  await fileSystem.writeNote({
    path: "tags-add-test.md",
    content: "Test content.",
    frontmatter: {
      title: "Test",
      tags: ["existing"]
    }
  });

  const result = await fileSystem.manageTags({
    path: "tags-add-test.md",
    operation: "add",
    tags: ["new", "important"]
  });

  expect(result.success).toBe(true);
  expect(result.tags).toEqual(["existing", "new", "important"]);

  const note = await fileSystem.readNote("tags-add-test.md");
  expect(note.frontmatter.tags).toEqual(["existing", "new", "important"]);
});

test("manage_tags remove operation", async () => {
  await fileSystem.writeNote({
    path: "tags-remove-test.md",
    content: "Test content.",
    frontmatter: {
      title: "Test",
      tags: ["keep", "remove1", "remove2"]
    }
  });

  const result = await fileSystem.manageTags({
    path: "tags-remove-test.md",
    operation: "remove",
    tags: ["remove1", "remove2"]
  });

  expect(result.success).toBe(true);
  expect(result.tags).toEqual(["keep"]);

  const note = await fileSystem.readNote("tags-remove-test.md");
  expect(note.frontmatter.tags).toEqual(["keep"]);
});

test("manage_tags list operation", async () => {
  await fileSystem.writeNote({
    path: "tags-list-test.md",
    content: "Test content with #inline-tag.",
    frontmatter: {
      title: "Test",
      tags: ["frontmatter-tag"]
    }
  });

  const result = await fileSystem.manageTags({
    path: "tags-list-test.md",
    operation: "list"
  });

  expect(result.success).toBe(true);
  expect(result.tags).toContain("frontmatter-tag");
  expect(result.tags).toContain("inline-tag");
});

test("manage_tags removes tags array when empty", async () => {
  await fileSystem.writeNote({
    path: "tags-empty-test.md",
    content: "Test content.",
    frontmatter: {
      title: "Test",
      tags: ["remove-me"]
    }
  });

  await fileSystem.manageTags({
    path: "tags-empty-test.md",
    operation: "remove",
    tags: ["remove-me"]
  });

  const note = await fileSystem.readNote("tags-empty-test.md");
  expect(note.frontmatter.tags).toBeUndefined();
  expect(note.frontmatter.title).toBe("Test");
});

test("frontmatter validation with invalid data", async () => {
  await expect(fileSystem.writeNote({
    path: "invalid-test.md",
    content: "Test content.",
    frontmatter: {
      title: "Test",
      invalidFunction: () => "not allowed"
    }
  })).rejects.toThrow(/Invalid frontmatter/);
});

test("listDirectory includes non-note files but readNote still blocks them", async () => {
  const imagePath = "assets/diagram.png";
  await mkdir(join(testVaultPath, "assets"), { recursive: true });
  await writeFile(join(testVaultPath, imagePath), "fake-png-content");

  const listing = await fileSystem.listDirectory("assets");
  expect(listing.files).toContain("diagram.png");

  await expect(fileSystem.readNote(imagePath)).rejects.toThrow(/Access denied/);
});

// ============================================================================
// NON-EXISTENT VAULT TESTS
// ============================================================================

test("read from non-existent vault throws error", async () => {
  const nonExistentFs = new FileSystemService("/non/existent/vault/path");

  await expect(nonExistentFs.readNote("test.md"))
    .rejects.toThrow(/File not found|ENOENT/);
});

test("write to non-existent vault creates directories", async () => {
  const tempVault = await mkdtemp(join(tmpdir(), "mcpvault-new-vault-"));
  const newFs = new FileSystemService(tempVault);

  try {
    await newFs.writeNote({
      path: "new-folder/nested/note.md",
      content: "Test content"
    });

    const note = await newFs.readNote("new-folder/nested/note.md");
    expect(note.content).toContain("Test content");
  } finally {
    await rm(tempVault, { recursive: true });
  }
});

test("list directory in non-existent vault", async () => {
  const nonExistentFs = new FileSystemService("/non/existent/vault/path");

  await expect(nonExistentFs.listDirectory("/"))
    .rejects.toThrow();
});

// ============================================================================
// PATH TRAVERSAL WITH SPECIAL CHARACTERS
// ============================================================================

test("path traversal attempt with encoded dots blocked", async () => {
  // Path traversal should be blocked even with URL encoding
  await expect(fileSystem.readNote("..%2F..%2Fetc%2Fpasswd"))
    .rejects.toThrow(/Path traversal not allowed/);
});

test("path traversal with .. is blocked", async () => {
  await expect(fileSystem.readNote("../outside.md"))
    .rejects.toThrow(/Path traversal not allowed/);
});

test("path traversal with nested .. is blocked", async () => {
  await expect(fileSystem.readNote("folder/../../outside.md"))
    .rejects.toThrow(/Path traversal not allowed/);
});

// ============================================================================
// DEFENSIVE VAULT-PREFIX STRIPPING
// ============================================================================

test("path containing vault prefix is resolved correctly", async () => {
  const testPath = "wiki/note.md";
  const content = "# Note\n\nSome content here.";

  await mkdir(join(testVaultPath, "wiki"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  // Simulate a client passing an absolute path that includes the vault prefix.
  // Use the resolved vault path (realpathSync) since that's what FileSystemService stores.
  const resolvedVaultPath = fileSystem.getVaultPath();
  const absolutePath = resolvedVaultPath + "/" + testPath;
  const note = await fileSystem.readNote(absolutePath);

  expect(note.content).toContain("Some content here.");
});

test("path containing vault prefix without trailing slash is resolved correctly", async () => {
  const content = "# Root Note\n\nRoot content.";
  await writeFile(join(testVaultPath, "root-note.md"), content);

  const resolvedVaultPath = fileSystem.getVaultPath();
  const absolutePath = resolvedVaultPath + "/root-note.md";
  const note = await fileSystem.readNote(absolutePath);

  expect(note.content).toContain("Root content.");
});

test("path with tilde vault prefix is resolved correctly", async () => {
  const resolvedVaultPath = fileSystem.getVaultPath();
  const home = homedir();

  // Only run this test if the vault path is under the home directory
  if (!resolvedVaultPath.startsWith(home)) {
    return;
  }

  const content = "# Tilde Note\n\nTilde content.";
  await writeFile(join(testVaultPath, "tilde-note.md"), content);

  // Construct a ~/... path to the file
  const relativeToHome = relative(home, resolvedVaultPath);
  const tildePath = "~/" + relativeToHome + "/tilde-note.md";
  const note = await fileSystem.readNote(tildePath);

  expect(note.content).toContain("Tilde content.");
});

// ============================================================================
// SYMLINK SECURITY
// ============================================================================

test("symlink to file outside vault is blocked", async () => {
  const outsideDir = await mkdtemp(join(tmpdir(), "mcpvault-outside-"));
  const outsideFile = join(outsideDir, "secret.txt");
  await writeFile(outsideFile, "SECRET DATA");

  try {
    await symlink(outsideFile, join(testVaultPath, "evil-link.md"));
    await expect(fileSystem.readNote("evil-link.md"))
      .rejects.toThrow(/Symlink target is outside vault/);
  } finally {
    await rm(outsideDir, { recursive: true });
  }
});

test("dangling file symlink cannot create a file outside the vault", async () => {
  const outside = await mkdtemp(join(tmpdir(), "mcpvault-outside-"));
  const target = join(outside, "new.md");
  await symlink(target, join(testVaultPath, "link.md"));
  await writeFile(join(testVaultPath, "source.md"), "keep");
  try {
    await expect(fileSystem.writeNote({ path: "link.md", content: "escape" }))
      .rejects.toThrow(/Cannot resolve symlink/);
    await expect(fileSystem.moveNote({ oldPath: "source.md", newPath: "link.md", overwrite: true }))
      .rejects.toThrow(/Cannot resolve symlink/);
    await expect(fileSystem.moveFile({
      oldPath: "source.md", newPath: "link.md", overwrite: true,
      confirmOldPath: "source.md", confirmNewPath: "link.md"
    })).rejects.toThrow(/Cannot resolve symlink/);
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(testVaultPath, "source.md"), "utf8")).toBe("keep");
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("missing parents below an outside symlink cannot bypass the vault boundary", async () => {
  const outside = await mkdtemp(join(tmpdir(), "mcpvault-outside-"));
  await symlink(outside, join(testVaultPath, "linked"));
  await writeFile(join(testVaultPath, "source.md"), "keep");
  const newPath = "linked/new/deeper/note.md";
  try {
    await expect(fileSystem.writeNote({ path: newPath, content: "escape" }))
      .rejects.toThrow(/Symlink target is outside vault/);
    await expect(fileSystem.moveNote({ oldPath: "source.md", newPath }))
      .rejects.toThrow(/Symlink target is outside vault/);
    await expect(fileSystem.moveFile({
      oldPath: "source.md", newPath,
      confirmOldPath: "source.md", confirmNewPath: newPath
    })).rejects.toThrow(/Symlink target is outside vault/);
    await expect(readFile(join(outside, "new/deeper/note.md"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fileSystem.exists("source.md")).toBe(true);
    expect(await readdir(outside)).toEqual([]);
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("missing parents below a dangling directory symlink are rejected", async () => {
  const outside = await mkdtemp(join(tmpdir(), "mcpvault-outside-"));
  await symlink(join(outside, "absent"), join(testVaultPath, "linked"));
  try {
    await expect(fileSystem.writeNote({ path: "linked/new/note.md", content: "escape" }))
      .rejects.toThrow(/Cannot resolve symlink/);
    expect(await readdir(outside)).toEqual([]);
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("new nested paths through in-vault directory symlinks remain writable", async () => {
  await mkdir(join(testVaultPath, "real"));
  await symlink(join(testVaultPath, "real"), join(testVaultPath, "linked"));
  await fileSystem.writeNote({ path: "linked/new/deeper/note.md", content: "inside" });
  expect(await readFile(join(testVaultPath, "real/new/deeper/note.md"), "utf8")).toBe("inside");
});

test("symlink to file inside vault works", async () => {
  const content = "# Real Note\n\nThis is inside the vault.";
  await mkdir(join(testVaultPath, "deep"), { recursive: true });
  await writeFile(join(testVaultPath, "deep/real-note.md"), content);
  await symlink(join(testVaultPath, "deep/real-note.md"), join(testVaultPath, "shortcut.md"));

  const note = await fileSystem.readNote("shortcut.md");
  expect(note.content).toContain("This is inside the vault.");
});

test("symlink to directory outside vault is skipped in listDirectory", async () => {
  const outsideDir = await mkdtemp(join(tmpdir(), "mcpvault-outside-"));
  await writeFile(join(outsideDir, "secret.txt"), "SECRET");

  try {
    await symlink(outsideDir, join(testVaultPath, "evil-dir"));
    const listing = await fileSystem.listDirectory("");
    expect(listing.directories).not.toContain("evil-dir");
    expect(listing.files).not.toContain("evil-dir");
  } finally {
    await rm(outsideDir, { recursive: true });
  }
});

test("symlink to directory inside vault is listed", async () => {
  await mkdir(join(testVaultPath, "real-folder"), { recursive: true });
  await writeFile(join(testVaultPath, "real-folder/note.md"), "# Note");
  await symlink(join(testVaultPath, "real-folder"), join(testVaultPath, "linked-folder"));

  const listing = await fileSystem.listDirectory("");
  expect(listing.directories).toContain("linked-folder");
});

test("broken symlink is handled gracefully", async () => {
  await symlink("/nonexistent/path/file.md", join(testVaultPath, "broken-link.md"));

  await expect(fileSystem.readNote("broken-link.md"))
    .rejects.toThrow(/Cannot resolve symlink/);
});

test("symlinked file outside vault is skipped in listDirectory", async () => {
  const outsideDir = await mkdtemp(join(tmpdir(), "mcpvault-outside-"));
  const outsideFile = join(outsideDir, "secret.txt");
  await writeFile(outsideFile, "SECRET");

  try {
    await symlink(outsideFile, join(testVaultPath, "evil-file-link.md"));
    const listing = await fileSystem.listDirectory("");
    expect(listing.files).not.toContain("evil-file-link.md");
  } finally {
    await rm(outsideDir, { recursive: true });
  }
});

test("write to new file in vault works (no symlink, ENOENT path)", async () => {
  await fileSystem.writeNote({ path: "brand-new.md", content: "# New Note" });
  const note = await fileSystem.readNote("brand-new.md");
  expect(note.content).toContain("New Note");
});

test("path with regex special chars is treated literally", async () => {
  const testPath = "folder (copy)/note [1].md";
  const content = "# Test with special chars";

  await mkdir(join(testVaultPath, "folder (copy)"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toContain("Test with special chars");
});

test("path with dollar sign works", async () => {
  const testPath = "$special/price$100.md";
  const content = "# Price note";

  await mkdir(join(testVaultPath, "$special"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toContain("Price note");
});

test("path with plus sign works", async () => {
  const testPath = "C++/notes.md";
  const content = "# C++ notes";

  await mkdir(join(testVaultPath, "C++"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toContain("C++ notes");
});

test("path with pipe character works", async () => {
  const testPath = "choice|option.md";
  const content = "# Choice note";

  await writeFile(join(testVaultPath, testPath), content);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toContain("Choice note");
});

test("delete note with special chars in path", async () => {
  const testPath = "folder (archive)/note [old].md";
  const content = "# Old note";

  await mkdir(join(testVaultPath, "folder (archive)"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.deleteNote({
    path: testPath,
    confirmPath: testPath
  });

  expect(result.success).toBe(true);
});

test("move note with special chars in both paths", async () => {
  const oldPath = "source (1)/note [a].md";
  const newPath = "dest (2)/note [b].md";
  const content = "# Moving note";

  await mkdir(join(testVaultPath, "source (1)"), { recursive: true });
  await mkdir(join(testVaultPath, "dest (2)"), { recursive: true });
  await writeFile(join(testVaultPath, oldPath), content);

  const result = await fileSystem.moveNote({
    oldPath,
    newPath
  });

  expect(result.success).toBe(true);

  const note = await fileSystem.readNote(newPath);
  expect(note.content).toContain("Moving note");
});

test("move note preserves raw frontmatter when the destination parent is missing", async () => {
  const oldPath = "A/note.md";
  const newPath = "B/note.md";
  const content = "---\ntitle: \"Quoted: Title\"\ntags:\n  - alpha\n  - beta\n---\n\n# Heading\n\nBody with  trailing spaces  \n";

  await mkdir(join(testVaultPath, "A"), { recursive: true });
  await writeFile(join(testVaultPath, oldPath), content);

  const result = await fileSystem.moveNote({ oldPath, newPath });

  expect(result.success).toBe(true);
  expect(await readFile(join(testVaultPath, newPath), "utf-8")).toBe(content);
  await expect(readFile(join(testVaultPath, oldPath))).rejects.toMatchObject({ code: "ENOENT" });
});

test("move note rejects a directory source without creating the destination", async () => {
  await mkdir(join(testVaultPath, "notes"), { recursive: true });
  await mkdir(join(testVaultPath, "note.md", "nested"), { recursive: true });
  await writeFile(join(testVaultPath, "note.md/nested/child.md"), "inside");

  const directory = await fileSystem.moveNote({
    oldPath: "notes",
    newPath: "created/out.md"
  });
  expect(directory.success).toBe(false);
  expect(directory.message).toBe("Source path is a directory: notes. Please provide a file path.");
  expect(await fileSystem.exists("created")).toBe(false);

  const namedLikeNote = await fileSystem.moveNote({
    oldPath: "note.md",
    newPath: "created/out.md"
  });
  expect(namedLikeNote.success).toBe(false);
  expect(namedLikeNote.message).toBe("Source path is a directory: note.md. Please provide a file path.");
  expect(await fileSystem.exists("created")).toBe(false);
  expect(await readFile(join(testVaultPath, "note.md/nested/child.md"), "utf-8")).toBe("inside");
});

test("move note rejects directory destinations without suggesting overwrite", async () => {
  const source = "source-bytes";
  await writeFile(join(testVaultPath, "source.md"), source);
  await mkdir(join(testVaultPath, "empty-dir"));
  await mkdir(join(testVaultPath, "folder.md/nested"), { recursive: true });
  await writeFile(join(testVaultPath, "folder.md/nested/child.md"), "child-bytes");

  for (const newPath of ["empty-dir", "folder.md"]) {
    for (const overwrite of [false, true]) {
      const result = await fileSystem.moveNote({
        oldPath: "source.md",
        newPath,
        overwrite
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe(`Target path is a directory: ${newPath}. Please provide a file path.`);
      expect(result.message).not.toContain("overwrite");
    }
  }

  expect(await readFile(join(testVaultPath, "source.md"), "utf-8")).toBe(source);
  expect(await fileSystem.listDirectory("empty-dir")).toEqual({ files: [], directories: [] });
  expect(await readFile(join(testVaultPath, "folder.md/nested/child.md"), "utf-8")).toBe("child-bytes");
});

test("move note rejects the same resolved path without deleting content", async () => {
  const content = "---\ntitle: Keep\n---\n\nKeep body\n";
  await mkdir(join(testVaultPath, "notes"));
  await writeFile(join(testVaultPath, "notes/keep.md"), content);

  for (const newPath of ["notes/keep.md", "notes/./keep.md", "notes/../notes/keep.md"]) {
    for (const overwrite of [false, true]) {
      const result = await fileSystem.moveNote({ oldPath: "notes/keep.md", newPath, overwrite });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Source and target paths are the same");
      expect(await readFile(join(testVaultPath, "notes/keep.md"), "utf8")).toBe(content);
    }
  }
});

test("move note keeps regular-file collision behavior", async () => {
  await writeFile(join(testVaultPath, "source.md"), "source-bytes");
  await writeFile(join(testVaultPath, "target.md"), "target-bytes");

  const blocked = await fileSystem.moveNote({
    oldPath: "source.md",
    newPath: "target.md",
    overwrite: false
  });
  expect(blocked.success).toBe(false);
  expect(blocked.message).toBe("Target file already exists: target.md. Use overwrite=true to replace it.");
  expect(await readFile(join(testVaultPath, "source.md"), "utf-8")).toBe("source-bytes");
  expect(await readFile(join(testVaultPath, "target.md"), "utf-8")).toBe("target-bytes");

  const replaced = await fileSystem.moveNote({
    oldPath: "source.md",
    newPath: "target.md",
    overwrite: true
  });
  expect(replaced.success).toBe(true);
  expect(await readFile(join(testVaultPath, "target.md"), "utf-8")).toBe("source-bytes");
  await expect(readFile(join(testVaultPath, "source.md"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("move note reports a missing source with the existing message", async () => {
  const result = await fileSystem.moveNote({
    oldPath: "missing.md",
    newPath: "dest/missing.md"
  });

  expect(result.success).toBe(false);
  expect(result.message).toBe("Source file not found: missing.md. Use list_directory to see available files.");
  expect(await fileSystem.exists("dest")).toBe(false);
});

test("move note classifies EISDIR from read and write without unlinking the source", async () => {
  const source = "source-bytes";
  await writeFile(join(testVaultPath, "source.md"), source);
  const eisdir = Object.assign(new Error("EISDIR: illegal operation on a directory, open"), { code: "EISDIR" });

  fsFaults.readFile = eisdir;
  try {
    const result = await fileSystem.moveNote({
      oldPath: "source.md",
      newPath: "dest/note.md"
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Source path is a directory: source.md. Please provide a file path.");
    expect(result.message).not.toContain("overwrite");
  } finally {
    fsFaults.readFile = undefined;
  }
  expect(await readFile(join(testVaultPath, "source.md"), "utf-8")).toBe(source);
  expect(await fileSystem.exists("dest")).toBe(false);

  for (const overwrite of [false, true]) {
    fsFaults.writeFile = eisdir;
    try {
      const result = await fileSystem.moveNote({
        oldPath: "source.md",
        newPath: "dest/note.md",
        overwrite
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Target path is a directory: dest/note.md. Please provide a file path.");
      expect(result.message).not.toContain("overwrite");
    } finally {
      fsFaults.writeFile = undefined;
    }
  }
  expect(await readFile(join(testVaultPath, "source.md"), "utf-8")).toBe(source);
});

test("move note classifies directory write failures without masking permission errors", async () => {
  await writeFile(join(testVaultPath, "source.md"), "keep");
  await mkdir(join(testVaultPath, "target"));

  for (const code of ["EEXIST", "EPERM", "EACCES"]) {
    fsFaults.writeFile = Object.assign(new Error(`${code}: write failed`), { code });
    try {
      const directory = await fileSystem.moveNote({ oldPath: "source.md", newPath: "target", overwrite: true });
      expect(directory.message).toBe("Target path is a directory: target. Please provide a file path.");
      expect(directory.success).toBe(false);

      const missing = await fileSystem.moveNote({ oldPath: "source.md", newPath: "missing.md" });
      expect(missing.success).toBe(false);
      expect(missing.message).not.toContain("is a directory");
      if (code !== "EEXIST") {
        expect(missing.message).toBe(`Failed to move note: ${code}: write failed`);
      }
    } finally {
      fsFaults.writeFile = undefined;
    }
  }
  expect(await readFile(join(testVaultPath, "source.md"), "utf8")).toBe("keep");
});

test("move note keeps unrelated I/O errors from being classified as directories", async () => {
  const source = "source-bytes";
  await writeFile(join(testVaultPath, "source.md"), source);
  const eio = Object.assign(
    new Error("directory scan hit a transient input/output error"),
    { code: "EIO" }
  );
  fsFaults.readFile = eio;
  try {
    const result = await fileSystem.moveNote({
      oldPath: "source.md",
      newPath: "dest/note.md"
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Failed to move note: directory scan hit a transient input/output error"
    );
    expect(result.message).not.toContain("Please provide a file path");
  } finally {
    fsFaults.readFile = undefined;
  }
  expect(await readFile(join(testVaultPath, "source.md"), "utf-8")).toBe(source);
  expect(await fileSystem.exists("dest")).toBe(false);
});

test("move note rejects restricted paths and traversal before moving files", async () => {
  await mkdir(join(testVaultPath, ".obsidian"), { recursive: true });
  await writeFile(join(testVaultPath, ".obsidian/secret.md"), "secret");
  await writeFile(join(testVaultPath, "visible.md"), "visible");

  const fromObsidian = await fileSystem.moveNote({
    oldPath: ".obsidian/secret.md",
    newPath: "stolen.md"
  });
  expect(fromObsidian.success).toBe(false);
  expect(fromObsidian.message).toContain("Access denied: .obsidian/secret.md");
  expect(await readFile(join(testVaultPath, ".obsidian/secret.md"), "utf-8")).toBe("secret");
  expect(await fileSystem.exists("stolen.md")).toBe(false);

  const toGit = await fileSystem.moveNote({
    oldPath: "visible.md",
    newPath: ".git/visible.md"
  });
  expect(toGit.success).toBe(false);
  expect(toGit.message).toContain("Access denied: .git/visible.md");
  expect(await readFile(join(testVaultPath, "visible.md"), "utf-8")).toBe("visible");

  await expect(fileSystem.moveNote({
    oldPath: "../outside.md",
    newPath: "inside.md"
  })).rejects.toThrow(/Path traversal not allowed/);

  await expect(fileSystem.moveNote({
    oldPath: "visible.md",
    newPath: "../outside.md"
  })).rejects.toThrow(/Path traversal not allowed/);
  expect(await readFile(join(testVaultPath, "visible.md"), "utf-8")).toBe("visible");
});

test("move_file moves binary files without corruption", async () => {
  const oldPath = "attachments/original image.png";
  const newPath = "assets/original image.png";
  const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10, 0x42]);

  await mkdir(join(testVaultPath, "attachments"), { recursive: true });
  await writeFile(join(testVaultPath, oldPath), binaryContent);

  const result = await fileSystem.moveFile({
    oldPath,
    newPath,
    confirmOldPath: oldPath,
    confirmNewPath: newPath
  });
  expect(result.success).toBe(true);

  const moved = await readFile(join(testVaultPath, newPath));
  expect(Buffer.compare(moved, binaryContent)).toBe(0);

  await expect(readFile(join(testVaultPath, oldPath))).rejects.toMatchObject({ code: "ENOENT" });
});

test("move_file respects overwrite=false", async () => {
  const oldPath = "attachments/image.png";
  const newPath = "assets/image.png";

  await mkdir(join(testVaultPath, "attachments"), { recursive: true });
  await mkdir(join(testVaultPath, "assets"), { recursive: true });
  await writeFile(join(testVaultPath, oldPath), Buffer.from([0x01, 0x02, 0x03]));
  await writeFile(join(testVaultPath, newPath), Buffer.from([0xaa, 0xbb]));

  const result = await fileSystem.moveFile({
    oldPath,
    newPath,
    confirmOldPath: oldPath,
    confirmNewPath: newPath,
    overwrite: false
  });
  expect(result.success).toBe(false);
  expect(result.message).toContain("Target file already exists");
});

test("move_file overwrites existing file when overwrite=true", async () => {
  const oldPath = "attachments/image.png";
  const newPath = "assets/image.png";
  const replacement = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

  await mkdir(join(testVaultPath, "attachments"), { recursive: true });
  await mkdir(join(testVaultPath, "assets"), { recursive: true });
  await writeFile(join(testVaultPath, oldPath), replacement);
  await writeFile(join(testVaultPath, newPath), Buffer.from([0x00]));

  const result = await fileSystem.moveFile({
    oldPath,
    newPath,
    confirmOldPath: oldPath,
    confirmNewPath: newPath,
    overwrite: true
  });
  expect(result.success).toBe(true);

  const moved = await readFile(join(testVaultPath, newPath));
  expect(Buffer.compare(moved, replacement)).toBe(0);
});

test("move_file rejects directory sources", async () => {
  await mkdir(join(testVaultPath, "attachments/folder"), { recursive: true });

  const result = await fileSystem.moveFile({
    oldPath: "attachments/folder",
    newPath: "assets/folder",
    confirmOldPath: "attachments/folder",
    confirmNewPath: "assets/folder"
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain("supports files only");
});

test("move_file blocks restricted system paths", async () => {
  const result = await fileSystem.moveFile({
    oldPath: ".obsidian/plugins/data.json",
    newPath: "assets/data.json",
    confirmOldPath: ".obsidian/plugins/data.json",
    confirmNewPath: "assets/data.json"
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain("Access denied");
});

test("move_file requires matching confirmation paths", async () => {
  const oldPath = "attachments/check.png";
  const newPath = "assets/check.png";

  await mkdir(join(testVaultPath, "attachments"), { recursive: true });
  await writeFile(join(testVaultPath, oldPath), Buffer.from([0x11, 0x22]));

  const result = await fileSystem.moveFile({
    oldPath,
    newPath,
    confirmOldPath: "attachments/other.png",
    confirmNewPath: newPath
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain("confirmation paths do not match");

  const stillExists = await readFile(join(testVaultPath, oldPath));
  expect(Buffer.compare(stillExists, Buffer.from([0x11, 0x22]))).toBe(0);
});

test("patch note with regex special chars in oldString", async () => {
  const testPath = "regex-test.md";
  const content = "Price: $10.50 (discount)";

  await writeFile(join(testVaultPath, testPath), content);

  const result = await fileSystem.patchNote({
    path: testPath,
    oldString: "$10.50 (discount)",
    newString: "$15.00 (regular)",
    replaceAll: false
  });

  expect(result.success).toBe(true);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toContain("$15.00 (regular)");
});

// Note: searchNotes is in SearchService, not FileSystemService
// Search tests with regex special chars should be in search.test.ts

// ============================================================================
// UNICODE AND INTERNATIONAL PATHS
// ============================================================================

test("handles unicode in file paths", async () => {
  const testPath = "日本語/ノート.md";
  const content = "# Japanese note";

  await mkdir(join(testVaultPath, "日本語"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toContain("Japanese note");
});

test("handles emoji in file paths", async () => {
  const testPath = "📁/🎉.md";
  const content = "# Emoji note";

  await mkdir(join(testVaultPath, "📁"), { recursive: true });
  await writeFile(join(testVaultPath, testPath), content);

  const note = await fileSystem.readNote(testPath);
  expect(note.content).toContain("Emoji note");
});

// ============================================================================
// VAULT STATS TESTS
// ============================================================================

test("get vault stats with empty vault", async () => {
  const stats = await fileSystem.getVaultStats();

  expect(stats.totalNotes).toBe(0);
  expect(stats.totalFolders).toBe(0);
  expect(stats.totalSize).toBe(0);
  expect(stats.recentlyModified).toHaveLength(0);
});

test("get vault stats counts notes and folders", async () => {
  await mkdir(join(testVaultPath, "folder1"), { recursive: true });
  await mkdir(join(testVaultPath, "folder2/nested"), { recursive: true });
  await writeFile(join(testVaultPath, "note1.md"), "# Note 1");
  await writeFile(join(testVaultPath, "folder1/note2.md"), "# Note 2");
  await writeFile(join(testVaultPath, "folder2/nested/note3.md"), "# Note 3");

  const stats = await fileSystem.getVaultStats();

  expect(stats.totalNotes).toBe(3);
  expect(stats.totalFolders).toBe(3); // folder1, folder2, folder2/nested
  expect(stats.totalSize).toBeGreaterThan(0);
});

test("get vault stats returns recently modified files in order", async () => {
  // Create files with slight delays to ensure different modification times
  await writeFile(join(testVaultPath, "old.md"), "# Old");
  await new Promise(resolve => setTimeout(resolve, 10));
  await writeFile(join(testVaultPath, "middle.md"), "# Middle");
  await new Promise(resolve => setTimeout(resolve, 10));
  await writeFile(join(testVaultPath, "recent.md"), "# Recent");

  const stats = await fileSystem.getVaultStats(3);

  expect(stats.recentlyModified).toHaveLength(3);
  expect(stats.recentlyModified[0]?.path).toBe("recent.md");
  expect(stats.recentlyModified[1]?.path).toBe("middle.md");
  expect(stats.recentlyModified[2]?.path).toBe("old.md");
});

test("get vault stats respects recentCount limit", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "# Note 1");
  await writeFile(join(testVaultPath, "note2.md"), "# Note 2");
  await writeFile(join(testVaultPath, "note3.md"), "# Note 3");

  const stats = await fileSystem.getVaultStats(2);

  expect(stats.recentlyModified).toHaveLength(2);
});

test("get vault stats excludes filtered paths", async () => {
  await mkdir(join(testVaultPath, ".obsidian"), { recursive: true });
  await mkdir(join(testVaultPath, ".git"), { recursive: true });
  await writeFile(join(testVaultPath, ".obsidian/config.json"), "{}");
  await writeFile(join(testVaultPath, ".git/config"), "git config");
  await writeFile(join(testVaultPath, "visible.md"), "# Visible");

  const stats = await fileSystem.getVaultStats();

  expect(stats.totalNotes).toBe(1);
  expect(stats.totalFolders).toBe(0); // .obsidian and .git are filtered
  expect(stats.recentlyModified.map(f => f.path)).toContain("visible.md");
  expect(stats.recentlyModified.map(f => f.path)).not.toContain(".obsidian/config.json");
});

test("get vault stats excludes files matched by custom ** ignored patterns", async () => {
  const customFilter = new PathFilter({
    ignoredPatterns: ["ignored/**"]
  });
  const customFileSystem = new FileSystemService(testVaultPath, customFilter);

  await mkdir(join(testVaultPath, "ignored"), { recursive: true });
  await mkdir(join(testVaultPath, "ignored/nested"), { recursive: true });
  await writeFile(join(testVaultPath, "ignored/something.md"), "# Disallowed 1");
  await writeFile(join(testVaultPath, "ignored/nested/something.md"), "# Disallowed 2");
  await writeFile(join(testVaultPath, "visible.md"), "# Visible");

  const stats = await customFileSystem.getVaultStats(10);
  const recentPaths = stats.recentlyModified.map(file => file.path);

  expect(stats.totalNotes).toBe(1);
  expect(recentPaths).toContain("visible.md");
  expect(recentPaths).not.toContain("ignored/something.md");
  expect(recentPaths).not.toContain("ignored/nested/something.md");
});

test("get vault stats includes notes inside directories that contain dots", async () => {
  await mkdir(join(testVaultPath, "2026.03"), { recursive: true });
  await writeFile(join(testVaultPath, "2026.03/nested.md"), "# Nested");
  await writeFile(join(testVaultPath, "root.md"), "# Root");

  const stats = await fileSystem.getVaultStats(10);
  const recentPaths = stats.recentlyModified.map(file => file.path);

  expect(stats.totalNotes).toBe(2);
  expect(stats.totalFolders).toBe(1);
  expect(recentPaths).toContain("2026.03/nested.md");
  expect(recentPaths).toContain("root.md");
});

test("get vault stats calculates total size correctly", async () => {
  const content1 = "# Note 1 with some content";
  const content2 = "# Note 2 with more content here";
  await writeFile(join(testVaultPath, "note1.md"), content1);
  await writeFile(join(testVaultPath, "note2.md"), content2);

  const stats = await fileSystem.getVaultStats();

  const expectedSize = Buffer.byteLength(content1) + Buffer.byteLength(content2);
  expect(stats.totalSize).toBe(expectedSize);
});

// ============================================================================
// ERROR MESSAGE TESTS
// ============================================================================

test("error messages include remediation suggestions for file not found", async () => {
  await expect(fileSystem.readNote("nonexistent.md"))
    .rejects.toThrow(/list_directory/);
});

test("error messages include remediation suggestions for access denied", async () => {
  await expect(fileSystem.readNote(".obsidian/config.json"))
    .rejects.toThrow(/restricted/);
});

test("error messages include remediation suggestions for path traversal", async () => {
  await expect(fileSystem.readNote("../outside.md"))
    .rejects.toThrow(/within the vault/);
});

// ============================================================================
// LIST ALL TAGS
// ============================================================================

test("listAllTags returns frontmatter tags with counts", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "---\ntags:\n  - project\n  - active\n---\n# Note 1");
  await writeFile(join(testVaultPath, "note2.md"), "---\ntags:\n  - project\n  - done\n---\n# Note 2");

  const tags = await fileSystem.listAllTags();
  const projectTag = tags.find(t => t.tag === "project");
  const activeTag = tags.find(t => t.tag === "active");
  const doneTag = tags.find(t => t.tag === "done");

  expect(projectTag?.count).toBe(2);
  expect(activeTag?.count).toBe(1);
  expect(doneTag?.count).toBe(1);
});

test("listAllTags returns inline hashtags with counts", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "# Note\nSome text #idea and #project here");
  await writeFile(join(testVaultPath, "note2.md"), "# Note\nAnother #idea");

  const tags = await fileSystem.listAllTags();
  const ideaTag = tags.find(t => t.tag === "idea");
  const projectTag = tags.find(t => t.tag === "project");

  expect(ideaTag?.count).toBe(2);
  expect(projectTag?.count).toBe(1);
});

test("listAllTags merges frontmatter and inline tags", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "---\ntags:\n  - project\n---\n# Note\nAlso #project inline");

  const tags = await fileSystem.listAllTags();
  const projectTag = tags.find(t => t.tag === "project");

  expect(projectTag?.count).toBe(2);
});

test("listAllTags normalizes case", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "---\ntags:\n  - Project\n---\n# Note");
  await writeFile(join(testVaultPath, "note2.md"), "# Note\n#project here");

  const tags = await fileSystem.listAllTags();
  const projectTag = tags.find(t => t.tag === "project");

  expect(projectTag?.count).toBe(2);
});

test("listAllTags handles nested tags", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "---\ntags:\n  - status/active\n---\n# Note\n#status/done");

  const tags = await fileSystem.listAllTags();
  const activeTag = tags.find(t => t.tag === "status/active");
  const doneTag = tags.find(t => t.tag === "status/done");

  expect(activeTag?.count).toBe(1);
  expect(doneTag?.count).toBe(1);
});

test("listAllTags returns sorted by count descending", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "---\ntags:\n  - rare\n  - common\n---\n# Note");
  await writeFile(join(testVaultPath, "note2.md"), "---\ntags:\n  - common\n---\n# Note\n#common again");

  const tags = await fileSystem.listAllTags();

  expect(tags[0]?.tag).toBe("common");
  expect(tags[0]?.count).toBe(3);
});

test("listAllTags returns empty array for vault with no tags", async () => {
  await writeFile(join(testVaultPath, "note1.md"), "# Just a heading\nNo tags here");

  const tags = await fileSystem.listAllTags();
  expect(tags).toEqual([]);
});

test("listAllTags skips system directories", async () => {
  await mkdir(join(testVaultPath, ".obsidian"), { recursive: true });
  await writeFile(join(testVaultPath, ".obsidian/config.json"), '{"tags": ["hidden"]}');
  await writeFile(join(testVaultPath, "note.md"), "---\ntags:\n  - visible\n---\n# Note");

  const tags = await fileSystem.listAllTags();

  expect(tags).toHaveLength(1);
  expect(tags[0]?.tag).toBe("visible");
});

describe("classifyWriteError (#109)", () => {
  const mk = (code?: string, message = "boom") => {
    const e = new Error(message) as NodeJS.ErrnoException;
    if (code) e.code = code;
    return e;
  };

  test("real ENOSPC maps to 'No space left on device'", () => {
    expect(classifyWriteError(mk("ENOSPC"), "n.md").message).toBe(
      "No space left on device: n.md"
    );
  });

  test("EACCES and EPERM map to 'Permission denied'", () => {
    expect(classifyWriteError(mk("EACCES"), "n.md").message).toBe("Permission denied: n.md");
    expect(classifyWriteError(mk("EPERM"), "n.md").message).toBe("Permission denied: n.md");
  });

  test("EROFS maps to 'Read-only filesystem'", () => {
    expect(classifyWriteError(mk("EROFS"), "n.md").message).toBe("Read-only filesystem: n.md");
  });

  test("error whose message merely contains 'space' is NOT mislabeled as ENOSPC (#109)", () => {
    const err = mk(undefined, "invalid whitespace in namespace");
    const out = classifyWriteError(err, "n.md");
    // No fs code + a real Error => preserved as-is, never rewritten to ENOSPC
    expect(out).toBe(err);
    expect(out.message).not.toContain("No space left on device");
  });

  test("unknown fs code falls back to a 'Failed to write file' wrapper preserving the message", () => {
    const out = classifyWriteError(mk("EBUSY", "resource busy"), "n.md");
    expect(out.message).toBe("Failed to write file: n.md - resource busy");
  });

  test("non-Error value yields a generic failure", () => {
    expect(classifyWriteError("nope", "n.md").message).toBe(
      "Failed to write file: n.md - Unknown error"
    );
  });
});

// ============================================================================
// FIND PATH FOR WIKI LINK TESTS
// ============================================================================

describe("findPathForWikiLink (#101)", () => {
  test("findPathForWikiLink returns empty array on zero match", async () => {
    await writeFile(join(testVaultPath, "Other.md"), "# Other");
    const matches = await fileSystem.findPathForWikiLink("Missing");
    expect(matches).toEqual([]);
  });

  test("findPathForWikiLink returns single match as one-element array", async () => {
    await writeFile(join(testVaultPath, "Note.md"), "# Note");
    const matches = await fileSystem.findPathForWikiLink("Note");
    expect(matches).toEqual(["Note.md"]);
  });

  test("findPathForWikiLink sorts root before nested", async () => {
    await writeFile(join(testVaultPath, "Note.md"), "# root");
    await mkdir(join(testVaultPath, "deep/nested"), { recursive: true });
    await writeFile(join(testVaultPath, "deep/nested/Note.md"), "# nested");
    const matches = await fileSystem.findPathForWikiLink("Note");
    expect(matches).toEqual(["Note.md", "deep/nested/Note.md"]);
  });

  test("findPathForWikiLink alphabetical tiebreak at equal depth", async () => {
    await mkdir(join(testVaultPath, "zeta"), { recursive: true });
    await mkdir(join(testVaultPath, "alpha"), { recursive: true });
    await writeFile(join(testVaultPath, "zeta/Note.md"), "# zeta");
    await writeFile(join(testVaultPath, "alpha/Note.md"), "# alpha");
    const matches = await fileSystem.findPathForWikiLink("Note");
    expect(matches).toEqual(["alpha/Note.md", "zeta/Note.md"]);
  });

  test("findPathForWikiLink throws on empty name (caller misuse)", async () => {
    await expect(fileSystem.findPathForWikiLink("")).rejects.toThrow(/Empty wiki link/);
    await expect(fileSystem.findPathForWikiLink("   ")).rejects.toThrow(/Empty wiki link/);
  });

  test("findPathForWikiLink resolves path-qualified name to exact path", async () => {
    await writeFile(join(testVaultPath, "Note.md"), "# root");
    await mkdir(join(testVaultPath, "deep"), { recursive: true });
    await writeFile(join(testVaultPath, "deep/Note.md"), "# deep");
    const matches = await fileSystem.findPathForWikiLink("deep/Note");
    expect(matches).toEqual(["deep/Note.md"]);
  });

  test("findPathForWikiLink path-qualified name does not match basename elsewhere", async () => {
    await writeFile(join(testVaultPath, "Note.md"), "# root");
    const matches = await fileSystem.findPathForWikiLink("missing/Note");
    expect(matches).toEqual([]);
  });

  test("findPathForWikiLink path-qualified name matches nested folders", async () => {
    await mkdir(join(testVaultPath, "a/b"), { recursive: true });
    await writeFile(join(testVaultPath, "a/b/Note.md"), "# nested");
    const matches = await fileSystem.findPathForWikiLink("a/b/Note");
    expect(matches).toEqual(["a/b/Note.md"]);
  });
});
