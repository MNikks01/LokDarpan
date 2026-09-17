---
"@lokdarpan/ingestion": minor
---

Bound every collector's downloads by size and time.

CAG, LGD, BEAMS, GePNIC and Overpass read whole responses with no limit on size and no deadline.
A host serving an endless body or holding a connection open could exhaust the scheduled sweep's
memory or keep it running until the runner killed it, and a killed runner leaves no
`ingestion_run` record of why.

All five now fetch through `fetchWithLimits`, which enforces a decoded-byte limit, a deadline for
headers, a limit on silence between chunks and a total deadline, and names the limit it reached.
Decoded bytes are counted because Node undoes gzip before the body is read: a 199 KiB gzip
response expanding to 200 MiB was stopped at a 16 MiB limit when tested.

A CAG report is now refused from its status and content type before the body is downloaded, so
an HTML error page is no longer fetched in full to discover it is not a PDF. Overpass errors are
classified from the status line in the same way.

Limits come from the raw store's largest artefacts: CAG reports 128 MiB, BEAMS 4 MiB, LGD 1 MiB.
GePNIC and Overpass were not measurable locally and have generous ceilings until their sizes are
logged. No figure, parser or stored artefact changes for a response within its limits.
