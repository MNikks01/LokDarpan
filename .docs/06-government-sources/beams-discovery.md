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

**`DEPT = H`.** Not stated in the export, so this is inferred and must be confirmed before display: of H's 992 rows for 2024-25, **413 are road, bridge or building schemes**, and its demands run H-02 to H-11.

H also carries buildings for other departments — Ayurveda, Forensic Science, Home Guards — which is consistent rather than contradictory: PWD constructs for the whole state government.

### Coverage, verified

`DepartmentExcelDownload_relasedFD.jsp?year=YYYY&dept=H`:

| FY   | rows  |     | FY   | rows |
| ---- | ----- | --- | ---- | ---- |
| 2017 | 1,004 |     | 2024 | 995  |
| 2019 | 829   |     | 2025 | 999  |
| 2021 | 843   |     | 2026 | 986  |
| 2023 | 974   |     |      |      |

**Ten financial years, ~9,500 rows for PWD alone**, one HTTP request per year.

## Open items

- **Department code → name mapping is not in the export.** `DepartmentExp111.jsp` returns an empty body to a GET; it may require a POST or different parameters. Until resolved, `H = Public Works` is an inference, and a department name must not be displayed on that basis.
- **Licence and terms of use** — not yet located. Required before display, and still outstanding for every source in this registry.
- Whether `S1`/`S2`/`S3` are quarterly instalments or something else. They are zero in most sampled rows.
- Whether the monthly export gives a within-year time series worth ingesting, or only a year-to-date cut.

## What this unblocks

The finance schema and the BEAMS connector. Maharashtra PWD becomes completable as **budget → allocation → release → expenditure, by scheme and object, across ten years** — with both variances computable from a single row.

It does not unblock tender, contractor or physical progress, which have no located source ([`gepnic-access-findings.md`](./gepnic-access-findings.md)).
