# State schema

`.triage/state.json` is the spine. It is the single source of truth for what
the loop has seen, tried, and resolved. It is gitignored, it lives only on
the machine that runs the loop.

## Shape

```json
{
  "version": 1,
  "last_run": "2026-06-17T07:00:00Z",
  "findings": {
    "<id>": {
      "source": "ci | issue | commit",
      "signature": "stable identity string (see below)",
      "title": "human-readable summary",
      "status": "open | in_progress | pr_open | needs_human | resolved | wont_fix",
      "first_seen": "ISO-8601",
      "last_seen": "ISO-8601",
      "pr": "#123 or null",
      "attempts": [
        {
          "run": "2026-06-17",
          "result": "pr_open | needs_human | retry | resolved | error",
          "note": "what happened, why",
          "pr": "#123 or null"
        }
      ]
    }
  }
}
```

## id derivation

`id` is a readable, stable composite so the same problem maps to the same
finding every run and the state file stays human-debuggable:

```
id = "<source>:<signature>"   (lowercased, spaces -> '-')
```

The `signature` is what makes it stable across days, pick the most invariant
identity for each source:

- **issue** / **pr**, the number: `issue:107`, `pr:132`. Never changes.
- **ci**, the failing test name (NOT the run id or sha):
  `ci:filesystem.test.ts-rejects-path-traversal`.
- **commit**, only tracked when a commit introduces a regression; signature is
  the regression it caused, not the sha, so a later revert collapses to the
  same finding.
- **promise**, the thread the unkept commitment lives on: `promise:49`.

Same signature → same id → dedupe works. Different run, same broken test, same
finding. That is how tomorrow resumes today.

## Status transitions

```
              new worth-doing
        ────────────────────────► open
                                    │  fan-out
                                    ▼
                              in_progress
                 ┌──────────────────┼──────────────────┐
          PASS+green            reviewer fail        unclear
                 │                  │                    │
                 ▼                  ▼                    ▼
             pr_open           needs_human          needs_human
                 │
        PR merged (next run detects closed PR)
                 ▼
             resolved

  maintainer decision, any state ───► wont_fix  (terminal, never reopened)
```

Terminal states (`resolved`, `wont_fix`, `pr_open`) are skipped on later runs;
only `last_seen` is bumped. `open` and `needs_human` are eligible for retry
until the attempt cap in `finding-rules.md`.

## Detecting resolution

On gather, before triaging, reconcile:

- A finding in `pr_open` whose PR is now merged → `resolved`.
- A finding in `pr_open` whose PR was closed unmerged → back to `needs_human`
  with a note (the maintainer rejected the fix).
- A `ci` finding whose test is now green and absent from yesterday's failures →
  `resolved` with note "passed on its own".

## Invariants

- Never delete a finding. History is the point.
- Never rewrite an `attempts` entry. Append only.
- `last_run` advances only after a successful persist. If the run aborts, the
  next run re-reads the same window, safe because triage is idempotent on `id`.
- If `state.json` fails to parse, do NOT recreate it. Stop, copy it to
  `state.json.corrupt-<date>`, and spill the whole run to inbox. Losing the
  spine is the one unrecoverable failure.
