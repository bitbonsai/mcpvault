import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { SearchService } from "./search.js";
import { PathFilter } from "./pathfilter.js";
import { writeFile, mkdir, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

let testVaultPath: string;
let searchService: SearchService;

beforeEach(async () => {
  testVaultPath = await mkdtemp(join(tmpdir(), "mcpvault-search-"));
  searchService = new SearchService(testVaultPath, new PathFilter());
});

afterEach(async () => {
  try {
    await rm(testVaultPath, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});

// Helper to write a note directly to disk
async function writeNote(path: string, content: string) {
  const fullPath = join(testVaultPath, path);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (dir !== testVaultPath) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(fullPath, content);
}

describe("SearchService", () => {
  // ============================================================================
  // BASIC SEARCH
  // ============================================================================

  test("finds notes matching a query", async () => {
    await writeNote("alpha.md", "# Alpha\n\nThis note has bananas.");
    await writeNote("beta.md", "# Beta\n\nThis note has oranges.");

    const results = await searchService.search({ query: "bananas" });

    expect(results).toHaveLength(1);
    expect(results[0]!.p).toBe("alpha.md");
  });

  test("returns empty array when no matches", async () => {
    await writeNote("note.md", "# Note\n\nNothing relevant here.");

    const results = await searchService.search({ query: "zzzznotfound" });

    expect(results).toHaveLength(0);
  });

  test("returns empty array for empty vault", async () => {
    const results = await searchService.search({ query: "anything" });

    expect(results).toHaveLength(0);
  });

  test("throws on empty query", async () => {
    await expect(searchService.search({ query: "" }))
      .rejects.toThrow(/empty/);
  });

  test("throws on whitespace-only query", async () => {
    await expect(searchService.search({ query: "   " }))
      .rejects.toThrow(/empty/);
  });

  // ============================================================================
  // LIMIT
  // ============================================================================

  test("respects limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await writeNote(`note-${i}.md`, `# Note ${i}\n\nkeyword here.`);
    }

    const results = await searchService.search({ query: "keyword", limit: 2 });

    expect(results).toHaveLength(2);
  });

  test("caps limit at 20", async () => {
    for (let i = 0; i < 25; i++) {
      await writeNote(`note-${i}.md`, `# Note ${i}\n\nkeyword here.`);
    }

    const results = await searchService.search({ query: "keyword", limit: 100 });

    expect(results.length).toBeLessThanOrEqual(20);
  });

  test("defaults limit to 5", async () => {
    for (let i = 0; i < 10; i++) {
      await writeNote(`note-${i}.md`, `# Note ${i}\n\nkeyword here.`);
    }

    const results = await searchService.search({ query: "keyword" });

    expect(results).toHaveLength(5);
  });

  // ============================================================================
  // CASE SENSITIVITY
  // ============================================================================

  test("case-insensitive search by default", async () => {
    await writeNote("upper.md", "# Upper\n\nBANANA is great.");
    await writeNote("lower.md", "# Lower\n\nbanana is great.");
    await writeNote("mixed.md", "# Mixed\n\nBanana is great.");

    const results = await searchService.search({ query: "banana", limit: 10 });

    expect(results).toHaveLength(3);
  });

  test("case-sensitive search when enabled", async () => {
    await writeNote("upper.md", "# Upper\n\nBANANA is great.");
    await writeNote("lower.md", "# Lower\n\nbanana is great.");

    const results = await searchService.search({
      query: "BANANA",
      caseSensitive: true,
      limit: 10
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.p).toBe("upper.md");
  });

  // ============================================================================
  // FRONTMATTER SEARCH
  // ============================================================================

  test("excludes frontmatter from content-only search", async () => {
    await writeNote("note.md", "---\ntags: [uniquetag]\n---\n\n# Note\n\nNo tag here.");

    const results = await searchService.search({
      query: "uniquetag",
      searchContent: true,
      searchFrontmatter: false,
      limit: 10
    });

    expect(results).toHaveLength(0);
  });

  test("searches frontmatter when enabled", async () => {
    await writeNote("note.md", "---\ntags: [uniquetag]\n---\n\n# Note\n\nNo tag here.");

    const results = await searchService.search({
      query: "uniquetag",
      searchFrontmatter: true,
      limit: 10
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.p).toBe("note.md");
  });

  test("searches both content and frontmatter together", async () => {
    await writeNote("fm-only.md", "---\nstatus: special\n---\n\n# Note\n\nPlain body.");
    await writeNote("content-only.md", "# Note\n\nThis is special content.");

    const results = await searchService.search({
      query: "special",
      searchContent: true,
      searchFrontmatter: true,
      limit: 10
    });

    expect(results).toHaveLength(2);
  });

  // ============================================================================
  // FILENAME MATCHING
  // ============================================================================

  test("matches by filename when content has no match", async () => {
    await writeNote("Recipes.md", "Some unrelated content about cooking.");

    const results = await searchService.search({ query: "recipes", limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0]!.p).toBe("Recipes.md");
    expect(results[0]!.t).toBe("Recipes");
  });

  // ============================================================================
  // MULTI-TERM SEARCH
  // ============================================================================

  test("multi-term search matches notes with any term", async () => {
    await writeNote("cats.md", "# Cats\n\nI love cats.");
    await writeNote("dogs.md", "# Dogs\n\nI love dogs.");
    await writeNote("fish.md", "# Fish\n\nI love fish.");

    const results = await searchService.search({ query: "cats dogs", limit: 10 });

    const paths = results.map(r => r.p);
    expect(paths).toContain("cats.md");
    expect(paths).toContain("dogs.md");
    expect(paths).not.toContain("fish.md");
  });

  // ============================================================================
  // RANKING
  // ============================================================================

  test("ranks notes with more matches higher", async () => {
    await writeNote("few.md", "# Few\n\napple once.");
    await writeNote("many.md", "# Many\n\napple apple apple apple apple.");

    const results = await searchService.search({ query: "apple", limit: 10 });

    expect(results).toHaveLength(2);
    expect(results[0]!.p).toBe("many.md");
  });

  // ============================================================================
  // RESULT SHAPE
  // ============================================================================

  test("results include expected fields", async () => {
    await writeNote("folder/note.md", "# My Note\n\nSome content with target word.");

    const results = await searchService.search({ query: "target", limit: 10 });

    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.p).toBe("folder/note.md");
    expect(r.t).toBe("note");
    expect(r.ex).toBeDefined();
    expect(r.mc).toBeGreaterThanOrEqual(1);
    expect(r.ln).toBeGreaterThanOrEqual(1);
    expect(r.uri).toMatch(/^obsidian:\/\//);
  });

  test("excerpt contains context around match", async () => {
    await writeNote("note.md", "# Note\n\nSome words before target some words after.");

    const results = await searchService.search({ query: "target", limit: 10 });

    expect(results[0]!.ex).toContain("target");
  });

  // ============================================================================
  // PATH FILTERING
  // ============================================================================

  test("excludes notes in filtered directories", async () => {
    await writeNote("visible.md", "# Visible\n\nkeyword here.");
    await mkdir(join(testVaultPath, ".obsidian"), { recursive: true });
    await writeFile(join(testVaultPath, ".obsidian/config.md"), "keyword here.");

    const results = await searchService.search({ query: "keyword", limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0]!.p).toBe("visible.md");
  });

  // ============================================================================
  // TRAILING SLASH IN VAULT PATH
  // ============================================================================

  test("vault path with trailing slash does not truncate result paths", async () => {
    const trailingSlashService = new SearchService(testVaultPath + "/", new PathFilter());

    await mkdir(join(testVaultPath, "sessions"), { recursive: true });
    await writeNote("sessions/foo-bar.md", "# Foo Bar\n\nSome content here.");

    const results = await trailingSlashService.search({ query: "foo", limit: 5 });

    expect(results).toHaveLength(1);
    expect(results[0]!.p).toBe("sessions/foo-bar.md");
  });

  describe("path filtering (#126)", () => {
    beforeEach(async () => {
      await writeNote("Projects/a.md", "alpha banana");
      await writeNote("Projects/sub/b.md", "beta banana");
      await writeNote("Archive/old.md", "gamma banana");
      await writeNote("meta/notes.md", "delta banana");
      await writeNote("root.md", "epsilon banana");
    });

    test("pathPrefix restricts results to a subtree", async () => {
      const results = await searchService.search({ query: "banana", limit: 20, pathPrefix: "Projects" });
      const paths = results.map(r => r.p).sort();
      expect(paths).toEqual(["Projects/a.md", "Projects/sub/b.md"]);
    });

    test("pathPrefix is tolerant of leading/trailing slashes", async () => {
      const results = await searchService.search({ query: "banana", limit: 20, pathPrefix: "/Projects/" });
      expect(results.map(r => r.p).sort()).toEqual(["Projects/a.md", "Projects/sub/b.md"]);
    });

    test("excludePaths skips matching subtrees", async () => {
      const results = await searchService.search({ query: "banana", limit: 20, excludePaths: ["Archive", "meta"] });
      const paths = results.map(r => r.p);
      expect(paths).not.toContain("Archive/old.md");
      expect(paths).not.toContain("meta/notes.md");
      expect(paths).toContain("Projects/a.md");
      expect(paths).toContain("root.md");
    });

    test("pathPrefix and excludePaths combine", async () => {
      await writeNote("Projects/Archive/stale.md", "zeta banana");
      const results = await searchService.search({
        query: "banana", limit: 20, pathPrefix: "Projects", excludePaths: ["Projects/Archive"]
      });
      const paths = results.map(r => r.p).sort();
      expect(paths).toEqual(["Projects/a.md", "Projects/sub/b.md"]);
    });

    test("a prefix that is a name-substring of a sibling does not over-match", async () => {
      await writeNote("Project-notes/x.md", "eta banana");
      const results = await searchService.search({ query: "banana", limit: 20, pathPrefix: "Projects" });
      expect(results.map(r => r.p)).not.toContain("Project-notes/x.md");
    });
  });
});
