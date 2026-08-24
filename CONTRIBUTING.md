# Contributing to LokDarpan

Thank you for considering it. This project's usefulness depends entirely on its credibility, and its credibility depends on never overstating what the data shows — so a few of the rules below are stricter than you may be used to.

**Read [`.docs/17-legal/legal-ethical-rules.md`](./.docs/17-legal/legal-ethical-rules.md) before your first contribution.** It is binding on every document and every line of code. Where anything conflicts with it, it wins and the feature is withheld.

---

## The one thing to understand first

LokDarpan presents **facts, calculations, and neutral comparisons** derived from official government records. It is a transparency and mathematical-consistency tool.

It is **not** an anti-corruption platform, an accusation engine, or a legal authority.

A variance is a number. The platform never claims it was caused by theft, fraud, diversion, or misconduct. A contribution that implies otherwise — in code, copy, a chart colour, or a commit message — will not be merged, however well-intentioned.

---

## Getting set up

Requires **Node ≥20** and **pnpm 9**.

```bash
git clone https://github.com/MNikks01/LokDarpan.git
cd LokDarpan
pnpm install

pnpm test                        # 38 tests: money, neutrality, contracts, palette
pnpm dev                         # web client at http://localhost:3000
pnpm neutrality apps packages    # language gate — a hit blocks release
pnpm -r typecheck
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

- **Honour `robots.txt`, terms of use, and rate limits.** Check them *before* writing the connector, and record what you found.
- **Never bypass a CAPTCHA or any access control.** Where one gates access, use an official download or API route, or do not ingest the source.
- **Only public, non-authenticated pages.** No credentialed access, ever.
- **Be polite:** throttle per domain, schedule off-peak, use an identifiable user agent. Collection is scheduled and cached — never triggered by a user request.
- **Capture the licence.** Each source's licence and issuing authority must be displayed with its data.

### How to record a source

Every source carries a verification status:

| Status | Meaning |
|---|---|
| `DISCOVERED` | Found in an official directory or search. Nothing known about its data |
| `VERIFIED` | Fetched — HTTP status, final URL and page title recorded. Confirms it **responds**, not what it contains |
| `PRODUCTION_READY` | Data exposure, retrieval, identifiers, cadence, history, extraction method, legality and entity mapping all known |

**The rule this registry is built on:**

> Never record *"the government does not publish X"* because you could not find X.
> Record *"X was not identified in the sources reviewed as of \[date\]."*

This is not pedantry. During discovery, a set of `.gov.in` hosts were unreachable from one network and reachable from another — including the Local Government Directory. Recording them as unavailable would have been false. **Verify from at least two network paths before concluding anything, and never state a negative about a government body you have not established.**

Fields you cannot evidence are `null` or `"unknown"` — never guessed.

---

## Invariants that will get a PR rejected

Each of these is enforced by a test or the type system, so you will usually find out before review. They exist for reasons documented in [`.docs/00-overview/document-audit.md`](./.docs/00-overview/document-audit.md).

**Money is `bigint` paise, never a float or a JSON number.** A national multi-year aggregate exceeds `Number.MAX_SAFE_INTEGER` and fails *silently* — producing a wrong government figure carrying a correct-looking source link. Use `@lokdarpan/money`. There is deliberately no `fromNumber()`.

**A figure cannot be rendered without its provenance.** `<Figure>` requires a `provenance` prop. This is a compile error, not a review note.

**Neutral copy cannot be authored in a component.** Observation text is typed `ServerText` and can only originate from the API boundary, where it is generated from vetted templates. A string literal will not type-check.

**Two variances, always, each with its denominator stated.** Release variance (R−U) and allocation variance (A−U) are different quantities. A field named `variance` must not exist. Never render a bare percentage.

**Missing is never zero.** A null financial value renders a missing-data state naming the expected source and when it was last checked. No variance is computed across a missing stage.

**No red** in any variance, severity, verification-priority or status style. Red asserts wrongdoing before a word is read. It is reserved for destructive user actions, and a palette test enforces this.

**No score, rank, badge or flag on a contractor.** Concentration statistics attach to a *scope* — a taluka, a financial year — never to a firm.

---

## Language

The neutrality gate scans every locale file and source string:

```bash
pnpm neutrality apps packages
```

Forbidden: corrupt, scam, stolen, fraud, embezzle, guilty, illegal, bribe, siphon, divert, loot, suspicious — and their Marathi and Hindi equivalents — plus causal constructions like *"because the contractor…"* or *"due to misuse"*.

Use instead: *deviation*, *inconsistency*, *unexplained variance*, *records are missing*, *verification priority*, *requires verification*.

**If you speak Marathi or Hindi, the vocabulary lists in `packages/neutrality/src/vocabulary.ts` need native-speaker review.** They are a starting set, and a forbidden word we failed to list is a forbidden word that ships. This is one of the most valuable contributions available right now.

---

## Documentation

`.docs/` is the source of truth. **A PR that changes an architectural decision updates the relevant document or adds an ADR in the same PR.** A decision that lives only in a commit message will be silently reversed within two quarters.

ADRs append; they are never rewritten. A superseded ADR gets a status header and stays.

---

## Pull requests

Use the checklist in [`.github/pull_request_template.md`](./.github/pull_request_template.md). Before opening:

```bash
pnpm -r typecheck && pnpm test && pnpm neutrality apps packages
```

Keep PRs focused. A connector, a bug fix, or one feature — not three.

**Commit messages** explain *why*, not just *what*, and name the document the change implements.

---

## Reporting a data error

You do not need to be a developer. If a figure looks wrong, open an issue with the entity, the figure, and what you believe is correct.

Corrections are made by **re-ingesting from source**, never by editing a value — that is what preserves traceability. Every correction is versioned and logged.

Because the platform makes no allegations about anyone, there is nothing to retract *about a person* — only data to correct. That is by design.

---

## Security

Do not open a public issue for a security problem. See [`SECURITY.md`](./SECURITY.md) — and note especially that **security testing must never be directed at government portals.**

---

## Conduct

Be straightforward and civil. This project touches public money and political subject matter; keep discussion on the data and the code. Partisan advocacy of any kind is out of scope — the platform's neutrality is its entire value, and that applies to how we talk about it as much as to what it publishes.
