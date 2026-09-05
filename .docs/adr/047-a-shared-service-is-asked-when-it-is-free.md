# ADR-047 · A shared service is asked when it is free, not guessed at

**Status:** Accepted · **Date:** 2026-09-05 · **Applies to** `services/ingestion/src/osm`

## Context

Completing Maharashtra's geography meant ingesting 36 districts' talukas and
municipal bodies from OpenStreetMap. `overpass.ts` already recorded how that
should be done — _"Ingesting a state should be a loop over districts with the
artefacts kept, not one enormous query"_ — but nothing implemented the loop, so
it was run by hand one district at a time.

Automating it with a fixed pause between queries failed twice, in two different
ways, and both failures cost the whole state:

- **Ten seconds apart, the eighth district was refused with a 429.** Overpass
  does not limit a rate. It grants a small number of concurrent **slots**, and a
  heavy `out geom` query holds one for as long as it runs. No interval chosen in
  advance can be correct, because the right wait depends on what the service is
  doing, not on what this client did last.
- **Chandrapur returned 504**, twice, on the same two-level query. A large
  district's query times out at the gateway. That is a fact about one query, and
  it ended the run for the 28 districts after it.

In both cases work already committed for the earlier districts was invisible in
the error the run ended with.

## Decision

**Ask the service.** Overpass publishes `/api/status`, which states how many
slots are free and, when none are, when the next frees. `waitForSlot` reads it
before every query; `slotDelayMs` parses it and is a pure function, because the
text is the contract and it carries no version number.

Three details the failures dictated:

- **Zero free slots is a wait, not a green light.** The naive read of `N slots
available` matches `0 slots available now`.
- **An elapsed countdown is not a negative wait.** The page is generated between
  a slot freeing and the client reading it, so the figure can already have
  passed.
- **An unreadable page waits conservatively.** A status format that changes must
  fail towards politeness, never towards speed.

**A district the service will not serve costs that district, not the state.**
`OverpassDeclined` covers both refusals — no slot (429) and no answer (5xx) —
because the caller's response to them is identical and differs entirely from a
malformed query, which is still a fault to report. Each district is retried
three times, then named in a summary so an operator can re-run it. Re-running is
per district, and an operator cannot do that from a count.

## Consequences

The full Maharashtra ingest completed: 290 units inserted, 83 updated, none
failed, no district declined. It is slower than a fixed interval and that is the
point — the pauses are the ones the service asked for.

This is a general property of the connector, not a Maharashtra one: the same
loop serves any state whose districts carry OSM relation ids.

**Chandrapur succeeded on a later attempt**, so the 504 was transient rather
than a query that can never run. If a district emerges that never completes, the
answer is to split its levels into separate queries — which halves each query's
cost and doubles their number — not to raise a timeout until the gateway
tolerates it.
