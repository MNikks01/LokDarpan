-- 0024 · One row per ingestion execution.
--
-- WHY dataset_version IS NOT THIS
-- `dataset_version` already exists and is deliberately not extended here. It
-- answers "which vintage of the data is this figure from" — it is stamped on
-- every row a load writes and is what the web tier revalidates against. It
-- carries a description and nothing else: no status, no counts, no end time. A
-- version that could fail would stop being a version.
--
-- This answers a different question: what happened when we ran. A run that
-- collected nothing and a run that failed produce the same ledger — no new
-- rows — and without this table they are indistinguishable afterwards, which is
-- how "0 records" comes to be reported as a fact about the government.
--
-- A run is opened before any work and closed after it, so a run left `running`
-- with an old `started_at` is itself the signal that a collector died.

CREATE TYPE ingestion_run_status AS ENUM ('running', 'succeeded', 'failed');

CREATE TABLE ingestion_run (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Which collector, at the granularity the collector is scheduled at:
    -- `gepnic-kerala`, `osm-boundaries`, `cag`. Matches source_artifact.source_id
    -- where one is written, so a run and its bytes can be lined up.
    source_id TEXT NOT NULL,

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status ingestion_run_status NOT NULL DEFAULT 'running',

    -- Counts are separate because they answer different questions, and a single
    -- "records" figure hides all of them. `unchanged` is the one most easily
    -- omitted and the most useful: a run where everything was unchanged is a
    -- healthy run, and looks identical to a run that collected nothing unless
    -- it is counted.
    records_seen INTEGER NOT NULL DEFAULT 0,
    records_inserted INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_unchanged INTEGER NOT NULL DEFAULT 0,
    records_rejected INTEGER NOT NULL DEFAULT 0,
    -- Held, valid, and not attributable to a place we know. Not a rejection:
    -- an unplaced tender is a real advertisement by a real office.
    records_unresolved INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,

    -- What went wrong, in the run's own words. First line only by convention;
    -- the collector's logs hold the rest.
    note TEXT,

    CONSTRAINT ingestion_run_completed_when_finished CHECK (
        (status = 'running') = (completed_at IS NULL)
    ),
    CONSTRAINT ingestion_run_counts_not_negative CHECK (
        records_seen >= 0 AND records_inserted >= 0 AND records_updated >= 0
        AND records_unchanged >= 0 AND records_rejected >= 0
        AND records_unresolved >= 0 AND error_count >= 0
    )
);

COMMENT ON TABLE ingestion_run IS
'One row per ingestion execution. A failed run is recorded, never silently indistinguishable from a run that found nothing.';

CREATE INDEX ingestion_run_source_idx ON ingestion_run (source_id, started_at DESC);
