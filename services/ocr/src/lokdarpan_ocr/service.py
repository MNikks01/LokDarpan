"""Reading a document, and the HTTP surface over it.

`read_document` is the whole service; the FastAPI app is a thin wrapper so the
logic can be tested without a server, and so the boundary stays a contract
rather than a framework.

No `from __future__ import annotations` here, unlike the other modules: FastAPI
reads the route's parameter types at request time from this module's globals,
and `UploadFile` is imported inside `create_app` so the module loads without the
web stack. Under postponed annotations the route's types are strings naming
something this module never defines, and `/read` failed every request.
"""

import hashlib
from collections.abc import Callable

from .contract import Capabilities, PageReading, ReadRequest, ReadResponse, Refusal
from .engines.base import EngineInfo, EngineUnavailableError
from .reading import assemble
from .registry import Registry


class ReadAbandonedError(RuntimeError):
    """The caller stopped waiting, so the rest of the document was not read.

    Raised between pages and engines, never mid-recognition: an engine call
    cannot be interrupted, so the most a departed caller costs is the step in
    progress. Before this, a client that gave up left the service reading every
    remaining page of the document for nobody — at PaddleOCR's four minutes a
    page, a backlog that outlived the run that asked for it.
    """


def _never_abandoned() -> bool:
    return False


class DocumentMismatchError(ValueError):
    """The bytes are not the document the request named.

    Checked rather than trusted. A reading is filed against a content hash, and
    a reading filed against the wrong document is worse than no reading: it
    attaches a figure to a source that does not contain it.
    """


def _languages_read(info: EngineInfo, requested: list[str]) -> list[str]:
    """The requested languages this engine's model actually reads, in request order."""
    if info.reads_languages is None:
        return list(requested)
    return [language for language in requested if language in info.reads_languages]


def read_document(
    pdf_bytes: bytes,
    request: ReadRequest,
    registry: Registry,
    abandoned: Callable[[], bool] = _never_abandoned,
) -> ReadResponse:
    """Every requested page, read by every requested engine.

    `abandoned` is asked before each page is rendered and before each engine
    reads it; once it answers yes, `ReadAbandonedError` is raised and nothing
    more is read.
    """
    digest = hashlib.sha256(pdf_bytes).hexdigest()
    if digest != request.document_sha256:
        raise DocumentMismatchError(
            f"the bytes hash to {digest}, and the request names {request.document_sha256}"
        )

    readings: list[PageReading] = []
    refusals: list[Refusal] = []

    # Engines are resolved before any page is rendered, so a missing engine is
    # one refusal rather than one per page.
    engines = {}
    for name in request.engines:
        try:
            engines[name] = registry.get(name)
        except EngineUnavailableError as error:
            refusals.append(Refusal(engine=name, reason=str(error)))

    if not engines:
        return ReadResponse(document_sha256=digest, readings=readings, refusals=refusals)

    from .render import PdfRenderer

    try:
        opened = PdfRenderer(pdf_bytes)
    except Exception as error:
        # A document that will not open is an absence like any other: stated,
        # once per engine, for the whole document — not a server error that
        # leaves the caller unable to tell a broken file from a broken service.
        for name in engines:
            refusals.append(
                Refusal(engine=name, reason=f"the document could not be opened: {error}")
            )
        return ReadResponse(document_sha256=digest, readings=readings, refusals=refusals)

    with opened as renderer:
        for page_number in request.page_numbers:
            if abandoned():
                raise ReadAbandonedError(f"the caller left before page {page_number}")
            try:
                rendered = renderer.render(page_number, request.dpi)
            except Exception as error:
                # One unrenderable page does not end the run; the others are
                # still readable, and this one says why it was not.
                for name in engines:
                    refusals.append(
                        Refusal(
                            page_number=page_number,
                            engine=name,
                            reason=f"the page could not be rendered: {error}",
                        )
                    )
                continue

            for name, engine in engines.items():
                if abandoned():
                    raise ReadAbandonedError(
                        f"the caller left before {name} read page {page_number}"
                    )
                info = engine.info()
                languages = _languages_read(info, request.languages)
                if not languages:
                    refusals.append(
                        Refusal(
                            page_number=page_number,
                            engine=name,
                            reason=(
                                f"the loaded model reads {', '.join(info.reads_languages or ())}"
                                f" and none of the languages asked for"
                                f" ({', '.join(request.languages)})"
                            ),
                        )
                    )
                    continue
                try:
                    with registry.reading(name):
                        words = engine.read(rendered.png, languages)
                except Exception as error:
                    refusals.append(
                        Refusal(
                            page_number=page_number,
                            engine=name,
                            reason=f"{type(error).__name__}: {error}",
                        )
                    )
                    continue

                readings.append(
                    assemble(
                        page_number=page_number,
                        words=words,
                        engine=info,
                        languages=languages,
                        dpi=request.dpi,
                        raster_width=rendered.raster_width,
                        raster_height=rendered.raster_height,
                        page_width=rendered.page_width,
                        page_height=rendered.page_height,
                        rotation=rendered.rotation,
                    )
                )

    return ReadResponse(document_sha256=digest, readings=readings, refusals=refusals)


# The status nginx gives a request whose client closed the connection. Nobody is
# there to receive it; it is what the access log shows for an abandoned read.
_CLIENT_CLOSED = 499


def create_app(registry: Registry | None = None):
    import anyio
    from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile

    resolved = Registry() if registry is None else registry
    app = FastAPI(title="LokDarpan OCR", version="0.1.0")

    @app.get("/capabilities", response_model=Capabilities)
    def capabilities() -> Capabilities:
        return Capabilities(engines=resolved.capabilities())

    @app.post("/read", response_model=ReadResponse)
    async def read(
        http: Request,
        request: str = Form(..., description="A ReadRequest, as JSON"),
        document: UploadFile = File(..., description="The PDF the request names"),
    ) -> ReadResponse | Response:
        parsed = ReadRequest.model_validate_json(request)
        pdf_bytes = await document.read()

        def caller_left() -> bool:
            return anyio.from_thread.run(http.is_disconnected)

        # Recognition is CPU-bound and synchronous. Run on the event loop, it
        # froze the whole service for the length of a document: /capabilities
        # went unanswered, and a client's disconnect could not even be noticed.
        # On a worker thread the loop stays free to answer both.
        try:
            return await anyio.to_thread.run_sync(
                lambda: read_document(pdf_bytes, parsed, resolved, caller_left)
            )
        except DocumentMismatchError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except ReadAbandonedError:
            return Response(status_code=_CLIENT_CLOSED)

    return app
