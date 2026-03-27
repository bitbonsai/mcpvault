import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { FrontmatterHandler } from "./frontmatter.js";
import { PathFilter } from "./pathfilter.js";
import { VaultIndex } from "./vault-index.js";
export interface CreateServerOptions {
    name?: string;
    version?: string;
    pathFilter?: PathFilter;
    frontmatterHandler?: FrontmatterHandler;
}
export declare function createServer(vaultPath: string, options?: CreateServerOptions): {
    server: Server;
    index: VaultIndex;
};
//# sourceMappingURL=createServer.d.ts.map