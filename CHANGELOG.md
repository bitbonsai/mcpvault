# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.5] - 2026-06-18

### Security
- Deny restricted directories (`.git`, `.obsidian`, `node_modules`) at any depth, not just the vault root. Nested copies were traversable, exposing nested `.git/config` / `.obsidian` contents and polluting the tag index with nested `node_modules` ([#128](https://github.com/bitbonsai/mcpvault/issues/128), [GHSA-9c83-rr99-vfwj](https://github.com/bitbonsai/mcpvault/security/advisories/GHSA-9c83-rr99-vfwj))

### Fixed
- `write_note` / `update_frontmatter` no longer misreport unrelated errors as "No space left on device": write errors are now classified by Node error code, not message substring ([#109](https://github.com/bitbonsai/mcpvault/issues/109))

### Changed
- Dependency updates: `yaml` 2.9.0, `typescript` 6.0.3, dev tooling ([#135](https://github.com/bitbonsai/mcpvault/pull/135))

## [0.11.4] - 2026-06-17

### Security
- Match the restricted-directory deny-list case-insensitively and canonicalize trailing dots/spaces per path segment. On case-insensitive filesystems (macOS, Windows), variants like `.Git/config`, `.GIT/config`, or `.git./config` bypassed the `.git`/`.obsidian` restriction ([GHSA-j99q-93c9-h869](https://github.com/bitbonsai/mcpvault/security/advisories/GHSA-j99q-93c9-h869))

### Changed
- `npm audit fix`: resolved transitive advisories; CI audit gate set to `high`

## [0.11.3] - 2026-06-17

### Fixed
- `read_note` / `write_note` (and `patch_note` / `delete_note` / `move_file`) no longer throw an unguarded `TypeError` when `path` is missing; they return a clear "path is required" error ([#107](https://github.com/bitbonsai/mcpvault/issues/107))

### Note
- First npm release since 0.11.0; also delivers the 0.11.1 and 0.11.2 changes below (AST-aware frontmatter preservation, `delete_note` `trashMode`), which were not separately published.

## [0.11.2] - 2026-04-16

### Added
- `delete_note` now supports soft-delete via `trashMode` parameter ([#91](https://github.com/bitbonsai/mcpvault/issues/91))
  - `none` (default): permanent delete (previous behavior)
  - `local`: move file to `.trash/` inside the vault, preserving relative folder structure
  - `system`: move file to OS trash/recycle bin via the `trash` package

## [0.11.1] - 2026-04-16

### Fixed
- Frontmatter updates now use AST-aware YAML preservation. Unmodified fields keep their original formatting, fixing:
  - `YYYY-MM-DD` dates being rewritten as full ISO timestamps ([#77](https://github.com/bitbonsai/mcpvault/issues/77))
  - `HH:MM` values being parsed as YAML 1.1 sexagesimal integers ([#75](https://github.com/bitbonsai/mcpvault/issues/75))
  - Quoted strings losing their quote style ([#76](https://github.com/bitbonsai/mcpvault/issues/76))

### Changed
- `update_frontmatter`, `manage_tags`, and `write_note` (append/prepend modes) now preserve raw YAML for unmodified fields via `yaml.parseDocument`

## [0.11.0] - 2026-03-22

### Added
- New `list_all_tags` tool: scans all vault notes for frontmatter tags and inline `#hashtags`, returns deduplicated list sorted by frequency ([#80](https://github.com/bitbonsai/mcpvault/issues/80))
- Obsidian CLI integration in the skill: preflight checks, command patterns for active file, daily notes, backlinks, and open-in-editor

## [0.10.0] - 2026-03-20

### Added
- New `createServer(vaultPath, options?)` factory function for library consumers ([#84](https://github.com/bitbonsai/mcpvault/issues/84))
- `src/index.ts` barrel exports for all public APIs and types
- TypeScript declaration files (`.d.ts`) included in published package
- `exports`, `types` fields in `package.json` for proper ESM library consumption

### Changed
- `server.ts` slimmed to ~60-line CLI entry point, all logic moved to `src/createServer.ts`
- Test files excluded from `dist/` output
- Minimum Node version bumped to 20 (Node 18 EOL)

## [0.9.1] - 2026-03-20

### Fixed
- Symlinks inside the vault that resolve outside the vault boundary are now blocked, closing a path traversal bypass ([#78](https://github.com/bitbonsai/mcpvault/issues/78))
- Circular symlinks (ELOOP) and permission-denied symlink targets (EACCES) return clear error messages
- `list_directory` now includes symlinked files and directories when the target resolves within the vault (previously all symlinks were silently skipped)

### Changed
- Vault root path is now resolved through symlinks at startup for consistent boundary checks
- Dropped Node 18 from CI test matrix (EOL since April 2025, vitest 4.1 requires Node 20+)

## [0.9.0] - 2026-03-12

### Changed
- Package renamed to `@bitbonsai/mcpvault` on npm at Obsidian's request — update your config by replacing `mcpvault` with `@bitbonsai/mcpvault`

## [0.8.2] - 2026-03-08

### Added
- Support for Obsidian first-party note formats: `.base` and `.canvas`
- Optional CLI startup without vault path argument (defaults to current working directory)

### Changed
- Website install/docs refreshed with optional CWD mode guidance and updated release notes
- Website UX polish: collapsible install helpers, improved update callout behavior, and icon consistency

### Fixed
- `write_note` and `update_frontmatter` now safely handle frontmatter values passed as JSON strings
- npm publish metadata cleanup for binary mapping and repository URL consistency

## [0.8.1] - 2026-02-27

### Added
- New `move_file` tool for binary-safe file moves with explicit path confirmation

### Changed
- Search relevance improvements for multi-word BM25 ranking
- Better support for non-note filenames in directory listing visibility

### Fixed
- `patch_note` undefined/null validation hardening

## [0.7.5] - 2026-02-16

### Changed
- Search now matches note filenames in addition to content
- Hidden directories are filtered from listings
- OpenCode install docs and setup guidance updated

## [0.7.4] - 2026-01-24

### Added
- `get_vault_stats` tool for vault-wide stats and recent file metadata

### Changed
- Improved error messages with actionable remediation suggestions

## [0.7.3] - 2025-12-21

### Fixed
- Folder detection bug for directories containing dots in names

## [0.7.2] - 2025-12-08

### Fixed
- Security hardening improvements including TOCTOU protections and regex injection prevention

### Changed
- CI/CD coverage improvements for reliability and release safety

## [0.6.3] - 2025-10-10

### Added
- **Token optimization**: New `prettyPrint` parameter for all JSON responses (default: false)
  - Applies to: `read_note`, `search_notes`, `list_directory`, `read_multiple_notes`, `get_notes_info`, `get_frontmatter`
  - Reduces token usage by ~30-40% when disabled

### Changed
- **Response optimization**: Removed redundant fields from responses to reduce token count
  - `read_note`: Removed redundant `path` field, shortened `frontmatter` to `fm`
  - `list_directory`: Shortened `directories` to `dirs`, removed redundant `path` field
  - `search_notes`: Removed redundant `query` and `resultCount` wrapper
  - `read_multiple_notes`: Shortened fields to `ok`/`err`, removed redundant summary
  - `get_notes_info`: Returns array directly without wrapper
  - `get_frontmatter`: Returns frontmatter directly without wrapper
- **Search results**: Minified field names for 40-60% token reduction
  - `path` → `p`
  - `title` → `t`
  - `excerpt` → `ex`
  - `matchCount` → `mc`
  - `lineNumber` → `ln`
- **Search excerpt**: Reduced context from 50 to 21 characters before/after match
- **JSON formatting**: Default to compact (no pretty-printing) to save tokens

### Performance
- **Overall token reduction**: 40-60% fewer tokens in typical responses
- **Search operations**: Significantly faster with smaller excerpts and minified fields
- **API responses**: More efficient for high-volume operations

## [0.6.1] - 2025-10-09

### Added
- **Comprehensive patch_note testing**: Added 16 tests covering all edge cases
  - Single and multiple occurrence handling
  - Empty string validation
  - Special character handling (regex chars treated literally)
  - Whitespace preservation (tabs and spaces)
  - Case sensitivity verification
  - Performance testing (100+ replacements)
  - Path handling with spaces
- **Test reorganization**: Moved tests from `tests/` to `src/` for better co-location
  - Merged filesystem, patch, and integration tests into single file
  - All 38 tests passing

### Fixed
- **patch_note validation**: Added validation for empty `oldString` and `newString` parameters
- **Error messages**: Improved error messages for empty string parameters

### Changed
- **Test structure**: Reorganized test files to be co-located with source files
  - `src/filesystem.test.ts` (30 tests)
  - `src/frontmatter.test.ts` (8 tests)

## [0.6.0] - 2025-10-08

### Added
- **patch_note tool**: Efficient partial note updates by replacing specific strings
  - Replace single or multiple occurrences
  - Multiline string support
  - Safety checks for multiple matches
  - Preserves frontmatter
  - More efficient than rewriting entire files

## [0.5.4] - 2025-09-23

### Fixed
- **YAML frontmatter operations**: Fixed critical "yaml.dump is not a function" errors in `write_note`, `update_frontmatter`, and `manage_tags` tools
- **Dependency cleanup**: Removed js-yaml dependency entirely, now using gray-matter for all YAML operations
- **list_directory**: Fixed handling of "." path to properly return root directory contents including both files and directories

### Added
- **Comprehensive test suite**: Added 22 integration tests covering all frontmatter operations
- **Test coverage**: Added tests for write_note with frontmatter, append/prepend modes, update operations, and tag management
- **Error validation**: Added edge case testing for tag management and frontmatter validation

### Changed
- **YAML handling**: Migrated all YAML serialization to use gray-matter consistently
- **Validation**: Updated frontmatter validation to use `matter.stringify()` instead of `yaml.dump()`
- **Package.json**: Updated main field to point to correct compiled output

## [0.5.1] - 2025-09-23

### Fixed
- **Package configuration**: Fixed package.json main field to point to `dist/server.js`
- **Executable permissions**: Fixed executable permissions for compiled JavaScript output
- **Usage message**: Fixed usage message in compiled JavaScript to show correct npm command
- **Claude Desktop compatibility**: Fixed "env: bun: No such file or directory" error

### Added
- **TypeScript compilation**: Added proper TypeScript build process for npm distribution
- **Distribution files**: Added compiled JavaScript files to dist/ directory

## [0.5.0] - 2025-09-23

### Changed
- **🚨 BREAKING**: Complete migration from Bun to npm/Node.js runtime
- **Runtime**: Replaced all Bun APIs with Node.js equivalents
- **Package manager**: Converted from Bun to npm package management
- **Build system**: Added TypeScript compilation for distribution

### Added
- **Node.js compatibility**: Full Node.js runtime support (v18.0.0+)
- **npm distribution**: Published as npm package `mcpvault`
- **TypeScript tooling**: Added tsx for development and tsc for building
- **Vitest testing**: Replaced Bun test with Vitest test runner

### Removed
- **Bun dependencies**: Removed all Bun-specific APIs and runtime dependencies
- **Bun.file(), Bun.write()**: Replaced with Node.js fs functions
- **Bun.Glob()**: Replaced with recursive directory scanning

## [0.3.0] - 2025-09-23

### Added
- **Write modes**: Added `append`, `prepend`, and `overwrite` modes for flexible content editing
- **Tag management**: Complete tag management system with add, remove, and list operations
- **get_frontmatter**: New tool for metadata-only extraction without reading full content
- **Path trimming**: Automatic whitespace handling in path inputs
- **API documentation**: Complete documentation for all 11 MCP methods
- **Quick Start guide**: 5-minute setup guide for immediate use
- **Multi-platform support**: Claude Desktop, Claude Code, ChatGPT Desktop, IntelliJ IDEA support

### Changed
- **Package scope**: Migrated to scoped npm package `mcpvault`
- **Documentation**: Made README AI-agnostic with comprehensive examples
- **Version consistency**: Synchronized version across all files

### Fixed
- **API documentation**: Added missing docs for search_notes, move_note, read_multiple_notes, update_frontmatter, get_notes_info
- **MCP inspector**: Fixed command syntax for testing

## [0.2.x] - 2025-09-21/22

### Added
- **delete_note**: Safe deletion with confirmation requirement
- **Path security**: Enhanced path validation and traversal protection
- **Error handling**: Improved error messages and validation

### Changed
- **Project name**: Renamed from mcp-fs-obsidian to mcpvault
- **Bun optimization**: Pure Bun implementation with native APIs
- **Documentation**: Significantly improved README with examples

### Fixed
- **Command usage**: Fixed README to use bunx for end users
- **File filtering**: Added .tmp files to gitignore

## [0.1.0] - 2025-09-21

### Added
- **Initial release**: Basic MCP server for Obsidian vault access
- **Core tools**: read_note, write_note, list_directory, search_notes
- **Security**: Path filtering and vault boundary protection
- **Frontmatter**: YAML frontmatter parsing and validation
- **MCP protocol**: Model Context Protocol server implementation

### Features
- Obsidian vault integration
- Safe file operations
- Frontmatter handling
- Directory listing
- Content search

---

## Migration Notes

### From Bun to Node.js (v0.5.0)
If you were using the Bun version, update your configuration:

**Old (Bun):**
```json
{
  "command": "bunx",
  "args": ["mcpvault", "/path/to/vault"]
}
```

**New (Node.js):**
```json
{
  "command": "npx",
  "args": ["@bitbonsai/mcpvault@latest", "/path/to/vault"]
}
```

### Package Name Change (v0.3.0)
The package was renamed and moved to a scoped package for better npm distribution.

## Security Updates

All versions include security measures:
- Path traversal protection
- File type filtering
- YAML validation
- Vault boundary enforcement

## Support

- **Node.js**: v18.0.0 or later required
- **MCP Clients**: Claude Desktop, Claude Code, ChatGPT Desktop, IntelliJ IDEA 2025.1+
- **File Types**: .md, .markdown, .txt, .base, .canvas files supported
