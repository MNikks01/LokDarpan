# @lokdarpan/ingestion

## 0.1.0

### Minor Changes

- f714c0e: Add an OCR service boundary: a witness, not an authority.

  522 of the corpus's 4,586 pages have no text layer and 45 more have one that is
  present and wrong, so those pages need an engine that guesses. Every other stage
  either reads a figure exactly or refuses it, and attaching a guess to a
  government figure with a source link beside it is the most dangerous thing this
  project could build. The contract is shaped around that.

  A reading carries the engine, its exact version read from the installed engine,
  the model versions, the languages it was told to read, and the render it came
  from. Nothing is merged: two engines reading one page produce two readings, and
  there is no field for a consensus value. An absence is a stated refusal naming
  its reason — "not installed", "found no text" and "blank page" stay three
  different facts.

  A reading arrives in the shape the text layer already produces: content plus
  items carrying a character span and a box in PDF points, unrotated. So a figure
  found by OCR is located, cited and reviewed by the code that already exists. The
  Python ends at the contract; the TypeScript pipeline is untouched.

  The two sides are checked against the same bytes — five examples and eight
  counter-examples under `services/ocr/contract/`. The two sides cannot be
  type-checked against each other, so loosening one alone fails a test.

  Engine licences were verified from each package's own metadata rather than from
  documentation about them, which corrected a claim this repository had recorded
  from memory: Surya is Apache-2.0, not GPL. PaddleOCR, Tesseract, pytesseract,
  docTR and pypdfium2 are all usable under Apache-2.0, with exact versions
  recorded.

  No accuracy claim appears anywhere in this change. Which engine reads these
  documents better is measured on the real pages, next.

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

- d7e6175: Empty the `no_value` review queue: two parser defects fixed, twenty-three
  figures corrected by hand.

  **A parenthesised figure is not a table caption.** `pageDeclaresUnit` matched
  any parenthesis containing a unit word, sweeping up `(₹ 1,902 crore)` and
  `(₹ 10 crore and above)` — a figure and a criterion, each carrying its own unit
  and saying nothing about the scale of anything else. Three pages of ordinary
  rupee prose were refused because of them. A declaration names a unit _without_
  naming an amount, and excluding digits from the parenthetical separates the two.

  **An unreadable unit is not a missing unit.** Fixing the above alone would have
  made `₹ 145 core` — crore misspelled — read as one hundred and forty-five
  rupees, wrong by seven orders of magnitude and wrong precisely because the
  source did state a unit. A short list of near-miss spellings (`core`, `cr`,
  `lac`, `lakhs`, `करोड`) now refuses wherever it appears. The parser does not
  translate them.

  **The rest are corrected by hand.** A misspelled unit, a unit deferred across a
  list (`₹ 11,977 आणि ₹ 13,782.36 कोटी`), and plain rupees on pages that also hold
  a table. Teaching the parser any of these would put a guess behind every future
  figure rather than behind the twenty-three reasoned about, so they are
  `corrected` decisions applied from `data/reference/cag-fact-corrections.json` via
  `--corrections=<file>`. Amounts are written the way the source writes them and
  converted by `amountToPaise`, so there is one money conversion rather than two;
  every entry carries a reason, and a malformed file applies nothing.

  The linker now pairs on `coalesce(corrected_value, normalised_value)` — keyed on
  the parser's reading alone, all 23 corrections would have escaped the bilingual
  double-count rule.

  The money review queue is empty: 1,556 verified, 23 corrected, 44 rejected.

- 55644ba: Ingest Madhya Pradesh, discovering the state filter rather than hard-coding it,
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

- 2c0f4fe: Ingest seven more CAG reports, and fix three defects they exposed — two of which
  had already published wrong figures.

  The corpus went from 3 documents and 1,091 pages to 10 and 2,792. Some of these
  PDFs map glyphs through a non-Unicode font, so their text layer extracts as
  mojibake: Latin letters and digits stand in for Devanagari conjuncts, and matras
  detach from their stems.

  **`RS` was read as a currency marker.** These reports index their own series with
  all-caps codes — GSS, ES, RS, COPU — so a table of PAC/COPU report numbers
  produced ₹916, ₹33, ₹37, ₹54 and ₹56 out of report numbers. Across 2,792 pages
  every `RS` before digits is a series code and no genuine `Rs.` currency marker
  exists; these reports write `₹`. The marker is now case-sensitive. Five of these
  fabrications had been verified and published, and are revised to rejected.

  **A crore stem whose matra did not survive** was not recognised, so 721 figures
  were read as bare rupees — wrong by seven orders of magnitude. The mapping
  produces `कोट2`, `कोट8`, `कोट-`, `कोट:` and detaches the matra behind a space.
  One of the 721 was published, and was also an appendix heading rather than a
  reported amount; both the unit match and the criterion screen missed it for the
  same reason and both are fixed.

  Ordering matters here: matching the bare stem first shortened every intact
  `कोटी` match, moved every evidence window and stranded 504 sound decisions. The
  intact spellings are listed first, and stranding fell to 6 — the facts that were
  actually wrong.

  `PARSER_VERSION` is `cag-facts/7`. All 1,573 published money facts were audited
  for both defects: 0 fabricated, 0 mis-scaled.

- 3a21bc1: Measure both OCR engines on this corpus, and decide on the measurements.

  The brief named 522 unread pages. Rendering all 522 and measuring the raster —
  no recognition, just ink, images and layout — shows 428 are blank, 65 are report
  covers, 9 are photographs, 9 are divider sheets, and **11 are pages of writing**.
  The unread half of this corpus is eleven pages.

  Ground truth is the page's own text layer on 120 sampled pages, so nothing was
  transcribed by hand. Scoring runs the production extractor over OCR text and over
  the page's text and compares the amounts, because for this project a false
  numerical extraction is worse than an omission.

  **Tesseract 5.5.3: 100% figure precision, 41.5% recall, zero false figures** over
  104 trustworthy pages at 2.3 s/page. The precision is the extractor refusing what
  it cannot read: Tesseract reads the rupee mark 44.1% of the time, and on Latin
  pages figure recall is 1.9% as a result. On the eleven pages OCR exists for it
  recovers 7,252 characters at 0.948 confidence and no money facts at all.

  **PaddleOCR 3.7.0 could not be benchmarked here** — 471.77 s against Tesseract's
  1.47 s on the same page, 321×. That is a throughput fact on CPU, not an accuracy
  finding, and is recorded as one page of evidence.

  Scoring also exposed a defect in the ledger rather than in OCR: **115 pages whose
  text layer writes a backtick where the document prints ₹**, and `glyph_substitution`
  flags none of them, because it looks for Latin letters inside Devanagari words.
  Six of the ten figures that first looked like OCR errors were the engine reading a
  figure the broken layer had lost.

  Adds `ocr:manifest` and `ocr:score` alongside the benchmark harness in
  `services/ocr/bench`, so the next engine is measured rather than argued about.

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

- 5d19725: Read a bare ₹ figure as rupees, decided per page.

  The `no_value` partition — whose prompt asks a reviewer to supply the scale a
  figure was published at — held 125 candidates and had survived three sessions
  unworked. Reading all of them showed roughly 101 were plain rupee amounts:
  `₹1,500 per month`, `₹50,000 per student`, `₹54,33,780 दंड`. Audit prose writes
  crore and lakh out when it means them, so a ₹ figure with no scale word is the
  amount itself. `amountToPaise` returned null only because it refuses to assume,
  a refusal calibrated against BEAMS where a bare number means thousands.

  It now reads such a figure as rupees, but only on a page carrying no
  `(₹ in crore)` style caption. A table states its scale in the caption and prints
  bare cells; reading one of those as rupees understates a government figure by
  seven orders of magnitude. The check is page-scoped because a caption governs
  cells far outside any one evidence window, and deliberately generous, because a
  false positive only leaves a figure for a person to read.

  The reading is marked as an inference (`extractionConfidence` 0.6 against 0.8
  for a stated unit), and `selfCheck` re-derives the same way — without that, every
  one of these facts would have been reported as a `mismatch`.

  `AMOUNT_IN` also learns `ोटी`, which is कोटी with its leading conjunct dropped by
  the text layer. `PARSER_VERSION` is `cag-facts/5`, and loading now refreshes
  `parser_version` on undecided rows so a candidate names the parser that
  currently produces it; decided rows are left alone.

  The money review queue is 26, from 125.

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

### Patch Changes

- 6c41e26: Read crore when the font mapping substituted its conjunct.

  Document 3511 renders every `क` as `ि`, so its crore figures read `₹ 2.12 िोटी`
  and were stored as ₹1 — wrong by seven orders of magnitude. Measured across the
  corpus, the character before `ोट` when it follows a figure is `क` 2,027 times,
  `ि` 21 times and absent 7 times; the observed forms are now listed, in the same
  longest-first order that keeps intact spellings from changing identity.

  Ten facts were mis-scaled. None had been published: the only decided one was
  already rejected for a different defect found earlier.

  This was found by a **review screen, not by the pattern** — money facts under
  ₹1 lakh with no rate qualifier are worth a person's eye, because a CAG report
  rarely states a two-digit rupee finding unless it is a rate like "₹5 per record".
  A font mapping this corpus has not yet shown will slip past the pattern too, and
  that screen is what will catch it.

  `PARSER_VERSION` is `cag-facts/8`.

- 22b31c9: Withhold contractor and officer name facts from publication, and stop capturing
  a firm name that was cut mid-way.

  The last 37 unreviewed candidates were 2 contractor references and 35 officer
  role references. Each is a name and the sentence it was found in, and both
  contractor references sit inside audit observations about insurance
  non-compliance. `.docs/17-legal` rule 1 confines names to "neutral, descriptive
  statistics", and a name paired with an audit observation is not one — the
  pairing draws the inference without anything being editorialised. No screen is
  designed for them either; they render as a generic "Firm named" / "Role named".

  They are rejected as a class rather than judged individually, because the reason
  is not that these particular readings are wrong. Extraction continues, so the
  evidence stays available to a future surface designed for it.

  One extraction defect is fixed rather than merely rejected. The page names a
  joint venture, "M/s Water Staywordship Organization J.V Baramati"; the capture
  stopped at the full stop in "J." and the trimmer kept the head of it, naming one
  partner instead of the venture. `trimToName` now captures nothing when a
  trailing initial shows the name was cut — a missed firm costs a reviewer
  nothing, a misnamed one attaches the wrong company to a public claim.

  `PARSER_VERSION` is `cag-facts/6`. The review queue is empty.

- 85503ac: Refuse an amount whose scale word sits outside its bracket.

  The page states "shortfall of ₹11,553 (₹7,011+₹4,542) crore". The crore governs
  the bracketed group, and both amounts inside it were read as plain rupees —
  ₹4,542 instead of ₹4,542 crore, **wrong by seven orders of magnitude**, in a
  well-formed small figure nothing downstream could question. Three such readings
  reached the review queue and were caught by hand.

  An unqualified amount is now refused where a closing bracket followed by a scale
  word can be reached from it without leaving the bracket. The lookahead is bounded
  and stops at a further bracket or a full stop, because a scale word two clauses
  away governs something else.

  Found while reviewing the 496 candidates the rupee-mark decoding produced. That
  queue is now at zero: 411 verified, 85 withheld — per-unit rates, thresholds and
  ceilings set by rules, fragments of larger figures, worked examples of a formula,
  and four products on a Marathi page that do not equal their own printed
  multiplicands where the English page of the same report does. 5,164 facts are
  published, 4,560 of them counted once after bilingual linkage.

- 47d8dd4: Work the queue from seven newly ingested CAG reports to zero, correcting
  thirteen figures a person had to read.

  Thirteen entries are added to `data/reference/cag-fact-corrections.json`, each
  naming its amount the way the source writes it and saying why:

  - **Three where a unit is separated from its figure.** `₹ 2,184.19 कोटी ते
₹ 3,093.40 पर्यंत` states a range whose unit sits on one end only, and
    `₹ 13,518.30 (96.85 per cent) crore` puts a parenthetical between the two.
  - **Two more `core`-for-crore misspellings**, both confirmed against the same
    increase stated in crore elsewhere in the document.
  - **Eight figures the source states in plain rupees** — per capita GSDP, a
    guarantee fee of ₹2 per ₹100, an actual amount behind a rounded one — on pages
    whose captions declare crore, so the parser rightly refused them.

  Where a scale had to be inferred it was taken from the page's own caption rather
  than from the magnitude: pages 287, 288 and 376 declare `(₹ in crore)`, one of
  them with backticks standing where the `₹` should be.

  Four `contractor_reference` facts verified before ADR-033 are revised to
  rejected. Left published they would have been the only firm names a reader could
  reach, which is precisely what that decision withholds.

- Updated dependencies [f714c0e]
- Updated dependencies [5ad02db]
- Updated dependencies [e6b2d88]
- Updated dependencies [926e4a8]
- Updated dependencies [6f02caa]
- Updated dependencies [0e4349a]
  - @lokdarpan/contracts@0.1.0
  - @lokdarpan/database@0.0.1
