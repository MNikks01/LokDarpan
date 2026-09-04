# @lokdarpan/database

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
