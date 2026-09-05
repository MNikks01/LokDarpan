---
"@lokdarpan/database": minor
"@lokdarpan/domain": minor
"@lokdarpan/web": minor
---

Make the selected place decide what records are shown.

The explorer asked for records by state code at every level, so Maharashtra,
Nagpur district and Nagpur Municipal Corporation all returned the same thirty
state-wide audit reports. Records are now queried by `admin_unit.id`, exactly and
without inheritance — the LGD code the query used before is per-register and
collides across levels, so a state's own code also names a district elsewhere.

`document.geography_source` records how a placement was reached, mirroring
`tender.district_source`. One value exists, `publisher_filter`, because one basis
exists: the CAG site's own state filter. No document was re-attributed, because
none carries evidence for anything narrower than a state — a report issued by the
Accountant General at Nagpur is not a report about Nagpur, and its title is not
evidence.

Maharashtra shows its 10 documents; Nagpur, its talukas and its municipal
corporation show none, and the panel says what that means rather than implying an
absence of audits. Documents with no established geography are reachable at
`?unresolved=true`.

Village coverage is now stated for Maharashtra — 40 held, all inside one
district, against a state with more than forty thousand — and the boundary
artifacts are regenerated from the ledger.
