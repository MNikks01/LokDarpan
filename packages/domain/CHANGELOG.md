# @lokdarpan/domain

## 0.2.0

### Minor Changes

- 844bb2d: Make the selected place decide what records are shown.

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

## 0.1.0

### Minor Changes

- ffa8dfc: Give a rate its denominator, and restore the figures that can now state one.

  ADR-044 withheld 118 published rates because `document_fact` had no denominator,
  so a page rendered ₹15 where the source says ₹15 per record. It named the
  reversal condition exactly — a unit on the schema, rendered or nothing — and this
  is that work.

  Migration 0020 adds `per_unit`, exposed through `published_fact`, carried on the
  domain type, and rendered beside the figure in the words the page uses. The
  accessible label says it too: a screen reader must not be told a rate is a sum
  either.

  The denominator is read forward from the amount and never inferred. "at the rate
  of ₹60,000" states a rate whose unit sits elsewhere in the sentence, and choosing
  which noun it belongs to would be inventing a denominator for a government
  figure. Such rates stay refused.

  Where the reading stops was set by real captures, each now a test: a capitalised
  word after a lowercase one opens something new ("per beneficiary **Quantity** in
  grams"); past the first word only a measure noun continues a unit ("per month
  **since** April"); after a second "per" exactly one word ("per IPD patient per day
  **respectively**"); a denominator may itself be money ("₹2 per ₹100"); and a unit
  the evidence window cut off is not read at all — "₹100 per Cu…" is "per Cu.M." on
  the page, and Cu is not a cubic metre.

  Of the 118, **64 are restored** and 54 stay withheld. Published facts rise 5,029 →
  5,088, of which 60 now say what they are per, and no published rate lacks a
  denominator.

  Also fixes a defect this exposed: two figures in one sentence can share an
  identity, since a page declaring its own scale refuses both "₹2" and "₹100" in
  "₹2 per ₹100" and gives both a null value. The reading without a denominator was
  overwriting the one with. Candidates are now deduplicated per identity,
  preferring the reading that carries a denominator.
