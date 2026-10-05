---
"@lokdarpan/ingestion": minor
"@lokdarpan/domain": minor
"@lokdarpan/web": patch
---

Tender notices are read for their facts, each kept with the page it came from: the MahaTenders
tender ID and the department's reference from a GePNIC printout, the notice number and issuer
reference from an agency's letter, the EMD and fees in paise, and every labelled date. Two new fact
kinds, `tender_identifier` and `tender_date`, and a `field` on every fact (migration 0041) name which
field of a notice it fills, since a notice states four amounts. All are unverified candidates. Dates
in letters are read day-first and marked for review where both orders form a date.
`loadFactCandidates` now takes the parser that produced the candidates, defaulting to the CAG one.
