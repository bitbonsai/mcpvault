import { describe, test, expect } from "vitest";
import { parseAllowedExtensions, stripKnownFlags } from "./cli.js";

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

describe("stripKnownFlags", () => {
  test("removes the flag and keeps the positional vault path", () => {
    expect(stripKnownFlags(["/my vault", "--allowed-extensions=.html"])).toEqual(
      ["/my vault"]
    );
  });
});
