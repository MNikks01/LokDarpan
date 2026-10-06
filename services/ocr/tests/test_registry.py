"""An engine that cannot be built is reported, not hidden."""

from __future__ import annotations

import pytest

from lokdarpan_ocr.engines.base import EngineInfo, EngineUnavailableError
from lokdarpan_ocr.registry import Registry


class Ok:
    def info(self) -> EngineInfo:
        return EngineInfo(name="ok", version="1.2.3")

    def read(self, image_png: bytes, languages: list[str]) -> list:
        del image_png, languages
        return []


def _missing() -> Ok:
    raise EngineUnavailableError("the binary is not on PATH")


def _broken() -> Ok:
    raise OSError("shared library not found")


class TestCapabilities:
    def test_reports_the_exact_version_of_what_is_installed(self) -> None:
        status = Registry({"ok": Ok}).capabilities()[0]
        assert status.available is True
        assert status.version == "1.2.3"

    def test_reports_why_an_engine_is_unusable_rather_than_omitting_it(self) -> None:
        # A deployment with no engines must still be able to say so. Omitting
        # the row would make a service with nothing installed indistinguishable
        # from one that read every page and found nothing.
        status = Registry({"ok": _missing}).capabilities()[0]
        assert status.available is False
        assert status.version is None
        assert "not on PATH" in (status.detail or "")

    def test_an_engine_that_fails_some_other_way_is_still_unavailable(self) -> None:
        status = Registry({"ok": _broken}).capabilities()[0]
        assert status.available is False
        assert "OSError" in (status.detail or "")


class TestConstruction:
    def test_an_engine_is_built_once_and_reused(self) -> None:
        built: list[int] = []

        def counting() -> Ok:
            built.append(1)
            return Ok()

        registry = Registry({"ok": counting})
        registry.get("ok")
        registry.get("ok")
        assert len(built) == 1
        assert registry.capabilities()[0].available

    def test_a_failure_is_remembered_rather_than_retried_each_page(self) -> None:
        attempts: list[int] = []

        def failing() -> Ok:
            attempts.append(1)
            raise EngineUnavailableError("not installed")

        registry = Registry({"ok": failing})
        for _ in range(3):
            with pytest.raises(EngineUnavailableError):
                registry.get("ok")
        assert len(attempts) == 1

    def test_an_unknown_name_names_what_is_available(self) -> None:
        with pytest.raises(EngineUnavailableError, match="ok"):
            Registry({"ok": Ok}).get("surya")


class TestConcurrentRequests:
    def test_an_engine_is_built_once_however_many_ask_at_once(self) -> None:
        # PaddleOCR takes minutes to load. Requests that arrived during the load
        # each built their own copy until building was locked.
        import threading
        import time

        built: list[int] = []

        def slow_builder():
            time.sleep(0.05)
            built.append(1)
            return Ok()

        registry = Registry({"slow": slow_builder})
        threads = [threading.Thread(target=registry.get, args=("slow",)) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        assert len(built) == 1

    def test_one_engine_reads_one_page_at_a_time(self) -> None:
        import threading
        import time

        registry = Registry({"stub": Ok})
        inside = 0
        most = 0
        guard = threading.Lock()

        def read() -> None:
            nonlocal inside, most
            with registry.reading("stub"):
                with guard:
                    inside += 1
                    most = max(most, inside)
                time.sleep(0.02)
                with guard:
                    inside -= 1

        threads = [threading.Thread(target=read) for _ in range(6)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        assert most == 1
