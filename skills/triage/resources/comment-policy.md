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

### Auto-post: DISABLED

**Maintainer directive (2026-07-23): never post any comment automatically.**
Every comment, including low-risk acknowledgments, is drafted to the inbox for
per-comment approval so the maintainer can edit before it goes live. Do not use
`gh issue comment` / `gh pr comment` / `gh pr review` in a triage run.

Draft acks in the same spirit as before ("Draft PR #X is up for this", "Looking
into this CI failure"): state only what is true right now, no promises about
timing or fixes, in the maintainer's voice, short.

### Stale-thread apology preamble

When the issue/PR has been **open more than 2 weeks with no comment from
`bitbonsai`**, open the drafted comment with a short apology for the delay,
then the ack. Detect it:

```
# created/updated age + whether bitbonsai has commented
gh issue view <n> --json createdAt,comments \
  --jq '{age: .createdAt, mine: [.comments[] | select(.author.login=="bitbonsai")] | length}'
```

If `mine == 0` and age > 14 days, prepend a line like:

> Sorry for the slow reply, day-job has kept me busy.

Adapt the exact wording to `.triage/voice.md` (it stays an apology + ack, never
a promise). One apology per thread; once one is posted, the thread is no longer
silent, so later drafts skip the preamble.

### Draft to inbox (everything)

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
- Never post, period: all comments and reviews go through the inbox (see
  Auto-post: DISABLED above).
