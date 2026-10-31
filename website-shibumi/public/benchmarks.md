# MCP v2 compatibility benchmarks

MCPVault uses the official 2.0 SDK for the MCP 2026-07-28 specification. One process accepts clients using either protocol generation, so existing configurations continue to work.

## Results

We tested three pairings against one vault with 381 notes, 84 folders, and 3.2 MB of content. Each server ran read-only over stdio. Measurements were taken on 2026-08-17 using macOS, Node 26, SDK 1.30.0, and SDK 2.0.0.

| metric | Current release | MCP v2 with current clients | MCP v2 with new clients |
|---|---|---|---|
| cold start (n=8) | 107.3 ms | 109.8 ms | 105.8 ms |
| tools/list (n=50) | 0.15 ms | 0.14 ms | 0.17 ms |
| get_vault_stats (n=50) | 12.13 ms | 11.4 ms | 11.66 ms |
| read_note (n=50) | 0.46 ms | 0.43 ms | 0.45 ms |
| list_directory (n=50) | 0.45 ms | 0.43 ms | 0.46 ms |
| search_notes (n=20) | 85.53 ms | 84.33 ms | 85.62 ms |

All three pairings fell within normal run-to-run variation. This benchmark found no material slowdown after the SDK migration.

## Why MCPVault moved

- One process accepts clients using either protocol generation.
- New MCP fixes and security updates land on the 2.x SDK line.
- The specification supports JSON Schema 2020-12 for more precise tool input definitions.

## Stateless HTTP

The 2026-07-28 specification removes per-client server sessions from the HTTP transport. This can simplify running an MCP server behind a load balancer.

MCPVault does not expose an HTTP transport today. [Issue #49](https://github.com/bitbonsai/mcpvault/issues/49) tracks a separate, opt-in HTTP package. Local stdio will remain the default.

## Questions about the results

### Why are some calls below one millisecond?

The server and client run on the same machine over stdio, with files already in the operating system cache. These numbers isolate server processing and do not include model or network latency.

### Are the samples large enough?

Eight cold starts and twenty searches are small samples. They are enough to compare medians on this machine, but they do not establish performance for every vault or computer.

### Why does MCP v2 win some rows?

The differences change between runs. We treat them as measurement noise and make no speedup claim.

### How can I verify the results?

The scripts print the values used on this page. Run them against your vault and open an issue if the results differ.

### Does dual-protocol support add work to every request?

Protocol selection happens once when the client connects. Requests do not repeat that check.

### Did anything get slower?

Pinning an MCP v2 client to the new protocol adds about 110 ms once during connection. Shipping clients do not currently pin the protocol this way; the benchmark harness does.

## Method

Each pairing spawns `mcpvault <vault> --read-only` over stdio. Cold start is the median of eight full connect cycles. Per-request values are medians from a warm connection after one warmup call, using 50 iterations per tool and 20 for `search_notes`.

Run the scripts from the repository's [`benchmarks/`](https://github.com/bitbonsai/mcpvault/tree/main/benchmarks) directory.
