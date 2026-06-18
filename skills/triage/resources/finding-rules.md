# Finding rules

How to classify a gathered signal: **worth-doing**, **inbox**, or **ignore**.
When a signal could fit two buckets, pick the more conservative one (inbox over
worth-doing, ignore over inbox).

## Caps

- **Per-run fix cap: 3.** At most 3 findings go through fan-out per run. Rank by
  priority (below); spill the rest to inbox as `open` so the next run picks them
  up. Log what was deferred, never silently drop.
- **Attempt cap: 2.** A finding the loop has already failed to fix twice stops
  auto-retrying and stays in `needs_human`. The maintainer reopens it manually.
- **Scope cap: 2 files.** If the draft touches more than 2 source files, it is
  too big for the loop, send to inbox regardless of reviewer verdict.

## Prefer reviewing an existing PR over writing a new fix

Before treating anything as worth-doing, check whether a contributor PR already
addresses it. **A human's open PR almost always beats a freshly written one.**

For each finding, search for a candidate PR:

```
gh pr list --state open --search "<issue#> in:body"      # explicit link
gh pr list --state open --json number,title,headRefName  # scan titles for the topic
```

### Fit-to-ethos gate (before any merge or approval)

A PR being green and mergeable is NOT enough. Before recommending a merge, judge
whether the project actually WANTS the change, against `README.md` and
`AGENTS.md` (scope, promises, values). For mcpvault the ethos is: universal MCP
bridge for Obsidian vaults, **safe** read/write, **preserve YAML frontmatter**,
**enforce security boundaries** (never expose `.git`/`.obsidian`/system dirs),
simplicity.

- A change that fits the promise and values → eligible to merge.
- A clean, working PR that expands scope, adds a feature the project does not
  want, weakens a safety/security guarantee, or adds complexity against the
  "simple" value → do NOT merge; draft a decline-or-redirect comment to inbox
  explaining the ethos mismatch, even though it is technically mergeable.
- State the fit verdict explicitly in the inbox review entry ("fits ethos: X" /
  "scope creep vs README: Y").

If a candidate PR exists:

- **Review it**, do not rewrite it. Send the review sub-agent at the PR branch:
  check it against the project skills and tests, run `npm test && npm run build`.
- Apply the fit-to-ethos gate above before any approve/merge recommendation.
- PASS, draft an **approval** recommendation to inbox (approving is a maintainer
  decision, so it is substantive, inbox, never auto-approved).
- Needs work, draft a **request-changes** recommendation to inbox, specific and
  in the maintainer's voice.
- Either way, optionally auto-post a short ack ("reviewing your PR, thanks for
  this") so the contributor is not left waiting.
- Only fall through to writing a new fix if there is **no** candidate PR, or the
  existing PR is abandoned (stale, author unresponsive, explicitly superseded).

Open PRs with no movement are themselves findings: an unreviewed contributor PR
is limbo. Surface every open PR the maintainer has not reviewed.

## Worth-doing (fan-out a fix)

A signal is worth-doing only if ALL hold:

- The fix is **bounded and mechanical-ish**: a failing test with an obvious
  cause, a regression a recent commit introduced, a small correctness bug, a
  typo, a clear off-by-one, a missing guard already implied by neighboring code.
- The **expected change fits the scope cap** (≤2 files) and adds/updates a test.
- There is a **clear pass/fail signal** (a test that should go green, a build
  that should compile).
- It is **not** a feature, an API change, a dependency major-bump, or anything
  that needs a product/design decision.

Priority order when over the per-run cap:

1. CI failures on `main` (the repo is red, fix first).
2. CI failures on open PRs.
3. Regressions from recent commits.
4. Open issues with a clear, small, reproducible bug.

## Promised but undone (nudge → inbox)

A commitment the maintainer made in a comment ("I'll fix this", "will add",
"shipping next release", "on it") on a thread that is **still open with no merged
PR resolving it**. The point is to nudge the maintainer about their own
unkept promise.

- id signature: `promise:<issue#>` (one nudge per thread, deduped across runs).
- Always lands in inbox under `## Open commitments (you promised, not shipped)`,
  with: the thread, the quoted promise, how long ago it was made, current state.
- If the promised fix also meets the worth-doing bar (small, ≤2 files, testable)
  and has no open PR, the loop MAY draft it too, then the nudge reads "drafted
  PR #X toward this" instead of just "still open". The nudge is posted to inbox
  regardless; it is never auto-posted as a public comment.
- Do not re-nudge a promise already listed as `needs_human` from a prior run
  unless its state changed (e.g. a PR opened or the maintainer commented again).

## Inbox (needs_human)

Send to inbox, do not attempt a fix, when ANY holds:

- The cause is unclear or not reproducible from the signal alone.
- The fix needs a judgment call: behavior change, API surface, naming, a
  trade-off, a security decision, a public-contract change.
- It is a feature request or enhancement, not a bug.
- It would exceed the scope cap, or the draft did and the reviewer flagged it.
- The reviewer failed the draft twice (attempt cap hit).
- A dependency update needs human review (major bump, audit finding with no
  clean patch).
- Anything touching publishing, versioning, or `package.json` bin/exports.

Each inbox entry records: the finding id, source, what was tried (if anything),
the reason it landed here, and the smallest next action.

## Ignore (log only)

Do not act, do not inbox, just note in the run log:

- **Issue that already has an open PR** is NOT ignored, it is routed to "Prefer
  reviewing an existing PR" above: review the contributor's PR, never draft a
  competing fix.
- Flaky tests already tracked as a known finding.
- Dependabot PRs (CI handles them; they are not triage findings).
- Issues already labeled `wontfix` / `duplicate` / `question` with no bug.
- Findings in terminal state (`resolved`, `wont_fix`, `pr_open`), bump
  `last_seen` only.
- Bot/automation noise.

## Repo-specific notes

This is an MCP server for Obsidian vaults. Highest-value, lowest-risk findings:

- A failing `*.test.ts` with a deterministic cause.
- Frontmatter / YAML corruption edge cases (the project's core safety promise).
- Path-filter or path-traversal test failures (security-relevant, fix fast,
  but a *new* security behavior change is inbox, not auto-fix).
- TypeScript build breaks after a dependency bump.

Treat anything about the published npm package, the website, or the MCP
protocol contract as inbox by default, those carry blast radius beyond a test.
