# ADR-008 — Authentication: anonymous-first; optional account for sync only

**Status:** Accepted · 2026-08-21 · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

`.docs/11-api/api-documentation.md` makes public reads open and unauthenticated; `.docs/12-security/security.md` defines keyed roles (`journalist`, `researcher`, `analyst`, `admin`) for higher quotas, bulk export, and internal tools. The mobile app serves the **public** tier. Its audience includes citizens with no interest in accounts and activists with a real interest in not having one.

The question is not "which auth provider" but **whether an account should exist at all**.

## Decision

**No account is required for anything.** Browsing, searching, maps, saving, offline packs, watchlists, notifications, and Ask all work anonymously.

An **optional account** exists for exactly one purpose: syncing saved items and collections across a user's devices. It is never prompted, never gates a feature, and is reachable only from Profile (S-66).

The app ships **no API key** and no client secret.

## Alternatives considered

**Require an account.** Rejected outright. It would exclude the citizen audience, create a user database in a system that otherwise holds only public records, and produce the single most sensitive dataset the platform could hold — *which identified person is monitoring which government contract*. For an RTI activist that is a real risk, and it is the exact opposite of the product's purpose.

**Anonymous device identity registered server-side** (a device id the server stores). Rejected: it is an account without consent, and creates the same watch-profile dataset by a different name. The rate-limiting need it would serve is handled instead by a rotating, non-tracking install token never joined to request content (`.docs/12-security/mobile-security.md` §7).

**Ship an API key in the binary for a higher tier.** Rejected: anything in an app binary is public. The correct answer is a mobile rate tier on the server (`.docs/11-api/client-api-contract.md` §6), not a secret we pretend is secret.

**Social login (Google/Apple/Facebook).** Rejected even for the optional account. Injecting a third-party identity provider into a civic transparency tool means that provider learns which users use it — unacceptable for the activist audience, and inconsistent with `.docs/12-security/security.md`'s no-third-party-tracking posture. Apple Sign-In's privacy properties are better but still introduce a platform dependency in the identity path.

**OAuth against a government identity system (e.g. DigiLocker/Aadhaar-linked).** Rejected emphatically. A transparency tool that scrutinises government spending must not require users to identify themselves to a government system in order to use it. This would be a fundamental design error, and it is recorded here so it is never proposed as a convenience.

## The optional account, if enabled

- **Email magic link or passkey.** No password, no social provider.
- Token handling: short-lived access token in memory; refresh token in `expo-secure-store` (Keychain / Keystore) — **never** MMKV or AsyncStorage.
- Scope: read-only public data plus the user's own saved list. A compromised token exposes public data and a saved list.
- **The watchlist stays on-device by default even with an account** (`.docs/10-mobile/notifications.md`); sync is an explicit, separately-consented action with its privacy consequence stated in plain words.
- Deletable in one action, with actual server-side deletion, not deactivation.

## Trade-offs

- **No cross-device sync by default.** Accepted; the alternative costs more than it gives.
- **Weaker product analytics** — no per-user retention or cohort analysis. Consistent with `.docs/13-observability/observability.md`, which already forbids identity in telemetry. Accepted knowingly.
- **Abuse control is harder without identity.** Handled at the network tier, where it belongs.
- **Journalist/researcher API tiers are unreachable from the app.** Correct: those are API products (`.docs/01-product/prd.md`), and the API is the right surface for them (`.docs/00-overview/document-audit.md` PR-1).

## Consequences

- Zero-friction first run: launch → onboarding → data, with no wall.
- The platform holds **no user database** for the mobile audience, which is both a privacy property and a materially smaller security and compliance surface (`.docs/12-security/security.md`).
- Saving works offline, immediately, with no network round trip (`.docs/10-mobile/offline-strategy.md`).
- Anonymity is a feature to state publicly, not an absence to explain — it belongs in the store listing and on S-75.
