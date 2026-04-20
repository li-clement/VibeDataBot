"""Resource loading helpers for data quality evaluation."""

from __future__ import annotations

import importlib
from functools import lru_cache
from pathlib import Path


RESOURCE_DIR = Path(__file__).resolve().parent / "resource_data"


def _resource_path(filename: str) -> Path:
    return RESOURCE_DIR / filename


def _load_word_file(filename: str) -> frozenset[str]:
    path = _resource_path(filename)
    if not path.exists():
        return frozenset()
    with path.open("r", encoding="utf-8") as handle:
        return frozenset(line.strip() for line in handle if line.strip() and not line.startswith("#"))


@lru_cache(maxsize=1)
def get_english_stopwords() -> frozenset[str]:
    return frozenset(word.lower() for word in _load_word_file("stopwords_en.txt"))


@lru_cache(maxsize=1)
def get_chinese_stopwords() -> frozenset[str]:
    return _load_word_file("stopwords_zh.txt")


@lru_cache(maxsize=1)
def get_sensitive_words_en() -> frozenset[str]:
    return frozenset(word.lower() for word in _load_word_file("sensitive_word_library_en.txt"))


@lru_cache(maxsize=1)
def get_sensitive_words_zh() -> frozenset[str]:
    return _load_word_file("sensitive_word_library_zh.txt")


@lru_cache(maxsize=1)
def get_jieba_module():
    try:
        return importlib.import_module("jieba")
    except Exception:
        return None


@lru_cache(maxsize=1)
def get_pymupdf_module():
    try:
        return importlib.import_module("fitz")
    except Exception:
        return None
