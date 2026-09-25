# Seven decisions of 25 September 2026

Taken by the maintainer on 25 September 2026, in answer to the open items left after the
September release. This records each, what was built, and what still depends on someone outside
the codebase. Nothing here assumes a permission that has not been granted.

| #   | Decision                                                   | State                                                                         |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Protection Bypass for Automation: server-side only         | Code ready and guarded by a test; **enabling it is a dashboard step**         |
| 2   | Hosted basemap, MapLibre, boundaries kept separate         | Built: [ADR-066](../adr/066-the-base-map-is-hosted-and-claims-no-boundary.md) |
| 3   | Pincode/town → district resolution                         | Built: [ADR-067](../adr/067-a-tender-district-can-be-inferred-and-says-so.md) |
| 4   | Start the permission process; keep a registry; don't block | Registry and drafts built; **no request has been sent**                       |
| 5   | OCR size limit                                             | Deferred until real failures are measured                                     |
| 6   | Conditional HTTP requests (ETag / Last-Modified)           | Deferred until repeated crawling or bandwidth is significant                  |
| 7   | Streaming large PDFs to disk                               | Deferred until measured PDF size or memory use warrants it                    |

## 1. Protection Bypass for Automation

Server components call this deployment's own `/api/v1/*`; with Deployment Protection on, those
calls need `VERCEL_AUTOMATION_BYPASS_SECRET`, which `apps/web/src/lib/api.ts` (a `server-only`
module) already sends. `apps/web/src/lib/secrets-stay-on-server.test.ts` fails if the secret is read
outside `server-only` code or given a `NEXT_PUBLIC_` name.

**External step:** enable it in the Vercel dashboard (runbook:
[`../16-operations/deployment-vercel.md`](../16-operations/deployment-vercel.md)). The Vercel
connector used in development was refused for this project's scope (403), so it was not enabled
from here.

## 2. Basemap

OpenFreeMap by default, configurable, stripped of every boundary and every country or state label.
Official hierarchy stays with LGD; geometry stays labelled by source. Trade-offs (reader IP reaches
the provider; no service level) are in ADR-066.

## 3. District resolution

Explicit district → pincode → place name → unresolved/review, each placement recording method,
source, confidence and time, and each inferred placement saying so to the reader.

**External step:** a data.gov.in API key, from registering an account. Until then no directory is
loaded and nothing is inferred.

## 4. Permissions

[`../06-government-sources/permission-requests.json`](../06-government-sources/permission-requests.json)
records department, dataset, access method, restrictions, request date and reference, response and
last verification, checked by `services/ingestion/tests/permission-registry.test.ts`. Drafts exist
for NRIDA (PMGSY/OMMAS), the Maharashtra Finance Department (BEAMS), issuing departments on the
GePNIC portals, and Mahatenders.

**External step:** confirm each addressee from the body's own site, send, and record the date and
reference. Phase 1 is not blocked: collection continues from sources whose terms permit it, and
restricted material stays withheld from display as before.

## 5–7. Deferred, with the evidence that would reopen each

- **OCR size limit.** Reopen when OCR runs record failures or timeouts attributable to input size.
  The evidence to capture from such a failure: the PDF's byte size and page count.
- **Conditional requests.** Reopen when a collector refetches unchanged content often enough that
  bandwidth or portal load is material. The ETag and Last-Modified headers are not stored today.
- **Streaming PDFs to disk.** Reopen when a measured PDF approaches the in-memory ceiling
  (`CAG_REPORT` in `services/ingestion/src/net/limits.ts`) or ingestion memory becomes a constraint.
