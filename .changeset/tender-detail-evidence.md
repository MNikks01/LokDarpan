---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
---

Each tender now cites the detail page its department, location, value and EMD were read from
(`tender.detail_sha256`, migration 0038), and that page is kept in the raw store before the row is
written. A page that cannot be kept is treated as unread. A superseded reading keeps its page in
`tender_version`.
