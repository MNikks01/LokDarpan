# 22 — Notifications

## The decision

**Notifications ship — but only for changes to items the user explicitly saved, delivered by on-device change detection, off by default until the first save.**

Everything else is rejected. The reasoning matters more than the feature list, because the default mobile pattern here is actively harmful to the product.

---

## What is rejected, and why

| Rejected                                            | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"3 new anomalies near you"**                      | The single most dangerous feature the product could ship. A push notification is a decontextualised, un-sourced, un-caveated sentence on a lock screen — with no factor breakdown, no confidence, no disclaimer, no source link. `.docs/17-legal/legal-ethical-rules.md` forbids implying wrongdoing; a lock-screen alert about "anomalies" implies it before the phone is unlocked. It would also train users to read variance as scandal, which is the exact failure mode `00-document-audit` PR-3 identifies |
| **Trending / most-viewed projects**                 | Manufactures salience the data does not support, and would rank projects by attention rather than fact                                                                                                                                                                                                                                                                                                                                                                                                          |
| **"Your district ranks 3rd worst"**                 | `.docs/08-risk/risk-scoring-engine.md` explicitly forbids ranking. Not built                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Re-engagement pushes** ("you haven't checked in") | Engagement machinery in a civic tool; erodes the seriousness the product depends on                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Any AI-generated notification text**              | `.docs/09-ai/ai-layer.md` guardrails cannot be verified by a user on a lock screen, and an AI sentence without its citations violates the citation-enforcement rule                                                                                                                                                                                                                                                                                                                                             |
| **Marketing, feature announcements, surveys**       | Use the app's own surfaces                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Badge counts on the tab bar**                     | A permanent red dot over "observations" is an anxiety loop attached to neutral data                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## What ships

Per **saved item**, opt-in per change type (S-65). Default: figures only.

| Change                                   | Default | Example                                                          |
| ---------------------------------------- | ------- | ---------------------------------------------------------------- |
| **A financial figure changed**           | ✅ on   | "Utilized: ₹8.00 cr → ₹8.60 cr — new expenditure record"         |
| **A new ledger record was published**    | ✅ on   | "New release recorded: ₹1.00 cr, 12 Sep 2026"                    |
| Project status changed                   | off     | "Status: in progress → completed"                                |
| A value was superseded (budget revision) | off     | "Allocation revised: ₹10.00 cr → ₹11.50 cr"                      |
| A new observation appeared               | **off** | "1 new consistency observation" — **count only, never the text** |
| A source document was superseded         | off     | "The source for this project's expenditure was updated"          |
| Coverage improved for a saved unit       | off     | "Expenditure records are now available for Katewadi GP"          |

Note the deliberate asymmetry: a **new observation** is off by default and, when enabled, carries only a count. The observation text — even though it is server-generated and neutrality-checked — does not belong on a lock screen where it will be read without its evidence, confidence, and disclaimer.

---

## The privacy architecture — why on-device

The conventional design registers `(deviceToken, entityId)` pairs on the server and pushes. That creates a database of **which anonymous person is monitoring which government contract**.

For this product's audience that is a genuinely sensitive dataset. An RTI activist tracking one contractor's awards, a local journalist watching a specific road, a resident monitoring their panchayat's accounts — a server-side subscription table records exactly that intent, and it is a dataset that can be breached, subpoenaed, or correlated with other logs. It would be the _only_ meaningfully sensitive dataset the platform holds, in a system that otherwise deals exclusively in public records.

**Chosen design — client-side diffing:**

```mermaid
sequenceDiagram
  participant D as Device (background task, ≥6h)
  participant A as API
  D->>D: read watchlist from SQLite (local only)
  D->>A: GET /mobile/watchlist/changes?ids=501,884,1203&since=137
  Note over A: stateless — the server retains no subscription,<br/>no token, no association
  A-->>D: [{ entityId, changeKind, field, previousValue, newValue,<br/>sourceDocumentId, changedAt }]
  D->>D: update the local bundle; write to the Updates inbox
  D->>D: schedule a LOCAL notification (never leaves the device)
```

| Property                    | Server push | On-device diff                         |
| --------------------------- | ----------- | -------------------------------------- |
| Server knows what you watch | **Yes**     | **No**                                 |
| Requires a device token     | Yes         | No                                     |
| Works with no account       | Yes         | Yes                                    |
| Latency                     | Seconds     | Up to ~6 h                             |
| Battery / data              | Lower       | One small request per cycle            |
| Works if push is denied     | No          | **Yes** — updates still appear in S-11 |

Latency is the cost, and it is an acceptable one: the underlying data publishes at most daily (`.docs/02-architecture/system-architecture.md` cron), so a six-hour detection window is well inside the data's own cadence. There is no scenario in this product where six hours of notification latency harms a user, and there is a clear scenario where a subscription database harms one.

**Opt-in server push remains available** as an explicit alternative in S-71 — clearly labelled with what it means ("faster updates; LokDarpan's servers will know which items you follow") — for users who want immediacy and do not consider their watchlist sensitive. Making the trade-off visible and reversible is better than making it silently on the user's behalf in either direction.

---

## Permission flow

Contextual and deferred. Never asked at launch.

```text
First save  →  item saved (works with no permission)
            →  S-07 primer sheet:
               "Want to know when this project's figures change?
                We check for updates in the background and tell you
                what changed — the amount, the record, and the source."
                [ Enable updates ]   [ Not now ]
            →  Enable  →  OS prompt
               Not now →  updates still collected, shown in S-11
```

Denied is not a dead end: the Updates inbox (S-11) works regardless. The permission only controls whether the device tells you sooner. This is stated in the primer.

---

## Notification content rules

Every notification must state **what changed, by how much, and from which record.** A vague "this project was updated" is useless and slightly alarming.

```text
✅  Upgradation of ODR-14, Baramati
    Utilized: ₹8.00 cr → ₹8.60 cr
    New expenditure record, 12 Sep 2026 · MH PWD — Works

✅  Katewadi Gram Panchayat
    Expenditure records now available for FY2024-25

✅  Upgradation of ODR-14, Baramati
    1 new consistency observation                    ← count only

❌  "Suspicious activity detected"
❌  "This project has a high risk score"
❌  "Money missing in your district"
❌  "3 anomalies found near you"
❌  "You haven't checked LokDarpan in a while"
```

**All notification copy passes the same neutrality lint as in-app copy, in every locale** (`.docs/14-testing/testing-strategy.md` G1). Notification strings live in `i18n/` and are scanned by the same CI gate — a notification is the highest-reach, lowest-context surface in the product and therefore gets the strictest treatment, not a lighter one.

Tapping opens the entity **anchored to the changed section**, with the previous value shown alongside the new one, so the change is verifiable rather than merely announced.

---

## Delivery mechanics

- **Local notifications only** in the default design (`expo-notifications`), scheduled by the background task. No push service, no FCM/APNs token, no third-party notification SDK.
- Background fetch: `expo-background-task`, minimum 6 h, Wi-Fi preferred, skipped on low battery or data-saver mode.
- **Batched.** Multiple changes to one item become one notification; changes across items become a summary that opens S-11. Maximum **one notification per day per saved item**, and a hard cap of 3 per day overall.
- Quiet hours default 21:00–08:00 local, configurable.
- Notification channels (Android): "Saved item updates", "Coverage updates" — separately controllable in system settings.
- Every notification is deletable, and the whole feature is one toggle in S-71.

---

## Instrumentation

`notif_primer_shown{trigger}` · `notif_permission_result{granted}` · `notif_scheduled{change_type}` · `notif_opened{change_type}` · `notif_settings_changed{setting}` · `watchlist_diff_run{item_count_bucket, changes_found_bucket}`.

**No entity ids, no figures, no notification text** in any event (`.docs/13-observability/observability.md` A1).

---

## Review checklist

- [ ] No notification is sent for an item the user did not explicitly save
- [ ] No notification contains observation text, a verification-priority score, or AI-generated language
- [ ] Every notification names the change, the amounts, and the source
- [ ] All notification strings pass the neutrality lint in en/mr/hi
- [ ] The watchlist is never transmitted as a stored subscription in the default design
- [ ] The opt-in push alternative states its privacy trade-off in plain words
- [ ] Denying the permission leaves the Updates inbox fully functional
- [ ] Rate caps enforced (1/day/item, 3/day total)
- [ ] Quiet hours respected
- [ ] Tapping lands on the changed section with the previous value visible
