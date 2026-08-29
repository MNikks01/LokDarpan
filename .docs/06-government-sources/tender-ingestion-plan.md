# Tender data — what can be collected, and how it would be built

**Status:** Design note · 29 August 2026 · extends [`gepnic-access-findings.md`](./gepnic-access-findings.md)

Asked: extract everything from `mahatenders.gov.in`, then store, process and render it.

The answer to the first half is that we cannot, and the reason is not a technical obstacle to be engineered around. The second half is worth building anyway, against the sources that are open.

---

## 1. Mahatenders is closed, re-verified today

```text
GET https://mahatenders.gov.in/robots.txt      200 OK      29 Aug 2026

User-agent: *
Disallow: /
```

Unchanged since its `Last-Modified` of 9 February 2016. Three independent reasons this route stays shut, any one of which is sufficient:

1. **The publisher disallows crawling.** [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and `docs/15` make honouring `robots.txt` non-negotiable. This is the project's own rule, adopted before the portal was surveyed.
2. **Award data is CAPTCHA-gated platform-wide** — every GePNIC deployment tested, and CPPP. A CAPTCHA is a publisher stating that access should be interactive. [`access-and-permissions.md`](./access-and-permissions.md) §Standing rule records it as **never bypassed**.
3. **The prize is not behind that wall anyway.** Scraping the landing page yields roughly 21 current tenders and zero awards. Who won, and for how much, is not reachable by crawling on any GePNIC portal in the country.

A fourth point, easy to miss: **a tender is not an award.** Everything collectable below is an _advertisement of intent to buy_. It says nothing about who was paid. Treating the two as one is the single most likely way this dataset gets misread.

### Routes 1 and 2, re-checked

| Route                              | Status                | Evidence                                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official API / bulk export         | **Still unknown**     | Cannot be established without crawling the host. Only Route 4 resolves it.                                                                                                                                                                      |
| `data.gov.in` — Maharashtra tender | **Closed, re-tested** | Catalogue queried 29 Aug via the sanctioned API: `filters[title]=procurement` returns 242 datasets, the 12 Maharashtra ones all agricultural (paddy, coarsegrains, MSP). `filters[title]=tender` returns 6, all _tender coconut_ market prices. |

The `data.gov.in` API is a **sanctioned channel** — the publisher built it for programmatic access — so using it is not crawling, per [`access-and-permissions.md`](./access-and-permissions.md) §"`robots.txt` governs crawling, not sanctioned APIs". That reasoning does not extend to JSON endpoints discovered inside a disallowed site.

---

## 2. What is actually collectable

### 2a. GePNIC landing pages — 34 permitting states, available now

~21 current tenders per portal, no CAPTCHA, no stated crawl restriction. One request per portal per day.

**Its limits are the point, not the footnote:**

- **Forward-only.** It accumulates the tender universe from the day collection starts. It does not backfill. A tender advertised last year is not recoverable this way, and the UI must never imply otherwise.
- **Not Maharashtra.** Phase 1's state is `Disallow: /`. Coverage would begin in the eight states where both procurement and treasury are open — Tamil Nadu, Odisha, Kerala, Rajasthan, Andhra Pradesh, Telangana, West Bengal, Punjab.
- **Advertisements, never outcomes.** No award, no winner, no contract value paid.

That is a genuine dataset — a national picture of what governments are advertising to buy, built one honest request per portal per day — provided it is never dressed up as procurement _outcomes_.

### 2b. Written permission — Route 4, still unattempted

The highest-value unexplored path, and the only one that resolves Route 1. For a public-interest platform built entirely on official records, asking the department is not a fallback; it is the appropriate approach, and it may yield a better feed than crawling ever would — awards included, and structured.

This is the recommendation. Everything below is buildable in the meantime.

---

## 3. Storage

Follows the pattern already in the ledger. No new mechanism.

```sql
-- Raw first, immutable and content-addressed. Already exists.
--   source_artifact(sha256, source_url, retrieved_at, http_status, storage_path)

CREATE TABLE tender (
  id                    BIGSERIAL PRIMARY KEY,
  portal_code           TEXT NOT NULL,          -- which GePNIC deployment
  tender_reference      TEXT NOT NULL,          -- the portal's own reference
  title                 TEXT NOT NULL,
  organisation          TEXT,

  -- Nullable, and resolved by matching rather than assumed. A tender naming an
  -- organisation is not a tender located in a place.
  admin_unit_id         BIGINT REFERENCES admin_unit(id),
  linkage_confidence    NUMERIC(4,3),

  -- Paise, never a float, never a JSON number. A national multi-year aggregate
  -- exceeds Number.MAX_SAFE_INTEGER and would fail silently.
  value_paise           NUMERIC(20,2),

  published_at          DATE,
  closing_at            TIMESTAMPTZ,

  -- OBSERVATION WINDOW, not publication history. Collection is forward-only, so
  -- the ledger must record when WE saw a thing, distinctly from when the
  -- government published it. Without this the dataset silently claims a
  -- completeness it does not have.
  first_seen_at         TIMESTAMPTZ NOT NULL,
  last_seen_at          TIMESTAMPTZ NOT NULL,

  source_sha256         TEXT NOT NULL REFERENCES source_artifact(sha256),
  dataset_version_id    BIGINT NOT NULL REFERENCES dataset_version(id),
  extraction_confidence NUMERIC(4,3) NOT NULL,

  UNIQUE (portal_code, tender_reference)
);

-- When collection for a portal started, so a gap can be told apart from a
-- silence. "We hold nothing before this date" is a fact about us, and the
-- reader is entitled to it.
CREATE TABLE tender_collection_window (
  portal_code      TEXT PRIMARY KEY,
  collecting_since DATE NOT NULL,
  last_success_at  TIMESTAMPTZ,
  note             TEXT
);
```

**What is deliberately absent.** No `award` table, no `winner`, no `contractor_id` — we have no award data, and a nullable column invites a UI to imply we might. When Route 4 lands, that is a migration with a real source behind it.

## 4. Processing

Four stages, mirroring the BEAMS and CAG connectors:

1. **Fetch** — one request per portal per day, `robots.txt` re-checked before each run and the fetch abandoned if the policy changed. Store raw, content-addressed, before parsing.
2. **Parse** — pure functions over stored bytes, as in `services/ingestion/src/osm/boundaries.ts`. Refuse rather than guess: a row whose value will not parse as money is rejected with a reason, not coerced to zero.
3. **Link** — resolve `organisation` to an `admin_unit` where it can be done confidently, and record `linkage_confidence`. A tender that cannot be placed stays unplaced. **Missing is never zero.**
4. **Load** — upsert on `(portal_code, tender_reference)`, advancing `last_seen_at`. A savepoint per row, so one malformed tender cannot abort a portal's batch — the lesson from Ladakh in `osm/load.ts`.

## 5. Rendering

The hard part is not the component; it is not overstating what we hold.

- **On a unit page:** "Tenders advertised" as its own section, never merged into the money trail. Advertising intent and spending money are different quantities, exactly as release variance and allocation variance are.
- **Every list states its window:** "LokDarpan has collected tenders from this portal since 12 September 2026. Earlier tenders were published but are not held." This is the tender equivalent of the missing-data state, and it is mandatory.
- **No contractor anything.** No winner, no score, no rank, no badge. `.docs/17-legal/legal-ethical-rules.md` and the omission tracked in `.docs/05-data-model/screen-data-matrix.md` §3 both hold here.
- **No red.** A closing date is not a warning.
- **Provenance per figure**, as everywhere: `<Figure>` requires it, and a tender value without its source artefact does not render.

---

## 6. Recommendation

1. **Write to the Government of Maharashtra** (Route 4). It is the only path to award data and to Route 1, and it is slow — so it should start first.
2. **Build the GePNIC landing-page connector against Tamil Nadu**, an unrestricted portal, proving the shape end to end. It is the same parameterised connector for ~28 states.
3. **Do not build a Mahatenders scraper.** Not as a spike, not behind a flag, not "for testing". The finding is recorded; the door is closed by the publisher, not by us.
