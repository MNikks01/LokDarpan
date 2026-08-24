# ADR-001 — Mobile framework: React Native + Expo

**Status:** Accepted · 2026-08-21 · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

LokDarpan is now mobile-only (iOS + Android). Constraints from the existing documentation:

- **Public-interest, grant-funded** (`.docs/01-product/prd.md`). Small team, long horizon, contributor-friendly (`.docs/15-scalability/scalability-plan.md` §Organizational scaling).
- **Auditable and cheap to run** (`.docs/02-architecture/tech-stack.md`) — the methodology, including the client, must be inspectable.
- Two platforms must reach **feature parity**; a divided team cannot maintain two native codebases.
- Heavy needs: vector maps, PDF rendering, offline storage, background tasks, i18n with Devanagari.
- The team's existing skill base is TypeScript/React (`.docs/02-architecture/tech-stack.md`: Next.js, React Query, TypeScript across the platform).
- Target device is a low-end Android phone (`.docs/02-architecture/performance.md`), not a flagship.

## Decision

**React Native with Expo (managed workflow, continuous native generation), TypeScript strict, New Architecture (Fabric + TurboModules), Hermes, Expo Router, EAS Build/Update.**

## Alternatives considered

**Native (Swift + Kotlin).** Best performance ceiling and platform fidelity. Rejected: two codebases, two skill sets, two release trains, and roughly double the maintenance for a grant-funded team — and the app is a read-heavy data browser, not a domain where the native ceiling is the binding constraint. Every screen would have to be built and tested twice, which in practice means one platform lags.

**Flutter.** Excellent rendering consistency and performance; strong map and chart ecosystems. Rejected: Dart discards the team's TypeScript skills and, more importantly, **breaks type sharing with the backend** — `.docs/05-data-model/data-models.md`'s TypeScript models and the `api-contract` Zod schemas (`.docs/02-architecture/repository-structure.md`) are consumed directly by an RN client and would need a hand-maintained Dart port. That port is precisely where `00-document-audit` C1–C4-class defects reappear.

**Kotlin Multiplatform.** Shared logic, native UI. Rejected: still two UI layers to build and maintain; smaller ecosystem for the specific pieces we need (MapLibre, PDF, offline); higher ramp-up cost.

**Bare React Native (no Expo).** More control over native modules. Rejected: we would rebuild what Expo already provides — builds, OTA, SecureStore, background tasks, notifications, fonts, updates — and carry the native upgrade burden ourselves. Expo's config plugins cover the one genuinely custom dependency (MapLibre) without ejecting.

**A PWA / web app in a shell.** Rejected outright: the brief excludes a web product, and a shelled PWA cannot deliver offline document storage, background change detection, native map performance on low-end Android, or the app-store discovery the product now depends on for reach.

## Why Expo specifically

| Need                                                             | Expo provides                                      |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| Builds for two platforms without a Mac fleet                     | EAS Build                                          |
| Rapid, safe JS-only fixes                                        | EAS Update (staged, signed, native-code-invariant) |
| Secure token storage                                             | `expo-secure-store` (Keychain / Keystore)          |
| Background change detection (`.docs/10-mobile/notifications.md`) | `expo-background-task`                             |
| Local notifications with no push service                         | `expo-notifications`                               |
| Deep links = routes                                              | Expo Router (`adr/002`)                            |
| Bundled fonts, i18n, localization                                | `expo-font`, `expo-localization`                   |
| Custom native deps (MapLibre, PDF)                               | Config plugins — no eject                          |

New Architecture + Hermes are the performance floor for the reference device: lower bridge overhead, faster startup, smaller memory (`.docs/02-architecture/performance.md`).

## Trade-offs

- **Expo version cadence.** SDK upgrades are periodic and occasionally breaking. Mitigation: upgrade one SDK behind latest, on a scheduled cadence, with the E2E suite as the gate.
- **Native module ceiling.** A dependency without a config plugin requires writing one. Accepted; the dependency list is deliberately short.
- **App size floor.** RN + Expo carries a baseline (~15–20 MB). Mitigated with per-ABI Android splits and Hermes bytecode; budget in `.docs/02-architecture/performance.md`.
- **Performance ceiling below native.** Acceptable for a read-heavy data browser; the two hot paths (map, long lists) are handled by native-backed libraries (MapLibre, FlashList).

## Consequences

- One codebase, one team, genuine feature parity.
- Type and contract sharing with the backend via `packages/api-contract` and `packages/shared-types` — the strongest available defence against the contract defects catalogued in `.docs/00-overview/document-audit.md`.
- OTA updates allow same-day correction of a copy or formatting defect. **This matters for `.docs/17-legal/legal-ethical-rules.md` compliance:** if an accusatory string or a misformatted figure reaches production, we do not wait days for store review.
- EAS is a managed dependency. Mitigation: EAS Build can be self-hosted; builds are reproducible from the repo, so the project is not locked in.

### Open item — licensing (blocking for store submission)

`.docs/02-architecture/deliverables-and-risk.md` leaves the code license undecided. **AGPL-3.0 has well-known friction with the Apple App Store's distribution terms** and has caused apps to be pulled. Since this decision affects whether the product can ship at all, it must be resolved before the first submission. Recommendation: **Apache-2.0 or MPL-2.0** for `apps/mobile` — both preserve the auditability `.docs/02-architecture/tech-stack.md` requires (the source is public and inspectable) without the distribution conflict. If the project wants copyleft for the backend, license the repository per-package.
