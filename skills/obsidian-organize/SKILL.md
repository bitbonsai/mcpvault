---
name: obsidian-organize
description: >
  Triage, summarize, rephrase, consolidate, and reorganize Obsidian vault notes.
  Reads .vault-config.md for folder purposes and detail levels. Always presents
  a batch reorganization plan for user approval before making any changes.
  Invokes obsidian-discover if config is missing.
metadata:
  version: "1.0"
  author: jayokawachi
---

# Obsidian Organize

The workhorse skill for keeping an Obsidian vault clean, consolidated, and
navigable. Reads the user's vault config, analyzes notes, proposes a batch
plan, and executes on approval.

## Prerequisites

This skill requires `.vault-config.md` in the vault root. If missing, invoke
`obsidian-discover` first and return here after config is written.

## Trigger

- User invokes `/obsidian-organize`
- User asks to "clean up", "organize", "summarize", or "consolidate" notes
- User asks to triage Temporary or reorganize specific folders

## Flow

```
1. Load config           → read .vault-config.md
2. Determine scope       → user-specified or default scan
3. Analyze notes         → read, search related, check links
4. Build batch plan      → all proposed changes in one view
5. User approves/edits   → never proceed without approval
6. Execute plan          → soft-delete originals, write new versions
7. Rebuild index         → rebuild_index after all changes
8. Report                → summary of what was done
```

## Step 1: Load Config

Read `.vault-config.md` from vault root. Extract:
- Folder purposes and detail levels (detailed vs crisp)
- Naming conventions
- Link style

If config is missing or corrupted, stop and invoke `obsidian-discover`.

## Step 2: Determine Scope

**User-specified scope:**
- "Clean up Temporary" → scan only `Temporary/`
- "Summarize this note" → single note
- "Organize my Team notes" → scan `Team/`

**Default scope (no specific request):**
- Scan `Temporary/` for untriaged notes
- Scan other folders for notes that could be consolidated or summarized
- Use `get_recent_notes` to prioritize recently modified notes

## Step 3: Analyze Notes

For each note in scope:

1. **Read content** — `read_note` to get full body and frontmatter
2. **Find related notes** — `search_notes` using key terms from the note
3. **Check graph** — `get_backlinks` and `get_outgoing_links` to understand
   connections
4. **Assess state:**
   - Is this note in the wrong folder based on its content?
   - Does it overlap with an existing note?
   - Is it too long for its folder's detail level?
   - Does it contain context that belongs in multiple notes?
   - Are there broken or missing links?

## Step 4: Build Batch Plan

Present ALL proposed changes in a single plan. Group by action type:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Reorganization Plan (N notes affected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MOVE (wrong folder → right folder)
  1. "Temporary/deploy-notes.md" → "Docs/Deploy Process.md"
     Rephrase: clean up raw dump into structured doc (detailed)

MERGE (duplicated context)
  2. "Team/alice-march-5.md" + "Team/alice-march-12.md" → "Team/Alice.md"
     Summarize: 2 meetings → crisp summary, key decisions preserved

SPLIT (one note → multiple destinations)
  3. "SOR/2026-03-28.md"
     → Action items appended to "Team/Alice.md", "Team/Bob.md"
     → Project updates linked to "Docs/Project X.md"

SUMMARIZE (too verbose for detail level)
  4. "Onboarding/week-1-notes.md"
     Crisp: 2000 words → ~300 words, key takeaways only

LINK (missing connections)
  5. Add [[Deploy Process]] link to "Docs/Infrastructure.md"

⚠️  DECISIONS NEEDED
  6. "Temporary/random-idea.md" — content unclear.
     Options: (a) Move to Docs  (b) Keep in Temporary  (c) Delete
  7. "Team/old-standup-notes.md" — last modified 60 days ago.
     This contains specific technical context about API migration.
     Options: (a) Summarize and keep  (b) Archive to _trash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Plan Rules

- **Every change is visible** — no silent modifications
- **Flag ambiguous decisions with ⚠️** — never silently discard context
- **Show what will be lost** — if summarizing removes detail, say what's being cut
- **Notify on rephrase risk** — if rephrasing changes meaning or nuance, flag it
- **Respect detail levels** — use the config to determine summary length
- **Reuse existing notes** — prefer appending to or updating existing notes over
  creating new ones
- **Preserve links** — update `[[wikilinks]]` when notes move or merge

## Step 5: User Approval

Present the plan and wait. Accept:
- **"looks good"** / **"approve"** → execute all
- **Numbered edits** — "change 3 to just link, don't split" → revise and re-present
- **Partial approval** — "do 1-3, skip the rest" → execute subset
- **"reject"** → discard plan, ask what they'd prefer

**Never execute without explicit approval.**

## Step 6: Execute Plan

For each approved action, in order:

### MOVE
1. Read source note content
2. Rephrase/restructure content per detail level
3. Soft-delete original (MCP `softDeleteNote` → backs up to `_trash/`)
4. Create note at new path with cleaned content
5. Update any `[[wikilinks]]` in other notes that pointed to old path

### MERGE
1. Read all source notes
2. Consolidate content, removing duplicates
3. Summarize per detail level
4. Soft-delete source notes
5. Write merged note (update if target exists, create if new)
6. Update backlinks

### SPLIT
1. Read source note
2. Extract sections for each destination
3. Append extracted content to destination notes
4. Update source note to remove extracted content and add links to destinations
5. Do NOT delete source — it keeps its remaining content

### SUMMARIZE
1. Read note
2. Soft-delete original (backup to `_trash/`)
3. Write summarized version at same path
4. Preserve all frontmatter and links

### LINK
1. Read target note
2. Add `[[wikilink]]` at appropriate location
3. No soft-delete needed — additive only

## Step 7: Rebuild Index

After all changes are complete, call `rebuild_index` once.

## Step 8: Report

```
Done. 5 actions completed:
  ✓ Moved 1 note (Temporary → Docs)
  ✓ Merged 2 notes into Team/Alice.md
  ✓ Split action items from SOR/2026-03-28.md → 2 team notes
  ✓ Summarized 1 note (2000 → 280 words)
  ✓ Added 1 link

Backups in _trash/:
  - deleted-20260403-141023-deploy-notes.md
  - deleted-20260403-141024-alice-march-5.md
  - deleted-20260403-141024-alice-march-12.md
  - deleted-20260403-141025-week-1-notes.md
```

## Summarization Guidelines

### Crisp (default for meetings, 1:1s, scratch)
- **Target:** under 150 words
- **Keep:** decisions, action items, key outcomes, names/owners
- **Cut:** preamble, small talk, repeated context, verbose explanations
- **Format:** bullet points, no prose paragraphs

### Detailed (documentation, designs, plans)
- **Target:** 300+ words, as long as needed
- **Keep:** rationale, examples, edge cases, technical specifics
- **Cut:** only true duplication or outdated information
- **Format:** structured with headers, can include code blocks

### When in Doubt
If summarizing would lose context that might matter later, **flag it** in the
plan with ⚠️. Let the user decide. Never silently discard non-obvious context.

## Rules

1. **Config required** — never organize without `.vault-config.md`
2. **Batch plan always** — never make changes without showing the full plan
3. **Soft delete always** — every overwrite or delete goes through `_trash/`
4. **Flag ambiguity** — unclear destination, risky summarization, or potential
   context loss gets a ⚠️ in the plan
5. **Reuse notes** — prefer updating existing notes over creating new ones
6. **Preserve links** — update wikilinks when notes move, merge, or rename
7. **One rebuild** — call `rebuild_index` once after all changes, not per-action
8. **No silent drops** — if content is being removed or rephrased, the plan
   must show what's changing and why
