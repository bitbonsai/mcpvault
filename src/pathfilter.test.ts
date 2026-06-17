import { test, expect, describe } from "vitest";
import { PathFilter } from "./pathfilter.js";

describe("PathFilter", () => {
  // ============================================================================
  // BASIC FUNCTIONALITY
  // ============================================================================

  test("allows markdown files by default", () => {
    const filter = new PathFilter();
    expect(filter.isAllowed("notes/test.md")).toBe(true);
    expect(filter.isAllowed("test.markdown")).toBe(true);
    expect(filter.isAllowed("folder/subfolder/note.txt")).toBe(true);
  });

  test("blocks .obsidian directory", () => {
    const filter = new PathFilter();
    expect(filter.isAllowed(".obsidian")).toBe(false);
    expect(filter.isAllowed(".obsidian/app.json")).toBe(false);
    expect(filter.isAllowed(".obsidian/plugins/plugin/main.js")).toBe(false);
  });

  test("blocks .git directory", () => {
    const filter = new PathFilter();
    expect(filter.isAllowed(".git")).toBe(false);
    expect(filter.isAllowed(".git/config")).toBe(false);
    expect(filter.isAllowed(".git/objects/abc123")).toBe(false);
  });

  test("blocks node_modules", () => {
    const filter = new PathFilter();
    expect(filter.isAllowed("node_modules")).toBe(false);
    expect(filter.isAllowed("node_modules/package/index.js")).toBe(false);
  });

  test("blocks system files", () => {
    const filter = new PathFilter();
    expect(filter.isAllowed(".DS_Store")).toBe(false);
    expect(filter.isAllowed("Thumbs.db")).toBe(false);
  });

  test("blocks non-allowed extensions", () => {
    const filter = new PathFilter();
    expect(filter.isAllowed("script.js")).toBe(false);
    expect(filter.isAllowed("data.json")).toBe(false);
    expect(filter.isAllowed("image.png")).toBe(false);
  });

  test("allows non-note files for directory listing", () => {
    const filter = new PathFilter();
    expect(filter.isAllowedForListing("image.png")).toBe(true);
    expect(filter.isAllowedForListing("docs/report.pdf")).toBe(true);
    expect(filter.isAllowedForListing("archive/data.json")).toBe(true);
  });

  test("blocks restricted paths in directory listing", () => {
    const filter = new PathFilter();
    expect(filter.isAllowedForListing(".obsidian/app.json")).toBe(false);
    expect(filter.isAllowedForListing(".git/config")).toBe(false);
    expect(filter.isAllowedForListing("node_modules/pkg/index.js")).toBe(false);
    expect(filter.isAllowedForListing(".DS_Store")).toBe(false);
  });

  // ============================================================================
  // REGEX SPECIAL CHARACTERS - SECURITY TESTS
  // ============================================================================

  describe("regex special characters in paths", () => {
    test("handles dots in filenames literally", () => {
      const filter = new PathFilter();
      // Dots should be literal, not regex wildcards
      expect(filter.isAllowed("file.name.md")).toBe(true);
      expect(filter.isAllowed("v1.0.0-notes.md")).toBe(true);
    });

    test("handles parentheses in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("notes/(archived)/old.md")).toBe(true);
      expect(filter.isAllowed("project (copy).md")).toBe(true);
    });

    test("handles square brackets in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("notes/[2024]/january.md")).toBe(true);
      expect(filter.isAllowed("[inbox]/task.md")).toBe(true);
    });

    test("handles curly braces in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("templates/{daily}.md")).toBe(true);
    });

    test("handles plus signs in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("C++/notes.md")).toBe(true);
      expect(filter.isAllowed("topic+subtopic.md")).toBe(true);
    });

    test("handles question marks in paths", () => {
      const filter = new PathFilter();
      // Question mark is a glob wildcard, but in actual filenames should work
      expect(filter.isAllowed("FAQ?.md")).toBe(true);
    });

    test("handles asterisks in filenames", () => {
      const filter = new PathFilter();
      // Asterisk in filename (rare but valid on Unix)
      expect(filter.isAllowed("important*.md")).toBe(true);
      expect(filter.isAllowed("file*name.md")).toBe(true);
      expect(filter.isAllowed("notes/todo*.md")).toBe(true);
    });

    test("asterisk in custom ignored pattern works as glob", () => {
      const filter = new PathFilter({
        ignoredPatterns: ["temp*/**"]
      });
      // Pattern uses * as wildcard - should match temp, temp1, temporary, etc.
      expect(filter.isAllowed("temp/file.md")).toBe(false);
      expect(filter.isAllowed("temp1/file.md")).toBe(false);
      expect(filter.isAllowed("temporary/file.md")).toBe(false);
      // Should NOT match "atemp" (pattern starts with temp)
      expect(filter.isAllowed("atemp/file.md")).toBe(true);
    });

    test("double asterisk ** matches nested paths", () => {
      const filter = new PathFilter({
        ignoredPatterns: ["archive/**"]
      });
      expect(filter.isAllowed("archive/old.md")).toBe(false);
      expect(filter.isAllowed("archive/2024/jan/note.md")).toBe(false);
      expect(filter.isAllowed("other/archive/note.md")).toBe(true);
    });

    test("handles pipe character in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("option|choice.md")).toBe(true);
    });

    test("handles caret in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("version^2.md")).toBe(true);
    });

    test("handles dollar sign in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("price$100.md")).toBe(true);
      expect(filter.isAllowed("$HOME/notes.md")).toBe(true);
    });

    test("handles backslash (Windows paths)", () => {
      const filter = new PathFilter();
      // Backslashes should be normalized to forward slashes
      expect(filter.isAllowed("folder\\subfolder\\note.md")).toBe(true);
    });
  });

  // ============================================================================
  // CUSTOM IGNORED PATTERNS WITH SPECIAL CHARS
  // ============================================================================

  describe("custom patterns with special characters", () => {
    test("custom pattern with dots is treated literally", () => {
      const filter = new PathFilter({
        ignoredPatterns: ["backup.2024/**"]
      });
      expect(filter.isAllowed("backup.2024/notes.md")).toBe(false);
      // "backup_2024" should NOT match "backup.2024" pattern
      expect(filter.isAllowed("backup_2024/notes.md")).toBe(true);
    });

    test("custom pattern with parentheses works", () => {
      const filter = new PathFilter({
        ignoredPatterns: ["(archive)/**"]
      });
      expect(filter.isAllowed("(archive)/old.md")).toBe(false);
      expect(filter.isAllowed("archive/old.md")).toBe(true);
    });

    test("custom pattern with brackets works", () => {
      const filter = new PathFilter({
        ignoredPatterns: ["[trash]/**"]
      });
      expect(filter.isAllowed("[trash]/deleted.md")).toBe(false);
      expect(filter.isAllowed("trash/deleted.md")).toBe(true);
    });
  });

  // ============================================================================
  // PATH TRAVERSAL ATTEMPTS
  // ============================================================================

  describe("path traversal prevention", () => {
    test("blocks obvious traversal patterns", () => {
      const filter = new PathFilter({
        ignoredPatterns: ["../**"]
      });
      expect(filter.isAllowed("../secret.md")).toBe(false);
      expect(filter.isAllowed("../../etc/passwd")).toBe(false);
    });

    test("handles encoded traversal attempts", () => {
      const filter = new PathFilter();
      // These should be allowed by PathFilter (path validation is in FileSystem)
      // but filter shouldn't crash on unusual characters
      expect(() => filter.isAllowed("%2e%2e/secret.md")).not.toThrow();
      expect(() => filter.isAllowed("..%2fnotes.md")).not.toThrow();
    });
  });

  test("allows Obsidian first-party file types", () => {
    const filter = new PathFilter();
    expect(filter.isAllowed("_Bases/daily-notes.base")).toBe(true);
    expect(filter.isAllowed("canvas/mindmap.canvas")).toBe(true);
  });

  // ============================================================================
  // FILTER PATHS BATCH OPERATION
  // ============================================================================

  describe("filterPaths", () => {
    test("filters array of paths correctly", () => {
      const filter = new PathFilter();
      const paths = [
        "notes/valid.md",
        ".obsidian/config.json",
        "archive/old.md",
        ".git/HEAD",
        "readme.txt"
      ];

      const allowed = filter.filterPaths(paths);
      expect(allowed).toEqual([
        "notes/valid.md",
        "archive/old.md",
        "readme.txt"
      ]);
    });

    test("handles empty array", () => {
      const filter = new PathFilter();
      expect(filter.filterPaths([])).toEqual([]);
    });

    test("handles array with all blocked paths", () => {
      const filter = new PathFilter();
      const paths = [
        ".obsidian/app.json",
        ".git/config",
        "node_modules/pkg/index.js"
      ];
      expect(filter.filterPaths(paths)).toEqual([]);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("edge cases", () => {
    test("handles empty path", () => {
      const filter = new PathFilter();
      expect(() => filter.isAllowed("")).not.toThrow();
    });

    test("handles path with only extension", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed(".md")).toBe(true);
    });

    test("handles very long paths", () => {
      const filter = new PathFilter();
      const longPath = "a/".repeat(100) + "note.md";
      expect(() => filter.isAllowed(longPath)).not.toThrow();
      expect(filter.isAllowed(longPath)).toBe(true);
    });

    test("handles unicode characters in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("notes/日本語.md")).toBe(true);
      expect(filter.isAllowed("émojis/🎉.md")).toBe(true);
      expect(filter.isAllowed("中文/笔记.md")).toBe(true);
    });

    test("handles spaces in paths", () => {
      const filter = new PathFilter();
      expect(filter.isAllowed("my notes/important file.md")).toBe(true);
    });

    test("handles directories (no extension)", () => {
      const filter = new PathFilter();
      // Directories should be allowed (no extension check)
      expect(filter.isAllowed("folder/subfolder/")).toBe(true);
      expect(filter.isAllowed("notes")).toBe(true);
    });

    test("handles directories with dots in their names", () => {
      const filter = new PathFilter();
      // Folders with dots should be allowed (common pattern: "1. Project", "2.5 Notes")
      expect(filter.isAllowed("1. Project")).toBe(true);
      expect(filter.isAllowed("2. Archive")).toBe(true);
      expect(filter.isAllowed("3.5 Research")).toBe(true);
      expect(filter.isAllowed("1. Project/subfolder")).toBe(true);
      expect(filter.isAllowed("1. Project/note.md")).toBe(true);
      // But files in those folders should still need proper extensions
      expect(filter.isAllowed("1. Project/file.js")).toBe(false);
    });
  });

  describe("invalid path input (issue #107)", () => {
    test("isAllowed throws a clear error when path is undefined", () => {
      const filter = new PathFilter();
      // @ts-expect-error testing runtime guard against undefined
      expect(() => filter.isAllowed(undefined)).toThrow(
        "path is required and must be a string"
      );
    });

    test("isAllowed throws a clear error when path is null", () => {
      const filter = new PathFilter();
      // @ts-expect-error testing runtime guard against null
      expect(() => filter.isAllowed(null)).toThrow(
        "path is required and must be a string"
      );
    });

    test("isAllowedForListing throws a clear error when path is undefined", () => {
      const filter = new PathFilter();
      // @ts-expect-error testing runtime guard against undefined
      expect(() => filter.isAllowedForListing(undefined)).toThrow(
        "path is required and must be a string"
      );
    });
  });
});
