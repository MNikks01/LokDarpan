"""Turns a box an engine found in a raster into a box on the page.

An OCR engine reads an image: origin top-left, y downward, measured in pixels.
The ledger stores PDF points: origin bottom-left, y upward, in the page's
**unrotated** space. Between those two lies a scale, a flip, and — on 457 of
this corpus's 4,586 pages — a quarter turn.

That quarter turn is not hypothetical. Storing an upright page box beside
unrotated coordinates put 46 fact boxes past the right edge of their own page
(ADR-037). The same mistake made here would put a reader's highlight on a
different figure, which is worse than showing none at all.

So the conversion is a pure function over four numbers and a rotation, and it is
tested against every rotation a PDF may declare.
"""

from __future__ import annotations

from typing import Literal

POINTS_PER_INCH = 72.0

Rotation = Literal[0, 90, 180, 270]


def upright_page_size(
    page_width: float, page_height: float, rotation: Rotation
) -> tuple[float, float]:
    """The page as a viewer sees it, given the turn the file declares.

    A quarter turn swaps the axes; a half turn does not.
    """
    if rotation in (90, 270):
        return page_height, page_width
    return page_width, page_height


def _upright_point_to_pdf(
    x_up: float,
    y_up: float,
    page_width: float,
    page_height: float,
    rotation: Rotation,
) -> tuple[float, float]:
    """One point, from upright-image space to unrotated PDF space.

    Upright-image space has its origin at the top-left and y increasing
    downward, which is what a raster is. Unrotated PDF space has its origin at
    the bottom-left with y increasing upward, which is what the page states.

    The four cases are written out rather than folded into a matrix. A reader
    checking a highlight that landed in the wrong place needs to see which
    branch produced it.
    """
    if rotation == 0:
        return x_up, page_height - y_up
    if rotation == 90:
        # Displayed page is the file's page turned a quarter clockwise.
        return y_up, x_up
    if rotation == 180:
        return page_width - x_up, y_up
    # 270
    return page_width - y_up, page_height - x_up


def raster_box_to_pdf(
    box_px: tuple[float, float, float, float],
    *,
    dpi: int,
    page_width: float,
    page_height: float,
    rotation: Rotation,
) -> tuple[float, float, float, float]:
    """A pixel box in the upright raster, as a point box on the unrotated page.

    `box_px` is (left, top, right, bottom) in pixels, as every OCR engine
    reports it. The result is (x0, y0, x1, y1) ordered lower-left to
    upper-right, as `document_text_item` stores it.

    All four corners are transformed and the extremes taken. A quarter turn
    sends the top-left corner somewhere that is no longer top or left, so
    converting two corners and trusting their order is how an inverted box
    reaches the database.
    """
    if dpi <= 0:
        raise ValueError("dpi must be positive; it is the scale the raster was made at")

    scale = POINTS_PER_INCH / dpi
    left, top, right, bottom = (v * scale for v in box_px)

    corners = [
        _upright_point_to_pdf(x, y, page_width, page_height, rotation)
        for x, y in ((left, top), (right, top), (right, bottom), (left, bottom))
    ]
    xs = [x for x, _ in corners]
    ys = [y for _, y in corners]
    return min(xs), min(ys), max(xs), max(ys)
