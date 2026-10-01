---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
---

The bytes a ledger row cites are now kept. The GePNIC and OpenStreetMap collectors store every page
before recording it, in an S3-compatible bucket (Cloudflare R2) when one is configured, and every
new `source_artifact` row says where its bytes are (`stored_in`, migration 0037). The nightly sweep
refuses to start without the bucket. Before this, production's 125 GePNIC and 37 OSM artefacts were
hashed and never written anywhere (ADR-069).
