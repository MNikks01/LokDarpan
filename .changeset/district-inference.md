---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
---

Place a tender whose chain names no district by its pincode or location, through the Department of
Posts' pincode directory, and say so.

Resolution runs in a fixed order — explicit district, pincode, place name, unresolved — and each
inference must be unanimous within the portal's own state. Every placement now records its method,
reference artefact, matched key, confidence and time (migration 0034), and the six columns move
together. The explorer labels an inferred district as inferred and states how many shaded tenders
were placed that way. `ingest:pincodes` loads the directory from the data.gov.in API (a key is
needed) or a downloaded file; `tenders:resolve` backfills and lists what remains for review.
