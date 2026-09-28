---
"@lokdarpan/ingestion": minor
---

`tenders:review` lists unplaced, undecided tenders grouped by issuing office, with what each
group's own text names, and writes a sheet with `--csv`. A suggestion is always the tender's own,
never its group's, and short town names must match a district exactly. `tenders:place` accepts
several `--tender` ids for one decision each. The three new commands now accept their flags after
pnpm's `--`, which they refused before.
