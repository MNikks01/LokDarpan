---
"@lokdarpan/ingestion": minor
---

Collect MSIDC's "E-Tenders for Maharashtra PWD Projects" (290 notices, February 2024 on), the
first source for PWD-programme works. Agency listings now share one collector: `ingest:agency
--source=mhada|msidc` replaces `ingest:mhada`. MSIDC's own date errors are kept as printed and
flagged, never corrected; a notice shared by several package rows is fetched once and each row's
facts are kept as their own sighting.
