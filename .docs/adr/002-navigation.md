# ADR-002 — Navigation: Expo Router, 4 bottom tabs, shared entity routes

**Status:** Accepted · 2026-08-21 · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

The data is 7–9 levels deep and densely cross-linked (project → contractor → tender → project). Sideways navigation is normal, not exceptional. Deep links must address every entity, and they are the *only* stable public address for a record now that there is no website (`.docs/10-mobile/deep-linking.md`). Full analysis: `.docs/10-mobile/navigation-architecture.md`.

## Decision

1. **Expo Router** (file-based, built on React Navigation).
2. **Four bottom tabs:** Home · Explore · Search · Saved.
3. **Entity routes are shared** and push onto the *active tab's* stack, not a tab of their own.
4. **No breadcrumb bar.** Depth is handled by a persistent scope chip, a contextual ancestor row on entity screens, and a long-press-back ancestor menu.
5. **Bottom sheets** replace every desktop hover/popover/drawer affordance; maximum sheet depth 2.
6. **Ask (AI) is not a tab** — it is entered from a scope.

## Alternatives considered

**React Navigation configured imperatively (no Expo Router).** Rejected: it requires a hand-maintained linking configuration in addition to the navigator tree. Two representations of the same route space drift, and drift in a link table means shared links break — unacceptable when links are the product's public addressing scheme. With Expo Router **the file tree is the link table**, so they cannot diverge.

**Five tabs with "More".** Rejected: "More" is where features go to die, and Settings is visited rarely and never mid-task — it belongs in the Home header.

**Three tabs + header search icon.** Rejected: Search is the journalist's and RTI activist's primary path (`.docs/01-product/prd.md`); demoting it to an icon buries the workflow of two of the six named audiences.

**Ask/AI as a fifth tab.** Rejected, and this is a product decision as much as a navigation one. A standing chat surface invites unscoped questions, most of which the ledger cannot answer — producing a stream of `.docs/09-ai/ai-layer.md`-mandated refusals that teach users the feature is broken. Scoped entry (`Ask about this district`) guarantees the retriever can serve the question and keeps the answer manifestly about *these records* (`.docs/09-ai/ai-client-experience.md`).

**Drawer navigation.** Rejected: hides the IA behind a hamburger; poor thumb reach on the 6.5"+ devices common in this market.

**Entity routes owned by a single "Data" tab.** Rejected: opening a project from Search would yank the user out of Search. Per-tab stacks preserve parallel investigations.

**A persistent breadcrumb bar.** Rejected: ~44 pt of permanent chrome on every screen, duplicating what the back stack already encodes. Replaced by three cheaper mechanisms that carry more information where it matters.

## Trade-offs

- **A screen can exist in two stacks.** Accepted, and correct: two stacks are two independent investigations. Memory is bounded by the 12-entry stack guard.
- **Deep stacks still need an escape.** Handled by long-press-back and the ancestor row; without them, a 9-deep stack would need 9 taps to unwind.
- **File-based routing constrains route shapes.** Acceptable; the tree in `.docs/10-mobile/navigation-architecture.md` maps cleanly onto it.
- **Sheets are less discoverable than persistent panels.** Mitigated by making the source affordance a visible chip on every figure rather than a hidden gesture.

## Consequences

- Deep linking is nearly free and cannot drift (`.docs/10-mobile/deep-linking.md`).
- Synthetic back stacks build from the entity's ancestor chain, so "back" walks up the hierarchy — matching the data's mental model.
- Filters live in route params, making a filtered view shareable and restorable.
- Adding an entity type (facility, utility asset) is a new route folder; no navigator surgery.
