# Triage automation

A self-resuming morning loop that triages CI failures, open issues, and recent
commits, drafts fixes in isolated worktrees, opens PRs on green, and keeps
contributors out of limbo with comments in the maintainer's voice.

The **machinery** (this dir + `skills/triage/`) is committed. The **data**
(`.triage/`: state, inbox, runs, voice) is gitignored and lives only on the
machine that runs the loop.

## Parts

```
skills/triage/SKILL.md            the loop the agent follows
skills/triage/resources/          state schema, finding rules, comment policy
scripts/triage/run.sh             host-agnostic entry point
scripts/triage/bootstrap.sh       scaffolds .triage/ (idempotent)
scripts/triage/prompt.md          the morning prompt
.triage/state.json                the spine: what was tried/passed/open
.triage/inbox.md                  human queue + comment drafts
.triage/runs/<date>.md            per-run audit log
.triage/voice.md                  distilled maintainer voice
```

## First run

```bash
gh auth status                  # must be authenticated
scripts/triage/bootstrap.sh     # scaffold .triage/ (run.sh also does this)
DRY_RUN=1 scripts/triage/run.sh # preflight + show the prompt, no agent
scripts/triage/run.sh           # the real thing
```

## Schedule it (local host)

State is local-only, so the loop runs on your machine. launchd example
(`~/Library/LaunchAgents/org.mcpvault.triage.plist`), 07:00 daily:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>org.mcpvault.triage</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/mwolff/bit/mcpvault/scripts/triage/run.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/mcpvault-triage.out</string>
  <key>StandardErrorPath</key><string>/tmp/mcpvault-triage.err</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/org.mcpvault.triage.plist
```

Or use Claude Code's `CronCreate` to schedule the same `run.sh`.

## Moving to a CI host later

GitHub Actions runners are ephemeral, so the spine (`.triage/state.json`) must
persist between runs. To move the loop to Actions:

1. Persist `.triage/` between runs, commit a redacted state to a dedicated
   branch, or store it as a workflow artifact / private gist.
2. Add the `ANTHROPIC_API_KEY` and a `gh` token as repo secrets.
3. Add a scheduled workflow that checks out, restores `.triage/`, runs
   `scripts/triage/run.sh`, and saves `.triage/` back.

Until then the loop is local-only by design, it keeps your triage notes and
voice profile off the public repo.

## Safety

- PRs only. Never pushes to main, never merges, never force-pushes.
- Touches nothing outside worktrees except `.triage/`.
- Auto-posts only low-risk acknowledgments; every substantive comment is
  drafted to the inbox for approval. See `skills/triage/resources/comment-policy.md`.
- Caps: 3 fixes/run, 2 attempts/finding, 2 files/fix. Overflow spills to inbox.
