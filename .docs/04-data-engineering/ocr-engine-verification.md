# OCR engines — what was verified, and how

**Date:** 4 September 2026 · **Supersedes the `[verify]` markers in** [`multilingual-extraction-proposal.md`](./multilingual-extraction-proposal.md) §Engine comparison

The proposal compared engines from documentation and marked every licence claim
`[verify]`, because a licence read from a comparison table is a licence written
from memory. This records what was actually checked.

## Method

Each package's own metadata was fetched, not an article about it:

- **PyPI JSON API** — `https://pypi.org/pypi/<name>/json`, reading the
  `info.license`, `info.license_expression` and `License ::` classifiers that
  the maintainers publish with the distribution.
- **GitHub repository API** — `https://api.github.com/repos/<owner>/<repo>`,
  reading GitHub's own SPDX detection.
- For the one case where the two mattered most, the **`LICENSE` file itself**
  was fetched and read.

Versions below are the ones current on the date above. They are recorded because
"latest" is not a version, and a reading that cannot be reproduced is not
provenance.

## Result

| Package                   | Version | Licence (from its own metadata) | Usable under Apache-2.0 |
| ------------------------- | ------- | ------------------------------- | ----------------------- |
| `paddleocr`               | 3.7.0   | Apache License 2.0              | Yes                     |
| `paddlepaddle`            | 3.3.1   | Apache Software License         | Yes                     |
| `pytesseract`             | 0.3.13  | Apache License 2.0              | Yes                     |
| `tesseract-ocr/tesseract` | —       | Apache-2.0 (GitHub SPDX)        | Yes                     |
| `PaddlePaddle/PaddleOCR`  | —       | Apache-2.0 (GitHub SPDX)        | Yes                     |
| `pypdfium2`               | 5.13.0  | BSD-3-Clause, Apache-2.0        | Yes                     |
| `surya-ocr`               | 0.22.1  | Apache-2.0                      | Yes                     |
| `python-doctr`            | 1.1.0   | Apache License 2.0              | Yes                     |
| `fastapi`                 | 0.141.1 | MIT (`license_expression`)      | Yes                     |
| `pydantic`                | 2.13.5  | MIT (`license_expression`)      | Yes                     |

## The correction this forced

**The proposal was wrong about Surya.** It recorded
_"GPL-family with commercial terms — [verify]"_ and named the licence "the
blocker to check first". It is not a blocker:

- `surya-ocr` 0.22.1 publishes `Apache-2.0` on PyPI.
- `datalab-to/surya` reports SPDX `Apache-2.0` on GitHub.
- Its `LICENSE` file is the Apache License 2.0 text.

The claim came from recollection, which is exactly the failure the source
registry has a standing rule against. It is corrected here and in the proposal.

This does not reopen the engine choice — PaddleOCR and Tesseract are decided,
and Surya was not rejected on licence grounds alone. It removes a false
constraint from the record, which is worth more than being right about a
recommendation.

## What this does not establish

- **Nothing about accuracy.** No engine was benchmarked here, and no accuracy
  claim from any project's own documentation is repeated in this repository.
  That is Increment 3, measured on the 522 unread pages of the real corpus.
- ~~**Nothing about model weights.**~~ **Settled 5 September 2026** — see the
  section below.
- **Nothing about Indic language coverage.** The proposal's coverage claims
  remain `[verify]` and are still unverified.

---

## Model weights — verified 5 September 2026

An engine's licence is not its models' licence, and that was left open when the
engines were checked. PaddleOCR downloads its weights at first use rather than
shipping them, so the question could not be answered from package metadata.

Running the benchmark downloaded them, which made the artefacts checkable.

**Method, two channels as the registry requires:**

1. The model card inside each downloaded directory
   (`~/.paddlex/official_models/<model>/README.md`), read from its own YAML front
   matter — the statement travelling with the bytes that were executed.
2. The Hugging Face model API for the repository each was fetched from,
   `https://huggingface.co/api/models/PaddlePaddle/<model>`, read from
   `cardData.license`.

| Model                        | Role                  | Card on disk | Hub API    |
| ---------------------------- | --------------------- | ------------ | ---------- |
| `PP-OCRv6_medium_det`        | text-line detection   | apache-2.0   | apache-2.0 |
| `PP-OCRv6_medium_rec`        | text recognition      | apache-2.0   | apache-2.0 |
| `PP-LCNet_x1_0_doc_ori`      | document orientation  | apache-2.0   | apache-2.0 |
| `PP-LCNet_x1_0_textline_ori` | text-line orientation | apache-2.0   | apache-2.0 |
| `UVDoc`                      | document unwarping    | apache-2.0   | apache-2.0 |

Both channels agree on all five. **No licence file ships inside the model
directories** — the declaration is the card's front matter rather than a
`LICENSE` artefact, which matters if these are ever redistributed instead of
downloaded.

### What is still not established

- **Upstream provenance of `UVDoc`.** It originates as third-party research on
  document unwarping. `PaddlePaddle/UVDoc` states Apache-2.0 for what it
  distributes; whether the original work carries the same terms was not checked,
  and would need to be before that model is redistributed rather than downloaded.
- **Training data.** No claim is made here about what any of these models were
  trained on. A permissive weight licence says nothing about it, and nothing in
  this project turns on it — these engines read a page, they do not generate one.
- **That this changes anything operationally.** It does not.
  [`ADR-039`](../adr/039-tesseract-and-not-yet-into-the-ledger.md) declines
  PaddleOCR on throughput measured on this hardware — 471.77s against Tesseract's
  1.47s on the same page. What this closes is a licence question recorded as
  unverified, and an unverified claim left standing is exactly the shape of the
  Surya error corrected above.
