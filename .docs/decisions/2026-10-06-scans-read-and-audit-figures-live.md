# 6 October 2026 — scans read, audit figures live

What changed in one working day, what it found, and what was decided. Each item names where the
detail lives; this page is the index, not the record.

## Shipped

| Change                                                                                                 | Where                                                             | PR         |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------- |
| Maharashtra agency collectors: MHADA and MSIDC notices, kept as documents                              | `services/ingestion/src/maharashtra/`; migration 0040             | #165–#167  |
| Notice facts, each naming the field it fills                                                           | `maharashtra/notice-facts.ts`; migration 0041                     | #170, #175 |
| OCR readings stored beside the page, never in its place                                                | ADR-071; migration 0042; `ocr/read-pages.ts`                      | #171       |
| Facts read from a scan: review-only candidates                                                         | ADR-072; migration 0043                                           | #171       |
| A scan fact shown with its engine and legibility, worded, never a percentage                           | ADR-072 addenda; migration 0044; `copy/figures.ts` `scanFactCopy` | #176, #178 |
| The OCR service: languages actually read, timeouts by page, abandoned reads stop, one build per engine | `services/ocr`                                                    | #171, #174 |
| `migrate -- --status`, read-only, and the production migration runbook                                 | `16-operations/applying-migrations.md`                            | #173       |
| `raw:adopt`, `ocr:read`, scan facts from CAG readings, `extract:cag-facts -- --dry-run`                | `16-operations/reading-scans.md`                                  | #180       |
| A homepage drawn from the ledger                                                                       | `apps/web`                                                        | #161       |
| `source-map-js` advisory override                                                                      | `package.json`                                                    | #172       |

## In production

- **Migrations 0040–0044** applied by hand, each checked with `--status` before and after.
- **Two releases** to `main` (#177, #179). Each was deployed and checked live.
- **The CAG corpus promoted** (`promote:cag`, dataset version **285**): 30 reports, 6,339 pages,
  10,712 figures, 5,088 published. `/documents` lists them. Before this, production held no
  documents at all.
- The site is at `https://lok-darpan-web-ft68.vercel.app`. `lokdarpan.org` is named in the
  documentation, but the domain has not been bought yet.

## Found

- **The CAG reports' text-less pages hold no figures.** Of 614, 530 are blank and 84 are covers.
  The case ADR-038 made for OCR does not hold for this corpus (ADR-038 addendum).
- **MHADA's notices are scans throughout, in Marathi.** OCR reads the schedule's dates and the
  notice reference from 3 of 10. The labels on the other 7 were damaged in reading.
- **PaddleOCR is slow and was mislabelled.** It takes about 260 s a page on a laptop CPU. It also
  recorded languages it was never asked to load, which was fixed before any of its readings were stored.
- **A Python engine holding the GIL starves the service's event loop.** Abandoned reads are now
  stopped. Keeping the service responsive during a PaddleOCR page needs its own process.
- **The CAG bytes were retained after all.** All 30 reports hash-verify in the local store, although
  their rows said otherwise.
- **data.gov.in's API gateway** answered 500 and then 429 to keyless and keyed requests alike
  (`06-government-sources/datagovin-api-findings.md`).

## Decided

- **A reading never replaces a page's text** (ADR-071).
- **A fact read from a scan is a candidate a person checks**, and is shown only with its engine and
  legibility (ADR-072).
- **Legibility is the engine's confidence in the figure's words, at or above 0.80**, provisionally.
  It is to be confirmed against the first review (`LEGIBLE_FROM`).
- **Production is migrated by hand**, with `--status` before and after. Credentials stay in the
  operator's terminal.

## Open

| Item                                                                                | Who                     |
| ----------------------------------------------------------------------------------- | ----------------------- |
| Review the 31 scan candidates; then confirm the legibility threshold                | the reviewer            |
| Test the data.gov.in key once its gateway answers; inspect the Assam series         | engineering             |
| Permission requests to MHADA, MSIDC and the PWD (drafted, none sent)                | the operator, if needed |
| Rotate the Neon owner password, which appeared in a session log, and the other keys | the operator            |
| PaddleOCR in its own process, if a second engine is wanted                          | engineering, optional   |
