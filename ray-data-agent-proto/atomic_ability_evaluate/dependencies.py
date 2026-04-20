"""Runtime dependency inspection helpers."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any


RESOURCE_DIR = Path(__file__).resolve().parent / "resource_data"


def _module_status(
    name: str,
    install_hint: str,
    import_target: str | None = None,
    extra_message: str | None = None,
) -> dict[str, Any]:
    target = import_target or name
    try:
        module = __import__(target)
        return {
            "name": name,
            "available": True,
            "warning": False,
            "version": getattr(module, "__version__", None),
            "message": extra_message or f"{name} is available.",
            "install_hint": install_hint,
        }
    except Exception as exc:
        return {
            "name": name,
            "available": False,
            "warning": True,
            "version": None,
            "message": f"{name} is unavailable: {type(exc).__name__}: {exc}",
            "install_hint": install_hint,
        }


def _resource_status(filename: str, description: str) -> dict[str, Any]:
    path = RESOURCE_DIR / filename
    if path.exists():
        return {
            "name": filename,
            "available": True,
            "warning": False,
            "version": None,
            "message": f"{description} is available at {path.name}.",
            "install_hint": f"Ensure {path.name} ships with atomic_ability_evaluate/resource_data.",
        }
    return {
        "name": filename,
        "available": False,
        "warning": True,
        "version": None,
        "message": f"{description} is missing: expected {path}",
        "install_hint": f"Copy {path.name} into atomic_ability_evaluate/resource_data.",
    }


@lru_cache(maxsize=1)
def get_dependency_report() -> dict[str, Any]:
    report: dict[str, Any] = {
        "jieba": _module_status(
            "jieba",
            "pip install jieba",
            extra_message="jieba is used for Chinese word segmentation.",
        ),
        "pymupdf": _module_status(
            "pymupdf",
            "pip install PyMuPDF",
            import_target="fitz",
            extra_message="PyMuPDF is used for PDF text extraction.",
        ),
        "stopwords_en_resource": _resource_status("stopwords_en.txt", "English stopwords resource"),
        "stopwords_zh_resource": _resource_status("stopwords_zh.txt", "Chinese stopwords resource"),
        "sensitive_words_en_resource": _resource_status(
            "sensitive_word_library_en.txt", "English sensitive words resource"
        ),
        "sensitive_words_zh_resource": _resource_status(
            "sensitive_word_library_zh.txt", "Chinese sensitive words resource"
        ),
    }

    report["warnings"] = [
        {
            "dependency": item["name"],
            "message": item["message"],
            "install_hint": item["install_hint"],
        }
        for item in report.values()
        if isinstance(item, dict) and item.get("warning")
    ]
    report["has_warnings"] = bool(report["warnings"])
    return report
