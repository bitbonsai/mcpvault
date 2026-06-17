# Comment policy

The loop comments on issues and PRs so contributors are never left in limbo,
written in the maintainer's voice. Speech that commits the maintainer to
anything is always drafted, never auto-posted.

## Voice

Voice lives in `.triage/voice.md` (gitignored). `bootstrap.sh` seeds it from the
maintainer's past `gh` comments:

```
gh api "/search/issues?q=commenter:@me+repo:bitbonsai/mcpvault" --jq '.items[].number'
# then per issue/PR:
gh issue view <n> --comments --json comments --jq '.comments[] | select(.author.login=="<me>") | .body'
```

Distill, into `voice.md`:

- Sentence length and rhythm (terse vs. expansive).
- Greeting / sign-off habits (or lack of).
- Emoji, markdown, code-fence usage.
- How they say "thanks", "I'll look", "won't fix", "good catch".
- Tone toward contributors (warm, blunt, formal).

If there are too few past comments to distill a voice, write a minimal neutral
profile and note in `voice.md` that it needs the maintainer's review. Do not
invent a personality.

Refresh `voice.md` opportunistically, when the maintainer posts new comments,
later runs can re-distill.

## Autonomy tiers

### Auto-post (low-risk acknowledgments only)

Post directly with `gh issue comment <n> -b "..."` / `gh pr comment <n> -b "..."`.
Allowed only for comments that state a fact about the loop's own actions and
commit the maintainer to nothing:

- "Draft PR #X is up for this, review when you can."
- "Looking into this CI failure."
- "Tracking this; no repro yet."
- "This is being picked up by the morning triage."

Rules for auto-posted comments:

- State only what is true right now (a PR that exists, a state that is recorded).
- No promises about timing, no commitments about whether/how it'll be fixed.
- One ack per finding per run, do not re-comment the same ack across runs
  (check `attempts` before posting).
- In the maintainer's voice, but short.

### Stale-thread apology preamble

When the issue/PR has been **open more than 2 weeks with no comment from
`bitbonsai`**, open the auto-posted comment with a short apology for the delay,
then the ack. Detect it:

```
# created/updated age + whether bitbonsai has commented
gh issue view <n> --json createdAt,comments \
  --jq '{age: .createdAt, mine: [.comments[] | select(.author.login=="bitbonsai")] | length}'
```

If `mine == 0` and age > 14 days, prepend a line like:

> Sorry for the slow reply, day-job has kept me busy.

Adapt the exact wording to `.triage/voice.md` (it stays an apology + ack, never
a promise). One apology per thread, once posted, the thread is no longer
silent, so later runs skip the preamble. If `voice.md` is still the placeholder,
this comment is drafted to inbox like everything else, not auto-posted.

### Draft to inbox (everything substantive)

Write under `## Drafts awaiting approval` in `inbox.md`. Never post. This covers
any comment that:

- makes a judgment ("this is expected behavior", "that's a bug in your config"),
- decides something ("closing as won't-fix", "this is a dupe of #N"),
- promises something ("I'll ship this next release"),
- closes, labels, or commits the maintainer to a position,
- answers a question with anything beyond "we're looking at it".

Each draft records: target (`#123`, issue or PR), the proposed comment text in
the maintainer's voice, and any action it implies (close, label, link). The
maintainer approves, edits, or discards.

### When unsure

If a comment could be read as committing the maintainer to anything, it is
substantive → draft it. The cost of an unnecessary draft is one line the
maintainer skims. The cost of an unwanted auto-post is a public statement they
did not make.

## Hard limits

- Never close, reopen, label, assign, or merge automatically. Those are inbox
  drafts at most.
- Never post on behalf of the maintainer outside this repo.
- Never auto-post twice for the same finding+run.
- If `voice.md` is missing, skip auto-posting and draft everything until it
  exists.
