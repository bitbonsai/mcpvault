import { describe, test, expect } from "vitest";
import { parseAllowedExtensions, parseAppendOnly, stripKnownFlags } from "./cli.js";

describe("parseAllowedExtensions", () => {
  test("returns undefined when the flag is absent", () => {
    expect(parseAllowedExtensions(["/vault"])).toBeUndefined();
  });

  test("adds a leading dot when missing", () => {
    expect(parseAllowedExtensions(["--allowed-extensions=html,csv"])).toEqual([
      ".html",
      ".csv",
    ]);
  });

  test("preserves existing dots, trims, and drops empty entries", () => {
    expect(
      parseAllowedExtensions(["--allowed-extensions=.html, .csv ,,"])
    ).toEqual([".html", ".csv"]);
  });

  test("an empty value yields an empty list, not undefined", () => {
    expect(parseAllowedExtensions(["--allowed-extensions="])).toEqual([]);
  });
});

describe("parseAppendOnly", () => {
  test("returns undefined when the flag is absent", () => {
    expect(parseAppendOnly(["/vault"])).toBeUndefined();
  });

  test("splits, trims, and drops empty entries", () => {
    expect(parseAppendOnly(["--append-only=log.md, journal.md ,,"])).toEqual([
      "log.md",
      "journal.md",
    ]);
  });
});

describe("stripKnownFlags", () => {
  test("removes known flags and keeps the positional vault path", () => {
    expect(
      stripKnownFlags([
        "/my vault",
        "--allowed-extensions=.html",
        "--append-only=log.md",
      ])
    ).toEqual(["/my vault"]);
  });
});
