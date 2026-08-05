/**
 * Pure CLI argument parsers, kept separate from server.ts so they can be
 * unit-tested without importing server.ts (which starts the server on import).
 */
/**
 * Parse `--allowed-extensions=.html,csv` into ['.html', '.csv'] (a leading dot is
 * added when missing). Returns undefined when the flag is absent, so the caller
 * can leave PathFilter at its built-in defaults.
 */
export declare function parseAllowedExtensions(args: string[]): string[] | undefined;
/** Drop recognized `--flag=...` options, leaving positional args (e.g. the vault path). */
export declare function stripKnownFlags(args: string[]): string[];
//# sourceMappingURL=cli.d.ts.map