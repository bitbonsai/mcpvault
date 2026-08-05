import { describe, test, expect } from "vitest";
import { parseAppendOnly, stripKnownFlags } from "./cli.js";

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

  test("an empty value yields an empty list, not undefined", () => {
    expect(parseAppendOnly(["--append-only="])).toEqual([]);
  });
});

describe("stripKnownFlags", () => {
  test("removes known flags and keeps the positional vault path", () => {
    expect(stripKnownFlags(["/my vault", "--append-only=log.md"])).toEqual([
      "/my vault",
    ]);
  });
});
