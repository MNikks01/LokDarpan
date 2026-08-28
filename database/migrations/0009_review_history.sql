-- 0009 · An append-only record of every review decision that was replaced.
--
-- Migration 0008 made a decision unforgeable; it did not make one revisable.
-- The review tool refuses to touch a decided row, which stops silent
-- overwrites but leaves no deliberate way to fix a decision a reviewer later
-- judges wrong. The only remaining route was direct SQL as the owner, which
-- bypasses the audit trail entirely — a worse outcome than the problem.
--
-- So revision becomes possible, and every superseded decision is kept. A
-- published fact that changed must be able to answer "what did it say before,
-- who decided that, and why was it changed" — otherwise the correction is
-- itself an unaccountable claim.

CREATE TABLE document_fact_review_history (
    id                  BIGINT              GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_fact_id    BIGINT              NOT NULL REFERENCES document_fact (id) ON DELETE CASCADE,

    -- The decision as it stood before this change.
    verification_status verification_status NOT NULL,
    verified_by         TEXT,
    verified_at         TIMESTAMPTZ,
    corrected_value     TEXT,
    reviewer_note       TEXT,

    -- When it was superseded. Who superseded it is recorded on the row itself,
    -- which by then holds the new reviewer's signature.
    superseded_at       TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX document_fact_review_history_fact_idx
    ON document_fact_review_history (document_fact_id, superseded_at DESC);

COMMENT ON TABLE document_fact_review_history IS
    'Superseded review decisions. Append-only, written only by the trigger below.';

-- ---------------------------------------------------------------------------
-- History is written by the database, not by the application.
--
-- SECURITY DEFINER so the function runs as the table owner: the reviewer role
-- is granted no INSERT anywhere, so it cannot write a history row directly and
-- therefore cannot forge, edit or omit one. A reviewer who could author their
-- own audit trail does not have an audit trail.
--
-- search_path is pinned because a SECURITY DEFINER function inherits the
-- caller's, and a caller could otherwise resolve these names to objects of
-- their own.
-- ---------------------------------------------------------------------------
CREATE FUNCTION record_review_supersession() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only a change to a decision is history. A row moving off 'unverified'
    -- for the first time replaces nothing, and recording that would fill the
    -- table with rows saying "this used to be undecided".
    IF OLD.verification_status = 'unverified' THEN
        RETURN NEW;
    END IF;

    IF OLD.verification_status IS DISTINCT FROM NEW.verification_status
       OR OLD.corrected_value  IS DISTINCT FROM NEW.corrected_value
       OR OLD.verified_by      IS DISTINCT FROM NEW.verified_by
       OR OLD.reviewer_note    IS DISTINCT FROM NEW.reviewer_note
    THEN
        INSERT INTO document_fact_review_history (
            document_fact_id, verification_status, verified_by, verified_at,
            corrected_value, reviewer_note
        ) VALUES (
            OLD.id, OLD.verification_status, OLD.verified_by, OLD.verified_at,
            OLD.corrected_value, OLD.reviewer_note
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER document_fact_review_supersession
    BEFORE UPDATE ON document_fact
    FOR EACH ROW EXECUTE FUNCTION record_review_supersession();

-- The reviewer may read what was decided before, and may not write it.
GRANT SELECT ON document_fact_review_history TO lokdarpan_reviewer;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON document_fact_review_history
    FROM lokdarpan_reviewer;

-- ---------------------------------------------------------------------------
-- A published fact says whether it has been revised.
--
-- A reader comparing this site to the document is entitled to know a figure
-- was changed after first being published. Hiding that would make a quiet
-- correction indistinguishable from a first reading.
--
-- Recreated rather than replaced: CREATE OR REPLACE VIEW cannot insert a
-- column into the middle of the list.
-- ---------------------------------------------------------------------------
DROP VIEW published_fact;

CREATE VIEW published_fact AS
SELECT
    f.id,
    f.document_id,
    f.page_number,
    f.kind,
    f.raw_text,
    COALESCE(f.corrected_value, f.normalised_value) AS value,
    f.verification_status,
    f.verified_by,
    f.verified_at,
    f.reviewer_note,
    (SELECT count(*) FROM document_fact_review_history h
      WHERE h.document_fact_id = f.id) AS revision_count,
    d.title        AS document_title,
    s.source_url,
    s.retrieved_at
FROM document_fact f
JOIN document d        ON d.id = f.document_id
JOIN source_artifact s ON s.sha256 = d.source_sha256
WHERE f.verification_status IN ('verified', 'corrected');

COMMENT ON VIEW published_fact IS
    'Human-reviewed facts only, each carrying its document, page, source URL and revision count.';
