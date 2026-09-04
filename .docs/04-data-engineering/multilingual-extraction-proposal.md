# Multilingual, exact-value extraction — inspection and proposal

**Status:** Proposal · **Date:** 2026-09-04 · Decisions it asks for are listed in §7

This inspects the pipeline as built, then proposes what to change. It proposes
rather than decides, because choosing an OCR stack commits money, a licence and
an operational surface, and those are the maintainer's to commit.

Nothing here states a vendor's price, accuracy figure or language list from
memory. Where a number is needed to decide, it is marked **[verify]** and the
way to establish it is given — the same rule
[`06-government-sources/README.md`](../06-government-sources/README.md) applies
to source URLs.

---

## 1 · What exists today

### There is no OCR

`services/ingestion/src/cag/extract.ts` reads the **PDF text layer only**, via
`unpdf` 1.8.1 (a pdf.js wrapper). A page with no text layer is stored with
`content = NULL` and counted in `document.pages_without_text`. It is never read
by anything else.

**522 of 4,586 pages — 11.4% — have no text layer.** Those pages are image
scans. Nothing in the corpus has ever been OCR'd. `tech-stack.md` anticipated
Tesseract with Indic packs and `database-design.md` reserved
`extraction_method = 'ocr:tesseract'`; neither was built.

### The language assumption is two scripts

`page_script` is an enum of exactly `{latin, devanagari, mixed, none}`.
`scriptOf` classifies by counting Devanagari against Latin characters. Of the 23
languages named in the requirement, **Devanagari covers Hindi, Marathi,
Sanskrit, Konkani, Maithili, Nepali, Bodo and Dogri as a script**; Bengali,
Assamese, Manipuri, Gujarati, Gurmukhi, Tamil, Telugu, Kannada, Malayalam,
Odia, Urdu, Kashmiri, Santali and Sindhi have **no representation at all** —
neither in the enum, the unit vocabulary, nor the numeral handling.

Nothing breaks loudly on such a document. It classifies as `latin` or `none`,
and its figures are silently not extracted.

### Money is already arbitrary-precision

This is the requirement the pipeline already meets. Values are `BigInt` paise,
carried as decimal **strings** through Postgres `TEXT` and never through
`Number`. `packages/money` converts by decimal-point shift on strings.
`scaledToPaise` **throws rather than rounds** when a figure carries sub-paise
precision:

> "Rounding it would silently invent precision the source does not have, so it
> is refused instead."

So `₹177.79 crore` is stored exactly as `177790000000` paise. There is no
IEEE-754 anywhere in the money path.

**One caveat.** Paise is a fixed scale of two decimal places. A source stating
more precision than that does not round — it refuses, and the candidate reaches
review unvalued. That is the requirement's policy, arrived at independently.

### Evidence stops at the text window

Each fact stores `raw_text` — 160 characters either side of the figure — plus
document, page, `extraction_method`, `parser_version` and
`extraction_confidence`. There is **no bounding box**, so a reader cannot be
shown the region a figure came from, only the page and the surrounding words.

**This is cheaper to fix than it looks.** pdf.js already returns per-item
geometry and the pipeline discards it. Verified against a real report:

```text
"0.66%"   transform=[10,0,0,10,228.5,623.9]  w=28.8  h=10.0
viewport  [0, 0, 595.32, 841.92]
```

`transform[4],[5]` is the item origin and the viewport gives the page box, so
`x0,y0,x1,y1` is derivable **with no new dependency**.

### The validation layer is real, and was built the hard way

Most of the requirement's §6 list is implemented, because most of it has already
happened to this corpus:

| defect                                                         | how it is handled                                 | where it was found |
| -------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| currency marker matching an English plural (`vouchers,`)       | word boundary on `Rs`                             | ADR-026            |
| an all-caps series code `RS 9, 16` read as money               | `Rs` is case-sensitive                            | ADR-034            |
| digit group split by the text layer (`₹ 20 ,564.71`)           | whitespace tolerated around commas                | ADR-026            |
| a unit whose glyph the font mapping destroyed (`कोट2`, `िोटी`) | stem matched, longest-first                       | ADR-034            |
| a cut-off read as a spending figure                            | criterion screen, advisory                        | ADR-025            |
| a unit written but unreadable (`core`, `cr`, `Million`)        | **refuses**, never guesses                        | ADR-034            |
| a column header read as a figure (`Amount in ₹ 1`)             | header guard                                      | ADR-035            |
| **a decimal split from its fraction (`₹177. 75 crore`)**       | **refuses**                                       | ADR-035            |
| a text layer present and wrong (mojibake)                      | `glyph_substitution` per page; 824 facts withheld | ADR-035            |
| the same figure published twice from a bilingual PDF           | `same_figure_as`, unambiguous pairs only          | ADR-027            |

The requirement's own worked example — `₹177.79 crore` must not become `₹177` —
is a case this pipeline hit as `₹177. 75 crore` and **already refuses**.

### Review states are close to the requirement's

`verification_status` is `unverified | verified | rejected | corrected`.
Mapped onto the requirement: `unverified` **is** `needs_review`, `verified` is
`accepted`, `rejected` is `rejected`, and `corrected` is a fourth state the
requirement does not name — a value a person supplied, with its reason, in
`data/reference/cag-fact-corrections.json`.

### What is genuinely missing

1. **OCR** — 11.4% of pages unread; no engine at all.
2. **Non-Devanagari Indic scripts** — 14 of 23 languages unrepresented.
3. **Bounding boxes** — evidence is a text window, not a region.
4. **Multi-engine agreement** — one reader, no cross-check.
5. **Indic numerals** — `०१२३`, `০১২৩`, `௦௧௨௩` are not matched.
6. **Per-value language/script** — recorded per page, not per fact.

---

## 2 · Where numerical corruption can still occur

Ranked by how badly it fails, not how likely it is.

| #   | risk                                           | current exposure                                                                             |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | A scanned page's figures never reach anyone    | **Live.** 11.4% of pages. Silent under-coverage, not wrong values                            |
| 2   | A regional-script document extracts nothing    | **Live** for 14 languages, and would not announce itself                                     |
| 3   | An OCR engine misreads a digit                 | **Not yet possible** — there is no OCR. It becomes the dominant risk the moment one is added |
| 4   | A unit the parser does not know                | **Contained** — refuses, then a person decides                                               |
| 5   | Indic numerals in a figure                     | **Live but invisible** — no match, so no fact, so no wrong value                             |
| 6   | Evidence too coarse to audit a disputed figure | **Live** — page-level only                                                                   |

**Risk 3 is the one this proposal is mostly about.** Every defect found so far
came from a text layer that was _wrong in a legible way_. OCR introduces a
different failure: a confident, well-formed, wrong digit. `8`/`0`, `5`/`6`,
`1`/`7`, and `.`/`,` — the last of which turns ₹177.79 into ₹17,779.

That is why §5 of the requirement asks for multi-engine agreement, and why the
proposal below spends its complexity budget there rather than on breadth.

---

## 3 · Proposed architecture

```text
                         ┌─ text layer present, glyph_substitution low
   PDF ──► page triage ──┤        └──► parse as today (authoritative)
                         │
                         ├─ text layer absent            ──┐
                         └─ text layer present but wrong ──┤
                                                           ▼
                                              OCR (engine A) ──┐
                                              OCR (engine B) ──┼─► agree?
                                                               │
                                     ┌─────── yes ─────────────┴── no ───────┐
                                     ▼                                        ▼
                          accepted, both recorded                    needs_review,
                          with bounding boxes                    both readings kept
```

Four principles, each following from something already established here:

1. **The text layer stays authoritative where it is sound.** It is exact by
   construction; OCR is a reading. `glyph_substitution` already tells the two
   apart, and 824 facts were withheld on that signal.
2. **OCR is applied to pages, never to figures already read.** Re-OCR'ing a
   clean page to "check" it manufactures disagreements between an exact source
   and an approximate one.
3. **Disagreement is a state, not a tie to break.** Where two engines differ on
   a critical field the fact is `unverified` with both readings preserved —
   the queue this project already knows how to work.
4. **An LLM may explain a table; it may never supply a digit.** Requirement §4.
   Enforceable in review, because every value already carries its
   `extraction_method`.

---

## 4 · Tools, compared

**No accuracy percentage, price or language count below is stated from memory.**
Each is marked **[verify]** with the way to establish it. A benchmark on _this_
corpus — the 522 pages with no text layer and the four mojibake documents — is
worth more than any published figure, and those pages are already in the raw
store.

### Self-hosted

|               | **PaddleOCR**                                                                      | **Tesseract 5**                                                         | **Surya**                                       | **docTR**                                |
| ------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Indic scripts | Devanagari + several Indic families; per-model **[verify against the model list]** | Widest published Indic `traineddata` coverage **[verify per language]** | Strong multilingual + layout **[verify]**       | Latin-centric; Indic sparse **[verify]** |
| Tables        | PP-Structure — genuine table structure                                             | None; needs a separate layout step                                      | Table recognition included                      | Limited                                  |
| Accuracy      | Generally strong on print **[benchmark locally]**                                  | Weakest of these on noisy scans **[benchmark]**                         | Reported strong **[benchmark]**                 | **[benchmark]**                          |
| Hosting       | Self-hosted, Python                                                                | Self-hosted, C++ binary                                                 | Self-hosted, Python                             | Self-hosted, Python                      |
| Cost          | Compute only                                                                       | Compute only                                                            | Compute only                                    | Compute only                             |
| GPU           | Optional; CPU markedly slower                                                      | CPU only                                                                | **Effectively required**                        | Optional                                 |
| Licence       | Apache-2.0                                                                         | Apache-2.0                                                              | **GPL-family with commercial terms — [verify]** | Apache-2.0                               |
| Complexity    | A Python service + models                                                          | Lowest — a binary and `traineddata`                                     | Python + GPU + model weights                    | Python service                           |
| Failure modes | Confident wrong digits on low-DPI; table cells merged                              | Degrades sharply below ~300 DPI; no confidence on some builds           | **[verify]**                                    | **[verify]**                             |

**`OCRmyPDF`** is not an engine — it wraps Tesseract to _add_ a text layer to a
scanned PDF. Attractive because the rest of this pipeline then works unchanged,
but it writes a derived text layer that would be indistinguishable from a
publisher's own. It must never write into `data/raw`, which is
content-addressed and immutable.

**Surya's licence is the blocker to check first.** This repository is
Apache-2.0. If Surya is GPL, it cannot be linked into the service without
changing the project's licence, whatever its accuracy. **[verify the current
licence text before any evaluation effort goes into it.]**

### Cloud

|                              | **Google Document AI / Vision**                                                  | **Azure AI Document Intelligence**          | **AWS Textract**                               |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Indic scripts                | Broadest published coverage **[verify per language]**                            | Narrower than Google for Indic **[verify]** | **Largely Latin — likely unsuitable [verify]** |
| Tables                       | Strong                                                                           | Strong                                      | Strong for Latin                               |
| Per-token confidence + boxes | Yes                                                                              | Yes                                         | Yes                                            |
| Hosting                      | API only                                                                         | API only                                    | API only                                       |
| Cost                         | Per page **[verify current pricing]**                                            | Per page **[verify]**                       | Per page **[verify]**                          |
| Latency                      | Network + async for large PDFs                                                   | Similar                                     | Similar                                        |
| Licence                      | Terms of service, not a software licence                                         | Same                                        | Same                                           |
| Complexity                   | Credentials, quota, egress                                                       | Same                                        | Same                                           |
| Failure modes                | Silent model changes between versions; no reproducibility guarantee across dates | Same                                        | Same                                           |

**The reproducibility problem is the serious one for this project**, and it is
not about accuracy. A cloud model can change under a stable API. This repository
re-derives facts from immutable raw bytes and records `parser_version` on every
row so a reading can be reproduced. An API whose behaviour changes silently
breaks that: `extraction_method = 'ocr:google-docai'` does not identify what
actually read the page. If a cloud engine is used, the **full response must be
stored** as its own artefact, so the reading is reproducible from what was
returned even when the model behind it has moved on.

There is no confidentiality objection — these are published government reports.
The objection is reproducibility and cost.

---

## 5 · Recommendation

**Two self-hosted engines, and no cloud dependency yet.**

- **PaddleOCR** as the primary: Apache-2.0, table structure, the broadest Indic
  coverage among the permissively licensed options **[verify]**.
- **Tesseract** as the second opinion: Apache-2.0, CPU-only, and — the point —
  **an independent implementation**. Two engines that share a lineage agree on
  their shared mistakes; Tesseract and PaddleOCR do not share one.

Cloud stays an option for pages both engines fail, taken deliberately per page
rather than as a default, and only with the full response stored.

Surya only if its licence permits **[verify]**. AWS Textract is likely ruled out
by Indic coverage **[verify]** before any other consideration.

---

## 6 · Increments

Each lands on its own, is testable, and leaves the pipeline correct.

| #     | increment                                       | why this order                                                                                                                                        |
| ----- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Bounding boxes from the existing text layer** | No new dependency, no OCR, no risk. Delivers requirement §9 for the 88.6% of pages already read, and builds the evidence schema OCR will need         |
| **2** | **Adversarial number tests + Indic numerals**   | Pins §10 and §11 against the current parser _before_ OCR can regress it. `₹177.79` stays `177.79`; `०१२३` and `১২৩` extract or refuse, never mis-read |
| **3** | **Script detection beyond Devanagari**          | `page_script` becomes the detected script; a Tamil or Bengali page stops classifying as `latin` and silently yielding nothing                         |
| **4** | **OCR for pages with no text layer**            | One engine, `extraction_method = 'ocr:<engine>@<version>'`, every value `unverified`. Coverage rises; nothing is auto-accepted                        |
| **5** | **Second engine and the agreement gate**        | Only now is there something to cross-check. Disagreement on a critical field → `needs_review` with both readings                                      |
| **6** | **Re-read the mojibake documents**              | The 824 withheld facts become recoverable, which is the payoff promised in ADR-035                                                                    |

**Increments 1 and 2 are worth doing whatever is decided about OCR**, because
they harden what exists and are prerequisites for judging any engine.

---

## 7 · Decisions this asks for

1. **Which engines**, given Apache-2.0 and the reproducibility objection to
   cloud. The recommendation is PaddleOCR + Tesseract, self-hosted.
2. **Whether a Python OCR service is acceptable operationally.**
   `tech-stack.md` already names Python for ETL, so this follows it rather than
   introducing a language — but it is the first Python service actually built.
3. **Whether to start at increment 1**, or to take a decision on engines first
   and run 1–3 in parallel with procuring them.
4. **What "critical field" means** for §5's agreement gate. Money is obvious;
   the requirement also names votes, population, dates, percentages and
   beneficiary counts, none of which this pipeline extracts yet.
