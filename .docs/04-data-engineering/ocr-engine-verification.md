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
- **Nothing about model weights.** An engine's licence is not its models'
  licence. PaddleOCR downloads detection and recognition models at first use,
  and their terms are **not yet verified**. This must be settled before any
  model is shipped in an image.
- **Nothing about Indic language coverage.** The proposal's coverage claims
  remain `[verify]` and are still unverified.
