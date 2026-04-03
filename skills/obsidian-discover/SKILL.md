---
name: obsidian-discover
description: >
  First-run vault onboarding. Walks the vault structure, asks the user about
  folder purposes and detail-level preferences, then writes a .vault-config.md
  to the vault root. Run automatically when .vault-config.md is missing, or
  manually to update preferences.
metadata:
  version: "1.0"
  author: jayokawachi
---

# Obsidian Discover

Onboard a user's Obsidian vault so that other skills (like `obsidian-organize`)
know how to treat each folder and note.

## When to Run

- **Automatically:** `obsidian-organize` checks for `.vault-config.md` in the
  vault root. If missing, it invokes this skill first.
- **Manually:** User runs `/obsidian-discover` to update their config after
  adding new folders or changing preferences.

## Flow

```
1. Read vault structure    (get_vault_structure depth=2)
2. Read existing tags       (list_all_tags)
3. Read recent activity     (get_recent_notes days=14)
4. Ask about each top-level folder — ONE question at a time
5. Ask detail-level preferences
6. Ask about conventions
7. Write .vault-config.md
```

### Step 1-3: Silent Discovery

Gather context before asking anything. Do NOT dump raw output to the user.
Summarize what you see:

> "I can see your vault has these top-level folders: **Docs**, **Team**,
> **SOR**, **Temporary**, ... and you've been active in X and Y recently."

### Step 4: Folder Purposes

For each top-level folder (excluding `.obsidian`, `_trash`, and dotfolders),
ask ONE question at a time:

> "What is **[Folder Name]** for?"

Accept short answers. Don't over-probe. Move on after each answer.

If the user has many folders, batch them:

> "Here are the folders I found. Can you give me a one-liner for each?"
> - Docs:
> - Team:
> - SOR:
> - ...

### Step 5: Detail-Level Preferences

Ask which folders should get **detailed** treatment (full context preserved,
longer summaries) vs **crisp** treatment (tight summaries, key decisions only):

> "When I summarize or reorganize notes, some folders should stay detailed
> (documentation, designs) and others should be crisp (meeting summaries,
> scratch notes). Which folders are which?"

Present the folders as a list and let the user assign. Default suggestion:
- Detailed: anything documentation or design-oriented
- Crisp: meetings, 1:1s, scratch/temporary

### Step 6: Conventions

Ask about linking and naming conventions:

> "Any naming conventions I should follow? For example:
> - Do you name meeting notes by date? (e.g., `SOR/2026-03-28.md`)
> - Do you use `[[wikilinks]]` to connect notes?
> - Any tags you use consistently?"

### Step 7: Write Config

Write `.vault-config.md` to the vault root using `create_note` (or
`update_note` if it already exists).

**Format:**

```markdown
---
type: vault-config
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Vault Configuration

## Folders

| Folder | Purpose | Detail Level |
|--------|---------|-------------|
| Docs | Project documentation, general reference | detailed |
| SOR | Weekly company meeting notes | crisp |
| Team | 1:1 notes, team interactions | crisp |
| Personal Plans | 30/60/90-day plans | detailed |
| Temporary | Scratch notes, needs reorganization | crisp |
| Diagrams | Reference diagrams and files | detailed |
| Onboarding | Onboarding documentation and notes | crisp |

## Conventions

- **Links:** [[wikilinks]]
- **Meeting notes:** named by date (e.g., `SOR/2026-03-28.md`)
- **Tags:** #tag-name for categorization
- **Soft delete:** _trash/ (MCP handles automatically via softDeleteNote)

## Detail Levels

- **Detailed:** Preserve full context. Summaries can be 300+ words. Keep
  examples, rationale, edge cases.
- **Crisp:** Key decisions and action items only. Summaries under 150 words.
  Strip preamble, small talk, repeated context.
```

## Rules

1. **Never assume** — always ask. If a folder name is ambiguous, ask.
2. **One question at a time** — don't overwhelm.
3. **Respect existing config** — if `.vault-config.md` exists and the user
   runs discover again, show current config and ask what changed.
4. **No changes to notes** — this skill only reads the vault and writes the
   config file. It never modifies, moves, or deletes user notes.
