# Wireframes — Procurement (S-40 – S-44)

## S-40 · Tender detail

```text
┌──────────────────────────────────────────────┐
│ ←  Tender MHT-2024-PUN-8841              ⋮   │
├──────────────────────────────────────────────┤
│  Upgradation of ODR-14, Baramati             │
│  Public Works Department · Pune              │
│  Awarded                                     │
├──────────────────────────────────────────────┤
│  Estimated cost      ₹9.80 crore          🔗 │
│  Awarded amount      ₹9.40 crore          🔗 │
│  Difference          ₹0.40 crore below       │
│                      the estimate       (?)  │
│                                              │
│  Bidders             4                    🔗 │
│  Published           02 Sep 2024          🔗 │
│  Awarded             18 Oct 2024          🔗 │
├──────────────────────────────────────────────┤
│  AWARDED TO                                  │
│  ABC Infra Pvt Ltd                        ▸  │
│  Class I-A                                   │
├──────────────────────────────────────────────┤
│  PROJECT                                     │
│  Upgradation of ODR-14, Baramati          ▸  │
├──────────────────────────────────────────────┤
│  SOURCE                                      │
│  Mahatenders — Award records              🔗 │
│  retrieved 30 Jul 2026                       │
├──────────────────────────────────────────────┤
│  ⓘ These are the published award records.    │
│    LokDarpan does not assess the tender      │
│    process or the parties involved.          │
└──────────────────────────────────────────────┘
```

"₹0.40 crore below the estimate" is stated as arithmetic. The app never characterises a bid as low, aggressive, or suspicious.

## S-42 · Contractor detail — the most constrained screen in the app

```text
┌──────────────────────────────────────────────┐
│ ←  ABC Infra Pvt Ltd                     ⋮   │
├──────────────────────────────────────────────┤
│  ⓘ This page shows published award records   │
│    and standard market statistics. It is     │
│    NOT an assessment of this organization,   │
│    and contains no score or ranking.         │
├──────────────────────────────────────────────┤
│  Class I-A                                🔗 │
│  Registration  MH/PWD/CL1/2019/4412       🔗 │
├──────────────────────────────────────────────┤
│  NAMES MERGED INTO THIS RECORD               │
│  "ABC Infra"                   match 0.94    │
│  "A.B.C. Infra P. Ltd"         match 0.91    │
│  "ABC Infrastructure Pvt Ltd"  match 0.88    │
│                                              │
│  ⓘ Names in official records vary. These     │
│    variants were merged automatically.       │
│    If a merge looks wrong, tell us.          │
│  [ How merging works ]  [ Report an issue ]  │
├──────────────────────────────────────────────┤
│  AWARD RECORDS                               │
│  Tenders awarded     12                   🔗 │
│  Total awarded       ₹64.00 crore         🔗 │
│  Average bidders     4.2                     │
│  Period              FY2021-22 – FY2024-25   │
│                          See all 12 ▸        │
├──────────────────────────────────────────────┤
│  SHARE OF TENDER VALUE IN A SCOPE             │
│  Baramati taluka · FY2024-25                 │
│  34.0% of road tender value               (?)│
│                                              │
│  ⓘ A statistic about the taluka's tender     │
│    market, not a characteristic of this      │
│    organization.                        ▸    │
├──────────────────────────────────────────────┤
│  Data as of 04 Aug 2026 · version 137        │
└──────────────────────────────────────────────┘
```

### What is deliberately absent

**No verification-priority score. No risk band. No severity badge. No flag, colour-coding, warning icon, or ranking.** `.docs/08-risk/risk-scoring-engine.md`: _"Never rank people by risk."_ The concentration statistic is framed as belonging to the taluka, not to the firm, and this omission is recorded in `.docs/05-data-model/screen-data-matrix.md` §3 so it stays visible and auditable rather than being "fixed" later by a component reuse.

The alias block with its match scores is the transparency mechanism for canonicalization — merging two different firms is a serious error, and a reader must be able to check it.

## S-43 · Contractor tenders · S-44 · Concentration

```text
S-43                                S-44
┌────────────────────────────┐   ┌────────────────────────────┐
│ ←  Awards (12)             │   │ ←  Tender concentration    │
├────────────────────────────┤   ├────────────────────────────┤
│ ABC Infra Pvt Ltd          │   │ Baramati taluka · FY2024-25│
│ ₹64.00 cr across FY21–FY25 │   │ Road tenders               │
├────────────────────────────┤   ├────────────────────────────┤
│ ┌────────────────────────┐ │   │ Total awarded ₹142.60 cr 🔗│
│ │ MHT-2024-PUN-8841    ▸ │ │   │ Contractors    9           │
│ │ ODR-14 upgradation     │ │   ├────────────────────────────┤
│ │ ₹9.40 cr · 4 bidders   │ │   │ SHARE OF VALUE             │
│ │ 18 Oct 2024         🔗 │ │   │ ████████░░ ABC Infra 34.0% │
│ ├────────────────────────┤ │   │ █████░░░░░ XYZ Const 18.2% │
│ │ MHT-2023-PUN-6612    ▸ │ │   │ ███░░░░░░░ PQR Ltd    8.9% │
│ │ ₹6.20 cr · 6 bidders   │ │   │ ⋯ 6 others           38.9% │
│ └────────────────────────┘ │   ├────────────────────────────┤
│ ⋯ (cursor-paged)           │   │ Top 3 share      61.1%     │
└────────────────────────────┘   │ HHI              2,140     │
                                 │ Moderate concentration     │
                                 ├────────────────────────────┤
                                 │ ⓘ HHI is a standard measure│
                                 │   of market concentration  │
                                 │   used by economists and   │
                                 │   competition regulators.  │
                                 │   Under 1,500 low ·        │
                                 │   1,500–2,500 moderate ·   │
                                 │   over 2,500 high.         │
                                 │                            │
                                 │   Concentration can arise  │
                                 │   from many causes,        │
                                 │   including how few firms  │
                                 │   are qualified to bid in  │
                                 │   an area. It is a         │
                                 │   description of a market, │
                                 │   not a finding.           │
                                 │ [ How HHI is calculated ](?)│
                                 └────────────────────────────┘
```

The bars are neutral fills, alphabetically stable, with no colour-coding of "large" shares.
