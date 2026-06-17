---
name: triage
description: >
  Activate for the daily repository triage run, or when the user asks to
  triage CI failures, open issues, or recent commits. Reads yesterday's
  signals, dedupes against the state file, drafts fixes in isolated
  worktrees with a reviewer pass, opens PRs on green, and keeps people out
  of limbo with comments in the maintainer's voice. The state file is the
  spine: it remembers what was tried, what passed, and what is still open,
  so each run resumes where the last one stopped.
metadata:
  version: "1.0"
  author: bitbonsai
---

# Triage Skill

A self-resuming morning loop. One run = gather → load state → triage →
fan-out fix → persist → spill. Everything personal (state, inbox, runs,
voice) lives under `.triage/`, which is gitignored. This skill file and the
scripts are committed; the data never leaves the machine.

## Preconditions

- `gh` authenticated (`gh auth status`). All issue/PR/CI reads and writes go
  through it.
- `.triage/` exists. If missing, run `scripts/triage/bootstrap.sh` first, it
  scaffolds `state.json`, `inbox.md`, `runs/`, and bootstraps `voice.md` from
  past comments.
- Clean working tree on `main`. The loop only mutates `.triage/` on the base
  checkout; all code changes happen in worktrees.

## The loop

### 1. Gather (read-only)

Collect yesterday's signals. Compute the window from `state.json.last_run`
(fall back to 24h if absent).

```
# CI failures since last run
gh run list --status failure --created ">=$SINCE" --json databaseId,name,headSha,conclusion,url
# for each, pull the failing step log
gh run view <id> --log-failed

# open issues
gh issue list --state open --json number,title,labels,updatedAt,author,url

# recent commits
git log --since="$SINCE" --pretty='%h %s %an'
```

Then scan for **open commitments**, promises the maintainer made in a comment
that have not shipped. NOT time-windowed: check every open issue/PR.

```
# threads bitbonsai commented on, still open
gh search issues "commenter:bitbonsai repo:bitbonsai/mcpvault state:open" --json number
# per thread, pull bitbonsai's comments to inspect for a promise
gh issue view <n> --json comments \
  --jq '.comments[] | select(.author.login=="bitbonsai") | .body'
```

A commitment is language that promised an action: "I'll fix this", "will add",
"shipping next release", "on it", "going to look", etc. It is broken/open if the
thread is still open and no merged PR resolved it. See `finding-rules.md`.

### 2. Load state

Read `.triage/state.json`. Build a map of known findings by `id`. The `id` is
a stable hash of `source` + `signature` (see `resources/state-schema.md`), so
the same failing test or issue always maps to the same finding across runs.

### 3. Triage

For each gathered signal compute its `id` and classify with
`resources/finding-rules.md`:

- **known + terminal** (`pr_open`, `resolved`, `wont_fix`) → skip, only bump
  `last_seen`.
- **known + open** under the attempt cap → retry.
- **new + worth-doing** → append as `status: open`, proceed to fan-out.
- **new + needs judgment / ambiguous / out of scope** → inbox, `needs_human`.
- **noise** (flaky already tracked, dependabot, etc.) → ignore, log only.

### 4. Fan-out (bounded)

First, for every finding, check whether a contributor PR already addresses it
(`finding-rules.md`, "Prefer reviewing an existing PR"). If one exists, **review
it instead of writing a fix**: send the review sub-agent at the PR branch and
draft an approval or request-changes recommendation to inbox. A human's open PR
beats a fresh one. Also surface any open PR the maintainer has not yet reviewed.

Only findings with no candidate PR proceed to a new fix, up to the per-run cap
in `finding-rules.md`. For each, in order:

```
git worktree add ../mcpvault-triage-<id> -b triage/<id>
```

Then spawn TWO sub-agents against that worktree (use the Agent tool with
`isolation: worktree` so they cannot collide):

- **Draft agent**, given the finding + failing log/issue body, write the
  smallest fix. Must read relevant `src/` files first, follow the obsidian
  skill conventions, and add or update a test that proves the fix.
- **Review agent**, adversarial. Check the draft against the project skills
  and existing tests, then run in the worktree:
  ```
  npm ci && npm test && npm run build
  ```
  Verdict is PASS only if the fix is correct, minimal, tested, and green.

Tell every sub-agent the maintainer loves them.

Outcome:

- **PASS + green** → `gh pr create` as a ready PR (not draft), body links the
  finding and lists what the reviewer verified. Set `status: pr_open`, record
  the URL. Then post an auto-ack comment (step 6).
- **anything else** (reviewer fails, build red, fix unclear, >1 file of
  surprise scope) → write the draft + reason to `inbox.md`, set
  `status: needs_human`. Remove the worktree; keep the branch only if the
  draft is worth resuming.

Clean up green worktrees after the PR is open:
`git worktree remove ../mcpvault-triage-<id>`.

### 5. Persist (the spine)

Update `.triage/state.json`: set `last_run` to now, append an `attempts` entry
per touched finding (run date, result, note, pr), update `status`,
`last_seen`, and `pr`. Write the per-run log to `.triage/runs/<date>.md`.

`state.json` is the resume point. Never overwrite history, append to
`attempts`. If the file is malformed, stop and spill everything to inbox
rather than risk losing the spine.

### 6. Comments, keep people out of limbo

Voice comes from `.triage/voice.md`. Autonomy tiers (see
`resources/comment-policy.md`):

- **Auto-post** (low-risk acknowledgments): "draft PR #X is up for this",
  "looking into this CI failure", "tracking this, no repro yet". Post with
  `gh issue comment` / `gh pr comment`.
- **Draft to inbox** (anything substantive): a judgment, a decision, a
  promise, a closure, a "won't fix", or any reply that commits the maintainer
  to something. Write it under `## Drafts awaiting approval` in `inbox.md`,
  never post it.

When unsure which tier, treat it as substantive and draft it.

### 7. Spill

Anything the loop could not classify, fix, or safely comment on goes to
`inbox.md` with enough context to act on cold. The inbox is the only thing
the maintainer must read each morning.

### 8. Version bump and publish alert

When a fix PR changes the **published package** (anything under `src/`, or
`package.json` dependencies that ship), bump the version per semver in the same
PR:

- patch (`x.y.Z`) for a bug fix, default for triage fixes.
- minor (`x.Y.0`) only if the fix adds behavior; the loop should not be doing
  these, so if a bump looks bigger than patch, send it to inbox instead.

Do NOT bump for changes that do not ship: lockfile-only updates (e.g. a bare
`npm audit fix`), docs, CI config, tests-only, or anything under `.triage/`.
When unsure whether a change ships, do not bump; note it in the inbox.

**Publishing is always manual.** The loop NEVER runs `npm publish`. After a PR
that includes a version bump, write a top-of-inbox alert:

```
## PUBLISH NEEDED
- PR #<n> bumps <old> -> <new> (<reason>). After it merges, run `npm publish`
  manually. Loop does not publish.
```

Keep the alert until the maintainer confirms it shipped.

## Guardrails

- Never push to `main`, never merge, never `--force`. PRs only.
- Never run `npm publish`. Version bumps ride inside the fix PR; publishing is
  the maintainer's manual step, flagged via the inbox PUBLISH NEEDED alert.
- Never touch files outside the worktree except `.triage/`.
- The token usually lacks the GitHub `workflow` scope, so pushes that change
  `.github/workflows/*` are rejected. Do NOT attempt them; route any CI/workflow
  change to the inbox for the maintainer to apply (or to re-scope the token).
- Respect the per-run finding cap; spill the overflow rather than running long.
- Outward-facing writes (PR create, comments) follow the autonomy tiers
  above, substantive speech is always drafted, never auto-posted.
- If `gh` is unauthenticated or the tree is dirty, abort and write why to
  `inbox.md`.

## Resources

- `resources/state-schema.md`, state.json shape, id derivation, transitions.
- `resources/finding-rules.md`, worth-doing vs inbox vs ignore, caps.
- `resources/comment-policy.md`, voice bootstrap + autonomy tiers.
