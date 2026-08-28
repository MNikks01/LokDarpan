-- 0008 · A role for the human reviewer.
--
-- Review is the one write path to the ledger that is not ETL, and the only
-- one a person drives by hand. Migration 0002 made the API read-only so a
-- defect in a read path could not write to the canonical record; this grants
-- back the narrowest possible slice needed to record a review decision, and
-- nothing else.
--
-- The grant is column-scoped on purpose. A reviewer can set a status, sign it,
-- add a note and supply a corrected value — but cannot touch raw_text,
-- normalised_value, page_number or document_id. So the brief's rule "never
-- modify the original source document" is enforced by Postgres rather than by
-- the review tool remembering to leave those columns alone: a correction is
-- always recorded *beside* what the parser read, never on top of it, and the
-- original stays visible for anyone auditing the decision later.
--
-- The role is NOLOGIN and holds no password. A login user is created
-- separately and granted this role, so no credential enters a migration.
--   * local development -> database/scripts/create-local-reviewer-user.sql
--   * deployed environments -> created by operations, granted this role

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_reviewer') THEN
        CREATE ROLE lokdarpan_reviewer NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO lokdarpan_reviewer;

-- A reviewer must read the candidate, the document it came from and the
-- artefact that proves where it was published. Judging a claim without its
-- provenance is exactly the thing this project exists to avoid.
GRANT SELECT ON document_fact, document, document_page, source_artifact
    TO lokdarpan_reviewer;

-- The whole privilege, stated exactly. Anything not named here is refused by
-- the database, including every column that carries what the source said.
GRANT UPDATE (
    verification_status,
    verified_by,
    verified_at,
    corrected_value,
    reviewer_note
) ON document_fact TO lokdarpan_reviewer;

-- Reviewing is judging what the parser produced, never adding to it or
-- discarding it. A new candidate comes from a parser run with its version
-- recorded; a deletion would erase the evidence that a claim was ever
-- considered and rejected.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON document_fact
    FROM lokdarpan_reviewer;
REVOKE CREATE ON SCHEMA public FROM lokdarpan_reviewer;

COMMENT ON ROLE lokdarpan_reviewer IS
    'Records review decisions on document_fact. Cannot alter what the parser read, insert or delete.';
