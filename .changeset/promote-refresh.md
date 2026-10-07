---
"@lokdarpan/ingestion": minor
---

`promote:cag --refresh` carries review work done after promotion into production for reports both
databases hold (#190): new candidates, revised decisions with their history, retired undecided
candidates and same-figure links. Figures are matched by identity and keep their production ids;
decided figures are never deleted; the run plans again after applying and refuses to commit unless
nothing is left to do. A dry run unless `--commit` is given.
