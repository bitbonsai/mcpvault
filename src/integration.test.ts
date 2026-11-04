import { test, expect, beforeEach, afterEach, describe } from "vitest";
import { FileSystemService } from "./filesystem.js";
import { FrontmatterHandler } from "./frontmatter.js";
import { PathFilter } from "./pathfilter.js";
import { SearchService } from "./search.js";
import { writeFile, mkdir, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

let testVaultPath: string;
let pathFilter: PathFilter;
let frontmatterHandler: FrontmatterHandler;
let fileSystem: FileSystemService;
let searchService: SearchService;

beforeEach(async () => {
  testVaultPath = await mkdtemp(join(tmpdir(), "mcpvault-integration-"));

  // Initialize services (same as server.ts)
  pathFilter = new PathFilter();
  frontmatterHandler = new FrontmatterHandler();
  fileSystem = new FileSystemService(testVaultPath, pathFilter, frontmatterHandler);
  searchService = new SearchService(testVaultPath, pathFilter);
});

afterEach(async () => {
  try {
    await rm(testVaultPath, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ============================================================================
// INTEGRATION TESTS - END-TO-END WORKFLOW
// ============================================================================

describe("Integration: Service Layer Workflows", () => {
  test("write, read, and delete note workflow", async () => {
    // 1. Write a note with frontmatter
    await fileSystem.writeNote({
      path: "test-note.md",
      content: "# Test Note\n\nThis is a test.",
      frontmatter: { tags: ["test"], status: "draft" }
    });

    // 2. Read the note back
    const note = await fileSystem.readNote("test-note.md");
    expect(note.content).toContain("This is a test");
    expect(note.frontmatter?.tags).toEqual(["test"]);
    expect(note.frontmatter?.status).toBe("draft");

    // 3. Delete the note (a second note keeps the vault from becoming empty)
    await fileSystem.writeNote({ path: "keep.md", content: "# Kept" });
    const deleteResult = await fileSystem.deleteNote({
      path: "test-note.md",
      confirmPath: "test-note.md"
    });
    expect(deleteResult.success).toBe(true);
  });

  test("search notes with special characters in filenames", async () => {
    // Create notes with special characters in paths
    const testCases = [
      { path: "folder (archive)/note [old].md", content: "# Old Note\n\nArchived keyword." },
      { path: "C++/notes.md", content: "# C++ Notes\n\nProgramming keyword." },
      { path: "backup.2024/important.md", content: "# Important\n\nBackup keyword." },
      { path: "price$100.md", content: "# Pricing\n\nCost keyword." }
    ];

    // Write all test notes
    for (const { path, content } of testCases) {
      if (path.includes('/')) {
        const dirName = path.split('/')[0];
        if (dirName) {
          await mkdir(join(testVaultPath, dirName), { recursive: true });
        }
      }
      await writeFile(join(testVaultPath, path), content);
    }

    // Search for keyword
    const results = await searchService.search({
      query: "keyword",
      limit: 10
    });

    expect(results.length).toBe(4);

    // Verify paths with special characters are returned correctly
    const paths = results.map((r: any) => r.p);
    expect(paths).toContain("folder (archive)/note [old].md");
    expect(paths).toContain("C++/notes.md");
  });

  test("write note with regex special chars in content", async () => {
    const content = `# Price List

Item: Widget ($10.50)
Regex: [a-z]+ matches lowercase
Math: 2 + 2 = 4
Pattern: backup.2024/**/*.md`;

    await fileSystem.writeNote({
      path: "special-chars.md",
      content
    });

    // Read back and verify exact content
    const note = await fileSystem.readNote("special-chars.md");
    expect(note.content).toContain("($10.50)");
    expect(note.content).toContain("[a-z]+");
    expect(note.content).toContain("2 + 2 = 4");
    expect(note.content).toContain("backup.2024/**/*.md");
  });

  test("search matches note filename even without content match", async () => {
    // Issue #30: notes without a heading that rely on filename for discovery
    await fileSystem.writeNote({
      path: "Yard.md",
      content: "Some info about lawn care and gardening tips."
    });
    await fileSystem.writeNote({
      path: "Kitchen.md",
      content: "Recipes and kitchen organization."
    });

    // Search for "yard" — should match Yard.md by filename
    const results = await searchService.search({
      query: "yard",
      searchContent: true,
      limit: 10
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.p === "Yard.md")).toBe(true);

    // Verify filename-only match has reasonable fields
    const yardResult = results.find(r => r.p === "Yard.md")!;
    expect(yardResult.t).toBe("Yard");
    expect(yardResult.mc).toBeGreaterThanOrEqual(1);

    // Search for "kitchen" — should match Kitchen.md by filename
    const kitchenResults = await searchService.search({
      query: "kitchen",
      searchContent: true,
      limit: 10
    });

    // Should match both filename AND content (content contains "kitchen")
    expect(kitchenResults.some(r => r.p === "Kitchen.md")).toBe(true);
  });

  test("multi-step workflow: search, read multiple, update frontmatter", async () => {
    // Create several notes
    for (let i = 1; i <= 3; i++) {
      await fileSystem.writeNote({
        path: `note-${i}.md`,
        content: `# Note ${i}\n\nThis contains searchterm.`,
        frontmatter: { id: i, processed: false }
      });
    }

    // Search for notes
    const searchResults = await searchService.search({
      query: "searchterm",
      limit: 10
    });
    expect(searchResults.length).toBe(3);

    // Read multiple notes
    const paths = searchResults.map(r => r.p);
    const readResult = await fileSystem.readMultipleNotes({
      paths,
      includeContent: true,
      includeFrontmatter: true
    });
    expect(readResult.successful.length).toBe(3);

    // Update frontmatter on all notes
    for (const path of paths) {
      await fileSystem.updateFrontmatter({
        path,
        frontmatter: { processed: true },
        merge: true
      });
    }

    // Verify updates
    for (const path of paths) {
      const note = await fileSystem.readNote(path);
      expect(note.frontmatter?.processed).toBe(true);
    }
  });
});

