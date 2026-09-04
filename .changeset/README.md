# Changesets

Every pull request that changes behaviour carries a **changeset**: a short file
saying which packages changed, how much, and — in prose a person will read
later — what changed and why it mattered.

```bash
pnpm changeset          # write one, interactively
pnpm changeset:version   # roll them into versions and CHANGELOG.md files
```

## Why this repository has them, given nothing is published

Every package here is `private: true` at `0.0.0`, and `pnpm publish` is never
run. `privatePackages.version` is on and `tag` is off, so `changeset version`
writes versions and `CHANGELOG.md` files and does nothing else. Nothing is
released, nothing is tagged.

The point is the record, not the release. This project's whole claim is that a
figure can be traced to the document it came from, and the same standard should
apply to the code that reads those documents: when a published figure changes
because a parser changed, someone has to be able to find out which change did
it and why. Conventional commits already say _what_ each commit did; an ADR says
why a decision was taken. Neither answers "what changed in the thing that reads
government PDFs, between one state of this repository and the next" — which is
the question asked when a number looks wrong.

## What deserves a changeset

- Anything that changes what the pipeline **extracts, stores, or publishes** —
  parser patterns, normalisation, the review gate, the schema. These change
  figures, and they always need one.
- Anything that changes a **command or contract** other people use.

Not: documentation, tests, formatting, or an internal refactor that provably
changes no output. An ADR is the right record for a decision; a changeset is
the right record for a behaviour change. Most substantial PRs want both.

## Writing the summary

Say what changed and what it means for the data, not what the diff did.

> **Good** — "`Rs` now requires a word boundary. It was matching the end of
> English plurals, so `Parameters 2020-21` was read as ₹2020; 79 such
> candidates existed, none verified."
>
> **Useless** — "fix regex in facts.ts".
