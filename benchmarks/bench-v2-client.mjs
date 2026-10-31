// Benchmark MCP servers with the v1 client (@modelcontextprotocol/sdk 1.x).
// Usage: node bench-mcp.mjs <label> <serverPath> <outFile>
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { writeFileSync } from "fs";

const [label, serverPath, outFile] = process.argv.slice(2);
const VAULT = "/Users/mwolff/Vaults/Ideas";

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    n: s.length,
    mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2),
    median: +q(0.5).toFixed(2),
    p95: +q(0.95).toFixed(2),
    min: +s[0].toFixed(2),
    max: +s[s.length - 1].toFixed(2),
  };
}

async function connect() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath, VAULT, "--read-only"],
    stderr: "ignore",
  });
  const client = new Client({ name: "bench", version: "1.0.0" }, { versionNegotiation: { mode: { pin: "2026-07-28" } } });
  await client.connect(transport);
  return client;
}

// Cold start: spawn + handshake + first tools/list.
const coldSamples = [];
for (let i = 0; i < 8; i++) {
  const t0 = performance.now();
  const client = await connect();
  await client.listTools();
  coldSamples.push(performance.now() - t0);
  await client.close();
}

const client = await connect();
const workloads = [
  ["tools/list", 50, () => client.listTools()],
  ["get_vault_stats", 50, () => client.callTool({ name: "get_vault_stats", arguments: {} })],
  ["read_note", 50, () => client.callTool({ name: "read_note", arguments: { path: "Skills.md" } })],
  ["list_directory", 50, () => client.callTool({ name: "list_directory", arguments: { path: "/" } })],
  ["search_notes", 20, () => client.callTool({ name: "search_notes", arguments: { query: "product" } })],
];

const results = { label, coldStartMs: stats(coldSamples), tools: {} };
for (const [name, iters, fn] of workloads) {
  await fn(); // warmup
  const samples = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  results.tools[name] = stats(samples);
}
await client.close();

writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(label, "done ->", outFile);
