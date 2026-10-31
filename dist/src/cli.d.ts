export interface ParsedCliArgs {
    vaultPathArg: string;
    readOnly: boolean;
    excludePaths: string[];
}
/**
 * Parse runtime options without importing server.ts, which starts the MCP
 * server as a side effect. Unknown positional arguments remain part of the
 * vault path so unquoted paths with spaces continue to work.
 */
export declare function parseCliArgs(args: string[]): ParsedCliArgs;
//# sourceMappingURL=cli.d.ts.map