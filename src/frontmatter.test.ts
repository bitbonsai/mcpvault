import { test, expect, describe } from "vitest";
import { FrontmatterHandler, parseFrontmatter } from "./frontmatter.js";

const handler = new FrontmatterHandler();

test("parse note with frontmatter", () => {
  const content = `---
title: Test Note
tags: [test, example]
created: 2023-01-01
---

# Test Note

This is a test note with frontmatter.`;

  const result = handler.parse(content);

  expect(result.frontmatter.title).toBe("Test Note");
  expect(result.frontmatter.tags).toEqual(["test", "example"]);
  expect(result.frontmatter.created).toEqual(new Date("2023-01-01"));
  expect(result.content.trim()).toBe("# Test Note\n\nThis is a test note with frontmatter.");
});

test("parse note without frontmatter", () => {
  const content = `# Test Note

This is a test note without frontmatter.`;

  const result = handler.parse(content);

  expect(result.frontmatter).toEqual({});
  expect(result.content).toBe(content);
});

test("stringify with frontmatter", () => {
  const frontmatter = {
    title: "Test Note",
    tags: ["test", "example"]
  };
  const content = "# Test Note\n\nContent here.";

  const result = handler.stringify(frontmatter, content);

  expect(result).toContain("---");
  expect(result).toContain("title: Test Note");
  expect(result).toContain("tags:");
  expect(result).toContain("# Test Note");
});

test("stringify without frontmatter", () => {
  const content = "# Test Note\n\nContent here.";

  const result = handler.stringify({}, content);

  expect(result).toBe(content);
});

test("validate valid frontmatter", () => {
  const frontmatter = {
    title: "Valid Title",
    tags: ["tag1", "tag2"],
    date: new Date("2023-01-01"),
    count: 42,
    enabled: true
  };

  const result = handler.validate(frontmatter);

  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test("validate invalid frontmatter with function", () => {
  const frontmatter = {
    title: "Invalid",
    badFunction: () => "not allowed"
  };

  const result = handler.validate(frontmatter);

  expect(result.isValid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  // The specific error message may vary between YAML libraries
  expect(result.errors[0]).toMatch(/Functions are not allowed|Invalid YAML structure/);
});

test("update frontmatter in existing content", () => {
  const content = `---
title: Old Title
tags: [old]
---

# Content

Some content here.`;

  const updates = {
    title: "New Title",
    modified: "2023-12-01"
  };

  const result = handler.updateFrontmatter(content, updates);

  expect(result).toContain("title: New Title");
  expect(result).toContain("modified: 2023-12-01");
  expect(result).toContain("tags:");
  expect(result).toContain("# Content");
});

test("update frontmatter preserves date format (#77)", () => {
  const content = `---
date: 2026-03-16
---
# Content`;

  const result = handler.updateFrontmatter(content, { title: "New Title" });

  expect(result).toContain("date: 2026-03-16");
  expect(result).not.toContain("T00:00:00.000Z");
});

test("update frontmatter preserves HH:MM time format (#75)", () => {
  const content = `---
time_start: 10:00
time_end: 14:30
---
# Content`;

  const result = handler.updateFrontmatter(content, { animal: "dolphin" });

  expect(result).toContain("time_start: 10:00");
  expect(result).toContain("time_end: 14:30");
  expect(result).not.toContain("time_start: 600");
  expect(result).not.toContain("time_end: 870");
});

test("update frontmatter preserves quote styles (#76)", () => {
  const content = `---
categories:
  - "[[Meetings]]"
people:
  - "[[Bob]]"
---
# Content`;

  const result = handler.updateFrontmatter(content, { status: "done" });

  expect(result).toContain('"[[Meetings]]"');
  expect(result).toContain('"[[Bob]]"');
});

test("update frontmatter does not re-quote unmodified plain dates or change quote style (#116)", () => {
  const content = `---
created: 2026-04-23
tags:
  - type/meeting
project: abc
attendees:
  - "[[John-Brown]]"
summary: Some summary text
---
Body text here.`;

  const result = handler.updateFrontmatter(content, { status: "active" });

  // Plain date stays plain, not single-quoted
  expect(result).toContain("created: 2026-04-23");
  expect(result).not.toContain("created: '2026-04-23'");
  // Double-quoted wikilink keeps double quotes, not converted to single
  expect(result).toContain('"[[John-Brown]]"');
  expect(result).not.toContain("'[[John-Brown]]'");
  // The new field is added
  expect(result).toContain("status: active");
});

describe("parseFrontmatter", () => {
  test("returns undefined for null and undefined", () => {
    expect(parseFrontmatter(null)).toBeUndefined();
    expect(parseFrontmatter(undefined)).toBeUndefined();
  });

  test("passes through a plain object", () => {
    const obj = { tags: ["test"], title: "Hello" };
    expect(parseFrontmatter(obj)).toBe(obj);
  });

  test("parses a JSON string into an object", () => {
    const input = '{"tags": ["test"], "title": "Hello"}';
    expect(parseFrontmatter(input)).toEqual({ tags: ["test"], title: "Hello" });
  });

  test("parses an empty JSON object string", () => {
    expect(parseFrontmatter("{}")).toEqual({});
  });

  test("throws for a non-JSON string", () => {
    expect(() => parseFrontmatter("not json")).toThrow("frontmatter must be a JSON object");
  });

  test("throws for a JSON array string", () => {
    expect(() => parseFrontmatter('[1, 2, 3]')).toThrow("frontmatter must be a JSON object");
  });

  test("throws for a JSON primitive string", () => {
    expect(() => parseFrontmatter('"just a string"')).toThrow("frontmatter must be a JSON object");
  });

  test("throws for an array value", () => {
    expect(() => parseFrontmatter([1, 2, 3])).toThrow("frontmatter must be a JSON object");
  });

  test("throws for a number value", () => {
    expect(() => parseFrontmatter(42)).toThrow("frontmatter must be a JSON object");
  });
});
