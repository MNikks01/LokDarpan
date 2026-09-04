"""Runs each engine over the benchmark pages and records what it read.

This writes readings, not scores. Scoring happens separately, so that a change
to a metric never requires re-running the engines and a run can be re-scored
against a metric nobody had thought of yet.

Every reading carries the engine's exact version, because a number without the
version that produced it is not a measurement.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from lokdarpan_ocr.contract import ReadRequest
from lokdarpan_ocr.engines.base import EngineUnavailableError
from lokdarpan_ocr.registry import Registry
from lokdarpan_ocr.service import read_document

ROOT = pathlib.Path(__file__).resolve().parents[3]

# Tesseract takes a "+"-joined language list; PaddleOCR picks a model at
# construction. Both are stated rather than detected: an engine guessing the
# language of a bilingual audit report is one more thing that can be wrong.
LANGUAGES = ["eng", "mar"]


def build_registry(engines: list[str], paddle_language: str) -> Registry:
    from lokdarpan_ocr.engines.paddle import PaddleEngine
    from lokdarpan_ocr.engines.tesseract import TesseractEngine

    builders = {
        "tesseract": TesseractEngine,
        "paddleocr": lambda: PaddleEngine(language=paddle_language),
    }
    return Registry({name: builders[name] for name in engines})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("population", choices=["groundTruth", "unread"])
    parser.add_argument("--engines", default="tesseract,paddleocr")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--pages", default="", help="doc:page,doc:page — a named subset")
    parser.add_argument("--paddle-language", default="en")
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    manifest = json.loads((ROOT / "data/benchmarks/ocr-manifest.json").read_text())
    pages = manifest[args.population]

    if args.pages:
        wanted = {tuple(int(v) for v in pair.split(":")) for pair in args.pages.split(",")}
        pages = [p for p in pages if (p["documentId"], p["pageNumber"]) in wanted]
    if args.limit:
        pages = pages[: args.limit]

    engines = args.engines.split(",")
    registry = build_registry(engines, args.paddle_language)

    for name in engines:
        try:
            print(f"  {name}: {registry.get(name).info().version}", flush=True)
        except EngineUnavailableError as error:
            print(f"  {name}: UNAVAILABLE — {error}", flush=True)

    out = (
        pathlib.Path(args.out)
        if args.out
        else (ROOT / f"data/benchmarks/readings-{args.population}.jsonl")
    )

    by_document: dict[str, list[dict]] = {}
    for page in pages:
        by_document.setdefault(page["storagePath"], []).append(page)

    written = 0
    started = time.monotonic()
    with out.open("w") as handle:
        for storage_path, group in by_document.items():
            pdf = (ROOT / "data/raw" / storage_path).read_bytes()
            for page in group:
                request = ReadRequest(
                    document_sha256=page["sha256"],
                    page_numbers=[page["pageNumber"]],
                    engines=engines,
                    languages=LANGUAGES,
                    dpi=args.dpi,
                )
                page_started = time.monotonic()
                response = read_document(pdf, request, registry)
                elapsed = time.monotonic() - page_started

                for reading in response.readings:
                    handle.write(
                        json.dumps(
                            {
                                "documentId": page["documentId"],
                                "pageNumber": page["pageNumber"],
                                "script": page["script"],
                                "engine": reading.engine.name,
                                "engineVersion": reading.engine.version,
                                "dpi": args.dpi,
                                "seconds": round(elapsed, 2),
                                "content": reading.content,
                                "confidences": [i.confidence for i in reading.items],
                                "expectedText": page.get("expectedText"),
                            }
                        )
                        + "\n"
                    )
                    written += 1
                for refusal in response.refusals:
                    handle.write(
                        json.dumps(
                            {
                                "documentId": page["documentId"],
                                "pageNumber": page["pageNumber"],
                                "engine": refusal.engine,
                                "refusal": refusal.reason,
                            }
                        )
                        + "\n"
                    )
                handle.flush()
                print(
                    f"  doc {page['documentId']} p{page['pageNumber']} " f"({elapsed:.1f}s)",
                    flush=True,
                )

    print(
        f"\n{written} readings over {len(pages)} pages "
        f"in {time.monotonic() - started:.0f}s -> {out}"
    )


if __name__ == "__main__":
    main()
