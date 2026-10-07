# Permission requests deferred; restricted sources built behind the gate

**Decided by the maintainer on 7 October 2026.** Amends decision 4 of
[`2026-09-25-seven-decisions.md`](./2026-09-25-seven-decisions.md) ("start the permission process;
keep a registry; don't block").

## The decision

1. **No permission request is sent for now.** The drafted requests to the Maharashtra Finance
   Department (BEAMS), the GePNIC issuing departments, MahaTenders, Maharashtra PWD and NRIDA stay
   as drafts. Task LD-001 in
   [`../01-product/feature-priorities-2026-10-07.md`](../01-product/feature-priorities-2026-10-07.md)
   is deferred.
2. **Permission acquisition is not a development dependency.** LokDarpan is built end to end on the
   sources that are publishable now — CAG, LGD, OpenStreetMap, and any source whose terms #182 finds
   permit republication.
3. **Restricted sources are still built for.** Features that read a restricted source (BEAMS
   figures, tender details) are implemented and tested against fixtures and the local ledger, and
   render their withheld state in production. A future grant enables them by recording the grant and
   switching the source on — never by changing architecture or code paths.
4. **The requests are revisited** once the core Maharashtra platform and data graph are
   substantially complete: milestone M1 (#187) and phases 2–4 of #184.

## What does not change

- `permission-requests.json` keeps each request at `draft_ready`. Its statuses record what was done,
  not intentions, so the deferral is recorded here rather than as a new status.
- Collection rules: BEAMS continues to be collected for internal consistency checks; OMMAS, the
  MahaTenders portal and the PWD notice system are still not collected (their terms or `robots.txt`
  forbid it, independently of any request).
- Display rules: nothing from a `permission_required` or unrecorded source reaches a reader.

## What this costs, stated now so it is not discovered later

- Every Maharashtra PWD feature that depends on tenders, works, contractors or budget figures stays
  data-gated (feature priorities §1). The platform's Maharashtra surface is audit-led until the
  requests are sent and answered.
- An answer can take months. Deferring the request defers the start of that wait.

## What makes enabling a source later a configuration step

The publication decision is one function over three recorded facts — the publisher's terms, a
recorded grant, and an operator switch — so a granted source is enabled by data, not by code. See
the ADR that lands with the permission model.
