"""A box an engine found must land on the page it was found on.

Every rotation a PDF may declare is checked, because the one that is not
checked is the one that ships. This project has already put 46 fact boxes past
the right edge of their own page by getting a quarter turn wrong on the other
side of this boundary.
"""

from __future__ import annotations

import pytest

from lokdarpan_ocr.geometry import raster_box_to_pdf, upright_page_size

# A4 in points, and a raster of it at 300 dpi.
A4_WIDTH = 595.0
A4_HEIGHT = 842.0
DPI = 300
PX_PER_POINT = DPI / 72.0


def px(points: float) -> float:
    return points * PX_PER_POINT


class TestUprightSize:
    def test_a_quarter_turn_swaps_the_axes(self) -> None:
        assert upright_page_size(A4_WIDTH, A4_HEIGHT, 90) == (A4_HEIGHT, A4_WIDTH)
        assert upright_page_size(A4_WIDTH, A4_HEIGHT, 270) == (A4_HEIGHT, A4_WIDTH)

    def test_a_half_turn_does_not(self) -> None:
        assert upright_page_size(A4_WIDTH, A4_HEIGHT, 0) == (A4_WIDTH, A4_HEIGHT)
        assert upright_page_size(A4_WIDTH, A4_HEIGHT, 180) == (A4_WIDTH, A4_HEIGHT)


class TestConversion:
    def test_an_unrotated_box_flips_the_y_axis_and_nothing_else(self) -> None:
        # 100pt from the left, 50pt down from the top, 40x10pt.
        box = raster_box_to_pdf(
            (px(100), px(50), px(140), px(60)),
            dpi=DPI,
            page_width=A4_WIDTH,
            page_height=A4_HEIGHT,
            rotation=0,
        )
        assert box == pytest.approx((100.0, A4_HEIGHT - 60.0, 140.0, A4_HEIGHT - 50.0))

    @pytest.mark.parametrize("rotation", [0, 90, 180, 270])
    def test_every_box_lands_inside_the_page_it_came_from(self, rotation: int) -> None:
        upright_w, upright_h = upright_page_size(A4_WIDTH, A4_HEIGHT, rotation)  # type: ignore[arg-type]
        # A box spanning most of the upright raster, in pixels.
        box = raster_box_to_pdf(
            (px(10), px(10), px(upright_w - 10), px(upright_h - 10)),
            dpi=DPI,
            page_width=A4_WIDTH,
            page_height=A4_HEIGHT,
            rotation=rotation,  # type: ignore[arg-type]
        )
        x0, y0, x1, y1 = box
        assert -0.01 <= x0 < x1 <= A4_WIDTH + 0.01
        assert -0.01 <= y0 < y1 <= A4_HEIGHT + 0.01

    @pytest.mark.parametrize("rotation", [0, 90, 180, 270])
    def test_the_corners_stay_ordered_lower_left_to_upper_right(self, rotation: int) -> None:
        # A quarter turn sends the top-left corner somewhere that is neither top
        # nor left. Converting two corners and trusting their order is how an
        # inverted box reaches a column the database rejects.
        x0, y0, x1, y1 = raster_box_to_pdf(
            (px(30), px(700), px(200), px(715)),
            dpi=DPI,
            page_width=A4_WIDTH,
            page_height=A4_HEIGHT,
            rotation=rotation,  # type: ignore[arg-type]
        )
        assert x1 > x0
        assert y1 > y0

    def test_a_quarter_turn_puts_the_top_of_the_raster_at_the_left_of_the_page(self) -> None:
        # On a 90-degree page the viewer's top edge is the file's left edge.
        # Asserting the direction, not merely that the numbers are in range,
        # is what distinguishes this from a rotation applied backwards.
        _, _, _, y1 = raster_box_to_pdf(
            (px(10), px(10), px(60), px(30)),
            dpi=DPI,
            page_width=A4_WIDTH,
            page_height=A4_HEIGHT,
            rotation=90,
        )
        # y in PDF space comes from x in raster space, so a box near the
        # raster's left edge sits near the page's bottom.
        assert y1 < A4_HEIGHT / 2

    def test_dpi_is_the_scale_and_must_be_stated(self) -> None:
        with pytest.raises(ValueError, match="dpi"):
            raster_box_to_pdf(
                (0, 0, 10, 10), dpi=0, page_width=A4_WIDTH, page_height=A4_HEIGHT, rotation=0
            )

    def test_a_finer_raster_describes_the_same_region(self) -> None:
        # The same physical box, rendered at two resolutions, is the same box on
        # the page. If it were not, a reading's coordinates would depend on a
        # setting rather than on the document.
        coarse = raster_box_to_pdf(
            (100 * 150 / 72, 50 * 150 / 72, 140 * 150 / 72, 60 * 150 / 72),
            dpi=150,
            page_width=A4_WIDTH,
            page_height=A4_HEIGHT,
            rotation=0,
        )
        fine = raster_box_to_pdf(
            (px(100), px(50), px(140), px(60)),
            dpi=DPI,
            page_width=A4_WIDTH,
            page_height=A4_HEIGHT,
            rotation=0,
        )
        assert coarse == pytest.approx(fine)
