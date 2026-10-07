---
"@lokdarpan/domain": minor
"@lokdarpan/web": patch
---

A restricted source is published only when a grant is recorded for it and an operator has switched
it on (ADR-073). `publicationDecision` decides from the publisher's terms, `PERMISSION_GRANTS` and
the switches, and says why when it withholds. Setting `PUBLISH_BEAMS_FIGURES` or
`PUBLISH_TENDER_DETAILS` without a recorded grant no longer publishes anything; a newly granted
source can be switched on through `PUBLISH_RESTRICTED_SOURCES` without a code change.
