# ADR-076 · A page says what is held, shown, withheld and not collected

**Status:** Accepted · **Date:** 2026-10-08 · **Implements** LD-009 of milestone M1 (#187) · **Builds on** ADR-048, ADR-054, ADR-056, ADR-059, ADR-073

## Context

`17-legal/legal-ethical-rules.md` forbids implying that a government did not publish something.
`CLAUDE.md` puts it as "missing is never zero". The Unit page broke that rule by omission. It
showed boundaries and, for a state, the governments and departments named in reviewed reports. It
said nothing about budgets, tenders or works. A reader on the Maharashtra page could fairly take
the missing budget section to mean "Maharashtra publishes no budget". The truth is that LokDarpan
holds Maharashtra's budget figures and may not show them yet (ADR-073).

ADR-054 gave the site one vocabulary for the state of its data, with three questions: is it
collected, is it current, is it complete. Only the map explorer used it, for tenders and
boundaries. It also cannot express the case above. Budget figures are collected, so
`not_collected` would be false. Calling them `held` would imply a reader can see them.

## Decision

1. **Whether what is held may be shown is a fourth question, and the gate answers it.** A
   `Holding` (`@lokdarpan/domain`, `holdings.ts`) pairs a `DataState` with `showing`:
   - `shown`;
   - `counts_only`, where the count is ours to state but the records are not, as for tender
     details under ADR-056;
   - `withheld`;
   - null when nothing is held.

   The publication gate of ADR-073 decides it, passed in as `decide`. No row can say "shown" or
   "withheld" on anything but the decision the rest of the site acts on. `withheld` outranks the
   collection's own headline: a reader needs to know first that they cannot see it.

2. **Every page lists every kind of record, every time.** The kinds are:
   - boundaries one level down, one row per level (a district has talukas and urban local bodies);
   - audit reports;
   - open tenders;
   - budget, release and expenditure;
   - progress of individual works.

   A kind with nothing behind it still gets a row, so an absence is stated rather than left for
   the reader to interpret.

3. **Records kept by state are reported for the state, by name.** Audit reports, budgets and tender
   collection are filed by state. A district page says "10 reports are held for Maharashtra.
   Reports are filed by state", never "none for Nagpur". That second sentence is true of our
   filing and would be read as a fact about Nagpur.
4. **Units held decide the boundary row, not the recorded finding.** Where no unit is held at a
   level, the row says not collected, whatever `geography_coverage` records. A finding describes a
   load somewhere; this ledger holding nothing is the fact that matters on this page. Production
   carries Maharashtra findings that 0025 and 0028 wrote before any taluka was loaded there.
5. **No count without the right to show it, and no zero for not collected.** `count` is set only
   where the gate does not withhold, and is null for anything not collected (ADR-048).
6. **Words, never colours.** Each row leads with a word ("Held", "Held, not shown", "Not
   collected"). The sentences live in `apps/web/src/copy/holdings.ts`, where rule B (ADR-059) and
   the neutrality gate review them. The works row names the one register found (PMGSY's OMMAS)
   and why it is not copied. It says nothing about whether work is under way.

`GET /api/v1/units/:id/holdings` serves the list, read in one snapshot (ADR-053).
`<Holdings>` renders it on the Unit page.

## Alternatives considered

- **A `withheld` value inside `DataState.collection`.** This was rejected because it would merge
  two facts with different owners. Collection is about what was fetched; withholding is about the
  publisher's terms and our recorded permissions. With one enum, a source that became publishable
  would have to be re-collected to change state. Kept apart, it changes when the gate does.
- **Show only what is held, and a methodology link for the rest.** This was rejected because the
  inference happens on the page the reader is on. A link they may not follow does not correct it.
- **One row per source instead of per kind of record.** This was rejected because readers ask
  "is the budget here?", not "is BEAMS here?". The source is named in the row's sentence.

## Consequences

- A newly granted source shows "Held" on every page the day its grant and switch are recorded,
  with no change to this code.
- A new kind of record needs a row here before it ships, so that its absence is stated as well.
- The tender row carries no count yet. The explorer shows tender counts with their placement
  caveats, and repeating a bare count here would drop them.
- The Body and Document pages do not show the checklist yet. A body's row would need its own
  rules (a department's budget is not its state's), and that is left for its own change.
