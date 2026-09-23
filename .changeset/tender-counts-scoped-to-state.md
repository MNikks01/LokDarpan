---
"@lokdarpan/web": patch
"@lokdarpan/database": minor
---

Scope the tender panel to the selected state.

With a state selected, `/api/v1/tenders/overview` returned the country's district counts,
departments and unplaced total. The panel under Odisha said "12 open tenders across 6 districts"
when all twelve were in Madhya Pradesh, Uttarakhand, Jharkhand and Kerala. District counts are now
limited to districts inside the state. The departments, the unplaced total and the unplaced list
(`/api/v1/tenders?unplaced=true&state=`) are limited to the state's own portals, since an unplaced
tender has no district to go by. With no state selected, nothing changes.

A collected state with nothing to shade no longer reads "0 open tenders across 0 districts".

New sentence, for review:

- "No open tender is held for offices in a district of {state}. This describes what LokDarpan holds,
  not what was advertised."
