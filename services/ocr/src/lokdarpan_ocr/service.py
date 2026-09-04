"""Reading a document, and the HTTP surface over it.

`read_document` is the whole service; the FastAPI app is a thin wrapper so the
logic can be tested without a server, and so the boundary stays a contract
rather than a framework.
"""

from __future__ import annotations

import hashlib

from .contract import Capabilities, PageReading, ReadRequest, ReadResponse, Refusal
from .engines.base import EngineUnavailableError
from .reading import assemble
from .registry import Registry


class DocumentMismatchError(ValueError):
    """The bytes are not the document the request named.

    Checked rather than trusted. A reading is filed against a content hash, and
    a reading filed against the wrong document is worse than no reading: it
    attaches a figure to a source that does not contain it.
    """


def read_document(
    pdf_bytes: bytes,
    request: ReadRequest,
    registry: Registry,
) -> ReadResponse:
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

    with PdfRenderer(pdf_bytes) as renderer:
        for page_number in request.page_numbers:
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
                try:
                    words = engine.read(rendered.png, request.languages)
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
                        engine=engine.info(),
                        languages=request.languages,
                        dpi=request.dpi,
                        raster_width=rendered.raster_width,
                        raster_height=rendered.raster_height,
                        page_width=rendered.page_width,
                        page_height=rendered.page_height,
                        rotation=rendered.rotation,
                    )
                )

    return ReadResponse(document_sha256=digest, readings=readings, refusals=refusals)


def create_app(registry: Registry | None = None):
    from fastapi import FastAPI, File, Form, HTTPException, UploadFile

    resolved = Registry() if registry is None else registry
    app = FastAPI(title="LokDarpan OCR", version="0.1.0")

    @app.get("/capabilities", response_model=Capabilities)
    def capabilities() -> Capabilities:
        return Capabilities(engines=resolved.capabilities())

    @app.post("/read", response_model=ReadResponse)
    async def read(
        request: str = Form(..., description="A ReadRequest, as JSON"),
        document: UploadFile = File(..., description="The PDF the request names"),
    ) -> ReadResponse:
        parsed = ReadRequest.model_validate_json(request)
        try:
            return read_document(await document.read(), parsed, resolved)
        except DocumentMismatchError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    return app
