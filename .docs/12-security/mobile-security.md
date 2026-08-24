# 13 — Mobile Security

`.docs/12-security/security.md` sets the platform posture: the data is public, so **integrity, availability and traceability** are the priorities, not confidentiality. The mobile client inherits that and adds its own surfaces. This document covers only what is client-side or client-triggered.

**The client's security goal, stated precisely:** a user must be able to trust that a figure shown in the app is the figure the platform published, that the app is not building a profile of what they investigate, and that opening a government document cannot compromise their device.

---

## 1 · Threat model (mobile-specific)

| # | Asset | Threat | Priority | Control |
|---|---|---|---|---|
| T1 | Figure integrity in transit | MITM altering a financial figure | **Critical** | TLS 1.2+, cleartext disabled, ATS/network-security-config, `datasetVersion` + ETag consistency; pinning assessed in §3 |
| T2 | What a user investigates | Search queries, AI questions, watchlists, location leaking to analytics, crash logs, or the server | **High** | On-device watchlist, no query/question telemetry, coarse location never stored (§5) |
| T3 | Device | Malicious content in a government-published PDF | **High** | Sandboxed viewer, host allow-list, no JS, size cap (§4) |
| T4 | Deep-link surface | Crafted links driving unintended navigation or opening arbitrary URLs | **High** | Strict param validation, server-resolved IDs, no action links, URL allow-list (§6) |
| T5 | Service availability | Client-driven API abuse; a bug causing a retry storm | Medium | Bounded retries, jitter, circuit breaker, honoured `Retry-After` (§7) |
| T6 | Tokens (only if an account exists) | Theft from device storage | Medium | SecureStore only; never MMKV/AsyncStorage (§2) |
| T7 | Supply chain | A malicious npm dependency in a civic app | **High** | Lockfile, `npm audit`/OSV in CI, SBOM, pinned versions, minimal dependency surface (§9) |
| T8 | Impersonation | A fake "LokDarpan" app publishing altered figures | Medium | Store verification, signed builds, publicised official listing, open-source binary reproducibility where feasible |

**Not in the threat model:** confidentiality of the *data* (it is public by design), and DRM/anti-tamper on the client (there is nothing on the device worth protecting from its owner).

---

## 2 · Authentication and storage

**No account is required for anything** (`adr/008-authentication.md`). The app ships **no API key**, no secret, and no credential in the binary. Anything embedded in an app binary is public; the architecture therefore assumes zero client secrets rather than trying to hide one.

If the optional sync account is later enabled:

| Item | Store | Never |
|---|---|---|
| Access token (short-lived) | Memory | Disk |
| Refresh token | **`expo-secure-store`** (Keychain / Android Keystore) | MMKV, AsyncStorage, SQLite, logs |
| Device/install id (rotating, non-tracking) | MMKV | Sent to third parties; joined to a query or a saved item |
| Saved items, history, settings | SQLite / MMKV, unencrypted | — (public data; encrypting it would imply a protection the app cannot give against a compromised device) |

A leaked token grants read access to public data plus a synced list of saved items. Blast radius is small by design — but the saved list is the one genuinely sensitive artifact (T2), which is why it is on-device by default.

---

## 3 · Network

- TLS 1.2+ enforced. Cleartext HTTP disabled entirely (Android `networkSecurityConfig`, iOS ATS with no exceptions).
- **Certificate pinning: not in Phase 1.** The honest trade-off: pinning defends T1 against a compromised CA, but a mis-rotated pin bricks every installed client until a store update propagates — which, for a public-interest app with no push-config channel, can mean days of total outage for the users least able to update. The chosen mitigation is (a) HSTS + CAA + Certificate Transparency monitoring on the server side, and (b) `datasetVersion`/ETag consistency checks client-side that make silent figure substitution detectable. **Re-evaluate at Phase 5** (India-wide), when the app is a more attractive target — and only with backup pins, a remote kill-switch, and a tested rotation runbook.
- Every request carries `X-Request-Id` (client UUID) and `X-Client-Build`. Neither is a user identifier: the request id is per-request, not per-install.
- No third-party network calls at runtime. No ad SDKs, no attribution SDKs, no remote font/config fetch. The only hosts the app contacts are the LokDarpan API, the tile CDN, the artifact store, and the crash endpoint.

---

## 4 · Document handling (T3 — the largest client attack surface)

The app renders PDFs fetched from ~1,000 government portals of highly variable operational quality. Some of those files are decades old, some are scans produced by third-party vendors, and any of them could be replaced upstream.

| Control | |
|---|---|
| **Host allow-list** | Only hosts present in the ingested source registry, plus the platform artifact store. A URL from a payload that fails the allow-list is not opened, and the mismatch is logged |
| **Prefer the archived artifact** | The content-addressed copy (`artifact_sha256`) is preferred over the live publisher URL — it is what the platform actually extracted from, and it cannot have been swapped since |
| **Integrity check** | The downloaded artifact's sha256 is verified against `provenance.artifactSha256`; a mismatch shows "This document does not match the copy we extracted from" and refuses to render |
| **No script execution** | JavaScript disabled in the viewer; no embedded form submission; no external resource loading |
| **Sandbox** | Rendering in an isolated view with no filesystem or app-storage access |
| **Caps** | 50 MB per document, 60 s render timeout, page-at-a-time `Range` fetching |
| **No auto-open** | A document opens only on an explicit user action, never from a notification or a deep link without a confirmation step |

---

## 5 · Privacy as a security control (T2)

For an RTI activist, *what they are looking at* is the sensitive asset — not the data itself. Several architectural decisions exist for this reason:

| Data | Treatment |
|---|---|
| Search queries | **Never** transmitted to analytics or crash reporting. Stored on-device only, clearable |
| AI questions | Same. Server-side `.docs/09-ai/ai-layer.md` audit logs carry no user identifier, so they cannot be joined to a person |
| Watchlist / saved items | **On-device.** Change detection is a client-side `?since=` poll, so the server never learns which projects a person monitors (`.docs/10-mobile/notifications.md`) |
| Location | `WhenInUse` only; never background; used in-memory for a bbox; never written to disk; never sent to analytics; server-side never logged with an identifier |
| Contacts, calendar, photos, mic (except explicit voice search), advertising id | **Never requested** |
| Crash reports | PII-scrubbed in `beforeSend`: no query text, no question text, no coordinates, no entity names in breadcrumbs — screen IDs and error codes only |
| Screenshots of financial figures | Not blocked (users need to share evidence), but shared artifacts always carry their sources (`.docs/01-product/source-traceability.md`) |

---

## 6 · Deep-link security (T4)

Deep links are unauthenticated, spoofable, and reachable from any web page or message.

- **Every parameter is validated** against a Zod schema before routing; a malformed link lands on a "link not recognised" screen, never on a partially-initialised screen.
- **IDs are resolved server-side.** A link carries an id, never a payload — the app never renders a figure supplied by a link.
- **No action links.** No deep link can save, delete, change a setting, sign in, grant a permission, download, or submit a report. Links are strictly navigational (`.docs/10-mobile/deep-linking.md`).
- **No open-redirect.** A link cannot cause the app to open an arbitrary external URL; document URLs go through the §4 allow-list.
- Universal links / App Links are preferred over the custom scheme (verified domain association makes them non-hijackable by another app).
- Deep-link opens are rate-limited to prevent a link-flood loop.

---

## 7 · Abuse protection and the CGNAT problem (T5)

`.docs/12-security/security.md` specifies per-IP rate limiting. **Indian mobile carriers operate large-scale CGNAT** — hundreds of thousands of subscribers behind shared egress IPs. Per-IP limits would throttle the app's users collectively, and would hit hardest exactly the mobile-only, low-income users the product exists for (`00-document-audit` C9).

**Requirement on the backend:** a per-install anonymous token bucket (a rotating install identifier that is *not* a user identifier and is never joined to query content), or a substantially raised mobile tier keyed on `X-Client-Build`. This is a genuine backend requirement, not a client workaround.

**Client-side controls:** max 3 retries with exponential backoff and jitter; `Retry-After` always honoured; a circuit breaker that stops calling an endpoint after 5 consecutive failures for 60 s; every request cancelled on unmount; debounced search; no polling except the 5-minute version check; no background prefetch on cellular. `429` renders as an explicit, non-alarming state with a countdown — never a raw error.

---

## 8 · Root / jailbreak — a deliberate non-control

The app does **not** detect or block rooted, jailbroken, or emulated devices, and does not use Play Integrity or App Attest.

Rationale: there is no confidential data on the device and no client secret to protect, so attestation would provide essentially no security benefit — while excluding researchers, developers, security auditors, and users of custom ROMs (common on older Indian Android devices) from a public-interest transparency tool. Locking out the people most likely to audit the app would be the wrong trade for a project whose credibility rests on being auditable. Documented as a decision so it is not later "fixed" as an oversight.

---

## 9 · Supply chain and build integrity (T7)

- Lockfile committed; exact versions; Dependabot/Renovate with review.
- `npm audit` + OSV scanning + license check in CI; a high-severity advisory blocks release.
- SBOM generated per build and published — consistent with the platform's auditability commitment (`.docs/02-architecture/tech-stack.md`).
- **Minimal dependency surface** is itself a security control, and is a stated reason for several choices in `.docs/adr/` (no chart library, no Redux, no form library beyond two screens).
- Secrets never in the repo or the binary; EAS environment secrets for build-time values; secret scanning in CI.
- Signed builds; EAS Update payloads signed and verified; **OTA updates never change native code** and are gated behind a staged rollout (`adr/010-ci-cd.md`).
- Reproducible-build documentation so a third party can verify the published binary matches the public source — the strongest available answer to T8.

---

## 10 · Client-side integrity signalling

The client cannot verify a figure cryptographically, but it can refuse to display an incoherent one:

- **One `datasetVersion` per screen.** Sections from different versions are never rendered together (`.docs/10-mobile/offline-strategy.md` §Conflict).
- **Zod validation at the boundary.** A response that does not match the contract is rejected; cached data is retained and the mismatch is logged with the `requestId`. A malformed financial payload is never partially rendered.
- **No provenance ⇒ no render** (`.docs/10-mobile/mobile-architecture.md` §2). Structurally, an unsourced figure cannot reach the screen.
- **Artifact hash verification** on downloaded documents (§4).

---

## 11 · Incident response (client)

| Scenario | Response |
|---|---|
| Malicious/altered artifact reported | Server revokes the source document; the client's allow-list refreshes on next launch; affected figures show a "source under review" state |
| Dependency CVE | Patch, expedited build; OTA if JS-only |
| Contract break causing mass client errors | Server-side compatibility shim first; `/meta/client-support` raises the minimum build only as a last resort |
| Data-tamper suspicion upstream | `.docs/12-security/security.md` platform runbook; the client shows the affected `datasetVersion` as "under review" and offers the prior version |
| Leaked crash-reporting DSN | Rotate; the DSN grants write-only ingest and carries no user data |

---

## 12 · Pre-launch checklist

- [ ] No secrets, keys, or tokens in the binary (verified by a build-time scan)
- [ ] Cleartext traffic disabled on both platforms
- [ ] `expo-secure-store` used for tokens; nothing sensitive in MMKV/AsyncStorage
- [ ] Document viewer: allow-list, hash check, no JS, size cap, sandbox — all verified by test
- [ ] Every deep-link param schema-validated; no action links; fuzzed with malformed links
- [ ] No query text, question text, or coordinates in any analytics or crash payload (verified by a payload-inspection test)
- [ ] Only expected hosts contacted at runtime (verified by a network-allow-list test)
- [ ] `npm audit` clean at high severity; SBOM published
- [ ] Rate-limit handling verified against a `429` fixture
- [ ] Store listings state clearly that the app is **not affiliated with any government body or political party**
- [ ] Privacy policy (S-75) matches actual behaviour, field by field
- [ ] Independent security review before public launch, and before each expansion phase (mirroring `.docs/17-legal/legal-ethical-rules.md`'s legal-review cadence)
