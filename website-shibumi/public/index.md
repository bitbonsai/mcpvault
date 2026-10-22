# MCPVault - MCP server for Obsidian vaults

**License:** MIT | **Free**

## Connect MCP clients to your Obsidian vault

MCPVault reads, searches, and edits local vault files. Obsidian can stay closed, and frontmatter updates preserve existing formatting.

- [Installation](/install/) - Configuration examples for supported clients
- [View on GitHub](https://github.com/bitbonsai/mcpvault)

## Announcement

- MCPVault runs on [MCP v2](https://modelcontextprotocol.io/specification/latest), the latest MCP specification. Existing and new clients showed no material slowdown in [our benchmarks](https://mcpvault.org/benchmarks.md).
- The [Obsidian skill](/skill.md) routes file operations to MCPVault, app actions to Obsidian CLI, and sync tasks to Git.

## Recent Updates

- **v0.16.0 (August 2026):** Moved to **MCP v2**, the official SDK for the 2026-07-28 specification. One process accepts both protocol generations, with no material slowdown in [our benchmarks](https://mcpvault.org/benchmarks.md).
- **v0.15.0 (August 2026):** Added `--read-only` mode, which exposes read tools only and rejects all vault mutations. ([#112](https://github.com/bitbonsai/mcpvault/issues/112), thanks @vdhome-dev)
- **v0.14.1 (August 2026):** Security: dotfiles and hidden directories are now denied at any vault depth, closing an extension-filter bypass. ([#115](https://github.com/bitbonsai/mcpvault/pull/115), thanks @sadegh)
- **v0.14.0 (August 2026):** Added `get_note_outline` and `read_note_lines` for navigating and reading targeted sections of large notes without loading the full file. ([#146](https://github.com/bitbonsai/mcpvault/pull/146), thanks @kartik7704)
- **v0.12.6 (August 2026):** Refreshed the MCP SDK and development toolchain, standardized the server package on npm, and removed its stale Bun lockfile. No runtime behavior changed. ([#178](https://github.com/bitbonsai/mcpvault/pull/178))
- **v0.12.5 (July 2026):** The server now exits cleanly when stdio clients disconnect or terminate, preventing orphaned MCPVault processes. ([#159](https://github.com/bitbonsai/mcpvault/issues/159))
- **v0.12.4 (July 2026):** New `wiki_link` tool reads Obsidian wiki links, including `[[Note]]`, `[[Note|Display]]`, and path-qualified `[[folder/Note]]`, and returns the note ready for context with alternative paths when a name is ambiguous. ([#101](https://github.com/bitbonsai/mcpvault/pull/101))
- **v0.11.2 (April 2026):** `delete_note` now supports soft-delete with `trashMode`: `none` (permanent), `local` (move to `.trash/` inside vault), or `system` (OS trash). ([#91](https://github.com/bitbonsai/mcpvault/issues/91))
- **v0.11.1 (April 2026):** Frontmatter updates now use AST-aware YAML preservation. Unmodified fields keep their original formatting: plain dates stay as `YYYY-MM-DD`, quoted strings keep their quotes, and `HH:MM` values are no longer misread as sexagesimal integers. ([#75](https://github.com/bitbonsai/mcpvault/issues/75), [#76](https://github.com/bitbonsai/mcpvault/issues/76), [#77](https://github.com/bitbonsai/mcpvault/issues/77))
- **v0.11.0 (March 2026):** New `list_all_tags` tool: scan all vault notes for tags with occurrence counts. Obsidian skill now routes to CLI for active file, daily notes, backlinks, and open-in-editor. ([#80](https://github.com/bitbonsai/mcpvault/issues/80))
- **v0.10.0 (March 2026):** New `createServer()` factory for library consumers. MCPVault can now be imported and connected to any MCP transport. TypeScript declarations and all public types exported. ([#84](https://github.com/bitbonsai/mcpvault/issues/84))
- **v0.9.1 (March 2026):** Security fix: symlinks inside the vault that point outside the vault boundary are now blocked. ([#78](https://github.com/bitbonsai/mcpvault/issues/78))
- **v0.9.0 (March 2026):** Package renamed to `@bitbonsai/mcpvault` on npm at Obsidian's request. Update your config: replace `mcpvault` with `@bitbonsai/mcpvault`
- **v0.8.2 (March 2026):** Trailing-slash vault paths no longer truncate search results ([PR #48](https://github.com/bitbonsai/mcpvault/pull/48)), `get_vault_stats` now handles dotted folder names correctly ([PR #42](https://github.com/bitbonsai/mcpvault/pull/42)), note tools now support `.base` and `.canvas` ([PR #53](https://github.com/bitbonsai/mcpvault/pull/53)), string frontmatter inputs are now handled safely ([PR #47](https://github.com/bitbonsai/mcpvault/pull/47)), vault path is now optional in CLI mode (defaults to current working directory, [#50](https://github.com/bitbonsai/mcpvault/issues/50)), and dependency refreshes for the MCP SDK and Node types are merged ([PR #43](https://github.com/bitbonsai/mcpvault/pull/43), [PR #44](https://github.com/bitbonsai/mcpvault/pull/44))
- **v0.8.1:** Multi-word BM25 search relevance improvements ([PR #38](https://github.com/bitbonsai/mcpvault/pull/38)), patch_note undefined/null validation hardening ([PR #37](https://github.com/bitbonsai/mcpvault/pull/37)), new `move_file` tool for binary-safe file moves with explicit path confirmation, binary filenames now visible in directory listings ([#21](https://github.com/bitbonsai/mcpvault/issues/21))
- **v0.7.5:** Search now matches note filenames ([#30](https://github.com/bitbonsai/mcpvault/issues/30)), hidden directories filtered from listings ([#33](https://github.com/bitbonsai/mcpvault/issues/33)), OpenCode install docs ([#35](https://github.com/bitbonsai/mcpvault/issues/35))
- **v0.7.4:** New get_vault_stats tool + improved error messages with remediation suggestions
- **v0.7.3:** Bug fix for folder detection with dots in names + dependency updates ([PR #15](https://github.com/bitbonsai/mcpvault/pull/15))
- **v0.7.2:** Security hardening - TOCTOU fixes, regex injection prevention, comprehensive CI/CD ([PR #12](https://github.com/bitbonsai/mcpvault/pull/12))
- [See full changelog](https://github.com/bitbonsai/mcpvault/blob/main/CHANGELOG.md)

## Navigation

- [Install](/install.md) - Configuration for all supported platforms
- [Features](/features.md) - Tools, path restrictions, and access methods
- [Demo](/demo.md) - MCP tool requests and responses
- [How it works](/how-it-works.md) - Prompt-to-tool examples
- [Skill](/skill.md) - Routing between MCPVault, Obsidian CLI, and Git

## Links

- Repository: https://github.com/bitbonsai/mcpvault
- npm: https://www.npmjs.com/package/@bitbonsai/mcpvault
- Changelog: https://github.com/bitbonsai/mcpvault/blob/main/CHANGELOG.md
- Website: https://mcpvault.org
