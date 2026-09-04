"""What the 522 unread pages actually are, before any engine reads them.

An engine's score means little without knowing what it was scored on. A page
with no text layer might be a scan of a printed table, a photograph of a
signature, or a blank separator sheet, and an engine that "fails" on the third
has not failed at all.

Nothing here recognises text. It measures the raster: how much ink, at what
resolution, with what straight-line structure. Those are properties of the page,
not opinions about it.
"""

from __future__ import annotations

import json
import pathlib
import sys
from dataclasses import asdict, dataclass

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from lokdarpan_ocr.render import PdfRenderer

# Ink darker than this counts as mark rather than paper. Scans carry a grey
# cast, so a mid-grey threshold separates print from background better than a
# near-black one would.
_INK_LEVEL = 160

# A row or column is "ruled" when this fraction of it is ink. Table borders run
# the width of the page; a line of prose does not.
_RULE_COVERAGE = 0.55

# Below this, the page carries too little mark to be a page of text.
_EMPTY_INK_FRACTION = 0.002

# Above this, the sheet itself is dark rather than the marks on it. Report
# covers are printed on solid grounds and read as near-total ink coverage.
_DARK_PAGE_FRACTION = 0.5

# A row carrying a line of writing marks some of its width and leaves the rest.
_TEXT_ROW_MIN = 0.01
_TEXT_ROW_MAX = 0.5

# Fewer part-marked rows than this is not a page of writing. A page of prose at
# 150 dpi carries hundreds; a bordered divider carries none.
_TEXT_ROWS_REQUIRED = 40


@dataclass(frozen=True)
class PageProfile:
    document_id: int
    page_number: int
    script: str
    rotation: int
    page_width: float
    page_height: float
    ink_fraction: float
    ruled_rows: int
    ruled_columns: int
    text_rows: int
    embedded_images: int
    largest_image_pixels: int
    effective_dpi: float | None
    verdict: str


def _verdict(
    ink: float,
    text_rows: int,
    image_count: int,
    raster_pixels: int,
    largest_image_pixels: int,
) -> str:
    """What kind of page this is, described from the raster alone.

    The distinction that matters is between a page an engine should read and one
    where reading nothing is the correct answer. A separator sheet and a failed
    scan both yield no text; only one of them is a failure.

    'blank'      — almost no mark. An engine finding nothing here is right.
    'dark-page'  — most of the sheet is dark: a report cover printed on a solid
                   ground. It carries a title, not a table.
    'plate'      — one image covering much of the sheet: a photograph.
    'text'       — many rows each part-marked: writing, which is what an engine
                   is for, and where a figure might be hiding.
    'sparse'     — ink, but not arranged in lines: a divider sheet with a rule
                   round it, a stray mark. Nothing to read.

    Two earlier versions of this were wrong, and both were caught by rendering
    a page and looking at it rather than by reading the counts: a dark cover was
    called a table because 90% of it is ink, and a grey divider sheet was called
    text because its border is.
    """
    if ink < _EMPTY_INK_FRACTION:
        return "blank"
    if ink > _DARK_PAGE_FRACTION:
        return "dark-page"
    if raster_pixels > 0 and largest_image_pixels >= raster_pixels * 0.25:
        return "plate"
    if text_rows >= _TEXT_ROWS_REQUIRED:
        return "text"
    return "sparse"


def profile_page(renderer: PdfRenderer, page: dict, dpi: int = 150) -> PageProfile:
    import io

    import numpy
    from PIL import Image

    rendered = renderer.render(page["pageNumber"], dpi)
    grey = numpy.asarray(Image.open(io.BytesIO(rendered.png)).convert("L"))

    ink = grey < _INK_LEVEL
    height, width = ink.shape
    ink_fraction = float(ink.mean())

    # A ruled row is one where ink runs most of the way across. Table borders do
    # that; a line of prose does not, however dense the words.
    row_ink = ink.mean(axis=1)
    ruled_rows = int((row_ink >= _RULE_COVERAGE).sum())
    ruled_columns = int((ink.mean(axis=0) >= _RULE_COVERAGE).sum())

    # A line of text marks part of its row and leaves the rest as paper. A
    # border rules one row and leaves the page bare; a solid ground marks every
    # row completely. Counting rows in between is what separates a page of
    # writing from a page with a line on it — which ink volume alone cannot do,
    # as a grey divider sheet and a page of prose can carry the same amount.
    text_rows = int(((row_ink >= _TEXT_ROW_MIN) & (row_ink <= _TEXT_ROW_MAX)).sum())

    # The resolution of the largest embedded image, against the page it covers,
    # is the closest thing to "the DPI this page was scanned at" that can be
    # measured without knowing the scanner.
    images = renderer.page_images(page["pageNumber"])
    largest = images[0][0] * images[0][1] if images else 0
    effective_dpi: float | None = None
    if images and rendered.page_width > 0:
        effective_dpi = round(images[0][0] / (rendered.page_width / 72.0), 1)

    return PageProfile(
        document_id=page["documentId"],
        page_number=page["pageNumber"],
        script=page["script"],
        rotation=rendered.rotation,
        page_width=round(rendered.page_width, 2),
        page_height=round(rendered.page_height, 2),
        ink_fraction=round(ink_fraction, 5),
        ruled_rows=ruled_rows,
        ruled_columns=ruled_columns,
        text_rows=text_rows,
        embedded_images=len(images),
        largest_image_pixels=largest,
        effective_dpi=effective_dpi,
        verdict=_verdict(
            ink_fraction, text_rows, len(images), grey.shape[0] * grey.shape[1], largest
        ),
    )


def main() -> None:
    root = pathlib.Path(__file__).resolve().parents[3]
    manifest = json.loads((root / "data/benchmarks/ocr-manifest.json").read_text())
    pages = manifest["unread"]
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else len(pages)
    pages = pages[:limit]

    by_document: dict[str, list[dict]] = {}
    for page in pages:
        by_document.setdefault(page["storagePath"], []).append(page)

    out = root / "data/benchmarks/unread-profile.jsonl"
    written = 0
    with out.open("w") as handle:
        for storage_path, group in by_document.items():
            pdf = (root / "data/raw" / storage_path).read_bytes()
            with PdfRenderer(pdf) as renderer:
                for page in group:
                    profile = profile_page(renderer, page)
                    handle.write(json.dumps(asdict(profile)) + "\n")
                    written += 1
            print(f"  {storage_path[-12:]}  {len(group):>3} pages", flush=True)

    print(f"profiled {written} pages -> {out}")


if __name__ == "__main__":
    main()
