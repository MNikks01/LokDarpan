# ADR-065 · A level is drawn from outlines made when they were loaded

**Status:** Accepted · **Date:** 2026-09-23 · **Follows** [`062-performance-is-measured-and-budgeted.md`](./062-performance-is-measured-and-budgeted.md), which found both problems

## Context

ADR-062's baseline put two numbers over budget.

**The level endpoint took about 580 ms against a 300 ms target**, for Madhya Pradesh. Timing each
query separately:

- ~480 ms was the boundaries query. ~410 ms of that was `ST_SimplifyPreserveTopology` over 55
  districts, run again on every request.
- ~140 ms was containment, which computed `ST_PointOnSurface` for every candidate child on every
  request.

Both depend only on the geometry.

**First boundaries drew about 800 ms after `map:load` against 500 ms.** The suspected cause was the
tender counts: they were merged into the boundary features, so the whole level was re-sent and
re-tiled when the counts arrived, and again on every department change.

## Decision

**Outlines are simplified once, when they are written.** Migration 0033 adds `geometry_overview` to
`admin_unit_boundary`: a stored generated column, simplified at 0.005° (~550 m).

- It uses the same mechanism as `label_point` in 0032, so every loader gets it and a changed geometry
  cannot keep a stale outline.
- The tolerance lives in the migration and nowhere else. `boundariesOfChildren` reads the column.

**Containment tests the stored label point, and a child must be smaller than its parent.**

- `label_point` is the centre of the child's largest inscribed circle, so it lies inside the child.
  It replaces a per-request `ST_PointOnSurface`.
- Swapping one interior point for the other changed 49 of 1,749 parent–child pairs. In every changed
  pair both methods were wrong: a large unit was listed as the child of a smaller one because its
  interior point fell there. Andhra Pradesh was a child of Prakasam district under the old query, and
  of YSR Kadapa under the new one.
- `b.area_m2 < p.area_m2` removes all 79 such pairs from what the explorer returned. With it, the old
  and new methods agree on all 1,670 remaining pairs.
- An integration test places a small unit on a district's own label point. It fails without the rule.

**Tender counts are feature-state, not feature properties.**

- The tender layer's definition returns per-district counts as `featureState`, a new part of the
  ADR-058 contract. The binder applies only what changed, and re-applies after the source's data is
  re-sent.
- A district with no tenders has no state and stays unshaded, not shaded as zero.
- A refused layer clears every count.
- `withTenderCounts` is gone, and the level's geometry is sent to MapLibre once per visit, whatever
  the department filter does.

## Consequences

Measured as in ADR-062, medians:

| Metric                               | Before (ADR-062) | After     |
| ------------------------------------ | ---------------- | --------- |
| Level endpoint, origin warm          | 580 ms           | **62 ms** |
| Boundaries query alone (psql)        | 481 ms           | **5 ms**  |
| Containment alone (psql)             | 142 ms           | 102 ms    |
| First boundaries after load, desktop | 811 ms           | 861 ms    |
| First boundaries after load, mobile  | 732 ms           | 760 ms    |
| Select → boundaries drawn, mobile    | 599 ms           | 546 ms    |

**The level endpoint is fixed:** 62 ms against a 300 ms target.

**The first draw is not.** Re-sending geometry was not what cost the time. Checked in the browser,
the boundaries-drawn mark now fires once per visit, and a department change no longer re-sends
anything; the first draw takes as long as before. What remains is MapLibre tiling the level in its
worker and drawing it under SwiftShader. On a real GPU it is likely lower, and measuring that is the
next step before changing anything else.

Checked in headless Chromium against the local ledger:

- Madhya Pradesh shades Katni, Jabalpur and Indore.
- Choosing _Rural Engineering Service_ leaves only Jabalpur shaded.
- There are no console errors.
