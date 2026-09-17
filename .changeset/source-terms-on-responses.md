---
"@lokdarpan/domain": minor
"@lokdarpan/web": minor
---

Record the terms of every source the explorer shows, and state them on its responses.

The licence registry had no entry for OpenStreetMap or for the GePNIC state tender portals, though
both are displayed. Both were fetched and recorded on 17 September 2026. OpenStreetMap permits reuse
under the ODbL. All 21 collected tender portals permit reproduction only after permission from the
issuing department; Madhya Pradesh requires it in writing.

`describeSources` turns source ids into descriptors (publisher, republication terms, terms URL,
verification date, caveat). The tender overview and a unit's children now return them as `sources`.
Collector ids such as `gepnic-kerala` resolve to their publisher's entry; unrecorded ids are
`unknown`, never permitted.

Nothing a reader sees changes. Tenders remain listed while the decision on their terms is open.
