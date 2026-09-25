---
"@lokdarpan/ingestion": patch
---

A tender seen again now takes the listing's current title, reference, closing date and bid opening
date.

The upsert updated only the fields read from the detail page, so when an office extended a deadline
the row kept the old date and the history trigger of migration 0022 never fired. ADR-049's central
case, "a changed closing date creates exactly one" version, could not happen: the production ledger
holds no tender versions at all. Dates the listing states no readable value for arrive as null and
keep the date already held, as the detail fields already did.
