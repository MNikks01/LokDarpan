# ADR-059 · Import direction is checked, not described

**Status:** Accepted · **Date:** 2026-09-23 · **Implements** the import-direction item of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md)

## Context

The architecture's layering was prose:

- rendering code does not reach the database;
- source adapters do not reach the UI;
- the domain reaches nothing.

The review found nothing enforcing any of it. Nothing stops an edge in the wrong direction, and an edge
nobody notices becomes a dependency everybody relies on. God's Eye View checks its own directions
with a script over every tracked file and tests the script with fixtures that must fail. The adoption
plan takes that approach.

## Decision

**A checker in `@lokdarpan/architecture`**, run as `pnpm architecture` and as CI gate G2.

- It reads every tracked file's imports with the TypeScript parser: static, dynamic, `export … from`,
  `require` and type-only.
- It follows local imports (relative, and apps/web's `@/`) transitively, and names the chain. A
  component reaching `pg` through a helper is caught, and the message says through which file.
- It checks every tracked file, not only bundled ones, so dead code cannot hide a forbidden edge.
  Tests are out of scope.

**The rules, as data** (`RULES` in `import-directions.ts`):

| Rule | Scope                           | Forbids                                                                                        | Counts types |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ |
| A    | `components/`, `map/`           | any value from `@lokdarpan/money` except `format*`                                             | no           |
| C    | `components/`, `map/`           | `pg`, `@lokdarpan/database`, `services/`, Node builtins, `server-only`                         | no           |
| D    | `services/ingestion/`           | `react`, `next`, `maplibre-gl`, `apps/`, `@/`                                                  | no           |
| E    | `packages/domain`, `/contracts` | presentation, `pg`, `@lokdarpan/database`, the filesystem, `apps/`                             | no           |
| F    | `components/`, `map/`           | `@lokdarpan/ingestion`                                                                         | yes          |
| R    | `map/labels/`                   | analytics, risk, finance, `@lokdarpan/money`, `@lokdarpan/domain`: what is drawn is not ranked | no           |

**Type-only imports do not count for runtime rules.** A type is erased at build, so it carries no
connection or file read. A shape does count for F, whose point is that client code never depends on
an ingestion row's shape.

**Every rule has a fixture that must fail** (`import-directions.test.ts`), including one for the
transitive chain, a dynamic import, a cycle, and the type-only exemption.

## Consequences

The first run reported 53 violations. Triage:

- **50 were the checker's own mistake.** Rendering code reaches `data/geography.ts`, which is
  server-only, through `import type { StateOption }` only. That is how the type-only rule above was
  arrived at.
- **3 were real.** `Figure`, `MoneyTrail` and `PublishedFacts` imported the `Money` class, which has
  `plus`, `minus` and `compare`, to format a server's decimal string. `@lokdarpan/money` now exports
  `formatAmount` and `formatAmountSpoken`, and those components can no longer hold a value they could
  do arithmetic with.

All six rules hold. A new violation fails CI.

**Not in this change:**

- **Rule B, sentences written in components.** It needs a word-count lint over JSX text with a
  reviewed escape hatch, which is a different tool. The neutrality gate still covers vocabulary.
- **Rule A's arithmetic half.** An import rule cannot see `a + b` on two plain numbers.
  `shadedCount` in `tenders.tsx` still sums counts on the client, and should arrive as a server total
  (ADR-048).
- **A check that `apps/web` server modules stay out of client bundles.** `server-only` already makes
  that a build error.

## Addendum · 2026-09-25 — rule B, as a ratchet

Rule B is now checked by `pnpm architecture`. A run of JSX text of six or more words in
`apps/web/src/components/` or `apps/web/src/app/` is a sentence, and sentences belong in
`apps/web/src/copy/`, where neutral wording is reviewed. Labels, headings and button text are
shorter and are not counted. Tests and `copy/` itself are out of scope.

The existing prose is a ratchet, not a failure. `packages/architecture/copy-baseline.json` recorded
**57 sentences in 19 files** when the rule began, 12 of them on the About page. A file may hold its
baseline or fewer, never more, so any new sentence written in a component fails CI with its line
and text. When a file goes below its baseline, the check says to lower it:
`pnpm architecture --write-copy-baseline`. A test adding one sentence to `MapControls.tsx` failed as
intended before it was reverted.

Still not in this change: moving the 57 into `copy/`. The ratchet makes that work visible and
one-way, and each move is a wording review in its own right.
