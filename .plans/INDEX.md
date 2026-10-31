# Plans

## Active
- [ ] [Shibumi website migration](shibumi-website-migration.md): p0–p5 DONE, `shibumi` branch pushed (302 tests green); next: shibumi-server install on Hetzner + staging.mcpvault.org, then p6 staging QA; deploy = shibumi-server in-situ builds behind Caddy
- [ ] MCP SDK v2 migration on `feat/mcp-sdk-v2`: dual-era stdio works; rebase onto `main`, then replace session HTTP with stateless v2 handlers
- [ ] Contributor PRs #146, #163, #164, #173, #174, #175 waiting on requested changes
- [ ] Issue follow-ups #49, #165, #167, #170 waiting on testers/contributors

## Planned
- Ship `@bitbonsai/mcpvault-http` only after stateless MCP v2 HTTP redesign and protocol matrix tests
- OAuth (#41), blocked on HTTP transport shipping

## Recently shipped
- 2026-08-06: v0.12.6 dependency refresh, npm-only root, website release callout, changelog (#178–#180)
- 2026-08-06: MCP SDK v2 preview branch + compact homepage callout (#177)
- 2026-08-05: audited dependency refresh (#171), wiki-link/tool-count documentation corrections (#172)
- 2026-08-05: hardened experimental Streamable HTTP branch (`d4c52ea`), 247 tests/build/audit green
- 2026-08-05: reviewed #146, #163, #164, #173, #174, #175; all waiting on contributor changes
