import { Server } from "@modelcontextprotocol/server";
import { FrontmatterHandler } from "./frontmatter.js";
import { PathFilter } from "./pathfilter.js";
export interface CreateServerOptions {
    name?: string;
    version?: string;
    pathFilter?: PathFilter;
    frontmatterHandler?: FrontmatterHandler;
    /** Expose read tools only and reject direct calls to mutating tools. */
    readOnly?: boolean;
    /** Vault-relative subtrees hidden from search and directory listings. */
    excludePaths?: string[];
}
export declare function createServer(vaultPath: string, options?: CreateServerOptions): Server;
//# sourceMappingURL=createServer.d.ts.map