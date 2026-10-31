import { describe, expect, test } from "vitest";
import { parseCliArgs } from "./cli.js";

describe("parseCliArgs", () => {
  test("defaults to writable mode and preserves a vault path", () => {
    expect(parseCliArgs(["/path/to/vault"])).toEqual({
      vaultPathArg: "/path/to/vault",
      readOnly: false,
      excludePaths: [],
    });
  });

  test("supports a bare read-only flag in any position", () => {
    expect(parseCliArgs(["/path/to/vault", "--read-only"])).toEqual({
      vaultPathArg: "/path/to/vault",
      readOnly: true,
      excludePaths: [],
    });
    expect(parseCliArgs(["--read-only", "/path/to/vault"])).toEqual({
      vaultPathArg: "/path/to/vault",
      readOnly: true,
      excludePaths: [],
    });
  });

  test("accepts explicit boolean values used by JSON MCP configs", () => {
    expect(parseCliArgs(["/vault", "--read-only", "true"]).readOnly).toBe(true);
    expect(parseCliArgs(["/vault", "--read-only", "false"]).readOnly).toBe(false);
    expect(parseCliArgs(["/vault", "--read-only=true"]).readOnly).toBe(true);
    expect(parseCliArgs(["/vault", "--read-only=false"]).readOnly).toBe(false);
  });

  test("preserves unquoted vault paths with spaces after removing options", () => {
    expect(parseCliArgs(["/Users/me/My", "Vault", "--read-only", "true"])).toEqual({
      vaultPathArg: "/Users/me/My Vault",
      readOnly: true,
      excludePaths: [],
    });
  });

  test("parses repeatable discovery exclusions without changing the vault path", () => {
    expect(parseCliArgs([
      "/Users/me/My",
      "Vault",
      "--exclude",
      "Archive",
      "--exclude=Snapshots/Old",
    ])).toEqual({
      vaultPathArg: "/Users/me/My Vault",
      readOnly: false,
      excludePaths: ["Archive", "Snapshots/Old"],
    });
  });

  test("rejects exclusions without a subtree path", () => {
    expect(() => parseCliArgs(["/vault", "--exclude"])).toThrow(
      "--exclude requires a subtree path",
    );
    expect(() => parseCliArgs(["/vault", "--exclude="])).toThrow(
      "--exclude requires a subtree path",
    );
  });

  test("rejects invalid equals-form boolean values", () => {
    expect(() => parseCliArgs(["/vault", "--read-only=yes"])).toThrow(
      "--read-only must be true or false",
    );
  });
});
