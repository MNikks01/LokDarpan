# Placing tenders in districts

How a tender reaches a district, and the operator's part in it. The rules are
[ADR-067](../adr/067-a-tender-district-can-be-inferred-and-says-so.md) and
[ADR-068](../adr/068-a-reviewer-decides-what-no-rule-can.md); this is the runbook.

The collector resolves every tender it reads, in a fixed order: the district its chain names (as
the ledger spells it, or by an approved alias) → its pincode → its location → unresolved. Nothing
here is needed for that to happen each night. What follows is the reference data it reads, the
backfill for tenders no longer listed, and the review of what no rule can place.

All commands run from the repository root with `pnpm --filter @lokdarpan/ingestion <script>`.
Use the **direct** Neon string (no `-pooler`), as for migrations.

## 1. Load the pincode directory

The pincode and place-name steps infer nothing until the Department of Posts directory is loaded.
Source and licence: [`pincode-directory-findings.md`](../06-government-sources/pincode-directory-findings.md).

**Through the API**, once a data.gov.in account has issued a key:

```bash
DATABASE_URL='<direct owner string>' DATA_GOV_IN_API_KEY='<key>' \
  pnpm --filter @lokdarpan/ingestion ingest:pincodes -- --api
```

**From a file** downloaded in a browser from the resource page:

```bash
DATABASE_URL='<direct owner string>' pnpm --filter @lokdarpan/ingestion ingest:pincodes -- \
  --file ~/Downloads/pincode.csv \
  --source-url 'https://www.data.gov.in/resource/<the page it came from>' \
  --retrieved-at 2026-10-01T10:00:00Z
```

Never fetch data.gov.in pages or files with a program: its `robots.txt` is `Disallow: /`. The API
is the sanctioned channel. Each load replaces the previous one in a single transaction; the raw
bytes are kept in the raw store, so every inferred district traces to them.

## 2. Backfill

```bash
DATABASE_URL='<direct owner or ETL string>' \
  pnpm --filter @lokdarpan/ingestion tenders:resolve -- --dry-run
```

Prints, per collected state, how many unplaced tenders would now be placed and how many remain. Run
it again without `--dry-run` to write the placements. It only touches unplaced tenders, never
replaces a placement, and skips tenders a reviewer has decided.

Run it after loading the directory, after approving an alias, and after any change to the
resolution rules. The nightly collector already re-resolves every tender still listed.

## 3. Read the review list

```bash
DATABASE_URL='<reviewer, ETL or owner string>' \
  pnpm --filter @lokdarpan/ingestion tenders:review                    # every state
… tenders:review -- --state 16                                          # one state, by LGD code
… tenders:review -- --csv ~/review.csv                                  # every tender, as a sheet
```

Read-only. Unplaced, undecided tenders are grouped by **issuing office** (the chain's deepest
segment), largest group first, because an office's tenders usually share an answer. Each group says
what its tenders' own text names:

| Hint                        | What to do                                                                |
| --------------------------- | ------------------------------------------------------------------------- |
| names _District_ (LGD code) | Read the tenders; if they are that district's, place them (§5).           |
| … in _k_ of _n_             | Only _k_ tenders name it. Decide those; read the rest separately.         |
| names several districts     | Usually cannot be placed in one district: record that, with the reason.   |
| names no place              | A state-level body or "As Per Tender Document": usually cannot be placed. |
| a town or office only       | Wait for the pincode directory (§1), or read the tender and decide.       |

A hint is the tender's text, never a decision. The CSV's `suggested_district` is what **that
tender's** text names, never its group's, and `decision` is left empty for you. Short town names
must match a district exactly: "Singa" is not read as Siang.

## 4. Approve an alias

An alias is a name a chain uses for a district the ledger spells differently ("Muktsar" for Sri
Muktsar Sahib). They live in [`data/reference/district-aliases.json`](../../data/reference/district-aliases.json).

1. Add the entry with `"status": "proposed"`, the state and district LGD codes, and the evidence:
   which chains use the name, and why it can mean only that district in that state.
2. A name that could mean two districts ("Imphal": East or West) is **never** an alias. It goes to
   review (§3, §5).
3. To approve, set `"status": "approved"`, `reviewed_by` and `reviewed_on`, in a pull request.
   `district-aliases.test.ts` refuses an approval without both.
4. Once merged, run §2 to place tenders that are no longer listed.

## 5. Place a tender by hand

### Once: a reviewer login

Migration 0035 gives the `lokdarpan_reviewer` role exactly what a decision needs: read tenders,
insert decisions, set the six placement columns. It cannot change what a portal published or
rewrite a decision. Create a login that inherits it, in the Neon SQL editor as the owner, with a
password from your password manager:

```sql
CREATE ROLE lokdarpan_review_prod LOGIN PASSWORD '<generated>';
GRANT lokdarpan_reviewer TO lokdarpan_review_prod;
```

Keep its connection string out of the repository, as with every other credential.

### Each decision

Read the tender on its portal, using the review list from §3, then either place it:

```bash
DATABASE_URL='<reviewer string>' pnpm --filter @lokdarpan/ingestion tenders:place -- \
  --portal manipur --tender '<portal tender id>' --district 256 \
  --by '<your name>' --reason 'Chain names Imphal West Division, Lamphel'
```

or record that it cannot honestly be placed in one district:

```bash
… tenders:place -- --portal manipur --tender '<id>' --cannot-place \
  --by '<your name>' --reason 'State-level office; no district named'
```

`--tender` may be repeated: each tender gets its own decision with the same district, reviewer
and reason, and one that is refused (another state's district, already placed) is reported without
stopping the rest. `--district` is the district's LGD code, and must be a district of the tender's
own state. Every
decision needs a name and a reason; none can be edited. A later decision supersedes an earlier one.
The collector never overrides a manual placement. Readers see "Placed by a reviewer"; the
reviewer's name stays in the ledger.

## Checking the result

```sql
SELECT district_source, count(*) FROM tender GROUP BY 1 ORDER BY 2 DESC;
SELECT count(*) FROM tender_district_decision;
```

`district_source` is null for unplaced tenders; `pincode`, `place_name` and `manual` are the ones
the issuing office did not name, and the map says how many of those it shades.
