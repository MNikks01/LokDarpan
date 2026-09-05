---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
"@lokdarpan/web": minor
---

Stop a count from standing in for a claim about a government, and stop a tender
from forgetting what it used to say.

Maharashtra held no tenders and the panel said "0 tenders" — a true count and a
false statement, since no Maharashtra portal is collected at all. Pune district
holds 14 talukas and no municipal body, and the area selector could only be read
as a statement about Pune. Both surfaces now record absence as its own fact:
`geography_coverage` says whether a level is complete, partial or uncollected
and why, and tender collection status is derived per state from the collection
window rather than inferred from a total.

`tender` was written by an upsert, so a closing date moved from 18 to
25 September left no trace of the 18th. A trigger now keeps every superseded
reading, following the pattern migration 0009 established for review decisions:
append-only, written by the database, and only when a field the source controls
actually changes. Re-ingesting identical data creates no version. The tender row
stays the current reading, so nothing downstream reconstructs anything.

`ingestion_run` records each execution with its status, timing and counts,
opened before the load's transaction and closed after it, so a failed run rolls
the ledger back without rolling back the account of the failure. Freshness now
distinguishes when a record was seen, when the source was checked, and when
collection last succeeded.

No Maharashtra tender data is collected, invented or implied by any of this.
