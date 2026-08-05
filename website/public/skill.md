# Obsidian Skill

Combines MCP server safety with Obsidian CLI context. One skill that routes each operation to the right backend.

## Install

```
npx skills add bitbonsai/mcpvault
```

### What can you do with it?

- **Find any note instantly** — Full-text search with relevance ranking across your entire vault.
- **Organize with smart tags** — Add, remove, and bulk-manage tags and frontmatter across hundreds of notes.
- **Edit notes safely** — Atomic read/write/patch operations with path sandboxing.
- **Sync across devices** — Optional git-based sync with no paid subscription required.

## Routing Matrix

Each operation maps to exactly one backend. The skill picks the right one automatically.

| Operation | MCP | Obsidian CLI | Git | Notes |
|-----------|-----|-------------|-----|-------|
| Read note | yes | — | — | Safe, sandboxed read via MCP |
| Write / patch note | yes | — | — | Atomic writes with validation |
| Search vault | yes | — | — | BM25-ranked full-text search |
| Resolve [[wiki links]] | yes | — | — | wiki_link picks the shallowest match first, then locale-sorts equal-depth paths; other matches are returned as alternatives |
| Manage tags / frontmatter | yes | — | — | Safe YAML merge |
| List all tags with counts | yes | — | — | Filesystem scan, works headless |
| Move / rename files | yes | yes | — | CLI move rewrites internal links (app running); MCP move works headless |
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

### Git sync flow

1. Preflight: verify git, repo, identity, and remote.
2. If setup is incomplete, ask one targeted question with a recommended default.
3. Run safe sync sequence: `git add -A` -> `git commit` (if changes) -> `git pull --rebase` -> `git push`.
4. Stop on conflicts and provide manual next steps.

## Expanded Flow Playbook

### Routing defaults

- **MCP first** for read/write/search/frontmatter/tags.
- **Obsidian CLI/App context** for app/editor/plugin-specific behavior, and for move/rename while the app is running — the CLI rewrites internal links that a filesystem move would leave stale (MCP is the headless fallback).
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
Skill: Preflight OK. Running sync: git add -A -> git commit (if changes) -> git pull --rebase -> git push.
Skill: Done. Vault synced to origin/main. No force push used.
```

## What It Is

**MCP Server** — Handles all file I/O: reading, writing, searching, patching, and organizing notes. Enforces path sandboxing, validates inputs, and performs atomic operations. The safe default for any vault mutation.

**Obsidian CLI** — Uses Obsidian's official CLI for operations that need the running desktop app: active file, opening notes in the editor, daily notes with template expansion, backlinks, plugin commands, and link-aware moves that update every reference. The skill tracks the current official CLI — a preflight detects your installed binary at runtime, so nothing is pinned to a version that can go stale.

**Git Sync** — Plain git for vault syncing across devices. No Obsidian Sync subscription required. Works headlessly via cron, launchd, or CI — no app needs to be running.

## Git-Based Vault Sync

An Obsidian vault is just a folder of markdown files. You can `git init` inside it, add a remote, and push/pull like any repo. No proprietary format, no paid service.

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

- **Not real-time** — git syncs on commit intervals, not instantly
- **Merge conflicts** — editing the same note on two devices before syncing requires manual resolution
- **Large binaries** — images and PDFs aren't great for git; use `.gitignore` or Git LFS
- **Workspace files** — add `.obsidian/workspace.json` to `.gitignore`

Recommended .gitignore:

```
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/plugins/obsidian-git/data.json
.trash/
```

## When To Use

**Trigger phrases:**
- "search my vault for..." -> MCP
- "update the frontmatter on..." -> MCP
- "tag all notes about..." -> MCP
- "what tags exist in my vault?" -> MCP (list_all_tags)
- "what file am I looking at?" -> Obsidian CLI
- "what's the active note?" -> Obsidian CLI
- "open this note in Obsidian" -> Obsidian CLI
- "add a task to my daily note" -> Obsidian CLI
- "what links to this note?" -> Obsidian CLI
- "sync my vault" -> Git CLI
- "use git to store my vault" -> Git CLI
- "move this note to..." -> Obsidian CLI (app running), MCP when headless

**Not a fit for:**
- General markdown editing (no vault context)
- Non-Obsidian file management
- Web-based Obsidian Publish tasks

## Workflow Patterns

### 1. Sequential Orchestration

Chain MCP reads into app actions. Search for a note via MCP, then open it in Obsidian for visual editing.

Steps: search_notes → read_note → open in Obsidian

### 2. Context-Aware Selection

The skill picks the right backend automatically. File operations route through MCP; app-context actions use the official Obsidian CLI, with obsidian:// URIs as fallback.

Steps: Analyze user intent → Route to MCP or App → Execute with safety checks

### 3. Iterative Refinement

Write a draft via MCP, review in Obsidian, then patch corrections back through MCP.

Steps: write_note → review in editor → patch_note

## Safety Defaults

- **Prefer MCP Writes** — All file mutations go through the MCP server, which validates paths, confirms targets, and performs atomic writes.
- **Confirm Destructive Actions** — Deletes and moves require explicit path confirmation parameters, preventing accidental data loss.
- **No Shell Interpolation** — Commands use structured arguments, never string-interpolated shell input. No injection vectors.
- **Sandbox by Default** — MCP tools are scoped to the vault root. Path traversal is blocked at the server level.

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
  version: "2.1"
  author: bitbonsai
---
```
