"""Reading a document with engines that are, and are not, available.

The engines are stubbed. That is deliberate: what needs testing here is the
service's honesty about what it did and did not read, and a stub can be made to
fail in ways a real engine only fails in production.
"""

from __future__ import annotations

import hashlib

import pytest

from lokdarpan_ocr.contract import ReadRequest
from lokdarpan_ocr.engines.base import EngineInfo, EngineUnavailableError, Word
from lokdarpan_ocr.reading import assemble
from lokdarpan_ocr.registry import Registry
from lokdarpan_ocr.service import DocumentMismatchError, read_document

PDF = b"%PDF-1.4 not a real document"
DIGEST = hashlib.sha256(PDF).hexdigest()


class StubEngine:
    def __init__(self, name: str = "stub", words: list[Word] | None = None) -> None:
        self._name = name
        self._words = words or []

    def info(self) -> EngineInfo:
        return EngineInfo(name=self._name, version="0.0.1-test")

    def read(self, image_png: bytes, languages: list[str]) -> list[Word]:
        del image_png, languages
        return list(self._words)


def a_request(**overrides: object) -> ReadRequest:
    return ReadRequest.model_validate(
        {
            "document_sha256": DIGEST,
            "page_numbers": [1],
            "engines": ["stub"],
            "languages": ["eng"],
            **overrides,
        }
    )


class TestDocumentIdentity:
    def test_bytes_that_are_not_the_named_document_are_refused(self) -> None:
        # A reading filed against the wrong document attaches a figure to a
        # source that does not contain it.
        registry = Registry({"stub": StubEngine})
        with pytest.raises(DocumentMismatchError):
            read_document(b"different bytes", a_request(), registry)

    def test_the_response_carries_the_hash_of_what_was_actually_read(self) -> None:
        registry = Registry({"missing": _unavailable})
        response = read_document(PDF, a_request(engines=["missing"]), registry)
        assert response.document_sha256 == DIGEST


def _unavailable() -> StubEngine:
    raise EngineUnavailableError("not installed here")


class TestMissingEngines:
    def test_an_absent_engine_is_a_refusal_not_a_silence(self) -> None:
        registry = Registry({"missing": _unavailable})
        response = read_document(PDF, a_request(engines=["missing"]), registry)

        assert response.readings == []
        assert len(response.refusals) == 1
        assert response.refusals[0].engine == "missing"
        assert "not installed" in response.refusals[0].reason

    def test_an_unknown_engine_says_what_is_on_offer(self) -> None:
        registry = Registry({"stub": StubEngine})
        response = read_document(PDF, a_request(engines=["surya"]), registry)
        assert "stub" in response.refusals[0].reason

    def test_a_missing_engine_is_refused_once_not_once_per_page(self) -> None:
        registry = Registry({"missing": _unavailable})
        response = read_document(
            PDF, a_request(engines=["missing"], page_numbers=[1, 2, 3]), registry
        )
        assert len(response.refusals) == 1


class TestReadingsAreNotMerged:
    def test_two_engines_produce_two_readings_of_one_page(self) -> None:
        # The contract has nowhere to put a consensus, and this is the test that
        # keeps it that way: agreeing to a figure by majority is how a wrong
        # figure acquires a confident-looking source link.
        registry = Registry(
            {
                "one": lambda: StubEngine("one", [Word("Rs", (0, 0, 10, 10), 0.9)]),
                "two": lambda: StubEngine("two", [Word("Bs", (0, 0, 10, 10), 0.4)]),
            }
        )
        response = _read_with_fake_render(PDF, a_request(engines=["one", "two"]), registry)

        assert len(response.readings) == 2
        assert {r.engine.name for r in response.readings} == {"one", "two"}
        assert {r.content for r in response.readings} == {"Rs", "Bs"}


def _read_with_fake_render(pdf: bytes, request: ReadRequest, registry: Registry):
    """Runs the read path with rendering stubbed out.

    The renderer needs a real PDF and a real pdfium; neither is what these tests
    are about. Assembly, refusal and non-merging are.
    """

    class FakeRendered:
        png = b""
        raster_width = 100
        raster_height = 100
        page_width = 595.0
        page_height = 842.0
        rotation = 0

    class FakeRenderer:
        def __init__(self, _: bytes) -> None:
            pass

        def __enter__(self) -> FakeRenderer:
            return self

        def __exit__(self, *_: object) -> None:
            pass

        def render(self, page_number: int, dpi: int) -> FakeRendered:
            del page_number, dpi
            return FakeRendered()

    import lokdarpan_ocr.render as render_module

    saved = render_module.PdfRenderer
    render_module.PdfRenderer = FakeRenderer  # type: ignore[assignment]
    try:
        return read_document(pdf, request, registry)
    finally:
        render_module.PdfRenderer = saved  # type: ignore[assignment]


class TestAssembly:
    def test_offsets_address_the_text_they_arrived_with(self) -> None:
        words = [
            Word("Rs", (10, 10, 40, 30), 0.99),
            Word("15.14", (45, 10, 120, 30), 0.97),
            Word("crore", (10, 60, 90, 80), 0.95),
        ]
        reading = assemble(
            page_number=7,
            words=words,
            engine=EngineInfo(name="stub", version="0.0.1"),
            languages=["eng"],
            dpi=72,
            raster_width=600,
            raster_height=800,
            page_width=600.0,
            page_height=800.0,
            rotation=0,
        )

        assert reading.content == "Rs 15.14\ncrore"
        for item, word in zip(reading.items, words, strict=True):
            assert reading.content[item.char_start : item.char_end] == word.text

    def test_a_line_break_is_recorded_where_the_words_dropped_down(self) -> None:
        reading = assemble(
            page_number=1,
            words=[Word("a", (0, 0, 10, 20), 1.0), Word("b", (0, 100, 10, 120), 1.0)],
            engine=EngineInfo(name="stub", version="0.0.1"),
            languages=["eng"],
            dpi=72,
            raster_width=100,
            raster_height=200,
            page_width=100.0,
            page_height=200.0,
            rotation=0,
        )
        assert reading.content == "a\nb"

    def test_an_engine_that_saw_nothing_produces_an_empty_reading(self) -> None:
        reading = assemble(
            page_number=1,
            words=[],
            engine=EngineInfo(name="stub", version="0.0.1"),
            languages=["eng"],
            dpi=300,
            raster_width=100,
            raster_height=100,
            page_width=595.0,
            page_height=842.0,
            rotation=0,
        )
        assert reading.content == ""
        assert reading.items == []
        # The render is still recorded: knowing nothing was found at 300 dpi is
        # different from not knowing what was tried.
        assert reading.render.dpi == 300
