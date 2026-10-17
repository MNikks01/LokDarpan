# Current state

**The one maintained snapshot of what is built, what is deployed, and what is open.** Update it in
the same PR that changes any of it. Every row says how it is known and when; a row that cannot say
so is marked _not recorded_ rather than assumed.

**Last reviewed:** 16 October 2026. Dated audits keep their own dates and are not rewritten:
[`product-audit-2026-09-29.md`](./product-audit-2026-09-29.md) is the evidence behind most of what
follows, and [`what-the-ledger-is-today.md`](./what-the-ledger-is-today.md) is the 5 September
record this page replaces.

---

## Deployed

| What               | Where                                                                                                                                                                                                                                              | Known from                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The site and API   | Vercel, `https://lok-darpan-web-ft68.vercel.app`. `lokdarpan.org` is named in the documentation but had not been bought as of 6 October                                                                                                            | [decision of 6 October](../decisions/2026-10-06-scans-read-and-audit-figures-live.md)                    |
| The ledger         | PostgreSQL + PostGIS on Neon; the site reads it through the pooled connection as the read-only `lokdarpan_api` user                                                                                                                                | [`16-operations/deployment-vercel.md`](../16-operations/deployment-vercel.md)                            |
| Nightly collection | GitHub Actions, `0 20 * * *` (01:30 IST), `ingest:gepnic --all` over 21 GePNIC portals; a separate check opens an issue when a run fails or does not run                                                                                           | `.github/workflows/ingest-tenders.yml`, `check-collection.yml`                                           |
| Raw bytes          | Cloudflare R2, content-addressed by SHA-256                                                                                                                                                                                                        | [ADR-069](../adr/069-the-bytes-a-row-cites-are-kept-where-they-outlive-the-run.md), migration 0037       |
| API rate limit     | One-hour CDN caching of every `/api/v1` answer is in the code on `main`. The per-IP limit on cache misses also needs a Vercel token and Firewall rule; **that setup is not recorded as done**, and until it is the code lets every request through | [`16-operations/rate-limiting.md`](../16-operations/rate-limiting.md) §1–§2                              |
| Migrations in prod | 0001–0044, applied by hand with `--status` checked before and after (6 October). **0045–0048: not recorded** — check with `migrate -- --status`                                                                                                    | [`16-operations/applying-migrations.md`](../16-operations/applying-migrations.md), decision of 6 October |

## What the ledger holds — production and local differ

Measured 29 September 2026; the CAG row updated 6 October 2026. **Check which database you mean.**

| Ledger contents                                        | Production (Neon)                 | Local Docker       |
| ------------------------------------------------------ | --------------------------------- | ------------------ |
| LGD states · districts, with OSM geometry              | 36 · 787                          | 36 · 787           |
| Sub-districts · villages · urban local bodies          | **none**                          | 355 · 40 · 18      |
| CAG audit reports · pages · published facts            | 30 · 6,339 · 5,088 (promoted)     | 30 · 6,339 · 5,088 |
| BEAMS departments · schemes (collected, not displayed) | **none**                          | 33 · 524           |
| Open tenders, 21 portals, placed where evidence allows | 1,318 (nightly; ADR-067, ADR-068) | a stale subset     |
| Maharashtra agency notices (MHADA, MSIDC) · scan facts | **none**                          | 96 · 31 unreviewed |

The CAG corpus reached production on 6 October by `promote:cag` (ADR-070; dataset version 285).
Extraction and review still happen locally; review done after promotion is carried with
`promote:cag --refresh`. Sub-district and ULB geography has not been re-measured in production since
29 September.

## Built, but not recorded as live

Checked on 17 October 2026: `origin/main` is 0d8c2c9 (9 October 2026), which is what Vercel deploys
(ADR-020); `origin/development` is ahead of it with the rows marked "No" below, awaiting a release.
Work on unmerged feature branches is not listed here; it is added when it merges into `development`. Nothing in the repository records the migrations below as applied to production, or
the live deployment's commit; check with `migrate -- --status` and the Vercel dashboard.

| Capability                                                     | Decision                                                                           | Migration | Runbook                                                                     | On `main`?            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------- | --------------------- |
| Public bodies named from CAG pages, and the Body page          | [ADR-074](../adr/074-a-body-is-named-by-the-page-that-names-it.md)                 | 0045      | [`reviewing-public-bodies.md`](../16-operations/reviewing-public-bodies.md) | Yes                   |
| Correction requests from `/report`, received and never applied | [ADR-075](../adr/075-a-correction-is-received-never-applied.md)                    | 0046      | [`correction-requests.md`](../16-operations/correction-requests.md)         | Yes                   |
| Places named by audit pages                                    | [ADR-077](../adr/077-a-place-is-named-by-the-page-that-names-it.md)                | 0047      | [`reviewing-places.md`](../16-operations/reviewing-places.md)               | No — on `development` |
| A private preview of withheld material, for the operator only  | [ADR-078](../adr/078-a-private-preview-shows-withheld-material-to-the-operator.md) | —         | [`private-preview.md`](../16-operations/private-preview.md)                 | No — on `development` |
| A tender record answering what, where, who, how much and when  | [ADR-079](../adr/079-a-tender-is-a-record-that-answers-five-questions.md)          | 0048      | —                                                                           | No — on `development` |

"Built" includes the corrections form, which stays closed until the steps in its runbook are done.

## The code

| Part                                                                  | State                                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/web`                                                            | Deployed from `main`. Next.js App Router; serves the site and `/api/v1/*`                                     |
| `services/ingestion`                                                  | Real. LGD, OSM, CAG, BEAMS, GePNIC, MHADA and MSIDC collectors; review CLIs; `promote:cag`                    |
| `services/ocr`                                                        | Real (Python, FastAPI, Tesseract). Readings stored beside the page; scan facts are review-only (ADR-071, 072) |
| `services/api`                                                        | Real but not deployed; holds an in-memory fixture repository (audit B13)                                      |
| `services/{ai,analytics,entity-resolution,normalization,risk-engine}` | Empty skeletons                                                                                               |
| `packages/{config,utils,validation}`                                  | Empty placeholders (`.gitkeep` only)                                                                          |
| Tests                                                                 | 1,786 on 17 October: 1,429 pass and 357 skip without a database                                               |
| Migrations                                                            | 48 files, `0001`–`0048`; `main` has `0001`–`0046`                                                             |

Only the example project page (`/project/[id]`) renders fixture data, and it says so.

## Open items

| #   | Item                                                                                                                                                                                                                                                                                                                                                          | Blocks                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | **API contract P0 items** ([`11-api/client-api-contract.md`](../11-api/client-api-contract.md) §7). In the code: search, money as decimal strings, page anchors, a web rate tier. Not in the code: cursor pagination, an OpenAPI document, the mobile per-install rate tier                                                                                   | Researcher surfaces (export, API)       |
| 2   | **The execution-data gap — settled, not closed.** PMGSY/OMMAS is licence-blocked and not collected, so `Released − Utilized` has no input                                                                                                                                                                                                                     | Project-level Money Trail, indefinitely |
| 3   | **Permission requests are deferred** (7 October). Drafts exist and none is sent; restricted sources are built behind the publication gate and open only on a recorded grant plus a switch ([decision](../decisions/2026-10-07-permissions-deferred.md), [ADR-073](../adr/073-a-restricted-source-opens-on-a-recorded-grant-and-a-switch.md))                  | BEAMS figures, tender details, OMMAS    |
| 4   | Confirm self-hosted deployability is tested, not assumed ([ADR-011](../adr/011-web-framework.md))                                                                                                                                                                                                                                                             | —                                       |
| 5   | **A `data.gov.in` API key exists** (6 October); untested while the gateway was failing. `permission-requests.json` still records `dop-pincode-directory` as `credential_needed`                                                                                                                                                                               | Pincode placement; the Assam inspection |
| 6   | Pages are rendered per request (`force-dynamic`); revalidation by `datasetVersion` tag is not built, and the homepage revalidates hourly                                                                                                                                                                                                                      | Read cost at scale                      |
| 7   | Rotate the Neon owner password and other keys: recorded open on 6 October, not recorded as done                                                                                                                                                                                                                                                               | —                                       |
| 8   | **Release order.** Apply migrations 0047 and 0048 to production before `development` is released to `main`. The GePNIC loader now writes `tender.detail_fields` (0048) on every run, and the nightly sweep runs from `main`, so releasing first would make the sweep fail ([`16-operations/applying-migrations.md`](../16-operations/applying-migrations.md)) | The release of ADR-077 to ADR-079       |

Feature priorities and the milestone being worked on:
[`01-product/feature-priorities-2026-10-07.md`](../01-product/feature-priorities-2026-10-07.md)
(status: proposed; its M1 tasks have since landed as ADR-073 to ADR-076).
