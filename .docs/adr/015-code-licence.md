# ADR-015 — Apache-2.0 for the codebase

**Status:** Accepted · 2026-08-25

## Context

The code licence had been an open item since the first architecture pass, recorded in [`../02-architecture/deliverables-and-risk.md`](../02-architecture/deliverables-and-risk.md) §Open items and carried forward as the highest-ranked blocker in [`../README.md`](../README.md). [`001-mobile-framework.md`](./001-mobile-framework.md) §Consequences raised it as blocking app-store submission and put Apache-2.0 or MPL-2.0 on file as the recommendation.

Two requirements pull on this decision, and they are not the usual open-source ones.

**The methodology must be auditable.** [`../02-architecture/tech-stack.md`](../02-architecture/tech-stack.md) requires the source to be public and inspectable — a platform that publishes arithmetic over government records has no claim to public trust if the arithmetic itself is closed. This is the reason the project is open-source at all, and it is satisfied by any OSI licence.

**Distribution must stay unobstructed.** AGPL-3.0 has well-known friction with the Apple App Store's distribution terms and has caused apps to be pulled. Mobile is deferred ([`../decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)) but not abandoned, and the retained mobile specification is a real future path.

## Decision

**Apache-2.0 for the entire repository**, recorded in `/LICENSE` as the verbatim upstream text, with a `/NOTICE` file scoping it.

One licence for the monorepo, not per-package. The alternative — copyleft on the backend, permissive on the client — was considered in `001` and is rejected below.

## Why Apache-2.0 over MPL-2.0

Both clear the app-store problem and both keep the source inspectable. Apache-2.0 wins on two counts specific to this project:

1. **An explicit patent grant** (§3). A public-finance platform ingesting government data is exactly the kind of project where a contributor's later patent claim would be most damaging and hardest to unwind. MPL-2.0's patent provisions are narrower.
2. **File-level copyleft is the wrong shape here.** MPL-2.0's reciprocity operates per-file, which makes sense for a library embedded in a larger proprietary work. This repository is a deployed platform, not an embeddable component; the per-file obligation would add compliance overhead for adopters without protecting anything the project actually cares about.

Adoption also matters. A state government or a civic organisation wanting to run its own instance should meet no legal review friction — the goal is for this methodology to be reused, including by bodies whose procurement rules treat copyleft as a blocker.

## What the licence does not cover

Apache-2.0 covers the **source code**. It confers no rights over the government records the platform ingests and displays, which remain subject to their issuing authority's terms. Each source's licence is recorded per-source in [`../06-government-sources/`](../06-government-sources/) and displayed alongside the data it governs, per [`../17-legal/legal-ethical-rules.md`](../17-legal/legal-ethical-rules.md) §Attribution.

This distinction is stated in `/NOTICE` because it is genuinely easy to get wrong: a permissive code licence does not make the ingested data permissively licensed, and redistributing the software grants no right to redistribute the data. Anyone deploying LokDarpan honours each source's terms independently.

## Alternatives considered

| Option                    | Why not                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGPL-3.0**              | The strongest guarantee that a hosted fork stays open — genuinely attractive for a public-interest platform — but it reintroduces the app-store conflict `001` flagged, and deters institutional adopters. The auditability requirement is already met by publishing the source; AGPL protects against a case (a closed hosted fork) that is speculative here. |
| **MPL-2.0**               | Acceptable, and the runner-up. Loses on the patent grant and on per-file reciprocity being a poor fit for a deployed platform.                                                                                                                                                                                                                                 |
| **MIT / BSD-2**           | No patent grant, no NOTICE mechanism for the data-scope distinction above.                                                                                                                                                                                                                                                                                     |
| **Per-package licensing** | Raised as an option in `001`. Rejected: it multiplies compliance surface across a monorepo whose packages are already shared between `apps/web`, `apps/mobile` and `services/*`, and creates ambiguity for exactly the packages most likely to be reused (`money`, `neutrality`, `contracts`).                                                                 |

## Trade-offs

- **A closed hosted fork is now permitted.** Someone may run a proprietary derivative without contributing back. Accepted: the project's leverage is its verified source registry and its methodology, both public, not the code's exclusivity.
- **Apache-2.0 §4(b) requires derivative works to carry modification notices.** Minor, standard.
- **The NOTICE file must be propagated** by redistributors (§4(d)) — which is the point, since it carries the data-scope statement.

## Consequences

- `/LICENSE` holds the verbatim Apache-2.0 text; `/NOTICE` holds the copyright line and the data-scope statement.
- Every `package.json` in the workspace declares `"license": "Apache-2.0"`.
- The blocker is cleared from [`../README.md`](../README.md) §Open items, [`../01-product/sprint-plan.md`](../01-product/sprint-plan.md) Sprint 0 and [`../../CLAUDE.md`](../../CLAUDE.md).
- `001-mobile-framework.md` §Consequences is **not** rewritten — ADRs append. This ADR supersedes its open recommendation.
- The open-source release is unblocked. S-80 (`../01-product/screen-inventory.md`) — the third-party licence screen — is generated from the dependency tree and is unaffected by this choice.
