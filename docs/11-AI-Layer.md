# 11 — AI Layer

The AI layer makes the ledger **readable** — plain-language summaries, anomaly explanations, and question-answering — without ever becoming an accuser. It is a **retrieval-grounded, guardrailed** assistant: it may only speak from figures already in the canonical ledger, and it may only make neutral, factual, comparative statements. It is the highest-risk component for the platform's neutrality promise, so it is the most tightly constrained.

## Responsibilities

1. **Summarize financial reports** — turn a project's/district's figures into a short neutral paragraph.
2. **Explain anomalies** — restate a flagged inconsistency and the arithmetic behind it in plain language.
3. **Answer user questions** — Q&A strictly over ingested official data, with citations.
4. **Generate public summaries** — accessible overviews (English/Marathi) for non-experts.

## Hard prohibitions (non-negotiable)

The AI must **never**:
- Accuse or imply corruption, fraud, bribery, theft, or misappropriation.
- Attribute intent or motive to any person, official, department, or contractor.
- Make legal conclusions or use legal-liability language ("illegal," "guilty," "embezzled").
- Assert a *cause* for a variance (delay vs revision vs misreporting vs wrongdoing).
- State anything not supported by cited ingested figures. No outside knowledge, no speculation.
- Name individuals in a negative light. (Contractor/department names appear only in neutral, descriptive statistics.)

**Allowed:** _"This project's reported cost per km is 35% above the district median for comparable roads."_
**Forbidden:** _"This contractor stole money"_ / _"This looks like corruption"_ / _"funds were diverted."_

## Architecture — grounded, not generative-from-scratch

```text
user question / summary request
        │
        ▼
[ scope resolver ]  → structured filters (district, FY, category, project)
        │
        ▼
[ retriever ]  → pulls ONLY canonical rows + precomputed analytics for that scope
        │        (Postgres + vector index over official source-document text)
        ▼
[ context builder ]  → assembles figures + provenance into a strict context block
        │
        ▼
[ LLM w/ system prompt + guardrails ]  → draft answer + citations
        │
        ▼
[ output validator ]  → neutrality classifier + citation check + numeric check
        │        (blocks/rewrites anything failing; logs the decision)
        ▼
answer + citations + guardrail note   (else safe refusal)
```

**Retrieval-Augmented Generation** ensures the model reasons over *supplied* official figures rather than its training memory. If the retriever returns nothing for a scope, the answer is _"No ingested official records cover this,"_ never a guess.

## Guardrail stack (defense in depth)

1. **Grounding constraint:** the prompt contains only ledger-derived facts + provenance; the model is instructed to answer solely from them and to cite each figure.
2. **System prompt rules:** encodes the prohibitions above; requires neutral, comparative phrasing; requires "insufficient data" when unsupported.
3. **Numeric fidelity check:** every number in the answer must match a retrieved figure (within formatting tolerance); mismatches are rejected.
4. **Neutrality classifier (post-generation):** a checker scans output for accusatory/legal/intent language and for unsupported causal claims. Fails → regenerate once with a stricter instruction, else fall back to a template summary.
5. **Citation enforcement:** every factual sentence must map to ≥1 `source_document_id`; uncited claims are stripped.
6. **Human-reviewable log:** each answer stores prompt, retrieved context, raw output, validator verdict, and final text (audit + continuous evaluation).

## Templated fallback (deterministic safety net)

When confidence is low or the validator blocks free-form output, the layer emits a **template-filled** summary that is guaranteed neutral:

```text
"For {scope}, ingested official records show ₹{allocated} allocated, ₹{released} released,
and ₹{utilized} utilized ({estimate_type}). The reported utilization deviates from the
released amount by {deviation_pct}%. {n} comparable projects in {district} have a median
cost per km of ₹{median}. Figures are drawn from the sources listed. Some records may be
missing; see data-coverage notes."
```

Templates carry the same citations and never contain adjectives of judgment.

## Prompt contract (illustrative system prompt)

```text
You are LokDarpan's neutral public-finance explainer. You may ONLY use the figures in
CONTEXT, each of which has a source id. Rules:
- State facts and numeric comparisons only. Never allege wrongdoing, corruption, fraud, or
  intent. Never use legal-liability terms. Never assert WHY a difference exists.
- Cite a source id for every figure you mention.
- If CONTEXT lacks the answer, say the records are insufficient. Do not use outside knowledge.
- Prefer phrasing like "deviates from", "is X% above/below the median", "records are missing".
Output: a short neutral summary + a citations list.
```

## Evaluation & monitoring

- **Red-team suite:** adversarial prompts trying to elicit accusations ("Isn't this corruption?") — the layer must deflect to neutral facts or refuse. Run in CI.
- **Golden-set factuality:** questions with known correct figures; check numeric accuracy and citation coverage.
- **Neutrality regression:** the classifier is itself tested; any accusatory leakage is a release blocker.
- **Drift watch:** sample production answers for manual review; feed failures back into prompts/classifier.

## Model & privacy notes

- Model choice is pluggable; the guardrail stack is model-independent so the platform's guarantees don't depend on a specific vendor.
- The AI reads only public official data; no personal user data is sent beyond the question. Prompts/answers are logged for audit but scrubbed of any incidental PII.
- The AI layer is **advisory and explanatory**; the authoritative artifacts remain the source-linked figures and the deterministic analytics ([06](./06-Analytics-Engine.md)–[08](./08-Road-Infrastructure-Intelligence.md)). If AI and ledger ever disagree, the ledger wins and the answer is suppressed.

This layer's constraints are a direct implementation of [15 — Legal & Ethical Rules](./15-Legal-Ethical-Rules.md).
