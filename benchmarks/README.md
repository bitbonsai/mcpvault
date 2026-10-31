# MCP v1 vs MCP v2 benchmarks

Latency comparison behind https://mcpvault.org/benchmarks.

Usage: `node <script> "<label>" <path-to-dist/server.js> <out.json>`

- `bench-v1-client.mjs` drives the server with the legacy client
  (`@modelcontextprotocol/sdk` 1.x). Run it from a checkout where that
  package is installed (any pre-0.16 release).
- `bench-v2-client.mjs` drives it with the MCP v2 client pinned to
  protocol 2026-07-28 (`@modelcontextprotocol/client` 2.x). Run it from
  this branch.

Both spawn `dist/server.js <vault> --read-only` over stdio: 8 cold
connect cycles, then warm per-tool iterations (50 per tool, 20 for
search_notes), reporting mean/median/p95/min/max in ms.
