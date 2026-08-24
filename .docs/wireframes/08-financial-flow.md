# Wireframes — Financial flow (S-28, S-29, S-30, S-30a)

## S-28 · Money Trail, full

```text
┌──────────────────────────────────────────────┐
│ ←  Money trail · ODR-14 Baramati             │
│    FY2024-25 ▾                               │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ALLOCATED                             │  │
│  │  ₹10.00 crore                          │  │
│  │  1 record · Budget Estimate            │  │
│  │  🔗 MH Finance — Demand for Grants     │  │
│  │     p.118 · digital · 100%             │  │
│  │                     See 1 record ▸     │  │
│  └──────────────┬─────────────────────────┘  │
│                 │                            │
│                 │  Allocation variance       │
│                 │  Allocated − Utilized      │
│                 │  ₹10.00 cr − ₹8.00 cr      │
│                 │  = ₹2.00 crore             │
│                 │  = 20.0% of the            │
│                 │    allocated amount   (?)  │
│                 │                            │
│  ┌──────────────┴─────────────────────────┐  │
│  │  RELEASED                              │  │
│  │  ₹9.00 crore                           │  │
│  │  1 instalment · 02 Nov 2024            │  │
│  │  🔗 MH Treasury — Releases             │  │
│  │     p.7 table 2 · camelot · 98%        │  │
│  │                    See 1 record ▸      │  │
│  └──────────────┬─────────────────────────┘  │
│                 │                            │
│                 │  Release variance          │
│                 │  Released − Utilized       │
│                 │  ₹9.00 cr − ₹8.00 cr       │
│                 │  = ₹1.00 crore             │
│                 │  = 11.1% of the            │
│                 │    released amount    (?)  │
│                 │                            │
│  ┌──────────────┴─────────────────────────┐  │
│  │  UTILIZED                              │  │
│  │  ₹8.00 crore                           │  │
│  │  1 record · 20 Feb 2025                │  │
│  │  🔗 MH PWD — Works                     │  │
│  │     p.42 table 3 · OCR · 82%  ⚠        │  │
│  │  ⚠ Extracted from a scanned document.  │  │
│  │    The value may contain an OCR error. │  │
│  │                    See 1 record ▸      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ◔ Needs verification                  │  │
│  │  Allocated ≥ Released ≥ Utilized holds.│  │
│  │  The 11.1% gap between released and    │  │
│  │  utilized exceeds the 10% threshold    │  │
│  │  for this category.               (?)  │  │
│  │                                        │  │
│  │  ⓘ This is an arithmetic observation.  │  │
│  │    It does not indicate that anything  │  │
│  │    is wrong.                           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Data as of 04 Aug 2026 · version 137        │
└──────────────────────────────────────────────┘
```

### Rules visible in this wireframe

- **Both variances**, each showing its **subtraction and its denominator in words**. Never a bare "11.1%".
- The low-confidence warning is in **words**, not just a chip — a chip does not survive a screenshot.
- The status block states *which* rule was checked and *which* threshold applied, so the reader can disagree with the threshold rather than the fact.
- Nothing is red. Nothing is a gauge.

## Incomplete chain — the `insufficient_data` state

```text
│  ┌────────────────────────────────────────┐  │
│  │  ALLOCATED     ₹10.00 crore         🔗 │  │
│  └──────────────┬─────────────────────────┘  │
│                 │  Allocation variance:      │
│                 │  cannot be calculated      │
│                 │  (no expenditure records)  │
│  ┌──────────────┴─────────────────────────┐  │
│  │  RELEASED      ₹9.00 crore          🔗 │  │
│  └──────────────┬─────────────────────────┘  │
│                 │  Release variance:         │
│                 │  cannot be calculated      │
│  ┌──────────────┴─────────────────────────┐  │
│  │  UTILIZED                              │  │
│  │  ▤ No expenditure records published    │  │
│  │    for FY2024-25.                      │  │
│  │                                        │  │
│  │    This does not mean no money was     │  │
│  │    spent — it means the record has     │  │
│  │    not been published or collected.    │  │
│  │                                        │  │
│  │    Expected source: MH PWD — Works     │  │
│  │    Last checked: 18 Aug 2026           │  │
│  └────────────────────────────────────────┘  │
│  ⊘ Insufficient data                         │
```

**Never `₹0`. Never a 100% variance against nothing.** This is `.docs/17-legal/legal-ethical-rules.md` rule 8, rendered.

## S-29 · Ledger lines   ·   S-30 · Line detail   ·   S-30a · Value history

```text
S-29                                S-30 (sheet)
┌────────────────────────────┐    ├────────────────────────────┤
│ ←  Releases · ODR-14       │    │            ────            │
├────────────────────────────┤    │  Release · instalment 1    │
│ 1 record · ₹9.00 cr total  │    │  ₹9.00 crore               │
├────────────────────────────┤    ├────────────────────────────┤
│ ┌────────────────────────┐ │    │  Date        02 Nov 2024   │
│ │ Instalment 1           │ │    │  Instalment  1 of 1        │
│ │            ₹9.00 crore │ │    │  Tender      MHT-2024-… ▸  │
│ │ 02 Nov 2024            │ │    │  Head        3054-04-337   │
│ │ MH Treasury         🔗 │ │    │  Version     v1 (current)  │
│ └────────────────────────┘ │    ├────────────────────────────┤
│                            │    │  🔗 MH Treasury — Releases │
│ ▤ No further releases      │    │     p.7 table 2            │
│   published for FY2024-25. │    │     camelot · 98%          │
│   Expected: MH Treasury    │    │     retrieved 30 Jul 2026  │
│   Last checked 18 Aug 2026 │    ├────────────────────────────┤
└────────────────────────────┘    │ [View document] [Lineage]  │
                                  │ [ Value history ]          │
                                  └────────────────────────────┘

S-30a — implements .docs/17-legal/legal-ethical-rules.md rule 9 (preserve historical versions)
┌──────────────────────────────────────────────┐
│ ←  Value history · Allocation                │
├──────────────────────────────────────────────┤
│  ● v3  ₹11.50 crore          current         │
│  │     Revised Estimate · 14 Feb 2026      🔗 │
│  │     MH Finance — Supplementary Demands     │
│  │                                            │
│  ● v2  ₹10.00 crore          superseded      │
│  │     Budget Estimate · 12 Aug 2024       🔗 │
│  │                                            │
│  ● v1  ₹ 9.20 crore          superseded      │
│        Budget Estimate (draft) · 02 Aug 24 🔗 │
├──────────────────────────────────────────────┤
│  Nothing is overwritten. Every published      │
│  version is kept with its own source.         │
└──────────────────────────────────────────────┘
```
