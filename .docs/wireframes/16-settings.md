# Wireframes — Profile, settings, legal (S-66 – S-80)

## S-68 · Settings

```text
┌──────────────────────────────────────────────┐
│ ←  Settings                                  │
├──────────────────────────────────────────────┤
│  You're using LokDarpan anonymously.      ▸  │
│  No account needed.                          │
├──────────────────────────────────────────────┤
│  Language              English            ▸  │
│  Appearance            System              ▸ │
│  Your area             Pune district       ▸ │
├──────────────────────────────────────────────┤
│  Data & storage        156 MB              ▸ │
│  Notifications         On for 3 items      ▸ │
│  Accessibility                             ▸ │
│  Privacy & usage data                      ▸ │
├──────────────────────────────────────────────┤
│  How our data is collected                 ▸ │
│  Where our data comes from                 ▸ │
│  What we cover (and don't)                 ▸ │
├──────────────────────────────────────────────┤
│  About LokDarpan                           ▸ │
│  Neutrality & legal                        ▸ │
│  Privacy policy                            ▸ │
│  Open-source licences                      ▸ │
├──────────────────────────────────────────────┤
│  Report a data issue                       ▸ │
│  Send feedback                             ▸ │
│  Replay the introduction                   ▸ │
├──────────────────────────────────────────────┤
│  Version 1.0.0 (build 142)                   │
│  Data version 137 · 04 Aug 2026              │
└──────────────────────────────────────────────┘
```

## S-73 · About — the non-affiliation statement

```text
┌──────────────────────────────────────────────┐
│ ←  About LokDarpan                           │
├──────────────────────────────────────────────┤
│  लोकदर्पण — the people's mirror               │
│                                              │
│  LokDarpan compiles official government       │
│  financial and infrastructure records into    │
│  a single, source-linked view and checks      │
│  them for mathematical consistency.           │
│                                              │
│  ⚠ NOT A GOVERNMENT APP                      │
│  LokDarpan is an independent public-interest  │
│  project. It is not affiliated with,          │
│  endorsed by, or operated by any government   │
│  body, agency, or political party.            │
│                                              │
│  It does not investigate, accuse, or make     │
│  legal findings. Every number links to its    │
│  official source. A difference or gap shown   │
│  here means the DATA warrants a closer look   │
│  — it is not a claim of wrongdoing by any     │
│  person or organization.                      │
├──────────────────────────────────────────────┤
│  Currently covering                          │
│  Maharashtra · Roads & transportation        │
│  FY2021-22 to FY2024-25              (?)  ▸  │
├──────────────────────────────────────────────┤
│  Open source                              ▸  │
│  Our methodology                          ▸  │
│  Our sources                              ▸  │
└──────────────────────────────────────────────┘
```

The non-affiliation block is required for app-store review and for basic honesty — a citizen must not mistake this for an official government service.

## S-74 · Neutrality & legal · S-75 · Privacy

```text
S-74 (.docs/17-legal/legal-ethical-rules.md, verbatim, non-collapsible)   S-75
┌────────────────────────────┐   ┌────────────────────────────┐
│ ←  Neutrality & legal      │   │ ←  Privacy                 │
├────────────────────────────┤   ├────────────────────────────┤
│ WHAT WE DO                 │   │ WHAT WE NEVER COLLECT      │
│ Present facts, calculations│   │ ✕ What you search for      │
│ and neutral comparisons    │   │ ✕ What you ask             │
│ from official records.     │   │ ✕ What you look at         │
│                            │   │ ✕ Where you are            │
│ WHAT WE NEVER DO           │   │ ✕ Your name or email       │
│ ✕ Accuse any individual    │   │ ✕ Your contacts or photos  │
│ ✕ Infer corruption or      │   │ ✕ An advertising ID        │
│   wrongdoing               │   ├────────────────────────────┤
│ ✕ Make legal statements    │   │ ON THIS DEVICE ONLY        │
│ ✕ Show a figure without    │   │ Saved items · watchlist ·  │
│   its source               │   │ search history · questions │
│ ✕ Impute a cause for a     │   │ [ Clear all ]              │
│   difference               │   ├────────────────────────────┤
├────────────────────────────┤   │ WHAT WE DO COLLECT         │
│ OUR LANGUAGE               │   │ Anonymous counts: screens  │
│ ✓ "Budget deviation        │   │ opened, whether searches   │
│   detected"                │   │ returned results, whether  │
│ ✕ "Money was stolen"       │   │ errors occurred. Bucketed, │
│ ✓ "Records are missing     │   │ with no identity attached. │
│   for this period"         │   │           [ Usage data ●─ ]│
│ ✕ "They hid the money"     │   ├────────────────────────────┤
├────────────────────────────┤   │ LOCATION                   │
│ EVERY NUMBER IS TRACEABLE  │   │ Used to find nearby records│
│ Source · extraction method │   │ for that search only. Never│
│ · confidence · date · and  │   │ stored, never linked to    │
│ every earlier version.     │   │ you.                       │
├────────────────────────────┤   └────────────────────────────┘
│ [ Report a data issue ]    │
└────────────────────────────┘
```

## S-76 Methodology · S-77 Coverage · S-78 Report an issue

```text
S-77                                S-78
┌────────────────────────────┐   ┌────────────────────────────┐
│ ←  What we cover           │   │ ←  Report a data issue     │
├────────────────────────────┤   ├────────────────────────────┤
│ COVERED TODAY              │   │ About                      │
│ ✓ Maharashtra              │   │ Upgradation of ODR-14   ✕  │
│ ✓ Roads & transportation   │   │ Utilized ₹8.00 crore    ✕  │
│ ✓ FY2021-22 – FY2024-25    │   ├────────────────────────────┤
├────────────────────────────┤   │ What looks wrong?          │
│ NOT YET COVERED            │   │ ○ The figure is incorrect  │
│ ○ Other states             │   │ ○ It's linked to the wrong │
│ ○ Health, education, water │   │   project                  │
│ ○ Most local-body accounts │   │ ○ The source link is broken│
├────────────────────────────┤   │ ○ A record is missing      │
│ WHY DATA MAY BE MISSING    │   │ ○ Something else           │
│ We can only show what has  │   ├────────────────────────────┤
│ been published. A missing  │   │ Tell us more (optional)    │
│ record means it hasn't     │   │ ┌────────────────────────┐ │
│ been published, or hasn't  │   │ │                        │ │
│ been collected yet — not   │   │ └────────────────────────┘ │
│ that nothing happened.     │   │ Email (optional)           │
├────────────────────────────┤   ├────────────────────────────┤
│ [ Our sources ]            │   │ ⓘ Corrections are made by  │
│ [ Our expansion plan ]     │   │   re-collecting from the   │
└────────────────────────────┘   │   source. Every correction │
                                 │   is versioned and logged. │
                                 │ [ Send ]                   │
                                 └────────────────────────────┘
```

S-78 works offline — the report queues in SQLite with an idempotency key and sends on reconnect, with the user told it is queued.

## S-70 Data & storage · S-71 Notifications · S-72 Accessibility

```text
S-70                          S-71                          S-72
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ ←  Data & storage  │   │ ←  Notifications   │   │ ←  Accessibility   │
├────────────────────┤   ├────────────────────┤   ├────────────────────┤
│ 156 MB total       │   │ Updates      [●─]  │   │ Reduce motion [─○] │
│ Offline areas 34MB▸│   ├────────────────────┤   │ Increase          │
│ Documents   118MB▸ │   │ TELL ME WHEN       │   │ contrast      [─○] │
│ Saved items  4.2MB▸│   │ ☑ A figure changes │   │ Larger touch      │
│ Cache        18MB  │   │ ☑ A new record is  │   │ targets       [─○] │
├────────────────────┤   │   published        │   │ Show data as      │
│ ☑ Wi-Fi only       │   │ ☐ Status changes   │   │ lists, not        │
│ ☑ Reduce data use  │   │ ☐ Values revised   │   │ charts        [─○] │
│   (fewer images,   │   │ ☐ New observations │   │ Prefer list over  │
│   no prefetch)     │   │   (count only)     │   │ map           [─○] │
├────────────────────┤   ├────────────────────┤   ├────────────────────┤
│ [ Clear cache ]    │   │ Quiet hours        │   │ Text size follows  │
│ [ Clear history ]  │   │ 21:00 – 08:00    ▸ │   │ your device        │
│ ⓘ Neither removes  │   ├────────────────────┤   │ setting.           │
│   saved items.     │   │ ⓘ We check in the  │   │ Open device        │
└────────────────────┘   │   background. Your │   │ settings         ▸ │
                         │   watched items    │   └────────────────────┘
                         │   never leave this │
                         │   device.      (?) │
                         └────────────────────┘
```
