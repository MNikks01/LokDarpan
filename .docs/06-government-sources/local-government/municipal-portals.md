# Municipal / Urban Local Body Sources

> Urban local government: Municipal Corporation · Municipal Council · Nagar Panchayat · Cantonment Board → Ward (`.docs/03-domain/administrative-hierarchy.md`).

Verified 21 August 2026.

## Identity — solved

**LGD** ✅ enumerates urban local bodies and their wards with codes, supporting `.docs/05-data-model/database-design.md`'s `ulb_code` and the `municipal_corporation` / `municipality` / `nagar_panchayat` / `cantonment` / `ward` levels.

## Finance and works — not identified

**No national system for urban local body finances was identified in the sources reviewed.**

This is a genuine gap, not a search failure to be papered over. Unlike the rural side — which has eGramSwaraj as a designated national system — no equivalent national ULB accounting platform surfaced in this pass.

What exists instead is **per-city**: individual municipal corporations run their own websites, tender pages and occasionally budget publications. The IGOD catalogue contains 175 candidate urban/municipal organisation entries across 29 States/UTs ([`.docs/06-government-sources/igod-organization-catalogue.csv`](../igod-organization-catalogue.csv), filter category `Others`/`Boards`), none assessed.

## MoHUA schemes

✅ `mohua.gov.in` verified live. Its major urban missions — AMRUT, Smart Cities, PMAY-Urban — were **all unreachable from this vantage point** (`amrut.gov.in`, `smartcities.gov.in`, `pmayurban.gov.in`) and must be re-verified from an Indian network. These would be the route to scheme-funded urban infrastructure projects.

## Maharashtra

- **Urban Development Department** ✅ `urban.maharashtra.gov.in`
- Individual corporations (Mumbai, Pune, Nagpur, etc.) — **not individually verified in this pass**

## Implication

Urban local-body finance should be treated as **out of scope for Phase 1** (which is roads, largely PWD and rural). When the platform reaches `.docs/15-scalability/scalability-plan.md` Phase 3–4, ULB coverage will require a per-city connector strategy rather than a national one — materially more expensive than the rural path.
