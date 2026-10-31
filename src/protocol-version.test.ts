import { afterEach, expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const builtServer = join(repoRoot, "dist", "server.js");
const vaults: string[] = [];

afterEach(async () => {
  await Promise.all(vaults.splice(0).map((vault) => rm(vault, { recursive: true, force: true })));
});

async function connect(mode: "legacy" | "modern") {
  const vault = await mkdtemp(join(tmpdir(), `mcpvault-${mode}-`));
  vaults.push(vault);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [builtServer, vault],
    cwd: repoRoot,
    stderr: "pipe",
  });
  const client = mode === "modern"
    ? new Client(
        { name: "mcpvault-protocol-test", version: "1.0.0" },
        { versionNegotiation: { mode: { pin: "2026-07-28" } } },
      )
    : new Client({ name: "mcpvault-protocol-test", version: "1.0.0" });

  await client.connect(transport);
  return client;
}

test("serves legacy handshake-based MCP clients", async () => {
  const client = await connect("legacy");
  try {
    const result = await client.listTools();
    expect(client.getProtocolEra()).toBe("legacy");
    expect(result.tools).toHaveLength(18);
    expect(result.tools[0]?.name).toBe("read_note");
  } finally {
    await client.close();
  }
}, 15_000);

test("serves MCP 2026-07-28 clients", async () => {
  const client = await connect("modern");
  try {
    const result = await client.listTools();
    expect(client.getProtocolEra()).toBe("modern");
    expect(result.tools).toHaveLength(18);
    expect(result.tools[0]?.name).toBe("read_note");
  } finally {
    await client.close();
  }
}, 15_000);
