"""The HTTP surface, exercised through the app rather than around it.

`test_service.py` tests `read_document` directly, which is where the logic is.
That left the route itself untested, and the route was broken: under postponed
annotations FastAPI could not resolve `UploadFile`, and every `/read` failed
with a 500 the first time the ingestion pipeline called it. These tests post a
real multipart form to the app the server runs.
"""

import hashlib
import json

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("multipart")
from fastapi.testclient import TestClient

from lokdarpan_ocr.engines.base import EngineInfo, Word
from lokdarpan_ocr.registry import Registry
from lokdarpan_ocr.service import create_app

PDF = b"%PDF-1.4 not a real document"
DIGEST = hashlib.sha256(PDF).hexdigest()


class StubEngine:
    def info(self) -> EngineInfo:
        return EngineInfo(name="stub", version="0.0.1-test")

    def read(self, image_png: bytes, languages: list[str]) -> list[Word]:
        del image_png, languages
        return []


def client() -> TestClient:
    return TestClient(create_app(Registry({"stub": StubEngine})))


def form(sha256: str = DIGEST) -> dict[str, str]:
    request = {
        "document_sha256": sha256,
        "page_numbers": [1],
        "engines": ["stub"],
        "languages": ["eng"],
    }
    return {"request": json.dumps(request)}


def test_read_accepts_a_multipart_form_and_answers_in_the_contract() -> None:
    response = client().post(
        "/read", data=form(), files={"document": ("doc.pdf", PDF, "application/pdf")}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["contract_version"] == "ocr/1"
    assert body["document_sha256"] == DIGEST
    # The stub bytes are not a PDF pdfium can open, so the page is refused with
    # a reason rather than read — which is exactly the honesty under test.
    assert len(body["readings"]) + len(body["refusals"]) >= 1


def test_read_refuses_bytes_that_are_not_the_named_document() -> None:
    response = client().post(
        "/read",
        data=form("0" * 64),
        files={"document": ("doc.pdf", PDF, "application/pdf")},
    )
    assert response.status_code == 422


def test_capabilities_names_the_engines() -> None:
    body = client().get("/capabilities").json()
    assert [e["name"] for e in body["engines"]] == ["stub"]
