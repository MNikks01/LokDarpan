# LokDarpan (लोकदर्पण)

**A public-finance, governance and infrastructure intelligence platform for India, built entirely on official government records.**

LokDarpan links official records into one traceable ledger — revenue → budget → ministry → state → district → local body → department → scheme → tender → contractor → release → expenditure → work progress → completion → audit — and runs mathematical-consistency and variance checks over them.

**It is:** a transparency and public-understanding tool · a mathematical-consistency checker over official records · an anomaly *highlighter* with full source traceability.

**It is NOT:** an anti-corruption or accusation engine · a legal authority or investigator · a source of allegations about any individual or organization.

> Every figure is traceable to an official source. Every observation is a neutral, factual statement — never an accusation.
> [`.docs/17-legal/legal-ethical-rules.md`](./.docs/17-legal/legal-ethical-rules.md) is **binding on every other document and every component.**

## Status

**Specification-complete; implementation just begun.** The web client is first; the mobile app follows after launch ([`.docs/decisions/web-first-pivot.md`](./.docs/decisions/web-first-pivot.md)).

| | |
|---|---|
| Documentation | Complete — 110 documents in [`.docs/`](./.docs/) |
| Government source registry | 99 sources, 96 verified ([`.docs/06-government-sources/`](./.docs/06-government-sources/)) |
| `apps/web` | W1 foundation — builds, 38 tests passing, **fixture data only** |
| `services/*` | Not yet implemented |
| Backend / database | Not yet implemented |

**No real government data is ingested yet.** Every figure the app renders is fixture data, labelled as such.

## Layout

```text
.docs/          Product + engineering source of truth (start at .docs/README.md)
apps/web/       Next.js public site — the first product
apps/mobile/    React Native / Expo — deferred until after web launch
services/       ingestion · normalization · entity-resolution · analytics · risk-engine · ai · api
packages/       money · neutrality · contracts · domain · validation · config · database · observability · errors · utils
data/           raw (immutable) · staging · normalized · reference · fixtures · samples
database/       migrations · seeds · functions · views
infrastructure/ docker · kubernetes · terraform · monitoring
```

## Getting started

```bash
pnpm install
pnpm test                 # 38 tests: money, neutrality, contracts, palette
pnpm dev                  # web client at http://localhost:3000
pnpm neutrality apps packages   # docs/15 language gate — a hit blocks release
```

Requires Node ≥20 and pnpm 9.

## Two invariants worth knowing before you write code

**Money is `bigint` paise, never a float.** A national multi-year aggregate exceeds `Number.MAX_SAFE_INTEGER` and would fail *silently* — producing a wrong government figure with a correct-looking source link. See [`packages/money`](./packages/money).

**A figure cannot be rendered without its provenance.** `<Figure>` requires a `provenance` prop; it is a compile error, not a review note. Neutral copy cannot be authored in a component — observation text is typed as `ServerText` and can only originate from the API. See [`packages/neutrality`](./packages/neutrality).

More in [`CLAUDE.md`](./CLAUDE.md).

## Licence

**Not yet decided** — see [`LICENSE`](./LICENSE). Recommendation on file: Apache-2.0 or MPL-2.0.

---

*LokDarpan is an independent public-interest project. It is not affiliated with, endorsed by, or operated by any government body, agency, or political party.*
