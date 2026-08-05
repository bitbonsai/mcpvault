import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { FrontmatterHandler } from "./frontmatter.js";
import { PathFilter } from "./pathfilter.js";
export interface CreateServerOptions {
    name?: string;
    version?: string;
    pathFilter?: PathFilter;
    frontmatterHandler?: FrontmatterHandler;
    /** Basenames refused for whole-file overwrite via write_note; clients must append/prepend. */
    appendOnly?: string[];
}
export declare function createServer(vaultPath: string, options?: CreateServerOptions): Server;
//# sourceMappingURL=createServer.d.ts.map