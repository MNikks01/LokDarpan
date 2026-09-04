"""The contract refuses what it cannot vouch for."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from lokdarpan_ocr.contract import (
    CONTRACT_VERSION,
    EngineIdentity,
    PageReading,
    ReadRequest,
    Render,
    TextItem,
)


def an_item(**overrides: object) -> dict[str, object]:
    return {
        "seq": 0,
        "char_start": 0,
        "char_end": 5,
        "x0": 72.0,
        "y0": 700.0,
        "x1": 130.0,
        "y1": 709.0,
        "confidence": 0.94,
        **overrides,
    }


class TestTextItem:
    def test_a_box_must_be_ordered_lower_left_to_upper_right(self) -> None:
        with pytest.raises(ValidationError, match="corners"):
            TextItem(**an_item(x1=10.0))  # type: ignore[arg-type]

    def test_a_span_must_not_run_backwards(self) -> None:
        with pytest.raises(ValidationError, match="char_end"):
            TextItem(**an_item(char_start=9, char_end=2))  # type: ignore[arg-type]

    def test_confidence_is_a_fraction_not_a_percentage(self) -> None:
        # Tesseract reports 0..100. An adapter that forgets to convert would
        # otherwise file a confidence of 94 beside a government figure.
        with pytest.raises(ValidationError):
            TextItem(**an_item(confidence=94.0))  # type: ignore[arg-type]


class TestPageReading:
    def a_reading(self, content: str, items: list[dict[str, object]]) -> PageReading:
        return PageReading(
            page_number=1,
            engine=EngineIdentity(name="tesseract", version="5.4.1", languages=["eng"]),
            render=Render(
                dpi=300,
                raster_width=2480,
                raster_height=3508,
                page_width=595.0,
                page_height=842.0,
                rotation=0,
            ),
            content=content,
            items=[TextItem(**item) for item in items],  # type: ignore[arg-type]
        )

    def test_an_item_may_not_address_text_that_is_not_there(self) -> None:
        # The offsets are the whole provenance chain. One that runs past the end
        # of the content it arrived with points at nothing.
        with pytest.raises(ValidationError, match="offsets must index"):
            self.a_reading("short", [an_item(char_end=99)])

    def test_a_reading_with_no_text_is_allowed_and_says_so(self) -> None:
        # An engine that read the page and found nothing is a fact worth
        # recording. It is not the same as an engine that was never run.
        reading = self.a_reading("", [])
        assert reading.content == ""
        assert reading.items == []

    def test_an_engine_must_name_its_exact_version(self) -> None:
        with pytest.raises(ValidationError):
            EngineIdentity(name="tesseract", version="", languages=["eng"])

    def test_an_engine_must_say_which_languages_it_read(self) -> None:
        with pytest.raises(ValidationError):
            EngineIdentity(name="tesseract", version="5.4.1", languages=[])


class TestReadRequest:
    def test_pages_are_one_based(self) -> None:
        with pytest.raises(ValidationError):
            ReadRequest(
                document_sha256="a" * 64,
                page_numbers=[0],
                engines=["tesseract"],
                languages=["eng"],
            )

    def test_a_document_is_named_by_its_content_hash(self) -> None:
        with pytest.raises(ValidationError):
            ReadRequest(
                document_sha256="not-a-hash",
                page_numbers=[1],
                engines=["tesseract"],
                languages=["eng"],
            )

    def test_the_language_is_stated_rather_than_guessed(self) -> None:
        with pytest.raises(ValidationError):
            ReadRequest(
                document_sha256="a" * 64,
                page_numbers=[1],
                engines=["tesseract"],
                languages=[],
            )

    def test_the_contract_version_travels_with_every_message(self) -> None:
        request = ReadRequest(
            document_sha256="a" * 64,
            page_numbers=[1],
            engines=["tesseract"],
            languages=["eng"],
        )
        assert request.contract_version == CONTRACT_VERSION

    def test_an_unknown_field_is_refused_rather_than_ignored(self) -> None:
        # A caller sending a field this version does not know is a caller
        # expecting behaviour it will not get.
        with pytest.raises(ValidationError):
            ReadRequest.model_validate(
                {
                    "document_sha256": "a" * 64,
                    "page_numbers": [1],
                    "engines": ["tesseract"],
                    "languages": ["eng"],
                    "merge_engines": True,
                }
            )
