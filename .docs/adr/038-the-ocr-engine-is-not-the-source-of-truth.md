# ADR-038 · The OCR engine is not the source of truth

**Status:** Accepted · **Date:** 2026-09-04 · **Builds on** [`036-a-figure-carries-the-region-it-came-from.md`](./036-a-figure-carries-the-region-it-came-from.md)

## Context

522 of the corpus's 4,586 pages have no text layer at all, and a further 45 have
one that is present and wrong (`035`). Those pages are not a small remainder:
they are where scanned annexures and photographed tables live, which is where
per-work figures tend to be.

Reading them means adding a component that **guesses**. Every other stage of this
pipeline either reads a figure exactly or refuses it; an OCR engine returns its
best interpretation of a smear of ink, and returns one whether or not the ink
was legible. Attaching that to a government figure with a source link is the
most dangerous thing this project could build.

The engines are also Python — the ecosystem is not optional here — while the
pipeline is TypeScript and must not be rewritten.

## Decision

**A separate Python service, behind a versioned wire contract, that reports what
an engine saw and never what it concluded.**

Four commitments make that concrete:

**The page image is the source of truth; the engine is a witness.** A reading
carries the engine's name, its exact version read from the installed engine, the
model versions, the languages it was told to read, and the render it was taken
from — DPI, raster size, page box, rotation. A reading without that provenance is
not admissible, so the contract has no way to express one.

**Nothing is merged.** Two engines reading one page produce two readings. There
is no field for a consensus value, and a document containing one is a committed
counter-example that both sides must reject. Agreeing to a figure by majority is
how a wrong figure acquires a confident-looking source link; disagreement is
evidence to be shown to a person, not noise to be averaged away.

**An absence is stated.** An engine that is not installed, a page that will not
render, an engine that fails mid-page — each produces a `Refusal` naming the
reason. A response with fewer readings than engines asked for, and no refusal to
explain it, is malformed. "Not installed", "found no text" and "blank page" are
three different facts and the contract keeps them apart.

**A reading arrives in the shape the text layer already produces.** Content plus
items carrying a character span and a box in PDF points, origin bottom-left, in
the page's unrotated space — exactly what `document_text_item` stores. So a
figure found by OCR is located, cited and reviewed by the code that already
exists. This is what "do not rewrite the pipeline in Python" means in practice:
the Python ends at the contract.

## Consequences

The service starts, answers `/capabilities` and refuses every read with a reason
when no engine is installed. Its 56 tests run with neither engine nor pdfium
present, which is what proves the refusal path rather than asserting it.

The two sides cannot be type-checked against each other, so they are checked
against the same bytes: five example documents and eight counter-examples in
`services/ocr/contract/`, validated by the Python suite and the TypeScript suite
with the same expectations. Loosening one side alone fails a test rather than
diverging until a coordinate lands on the wrong figure.

Engine licences were verified from the packages' own metadata rather than from
documentation about them, and that exercise corrected a claim this repository had
recorded from memory — see
[`ocr-engine-verification.md`](../04-data-engineering/ocr-engine-verification.md).

## What this deliberately does not decide

**Whether either engine is good enough.** No accuracy claim appears anywhere in
this change, and none from a project's own marketing is repeated. That is
measured on the 522 real pages, next.

**How a reading enters the ledger.** Nothing here writes to the database. A page
read by OCR needs per-page extraction provenance so a reader can tell a scanned
reading from a text-layer one, and that is a schema change to make when there is
a reading worth storing.

**What to do when two engines disagree.** The contract records both. The rule for
acting on a disagreement — which, per the project's standing instruction, may
not be a majority vote unless the evidence is independently verified — is not yet
written, because writing it before seeing real disagreements would be inventing
a policy for a problem whose shape is unknown.

## Rejected: calling a cloud OCR API

Google, Azure and AWS all read Indic scripts well by reputation. All three were
declined as the authoritative reading: a figure whose provenance is "a vendor's
model, at some version, on some date" cannot be reproduced, and reproducibility
is the property this ledger sells. A cloud engine may later serve as a third
opinion on pages two self-hosted engines disagree about; it may not be the one
that decides.

## Rejected: adding a text layer with OCRmyPDF

`OCRmyPDF` would write a text layer into the PDF and let the existing extractor
read it unchanged — appealing, and wrong here. It modifies the document, and this
project's raw store keeps retrieved bytes immutable so that a better parser can
be run against exactly what was published. A derived PDF would become a second
artefact that looks like the source and is not.
