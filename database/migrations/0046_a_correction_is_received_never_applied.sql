-- 0046 · A correction is received, never applied.
--
-- WHY
-- `legal-ethical-rules.md` requires a visible way for anyone — including a
-- named department — to report a data error, and requires that corrections be
-- made by re-reading the source, versioned and logged. Until now the site's
-- "Report a data issue" link opened a new GitHub issue: a reader needed a
-- GitHub account, the report named no figure, and it was public the moment it
-- was filed (LD-004, ADR-075).
--
-- This is the site's first write path from the public. It writes nowhere near
-- the ledger: a correction request is a message to the reviewers, held in its
-- own table, readable only by them, and it changes no figure. A figure changes
-- only when a reviewer re-reads the source and decides, through the review
-- tables that already keep history (0009).
--
-- WHAT THE PUBLIC ROLE MAY DO, EXACTLY
-- `lokdarpan_intake` may execute `submit_correction` and nothing else: no
-- SELECT, no INSERT, no UPDATE on any table. The function checks every field,
-- caps how many requests the whole site accepts per hour — a ceiling that holds
-- even if the edge rate limit is missing, since that limit fails open by
-- design — and returns a reference the reader can quote.
--
-- WHAT IS NOT STORED
-- No name, email address, IP address or other identifier of the person
-- reporting. A correction is judged on the source, not on who asked.

CREATE TYPE correction_category AS ENUM (
    'amount_wrong',
    'name_wrong',
    'place_wrong',
    'document_wrong',
    'duplicate',
    'outdated',
    'missing',
    'other'
);

CREATE TYPE correction_status AS ENUM (
    'received',
    'reviewing',
    -- The source was re-read and the ledger corrected through the review tables.
    'corrected',
    -- The source was re-read and the ledger already matches it.
    'no_change',
    -- Not about a record the site holds, or not a correction at all.
    'not_actionable'
);

CREATE TABLE correction_request (
    id              BIGINT              GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- What the reader quotes; not the row id, which would reveal how many
    -- requests there have been.
    reference       TEXT                NOT NULL UNIQUE,
    received_at     TIMESTAMPTZ         NOT NULL DEFAULT now(),
    -- What the request is about: `fact:123`, `document:12`, `body:4`, `unit:20`,
    -- `tender:9`, or `page:` and the path it was sent from.
    subject         TEXT                NOT NULL,
    category        correction_category NOT NULL,
    description     TEXT                NOT NULL,
    -- Where the reader says the right value is published. Only http(s).
    evidence_url    TEXT,
    status          correction_status   NOT NULL DEFAULT 'received',
    decided_by      TEXT,
    decided_at      TIMESTAMPTZ,
    resolution_note TEXT,

    CONSTRAINT correction_subject_shape CHECK (
        subject ~ '^(fact|document|body|unit|tender):[1-9][0-9]{0,18}$'
        -- No {0,300}: PostgreSQL caps a repetition bound at 255.
        OR (subject ~ '^page:/[^[:space:]]*$' AND length(subject) <= 306)
    ),
    CONSTRAINT correction_description_length CHECK (
        length(btrim(description)) BETWEEN 10 AND 4000
    ),
    CONSTRAINT correction_evidence_url_shape CHECK (
        evidence_url IS NULL
        OR (evidence_url ~ '^https?://[^[:space:]]+$' AND length(evidence_url) <= 1000)
    ),
    -- A decision says who made it and when, as review decisions do (0007).
    CONSTRAINT correction_decision_attributed CHECK (
        status IN ('received', 'reviewing')
        OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)
    )
);

COMMENT ON TABLE correction_request IS
    'Reports of data errors from the public. A message to reviewers; changes no figure (ADR-075).';

CREATE INDEX correction_request_received_idx ON correction_request (received_at);
CREATE INDEX correction_request_status_idx   ON correction_request (status, received_at);

-- Every decision that is replaced, kept, as 0009 keeps review decisions.
CREATE TABLE correction_request_history (
    id                    BIGINT            GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correction_request_id BIGINT            NOT NULL REFERENCES correction_request (id) ON DELETE CASCADE,
    status                correction_status NOT NULL,
    decided_by            TEXT,
    decided_at            TIMESTAMPTZ,
    resolution_note       TEXT,
    superseded_at         TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- SECURITY DEFINER because it runs as the reviewer, who may not write history
-- directly; search_path pinned for the reason 0009 gives.
CREATE FUNCTION record_correction_supersession() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
BEGIN
    IF (OLD.status, OLD.decided_by, OLD.decided_at, OLD.resolution_note)
       IS DISTINCT FROM (NEW.status, NEW.decided_by, NEW.decided_at, NEW.resolution_note) THEN
        INSERT INTO correction_request_history
            (correction_request_id, status, decided_by, decided_at, resolution_note)
        VALUES (OLD.id, OLD.status, OLD.decided_by, OLD.decided_at, OLD.resolution_note);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER correction_request_supersession
    BEFORE UPDATE ON correction_request
    FOR EACH ROW EXECUTE FUNCTION record_correction_supersession();

-- The only way in from the public.
CREATE FUNCTION submit_correction(
    p_subject      TEXT,
    p_category     correction_category,
    p_description  TEXT,
    p_evidence_url TEXT
) RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
DECLARE
    -- A ceiling for the whole site, not per person: the edge limit is per
    -- address and fails open; this one holds regardless.
    hourly_ceiling CONSTANT INTEGER := 200;
    new_reference  TEXT;
BEGIN
    IF (SELECT count(*) FROM correction_request
         WHERE received_at > now() - interval '1 hour') >= hourly_ceiling THEN
        RAISE EXCEPTION 'correction intake is paused: hourly ceiling reached'
            USING ERRCODE = 'P0001', HINT = 'intake_paused';
    END IF;

    new_reference := 'LD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

    INSERT INTO correction_request (reference, subject, category, description, evidence_url)
    VALUES (new_reference, p_subject, p_category, btrim(p_description),
            NULLIF(btrim(p_evidence_url), ''));

    RETURN new_reference;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_correction(TEXT, correction_category, TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_intake') THEN
        CREATE ROLE lokdarpan_intake NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO lokdarpan_intake;
GRANT EXECUTE ON FUNCTION submit_correction(TEXT, correction_category, TEXT, TEXT)
    TO lokdarpan_intake;
REVOKE CREATE ON SCHEMA public FROM lokdarpan_intake;

COMMENT ON ROLE lokdarpan_intake IS
    'The public site''s correction form. May execute submit_correction and nothing else.';

-- The read-only API role reads every table by default (0002). Reports from the
-- public are not ledger data and are never served back out.
REVOKE ALL ON correction_request, correction_request_history FROM lokdarpan_readonly;

-- Reviewers read requests and record a decision on the decision columns only.
GRANT SELECT ON correction_request, correction_request_history TO lokdarpan_reviewer;
GRANT UPDATE (status, decided_by, decided_at, resolution_note)
    ON correction_request TO lokdarpan_reviewer;
