---
"@lokdarpan/database": minor
"@lokdarpan/web": minor
---

Production hardening for Maharashtra, from a full audit.

A deep link could pair one state with a unit inside another: `?state=27&unit=<a
Kerala district>` rendered the selector as Maharashtra, framed the map on Kerala
and drew Kerala's breadcrumb under a Maharashtra heading — every part correct on
its own and the page as a whole saying something false. The pair is now
reconciled on the server before the first render, keeping the state and dropping
the unit, so a mistyped id never silently moves a reader to another state.

The three tables added since migration 0002 reach the API's role through
`ALTER DEFAULT PRIVILEGES`, so no migration names them and development connects
as the owner — a regression would have been seen first in production. They are
now exercised as `lokdarpan_api`: readable, and unwritable.

A collection window for portal `tn` asserted that a portal was being watched
from 1 September. The registry has no such code, it held no tenders, and Tamil
Nadu's real window carries the same date and 32 tenders, so it was the one window
that could never report a status. Removed, conditionally, with Tamil Nadu's floor
untouched.

Also records what the audit found rather than fixing it silently: nothing is
scheduled, so every collected state correctly reads `stale`, and `/explore` has
grown to 409 kB first-load against the ~291 kB ADR-022 recorded.
