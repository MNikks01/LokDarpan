"""What every engine must supply, and nothing more.

An adapter's whole job is to answer three questions honestly: which engine am I,
what exact version am I, and what words did I see where. It does not decide
whether a reading is good enough, does not merge its output with another
engine's, and does not fill a gap it could not read.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


class EngineUnavailableError(RuntimeError):
    """The engine is not usable here, with a reason a person can act on.

    Raised at construction rather than at read time, and surfaced as a
    `Refusal`. An engine that is missing must never look like an engine that
    found nothing.
    """


@dataclass(frozen=True)
class Word:
    """One recognised word in raster pixels, as the engine reported it.

    `box` is (left, top, right, bottom) in pixels, origin top-left. The
    conversion to page coordinates belongs to `geometry`, once, rather than in
    each adapter.

    `confidence` is normalised to 0..1 by the adapter, which is the only place
    that knows the engine's scale.
    """

    text: str
    box: tuple[float, float, float, float]
    confidence: float


@dataclass(frozen=True)
class EngineInfo:
    name: str
    version: str
    model_versions: dict[str, str] = field(default_factory=dict)


@runtime_checkable
class Engine(Protocol):
    def info(self) -> EngineInfo:
        """The engine's identity, read from the installed engine itself."""

    def read(self, image_png: bytes, languages: list[str]) -> list[Word]:
        """Every word the engine saw, in reading order, or an empty list.

        An empty list means the engine read the page and found no text. It does
        not mean the page is blank, and it does not mean the engine failed —
        failure raises.
        """
