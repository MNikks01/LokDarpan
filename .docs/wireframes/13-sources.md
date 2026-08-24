# Wireframes — Sources & traceability (S-52 – S-57)

## S-52 · Source sheet — the most-used surface in the product

Reachable from **every figure**, in one tap, with **zero network latency** (provenance is embedded, never fetched).

```text
├──────────────────────────────────────────────┤
│                    ────                  ✕   │
│                                              │
│  Utilized                                    │
│  ₹8.00 crore                                 │  ← repeated, so the sheet is
│                                              │     self-contained in a screenshot
│  ──────────────────────────────────────────  │
│                                              │
│  Maharashtra PWD — Works                     │
│  Government of Maharashtra,                  │
│  Public Works Department · State source      │
│                                              │
│  Page 42, table 3                            │
│  Read by OCR (Tesseract) · confidence 82%    │
│                                              │
│  ⚠ Extracted from a scanned document.        │
│    The value may contain an OCR error.       │
│                                              │
│  Retrieved     30 Jul 2026                   │
│  Published     01 Dec 2025                   │
│  Record        v3 · dataset v137             │
│  Licence       Government Open Data          │
│  Matched to this project by work ID          │
│  (exact match)                               │
│                                              │
│  ┌──────────────────┐ ┌───────────────────┐  │
│  │ View document    │ │ Open original ↗   │  │
│  │ (page 42)        │ │                   │  │
│  └──────────────────┘ └───────────────────┘  │
│  [ View lineage ]  [ Report a data issue ]   │
└──────────────────────────────────────────────┘
```

### Variants

```text
LOW LINKAGE CONFIDENCE (the more serious warning)
│  ⚠ This record was matched to this project   │
│    by name similarity (0.78). It may belong  │
│    to a different work.                      │
│    [ How matching works ]                    │

OFFLINE
│  ⚡ You're offline. Full source details are  │
│    shown; the document itself needs a        │
│    connection.                               │
│    [ Download when online ]                  │

DEAD PUBLISHER URL
│  ⓘ The publisher's copy is no longer         │
│    reachable at its published URL.           │
│    [ View our archived copy ]                │
│    sha256 4f3a…c19 · retrieved 30 Jul 2026   │
```

## S-54 · Document viewer — extracted value first, page second

```text
┌──────────────────────────────────────────────┐
│ ✕  MH PWD — Works                        ⇧   │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ THIS IS THE FIGURE WE READ             │  │
│  │ Utilized  ₹8.00 crore                  │  │
│  │ from page 42, table 3                  │  │
│  │ by OCR (Tesseract) at 82% confidence   │  │
│  │ Raw cell: "८,००,००,०००"                 │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░ महाराष्ट्र सार्वजनिक बांधकाम विभाग ░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░ Work ID │ Sanctioned │ Expenditure ░░░░  │
│  ░░ ────────┼────────────┼──────────── ░░░░  │
│  ░░ PUN-1408│ १०,००,००,००० │▓८,००,००,०००▓░░░  │  ← highlighted region
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                              │
├──────────────────────────────────────────────┤
│  ‹      Page 42 of 380      ›     Jump to ▾  │
│  [ Download full document (78 MB) ]          │
└──────────────────────────────────────────────┘
```

**The extracted-value card comes before the page.** Dropping a user onto page 42 of a 380-page scanned Marathi PDF with no orientation guarantees confusion, and invites them to conclude the app is wrong when they cannot find the number.

Only page 42 is fetched (HTTP `Range`) — the 78 MB total is stated, never downloaded to render one page.

## S-55 · Lineage

```text
┌──────────────────────────────────────────────┐
│ ←  Where this number comes from              │
├──────────────────────────────────────────────┤
│  ₹8.00 crore · Utilized                      │
│  Upgradation of ODR-14 · FY2024-25           │
├──────────────────────────────────────────────┤
│  ①  SOURCE                                   │
│  │  MH PWD — Works, p.42 table 3          🔗 │
│  │  published 01 Dec 2025                    │
│  │  retrieved 30 Jul 2026                    │
│  │  sha256 4f3a…c19                          │
│  │                                           │
│  ②  EXTRACTION                               │
│  │  OCR (Tesseract, Devanagari)              │
│  │  confidence 0.82                          │
│  │  raw cell "८,००,००,०००" → 80000000        │
│  │  checks passed: digit grouping,           │
│  │  crore/lakh consistency                   │
│  │                                           │
│  ③  NORMALIZATION                            │
│  │  unit → ₹ · FY → FY2024-25                │
│  │  linked to project 501 via work ID        │
│  │  PWD-PUN-2024-1408 (exact match)          │
│  │                                           │
│  ④  VERSION                                  │
│  │  record v3 · dataset v137                 │
│  │  supersedes v2 (₹7.40 cr, 12 Mar 2026) ▸  │
│  │                                           │
│  ⑤  USED BY                                  │
│     Release variance (R−U)                ▸  │
│     Allocation variance (A−U)             ▸  │
│     Cost per km                           ▸  │
│     Verification priority · variance      ▸  │
├──────────────────────────────────────────────┤
│  [ Report a data issue ]                     │
└──────────────────────────────────────────────┘
```

Step ⑤ is the reverse index — _which conclusions rest on this number?_ It is what an auditor actually needs, and what makes a correction's impact visible.

## S-56 · Source registry · S-57 · Methodology

```text
S-56                                S-57 (sheet)
┌────────────────────────────┐   ├────────────────────────────┤
│ ←  Where our data comes    │   │            ────            │
│    from                    │   │  Release variance          │
├────────────────────────────┤   ├────────────────────────────┤
│ Only official government   │   │  WHAT IT IS                │
│ sources. Never news,       │   │  The difference between    │
│ social media, or           │   │  money released and money  │
│ third-party sites.         │   │  recorded as spent.        │
├────────────────────────────┤   │                            │
│ STATE — MAHARASHTRA        │   │  HOW IT'S CALCULATED       │
│ ┌────────────────────────┐ │   │  Released − Utilized       │
│ │ MH PWD — Works       ▸ │ │   │  ₹9.00 cr − ₹8.00 cr       │
│ │ ✓ healthy              │ │   │    = ₹1.00 crore           │
│ │ API · Govt Open Data   │ │   │                            │
│ │ last fetch 30 Jul 2026 │ │   │  As a percentage of the    │
│ │ 18,442 records         │ │   │  RELEASED amount:          │
│ ├────────────────────────┤ │   │  1.00 ÷ 9.00 × 100 = 11.1% │
│ │ MH Treasury          ▸ │ │   │                            │
│ │ ⚠ no update in 94 days │ │   │  WHAT IT DOES NOT MEAN     │
│ │ PDF · last 18 May 2026 │ │   │  A gap does not indicate   │
│ ├────────────────────────┤ │   │  that money is missing or  │
│ │ Mahatenders          ▸ │ │   │  misused. Money can be     │
│ │ ✓ healthy              │ │   │  released and spent in     │
│ └────────────────────────┘ │   │  different periods, or     │
│ CENTRAL ⋯                  │   │  the expenditure record    │
└────────────────────────────┘   │  may not be published yet. │
                                 │                            │
                                 │  Source: .docs/07-analytics/analytics-engine.md §1        │
                                 └────────────────────────────┘
```

S-56 shows a source that has not updated in 94 days. **That gap is itself a fact a journalist can use**, and hiding it would be inconsistent with everything else the product claims.

S-57's "What it does not mean" section is mandatory on every derived metric — it is where the app pre-empts the misreading it most fears.
