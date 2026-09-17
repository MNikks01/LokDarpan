---
"@lokdarpan/web": minor
"@lokdarpan/database": minor
"@lokdarpan/contracts": minor
---

Name the real dataset version on every explorer response.

The seven explorer routes returned `datasetVersion: 0`, and every response's `asOf` was the time
it was served. Neither described the data, so nothing could tell which state of the ledger a page
came from.

A response's version is now the newest dataset version committed when it was read, and `asOf` is
when that version was opened. Each route reads inside one read-only snapshot
(`readLedger`), so a load that commits mid-request cannot put rows from one state under the version
of another. Routes whose version comes from their rows keep it, and now report that version's date
instead of the time of the request.

`EnvelopeMetaSchema.asOf` may be `null`, only for a ledger no load has written to.
