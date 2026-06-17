#!/usr/bin/env bash
# Host-agnostic entry point for the morning triage run.
# Run it from launchd/cron locally, or from a CI runner if you later commit
# state. It just preflights and hands the prompt to a headless Claude Code run.
#
#   scripts/triage/run.sh            # real run
#   DRY_RUN=1 scripts/triage/run.sh  # preflight + print prompt, no agent
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PROMPT_FILE="$REPO_ROOT/scripts/triage/prompt.md"

# --- preflight -------------------------------------------------------------

fail() { echo "triage: $*" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || fail "gh not found on PATH"
gh auth status >/dev/null 2>&1 || fail "gh not authenticated (run: gh auth login)"

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "triage: warning, working tree is dirty (ok for dry run; a real run aborts here)" >&2
  else
    fail "working tree is dirty; triage needs a clean main checkout"
  fi
fi

# scaffold the gitignored data dir if first run
[[ -d "$REPO_ROOT/.triage" ]] || bash "$REPO_ROOT/scripts/triage/bootstrap.sh"

# --- dispatch --------------------------------------------------------------

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "triage: preflight OK. Prompt:"
  echo "----"
  cat "$PROMPT_FILE"
  echo "----"
  echo "triage: DRY_RUN set, not invoking the agent."
  exit 0
fi

command -v claude >/dev/null 2>&1 || fail "claude CLI not found on PATH"

# Headless run. The triage skill is allowlisted along with the tools the loop
# needs. Adjust the model/permission flags to taste.
claude -p "$(cat "$PROMPT_FILE")" \
  --permission-mode acceptEdits \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Agent,Skill" \
  2>&1 | tee "$REPO_ROOT/.triage/runs/last-run.log"
