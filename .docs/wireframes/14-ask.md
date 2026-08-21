# Wireframes — Ask (S-58 – S-61)

## S-58 · Composer — scope is always visible and always bound

```text
┌──────────────────────────────────────────────┐
│ ←  Ask                                   ⋯   │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ Pune district · rural roads · FY2024-25│  │  ← immutable here;
│  │                             Change ▸   │  │     changed deliberately
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│                                              │
│  Answers come only from official records     │
│  LokDarpan has collected, and always cite    │
│  their source.                               │
│                                              │
│  TRY ASKING                                  │
│  ▸ How much was allocated vs utilized?       │
│  ▸ Which projects cost most per km?          │
│  ▸ Where are records missing?                │
│  ▸ How has spending changed since 2021?      │
│                                              │
│                                              │
│  3 questions left today              (?)     │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────┐ ┌────────┐  │
│ │ Ask about these records…     │ │  Ask   │  │
│ └──────────────────────────────┘ └────────┘  │
└──────────────────────────────────────────────┘
```

## Streaming — the retrieval steps are named

```text
┌──────────────────────────────────────────────┐
│  You asked                                   │
│  How much was allocated vs utilized?         │
├──────────────────────────────────────────────┤
│  ⟳ Reading 41 official records for           │
│    Pune district…                            │
│  ⟳ Checking figures against sources…         │
│                                              │
│  For rural roads in Pune district            │
│  (FY2024-25), ingested official records▌     │
└──────────────────────────────────────────────┘
```

Naming the steps is not decoration — it tells the user the answer is being assembled **from records**, which is the entire trust proposition, and it is the honest description of what the pipeline does.

## Answer

```text
┌──────────────────────────────────────────────┐
│ ←  Ask                                   ⇧   │
├──────────────────────────────────────────────┤
│  Pune district · rural roads · FY2024-25     │
├──────────────────────────────────────────────┤
│  You asked                                   │
│  How much was allocated vs utilized?         │
├──────────────────────────────────────────────┤
│  For rural roads in Pune district            │
│  (FY2024-25), ingested official records      │
│  show ₹412.00 crore allocated¹ and           │
│  ₹361.40 crore utilized². The utilized       │
│  amount is 12.3% below the released          │
│  amount³. Records for 3 of 14 talukas are    │
│  not present in the ingested sources⁴.       │
│                                              │
│  FIGURES USED                                │
│  ┌────────────────────────────────────────┐  │
│  │ Allocated   ₹412.00 crore           🔗 │  │
│  │ Released    ₹412.20 crore           🔗 │  │
│  │ Utilized    ₹361.40 crore           🔗 │  │
│  │ Deviation   12.3%              (?)     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  SOURCES (4)                             ▸   │
│  MH Finance — Demand for Grants p.118     🔗 │
│  MH PWD — Works (API)                     🔗 │
│  MH Treasury — Releases p.7               🔗 │
│  Coverage record · Pune FY2024-25         🔗 │
│                                              │
│  ⓘ Answer restricted to ingested official    │
│    figures. No cause for any difference is   │
│    inferred.                                 │
│                                              │
│  Data as of 04 Aug 2026 · version 137        │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────┐ ┌────────┐  │
│ │ Ask another…                 │ │  Ask   │  │
│ └──────────────────────────────┘ └────────┘  │
└──────────────────────────────────────────────┘
```

Every number in the prose is a `<Figure>` — **tappable to its source**, not plain text. An answer with zero citations is dropped client-side and replaced by the deterministic template summary.

## Refusal — a designed state, not an error

```text
┌──────────────────────────────────────────────┐
│  You asked                                   │
│  Who is responsible for the delay?           │
├──────────────────────────────────────────────┤
│                                              │
│  No ingested official records cover this.    │
│                                              │
│  LokDarpan answers only from official        │
│  records it has collected, and does not      │
│  infer causes or attribute responsibility.   │
│                                              │
│  What the records do show for this project:  │
│  ▸ Progress and its published dates          │
│  ▸ The release and expenditure figures       │
│                                              │
│  [ What we cover ]  [ Browse the records ]   │
└──────────────────────────────────────────────┘
```

No apology, no "I can't help with that", no retry-the-same-question button. It states the boundary and offers what *is* available.

## S-59 · Citations   ·   S-60 · History   ·   Offline

```text
S-59                             S-60                          OFFLINE
┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
│ ←  Sources for this    │   │ ←  Your questions      │   │ ⚡ Ask needs a          │
│    answer              │   ├────────────────────────┤   │   connection            │
├────────────────────────┤   │ Stored on this device  │   │                        │
│ ¹ Allocated ₹412.00 cr │   │ only. Never sent to    │   │ Answers are built from │
│   MH Finance — Demand  │   │ anyone.       Clear ▸  │   │ live official records, │
│   for Grants, p.118    │   ├────────────────────────┤   │ so they can't be       │
│   camelot · 98%     🔗 │   │ TODAY                  │   │ generated offline.     │
│   [ View document ]    │   │ How much was allocated │   │                        │
│ ────────────────────── │   │ vs utilized?         ▸ │   │ [ Your past answers ]  │
│ ² Utilized ₹361.40 cr  │   │ Pune district          │   └────────────────────────┘
│   MH PWD — Works       │   │ ────────────────────── │
│   API · 100%        🔗 │   │ Which projects cost    │
│ ────────────────────── │   │ most per km?         ▸ │
│ ⋯                      │   └────────────────────────┘
└────────────────────────┘
```

`⋯` menu on S-58: Change scope · Copy answer · Share (figures + link, **never the AI text**) · Report a problem with this answer · Clear history.
