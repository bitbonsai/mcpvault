/**
 * Package version, read once at startup from the repo root package.json
 * (not the website-shibumi manifest). Mirrors the Astro layout's
 * `import pkg from '../../../package.json'` so the nav badge and the
 * structured-data `softwareVersion` field stay in sync with the published
 * MCP server package.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readPackageVersion(rootDir: string = join(import.meta.dir, "..", "..", "..")): string {
  const pkgPath = join(rootDir, "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`package.json at ${pkgPath} has no string "version" field`);
  }
  return parsed.version;
}

/** Read once at module load; every import shares this value. */
export const packageVersion: string = readPackageVersion();
