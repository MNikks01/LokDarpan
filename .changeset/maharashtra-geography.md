---
"@lokdarpan/ingestion": minor
---

Complete Maharashtra's geography to taluka and local-body level, and make the
OpenStreetMap connector able to ingest a state without being blocked.

`ingest:osm-boundaries --within=<unit>` walks a unit's children, querying one
district at a time — the pattern `overpass.ts` already described but nothing
implemented. Parentage comes from which query returned a unit, so no second,
weaker answer has to be derived from geometry.

Fixed pauses between queries failed twice, both times losing the whole state:
Overpass grants a small number of concurrent slots rather than limiting a rate,
so the eighth district was refused at ten seconds apart, and one large district's
gateway timeout ended the run for the 28 after it. The connector now reads
Overpass's own `/api/status` before each query and treats both a refusal and a
server error as a decline — retried, then named in a summary, costing that
district rather than the state.

Maharashtra now holds 36 districts, 355 talukas (353 carrying LGD codes) and 18
urban local bodies, all with boundaries. OpenStreetMap tags few of Maharashtra's
~270 local bodies and none with an LGD code; that gap is recorded in
`.docs/06-government-sources/gis/maharashtra-local-body-coverage.md` rather than
left to be discovered.
