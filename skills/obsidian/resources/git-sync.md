# Git Sync

Practical playbook for handling user requests like:
- "sync my vault"
- "backup my vault"
- "use git to store my vault"

## Routing Rule

- Use **MCP tools** for note/content operations.
- Use **CLI git** for sync/backup/versioning operations.
- Use **Obsidian app/URI actions** only when user needs editor/plugin behavior.

## Preflight Checklist

Run these checks before setup or sync:

1. `git --version`
2. `git rev-parse --is-inside-work-tree`
3. `git config user.name`
4. `git config user.email`
5. `git remote -v`
6. `git status --porcelain`

Interpretation:
- Missing git binary: cannot continue sync.
- Not a repo: offer `git init`.
- Missing name/email: ask user to set identity.
- No remote: sync can commit locally, but cannot push until remote is configured.

## Confirmation patterns

Use a single targeted question when a decision changes behavior.

1. Repo missing:
   - "No git repo found in this vault. Initialize one now?"
   - Recommended default: **Yes**

2. Remote missing:
   - "No remote is configured. Do you want GitHub auto-setup via `gh`, or provide a remote URL?"
   - Recommended default: **GitHub auto-setup via gh** (if `gh auth status` passes)

3. Diverged history / rebase needed:
   - "Local and remote branches diverged. Run `git pull --rebase` now?"
   - Recommended default: **Yes**

4. Identity missing:
   - "Git user.name/email are not configured. Configure now for this repo?"
   - Recommended default: **Yes (repo-local config)**

## Standard Sync Action

Use this order for safe, transparent sync:

1. `git add -A`
2. `git commit -m "vault sync: YYYY-MM-DD HH:mm"` (skip if nothing to commit)
3. `git pull --rebase`
4. `git push`

Safety defaults:
- Never use `push --force` unless user explicitly requests it.
- Never use destructive reset commands.
- If conflicts occur, stop and explain exactly what needs manual resolution.

## Setup Flows

### A) Existing repo + remote (fast path)

- Preflight passes -> run Standard Sync Action.

### B) Not a repo yet

1. `git init`
2. `git add -A`
3. `git commit -m "chore: initialize vault repository"`
4. Configure remote (see C or D)
5. Run Standard Sync Action

### C) Configure GitHub remote using gh (optional)

Preconditions:
- `gh --version`
- `gh auth status` succeeds

Example:
1. `gh repo create <name> --private --source=. --remote=origin --push`
2. Set upstream if needed: `git push -u origin <branch>`

### D) Configure remote manually (no gh)

1. `git remote add origin <remote-url>`
2. `git push -u origin <branch>`

## User-Facing Success Messages

Keep output practical and clear:
- "Sync complete: 4 files changed, pushed to origin/main."
- "Vault already up to date: no local changes to commit."
- "Local commit created, but push skipped because no remote is configured."

## Automation Recipes

For recurring backups, recommend platform scheduler:
- macOS: launchd
- Linux: cron
- Windows: Task Scheduler

Minimal script logic:
1. pull with rebase
2. add/commit if changes
3. push

Avoid scheduling if frequent merge conflicts are expected (multi-device concurrent edits).
