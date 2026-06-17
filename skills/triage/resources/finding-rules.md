# Finding rules

How to classify a gathered signal: **worth-doing**, **inbox**, or **ignore**.
When a signal could fit two buckets, pick the more conservative one (inbox over
worth-doing, ignore over inbox).

## Caps

- **Per-run fix cap: 3.** At most 3 findings go through fan-out per run. Rank by
  priority (below); spill the rest to inbox as `open` so the next run picks them
  up. Log what was deferred — never silently drop.
- **Attempt cap: 2.** A finding the loop has already failed to fix twice stops
  auto-retrying and stays in `needs_human`. The maintainer reopens it manually.
- **Scope cap: 2 files.** If the draft touches more than 2 source files, it is
  too big for the loop — send to inbox regardless of reviewer verdict.

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

1. CI failures on `main` (the repo is red — fix first).
2. CI failures on open PRs.
3. Regressions from recent commits.
4. Open issues with a clear, small, reproducible bug.

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

- **Issue that already has an open PR referencing it** → ignore, bump
  `last_seen`. Never draft a competing fix. Check with
  `gh pr list --state open --search "<issue#> in:body"` (and scan PR titles that
  name the issue) before treating any issue as worth-doing.
- Flaky tests already tracked as a known finding.
- Dependabot PRs (CI handles them; they are not triage findings).
- Issues already labeled `wontfix` / `duplicate` / `question` with no bug.
- Findings in terminal state (`resolved`, `wont_fix`, `pr_open`) — bump
  `last_seen` only.
- Bot/automation noise.

## Repo-specific notes

This is an MCP server for Obsidian vaults. Highest-value, lowest-risk findings:

- A failing `*.test.ts` with a deterministic cause.
- Frontmatter / YAML corruption edge cases (the project's core safety promise).
- Path-filter or path-traversal test failures (security-relevant — fix fast,
  but a *new* security behavior change is inbox, not auto-fix).
- TypeScript build breaks after a dependency bump.

Treat anything about the published npm package, the website, or the MCP
protocol contract as inbox by default — those carry blast radius beyond a test.
