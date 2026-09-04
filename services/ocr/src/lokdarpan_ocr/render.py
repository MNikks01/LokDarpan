"""Renders a PDF page to a raster, and says exactly how.

The page image is the source of truth, so the step that produces it is recorded
rather than assumed: one DPI, stated in the request, echoed in the response, and
applied by one renderer. Two readings taken at different DPIs are two different
readings of the same page, and the contract can tell them apart.

pypdfium2 renders the page as a viewer sees it — the declared rotation applied.
The page box reported here is the **unrotated** one the file states, because
that is the space the ledger stores and the space `geometry` converts back into.
"""

from __future__ import annotations

from dataclasses import dataclass

from .geometry import Rotation


@dataclass(frozen=True)
class RenderedPage:
    png: bytes
    raster_width: int
    raster_height: int
    page_width: float
    page_height: float
    rotation: Rotation


def _quarter_turn(reported: int) -> Rotation:
    """The page's rotation in degrees, however the binding reports it.

    pdfium's own API returns a quarter-turn index (0-3); pypdfium2 documents
    degrees. Both are accepted because the two are unambiguous together — no
    quarter turn is 1, 2 or 3 degrees — and anything else raises rather than
    being rounded to the nearest turn. A page whose orientation we cannot state
    is one whose coordinates we cannot place.
    """
    value = int(reported)
    if value in (1, 2, 3):
        value *= 90
    value = ((value % 360) + 360) % 360
    if value not in (0, 90, 180, 270):
        raise ValueError(f"page rotation {reported!r} is not a quarter turn")
    return value  # type: ignore[return-value]


class PdfRenderer:
    """Holds an open document so a run of pages costs one parse."""

    def __init__(self, pdf_bytes: bytes) -> None:
        import pypdfium2

        self._pdfium = pypdfium2
        self._document = pypdfium2.PdfDocument(pdf_bytes)

    def __enter__(self) -> PdfRenderer:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self._document.close()

    @property
    def page_count(self) -> int:
        return len(self._document)

    def page_images(self, page_number: int) -> list[tuple[int, int]]:
        """The pixel size of every image drawn on the page, largest first.

        A page with no text layer is not automatically a scan. It might be a
        photograph, a chart, or a blank separator. The images it draws — and at
        what resolution — are the difference between "this page needs OCR at 400
        dpi" and "there is nothing on this page to read", and both answers are
        better made from the file than guessed from the absence of text.

        An image whose size pdfium will not report is skipped rather than
        counted as zero: an unknown resolution is not a resolution of none.
        """
        import pypdfium2.raw as raw

        page = self._document[page_number - 1]
        sizes: list[tuple[int, int]] = []
        for obj in page.get_objects():
            if obj.type != raw.FPDF_PAGEOBJ_IMAGE:
                continue
            try:
                width, height = obj.get_px_size()
            except Exception:
                continue
            sizes.append((int(width), int(height)))

        return sorted(sizes, key=lambda wh: wh[0] * wh[1], reverse=True)

    def render(self, page_number: int, dpi: int) -> RenderedPage:
        """One page, 1-based, as a citation writes it."""
        if page_number < 1 or page_number > self.page_count:
            raise IndexError(
                f"page {page_number} is outside this document's {self.page_count} pages"
            )

        page = self._document[page_number - 1]

        # NOT `get_size()`. pdfium's page size has the declared rotation already
        # applied — it swaps width and height on a quarter turn — exactly as
        # pdf.js's viewport does. Storing that beside unrotated coordinates put
        # 46 fact boxes past the right edge of their own page (ADR-037). The
        # media box is the unrotated box the file states, which is the space the
        # ledger stores and the space `geometry` converts back into.
        left, bottom, right, top = page.get_mediabox()
        width = float(right) - float(left)
        height = float(top) - float(bottom)
        rotation = _quarter_turn(page.get_rotation())

        import io

        bitmap = page.render(scale=dpi / 72.0)
        image = bitmap.to_pil()
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

        return RenderedPage(
            png=buffer.getvalue(),
            raster_width=image.width,
            raster_height=image.height,
            page_width=width,
            page_height=height,
            rotation=rotation,
        )
