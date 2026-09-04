"""Tesseract, through pytesseract.

Apache-2.0, both the engine (tesseract-ocr/tesseract) and the binding
(madmaze/pytesseract), verified from the projects' own metadata rather than
from documentation about them — see `.docs/04-data-engineering/ocr-engine-verification.md`.

Tesseract is here as the second reading rather than the first. It is a different
lineage from PaddleOCR — a classical engine against a neural one — and two
engines that share an architecture also share their mistakes. Two readings are
only worth having when they can fail differently.
"""

from __future__ import annotations

import io

from .base import EngineInfo, EngineUnavailableError, Word

NAME = "tesseract"

# Tesseract reports word confidence as 0..100, and -1 for a box it produced
# without recognising text in it. The scale conversion is a documented linear
# map applied once, here, so nothing downstream has to know the difference.
_CONFIDENCE_SCALE = 100.0
_NO_READING = -1


class TesseractEngine:
    def __init__(self) -> None:
        try:
            import pytesseract
            from PIL import Image
        except ImportError as error:  # pragma: no cover - exercised by absence
            raise EngineUnavailableError(
                "pytesseract and Pillow are not installed; "
                "install this service with the 'tesseract' extra"
            ) from error

        self._pytesseract = pytesseract
        self._image = Image

        try:
            self._version = str(pytesseract.get_tesseract_version())
        except Exception as error:  # pragma: no cover - exercised by absence
            raise EngineUnavailableError(
                f"the tesseract binary could not be run: {error}"
            ) from error

    def info(self) -> EngineInfo:
        return EngineInfo(name=NAME, version=self._version)

    def read(self, image_png: bytes, languages: list[str]) -> list[Word]:
        image = self._image.open(io.BytesIO(image_png))
        data = self._pytesseract.image_to_data(
            image,
            lang="+".join(languages),
            output_type=self._pytesseract.Output.DICT,
        )

        words: list[Word] = []
        for i, text in enumerate(data["text"]):
            stripped = text.strip()
            confidence = float(data["conf"][i])
            # A box with no text in it is not a word, and a confidence of -1 is
            # Tesseract saying it did not read one. Neither becomes a reading.
            if stripped == "" or confidence == _NO_READING:
                continue
            left = float(data["left"][i])
            top = float(data["top"][i])
            words.append(
                Word(
                    text=stripped,
                    box=(left, top, left + float(data["width"][i]), top + float(data["height"][i])),
                    confidence=max(0.0, min(1.0, confidence / _CONFIDENCE_SCALE)),
                )
            )
        return words
