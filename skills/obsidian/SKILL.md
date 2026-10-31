---
name: obsidian
description: >
  Activate when the user mentions their Obsidian vault, notes, tags,
  frontmatter, daily notes, backup, or sync. Route operations across MCP,
  Obsidian CLI/app actions, and git sync with safe defaults.
metadata:
  version: "2.2"
  author: bitbonsai
---

# Obsidian Skill

## Routing Policy

Use the backend that best matches user intent:

1. **MCP (default for vault data operations)**
   - Read/write/patch/search notes
   - Move/rename notes with `move_note`, then explicitly repair backlinks
   - Frontmatter and tag updates
   - Metadata and batch note operations

2. **Obsidian CLI/App context (only when app context is needed)**
   - Open a note in Obsidian from URI
   - Trigger app/plugin workflows that MCP cannot perform

3. **CLI git (sync/backup workflows)**
   - Initialize repo, configure remote, commit, pull, push
   - Periodic or manual vault backup/sync requests

When a request is ambiguous, pick MCP first unless the user explicitly asks for sync/backup/git/app behavior.

## Safe Note Rename Workflow

Use MCP `move_note` for every note move or rename, even when Obsidian is running. Do not invoke the Obsidian CLI `move` command automatically: delayed link rewrites can apply stale byte offsets to notes edited after the move began, silently corrupting unrelated content ([#176](https://github.com/bitbonsai/mcpvault/issues/176)). Reconsider CLI moves only after an upstream fix has been independently retested.

Backlink preservation is an explicit, verifiable second step:

1. Before moving, search for the old wikilink target using both its vault-relative path and filename without the extension. If Obsidian is running, its read-only `backlinks` command may supplement discovery, but it does not replace the MCP search.
2. Move the note with MCP `move_note`.
3. Read each referring note and patch only exact wikilink targets, including embeds and links with aliases or fragments. Preserve display text (`|alias`) and `#heading` / `#^block-id` suffixes while changing the target.
4. Search again for the old path and basename. Report any remaining references instead of claiming success.
5. `search_notes` returns at most 20 results. If a search reaches that cap, or the old basename is ambiguous, tell the user exhaustive backlink repair cannot be proven and ask before continuing with a broader scan.

Report the move and backlink repair separately: which note moved, how many referring notes changed, and any stale references that remain.

## Gotchas

1. **patch_note rejects multi-match by default.** With `replaceAll: false`, if `oldString` appears more than once the call fails and returns `matchCount`. Set `replaceAll: true` only when you mean it, or add surrounding context to make the match unique.

2. **patch_note matches inside frontmatter.** The replacement runs against the full file including the YAML block. A generic string like `title:` will match frontmatter fields. Include enough context to target the right occurrence.

3. **patch_note forbids empty strings.** Both `oldString` and `newString` must be non-empty and non-whitespace. To delete text, use `newString` with a single space or restructure the note with `write_note`.

4. **search_notes returns minified JSON.** Fields are abbreviated: `p` (path), `t` (title), `ex` (excerpt), `mc` (matchCount), `ln` (lineNumber), `uri` (obsidianUri). Hard cap of 20 results regardless of `limit`.

5. **search_notes multi-word queries score terms individually AND as a phrase.** Each term is OR-matched, so a document matching any term appears in results. The full phrase gets an additional scoring boost.

6. **write_note auto-creates directories.** Parent folders are created recursively. In `append`/`prepend` mode, if the note doesn't exist it's created. Frontmatter is merged (new keys override) in append/prepend; replaced entirely in overwrite.

7. **delete_note requires exact path confirmation.** `confirmPath` must be character-identical to `path`. No normalization, no trailing-slash tolerance. Mismatch silently fails with `success: false`.

8. **move_file needs double confirmation.** Both `confirmOldPath` and `confirmNewPath` must exactly match their counterparts. Use `move_note` for markdown renames (text-aware, no confirmation needed); use `move_file` only for binary files or when you need binary-safe moves.

9. **manage_tags reads from two sources but writes to one.** `list` merges frontmatter tags + inline `#hashtags`. `add`/`remove` only modify the frontmatter `tags` array. Inline tags are never touched.

10. **read_multiple_notes never rejects.** Uses `allSettled` internally. Failed files appear in the `err` array; successful ones in `ok`. Always check both. Hard limit of 10 paths per call.

## Error Recovery

| Error | Next step |
|-------|-----------|
| patch_note "Found N occurrences" | Add surrounding lines to `oldString` to make it unique, or set `replaceAll: true` |
| delete_note / move_file confirmation mismatch | Re-read the note path with `read_note` or `list_directory`, then retry with the exact string |
| search_notes returns 0 results | Try single keywords instead of phrases, toggle `searchFrontmatter`, or broaden with partial terms |
| read_multiple_notes partial `err` | Verify failed paths with `list_directory`, fix typos or missing extensions, retry only failed ones |

## Git Sync Mode

When the user asks to "sync", "backup", or "store my vault with git", use CLI git with this behavior:

1. Run a **preflight** before changing anything:
   - `git` available
   - current directory is a git repo (or prompt to initialize)
   - `git config user.name` and `git config user.email` are set
   - at least one remote exists for push/pull sync

2. If preflight is incomplete, ask exactly one targeted question with a recommended default.
   - Use askuserquestion for decisions that materially change behavior.
   - Good examples:
     - "No git repo found. Initialize one in this vault now? (Recommended: Yes)"
     - "No remote configured. Set up GitHub remote now via gh if available, or provide remote URL? (Recommended: Set up via gh)"
     - "Local and remote diverged. Try `git pull --rebase` now? (Recommended: Yes)"

3. Safe sync sequence (never force push by default):
   - `git add -A`
   - `git commit -m "vault sync: YYYY-MM-DD HH:mm"` (skip commit if no changes)
   - `git pull --rebase`
   - `git push`

4. `gh` is optional:
   - Use `gh` only for remote bootstrapping (create repo / set origin) when requested.
   - Do not require `gh` for normal sync once remote is configured.

5. Stop on conflicts and report clear next steps.
   - Do not auto-resolve merge conflicts silently.
   - Explain what failed and what user should run next.

## Obsidian CLI Mode

When the user asks for app-context operations (active file, open in editor, daily notes with templates, backlinks), use the Obsidian CLI directly via shell commands.

1. Run a **preflight** before first CLI use:
   - Resolve the CLI binary using the first match from these candidates:

     | Priority | macOS | Linux | Windows |
     |----------|-------|-------|---------|
     | 1 | `obsidian` (PATH) | `obsidian` (PATH) | `obsidian.exe` or `Obsidian.com` (PATH) |
     | 2 | `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli` | — | — |
     | 3 | `/Applications/Obsidian.app/Contents/MacOS/Obsidian` | — | — |

     > **Obsidian 1.12.7+ installer** bundles a dedicated `obsidian-cli` binary (~10x
     > faster than the legacy Electron-based CLI: ~25ms vs ~250ms per call). On macOS,
     > after installing the 1.12.7+ installer, disable then re-enable the CLI in
     > Settings > General > Advanced to update PATH registration. This replaces the old
     > `~/.zprofile` PATH entry with a `/usr/local/bin/obsidian` symlink pointing to
     > `obsidian-cli`.
     >
     > On Linux, PATH registration creates a symlink at `/usr/local/bin/obsidian`
     > (or `~/.local/bin/obsidian` as fallback). On Windows, the installer places an
     > `Obsidian.com` terminal redirector alongside `Obsidian.exe`.
     >
     > **Note:** The priority table and stale PATH check are verified on macOS only.
     > Linux and Windows may also bundle `obsidian-cli` with the 1.12.7+ installer,
     > but this has not been confirmed. Contributions welcome via issue or PR.

   - **Stale PATH check (macOS):** If priority 1 resolved `obsidian` on PATH, check
     whether it points to the fast binary or the slow Electron launcher:

     | Resolved path | Meaning | Action |
     |---------------|---------|--------|
     | `/usr/local/bin/obsidian` → `obsidian-cli` | 1.12.7 symlink registration | None — fast binary |
     | `/Applications/.../MacOS/obsidian` | Old `~/.zprofile` entry (pre-1.12.7 registration or 1.12.7 installer without re-registering) | Check if `obsidian-cli` exists in the bundle |

     If `obsidian` resolves to the MacOS directory (not `/usr/local/bin`) AND
     `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli` exists, tell the user:
     _"Obsidian 1.12.7+ is installed but PATH still points to the slower Electron
     binary. In Obsidian, go to Settings > General > Advanced and disable then
     re-enable the CLI to update PATH registration."_
     Continue with whichever priority matched — this is advisory, not blocking.

   - Check Obsidian is running: `pgrep -xiq obsidian` (macOS/Linux) or `tasklist /FI "IMAGENAME eq Obsidian.exe" /NH` (Windows)
   - If either fails, tell the user and fall back to MCP tools + `obsidian://` URIs

2. Vault targeting: `obsidian vault="VaultName" <command>`. If `OBSIDIAN_VAULT_NAME` is set, use that explicit value. Otherwise run `obsidian vaults`, match the MCP vault path to a registered vault, and use its registered name. If no unique match exists, ask the user. Never infer the registered name from the folder basename.

3. Key commands:
   ```bash
   # Read the currently active file
   obsidian read

   # Read a specific file
   obsidian read file="My Note"

   # Open a file in Obsidian
   obsidian open path="Notes/example.md"

   # Open today's daily note
   obsidian daily

   # Append to daily note
   obsidian daily:append content="- [ ] New task"

   # Search (Obsidian's own search, different from MCP's BM25)
   obsidian search query="meeting notes" limit=10

   # List all tags with frequency
   obsidian tags sort=count counts

   # Get backlinks for a note
   obsidian backlinks file="My Note"

   # Find unresolved links
   obsidian unresolved
   ```

   Do not use `obsidian move`; follow **Safe Note Rename Workflow** with MCP `move_note` and explicit backlink repair.

4. Run `obsidian help` for the full command reference. The CLI evolves with Obsidian releases.

5. **When to use CLI vs MCP:**
   - MCP for reads/writes/search/tags/frontmatter and all note moves/renames (sandboxed, validated, works headless)
   - CLI for active file, daily notes with template expansion, read-only backlink discovery, open in editor, and plugin commands
   - After `move_note`, repair and verify backlinks explicitly with the Safe Note Rename Workflow
   - If unsure, prefer MCP

## Resources

Load these only when needed, not on every invocation.

- [Tool Patterns](resources/tool-patterns.md) - read when you need a tool's response shape, mode details, or the move_note vs move_file decision
- [Obsidian Conventions](resources/obsidian-conventions.md) - read when creating/writing note content (link syntax, frontmatter fields, daily note format, template variables)
- [Git Sync](resources/git-sync.md) - read when user asks for backup/sync/store-vault workflows with git/gh
