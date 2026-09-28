-- 0035 · A reviewer places what no rule could, and the decision is kept.
--
-- The resolver (ADR-067) leaves a tender unplaced when nothing it reads is
-- unanimous: "Imphal" spans Imphal East and Imphal West, and no rule may
-- choose between them. A person reading the tender can. This records that
-- person's decision the way review decisions on document facts are recorded
-- (0008, 0009): a narrow, column-scoped grant, and a history nobody edits.
--
-- A DECISION IS EITHER A DISTRICT OR "CANNOT BE PLACED"
-- admin_unit_id NULL records that a reviewer read the tender and found no
-- district it could honestly be put in. That takes it off the review list
-- without placing it — an unplaced tender is visibly missing, and saying so
-- after looking is different from never having looked.
--
-- THE LEDGER ROW POINTS AT ITS DECISION
-- A manual placement writes district_source = 'manual' and
-- district_evidence_key = 'decision:<id>', so the row cannot claim a reviewer
-- without naming the decision. The collector never replaces a manual
-- placement; only a later decision does.

CREATE TABLE tender_district_decision (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tender_id BIGINT NOT NULL REFERENCES tender (id) ON DELETE CASCADE,
    -- NULL: the reviewer found no district the tender can honestly be put in.
    admin_unit_id BIGINT REFERENCES admin_unit (id),
    decided_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tender_district_decision_signed CHECK (btrim(decided_by) <> ''),
    CONSTRAINT tender_district_decision_reasoned CHECK (btrim(reason) <> '')
);

CREATE INDEX tender_district_decision_tender_idx
    ON tender_district_decision (tender_id, decided_at DESC);

COMMENT ON TABLE tender_district_decision IS
    'Append-only record of reviewers placing a tender no rule could place, or recording that it cannot be placed. Who, why and when; never edited.';

ALTER TABLE tender
    ADD CONSTRAINT tender_manual_names_its_decision CHECK (
        district_source IS DISTINCT FROM 'manual'
        OR district_evidence_key LIKE 'decision:%'
    );

-- The reviewer reads what the tender says and where it could go …
GRANT SELECT ON tender, admin_unit, tender_collection_window, tender_district_decision
    TO lokdarpan_reviewer;
-- … records a decision, and may not rewrite one …
GRANT INSERT ON tender_district_decision TO lokdarpan_reviewer;
GRANT USAGE ON SEQUENCE tender_district_decision_id_seq TO lokdarpan_reviewer;
REVOKE UPDATE, DELETE, TRUNCATE ON tender_district_decision FROM lokdarpan_reviewer;
-- … and sets the placement, and nothing the portal published.
GRANT UPDATE (
    admin_unit_id,
    district_source,
    linkage_confidence,
    district_evidence_sha256,
    district_evidence_key,
    district_resolved_at
) ON tender TO lokdarpan_reviewer;

-- The collector reads decisions so the review list can leave out what a
-- reviewer has already looked at. It never writes one.
GRANT SELECT ON tender_district_decision TO lokdarpan_etl;
