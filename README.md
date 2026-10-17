# LokDarpan (लोकदर्पण)

**A public-finance, governance and infrastructure intelligence platform for India, built entirely on official government records.**

LokDarpan links official records into one traceable ledger — revenue → budget → ministry → state → district → local body → department → scheme → tender → contractor → release → expenditure → work progress → completion → audit — and runs mathematical-consistency and variance checks over them.

**It is:** a transparency and public-understanding tool · a mathematical-consistency checker over official records · an anomaly _highlighter_ with full source traceability.

**It is NOT:** an anti-corruption or accusation engine · a legal authority or investigator · a source of allegations about any individual or organization.

> Every figure is traceable to an official source. Every observation is a neutral, factual statement — never an accusation.
> [`.docs/17-legal/legal-ethical-rules.md`](.docs/17-legal/legal-ethical-rules.md) is **binding on every other document and every component.**

## Status

**Deployed, with a narrow ledger.** The web client is first; the mobile app follows after launch ([`.docs/decisions/web-first-pivot.md`](.docs/decisions/web-first-pivot.md)). What is deployed, what the production ledger holds, and what is open are kept in one place: [`.docs/00-overview/current-state.md`](.docs/00-overview/current-state.md).

|                            |                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Government source registry | 107 curated sources, 104 verified ([`.docs/06-government-sources/`](.docs/06-government-sources))                                      |
| `apps/web`                 | Deployed on Vercel from `main`: map explorer; unit, body, department and document pages; a corrections form; `/api/v1`                 |
| `services/ingestion`       | Real: LGD, OpenStreetMap, CAG, BEAMS, GePNIC, MHADA and MSIDC collectors; tenders collected nightly                                    |
| `services/ocr`             | Real (Python, Tesseract). Readings sit beside the page; a figure read from a scan is a candidate a person reviews                      |
| Database                   | PostgreSQL + PostGIS on Neon; migrations applied to production are listed in `current-state.md`                                        |
| Production ledger          | States and districts with boundaries; 30 CAG audit reports with 5,088 reviewed figures; open tenders from 21 states. No budget figures |
| Not yet started            | `services/{ai,analytics,entity-resolution,normalization,risk-engine}`; project and contractor data (no permitted source yet)           |

**Only the example project page renders fixture data**, and it says so.

## Layout

```text
.docs/          Product + engineering source of truth (start at .docs/README.md)
apps/web/       Next.js public site — the first product
apps/mobile/    React Native / Expo — deferred until after web launch
services/       ingestion · ocr · api (real) — normalization · entity-resolution · analytics · risk-engine · ai (empty)
packages/       money · neutrality · contracts · domain · database · observability · errors · architecture
data/           raw (immutable) · staging · normalized · reference · fixtures · samples
database/       migrations · seeds · functions · views
infrastructure/ placeholders only — the site runs on Vercel, the ledger on Neon, collection on GitHub Actions
```

The full map, with what each part enforces, is [`.docs/02-architecture/repository-structure.md`](.docs/02-architecture/repository-structure.md).

## Getting started

```bash
pnpm install
pnpm test                 # ~1,790 tests; integration suites skip without a database
pnpm dev                  # web client at http://localhost:3000
pnpm neutrality           # the language gate of .docs/17-legal — a hit blocks release
```

Requires Node ≥20 and pnpm 9.

### With a database

Needed for the schema tests and anything touching the ledger. Without it those tests **skip** rather than fail, so this is optional until you work on data.

```bash
cp .env.example .env.local
docker compose up -d                          # Postgres+PostGIS on 5433, Redis on 6380
pnpm --filter @lokdarpan/database migrate      # apply database/migrations/*.sql

# Create the read-only user the API connects as (once)
docker exec -i lokdarpan-postgres psql -U lokdarpan -d lokdarpan \
  < database/scripts/create-local-api-user.sql

set -a && . ./.env.local && set +a && pnpm test
```

**Two database users, deliberately.** ETL and migrations connect as the owner — the only write path to the ledger. The API connects as `lokdarpan_api`, which holds `SELECT` and nothing else (migration `0002`). The API **verifies this at startup and exits `78` if its credentials can write**, so handing it the owner's connection string is a failed deploy rather than a service quietly holding write access to the canonical record.

Host ports are **5433 and 6380**, not the defaults, so LokDarpan runs alongside another project's Postgres or Redis without a collision.

Migrations are plain SQL applied in filename order, and **an applied migration is immutable** — the runner refuses to run if a file's checksum no longer matches what was applied ([`adr/017`](./.docs/adr/017-database-migrations.md)). Add a new migration instead of editing one.

## Two invariants worth knowing before you write code

**Money is `bigint` paise, never a float.** A national multi-year aggregate exceeds `Number.MAX_SAFE_INTEGER` and would fail _silently_ — producing a wrong government figure with a correct-looking source link. See [`packages/money`](./packages/money).

**A figure cannot be rendered without its provenance.** `<Figure>` requires a `provenance` prop; it is a compile error, not a review note. Neutral copy cannot be authored in a component — observation text is typed as `ServerText` and can only originate from the API. See [`packages/neutrality`](./packages/neutrality).

More in [`CLAUDE.md`](./CLAUDE.md).

## Contributing

The platform grows by **source coverage**, not feature count — the highest-value contribution is a connector for a government source not yet ingested. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

If you speak Marathi or Hindi, the forbidden-language vocabulary in `packages/neutrality` needs native-speaker review. A word we failed to list is a word that ships.

Security issues: [`SECURITY.md`](./SECURITY.md) — and note that **security testing must never be directed at government portals.**

## Licence

**Apache-2.0** — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE), decided in [`adr/015`](./.docs/adr/015-code-licence.md).

The licence covers the **source code**. It confers no rights over the government records the platform ingests — those remain subject to their issuing authority's terms, recorded per source in [`.docs/06-government-sources/`](./.docs/06-government-sources/).

---

_LokDarpan is an independent public-interest project. It is not affiliated with, endorsed by, or operated by any government body, agency, or political party._
