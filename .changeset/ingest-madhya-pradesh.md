---
"@lokdarpan/ingestion": minor
---

Ingest Madhya Pradesh, discovering the state filter rather than hard-coding it,
and fix three defects a second state exposed.

`listStates` reads the CAG audit-report filter's own `<select id="state">`, so a
second state needs no second constant. The registry's rule about not writing
URLs from memory applies to identifiers too: a state id typed from memory
silently fetches another state's reports. An unrecognised name prints what the
filter does offer rather than falling back to the default, and the `admin_unit`
lookup matches on name rather than a hard-coded LGD code.

**Madhya Pradesh publishes English-only**, where Maharashtra publishes bilingual.
So the Devanagari work does not apply, the bilingual linker finds no pairs, and
every MP figure counts once. That is worth knowing before assuming a second
state is more of the same.

Three defects, all caught by the implausibility screen rather than by the
patterns:

- **`Amount in ₹` read as the start of a figure.** In `No. | Name of Institution
| Amount in ₹`, the digits after that ₹ are the next row's serial number, so
  ₹1, ₹23 and ₹51 entered as amounts. A ₹ ending a column header is a
  declaration, not a figure.
- **A decimal point split from its fraction.** `₹177. 75 crore` is ₹177.75
  crore and was stored as ₹177 — silently, because ₹177 is well-formed. The
  parser now refuses rather than repairs: allowing whitespace inside a decimal
  would also read "cost ₹ 100. 5 villages were covered" as ₹100.5.
- **`Million` read as no unit at all.** One occurrence in 4,586 pages, so it
  refuses rather than earning a `SCALE` entry on a single data point.

`PARSER_VERSION` is `cag-facts/11`. The corpus is 20 documents and 4,586 pages;
`published_fact` holds 4,799 rows, all monetary, 4,230 counted once after
linkage, and the review queue is empty.
