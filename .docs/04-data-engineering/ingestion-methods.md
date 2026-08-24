# Ingestion Method Analysis

> How each source class would have to be collected, and what that means for `.docs/04-data-engineering/data-collection-architecture.md`.

Verified 21 August 2026.

## Method by source class (§24)

| Source class | Method | Notes |
|---|---|---|
| data.gov.in | **API** | Only confirmed general-purpose API. Per-dataset assessment still needed |
| LGD | **Download + API** | State/district downloads; NAPIX API is registration-gated |
| CPPP / GePNIC portals | **HTML scraping** | Server-rendered; predictable page structure |
| Non-GePNIC state portals | **HTML scraping, bespoke per state** | 6+ distinct platforms |
| Budget documents | **PDF extraction** (Camelot/pdfplumber) | `.docs/04-data-engineering/data-collection-architecture.md`'s existing design applies |
| CAG reports | **PDF extraction + manual review** | Narrative documents; findings are not tabular |
| State department sites | **HTML + PDF** | Mixed |
| GeM, PFMS | **Partial / blocked** | Authenticated flows; only public surfaces ingestable |
| IGOD | **HTML scraping** | Already done — this registry's backbone |

## The GePNIC advantage

The most useful engineering finding of this pass: **most State/UT procurement portals share one platform and one page structure.**

Observed on the Goa, Madhya Pradesh, PMGSY and central instances:

```text
/nicgep/app?page=FrontEndTendersByOrganisation&service=page
/nicgep/app?page=FrontEndTendersByClassification&service=page
/nicgep/app?page=FrontEndListTendersbyDate&service=page
/nicgep/app?page=WebTenderStatusLists&service=page
/nicgep/app?page=StandardBiddingDocuments&service=page
```

Roughly 28 of 36 State/UT portals are GePNIC deployments. **One connector, parameterised by base URL, could serve most of India's state procurement data** — with bespoke connectors for Gujarat (nProcure), Andhra Pradesh, Telangana, Karnataka, Bihar, Chhattisgarh, and the two SPPP portals (Assam, Rajasthan).

This maps directly onto `.docs/04-data-engineering/data-collection-architecture.md`'s declarative YAML source registry: one `gepnic` connector type plus per-state config, rather than 36 connectors.

**Caveat:** the page *structure* is shared; the **fields exposed** may still differ by deployment, and none has been field-verified.

## Scraping constraints (§24 — binding)

`.docs/17-legal/legal-ethical-rules.md` requires honouring access terms; `.docs/04-data-engineering/data-collection-architecture.md` requires polite, scheduled collection. Nothing in this pass changes that, and two rules are absolute:

- **No CAPTCHA is to be bypassed.** Where one gates access, use an official download/API route or do not ingest.
- **No authentication is to be circumvented.** Only public, non-authenticated pages.

Not yet established for any portal, and required before writing a connector:

- `robots.txt` contents and crawl-delay
- Terms of use
- Rate limits
- CAPTCHA presence and placement
- Whether pages are server-rendered or require JS (GePNIC appeared server-rendered)
- Pagination mechanics
- Document download behaviour

**IGOD's own `robots.txt` and terms were not checked before this registry's crawl.** That crawl was modest (~1,000 requests, 6 concurrent, retried politely), but the check should have preceded it and must precede any repeat. Recorded as a process gap.

## Document formats expected (§19)

| Format | Where | OCR needed |
|---|---|---|
| HTML | Portals, department sites | No |
| PDF (digital) | Budgets, CAG reports, government orders | No — table extraction |
| PDF (scanned) | Expected in state/local documents | **Yes** — none confirmed yet |
| XLS/XLSX | Budget annexes | No |
| CSV/JSON | data.gov.in, LGD, NDAP | No |
| GIS | Bhuvan, Bharat Maps, MRSAC | Format-specific |

**No scanned PDF was confirmed in this pass.** `.docs/04-data-engineering/data-collection-architecture.md`'s OCR pipeline is likely still needed — state and local-body documents are where scans typically appear — but this is an expectation, not a verified finding.

## Historical data (§25)

Largely **unknown**. Confirmed only:

- **LGD** — historical modification tracking with government-order documentation ✅
- **India Budget** — annual documents, historically published ✅
- **CAG** — reports published over many years ✅
- Procurement portals — archived tenders **not verified on any portal**

Since `.docs/01-product/prd.md` names historical comparison as a core capability, archive depth per procurement portal is a priority question for the next phase.

## Update frequency (§26)

Confirmed: India Budget **annual**; CGA monthly accounts **monthly**. Everything else **unknown** — not assessed.

## Recommended ingestion order

1. **LGD** — the place spine. Highest confidence, unblocks `admin_unit`.
2. **One GePNIC portal, field-verified end to end** (Maharashtra) — establishes the connector template and the real tender field set.
3. **CPPP awards + debarment** — the contractor surface.
4. **India Budget + Maharashtra finance/BEAMS** — the money-in side.
5. **OMMAS**, *if verification succeeds* — potentially closes the execution gap.
6. Remaining GePNIC states via the parameterised connector.
7. Non-GePNIC states, bespoke.
