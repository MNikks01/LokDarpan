"""The renderer against real pdfium, on pages that are turned.

Skipped where pypdfium2 is absent — CI does not install it, so that the rest of
the suite proves the no-engine path. Run locally, this is what stops the
rotation trap being reintroduced on the Python side: pdfium's page size has the
declared rotation already applied, exactly as pdf.js's viewport does, and
storing that beside unrotated coordinates put 46 fact boxes off their own page.
"""

from __future__ import annotations

import pytest

from lokdarpan_ocr.geometry import raster_box_to_pdf

pypdfium2 = pytest.importorskip("pypdfium2")

from lokdarpan_ocr.render import PdfRenderer, _quarter_turn  # noqa: E402

WIDTH = 612
HEIGHT = 792


def one_page_pdf(rotate: int) -> bytes:
    """A minimal PDF, written out so the page box and the turn are visible."""
    stream = b"BT /F1 12 Tf 72 700 Td (Rs 15.14 crore) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {WIDTH} {HEIGHT}] "
            f"/Rotate {rotate} /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        ).encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream),
    ]

    body = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body += b"%d 0 obj\n%s\nendobj\n" % (i, obj)

    startxref = len(body)
    xref = b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        xref += b"%010d 00000 n \n" % offset
    xref += b"trailer\n<< /Size %d /Root 1 0 R >>\n" % (len(objects) + 1)
    xref += b"startxref\n%d\n%%%%EOF\n" % startxref
    return body + xref


class TestQuarterTurn:
    def test_accepts_degrees(self) -> None:
        assert _quarter_turn(270) == 270

    def test_accepts_a_quarter_turn_index(self) -> None:
        # pdfium's own API returns 0-3. The two are unambiguous together: no
        # quarter turn is 1, 2 or 3 degrees.
        assert _quarter_turn(3) == 270

    def test_refuses_anything_that_is_not_a_quarter_turn(self) -> None:
        # A page whose orientation cannot be stated is one whose coordinates
        # cannot be placed, so this raises rather than rounding.
        with pytest.raises(ValueError, match="quarter turn"):
            _quarter_turn(45)


@pytest.mark.parametrize("rotate", [0, 90, 180, 270])
class TestRender:
    def test_reports_the_unrotated_page_box(self, rotate: int) -> None:
        # NOT pdfium's page size, which swaps on a quarter turn. The media box
        # is the space the ledger stores.
        with PdfRenderer(one_page_pdf(rotate)) as renderer:
            page = renderer.render(1, dpi=72)

        assert page.page_width == pytest.approx(WIDTH)
        assert page.page_height == pytest.approx(HEIGHT)
        assert page.rotation == rotate

    def test_the_raster_is_the_page_as_a_viewer_sees_it(self, rotate: int) -> None:
        with PdfRenderer(one_page_pdf(rotate)) as renderer:
            page = renderer.render(1, dpi=72)

        expected = (HEIGHT, WIDTH) if rotate in (90, 270) else (WIDTH, HEIGHT)
        assert (page.raster_width, page.raster_height) == pytest.approx(expected, abs=1)

    def test_a_box_anywhere_in_the_raster_lands_on_the_page(self, rotate: int) -> None:
        with PdfRenderer(one_page_pdf(rotate)) as renderer:
            page = renderer.render(1, dpi=150)

        x0, y0, x1, y1 = raster_box_to_pdf(
            (0, 0, page.raster_width, page.raster_height),
            dpi=150,
            page_width=page.page_width,
            page_height=page.page_height,
            rotation=page.rotation,
        )
        assert x0 == pytest.approx(0, abs=1)
        assert y0 == pytest.approx(0, abs=1)
        assert x1 == pytest.approx(WIDTH, abs=1)
        assert y1 == pytest.approx(HEIGHT, abs=1)


def test_a_page_that_draws_no_image_reports_none() -> None:
    # A page with no text layer is not automatically a scan. Knowing it draws no
    # image at all is what separates "photograph of a table" from "blank sheet",
    # and 428 of this corpus's 522 unread pages turned out to be the latter.
    with PdfRenderer(one_page_pdf(0)) as renderer:
        assert renderer.page_images(1) == []


def test_a_page_outside_the_document_is_named_rather_than_wrapped() -> None:
    with (
        PdfRenderer(one_page_pdf(0)) as renderer,
        pytest.raises(IndexError, match="outside this document"),
    ):
        renderer.render(2, dpi=72)
