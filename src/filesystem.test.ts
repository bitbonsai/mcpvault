import { test, expect, beforeEach, afterEach, describe } from "vitest";
import { FileSystemService, classifyWriteError } from "./filesystem.js";
import { PathFilter } from "./pathfilter.js";
import { writeFile, readFile, mkdir, mkdtemp, rm, symlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

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

  const trashedExists = await fileSystem.exists(".trash/trash-test.md");
  expect(trashedExists).toBe(true);
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
    .rejects.toThrow(/File not found/);
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
