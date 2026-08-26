# BEAMS — the Maharashtra expenditure chain, and how to get it

**Date:** 2026-08-26 · **Host:** `beams.mahakosh.gov.in` · **Status:** PRODUCTION_READY for departmental budget→release→expenditure

Q3 established that BEAMS publishes expenditure without a login ([`sprint0-findings-q1-q3.md`](./sprint0-findings-q1-q3.md)) but noted the reports render asynchronously, so the response shape had to be established before a connector could be designed. This is that session.

## Access

`robots.txt`: **none served** on `beams.mahakosh.gov.in`. No stated restriction.

**No login, no CAPTCHA** on the public MIS at `/Beams5/BudgetMVC/MISRPT/`. Requests need a session cookie from the parent report page and a matching `Referer`; without them the drill-down endpoints return an empty body rather than an error.

## The endpoints

`DepartmentExp1.jsp` is a 4 KB shell — the data comes from a family of endpoints named in `js/DeptWise.js`. They form a drill-down:

**Department → Demand → Major Head → Scheme → Detail Head (object)**

| Endpoint                                  | Level                       |
| ----------------------------------------- | --------------------------- |
| `DepartmentExp111.jsp?month=&year=&type=` | all departments             |
| `DemandNumExp11.jsp?…&dept1=&deptnm1=`    | demands within a department |
| `MajorHeadExp111.jsp?…&demand_no1=`       | major heads                 |
| `SchemeWiseDeptExpAjx.jsp?…&mh=&mh_nm=`   | schemes                     |
| `DetailHeadExp1.jsp?…&scheme=&scheme_nm=` | objects                     |

There are parallel families for **revenue** (`DepartmentWiseRevenue1.jsp`) and **capital** (`DepartmentWiseCA1.jsp`) expenditure — the capital one matters for PWD, since roads and buildings are capital spend.

### The endpoints worth using

Bulk exports, not the drill-down:

| Endpoint                                                     | Returns                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `DepartmentExcelDownload.jsp?year=YYYY`                      | **every department, one financial year** — 18.8 MB, 21,028 rows for 2024-25 |
| **`DepartmentExcelDownload_relasedFD.jsp?year=YYYY&dept=X`** | **one department, one year** — ~1 MB, 19 columns                            |
| `DepartmentExcelDownload_month.jsp?year=&month=`             | monthly cut                                                                 |

`Content-Type: application/vnd.ms-excel`, filename `bds_report.xls`. The body is **HTML markup**, not a binary workbook — parse it as HTML, and note the markup is loose enough that a `<tr>…</tr>` regex under-counts badly. Split on the opening tag.

## The data

Nineteen columns, and they are the chain this platform exists to trace:

```
DEPT · DEMAND_NO · SCHEME_CODE · SCHEME_NM ·
BUDBOOK_SCHEMENM_ENGLISH · BUDBOOK_SCHEMENM_MARATHI ·
SCHEME_COMITTED · CHARGED_VOTED · OBJECT_CODE ·
BUDGET · S1 · S2 · S3 · RELEASED Dept. · EXPENDITURE · REAPP ·
Source of fund · Plan Type
```

**`BUDGET` → `RELEASED` → `EXPENDITURE` appear in the same row.** Both denominators for both required variances are present together, per scheme and object:

- release variance = `RELEASED − EXPENDITURE`
- allocation variance = `BUDGET − EXPENDITURE`

Scheme names come in **English and Marathi**, which matches the locale requirement without a translation step.

### The unit, which will silently corrupt every figure if missed

The header row states **`Amounts In Thousands`**, and values carry three decimals — `126579.000` means ₹12,65,79,000, not ₹126,579.

Conversion to the canonical `bigint` paise is therefore **× 100,000** (thousands → rupees → paise). A connector that treats the number as rupees understates every figure by three orders of magnitude while looking entirely plausible — the exact failure `.docs/05-data-model/database-design.md` requires money handling to prevent.

## Public Works Department

**`DEPT = H`.** Confirmed by the source on 2026-08-26: FY2024 rows carry `Plan Type = Gen_PWD`. The earlier inference is corroborated — of H's 992 rows for 2024-25, **413 are road, bridge or building schemes**, and its demands run H-02 to H-11.

H also carries buildings for other departments — Ayurveda, Forensic Science, Home Guards — which is consistent rather than contradictory: PWD constructs for the whole state government.

### Row counts, verified

`DepartmentExcelDownload_relasedFD.jsp?year=YYYY&dept=H`:

| FY   | rows  |     | FY   | rows |
| ---- | ----- | --- | ---- | ---- |
| 2017 | 1,004 |     | 2024 | 995  |
| 2019 | 829   |     | 2025 | 999  |
| 2021 | 843   |     | 2026 | 986  |
| 2023 | 974   |     |      |      |

**Ten financial years, ~9,500 rows for PWD alone**, one HTTP request per year.

## The expenditure column is not populated before FY2021 — do not display it

Established by ingesting all ten years (2026-08-26). Rows whose `EXPENDITURE` is zero:

| FY   |    zero | non-zero |     | FY   | zero | non-zero |
| ---- | ------: | -------: | --- | ---- | ---: | -------: |
| 2017 |     978 |       23 |     | 2022 |  321 |      623 |
| 2018 |     931 |       46 |     | 2023 |  313 |      658 |
| 2019 |     785 |       41 |     | 2024 |  351 |      641 |
| 2020 | **826** |   **13** |     | 2025 |  349 |      647 |
| 2021 |     246 |      594 |     | 2026 |  529 |      454 |

The change at FY2021 is a step, not a trend. Before it, the column is ~98% zero; after, ~65% of rows carry a figure.

Totalled, FY2020 reads **₹19,638 crore allocated against ₹24 crore spent**. Maharashtra's Public Works Department did not spend ₹24 crore in a year. The column is not recording expenditure in those years.

**The source publishes `0`, not an empty cell.** So the ledger stores zero — faithfully, and correctly, because rewriting a published figure would be editing a government record. But a zero here does not mean "nothing was spent", and a page rendering _"₹19,638 cr allocated, ₹24 cr spent"_ would make a false and damaging implication about a department.

**Consequence:** pre-FY2021 expenditure, and both variances derived from it, must not be displayed until this is resolved. This is a presentation gate, not a data fix. Candidate resolutions, in order of preference:

1. Establish from Maharashtra Finance what the column meant before FY2021 — it may be a system that only went live for expenditure capture in 2020-21.
2. Record per-source, per-year, per-field **coverage**, so the presentation layer can withhold a figure the source does not actually populate. This generalises: every source will have fields it publishes only for some years.
3. Corroborate against a second source (Finance Accounts, CAG) before showing any pre-FY2021 expenditure figure.

The observation is recorded here rather than patched away because "the source published a zero it did not mean" is exactly the class of defect this registry exists to catch, and the next source will have its own version of it.

## Open items

- **Department code → name mapping is not in the export.** `DepartmentExp111.jsp` returns an empty body to a GET; it may require a POST or different parameters. Until resolved, `H = Public Works` is an inference, and a department name must not be displayed on that basis.
- **Coverage of `EXPENDITURE` before FY2021** — see above. Blocks display of those years.
- **Licence and terms of use** — not yet located. Required before display, and still outstanding for every source in this registry.
- Whether `S1`/`S2`/`S3` are quarterly instalments or something else. They are zero in most sampled rows.
- Whether the monthly export gives a within-year time series worth ingesting, or only a year-to-date cut.

## What this unblocks

The finance schema and the BEAMS connector. Maharashtra PWD becomes completable as **budget → allocation → release → expenditure, by scheme and object, across ten years** — with both variances computable from a single row.

It does not unblock tender, contractor or physical progress, which have no located source ([`gepnic-access-findings.md`](./gepnic-access-findings.md)).
