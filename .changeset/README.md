# Changesets

Entries follow the writing style of [Common Changelog](https://common-changelog.org). Add one with
`pnpm changeset` for every change a user would notice.

## The convention in short

Common Changelog is a stricter take on [Keep a Changelog](https://keepachangelog.com). A changelog
is written for people, not generated from commit messages. Each change is one short, imperative
line that makes sense without opening the pull request, and changes that break existing behaviour
are labelled as breaking. The full convention also groups changes into Changed, Added, Removed
and Fixed and links each one to a reference. We only follow its writing style: Changesets groups
entries by bump level and generates the references itself.

## Writing an entry

```md
---
"nautilus-wallet": minor
---

Add multi-recipient transactions.
```

- Start with an imperative verb: "Add", "Remove", "Fix", "Use", "Show", "Upgrade".
- Write for users, not developers, and make the entry make sense on its own.
- Keep it to one sentence. Add a second one only when the impact isn't obvious from the first,
  such as a migration, a security behaviour or a side effect.
- Pick the bump by SemVer: `patch` for fixes and small tweaks, `minor` for new features or
  behaviour changes, `major` for breaking changes.
- Name the file after the change (`multi-recipient-send.md`), not the generated random name.

_Drafted by an AI agent (Claude Code); not yet reviewed by a human._
