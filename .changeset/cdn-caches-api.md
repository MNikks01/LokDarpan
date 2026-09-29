---
"@lokdarpan/web": patch
---

API answers are now cached at Vercel's CDN for an hour (`Vercel-CDN-Cache-Control`), served stale
while refreshing, and served stale for up to a week if the database refuses. Before this only the
reader's browser cached them, so every first request for a unit reached Neon and spent its metered
transfer. Errors are still never cached. Every payload states its `datasetVersion` and `asOf`, so a
cached answer says how old it is.
