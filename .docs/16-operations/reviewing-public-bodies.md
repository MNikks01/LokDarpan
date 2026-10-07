# Reviewing public bodies

**Written:** 7 October 2026 · **Decision:** [ADR-074](../adr/074-a-body-is-named-by-the-page-that-names-it.md) · **Milestone:** M1 (#187)

Governments and departments enter the ledger only from a CAG page a person has confirmed names
them. This is the loop that does it, run locally against the Docker ledger.

## 1. Bring the local ledger up to date

```bash
pnpm --filter @lokdarpan/database migrate                       # applies 0045
pnpm --filter @lokdarpan/ingestion extract:cag-facts -- --dry-run  # see what would change
pnpm --filter @lokdarpan/ingestion extract:cag-facts
```

`extract:cag-facts` re-reads every held audit report with parser `cag-facts/24`, which adds
`body_reference` candidates: one per name per report, at the first page that prints it. Existing
candidates and decisions are untouched (identity-based reconciliation, ADR-026).

## 2. Review one state's names

```bash
pnpm --filter @lokdarpan/ingestion review -- --kind=body_reference --state=27
```

`--state` takes an LGD code (`27` is Maharashtra). On the corpus of 7 October that is about 220
candidates and roughly 100 distinct names. For each candidate:

| The candidate is…                                                                    | Decide                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| A whole, correctly spelled name of this state's government or one of its departments | **Verify**                                                                                  |
| The right body, spelled differently from its usual form ("Revenue & Forest")         | **Correct** to one canonical spelling, the same one every time: each spelling is a new body |
| A fragment, a heading run into a name, or a generic phrase                           | **Reject**                                                                                  |
| A body of another government ("Central Public Works Department" in a state report)   | **Reject**: the loader files a department under the report's state                          |

The loader gathers mentions by the reviewed name, so "Revenue and Forest Department" and "Revenue
and Forests Department" would be two bodies. Pick one spelling per department and keep to it.

## 3. Build the bodies

```bash
pnpm --filter @lokdarpan/ingestion ingest:bodies -- --state=27
```

It runs in one transaction, is safe to repeat, and removes mentions that a later review withdrew.
It reports any "Government of …" it could not place in the hierarchy.

## 4. Check

Open `/units/<Maharashtra's id>`: the "Governments and departments" section lists every body with a
confirmed mention. Each body's page lists the reviewed pages that name it, and links to the report.

## Production

**Not yet possible in the normal way.** `promote:cag` copies reports production does not hold; it
does not carry review decisions made after a report was promoted, and all 30 reports are already
there (#190). Until that is resolved, bodies exist locally only. Once it is, the order is: apply
0045 to production ([`applying-migrations.md`](applying-migrations.md)), promote the decisions,
then run `ingest:bodies` with the owner credential.
