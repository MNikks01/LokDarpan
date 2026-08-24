# @lokdarpan/contracts

**The API contract, in code.** Zod schemas plus the TypeScript types inferred from them, shared by `apps/web`, `services/api`, and later `apps/mobile`.

Because the backend does not exist yet, these schemas **are** the API specification — and the day it ships they become drift detection ([`../../.docs/11-api/client-api-contract.md`](../../.docs/11-api/client-api-contract.md)).

## Why there is no separate `validation` package

An earlier draft of the layout had both `contracts/` and `validation/`. They were merged, deliberately.

The distinction was never real: contracts here *are* Zod schemas, so a separate validation package would either duplicate them or hold a thin wrapper nobody imports. An unclear boundary between two packages is worse than one package with a clear job — both end up half-used, and neither becomes the obvious place to add a schema.

**One rule: every shape that crosses the network boundary is defined here, once.**

## What lives here

| File | Contents |
|---|---|
| `src/primitives.ts` | `Amount` (decimal string, JSON numbers rejected by name), the three confidences, `Provenance` with page anchors, `Figure` (present-with-provenance \| explicitly-missing), localisable observation text |
| `src/finance.ts` | `FinanceChain` with **both** variances and a bare `variance` field refused; `VerificationPriority`, unusable without its factor breakdown |
| `src/fixtures/` | ⚠ Synthetic data only, for development before the backend exists |

## The invariants this package enforces

These are not stylistic — each corresponds to a defect found in the original documentation audit ([`../../.docs/00-overview/document-audit.md`](../../.docs/00-overview/document-audit.md)):

- **Money is a decimal string** (C3). A JSON number is rejected with a message naming the reason, because `NUMERIC(20,2)` at national scale exceeds `Number.MAX_SAFE_INTEGER` and fails silently.
- **Both variances, explicitly named** (C1). A field called `variance` must not exist — a mislabelled variance is a neutrality failure, not merely a bug.
- **Three distinct confidences** (C4): extraction, linkage, score. Conflating them hides the most serious one.
- **Provenance carries page anchors** (C8), without which "open the page this figure came from" is impossible.
- **No variance across a missing stage** — enforced by a schema refinement, not left to the caller.
