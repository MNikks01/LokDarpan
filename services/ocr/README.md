# LokDarpan OCR

Reads a page image and says what it saw, and where — never what it inferred.

522 of the corpus's 4,586 pages have no text layer, and 45 more have one that is
present and wrong. This service exists for those pages, and for nothing else.

It is a **witness, not an authority**. See
[`ADR-038`](../../.docs/adr/038-the-ocr-engine-is-not-the-source-of-truth.md) for
why that distinction shapes every type in `contract.py`.

## Running it

```bash
uv venv --python 3.12
uv pip install --python .venv -e ".[serve,tesseract]"   # add ",paddle" for PaddleOCR
.venv/bin/uvicorn --app-dir src "lokdarpan_ocr.service:create_app" --factory
```

The engines are optional extras on purpose. With neither installed the service
still starts, still answers `/capabilities`, and refuses every read with a reason
— because a missing engine must be visible, not silently half the evidence.

```bash
curl -s localhost:8000/capabilities | python3 -m json.tool
```

## The contract

`contract/examples/` and `contract/rejected/` are the boundary. Both sides
validate the same bytes: `tests/test_examples.py` here, and
`services/ingestion/tests/ocr-contract.test.ts` in the TypeScript workspace.
Changing one schema without the other fails a test rather than drifting quietly.

The counter-examples are the interesting half. `consensus-field.json` must be
rejected: this contract has nowhere to put a merged reading, and that is
deliberate.

## Tests

```bash
uv pip install --python .venv pydantic pytest
.venv/bin/python -m pytest -q
```

They pass with no engine and no pdfium installed. That is the point — it is what
exercises the refusal path instead of asserting it.

## What is not here

No accuracy claim, and no benchmark. Which engine reads these documents better is
measured on the real 522 pages, and until it is measured nothing in this
repository says one is better than the other.
