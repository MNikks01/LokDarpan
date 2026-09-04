"""PaddleOCR.

Apache-2.0, engine and Python package alike, verified from the projects' own
metadata — see `.docs/04-data-engineering/ocr-engine-verification.md`.

PaddleOCR returns a quadrilateral per detected line, not an upright rectangle,
because text on a scanned page is rarely square to the paper. The quadrilateral
is reduced to its bounding rectangle here, and that is a loss worth naming: a
box drawn around slanted text covers a little more than the text does. It is
recorded as the region a figure was read from, never as the shape of the glyphs.
"""

from __future__ import annotations

import io

from .base import EngineInfo, EngineUnavailableError, Word

NAME = "paddleocr"


class PaddleEngine:
    def __init__(self, language: str = "en") -> None:
        try:
            import paddleocr
            from PIL import Image
        except ImportError as error:  # pragma: no cover - exercised by absence
            raise EngineUnavailableError(
                "paddleocr is not installed; install this service with the 'paddle' extra"
            ) from error

        self._image = Image
        self._version = getattr(paddleocr, "__version__", "unknown")
        if self._version == "unknown":
            # A version we cannot read is a reading we cannot reproduce, so it
            # is refused rather than recorded as "unknown" beside a figure.
            raise EngineUnavailableError(
                "paddleocr does not report a version; a reading that cannot be "
                "reproduced is not admissible provenance"
            )

        try:
            self._reader = paddleocr.PaddleOCR(lang=language)
        except Exception as error:  # pragma: no cover - exercised by absence
            raise EngineUnavailableError(f"PaddleOCR could not be constructed: {error}") from error
        self._language = language

    def info(self) -> EngineInfo:
        return EngineInfo(
            name=NAME,
            version=self._version,
            model_versions={"lang": self._language},
        )

    def read(self, image_png: bytes, languages: list[str]) -> list[Word]:
        del languages  # the model is chosen at construction, not per call
        import numpy

        image = self._image.open(io.BytesIO(image_png)).convert("RGB")
        result = self._reader.predict(numpy.asarray(image))

        words: list[Word] = []
        for page in result or []:
            texts = page.get("rec_texts") or []
            scores = page.get("rec_scores") or []
            polygons = page.get("rec_polys") or page.get("dt_polys") or []
            for text, score, polygon in zip(texts, scores, polygons, strict=False):
                stripped = str(text).strip()
                if stripped == "":
                    continue
                xs = [float(point[0]) for point in polygon]
                ys = [float(point[1]) for point in polygon]
                words.append(
                    Word(
                        text=stripped,
                        box=(min(xs), min(ys), max(xs), max(ys)),
                        confidence=max(0.0, min(1.0, float(score))),
                    )
                )
        return words
