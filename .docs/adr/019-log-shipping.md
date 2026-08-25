# ADR-019 — Logs go to stdout; the platform ships them

**Status:** Accepted · 2026-08-25

## Context

Sprint 1 `OBS` asks for "log shipping". The obvious reading is: choose a destination (Loki, Elasticsearch, CloudWatch, Datadog), run a collector (Vector, Fluent Bit, Promtail), and configure the pipeline.

Two facts make that premature.

**The hosting shape is undecided.** It is still an open Sprint 0 `OPS` item. Whether logs are collected by a sidecar, a DaemonSet, a platform-native agent, or a hosted provider's ingest endpoint is determined almost entirely by that choice — and every one of those needs a different collector configuration.

**There is nothing deployed to ship from.** No staging environment exists yet.

A collector configuration written now would be for a platform not chosen, against an environment that does not exist, and would be discarded when both are decided.

## Decision

**The service writes structured JSON to stdout, one object per line, and ships nothing itself.**

This is the twelve-factor position, and it is what every collector on every platform already consumes. The work that actually earns its place now is making that stream _fit to ship_:

1. **One JSON object per line** on stdout. No multi-line records, no ANSI codes, no interleaved plain text.
2. **Identity fields on every line** — `service`, `version`, `env` — so a collector can route and filter without parsing the message.
3. **`message` is a stable event key** (`request.completed`, `db.readonly_verified`), never interpolated prose. Detail belongs in context fields. This is what makes the stream groupable and alertable rather than merely searchable.
4. **Correlation by `X-Request-Id`**, already implemented, which `.docs/13-observability/observability.md` calls "the whole tracing story".
5. **Two-pass redaction**, below — the part that must be right _before_ logs leave the process.

## Redaction is the part that cannot wait

Shipping logs moves them from a process nobody reads to a store many people and systems can query, often retained for months. Anything leaked into a log line at that point is leaked durably and widely.

Redaction by key name — `password`, `token`, `authorization` — protects a value someone deliberately placed under a known key. It does nothing for the case that actually occurs:

```text
db.readonly_check_failed  reason: connect ECONNREFUSED
  postgresql://lokdarpan:s3cr3t-prod-pw@db.internal:5432/lokdarpan
```

That line is written by an exception handler passing `err.message` through, not by anyone choosing to log a credential. This repository contained exactly that line, and it was verified leaking before the fix.

So values are **scrubbed as well as keyed**: credentials in `scheme://user:pass@host`, `key=value` pairs for credential-shaped keys (including prefixed forms such as `AWS_ACCESS_KEY`, which has no word boundary after `AWS_`), and `Bearer`/`Basic` tokens. The host and username survive, because they are not secrets and they are what makes the line worth keeping.

The config-error path is scrubbed too. It runs before the logger exists and writes to stderr, which the platform also ships.

## Alternatives considered

| Option                                            | Why not                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Bundle Vector or Fluent Bit now**               | Configured for a platform not yet chosen, against an environment that does not exist. Discarded on the first real deployment decision.   |
| **Ship directly from the process to a provider**  | Couples the service to a vendor SDK, adds a network dependency to the request path, and loses logs whenever the provider is unreachable. |
| **Write to files and rotate**                     | Reintroduces disk management and a rotation policy to solve a problem the platform already solves.                                       |
| **Defer redaction until a destination is chosen** | Backwards. Redaction must be right before the stream leaves the process, not after somewhere is retaining it.                            |

## Consequences

- **Choosing a collector is now a deployment decision, not a code change.** Nothing in the service needs to change when the destination is picked.
- **`SERVICE_VERSION` should be set at deploy time** to the build identifier. It defaults to `dev`, which is honest rather than convenient.
- **A new log field carrying free text must be assumed to reach a queryable store.** The scrubber is a safety net, not a licence to log freely.
- **This ADR is not "log shipping deferred".** The shippable stream is delivered; only the destination is deferred, and deliberately.
