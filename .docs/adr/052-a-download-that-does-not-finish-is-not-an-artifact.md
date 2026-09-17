# ADR-052 · A download that does not finish is not an artifact

**Status:** Accepted · **Date:** 2026-09-17 · **Implements** phase 1 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md)

## Context

Every collector read a response whole. CAG, LGD and BEAMS called `arrayBuffer()`; GePNIC and
Overpass called `text()`. None set a limit on size, and only the OCR client set a deadline.

That was harmless while collection was run by hand and watched. It stopped being harmless when the
GePNIC sweep began running daily on a schedule (`ingest-tenders.yml`). Three failures were possible
and none would have explained itself:

- **An unbounded body.** A portal returning an endless or enormous error page would grow the
  process until the runner killed it. A killed process writes no `ingestion_run` row, so the only
  record would be a missing day.
- **A stalled connection.** A host that accepts the connection and then sends nothing, or a byte a
  minute, holds the sweep open until the job's own time limit. The run would stay `running`.
- **An error page downloaded as evidence.** `CagClient.fetchReport` downloaded the whole body and
  only then checked that it was a PDF.

Node's `fetch` also undoes gzip and brotli before yielding bytes, so `content-length` describes
the compressed size. A limit that trusted the header would pass a small response that expands to
hundreds of megabytes. That was checked, not assumed: a 199 KiB gzip response of 200 MiB of zeros
was served locally and stopped at a 16 MiB limit.

God's Eye View's `readResponseTextCapped` was the model: reject an oversized declared length, count
bytes while streaming, cancel past the limit. It does not handle the decompression case or stalls
mid-body; both are handled here.

## Decision

**All network access by a collector goes through `fetchWithLimits`** in
`services/ingestion/src/net/fetch-with-limits.ts`, with limits named per source in
`services/ingestion/src/net/limits.ts`.

- **Four limits, each reported by name:** decoded body bytes, time to headers, silence between
  chunks, and total time. `FetchLimitExceeded.limit` says which one was reached, and the message
  leads with the reason, because run summaries keep only the start of the message.
- **Refuse before downloading.** A caller can inspect status and headers first. The CAG report,
  GePNIC page and Overpass query clients do so, and a refused body is cancelled, not read.
- **No partial result.** A body that did not complete is an error. It never reaches a parser or
  the raw store.
- **Limits come from measurement.** A byte limit is four times the largest artefact of that kind in
  the raw store, rounded up to a power of two. Measured on 2026-09-17: CAG 28.8 MB → 128 MiB,
  BEAMS 1.0 MB → 4 MiB, LGD 135 KB → 1 MiB. GePNIC pages and Overpass responses are not kept in
  the raw store, so their limits are generous ceilings (16 MiB and 256 MiB), marked as unmeasured.
- **Timeouts match how the source behaves.** Government hosts get 30 s to headers and 60 s of
  silence between chunks. Overpass gets 270 s to headers, because it computes the whole answer
  before sending anything and our queries allow it 240 s to do so.

## Consequences

A collector can no longer be kept alive or grown without bound by the host it is reading. A limit
reached fails the run like any other error, and the note says which limit and at which URL.

A legitimate response that grows past its limit will now fail loudly instead of succeeding. That is
the intended trade: the fix is a one-line change in `limits.ts`, visible in review, rather than a
silent memory failure in a scheduled job.

**Not in this change,** each tracked in the adoption plan: retries with a backoff ladder per host,
conditional requests (`ETag`, `Last-Modified`), streaming large PDFs to disk instead of memory,
refusing redirects to other hosts, and a byte limit on the OCR service client (an internal service
that already has a timeout).
