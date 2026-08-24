# 10 — Mobile

**Mobile-only capabilities.** Deferred until after web launch ([`../decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)).

This directory holds only what has **no web counterpart**. Everything symmetric between clients lives with its web equivalent, so neither platform is privileged in the layout:

| Concern | Where |
|---|---|
| Mobile architecture | [`../02-architecture/mobile-architecture.md`](../02-architecture/mobile-architecture.md) — beside `web-architecture.md` |
| Navigation architecture | [`../02-architecture/mobile-navigation-architecture.md`](../02-architecture/mobile-navigation-architecture.md) |
| Map / GIS architecture | [`../02-architecture/mobile-gis-architecture.md`](../02-architecture/mobile-gis-architecture.md) |
| Build roadmap | [`../01-product/roadmap-mobile.md`](../01-product/roadmap-mobile.md) — beside `roadmap-web.md` |
| Stack decisions | [`../adr/`](../adr/) 001–010 (marked Deferred) |
| Screens, journeys, design system, states | [`../01-product/`](../01-product/) — platform-agnostic, applies to both clients |

## What remains here

| File | Why it is mobile-only |
|---|---|
| [`offline-strategy.md`](./offline-strategy.md) | Three-tier device storage, offline packs, stale-data semantics. Explicitly out of scope for web launch |
| [`deep-linking.md`](./deep-linking.md) | Custom scheme, universal links, App Links verification, synthetic back stacks |
| [`notifications.md`](./notifications.md) | On-device watchlist and local notifications — the privacy design that keeps the server from learning what a user monitors |

If a document here acquires a web equivalent, move both to sit together rather than duplicating the concern across directories.
