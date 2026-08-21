# 09 — AI Experience (Mobile)

`docs/11` defines the AI layer: retrieval-grounded, guardrailed, citation-enforced, with hard prohibitions. This document defines only the **mobile surface** and the constraints it adds. Where the two differ, `docs/11` and `docs/15` win and the feature is withheld.

---

## The framing decision

**Ask is not a tab, and not an assistant. It is a scoped explainer over the ledger.**

Every entry point binds a scope before a question can be asked:

```text
S-10 Home         ▸ "Ask about Pune district"        → scope = unit + FY
S-23 Unit         ▸ "Ask about this district"        → scope = unit + FY
S-27 Project      ▸ "Explain this project"           → scope = project
S-28 Money Trail  ▸ "Explain this variance"          → scope = project + metric
S-35 Observation  ▸ "Explain this observation"       → scope = observation
S-49 Observations ▸ "Explain these"                  → scope = unit + type
```

Why this matters more on mobile than on web: a full-screen chat box with a blinking cursor is an invitation to ask *anything*, and the great majority of "anything" is outside the ingested ledger. Every such question ends in the mandated refusal — *"No ingested official records cover this"* — which trains users that the feature is broken. Binding the scope means the question space is one the retriever can actually serve, and the first answer a user sees is a good one.

A visible, immutable scope header also does neutrality work: the answer is manifestly *about these records*, not about a place, a department, or a person in general.

```text
┌────────────────────────────────────────────┐
│ ← Ask                                      │
│ ┌────────────────────────────────────────┐ │
│ │ Pune district · rural roads · FY2024-25│ │  ← immutable here; change via ▸
│ └────────────────────────────────────────┘ │
│                                            │
│  Try:                                      │
│  ▸ How much was allocated vs utilized?     │
│  ▸ Which projects cost most per km?        │
│  ▸ Where are records missing?              │
│                                            │
│ ┌──────────────────────────────┐ ┌──────┐  │
│ │ Ask about these records…     │ │ Ask  │  │
│ └──────────────────────────────┘ └──────┘  │
│  Answers come only from ingested official  │
│  records and always cite their source.     │
└────────────────────────────────────────────┘
```

---

## Answer anatomy

Every answer renders in four parts, in this order:

1. **The answer** — short, neutral, with a superscript citation on every factual sentence.
2. **Figures** — the numbers used, as `<Figure>` components with full provenance. The reader can verify without re-reading prose.
3. **Citations** — the source documents, tappable to S-52 → S-54.
4. **Guardrail note** — always present: *"Answer restricted to ingested official figures; no inference of cause."* plus any `refusedClaims`.

```text
For rural roads in Pune district (FY2024-25), ingested official records
show ₹412.0 crore allocated¹ and ₹361.4 crore utilized², a deviation of
12.3% from the released amount³. Records for 3 of 14 talukas are not
present in the ingested sources⁴.

  Allocated   ₹412.00 crore   🔗 MH Finance — Demand for Grants · p.118
  Utilized    ₹361.40 crore   🔗 MH PWD — Works · API · 30 Jul 2026
  Deviation   12.3%           (?) how this is calculated

  4 sources · data as of version 137 · 04 Aug 2026
  ⓘ Answer restricted to ingested official figures; no inference of cause.
```

**Hard client rules:**
- An answer with **zero citations is never displayed** — the client drops it and falls back to the template summary. This is client-side defence in depth behind `docs/11`'s server-side citation enforcement.
- Numbers in prose are rendered by `<Figure>`, not as plain text, so every one of them is tappable to its source.
- The AI **never** renders a `<VerificationPriorityChip>`, a severity badge, or any judgment-bearing component. It renders prose, figures, and citations.

---

## Streaming, and why it is a requirement

`POST /ai/ask` as specified in `docs/10` returns a single JSON blob. On a congested 4G cell, a RAG answer is 4–10 seconds of a blank screen, which on mobile reads as a hang.

**Requirement (`00-document-audit` C10):** a streamed response (SSE or chunked), with named retrieval progress:

```text
Reading 41 official records for Pune district…      ← retrieval step, named
Checking figures against sources…                    ← validation step
<tokens stream>
```

Naming the steps is not cosmetic: it tells the user the answer is being built *from records*, which is the entire trust proposition. It is also the honest description of what the pipeline is doing.

**Client rule:** the streamed text is held in a pending state and is **not** treated as final until the terminal event carrying citations and the guardrail verdict arrives. If the stream ends without that terminal event, the partial text is discarded and the template fallback is shown. A half-validated financial statement must never remain on screen.

---

## Refusals are a designed state, not an error

The `docs/11` refusal — *"No ingested official records cover this"* — is rendered as a **first-class informational state**, never as an error, never with an apology, never with a retry-the-same-question button:

```text
No ingested official records cover this.

LokDarpan answers only from official records it has collected.
This question may be outside our current coverage
(Maharashtra roads), or the records may not be published.

▸ What we cover      ▸ Browse this district's records
```

Likewise, an adversarial question ("isn't this corruption?") produces a deflection to neutral facts, which the client renders as an ordinary answer with a guardrail note listing the `refusedClaims`. The client does not editorialise about the refusal.

---

## Neutral copy pipeline (and the localization problem)

`docs/09` requires English + Marathi. But `observation` strings and AI answers are **server-generated, neutrality-checked text** — and the client is forbidden from composing such text itself (`.docs/05-mobile-architecture.md` §3, `ServerText`). This creates a real conflict: the client cannot translate them, and shipping only English defeats the civic audience.

**Requirement (`00-document-audit` C13 / M6):** neutral text crosses the wire as a **template key plus typed parameters**, alongside the rendered English:

```json
{
  "observation": {
    "key": "cost_per_km_above_district_median",
    "params": { "pct": 23.1, "n": 19, "category": "rural_road" },
    "rendered": { "en": "Reported cost per km is 23% above the district median for comparable rural roads (n=19)." }
  }
}
```

The client renders `key + params` through its ICU catalogue for `mr`/`hi`. The catalogue is **generated from the server's vetted templates**, not hand-written by client developers, and each locale passes the same neutrality lint as the English source (`.docs/17-testing-strategy.md`). If a key is missing from a locale, the client falls back to `rendered.en` — never to a client-composed sentence.

Free-form AI answers cannot use this mechanism. For non-English locales in Phase 1, Ask either (a) returns a template-based answer in the requested locale, or (b) states that free-form answers are currently available in English only. It never machine-translates a neutrality-checked financial statement on the device.

---

## Quota and abuse (`00-document-audit` M10)

AI is one tap from every entity screen and is the most expensive endpoint in the system.

- Anonymous per-install quota, surfaced honestly *before* it is hit: *"3 questions left today."*
- Identical (scope, question, `datasetVersion`) tuples are served from cache and **do not consume quota** — re-reading an answer must be free.
- On quota exhaustion: the deterministic template summary from `docs/11` §Templated fallback is still available, so the user is never left with nothing.
- Client-side: no auto-retry on failure, no background pre-fetching of speculative answers, no "regenerate" button (a second generation of a neutrality-checked financial statement invites shopping for a preferred answer).

---

## Offline

**Ask is disabled offline**, stated plainly, with previously received answers readable from S-60. There is no on-device model and no cached-corpus fallback: a generated financial statement that is not grounded in a live retrieval against a known `datasetVersion` cannot satisfy `docs/11`'s grounding and citation guarantees.

---

## Privacy

- **Questions are never sent to analytics or crash reporting.** The event is `ai_question_asked{scope_level, from_suggestion, length_bucket}` — no text (`.docs/16-observability.md`).
- Ask history is on-device, clearable, never synced without an account.
- `docs/11` logs prompts and answers server-side for audit and evaluation; the client sends no user identifier with a question, so those logs cannot be joined to a person.

---

## Instrumentation

`ai_entry_opened{from}` · `ai_question_asked{scope_level, from_suggestion, length_bucket}` · `ai_answer_shown{citation_count, was_template, was_refusal, latency_bucket, stream_completed}` · `ai_citation_opened{position}` · `ai_quota_exhausted`.

**`citation_count == 0` is tracked as a defect metric, not a usage metric** — it should be structurally impossible, and any occurrence is a contract violation to investigate.

---

## What the mobile AI surface must never do

Beyond the `docs/11` prohibitions, which bind here identically:

- No push notification containing an AI-generated statement.
- No AI-generated text in a shared card, a screenshot overlay, or an export — shared artifacts carry figures and sources only.
- No AI summary rendered *above* the source-linked figures on any screen; the deterministic ledger is always the primary content and the AI is always secondary (`docs/11`: *"if AI and ledger disagree, the ledger wins"*).
- No proactive/unsolicited AI commentary anywhere — no "insights", no "did you know", no auto-generated observations on Home.
- No persona, no name, no avatar, no conversational filler. The surface is labelled "Ask", not given a personality; a personality invites trust the guardrails cannot underwrite.
