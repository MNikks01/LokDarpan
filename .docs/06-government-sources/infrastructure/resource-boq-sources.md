# Resource, BOQ & Specification Sources

> Can we answer *"what materials and quantities did this road actually require?"* (§12, §34) — the inputs `.docs/03-domain/road-infrastructure-intelligence.md`'s road model needs.

Verified 21 August 2026.

## The resource chain, assessed (§34)

| Link | Status | Basis |
|---|---|---|
| Project | **UNKNOWN** | No works-MIS located (see [`.docs/06-government-sources/infrastructure/project-monitoring-portals.md`](./project-monitoring-portals.md)) |
| **BOQ** (Bill of Quantities) | **PARTIALLY_AVAILABLE** | GePNIC portals list `StandardBiddingDocuments` and tender documents; BOQ is conventionally among them. **Not verified, and typically a PDF/XLS attachment rather than structured data.** |
| Material (item) | **PARTIALLY_AVAILABLE** | Would come from BOQ line items, if extractable |
| Quantity | **PARTIALLY_AVAILABLE** | Same |
| Unit rate | **PARTIALLY_AVAILABLE** | BOQ, and Schedule of Rates (CPWD ✅) |
| Cost | **PARTIALLY_AVAILABLE** | Derived from quantity × rate |
| Labour | **NOT identified in the sources reviewed** | — |
| Equipment / machinery | **NOT identified in the sources reviewed** | — |
| Technical specification | **PARTIALLY_AVAILABLE** | Tender documents; IRC/MoRTH standards (licensing issue below) |
| **Actual execution** (as-built quantities) | **NOT identified in the sources reviewed** | — |

## The honest summary

```text
Project ──❓──> BOQ ──🟡──> Material ──🟡──> Quantity ──🟡──> Unit Rate ──🟡──>
Cost ──🟡──> Labour ──❌──> Equipment ──❌──> Specification ──🟡──> Actual execution ──❌──>
```

**Tendered quantities may be obtainable. Actual executed quantities almost certainly are not.**

This distinction is important for `.docs/03-domain/road-infrastructure-intelligence.md` and for the product's neutrality. The road model computes an *expected* cost from published physical attributes and compares it to *reported* expenditure. It does **not** need as-built quantities — and this pass confirms that is fortunate, because they do not appear to be published.

## Consequence for `.docs/03-domain/road-infrastructure-intelligence.md`

`.docs/03-domain/road-infrastructure-intelligence.md` already frames its outputs correctly: *"expected under model X"* vs *"reported"*, with a mandatory caveat that deviations can be legitimate. This discovery pass supports that framing and adds two constraints:

1. **BOQ extraction is a PDF/XLS problem, not an API problem.** If BOQ line items are wanted, they come out of tender-document attachments — grade D/E work, per document, at scale. This is expensive and should be scoped deliberately, not assumed.

2. **The Schedule of Rates licensing question is open.** `.docs/03-domain/road-infrastructure-intelligence.md` requires unit rates "from published Schedule of Rates" and layer specifications "from the applicable IRC/SoR spec". CPWD ✅ publishes a Schedule of Rates. But **IRC (Indian Roads Congress) is a registered society whose standards are generally sold, not published freely.** If `.docs/03-domain/road-infrastructure-intelligence.md`'s coefficients (layer thicknesses, densities) can only be sourced from a paid IRC publication, then either:
   - the coefficients must be sourced from a freely published government document (e.g. a state SoR or a MoRTH specification that is public), or
   - the model must state that its coefficients derive from a licensed standard and cite it without reproducing it.

   **This is an unresolved licensing question and should go to the same legal review as `.docs/17-legal/legal-ethical-rules.md`.** It was not resolved in this pass.

3. **State Schedule of Rates not located.** Maharashtra PWD's SoR — which `.docs/03-domain/road-infrastructure-intelligence.md`'s Phase-1 model would actually need — was **not found** in this pass. `pwd.maharashtra.gov.in` ✅ is live; whether it publishes the SoR was not determined.

## What this means for the product

`.docs/wireframes/09-consistency.md` shows a road-intelligence screen with a model coefficient table and expected material quantities. That screen is buildable **only if** the coefficients have a citable public source. If they do not, the honest fallback is to show cost-per-km against the **district peer median** only (`.docs/07-analytics/analytics-engine.md` §4), dropping the model-based comparison — which `.docs/03-domain/road-infrastructure-intelligence.md`'s design already supports as an independent second reference point.
