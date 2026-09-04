"""Assembles an engine's words into the shape the text layer already produces.

This is the join. `document_text_item` holds a character span and a box per
item; `extractFacts` walks sentences and locates a figure by those spans. If an
OCR reading arrives in that same shape, a figure found by OCR is cited, located
and reviewed by the code that already exists — no second pipeline, and no second
set of rules about what counts as evidence.

The words are joined with single spaces and lines with newlines, and the offsets
are recorded as the text is built rather than searched for afterwards. Searching
for a word to find its position is the defect this project has already paid for
twice: the same figure appears many times on a tabular page, and a search finds
the first one.
"""

from __future__ import annotations

from .contract import EngineIdentity, PageReading, Render, TextItem
from .engines.base import EngineInfo, Word
from .geometry import Rotation, raster_box_to_pdf

# Two words whose boxes sit further apart vertically than this fraction of their
# own height are taken to be on different lines. It is a layout heuristic, and
# it affects only where newlines fall in the joined text — never a coordinate,
# never a figure, never a value.
_LINE_BREAK_RATIO = 0.6


def _starts_new_line(previous: Word, current: Word) -> bool:
    previous_height = previous.box[3] - previous.box[1]
    if previous_height <= 0:
        return False
    drop = current.box[1] - previous.box[1]
    return drop > previous_height * _LINE_BREAK_RATIO


def assemble(
    *,
    page_number: int,
    words: list[Word],
    engine: EngineInfo,
    languages: list[str],
    dpi: int,
    raster_width: int,
    raster_height: int,
    page_width: float,
    page_height: float,
    rotation: Rotation,
) -> PageReading:
    content = ""
    items: list[TextItem] = []

    for seq, word in enumerate(words):
        if seq > 0:
            content += "\n" if _starts_new_line(words[seq - 1], word) else " "

        char_start = len(content)
        content += word.text
        char_end = len(content)

        x0, y0, x1, y1 = raster_box_to_pdf(
            word.box,
            dpi=dpi,
            page_width=page_width,
            page_height=page_height,
            rotation=rotation,
        )
        items.append(
            TextItem(
                seq=seq,
                char_start=char_start,
                char_end=char_end,
                x0=x0,
                y0=y0,
                x1=x1,
                y1=y1,
                confidence=word.confidence,
            )
        )

    return PageReading(
        page_number=page_number,
        engine=EngineIdentity(
            name=engine.name,
            version=engine.version,
            model_versions=engine.model_versions,
            languages=languages,
        ),
        render=Render(
            dpi=dpi,
            raster_width=raster_width,
            raster_height=raster_height,
            page_width=page_width,
            page_height=page_height,
            rotation=rotation,
        ),
        content=content,
        items=items,
    )
