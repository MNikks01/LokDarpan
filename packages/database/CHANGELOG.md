# @lokdarpan/database

## 0.3.0

### Minor Changes

- 744bdda: Name the real dataset version on every explorer response.

  The seven explorer routes returned `datasetVersion: 0`, and every response's `asOf` was the time
  it was served. Neither described the data, so nothing could tell which state of the ledger a page
  came from.

  A response's version is now the newest dataset version committed when it was read, and `asOf` is
  when that version was opened. Each route reads inside one read-only snapshot
  (`readLedger`), so a load that commits mid-request cannot put rows from one state under the version
  of another. Routes whose version comes from their rows keep it, and now report that version's date
  instead of the time of the request.

  `EnvelopeMetaSchema.asOf` may be `null`, only for a ledger no load has written to.

- c472e32: Draw a level from outlines simplified when they were loaded, and shade tenders without re-sending
  the level (ADR-065).

  Migration 0033 stores `geometry_overview`, each boundary simplified once. The level endpoint for
  Madhya Pradesh falls from ~580 ms to ~62 ms. Containment now tests the stored label point and
  requires a child to be smaller than its parent. That removes 79 pairs where a state or district was
  listed as the child of one of its own smaller units.

  Tender counts reach the map as feature-state, so the level's geometry is sent once per visit and a
  department change moves only numbers.

- 79e0920: Draw each place's name inside the place, and stop names flickering.

  Names were anchored at the middle of a unit's bounding box, which for a coastal district or a
  crescent-shaped taluka can be in the sea or a neighbouring unit, and overlaps were ranked by
  bounding-box area in square degrees. Migration 0032 adds `label_point`, the centre of the largest
  circle inside the unit, and `area_m2` as generated columns, and boundary features now carry both.

  Placement is decided by a neutral arbiter: selection, administrative level, and area bucketed by
  powers of two, with nothing from a place's records. A just-shown name holds for 600 ms and a hidden
  one waits 400 ms, so names no longer flicker at the edge of a collision. Collision tests use a
  spatial grid, and names are measured in one batch.

  Names stay as DOM text because MapLibre 5.24 cannot shape Devanagari, Tamil or other Indic scripts.
  Their visibility is written inside the marker, because MapLibre resets a marker's own opacity on
  every move, which had redrawn hidden names on top of each other.

- 4a831f0: Scope the tender panel to the selected state.

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

- 65f19bd: Link to tender portals instead of reproducing their tenders.

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

- 03e5402: Serve unit views whose units came from several loads (ADR-053 addendum).

  `UnitService` no longer refuses a payload that spans loads. Geography is loaded district by district,
  so it refused every real state. The web routes read inside the ledger snapshot and report its
  watermark, and each unit keeps its own `provenance.datasetVersion`. `singleDatasetVersion` and
  `ViolationSink` are removed; `newestDatasetVersion` replaces them for callers with no snapshot.
  `PostgresAdminUnitRepository` accepts a snapshot client.

### Patch Changes

- Updated dependencies [b04aadb]
- Updated dependencies [469deb8]
- Updated dependencies [79e0920]
- Updated dependencies [52a6d22]
- Updated dependencies [59de13e]
- Updated dependencies [65f19bd]
- Updated dependencies [03e5402]
  - @lokdarpan/money@0.1.0
  - @lokdarpan/domain@0.3.0

## 0.2.0

### Minor Changes

- fa620ba: Stop a count from standing in for a claim about a government, and stop a tender
  from forgetting what it used to say.

  Maharashtra held no tenders and the panel said "0 tenders" — a true count and a
  false statement, since no Maharashtra portal is collected at all. Pune district
  holds 14 talukas and no municipal body, and the area selector could only be read
  as a statement about Pune. Both surfaces now record absence as its own fact:
  `geography_coverage` says whether a level is complete, partial or uncollected
  and why, and tender collection status is derived per state from the collection
  window rather than inferred from a total.

  `tender` was written by an upsert, so a closing date moved from 18 to
  25 September left no trace of the 18th. A trigger now keeps every superseded
  reading, following the pattern migration 0009 established for review decisions:
  append-only, written by the database, and only when a field the source controls
  actually changes. Re-ingesting identical data creates no version. The tender row
  stays the current reading, so nothing downstream reconstructs anything.

  `ingestion_run` records each execution with its status, timing and counts,
  opened before the load's transaction and closed after it, so a failed run rolls
  the ledger back without rolling back the account of the failure. Freshness now
  distinguishes when a record was seen, when the source was checked, and when
  collection last succeeded.

  No Maharashtra tender data is collected, invented or implied by any of this.

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

- cc475cd: Production hardening for Maharashtra, from a full audit.

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

- 328b3b4: Schedule the GEP-NIC sweep daily, under a credential that can only ingest.

  A sweep exited 0 whatever happened. Refusals were counted and named in the
  summary and never reached the exit code, so a day on which every portal refused
  looked to a scheduler exactly like a day on which everything worked. A sweep in
  which every attempted portal refused now exits 69; some refusing while others
  collect stays a success, because those records are real and a workflow that went
  red for one portal in twenty would stop being read.

  `lokdarpan_etl` is the role the scheduler runs as, derived by reading every
  statement the pipeline issues rather than by removing privileges from ownership.
  It may read the hierarchy and tender history, and write tenders, their collection
  windows and ingestion runs. It cannot change the schema, create objects, or write
  tender history directly — that is the SECURITY DEFINER trigger's job, and
  granting it here would have defeated the point of making it one.

  One sweep at a time, enforced by a PostgreSQL advisory lock on key 437642, taken
  on the connection that runs the sweep so the server releases it when the process
  dies. No stale lock, no timeout. A sweep that cannot take it records an
  `ingestion_run` with the new `skipped` status, naming the backend that holds it,
  and exits 75 — neither a failure nor a success, which the previous three statuses
  could not express.

  Maharashtra tender ingestion remains `not_collected`. Scheduling changes what the
  other twenty states report; it does not make Maharashtra data available.

### Patch Changes

- d355358: Refuse a figure whose scale word is in a script the parser cannot read.

  Tamil Nadu's reports are published as separate Tamil and English PDFs. The Tamil
  text layer arrives either in visual glyph order (`ணைாடி` where Unicode spells
  `கோடி`) or as mojibake (`ேகா}`), and both keep the digits while destroying the
  word beside them: the state's revenue receipts, `₹2,43,749.34` crore, were read
  as `₹2,43,749`.

  An unqualified amount whose next word is in neither English nor Devanagari is
  now refused rather than read as rupees. Verified against every decision already
  recorded — the same facts are stranded with the rule and without it, and the
  published ledger is unchanged.

  `page_script` gains `tamil`; 730 pages of Tamil had been stored as English
  since those pages carry page numbers and roman numerals.

  Also: an HTML entity in a report link is decoded (`&#039;` in "CAG's Report" made
  one URL unfetchable), and one report that will not fetch no longer ends the run.

- db1f218: Stop a timestamp that lost precision in transit from looking like a changed
  tender.

  PostgreSQL stores timestamps to the microsecond and a JavaScript `Date` carries
  milliseconds, so a caller reading a closing date back and writing it again
  unchanged handed over `12:00:00.123` where `12:00:00.123789` was stored. The
  versioning trigger compared exact values, saw a difference, and would have
  recorded a government office moving a deadline it never touched. ADR-049 shipped
  with this as a known limitation; ADR-050 closes it.

  Where two readings agree to the millisecond, the stored value is now restored
  before any comparison — so the comparison itself is unchanged, a real change of a
  millisecond or more still files a version, and the stored microseconds survive
  the round trip rather than being quietly shortened.

  Declaring the column `timestamptz(3)` was the obvious fix and is wrong: that cast
  rounds `.123789` to `.124` while the driver truncates it to `.123`, leaving the
  two unequal. `date_trunc('milliseconds', …)` truncates, matching the driver.

- Updated dependencies [844bb2d]
  - @lokdarpan/domain@0.2.0

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

### Patch Changes

- Updated dependencies [ffa8dfc]
  - @lokdarpan/domain@0.1.0

## 0.0.2

### Patch Changes

- 3511219: Make validation field-aware, and let it advise rather than decide.

  A field now declares whether it is critical, and the rules follow. `FIELDS` is
  exhaustive by type, so adding a `FactKind` without saying how carefully it must
  be read is a compile error — it caught `work_reference` while this was being
  written. Money is critical; a contractor or officer reading is not, because it is
  never published.

  `validate` returns `accepted`, `needs_review` or `rejected`, deliberately
  separate from the four states a person records. `rejected` never means "probably
  wrong": it means the sentence states what the number is, and it is not an amount
  — a rate per unit, a threshold in a rule, the multiplicand of a product, an
  illustration in a formula.

  The need was measured, not assumed. Working the last queue, a person rejected 85
  well-formed figures by reading them; the parser had offered every one with a
  value.

  **The verdict changes nothing.** It does not clear the value or withhold the
  fact. Migration 0019 records it, with a constraint that a refusal must say why,
  and it refreshes onto rows already held so a rule that changes is visible on
  every fact it touches. Re-extraction produced no new candidates, no retirements
  and an unchanged queue.

  Advisory because the sweep across all 5,102 published figures said so. The first
  draft rejected 173 of them, and reading those showed the rules were wrong:
  "costing ₹68.55 crore" is a sum, "valuing ₹29.51 crore" is a sum, "liabilities
  exceeding ₹27,184 crore" is a liability, and bare "less" matched the subtraction
  in "₹0.31 crore (₹4.00 crore less ₹3.69 crore)". Each removal is now a test
  asserting the figure survives.

  That leaves 137 published figures the rules disagree with, **113 of them rates** —
  "₹1,500 per month", "₹3,650 per square meter". This ledger publishes rates as
  amounts in 113 places and withheld 60 on the same grounds last week. The standard
  has not been applied evenly, which is a question about what the ledger models and
  not one a regular expression should settle by unpublishing a government figure.

  Worth recording: the regression corpus reported zero false positives for the
  first draft. The full sweep found 173. A regression net is not a validation set.

## 0.0.1

### Patch Changes

- 5ad02db: Read the rupee mark on pages whose font mapping dropped it.

  Some documents emit a backtick where the page prints ₹ — `` ` 40.80 कोट(चे `` for
  ₹ 40.80 कोटीचे. `glyph_substitution` counts Latin letters wedged into Devanagari
  words, and a backtick before a digit is neither, so all 134 affected pages scored
  clean and were recorded as read-and-empty. That is a different claim from
  unreadable, and 534 amounts sit behind it.

  ADR-039 refused to repair a currency mark on OCR output. This is admissible where
  that is not, and ADR-040 draws the line: there the mark is an engine's guess at a
  glyph it could not recognise, and nothing can recover the true character; here the
  glyph is printed, and since ADR-036 every fact carries the region it came from, so
  it can be rendered and looked at. It was — one site in each of the twelve affected
  documents, eleven showing ₹ unambiguously, the twelfth a rotated table where the
  crop caught the digits sideways and which is recorded as unverified. Three decoded
  figures were then checked end to end against the printed page.

  The decoding is page-scoped: a page must carry at least two such marks before any
  is read as a currency symbol, because one backtick is a quoted word. A decoded
  amount is recorded at confidence 0.5 where a stated one is 0.8, and reaches a
  reader only after review. 496 candidates entered the queue; none is published.

  Migration 0018 records `document_page.substituted_currency_marks`, counted rather
  than flagged.

  The triage tool had to learn the same rule. Blind to the mark, its self-check
  reported all 469 decoded facts as "the stored value appears nowhere in its own
  evidence" — a defect flag on every candidate of a class that is not defective.
  After: 0 mismatches, 167 confirmed, 292 in context, 22 without a value, 15
  ambiguous.

- e6b2d88: Fact review: sort candidates by page context, screen out criteria, reconcile on
  re-extraction, and count a bilingual figure once.

  **Two extraction defects, both changing what reaches the ledger.** `Rs` matched
  the end of English plurals — the pattern is case-insensitive and these are
  English reports — so `vouchers, ` became a monetary candidate and, worse,
  `Parameters 2020-21` was read as ₹2020 and `Surrenders 2.5.4` as ₹2.5. 79 such
  candidates existed; none had been verified, because none carried a unit and all
  stopped in the review queue as "the source stated no unit". Separately, the PDF
  text layer splits digit groups (`₹ 20 ,564.71 कोटी`), which truncated the figure
  to `20` and lost the printed unit. `AMOUNT_IN` now requires a word boundary
  before `Rs` and tolerates whitespace only around a digit group's commas.
  `PARSER_VERSION` is `cag-facts/4`.

  **Re-extraction reconciles instead of accumulating.** `loadFactCandidates` only
  ever inserted, so every parser version's output piled up in one table and no
  parser fix could replace a reading. It now removes undecided candidates the
  current parser no longer produces and reports decided ones as `strandedDecisions`
  without touching them: undecided rows belong to the parser, decided ones to the
  person who decided them.

  **A criterion is not a reported amount.** "Grants with savings over ₹100 crore"
  is a cut-off an auditor chose, and storing it puts a figure in the ledger no
  government body reported. `thresholdPhrase` flags these; it is advisory, because
  4 of 36 flagged facts were real reported quantities. Flagged candidates are kept
  out of the batch-review partitions so they cannot be accepted ten to a keystroke.

  **Window overlap is no longer mistaken for ambiguity.** A paragraph naming three
  deficits produced three candidates whose evidence windows each contained all
  three. The self-check now consults what else the same page claims, which moved
  849 candidates out of the partition needing individual adjudication.

  **One figure cited twice is counted once.** Each report is one PDF containing the
  whole report in Marathi and then in English, so 489 of 506 distinct values appear
  in both halves. Migration 0014 adds `document_fact.same_figure_as`, a nullable
  self-reference where `NULL` means "count this one". Only unambiguous pairs are
  linked — page alignment and neighbouring-amount similarity were both measured and
  neither separates the ambiguous cases, and a wrong pairing merges two distinct
  government figures, which is worse than the double count it would fix.

  Also adds a non-interactive decision path (`--decide`/`--revise` with a mandatory
  `--note` and a required scope) so decisions reached by a rule are recorded as
  such, rather than by feeding synthetic keystrokes to an interactive prompt and
  leaving an audit trail that claims a person read each page.

- 926e4a8: Give every extracted fact the region of the page its figure occupies.

  A citation of "page 83" of a 220-page audit report leaves a reader to find the
  figure themselves, and the evidence window stored beside a fact cannot be
  pointed at — searching a page for it finds the wrong occurrence whenever a
  figure repeats, which on a tabular page is most of the time.

  Migration 0016 stores `document_page.width`/`height`, a `document_text_item` row
  per pdf.js text item (its character span in the stored page text and its box),
  and `document_fact.bbox_x0..y1`, constrained to all-four-or-none. Coordinates are
  kept as the PDF states them — origin bottom-left, unscaled points.

  The page text is rebuilt from exactly those items, so a character offset is
  addressable geometry rather than a guess. `locatedSentencesOf` carries a
  per-character map from each sentence back to the page, because whitespace
  collapsing makes a sentence offset address nothing stored.

  Geometry is not part of a fact's identity, so boxes backfill onto rows of any
  status without re-offering a candidate or disturbing a decision. 5,747 facts now
  carry a region; 400 sampled verified facts were checked by reading the text under
  each stored box and converting it back through the parser's own conversion, and
  400 of 400 hold their own figure.

  `reprocess:cag` re-reads documents from the content-addressed raw store instead
  of the network, so re-extraction no longer costs the publisher a multi-megabyte
  download per document.

  Four monetary facts verified and sixteen candidates rejected: policy thresholds
  are criteria rather than sums (ADR-025), a per-capita GSDP and a fee of ₹2 per
  ₹100 are rates rather than amounts, and role references are never published
  (ADR-033).

- 6f02caa: Judge a figure's precision at the scale the source states, not at an
  intermediate one.

  CAG reached the one money conversion through BEAMS: `thousandsToPaise` shifts
  five decimal places and refuses anything finer, and a crore figure was that
  result multiplied up. So the sub-paise check ran at the thousands scale for every
  unit. It refused figures it could represent exactly — `0.0000001` crore is ₹1 —
  and, in the other direction, truncated `₹1.234` to ₹1.23 through an integer
  division on the way back down to rupees.

  The first was a documented conservative bias. The second was a silent
  truncation, which is the one thing the money path exists to prevent. Three
  published figures were affected: the source states ₹65.4347 per patient per day,
  ₹14,98,413.902 per km and ₹83.1802 per US dollar, and the ledger held each
  shortened by a digit. All three are now refused, and are also rejected as rates
  rather than amounts.

  `shiftedToPaise(raw, shift, unit)` takes the unit's own distance from paise — 9
  for crore, 7 for lakh, 5 for thousand, 2 for a figure written out in rupees.
  There is still exactly one conversion; the CAG scale table now holds a shift per
  unit instead of a multiplier over thousands. Across 6,255 decided facts, three
  evidence windows change and every other figure is byte-identical.

  Migration 0017 records `document_page.rotation` and stores `width`/`height` as
  the **unrotated** page box. 0016 stored the upright box from
  `getViewport({ scale: 1 })` while text-item transforms are in the unrotated space
  the file states; on the corpus's 457 rotated pages the two disagreed by a quarter
  turn, putting 46 fact boxes past the right edge of their own page.

  Twelve published facts on one page were rejected: they state the value a work
  must exceed for pre-qualification criteria or field-laboratory verification to
  apply, which is a criterion rather than a sum (ADR-025). Their identical twins on
  the same page had already been rejected on that ground.

- 0e4349a: Measure how much of a page's text layer is not the text, and withhold facts
  whose evidence cannot be read.

  `pages_without_text` counts pages with no text layer and cannot see a text layer
  that is present and wrong. Four of the ten CAG reports map glyphs through a
  non-Unicode font, so their text extracts as mojibake — Latin letters wedged into
  Devanagari words. The page renders correctly to a reader; only the extraction is
  garbage. Digits survive that and unit words do not, which is exactly what turned
  ₹2.12 crore into ₹1.

  Migration 0015 adds `document_page.glyph_substitution`, a ratio rather than a
  flag so the threshold can be revisited without re-extracting. It is NULL where
  there is too little Devanagari to judge, because an English page is not evidence
  of a clean font mapping. Clean and broken separate cleanly: 99% of judged pages
  above the threshold in three documents, 85% in a fourth, 0% in the other six.

  824 candidates are withheld as a class, each with the reason on the fact. None
  had been decided. The rows remain, so an OCR pass over the original bytes can
  revisit them.

  Also fixes `--ids` being silently truncated: `pendingReview` defaults to 500,
  which is right for walking a queue and wrong for a set someone named. Asking for
  824 named facts decided the first 500 and reported success.
