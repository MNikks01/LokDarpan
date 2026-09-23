---
"@lokdarpan/web": minor
"@lokdarpan/database": minor
"@lokdarpan/domain": minor
"@lokdarpan/ingestion": patch
---

Link to tender portals instead of reproducing their tenders.

All 21 collected GePNIC portals permit reproduction only with the issuing department's permission,
which has not been sought (ADR-055, ADR-056). Tender titles, references, values, EMDs, organisation
chains and locations are no longer shown, and `/api/v1/tenders` no longer reads them unless
`PUBLISH_TENDER_DETAILS` is `true`. District shading and counts remain.

A selected place now shows how many open tenders are held, why details are not shown, and a link
to its state's portal, which the portals' terms allow. The unplaced-tenders list can no longer be
opened while details are withheld. The portal table moves from the collector to
`@lokdarpan/domain` so the explorer can link to it; the collector re-exports it unchanged.

New sentences, for review:

- "{n} open tenders are held for offices here."
- "Tender details are not shown. The state portals permit reproducing them only with the issuing
  department's permission, which LokDarpan has not sought."
- "Read these tenders on the state's e-procurement portal" (link)
- "Their details are not shown, for the same reason as other tenders." (after the unplaced count)
