"""Which engines this deployment can actually use.

Engines are constructed lazily and their failure is a value, not an exception
that reaches the caller. A deployment with neither engine installed still
starts, still answers `/capabilities`, and still refuses every read with a
reason — which is the behaviour that makes a missing engine visible instead of
silently halving the evidence.
"""

from __future__ import annotations

from collections.abc import Callable

from .contract import EngineStatus
from .engines.base import Engine, EngineUnavailableError

Builder = Callable[[], Engine]


def _default_builders() -> dict[str, Builder]:
    from .engines.paddle import NAME as PADDLE
    from .engines.paddle import PaddleEngine
    from .engines.tesseract import NAME as TESSERACT
    from .engines.tesseract import TesseractEngine

    return {TESSERACT: TesseractEngine, PADDLE: PaddleEngine}


class Registry:
    """Builds each engine at most once, and remembers why one could not be."""

    def __init__(self, builders: dict[str, Builder] | None = None) -> None:
        self._builders = _default_builders() if builders is None else dict(builders)
        self._built: dict[str, Engine] = {}
        self._unavailable: dict[str, str] = {}

    @property
    def names(self) -> list[str]:
        return sorted(self._builders)

    def get(self, name: str) -> Engine:
        """The engine, or `EngineUnavailableError` naming what is missing."""
        if name in self._built:
            return self._built[name]
        if name in self._unavailable:
            raise EngineUnavailableError(self._unavailable[name])

        builder = self._builders.get(name)
        if builder is None:
            offered = ", ".join(self.names) or "none"
            raise EngineUnavailableError(
                f"no engine called {name!r}; this deployment offers {offered}"
            )

        try:
            engine = builder()
        except EngineUnavailableError as error:
            self._unavailable[name] = str(error)
            raise
        except Exception as error:  # an adapter that fails another way is still unavailable
            self._unavailable[name] = f"{type(error).__name__}: {error}"
            raise EngineUnavailableError(self._unavailable[name]) from error

        self._built[name] = engine
        return engine

    def capabilities(self) -> list[EngineStatus]:
        statuses: list[EngineStatus] = []
        for name in self.names:
            try:
                engine = self.get(name)
            except EngineUnavailableError as error:
                statuses.append(EngineStatus(name=name, available=False, detail=str(error)))
            else:
                statuses.append(
                    EngineStatus(name=name, available=True, version=engine.info().version)
                )
        return statuses
