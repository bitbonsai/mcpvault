/**
 * Pure CLI argument parsers, kept separate from server.ts so they can be
 * unit-tested without importing server.ts (which starts the server on import).
 */

const APPEND_ONLY_FLAG = "--append-only=";

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
 * Parse `--append-only=log.md,journal.md` into ['log.md', 'journal.md']: basenames
 * whose whole-file overwrite is refused (clients must append/prepend). Returns
 * undefined when the flag is absent.
 */
export function parseAppendOnly(args: string[]): string[] | undefined {
  return readCsvFlag(args, APPEND_ONLY_FLAG);
}

/** Drop recognized `--flag=...` options, leaving positional args (e.g. the vault path). */
export function stripKnownFlags(args: string[]): string[] {
  return args.filter((a) => !a.startsWith(APPEND_ONLY_FLAG));
}
