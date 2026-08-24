# Project Monitoring & Execution Sources

> The question this file answers: **can we get from a tender to a completed asset with a final cost?**
>
> A procurement portal tells us a contract was awarded. It does not tell us whether the work happened. That gap is the single biggest risk to the LokDarpan ledger.

Verified 21 August 2026.

## The chain, assessed (§33)

`.docs/00-overview/platform-overview.md` defines the platform's spine. Each link is classified by what the sources reviewed in this pass can actually support.

| # | Link | Status | Best identified source | Evidence |
|---|---|---|---|---|
| 1 | Budget | **AVAILABLE** | India Budget Portal ✅; State finance departments ✅ | Union budget documents published annually as PDF/XLS |
| 2 | Allocation | **PARTIALLY_AVAILABLE** | Demand for Grants ✅; MH **BEAMS** ✅ (state-level) | Union-level available as documents. Sub-state allocation depends on state budget/allocation systems, only one of which (Maharashtra BEAMS) has been located |
| 3 | Scheme | **AVAILABLE** | PFMS 🔍; scheme portals ✅ | Scheme identity and codes exist; PFMS is the fund-flow spine |
| 4 | Project / work | **UNKNOWN** | PMGSY **OMMAS** 🔍; state works-MIS — *not located* | OMMAS is the strongest candidate for rural roads but was unreachable from both channels |
| 5 | Tender | **AVAILABLE** | CPPP ✅ + 36/36 State/UT portals ✅ | Fully covered; the strongest link in the chain |
| 6 | Bid | **PARTIALLY_AVAILABLE** | GePNIC tender status pages ✅ | Bid counts commonly shown; per-bidder detail not field-verified |
| 7 | Award | **PARTIALLY_AVAILABLE** | CPPP `/awards`, `/resultoftendersnew` ✅ | Endpoints exist and are public; **field content not yet verified** |
| 8 | Contractor | **PARTIALLY_AVAILABLE** | CPPP award + debarment lists ✅ | Names appear in award records; cross-system identity resolution unsolved (see [`.docs/06-government-sources/procurement/contractor-portals.md`](../procurement/contractor-portals.md)) |
| 9 | Contract value | **PARTIALLY_AVAILABLE** | CPPP award records ✅ | Awarded value expected in award data; not field-verified |
| 10 | Work order | **UNKNOWN** | — | Not identified in the sources reviewed |
| 11 | Start date | **UNKNOWN** | OMMAS 🔍 | — |
| 12 | Planned completion | **UNKNOWN** | OMMAS 🔍 | — |
| 13 | Extensions (EOT) | **UNKNOWN** | — | Not identified in the sources reviewed |
| 14 | **Physical progress** | **UNKNOWN** | OMMAS 🔍; eGramSwaraj 🔍 | Official sources describe OMMAS as monitoring physical progress of all PMGSY works in real time. **Not verified.** |
| 15 | **Financial progress** | **UNKNOWN** | OMMAS 🔍; PFMS 🔍 | Same |
| 16 | Bills | **NOT_AVAILABLE** | — | Not identified in the sources reviewed |
| 17 | Payments | **PARTIALLY_AVAILABLE** | PFMS 🔍; state IFMS ✅ (MH) | PFMS tracks payments but is largely authenticated |
| 18 | Final expenditure | **PARTIALLY_AVAILABLE** | CGA ✅; Finance/Appropriation Accounts; state treasury ✅ | Available in aggregate; **per-project attribution is the open problem** |
| 19 | Completion | **UNKNOWN** | OMMAS 🔍 | — |
| 20 | Audit | **AVAILABLE** | CAG ✅ | Reports published; narrative PDF, not structured records |

### The honest summary

```text
Budget ──✅──> Allocation ──🟡──> Scheme ──✅──> Project ──❓──> Tender ──✅──> Award ──🟡──>
Contractor ──🟡──> Work Order ──❓──> Progress ──❓──> Payments ──🟡──> Final Cost ──🟡──> Audit ──✅──>
```

**Both ends of the chain are strong. The middle is weak.** We can see money being budgeted and we can see contracts being tendered and awarded. What we could not confirm in this pass is the execution segment — work order, progress, completion, final per-project cost.

This has a direct product consequence: **`.docs/07-analytics/analytics-engine.md`'s core variance calculation (`Released − Utilized`) depends on link 18 being attributable to link 4.** If per-project expenditure cannot be obtained, the project-level Money Trail in `.docs/wireframes/08-financial-flow.md` cannot be populated from these sources, and `ProjectFinance.status` would be `insufficient_data` for most projects — which the mobile app renders honestly, but which would make the product much less useful than intended.

**This is the finding that should drive the next phase.** Resolving OMMAS's public surface, and locating an equivalent state works-MIS for Maharashtra PWD, matters more than adding another 500 URLs to the registry.

## OMMAS — the highest-value unverified source

| | |
|---|---|
| **System** | PMGSY Online Management, Monitoring and Accounting System |
| **Owner** | National Rural Infrastructure Development Agency (NRIDA), Ministry of Rural Development |
| **URLs referenced** | `https://online.omms.nic.in/`, `http://omms.nic.in/` |
| **Status** | 🔍 **DISCOVERED — not verified** |
| **Why unverified** | Neither hostname returned an A record from this environment's resolver, on two independent network channels, on 21 Aug 2026 |
| **Evidence it exists** | Referenced by `rural.nic.in` (MoRD press release), `pmgsy.nic.in` (NRIDA), `dmeo.gov.in` (NITI Aayog), `pib.gov.in`, and a `cag.gov.in` audit report PDF |
| **Described as carrying** | Physical and financial progress of all PMGSY works, real-time, against state targets; PMIS for PMGSY-III construction management; independent quality-monitor assessments |
| **Built by** | C-DAC Pune, for MoRD |

If OMMAS exposes work-level physical and financial progress publicly, it closes links 11–15 and 19 for rural roads in one source. **Verify from an Indian network vantage point as the first action of the next phase.**

## Other execution-data candidates

| Source | Status | Relevance |
|---|---|---|
| eGramSwaraj — GP work-based accounting & physical progress | 🔍 unreachable | Panchayat-level works; integrates with LGD + PFMS via codes |
| MGNREGA / NREGA public MIS ✅ | ✅ verified live | Known for very deep public reporting to work and panchayat level; **report surface not yet inventoried** |
| PFMS 🔍 | partial | Scheme fund flow and payments; largely authenticated |
| State works-MIS (e.g. Maharashtra PWD) | **not located** | The Phase-1 blocker — see [`.docs/06-government-sources/phase-1-maharashtra-roads.md`](../phase-1-maharashtra-roads.md) |
