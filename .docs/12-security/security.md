# 13 — Security

The data is public, but **integrity, availability, and traceability** are the security priorities: the platform's credibility depends on nobody being able to tamper with figures or provenance, and on the service staying reachable for citizens and journalists. Confidentiality matters mainly for API keys, admin accounts, and operational secrets.

## Threat model (summary)

| Asset                         | Threat                                                   | Priority     |
| ----------------------------- | -------------------------------------------------------- | ------------ |
| Canonical ledger integrity    | Tampering with figures/provenance                        | **Critical** |
| Provenance/audit trail        | Deletion/alteration to break traceability                | **Critical** |
| Availability                  | DDoS / scraping abuse of the public API                  | High         |
| Admin/ingestion control plane | Account takeover, malicious ingestion config             | High         |
| API keys & secrets            | Leakage                                                  | High         |
| Public PII                    | Minimal (official data), but incidental PII in documents | Medium       |

## RBAC (role-based access control)

| Role                   | Capabilities                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **public** (anonymous) | Read public endpoints; rate-limited; no keys                                              |
| **journalist**         | Higher rate limits, exports, saved queries (keyed)                                        |
| **researcher**         | Bulk export, version pinning, dataset downloads (keyed)                                   |
| **analyst** (internal) | Review quarantine, resolve entity matches, author reports; **cannot** edit source figures |
| **admin** (internal)   | Manage sources, users, deploys; all actions audited                                       |

- **Principle:** _no role can alter an ingested figure._ Corrections happen only by re-ingesting from source (new version), never by manual edit of a value — this preserves traceability. Analysts curate _linkage_ (entity matches, quarantine decisions), not _values_.
- Enforced at the API (middleware) and DB (least-privilege roles; the public API DB user is **read-only**).
- Internal auth via SSO/OIDC + MFA for analyst/admin.

## Audit logs

- Every mutating action (ingest, load, version bump, entity merge, quarantine decision, export, login, config change) writes to `audit_log` with `actor`, `action`, `entity`, `detail`, `at` ([04](../05-data-model/database-design.md)).
- Logs are **append-only**; shipped to a separate, restricted store; tamper-evident (hash-chained batches).
- Data-provenance and audit logs together let anyone reconstruct _how any displayed number came to be_.

## API rate limiting

- Edge (Nginx) + application (Redis token bucket) limits per IP and per API key.
- Tiered quotas by role; `429` + `Retry-After`.
- Abuse protections: burst caps, per-endpoint limits on expensive queries, bot heuristics, optional proof-of-work/CAPTCHA on anomalous traffic.
- Exports throttled and queued.

## Caching (security aspects)

- Only public, non-sensitive data is cached at the edge/CDN.
- Cache keys include `dataset_version`; poisoning mitigated by server-controlled keys and signed revalidation.
- No user-specific data in shared caches.

## Encryption

- **In transit:** TLS 1.2+ everywhere (edge, service-to-service via mTLS in-cluster where feasible).
- **At rest:** encrypted volumes for Postgres, object store, backups; KMS-managed keys.
- **Secrets:** in a vault/secrets manager, injected at runtime; never committed; rotated regularly. API keys stored hashed.

## Data validation & input sanitization

- **Inbound (public API):** all query/body params validated with Zod; strict allow-lists for filter/sort fields (prevents injection via sort/filter). Parameterized SQL only — no string-built queries. Output encoding to prevent XSS in any rendered content.
- **Ingestion:** treat all scraped/parsed content as untrusted — schema/type/range validation, size limits, content-type checks, and sandboxed PDF/OCR processing (resource-limited workers) to contain malicious files.
- **File handling:** raw artifacts stored by hash; parsers run with least privilege and timeouts; no execution of downloaded content.

## Application & supply-chain hardening

- Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) via Nginx/Next.
- Dependency scanning (SCA), container image scanning, SBOM; pinned versions; least-privilege service accounts.
- CI runs SAST + secret scanning + the AI guardrail eval suite ([11](../09-ai/ai-layer.md)) as a release gate.
- Network policy: workers and DB not internet-exposed; only gateway/frontend are public.

## Availability & resilience

- Postgres primary + read replicas; the public API reads replicas.
- Autoscaled stateless services; PodDisruptionBudgets; health/readiness probes.
- Rate limits + WAF absorb scraping/DDoS; CDN offloads public reads.
- **Backups:** automated, encrypted, tested restores; raw artifacts are immutable and independently recoverable; point-in-time recovery for Postgres.

## Privacy

- Only public official data is ingested. Incidental PII in documents is minimized in display; a redaction step masks obvious personal identifiers not relevant to finance.
- No behavioral tracking beyond privacy-respecting, aggregate analytics; no ad tech.

## Incident response

- Runbooks for: source-integrity alarm, data-tamper suspicion, key leak, DDoS, dependency CVE.
- Severity levels, on-call, comms templates; postmortems are blameless and public where appropriate (matching the transparency ethos).
