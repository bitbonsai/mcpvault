/**
 * Pure CLI argument parsers, kept separate from server.ts so they can be
 * unit-tested without importing server.ts (which starts the server on import).
 */
/**
 * Parse `--append-only=log.md,journal.md` into ['log.md', 'journal.md']: basenames
 * whose whole-file overwrite is refused (clients must append/prepend). Returns
 * undefined when the flag is absent.
 */
export declare function parseAppendOnly(args: string[]): string[] | undefined;
/** Drop recognized `--flag=...` options, leaving positional args (e.g. the vault path). */
export declare function stripKnownFlags(args: string[]): string[];
//# sourceMappingURL=cli.d.ts.map