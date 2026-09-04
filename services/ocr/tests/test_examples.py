"""The committed examples are the contract, and both sides are held to them.

One side is Python and the other TypeScript. They cannot be checked against each
other directly, so they are each checked against the same bytes: every document
in `contract/examples` must be accepted, and every document in
`contract/rejected` must be refused, by both.

A change that loosens one side alone turns one of these into a failure rather
than into a silent divergence discovered when a figure lands in the wrong place.
"""

from __future__ import annotations

import json
import pathlib

import pytest
from pydantic import ValidationError

from lokdarpan_ocr.contract import Capabilities, ReadRequest, ReadResponse

ROOT = pathlib.Path(__file__).resolve().parents[1] / "contract"

MODELS = {
    "read-request.json": ReadRequest,
    "read-response.json": ReadResponse,
    "read-response-no-engines.json": ReadResponse,
    "read-response-empty-page.json": ReadResponse,
    "capabilities.json": Capabilities,
}


def examples() -> list[pathlib.Path]:
    return sorted((ROOT / "examples").glob("*.json"))


def rejected() -> list[pathlib.Path]:
    return sorted((ROOT / "rejected").glob("*.json"))


def test_every_example_is_covered_by_this_test() -> None:
    # A new example nobody validates is a new example nobody checks.
    assert {p.name for p in examples()} == set(MODELS)


@pytest.mark.parametrize("path", examples(), ids=lambda p: p.name)
def test_an_example_is_accepted(path: pathlib.Path) -> None:
    MODELS[path.name].model_validate_json(path.read_text())


@pytest.mark.parametrize("path", rejected(), ids=lambda p: p.name)
def test_a_counter_example_is_refused(path: pathlib.Path) -> None:
    # Every counter-example is a ReadResponse-shaped document that must not
    # validate — including one carrying a `consensus` field, which this contract
    # deliberately has nowhere to put.
    with pytest.raises(ValidationError):
        ReadResponse.model_validate_json(path.read_text())


def test_the_examples_round_trip_without_drifting() -> None:
    for path in examples():
        model = MODELS[path.name].model_validate_json(path.read_text())
        assert json.loads(path.read_text()) == model.model_dump(mode="json")
