/**
 * Pure CLI argument parsers, kept separate from server.ts so they can be
 * unit-tested without importing server.ts (which starts the server on import).
 */

const ALLOWED_EXTENSIONS_FLAG = "--allowed-extensions=";

/** Read a `--name=a,b,c` flag into a trimmed, non-empty list, or undefined if absent. */
function readCsvFlag(args: string[], prefix: string): string[] | undefined {
  const raw = args.find((a) => a.startsWith(prefix));
  if (raw === undefined) return undefined;
  return raw
    .slice(prefix.length)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Parse `--allowed-extensions=.html,csv` into ['.html', '.csv'] (a leading dot is
 * added when missing). Returns undefined when the flag is absent, so the caller
 * can leave PathFilter at its built-in defaults.
 */
export function parseAllowedExtensions(args: string[]): string[] | undefined {
  const values = readCsvFlag(args, ALLOWED_EXTENSIONS_FLAG);
  return values?.map((e) => (e.startsWith(".") ? e : `.${e}`));
}

/** Drop recognized `--flag=...` options, leaving positional args (e.g. the vault path). */
export function stripKnownFlags(args: string[]): string[] {
  return args.filter((a) => !a.startsWith(ALLOWED_EXTENSIONS_FLAG));
}
