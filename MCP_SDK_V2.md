# MCP v2

MCPVault runs on the official TypeScript SDK v2 (`@modelcontextprotocol/server`)
and the MCP 2026-07-28 specification since 0.16.0. The stdio server is dual-era:
legacy and 2026-07-28 clients are both served from one process, selected per
connection during the opening exchange.

Benchmarks and details: https://mcpvault.org/benchmarks
