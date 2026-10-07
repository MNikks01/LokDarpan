---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
"@lokdarpan/domain": minor
"@lokdarpan/web": minor
---

Governments and departments, named by the audit report pages that name them (ADR-074). The CAG
extractor proposes `body_reference` candidates, one per name per report; a person reviews them
(`review --kind=body_reference --state=27`); `ingest:bodies` builds `public_body` and its mentions
from the confirmed ones. Each body has a page listing the reviewed pages that name it, and state
pages list their governments and departments. A mention cites a page; it never attributes that
page's figures to the body.
