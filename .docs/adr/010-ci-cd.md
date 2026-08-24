# ADR-010 — CI/CD: GitHub Actions + EAS Build/Update

**Status:** Accepted · 2026-08-21 · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

`.docs/02-architecture/tech-stack.md` already uses GitHub Actions for the platform. The mobile app adds: two store pipelines, signing, device-farm testing, staged rollout, crash monitoring, and OTA updates. Constraints: a small grant-funded team (`.docs/01-product/prd.md`), no Mac fleet, and a genuine need to correct a copy or formatting defect **quickly** — a `.docs/17-legal/legal-ethical-rules.md` violation reaching production should not wait days for store review.

## Decision

**GitHub Actions** for CI, **EAS Build** for binaries, **EAS Update** for OTA JS updates, **EAS Submit** for store delivery, **Sentry** for release health.

## Pipelines

```yaml
PR:
  typecheck · lint · dependency-cruiser boundaries
  unit · component · contract · integration
  guardrails G1–G6 (neutrality · provenance · palette · a11y · privacy · mock isolation)
  bundle-size delta
  preview build (internal distribution) on the `mobile` label
  ≈ 6 min

main:
  everything above
  + E2E (Maestro, 12 flows) on real reference-class devices
  + G7 performance benchmarks · G8 security (audit, secret scan, SBOM)
  + EAS Update → `preview` channel
  ≈ 25 min

release tag:
  + EAS Build (iOS + Android, production profile)
  + source maps → Sentry
  + EAS Submit → TestFlight / Play internal
  → manual gates → staged rollout

nightly:
  + fixture drift diff (opens a PR on API drift)
  + full 3G-throttled E2E · a11y sweep · dependency audit
```

## Release process

```text
Internal (EAS internal distribution)
   → TestFlight / Play internal — includes the legal/neutrality copy review (.docs/17-legal/legal-ethical-rules.md)
   → Play staged rollout 5% → 20% → 50% → 100%, gated on crash-free ≥ 99.5%
     (measured on the reference-device cohort, not the fleet average)
   → iOS phased release (7-day)
Rollback: halt the staged rollout; if JS-only, EAS Update revert within minutes.
```

**Versioning.** SemVer for the user-facing version; monotonically increasing build numbers, auto-incremented by EAS; the build number is what `/meta/client-support` compares against (`.docs/11-api/client-api-contract.md`).

## OTA updates — scope and discipline

EAS Update ships **JS and asset changes only**. Rules:

1. **Never used to change native code** — that requires a store build, by construction.
2. **Never used to bypass store review** for a functional change. Reserved for: copy and localization fixes, formatting corrections, config adjustments, and hotfixes for crashes or contract mismatches.
3. **Staged and monitored** — 10% → 100%, gated on crash-free rate; automatic rollback on regression.
4. **Signed and verified** (`.docs/12-security/mobile-security.md` §9).
5. Channels track environments: `production`, `preview`, `development`.

**Why this matters here specifically:** if an accusatory string, a mislabelled variance, or a misformatted crore figure reaches production, it is a `.docs/17-legal/legal-ethical-rules.md` compliance failure that must be corrected in hours, not days. OTA is the mechanism that makes that possible, and that is the justification for accepting the dependency.

## Alternatives considered

**Fastlane + self-hosted macOS runners.** Full control, no vendor. Rejected: a small team would spend meaningful time maintaining Xcode versions, certificates, provisioning profiles, and runner hardware. That time is better spent on the product. Fastlane remains the documented fallback if EAS becomes unsuitable — builds are reproducible from the repo, so there is no lock-in.

**Bitrise / CircleCI / Codemagic.** Capable. Rejected: another vendor alongside GitHub Actions (already used platform-wide, `.docs/02-architecture/tech-stack.md`), and EAS integrates natively with the Expo toolchain we have chosen.

**CodePush (App Center).** Rejected: App Center is retired; EAS Update is the supported path for Expo.

**No OTA at all.** Rejected for the compliance reason above.

**Store-managed signing only.** Both platforms' managed signing (Play App Signing, Apple-managed) is used, with EAS holding the upload keys. Rationale: fewer secrets for a small team to mishandle, and recoverable key loss.

## Trade-offs

- **EAS is a managed dependency.** Mitigated: it can be self-hosted, and builds are reproducible from the repository. Documented as a fallback rather than assumed away.
- **Device-farm E2E costs money.** Mitigated by running it on merge and pre-release only.
- **Build minutes are a shared resource.** Mitigated by aggressive caching and by running the expensive suites off the PR path.

## Consequences

- Two-platform releases from one pipeline with no Mac fleet.
- A copy or formatting defect can be corrected the same day — the operational counterpart to `.docs/17-legal/legal-ethical-rules.md`'s CI language gate.
- Every release carries source maps, so a production crash maps to real code.
- **Guardrails G1–G8 are merge gates, not advisory checks.** A neutrality or provenance violation cannot reach a release branch, which is what makes the enforcement claims in `.docs/17-legal/legal-ethical-rules.md` §Enforcement true rather than aspirational.
