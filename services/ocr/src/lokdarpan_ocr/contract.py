"""The wire contract between the ingestion pipeline and an OCR engine.

Three rules shape every type here, and each is a decision the project has
already paid for elsewhere:

**The engine is not the source of truth.** The page image is. So a reading
carries the engine that produced it, that engine's exact version, and the render
it was taken from — enough for someone to reproduce the reading or to disbelieve
it. A reading with no provenance is not admissible.

**Nothing is merged.** Two engines reading one page produce two readings. This
contract has no field for a consensus value, because agreeing to a figure by
majority is how a wrong figure acquires a confident-looking source link.

**An absence is stated, never implied.** An engine that could not be loaded, or
could not read a page, produces a `Refusal` naming the reason. A response with
fewer readings than engines asked for, and no refusal to explain it, is
malformed.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CONTRACT_VERSION = "ocr/1"

Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
"""The raw store addresses documents by content hash; a reading names the same."""

Rotation = Literal[0, 90, 180, 270]

Confidence = Annotated[float, Field(ge=0.0, le=1.0)]
"""Normalised to 0..1. Engines disagree on scale — Tesseract reports 0..100 —
and the conversion is a documented linear map, applied once, at the adapter."""


class Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class TextItem(Frozen):
    """One piece of recognised text, and where it sits on the page.

    Deliberately the same shape the PDF text layer already produces, with a
    confidence added. That is what lets an OCR reading flow into the existing
    extraction and validation pipeline without a second code path: a figure
    found in OCR output is located, cited and reviewed exactly as one found in a
    text layer.

    `char_start`/`char_end` index into the reading's `content`, which is built
    from these items. Coordinates are PDF points, origin bottom-left, in the
    page's **unrotated** space — the space `document_text_item` stores.
    """

    seq: int = Field(ge=0)
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)
    x0: float
    y0: float
    x1: float
    y1: float
    confidence: Confidence

    @model_validator(mode="after")
    def _ordered(self) -> TextItem:
        if self.char_end < self.char_start:
            raise ValueError("char_end precedes char_start")
        if self.x1 < self.x0 or self.y1 < self.y0:
            raise ValueError("box corners are not ordered lower-left to upper-right")
        return self


class EngineIdentity(Frozen):
    """Which engine, at exactly which version, reading which languages.

    `version` is read from the installed engine at runtime, never declared here.
    A recorded "latest" would make a reading unreproducible the moment the image
    is rebuilt, which is the same defect as a source URL written from memory.
    """

    name: str = Field(min_length=1)
    version: str = Field(min_length=1)
    model_versions: dict[str, str] = Field(default_factory=dict)
    languages: list[str] = Field(min_length=1)


class Render(Frozen):
    """The raster the engine actually read, described well enough to redo it.

    Both the raster and the page box are recorded because the mapping between
    them is where coordinates go wrong. A rotated page renders upright while the
    ledger stores the unrotated box; keeping both, plus the rotation, makes that
    conversion checkable rather than assumed.
    """

    dpi: int = Field(gt=0)
    raster_width: int = Field(gt=0)
    raster_height: int = Field(gt=0)
    page_width: float = Field(gt=0)
    page_height: float = Field(gt=0)
    rotation: Rotation


class PageReading(Frozen):
    """One engine's reading of one page. Never a blend of two."""

    page_number: int = Field(ge=1)
    engine: EngineIdentity
    render: Render
    content: str
    items: list[TextItem]

    @model_validator(mode="after")
    def _items_address_the_content(self) -> PageReading:
        for item in self.items:
            if item.char_end > len(self.content):
                raise ValueError(
                    f"item {item.seq} addresses character {item.char_end} of "
                    f"{len(self.content)}; offsets must index the content they came with"
                )
        return self


class Refusal(Frozen):
    """A page an engine did not read, and why.

    Present so that a short response is never mistaken for a clean one. "The
    engine is not installed" and "the engine found no text" are different facts,
    and neither is "the page is blank".
    """

    page_number: int | None = Field(default=None, ge=1)
    engine: str
    reason: str = Field(min_length=1)


class ReadRequest(Frozen):
    contract_version: Literal["ocr/1"] = CONTRACT_VERSION
    document_sha256: Sha256
    page_numbers: list[int] = Field(min_length=1)
    engines: list[str] = Field(min_length=1)
    languages: list[str] = Field(min_length=1)
    dpi: int = Field(default=300, gt=0, le=1200)

    @model_validator(mode="after")
    def _pages_are_one_based(self) -> ReadRequest:
        if any(n < 1 for n in self.page_numbers):
            raise ValueError("page numbers are 1-based, as a citation writes them")
        return self


class ReadResponse(Frozen):
    contract_version: Literal["ocr/1"] = CONTRACT_VERSION
    document_sha256: Sha256
    readings: list[PageReading]
    refusals: list[Refusal]


class EngineStatus(Frozen):
    """Whether an engine can be used here, and if not, what is missing."""

    name: str
    available: bool
    version: str | None = None
    detail: str | None = None


class Capabilities(Frozen):
    contract_version: Literal["ocr/1"] = CONTRACT_VERSION
    engines: list[EngineStatus]
