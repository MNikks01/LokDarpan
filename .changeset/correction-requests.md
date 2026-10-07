---
"@lokdarpan/web": minor
"@lokdarpan/domain": minor
"@lokdarpan/ingestion": minor
---

Readers can report a data error at `/report` without an account (ADR-075). Every verified figure
links to the form with its subject filled in. A report is stored apart from the ledger, changes no
figure, identifies no one, and returns a reference; reviewers answer it with
`corrections:review`. The form's database role may submit a report and nothing else, and a
site-wide hourly ceiling holds even if the edge rate limit fails open.
