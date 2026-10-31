# Obsidian Skill

Routes file operations to MCPVault, app actions to Obsidian CLI, and sync tasks to Git.

## Install

```
npx skills add bitbonsai/mcpvault
```

### What it covers

- Full-text search across note filenames and content, ranked with BM25.
- Tag and frontmatter updates that leave note content unchanged.
- Read, write, and patch tools scoped to the configured vault root.
- Optional Git commands for committing, pulling, and pushing a vault.

## Routing Matrix

Each operation maps to exactly one backend. The skill picks the right one automatically.

| Operation | MCP | Obsidian CLI | Git | Notes |
|-----------|-----|-------------|-----|-------|
| Read note | yes | — | — | Vault-scoped read via MCP |
| Write / patch note | yes | — | — | Validated writes through MCPVault |
| Search vault | yes | — | — | BM25-ranked full-text search |
| Resolve [[wiki links]] | yes | — | — | wiki_link picks the shallowest match first, then locale-sorts equal-depth paths; other matches are returned as alternatives |
| Manage tags / frontmatter | yes | — | — | Frontmatter merge through MCP |
| List all tags with counts | yes | — | — | Filesystem scan, works headless |
| Move / rename notes | yes | — | — | MCP move followed by explicit backlink search, repair, and verification |
| Get active file | — | yes | — | Currently focused file in Obsidian |
| Open note in Obsidian | — | yes | — | Open by path in editor |
| Daily notes | — | yes | — | Create/read/append with template expansion |
| Backlinks | — | yes | — | Incoming links to a note |
| Trigger plugin commands | — | yes | — | Workspace actions, plugin APIs |
| Sync vault across devices | — | — | yes | Plain git, no Obsidian Sync needed |
| Automated backup | — | — | yes | Cron / launchd, no UI needed |

## Flow Cheat Sheet

The skill routes by intent:

1. Vault read/write/search/tag/frontmatter requests route to **MCP**.
2. Open-in-editor or app/plugin-context requests route to **Obsidian CLI/App context**.
3. Sync/backup/store-with-git requests route to **Git CLI**.

### Safe note rename flow

1. Search for the old wikilink target by vault-relative path and filename stem.
2. Move the note with MCP `move_note`, even when Obsidian is running.
3. Patch exact wikilink targets in referring notes while preserving aliases, embeds, and heading/block fragments.
4. Search again and report any stale references. If the 20-result search cap is reached or the basename is ambiguous, do not claim exhaustive repair.

The skill does not invoke `obsidian move` automatically. Delayed link rewrites can use stale byte offsets and corrupt notes edited while the command is still running ([#176](https://github.com/bitbonsai/mcpvault/issues/176)). CLI moves should only be reconsidered after an upstream fix is independently retested.

### Git sync flow

1. Preflight: verify git, repo, identity, and remote.
2. If setup is incomplete, ask one targeted question with a recommended default.
3. Run sync sequence: `git add -A` → `git commit` (if changes) → `git pull --rebase` → `git push`.
4. Stop on conflicts and provide manual next steps.

## Expanded Flow Playbook

### Routing defaults

- **MCP first** for read/write/search/frontmatter/tags.
- **Obsidian CLI/App context** for app/editor/plugin-specific behavior and read-only backlink discovery. All note moves use MCP `move_note` plus explicit backlink repair.
- **Git CLI** for sync, backup, and versioning actions.

### Preflight checks before sync

```bash
git --version
git rev-parse --is-inside-work-tree
git config user.name
git config user.email
git remote -v
```

If any check fails, ask one targeted setup question with a recommended default.

### Example conversation

```text
User: Use git to store my vault and keep it synced.
Skill: I will run a git preflight first (git, repo, identity, remote), then set up anything missing with one targeted question.
Skill: Preflight OK. Running sync: git add -A → git commit (if changes) → git pull --rebase → git push.
Skill: Done. Vault synced to origin/main. No force push used.
```

## What It Is

**MCP Server:** Handles note reads, writes, searches, patches, and moves. It validates inputs and rejects paths outside the configured vault.

**Obsidian CLI:** Uses Obsidian's official CLI for operations that need the running desktop app: active file, opening notes in the editor, daily notes with template expansion, read-only backlink discovery, and plugin commands. A preflight checks the installed CLI at runtime instead of assuming a fixed version.

**Git sync:** Commits, pulls, and pushes vault files. Cron, launchd, or CI can run the commands without Obsidian.

## Git-Based Vault Sync

An Obsidian vault is a folder of markdown files. Run `git init` inside it, add a remote, then commit, pull, and push like any repository.

### Headless automation

```bash
# cron job or launchd plist
cd /path/to/vault
git add -A
git commit -m "backup $(date +%Y-%m-%d)"
git push
```

No Obsidian CLI required. Works on servers, NAS, or any headless machine.

### Optional: Obsidian Git plugin

The [Obsidian Git](https://github.com/Vinzent03/obsidian-git) community plugin (8k+ stars) adds GUI-driven auto-sync from within the app: auto-commit on interval, pull on startup, push on close, and a source control sidebar.

### Caveats

- Git sync runs when changes are committed.
- Editing the same note on two devices before syncing may require manual conflict resolution.
- Images and PDFs may need `.gitignore` or Git LFS.
- Add `.obsidian/workspace.json` to `.gitignore`.

Recommended .gitignore:

```
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/plugins/obsidian-git/data.json
.trash/
```

## When To Use

**Trigger phrases:**
- "search my vault for..." → MCP
- "update the frontmatter on..." → MCP
- "tag all notes about..." → MCP
- "what tags exist in my vault?" → MCP (`list_all_tags`)
- "what file am I looking at?" → Obsidian CLI
- "what's the active note?" → Obsidian CLI
- "open this note in Obsidian" → Obsidian CLI
- "add a task to my daily note" → Obsidian CLI
- "what links to this note?" → Obsidian CLI
- "sync my vault" → Git CLI
- "use git to store my vault" → Git CLI
- "move this note to..." → MCP `move_note`, then explicit backlink repair and verification

**Not a fit for:**
- General markdown editing (no vault context)
- Non-Obsidian file management
- Web-based Obsidian Publish tasks

## Workflow Patterns

### 1. Search, then open

Search for a note through MCP, read it, then open it in Obsidian for visual editing.

Steps: search_notes → read_note → open in Obsidian

### 2. Choose a backend

File operations use MCPVault. Actions that need the running app use Obsidian CLI, with `obsidian://` URIs as fallback.

Steps: Read the request → choose MCP or Obsidian CLI → run the operation

### 3. Review and patch

Write a draft via MCP, review in Obsidian, then patch corrections back through MCP.

Steps: write_note → review in editor → patch_note

## Safety Defaults

- File mutations go through MCPVault path validation.
- Destructive tools require explicit confirmation parameters.
- Commands pass argument arrays instead of building shell command strings from note content.
- MCP tools reject traversal outside the configured vault root.

## Quick Start

Skill folder structure:

```
.claude/
  skills/
    obsidian/
      SKILL.md                          # Gotchas, error recovery, index
      resources/
        tool-patterns.md                # Per-tool response shapes and recipes
        obsidian-conventions.md         # Vault structure, wikilinks, tags
        git-sync.md                     # Git backup/sync workflows
```

SKILL.md frontmatter:

```yaml
---
name: obsidian
description: >
  Activate when the user mentions their
  Obsidian vault, notes, tags, frontmatter,
  daily notes, backup, or sync. Route
  operations across MCP, Obsidian CLI/app
  actions, and git sync with safe defaults.
metadata:
  version: "2.2"
  author: bitbonsai
---
```
