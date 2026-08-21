# 16 — Analytics & Observability

## Position

The product's audience includes people whose *investigative intent* is sensitive — an activist searching a contractor's name before filing an RTI, a journalist tracking one project. `docs/13` commits to "no behavioural tracking beyond privacy-respecting, aggregate analytics; no ad tech." This document takes that seriously enough to make it structural.

**Three rules that override any product-learning benefit:**

> **A1 — No content, ever.** Search queries, AI questions, entity names, and coordinates never leave the device in any telemetry payload.
> **A2 — No identity.** No account id, no advertising id, no device fingerprint. Only a rotating install id, never joined to content.
> **A3 — Enforced at the boundary, not by discipline.** One event sink, a typed event union, a payload allow-list, and a test that fails if a forbidden field appears.

---

## Product analytics

### Event catalogue

Every event is a member of a closed TypeScript union. There is no `track(name, props)` escape hatch — a new event requires a type, which requires review.

**Lifecycle** `app_launched{cold|warm|deeplink}` · `app_backgrounded{session_s_bucket}` · `onboarding_viewed{panel}` · `onboarding_completed{skipped}` · `language_selected{locale, was_device_default}` · `location_permission_result{granted, source}` · `scope_selected{level, method}`

**Discovery** `home_viewed{scope_level, has_location}` · `home_section_opened{section}` · `search_opened{entry_point}` · **`search_performed{result_count_bucket, types_returned, had_filters, latency_bucket}`** · `search_zero_results{reason}` · `search_result_opened{type, position_bucket}` · `map_viewed{z, layer, metric}` · `map_layer_changed{layer}` · `map_list_toggled{to}` · `map_feature_previewed{type}` · `map_project_opened` · `map_cluster_opened{count_bucket}` · `map_feature_cap_hit{total_bucket}` · `hierarchy_level_opened{level, child_count_bucket}`

**Investigation** `unit_viewed{level, fy, from}` · `unit_section_expanded{section}` · **`project_viewed{category, from, has_full_chain}`** · `money_trail_viewed{status}` · `ledger_opened{kind, count_bucket}` · `variance_explained_opened{which}` · `timeline_viewed` · `road_intelligence_viewed{has_model}` · `verification_priority_opened{band}` · `anomaly_viewed{type, severity}` · `observation_evidence_opened` · `rollup_viewed{gap_pct_bucket}` · `peer_comparison_viewed{metric, n_bucket}` · `comparison_created{n, metric}` · `contractor_viewed` · `coverage_viewed{missing_pct_bucket}`

**Traceability — the product's health metrics** `source_opened{from_screen, extraction_method, confidence_bucket}` · `document_opened{doc_type, page_anchored}` · `document_downloaded{bytes_bucket}` · `lineage_opened` · `source_registry_opened` · `methodology_opened{metric}`

**Ask** `ai_entry_opened{from}` · `ai_question_asked{scope_level, from_suggestion, length_bucket}` · `ai_answer_shown{citation_count, was_template, was_refusal, latency_bucket, stream_completed}` · `ai_citation_opened{position}` · `ai_quota_exhausted`

**Saving & offline** `project_saved{type}` · `project_unsaved{type, days_held_bucket}` · `offline_pack_downloaded{unit_level, bytes_bucket}` · `offline_pack_deleted` · `offline_mode_entered{had_cache}` · `update_item_opened{entity_type, change_type}`

**Friction** `error_shown{screen_id, error_kind}` · `empty_state_shown{screen_id, variant}` · `retry_tapped{screen_id}` · `rate_limited{endpoint}` · `data_issue_reported{entity_type}`

### The bucketing rule

Every numeric or free value is bucketed at the source, on device: counts → `0 | 1-3 | 4-10 | 11-50 | 51+`; latency → `<300ms | <1s | <3s | <8s | 8s+`; bytes → `<100KB | <1MB | <10MB | 10MB+`; confidence → `high | medium | low`. Raw values enable re-identification through combination; buckets answer every product question we actually have.

### Explicitly never collected

Query text · AI question or answer text · entity names or IDs the user viewed (only *types* and *levels*) · coordinates or any geohash · saved-item contents · exact timestamps beyond hour granularity · IP-derived location · advertising identifiers · contacts, calendar, photos · device fingerprint components · session replay · heatmaps or touch coordinates.

**Note on entity IDs:** the app deliberately does not report *which* project or contractor was viewed. Knowing that "project 501 was viewed 4,000 times" would be genuinely useful product data — and it is exactly the dataset that could later be subpoenaed, breached, or correlated. The trade is made knowingly: we accept weaker product analytics to guarantee that no record exists of who looked at what.

### Consent

On first launch, one card, at the point where the toggle also lives:

```text
   Help improve LokDarpan
   We collect anonymous usage counts — which screens are opened,
   whether searches return results, whether errors occur.
   We never collect what you search for, what you ask,
   what you look at, or where you are.
                                     [ On ●─ ]   Learn more ▸
```

Default **on** for these bucketed, content-free events (disclosed in the same view, one tap to turn off, and re-toggleable in S-68). Crash reporting is always on but PII-scrubbed (§Crash). Anything that carried content would be opt-in — but nothing carries content, which is the point.

### Where the data goes

**Self-hosted** (PostHog self-hosted or an equivalent open-source sink) on platform-controlled infrastructure. No third-party analytics SDK ships in the binary. Rationale: a third-party SDK can change its collection behaviour in a version bump, and its network calls are not fully under our control — unacceptable for A1/A2. Retention: 13 months, then aggregate-only.

---

## Crash reporting

**Sentry** (already in `docs/12`), with a hard `beforeSend` filter:

```ts
beforeSend(event) {
  event.user = undefined;                       // no user context, ever
  event.request = stripQueryAndBody(event.request);
  event.breadcrumbs = event.breadcrumbs
    ?.filter(b => b.category !== 'console')     // console may carry payloads
    .map(stripToScreenIdAndErrorCode);
  event.extra = pickAllowList(event.extra, ['screen_id','error_kind','request_id','dataset_version','build']);
  return containsForbiddenPattern(event) ? null : event;   // drop rather than risk it
}
```

Forbidden patterns (dropped, not redacted): anything matching `₹`, a long digit run, a coordinate pair, a known entity-name field, or a `q=` parameter. **Dropping a crash report is preferable to leaking a search query.**

Source maps uploaded per build; release health, ANR and OOM tracking on; crash-free session target **≥ 99.5%** (reference-device cohort tracked separately, because that cohort is where crashes actually happen).

---

## Performance monitoring

`app_start{phase, ms}` · `screen_tti{screen_id, ms, cache_hit}` · `api_latency{endpoint, ms_bucket, status, cache_hit}` · `bundle_load{segment, ms}` · `frame_drops{screen_id, count_bucket}` · `memory_warning{screen_id}` · `map_render{phase, ms_bucket}`.

Sampled at 10%. Thresholds are the ceilings in `.docs/14-performance.md`. **p75 is tracked alongside p50**, because the reference low-end device sits nearer p75 of the installed base and a p50-only dashboard hides the experience of the primary audience.

---

## API observability

Every request carries `X-Request-Id` (client UUID) and `X-Client-Build`. The request id is echoed in error responses, surfaced in the error UI's "copy diagnostics", and logged server-side — so a user's report ("this screen was broken at 4pm") maps to an exact server log line without the app needing to know who the user is. This is the whole tracing story, and it works precisely *because* nothing else is identifying.

Client-observed API health: error rate by endpoint and status, cache-hit ratio, `429` rate (the CGNAT canary — `.docs/13-mobile-security.md` §7), contract-validation failure rate by endpoint.

---

## The metrics that actually matter

Beyond engagement, these tell us whether the product is doing its job:

| Metric | Why | Target |
|---|---|---|
| **Source-open rate** — `source_opened / project_viewed` | Are people using traceability, or just reading numbers? The single best signal that the product's core promise is landing | ≥ 0.15 |
| **Document-open rate** — `document_opened / source_opened` | Does the chain complete all the way to the government page? | ≥ 0.20 |
| **Zero-result search rate** | Coverage and matching quality | ≤ 0.15 |
| **Empty-state rate by variant** | How often users hit unpublished data — a *platform coverage* metric surfaced through the client | tracked, not targeted |
| **`insufficient_data` rate on Money Trail** | What share of projects lack a complete chain — this is `docs/01`'s "Coverage" success metric, measured in the field | tracked |
| **AI refusal rate** | Too high ⇒ scoping is wrong; too low ⇒ guardrails may be loose | 0.05–0.25 |
| **`ai_answer_shown{citation_count: 0}`** | Should be structurally impossible; any occurrence is a **contract violation to investigate**, not a usage number | 0 |
| **Contract-validation failure rate** | Backend drift, detected from the field | ≈ 0 |
| **`map_feature_cap_hit` rate** | How often users see a truncated map | tracked |
| **Crash-free sessions (reference-device cohort)** | | ≥ 99.5% |

---

## Guardrail telemetry (neutrality in production)

`docs/15` requires a CI gate on forbidden language. Production adds two runtime counters:

- **`contract_violation{kind: 'missing_provenance'}`** — a figure arrived without provenance and was suppressed (`.docs/04-data-flow.md` §12). Target zero; each occurrence is a `docs/15` rule-5 breach in the making.
- **`contract_violation{kind: 'uncited_ai_answer'}`** — an AI answer arrived with no citations and was dropped client-side. Target zero.

Both alert immediately rather than appearing on a weekly dashboard. They are integrity alarms, not metrics.

---

## Implementation

```text
platform/analytics/
├── events.ts       # the closed union — the ONLY place an event is defined
├── buckets.ts      # count/latency/bytes/confidence bucketing
├── privacy.ts      # payload allow-list + forbidden-pattern scan (the enforcement point)
├── sink.ts         # batching, offline queue, 10% sampling, flush on background
└── index.ts        # track(event: AnalyticsEvent) — no string overload exists
```

- Events queue offline in MMKV (cap 500, FIFO drop) and flush on reconnect — over Wi-Fi where possible.
- Flushing is deferred via `InteractionManager`; telemetry never competes with a user interaction for frames.
- **CI test:** every event in the union is serialized with adversarial values and asserted to contain no forbidden pattern. A new event field that could carry content fails the build.
- **CI test:** the production bundle contains no third-party analytics SDK.
- The privacy policy screen (S-75) is generated in review against `events.ts`, so the stated behaviour and the actual behaviour cannot drift.
