# ADR-056 · A tender is linked to, not reproduced

**Status:** Accepted · **Date:** 2026-09-17 · **Resolves** the open decision in [`055-a-response-carries-the-terms-its-sources-are-held-under.md`](./055-a-response-carries-the-terms-its-sources-are-held-under.md) · **Follows** the BEAMS precedent in [`../06-government-sources/source-licences.md`](../06-government-sources/source-licences.md) §3

## Context

On 17 September 2026 the policy page of every GePNIC portal LokDarpan collects was fetched (21
portals, `source-licences.md` §5). Every one permits reproduction only "after taking proper
permission from the respective Organisation / Department"; Madhya Pradesh requires written
permission. Every one says linking directly needs no permission.

Since #55 (`93bc1ef`) the explorer had listed tender titles, references, departments, organisation
chains, locations, values and EMDs from those portals. Permission had not been sought. BEAMS figures
are withheld under the same clause.

Four options were put to the maintainer: withhold details and link to the portal, keep listing
pending legal advice, draft permission requests while listing, or withhold all tender data.

## Decision

**The maintainer chose: link, don't reproduce.**

- **Tender details are withheld by default.** Titles, references, values, EMDs, organisation
  chains and locations are not rendered. `tenderDetailsArePublishable()`
  (`apps/web/src/server/publishable.ts`) opens them only when `PUBLISH_TENDER_DETAILS` is exactly
  `"true"`, read at call time, like the BEAMS flag.
- **Withheld means not read.** While withheld, `/api/v1/tenders` does not query tender rows at all.
  It returns `detailsWithheld: true`, a count (`countTenders`), and the state's portal URL. Details
  cannot reach a response or a cache.
- **Counts and shading stay.** A count of tenders per district, and the shading drawn from it, is
  LokDarpan's own measurement, not material reproduced from a portal. Department names in the
  filter also stay: they are names of public bodies. This is a judgement, recorded so it can be
  revisited if legal advice says otherwise.
- **The reader is sent to the source.** A place's panel says how many open tenders are held, why no
  details are shown, and links to the state's portal. The portal table moved from the collector to
  `packages/domain/src/gepnic-portals.ts` so the explorer can link to it without importing
  ingestion code.
- **Unplaced tenders** are still counted and stated; the control that listed them is replaced by a
  sentence, since there is no list to show.

## Consequences

The explorer no longer reproduces portal material it has no permission to reproduce, and still
says, per place, how much is advertised and where to read it.

**Reversible without a code change.** Once permission is granted, and granted per issuing
department rather than per portal, setting the flag restores the lists.

**Unchanged:** collection continues, tenders are still linked to districts, and consistency checks
can still use them. As with BEAMS, this withholds display, not collection.

Three new reader-facing sentences were written for this and are listed in the release changeset for
review.
