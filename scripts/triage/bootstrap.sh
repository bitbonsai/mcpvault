#!/usr/bin/env bash
# Scaffold the gitignored .triage/ data dir. Idempotent: safe to re-run.
# Seeds state.json, inbox.md, runs/, and a placeholder voice.md. The voice
# profile is distilled by the triage skill on first run (see comment-policy.md).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TRIAGE_DIR="$REPO_ROOT/.triage"

mkdir -p "$TRIAGE_DIR/runs"

if [[ ! -f "$TRIAGE_DIR/state.json" ]]; then
  cat > "$TRIAGE_DIR/state.json" <<'JSON'
{
  "version": 1,
  "last_run": null,
  "findings": {}
}
JSON
  echo "created .triage/state.json"
fi

if [[ ! -f "$TRIAGE_DIR/inbox.md" ]]; then
  cat > "$TRIAGE_DIR/inbox.md" <<'MD'
# Triage inbox

Everything the morning loop could not handle on its own. Read this first.

## Open commitments (you promised, not shipped)

_Threads where you said you'd do something and it hasn't shipped. Each: thread, the quoted promise, how long ago, current state, whether a fix was drafted._

## Needs decision

_Findings parked for a human call. Each: finding id, source, what was tried, why it's here, smallest next action._

## Drafts awaiting approval

_Substantive comments written in your voice, not yet posted. Approve, edit, or discard._
MD
  echo "created .triage/inbox.md"
fi

if [[ ! -f "$TRIAGE_DIR/voice.md" ]]; then
  cat > "$TRIAGE_DIR/voice.md" <<'MD'
# Maintainer voice

> PLACEHOLDER, not yet distilled. The triage skill will populate this from
> past gh comments on first run (see comment-policy.md). Until then, the loop
> drafts all comments and auto-posts none.

## Tone

## Habits

## Phrases
MD
  echo "created .triage/voice.md (placeholder)"
fi

echo "bootstrap complete: $TRIAGE_DIR"
