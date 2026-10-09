# Reviewing places named in audit reports

**Written:** 9 October 2026 · **Decision:** [ADR-077](../adr/077-a-place-is-named-by-the-page-that-names-it.md) · **Issue:** #203

A district or taluka is pinned on the map only where a person has confirmed that an audit page names
it. This is the loop, run locally against the Docker ledger.

## 1. Bring the local ledger up to date

```bash
pnpm --filter @lokdarpan/database migrate                          # applies 0047
pnpm --filter @lokdarpan/ingestion extract:cag-facts -- --dry-run  # see what would change
pnpm --filter @lokdarpan/ingestion extract:cag-facts
```

Parser `cag-facts/25` adds `place_reference` candidates, matched against each report's own state.
On the Maharashtra reports of 9 October that is about 1,900 candidates naming 173 places. Existing
candidates and decisions are untouched (ADR-026).

## 2. Review by place

```bash
export REVIEWER='Your Name'
pnpm --filter @lokdarpan/ingestion review:places -- --state=27
```

Each place is shown once, with its page and report counts and one sentence from every report that
names it.

| What the sentences show                                                               | Press                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| The word means this district or taluka in every report shown                          | **v**: confirms every page                       |
| The word is not this place anywhere (a person's name, a scheme, another state's town) | **r**: rejects every page                        |
| It means the place in some reports and not others, or you are unsure                  | **o**: prints the command to decide page by page |

A district-wise table that lists every district names each one; that is a correct mention. A pin
says "named on these pages", not that the figures on them belong to the place.

## 3. Build the mentions

```bash
pnpm --filter @lokdarpan/ingestion ingest:places -- --state=27
```

It runs in one transaction, is safe to repeat, and removes mentions a later review withdrew. It
lists any confirmed value that names no district or taluka of the state. A corrected value must end
in "district" or "taluka", as "Gadchiroli district".

## 4. Production

As for bodies: apply 0047, run `promote:cag --refresh` (dry run first, then `--commit`), then
`ingest:places --state=27` with the production owner credential.
