# Security Policy

## Reporting a vulnerability

**Please report privately. Do not open a public issue.**

Use **[GitHub private vulnerability reporting](https://github.com/MNikks01/LokDarpan/security/advisories/new)** — it requires no email address and keeps the report confidential until a fix is available.

Please include: what you found, how to reproduce it, what an attacker could achieve, and any suggested fix.

| | |
|---|---|
| Acknowledgement | within 5 working days |
| Initial assessment | within 10 working days |
| Fix or mitigation plan | communicated once assessed |

This is a small, grant-funded public-interest project with no paid security team, and **no bug bounty**. Response is best-effort but taken seriously. Credit is given in the advisory unless you prefer otherwise.

---

## ⚠ Do not test against government portals

**This is the most important rule on this page.**

LokDarpan collects from roughly a thousand Government of India, State and UT portals. **Security testing must never be directed at any of them.** No scanning, no fuzzing, no probing, no automated crawling beyond what the project's own scheduled, rate-limited collection performs.

Doing so would be unlawful, would violate the sourcing ethics this project is built on ([`.docs/17-legal/legal-ethical-rules.md`](./.docs/17-legal/legal-ethical-rules.md)), and could jeopardise the platform's access to public data that citizens depend on.

If you believe a **government portal** has a vulnerability, report it to that authority or to [CERT-In](https://www.cert-in.org.in/), not to us. If you believe **our handling** of a government source is unsafe, report that here.

Test against a local checkout only.

---

## What this project's threat model actually is

The data is public, so confidentiality is not the priority. Three things are:

### 1. Integrity of a displayed figure — critical

The worst outcome is **a wrong number displayed with a correct-looking source link**. That is a false statement about a government body, published under this project's name, with the appearance of verification.

Report as a security issue anything that could cause it:

- Numeric precision or overflow that silently alters a figure (money is `bigint` paise for exactly this reason)
- A figure rendered without, or with the wrong, provenance
- Provenance pointing at a document that does not support the value
- A variance computed across a missing stage, or missing data rendered as a value
- Anything permitting injection into stored or displayed figures
- Cache poisoning that serves one dataset version's figures under another's

### 2. The neutrality guarantees — critical

The platform's language controls are a safety property, not styling. Report:

- Any path that renders accusatory or causal language to a user
- A way to bypass the `ServerText` boundary and inject client-authored observation text
- An AI response reaching a user without citations, or asserting a cause for a variance
- A score, rank or flag becoming attached to a named person or firm

### 3. What users investigate — high

For an RTI activist, *what they are looking at* is the sensitive asset. Report:

- Search queries, AI questions, saved items or location leaking into telemetry, logs or crash reports
- Anything that would let a third party learn which entities a user viewed
- Any server-side record associating a person with the records they monitor

### Also in scope

Standard web and supply-chain issues in **our** code: XSS, SSRF, injection, auth bypass (for the optional account), dependency vulnerabilities, CI/secrets exposure, malicious content handling in the document viewer, and deep-link abuse.

---

## Out of scope

- **Government portals and their infrastructure** (see above)
- Findings that require a compromised device or a malicious browser extension
- Missing hardening headers with no demonstrated impact
- Automated scanner output with no working proof of concept
- Social engineering, physical attacks, denial of service against third parties
- Absence of certificate pinning in mobile clients — a documented, deliberate trade-off ([`.docs/12-security/mobile-security.md`](./.docs/12-security/mobile-security.md) §Network)
- Absence of root/jailbreak detection — also deliberate; there is no client secret to protect, and blocking those users would exclude the researchers most likely to audit this project

---

## Design decisions that reduce the attack surface

Recorded so they are not reported as findings, and not "fixed" later without understanding why:

- **No user accounts are required**, and the app ships **no API key or client secret**. Anything embedded in a client binary is public, so the architecture assumes zero client secrets rather than hiding one.
- **Watchlists stay on the device.** Change detection is a client-side poll, so no server-side record exists of who monitors which government contract.
- **No third-party analytics SDK**, no advertising identifiers, no session replay.
- **Only public, non-authenticated government pages are collected**, honouring `robots.txt` and rate limits.
- **The public API is read-only.** The ledger is mutated only by internal ETL; no role can edit an ingested figure, and corrections happen by re-ingestion.

Full model: [`.docs/12-security/security.md`](./.docs/12-security/security.md) and [`.docs/12-security/mobile-security.md`](./.docs/12-security/mobile-security.md).

---

## Supported versions

Pre-release. Only `main` is supported; there are no published releases yet and no backend is deployed.

---

## Safe harbour

If you make a good-faith effort to comply with this policy, we will not pursue or support action against you for your research. Act in good faith, avoid privacy violations and service disruption, only interact with accounts you own or have permission to test, give us reasonable time before public disclosure — and **stay off government infrastructure entirely.**
