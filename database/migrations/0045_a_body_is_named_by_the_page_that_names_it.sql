-- 0045 · A public body is named by the page that names it.
--
-- WHY
-- "Who" is spelled three unlinked ways in the ledger: `department` (a BEAMS
-- letter code under a state), `tender.department` (GePNIC text) and
-- `document.issuing_authority` (text). Nothing can say "this is the Public
-- Works Department of Maharashtra" and gather what is held about it
-- (`.docs/02-architecture/PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md` §4 Q11).
--
-- A body needs a name a reader may be shown. BEAMS publishes department names
-- and is withheld; the IGOD directory lists them and its terms are unrecorded
-- (#182). The CAG reports name the departments they audit, and their terms
-- permit reproduction. So a body is created only from a CAG page that names it,
-- read as a candidate and decided by a person, like every figure (ADR-074).
--
-- WHAT THIS ADDS
-- · `fact_kind` gains `body_reference`: a government or department named on a
--   page. PostgreSQL will not use a new enum value in the transaction that adds
--   it, so nothing is written with it here (as 0041).
-- · `public_body`: one row per government or department, under the territory it
--   governs. Its name is the reviewed name as the reports print it.
-- · `public_body_mention`: the reviewed facts that name a body. A body with no
--   mention whose fact is still verified or corrected is not shown: a reviewer
--   who later rejects the only evidence for a body has removed it from view
--   without anyone deleting a row.
--
-- WHAT THIS DOES NOT CLAIM
-- A mention says a page names the body. It does not say the page's figures are
-- about that body, and no surface may present them as attributed to it.

ALTER TYPE fact_kind ADD VALUE IF NOT EXISTS 'body_reference';

-- Kinds are added as sources name them, not in advance. A directorate, board or
-- corporation enters the enum when a reviewed page first names one.
CREATE TYPE public_body_kind AS ENUM ('government', 'department');

CREATE TABLE public_body (
    id                         BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind                       public_body_kind NOT NULL,
    -- The name as the reviewed fact gives it (the reviewer's correction where
    -- there was one). Never composed from parts or translated.
    name_en                    TEXT             NOT NULL,
    -- A government has no parent here; a department belongs to its government.
    parent_body_id             BIGINT           REFERENCES public_body (id),
    -- The territory the body governs. Not where its office is, and not where its
    -- works are (§12 of the architecture document keeps all three apart).
    jurisdiction_admin_unit_id BIGINT           NOT NULL REFERENCES admin_unit (id),
    dataset_version_id         BIGINT           NOT NULL REFERENCES dataset_version (id),

    CONSTRAINT public_body_name_not_blank   CHECK (length(btrim(name_en)) > 0),
    CONSTRAINT public_body_not_own_parent   CHECK (parent_body_id IS DISTINCT FROM id),
    CONSTRAINT public_body_parent_by_kind   CHECK ((kind = 'government') = (parent_body_id IS NULL)),
    CONSTRAINT public_body_unique_name      UNIQUE (jurisdiction_admin_unit_id, kind, name_en)
);

COMMENT ON TABLE public_body IS
    'Governments and departments, each created from a reviewed page that names it (ADR-074).';

CREATE INDEX public_body_parent_idx       ON public_body (parent_body_id);
CREATE INDEX public_body_jurisdiction_idx ON public_body (jurisdiction_admin_unit_id);

CREATE TABLE public_body_mention (
    public_body_id     BIGINT NOT NULL REFERENCES public_body (id) ON DELETE CASCADE,
    -- A reading deleted with its document takes its mentions with it.
    document_fact_id   BIGINT NOT NULL REFERENCES document_fact (id) ON DELETE CASCADE,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_version (id),
    PRIMARY KEY (public_body_id, document_fact_id)
);

COMMENT ON TABLE public_body_mention IS
    'A reviewed fact naming a body. It cites the page; it does not attribute that page''s figures to the body.';

CREATE INDEX public_body_mention_fact_idx ON public_body_mention (document_fact_id);

-- No grant to lokdarpan_etl. Its privileges are what the scheduled tender
-- pipeline issues (0031), and bodies are loaded by hand from reviewed facts, as
-- the CAG corpus is. lokdarpan_readonly reads both tables through its default
-- privileges (0002).
