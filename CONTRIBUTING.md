# Contributing to LokDarpan

Thank you for considering it. This project's usefulness depends entirely on its credibility, and its credibility depends on never overstating what the data shows — so a few of the rules below are stricter than you may be used to.

**Read [`.docs/17-legal/legal-ethical-rules.md`](./.docs/17-legal/legal-ethical-rules.md) before your first contribution.** It is binding on every document and every line of code. Where anything conflicts with it, it wins and the feature is withheld.

---

## The one thing to understand first

LokDarpan presents **facts, calculations, and neutral comparisons** derived from official government records. It is a transparency and mathematical-consistency tool.

It is **not** an anti-corruption platform, an accusation engine, or a legal authority.

A variance is a number. The platform never claims it was caused by theft, fraud, diversion, or misconduct. A contribution that implies otherwise — in code, copy, a chart colour, or a commit message — will not be merged, however well-intentioned.

---

## Branching — never push to `main`

```text
feature/*  ──PR──>  development  ──release PR──>  main
```

**Both branches are protected**: no direct pushes, and all six CI checks must pass before a merge is possible. A branch must be current with its base, and review conversations must be resolved. `development` additionally requires linear history; `main` takes merge commits so a release PR keeps its constituent commits.

`development` was retired by [`adr/023`](./.docs/adr/023-features-target-main.md) and **reinstated by [`adr/032`](./.docs/adr/032-development-is-reinstated.md)** — branch from it, and target it.

`023`'s reasoning has not been refuted and is worth reading before you skip the branch: it was retired because _nothing integrated through it_, seven consecutive PRs went straight to `main`, and nothing fails when a branch is simply not used. Reinstating it does not by itself reinstate the practice. **A PR that targets `main` and is not a release PR is the failure mode**, not a shortcut.

`development` is an **integration and release gate, not a soak.** Vercel already builds a preview deployment for every pull request, so each change is soaked on its own real deployment before it merges.

There is **no required approving review** while the project has a single maintainer — a solo maintainer cannot approve their own PR, and the requirement could only ever be met by bypassing every protection at once ([`adr/016`](./.docs/adr/016-review-requirement.md)). It returns to one the moment a second maintainer can approve. Everything else about the pull request is unchanged: it is still where CI runs and where the reasoning is recorded.

```bash
git checkout development && git pull
git checkout -b feature/short-description
# … work, commit …
git push -u origin feature/short-description
gh pr create --base development
```

### Releasing

Promotion to `main` is a **release PR** from `development`, merged as a merge commit so the constituent commits survive. `main` is what Vercel deploys, so **`main` must always be releasable**.

A fix that cannot wait for a release branches from `main` as `hotfix/*` and **must be merged back into `development`**, or the next release silently reintroduces the bug. This step is easy to forget and nothing enforces it.

There is deliberately **no workflow** that opens pull requests on your behalf. GitHub gates "Actions may create pull requests" behind the same setting as "Actions may approve pull requests"; enabling it would let a workflow approve its own PR and bypass the review requirement. Least privilege wins over the convenience.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/); `commitlint` enforces this on `commit-msg`. Scopes: `web`, `api`, `money`, `neutrality`, `contracts`, `ingestion`, `docs`, `ci`, `deps`, `repo`.

Rationale: [`.docs/adr/013-branching-and-release.md`](./.docs/adr/013-branching-and-release.md) → amended by [`.docs/adr/023`](./.docs/adr/023-features-target-main.md) → reversed by [`.docs/adr/032`](./.docs/adr/032-development-is-reinstated.md). Read them in that order; `023` is the strongest argument against the flow now in force.

## Getting set up

Requires **Node ≥20** and **pnpm 9**.

Husky runs the gates for you: **pre-commit** formats and lints staged files, **commit-msg** validates the message, **pre-push** runs typecheck, tests and the neutrality gate. Anything slower than a few seconds belongs in CI, not in your push.

```bash
git clone https://github.com/MNikks01/LokDarpan.git
cd LokDarpan
pnpm install

pnpm test          # 56 unit + integration tests
pnpm test:e2e      # 7 Playwright journeys (builds the app first)
pnpm dev           # web client  → http://localhost:3000
pnpm dev:api       # API         → http://localhost:4000
pnpm lint          # eslint, strict type-aware rules
pnpm format        # prettier
pnpm typecheck
pnpm neutrality    # docs/15 language gate
```

The backend does not exist yet. The app runs on fixtures from `packages/contracts/src/fixtures/`, all labelled as such. **No real government data is ingested.**

---

## The highest-value contribution: a source connector

The platform is designed to grow by **source coverage**, not feature count. [`.docs/15-scalability/scalability-plan.md`](./.docs/15-scalability/scalability-plan.md) makes this explicit: declarative connectors let contributors add sources by PR without touching core. There are 36 State/UT procurement portals alone, roughly 28 of them sharing one platform.

Before writing a connector:

1. **Check the registry.** [`.docs/06-government-sources/`](./.docs/06-government-sources/) has 99 catalogued sources, 96 verified, plus a 6,466-row directory catalogue. Your source may already be listed with its status.
2. **Confirm it is an official government source.** Central, State, UT, department, agency, PSU, statutory or autonomous body, or local government. News sites, private tender aggregators (TenderTiger, TenderDetail, IndiaMART), blogs, social media and commercial databases are **never** sources of fact. They may be named as discovery aids, never as authorities.
3. **Read [`.docs/04-data-engineering/ingestion-methods.md`](./.docs/04-data-engineering/ingestion-methods.md)** — most State/UT portals are GePNIC deployments sharing one page structure, so one parameterised connector serves many states.

### Rules for collection — not negotiable

- **Honour `robots.txt`, terms of use, and rate limits.** Check them _before_ writing the connector, and record what you found.
- **Never bypass a CAPTCHA or any access control.** Where one gates access, use an official download or API route, or do not ingest the source.
- **Only public, non-authenticated pages.** No credentialed access, ever.
- **Be polite:** throttle per domain, schedule off-peak, use an identifiable user agent. Collection is scheduled and cached — never triggered by a user request.
- **Capture the licence.** Each source's licence and issuing authority must be displayed with its data.

### How to record a source

Every source carries a verification status:

| Status             | Meaning                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `DISCOVERED`       | Found in an official directory or search. Nothing known about its data                                            |
| `VERIFIED`         | Fetched — HTTP status, final URL and page title recorded. Confirms it **responds**, not what it contains          |
| `PRODUCTION_READY` | Data exposure, retrieval, identifiers, cadence, history, extraction method, legality and entity mapping all known |

**The rule this registry is built on:**

> Never record _"the government does not publish X"_ because you could not find X.
> Record _"X was not identified in the sources reviewed as of \[date\]."_

This is not pedantry. During discovery, a set of `.gov.in` hosts were unreachable from one network and reachable from another — including the Local Government Directory. Recording them as unavailable would have been false. **Verify from at least two network paths before concluding anything, and never state a negative about a government body you have not established.**

Fields you cannot evidence are `null` or `"unknown"` — never guessed.

---

## Invariants that will get a PR rejected

Each of these is enforced by a test or the type system, so you will usually find out before review. They exist for reasons documented in [`.docs/00-overview/document-audit.md`](./.docs/00-overview/document-audit.md).

**Money is `bigint` paise, never a float or a JSON number.** A national multi-year aggregate exceeds `Number.MAX_SAFE_INTEGER` and fails _silently_ — producing a wrong government figure carrying a correct-looking source link. Use `@lokdarpan/money`. There is deliberately no `fromNumber()`.

**A figure cannot be rendered without its provenance.** `<Figure>` requires a `provenance` prop. This is a compile error, not a review note.

**Neutral copy cannot be authored in a component.** Observation text is typed `ServerText` and can only originate from the API boundary, where it is generated from vetted templates. A string literal will not type-check.

**Two variances, always, each with its denominator stated.** Release variance (R−U) and allocation variance (A−U) are different quantities. A field named `variance` must not exist. Never render a bare percentage.

**Missing is never zero.** A null financial value renders a missing-data state naming the expected source and when it was last checked. No variance is computed across a missing stage.

**No red** in any variance, severity, verification-priority or status style. Red asserts wrongdoing before a word is read. It is reserved for destructive user actions, and a palette test enforces this.

**No score, rank, badge or flag on a contractor.** Concentration statistics attach to a _scope_ — a taluka, a financial year — never to a firm.

---

## Language

The neutrality gate scans every locale file and source string:

```bash
pnpm neutrality apps packages
```

Forbidden: corrupt, scam, stolen, fraud, embezzle, guilty, illegal, bribe, siphon, divert, loot, suspicious — and their Marathi and Hindi equivalents — plus causal constructions like _"because the contractor…"_ or _"due to misuse"_.

Use instead: _deviation_, _inconsistency_, _unexplained variance_, _records are missing_, _verification priority_, _requires verification_.

**If you speak Marathi or Hindi, the vocabulary lists in `packages/neutrality/src/vocabulary.ts` need native-speaker review.** They are a starting set, and a forbidden word we failed to list is a forbidden word that ships. This is one of the most valuable contributions available right now.

---

## Documentation

`.docs/` is the source of truth. **A PR that changes an architectural decision updates the relevant document or adds an ADR in the same PR.** A decision that lives only in a commit message will be silently reversed within two quarters.

ADRs append; they are never rewritten. A superseded ADR gets a status header and stays.

---

## Changesets — the record of what changed

**A PR that changes what the pipeline extracts, stores or publishes carries a changeset.**

```bash
pnpm changeset          # write one
pnpm changeset:status    # what is pending
```

Nothing here is published — every package is `private: true` at `0.0.0` — so
`changeset version` writes versions and `CHANGELOG.md` files and stops there. The
point is the record, not a release.

It exists because of what this project claims. We say a figure can be traced to
the document it came from; the code that reads those documents deserves the same
standard. When a published figure changes because a parser changed, someone has
to be able to find out which change did it and why. A conventional commit says
what one commit did and an ADR says why a decision was taken — neither answers
"what changed in the thing that reads government PDFs, between one state of this
repository and the next", which is the question asked when a number looks wrong.

Skip it for documentation, tests, formatting, or a refactor that provably changes
no output. Most substantial PRs want **both** a changeset and an ADR: the ADR for
the decision, the changeset for the behaviour.

Write the summary for the person reading it in a year, not for the diff:

> **Good** — "`Rs` now requires a word boundary. It was matching the end of
> English plurals, so `Parameters 2020-21` was read as ₹2020; 79 such candidates
> existed, none verified."
>
> **Useless** — "fix regex in facts.ts".

See [`.changeset/README.md`](./.changeset/README.md).

---

## Pull requests

Use the checklist in [`.github/pull_request_template.md`](./.github/pull_request_template.md). Before opening:

```bash
pnpm -r typecheck && pnpm test && pnpm neutrality apps packages
pnpm changeset:status   # a behaviour change needs a changeset
```

Keep PRs focused. A connector, a bug fix, or one feature — not three.

**Commit messages** explain _why_, not just _what_, and name the document the change implements.

---

## Reporting a data error

You do not need to be a developer. If a figure looks wrong, open an issue with the entity, the figure, and what you believe is correct.

Corrections are made by **re-ingesting from source**, never by editing a value — that is what preserves traceability. Every correction is versioned and logged.

Because the platform makes no allegations about anyone, there is nothing to retract _about a person_ — only data to correct. That is by design.

---

## Security

Do not open a public issue for a security problem. See [`SECURITY.md`](./SECURITY.md) — and note especially that **security testing must never be directed at government portals.**

---

## Conduct

Be straightforward and civil. This project touches public money and political subject matter; keep discussion on the data and the code. Partisan advocacy of any kind is out of scope — the platform's neutrality is its entire value, and that applies to how we talk about it as much as to what it publishes.

## Licence

This project is licensed under the **Apache License 2.0** ([`LICENSE`](./LICENSE), [`adr/015`](./.docs/adr/015-code-licence.md)). By submitting a pull request you agree that your contribution is licensed under the same terms, including the patent grant in §3. There is no separate CLA to sign.

The licence covers the code. It grants no rights over the government records the platform ingests — see [`NOTICE`](./NOTICE).
