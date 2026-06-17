Run the daily repository triage.

Activate the `triage` skill and follow its loop exactly:

1. Gather yesterday's signals (CI failures, open issues, recent commits) via gh.
2. Load `.triage/state.json` and dedupe against known findings by id.
3. Classify each signal with the finding rules (worth-doing / inbox / ignore).
4. For each worth-doing finding (up to the per-run cap), open an isolated
   worktree, send a draft sub-agent then a review sub-agent, and open a ready PR
   only on a passing review with green `npm test && npm run build`.
5. Persist the state file and write the per-run log.
6. Keep contributors out of limbo: auto-post low-risk acknowledgments, draft all
   substantive comments to the inbox.
7. Spill anything unhandled to `.triage/inbox.md`.

Constraints: never push to main, never merge, never force. PRs only. Mutate
nothing outside worktrees except `.triage/`. If gh is unauthenticated or the
tree is dirty, abort and write why to the inbox.

When you finish, print a one-screen summary: signals gathered, findings new vs
known, PRs opened, comments posted, items sent to inbox.
