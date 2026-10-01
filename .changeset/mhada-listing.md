---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
---

Collect MHADA tender notices (`ingest:mhada`), the first Maharashtra agency source. Reads MHADA's
listing (back to July 2016), keeps each listing page as evidence, and retains every notice PDF it
points to in the raw store — checking `robots.txt` per path, two seconds between requests, and never
fetching a notice already held. Migration 0040 adds `artifact_sighting`, which records what pointed
to each document (the listing, and what its row said) separately from the document itself.
