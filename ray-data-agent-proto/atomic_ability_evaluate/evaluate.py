"""Core data quality evaluation pipeline."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import regex

from .resources import (
    get_chinese_stopwords,
    get_english_stopwords,
    get_jieba_module,
    get_pymupdf_module,
    get_sensitive_words_en,
    get_sensitive_words_zh,
)
from .dependencies import get_dependency_report


SHORT_LINE_CHAR_THRESHOLD = 8
SHORT_LINE_WORD_THRESHOLD = 4
MIN_VISIBLE_CHARS = 50
MIN_OCR_CONFIDENCE = 0.65

END_PUNCTUATION = frozenset(".。！？!?；;:：")
LIST_LINE_RE = re.compile(
    r"^\s*(?:[-*•·]|\d+[.)]|\([0-9]+\)|[A-Za-z][.)]|[一二三四五六七八九十]+[、.])\s+"
)
LATIN_WORD_RE = re.compile(r"[A-Za-z]+(?:['’-][A-Za-z]+)*")
NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)*")
WHITESPACE_RE = re.compile(r"[ \t\f\v]+")
DATE_RE = re.compile(r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b")
SENTENCE_RE = re.compile(r"[^.。！？!?；;:：\n]+(?:[.。！？!?；;:：]+|$)")
ZERO_WIDTH_RE = regex.compile(r"[\p{Cf}\u200b-\u200f\ufeff]")
TOKEN_RE = regex.compile(
    r"\p{Han}+|[A-Za-z]+(?:['’-][A-Za-z]+)*|\p{Alphabetic}+|\d+(?:[.,]\d+)*",
    regex.VERSION1,
)
OTHER_ALPHA_RE = regex.compile(r"\A\p{Alphabetic}+\Z", regex.VERSION1)
HAN_RUN_RE = regex.compile(r"\p{Han}+")
HAN_CHAR_RE = regex.compile(r"\p{Han}")
LETTER_RE = re.compile(r"[A-Za-z]")
UPPER_RE = re.compile(r"[A-Z]")

CHUNK_PARAMS = {
    "html": {"target": 700, "max": 1000, "min": 250},
    "pdf_text": {"target": 1400, "max": 1800, "min": 500},
    "pdf_ocr": {"target": 1200, "max": 1600, "min": 500},
}

OUTPUT_PROFILE_DEFAULTS = {
    "compact": {
        "include_input_meta": False,
        "include_dependency_report": False,
        "include_normalized_text_length": False,
        "include_score_detail": False,
        "include_chunk_metrics": False,
        "include_chunk_meta": False,
    },
    "standard": {
        "include_input_meta": True,
        "include_dependency_report": False,
        "include_normalized_text_length": True,
        "include_score_detail": True,
        "include_chunk_metrics": False,
        "include_chunk_meta": False,
    },
    "full": {
        "include_input_meta": True,
        "include_dependency_report": True,
        "include_normalized_text_length": True,
        "include_score_detail": True,
        "include_chunk_metrics": True,
        "include_chunk_meta": True,
    },
}

METRIC_ORDER = [
    "alpha_han_ratio",
    "uppercase_ratio",
    "terminal_punctuation_ratio",
    "short_line_ratio",
    "list_line_ratio",
    "duplication_ratio",
    "char_entropy",
    "avg_sentence_length",
    "punctuation_to_word_ratio",
    "avg_word_length",
    "stopword_ratio",
    "sensitive_word_density",
    "multilingual_mixing",
    "high_freq_3gram_coverage",
    "high_freq_7gram_coverage",
]

METRIC_SPECS = {
    "alpha_han_ratio": {"type": "lower_bad", "good": (0.55, 1.0), "bad": (0.25, None), "weight": 0.08},
    "uppercase_ratio": {"type": "higher_bad", "good": (0.0, 0.18), "bad": (None, 0.45), "weight": 0.03},
    "terminal_punctuation_ratio": {
        "type": "lower_bad",
        "good": (0.55, 1.0),
        "bad": (0.20, None),
        "weight": 0.05,
    },
    "short_line_ratio": {"type": "higher_bad", "good": (0.0, 0.45), "bad": (None, 0.85), "weight": 0.05},
    "list_line_ratio": {"type": "higher_bad", "good": (0.0, 0.35), "bad": (None, 0.70), "weight": 0.03},
    "duplication_ratio": {"type": "higher_bad", "good": (0.0, 0.15), "bad": (None, 0.45), "weight": 0.12},
    "char_entropy": {"type": "double_bad", "good": (2.5, 5.5), "bad": (1.5, 6.5), "weight": 0.10},
    "avg_sentence_length": {"type": "double_bad", "good": (10.0, 120.0), "bad": (4.0, 220.0), "weight": 0.07},
    "punctuation_to_word_ratio": {
        "type": "double_bad",
        "good": (0.08, 0.45),
        "bad": (0.02, 1.00),
        "weight": 0.05,
    },
    "avg_word_length": {"type": "double_bad", "good": (1.2, 6.5), "bad": (1.0, 12.0), "weight": 0.04},
    "stopword_ratio": {"type": "double_bad", "good": (0.15, 0.65), "bad": (0.03, 0.90), "weight": 0.05},
    "sensitive_word_density": {
        "type": "higher_bad",
        "good": (0.0, 0.005),
        "bad": (None, 0.03),
        "weight": 0.10,
    },
    "multilingual_mixing": {"type": "higher_bad", "good": (0.0, 0.35), "bad": (None, 0.65), "weight": 0.05},
    "high_freq_3gram_coverage": {
        "type": "higher_bad",
        "good": (0.0, 0.35),
        "bad": (None, 0.70),
        "weight": 0.09,
    },
    "high_freq_7gram_coverage": {
        "type": "higher_bad",
        "good": (0.0, 0.20),
        "bad": (None, 0.45),
        "weight": 0.09,
    },
}


@dataclass(frozen=True)
class ChunkData:
    index: int
    text: str
    visible_chars: int


class CharTrie:
    """Trie for substring matching on character sequences."""

    END = "_end_"

    def __init__(self, words: set[str] | frozenset[str]):
        self.root: dict[str, Any] = {}
        self.max_len = 0
        for word in words:
            clean = word.strip()
            if not clean:
                continue
            node = self.root
            self.max_len = max(self.max_len, len(clean))
            for ch in clean:
                node = node.setdefault(ch, {})
            node[self.END] = True

    def count_matches(self, text: str) -> int:
        if not self.root or not text:
            return 0
        total = 0
        text_len = len(text)
        for idx in range(text_len):
            node = self.root
            longest = 0
            max_j = min(text_len, idx + self.max_len)
            for j in range(idx, max_j):
                ch = text[j]
                if ch not in node:
                    break
                node = node[ch]
                if self.END in node:
                    longest = j - idx + 1
            if longest:
                total += 1
        return total


class TokenTrie:
    """Trie for matching multi-token phrases."""

    END = "_end_"

    def __init__(self, phrases: list[tuple[str, ...]]):
        self.root: dict[str, Any] = {}
        self.max_len = 0
        for phrase in phrases:
            if not phrase:
                continue
            self.max_len = max(self.max_len, len(phrase))
            node = self.root
            for token in phrase:
                node = node.setdefault(token, {})
            node[self.END] = True

    def count_matches(self, tokens: list[str]) -> int:
        if not self.root or not tokens:
            return 0
        total = 0
        token_len = len(tokens)
        for idx in range(token_len):
            node = self.root
            longest = 0
            max_j = min(token_len, idx + self.max_len)
            for j in range(idx, max_j):
                token = tokens[j]
                if token not in node:
                    break
                node = node[token]
                if self.END in node:
                    longest = j - idx + 1
            if longest:
                total += 1
        return total


def _is_visible(ch: str) -> bool:
    return not ch.isspace()


def _visible_char_count(text: str) -> int:
    return sum(1 for ch in text if _is_visible(ch))


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = ZERO_WIDTH_RE.sub("", text)
    chars: list[str] = []
    for ch in text:
        if ch == "\n":
            chars.append(ch)
            continue
        if ch == "\t":
            chars.append(" ")
            continue
        if unicodedata.category(ch).startswith("C"):
            continue
        chars.append(ch)
    cleaned_lines = [WHITESPACE_RE.sub(" ", line).strip() for line in "".join(chars).split("\n")]
    normalized = "\n".join(cleaned_lines)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _paragraphs_from_text(text: str) -> list[str]:
    return [segment.strip() for segment in re.split(r"\n\s*\n", text) if segment.strip()]


def _sentences_from_text(text: str, lines: list[str]) -> list[str]:
    if not text:
        return []
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return []
    sentences = [segment.strip() for segment in SENTENCE_RE.findall(compact) if segment.strip()]
    if len(sentences) <= 1 and not any(ch in END_PUNCTUATION for ch in compact):
        return lines
    return sentences


def _split_han_run(run: str) -> list[str]:
    jieba = get_jieba_module()
    if jieba is not None:
        tokens = [token.strip() for token in jieba.lcut(run, HMM=False) if token.strip()]
        if tokens:
            return tokens
    if len(run) <= 4:
        return [run]
    tokens: list[str] = []
    idx = 0
    while idx < len(run):
        remaining = len(run) - idx
        if remaining in (1, 2, 3):
            tokens.append(run[idx:])
            break
        tokens.append(run[idx : idx + 2])
        idx += 2
    return tokens


def _tokenize_words(text: str) -> tuple[list[str], list[str], Counter[str]]:
    raw_tokens = TOKEN_RE.findall(text)
    words: list[str] = []
    english_tokens: list[str] = []
    language_counter: Counter[str] = Counter()
    for token in raw_tokens:
        if LATIN_WORD_RE.fullmatch(token):
            lower = token.lower()
            words.append(lower)
            english_tokens.append(lower)
            language_counter["en"] += 1
            continue
        if HAN_RUN_RE.fullmatch(token):
            split = _split_han_run(token)
            words.extend(split)
            language_counter["zh"] += len(split)
            continue
        if token and OTHER_ALPHA_RE.fullmatch(token):
            lower = token.lower()
            words.append(lower)
            language_counter["other_alpha"] += 1
            continue
        words.append(token)
    return words, english_tokens, language_counter


def _punctuation_count(text: str) -> int:
    return sum(1 for ch in text if unicodedata.category(ch).startswith("P"))


def _normalized_visible_text(text: str) -> str:
    return "".join(ch for ch in text if _is_visible(ch))


def _normalized_visible_text_lower(text: str) -> str:
    return _normalized_visible_text(text).lower()


def _normalize_repeat_unit(text: str) -> str:
    lowered = text.lower()
    lowered = DATE_RE.sub("<DATE>", lowered)
    lowered = NUMBER_RE.sub("<NUM>", lowered)
    lowered = WHITESPACE_RE.sub(" ", lowered).strip()
    return lowered


def _duplication_ratio(lines: list[str], paragraphs: list[str]) -> float:
    if not lines and not paragraphs:
        return 0.0
    norm_lines = {_normalize_repeat_unit(line) for line in lines}
    norm_paras = {_normalize_repeat_unit(paragraph) for paragraph in paragraphs}
    dup_line = 1.0 - (len(norm_lines) / max(len(lines), 1))
    dup_para = 1.0 - (len(norm_paras) / max(len(paragraphs), 1))
    return max(dup_line, dup_para)


def _char_entropy(text: str) -> float:
    visible = _normalized_visible_text(text)
    if not visible:
        return 0.0
    counts = Counter(visible)
    total = len(visible)
    return -sum((count / total) * math.log2(count / total) for count in counts.values())


def _high_freq_ngram_coverage(text: str, n: int, min_frequency: int) -> float:
    visible = _normalized_visible_text_lower(text)
    if len(visible) < n:
        return 0.0
    counts = Counter(visible[idx : idx + n] for idx in range(len(visible) - n + 1))
    total = sum(counts.values())
    covered = sum(count for count in counts.values() if count >= min_frequency)
    return covered / total if total else 0.0


def _count_terminal_punctuation(segments: list[str]) -> int:
    return sum(1 for segment in segments if segment and segment.rstrip()[-1] in END_PUNCTUATION)


def _weighted_quantile(pairs: list[tuple[float, float]], quantile: float) -> float:
    if not pairs:
        return 0.0
    ordered = sorted(pairs, key=lambda item: item[0])
    threshold = sum(weight for _, weight in ordered) * quantile
    running = 0.0
    for value, weight in ordered:
        running += weight
        if running >= threshold:
            return value
    return ordered[-1][0]


def _clip(value: float) -> float:
    return min(max(value, 0.0), 1.0)


def _metric_risk(metric_name: str, metric_value: float) -> float:
    spec = METRIC_SPECS[metric_name]
    metric_type = spec["type"]
    good_low, good_high = spec["good"]
    bad_low, bad_high = spec["bad"]
    if metric_type == "higher_bad":
        return _clip((metric_value - good_high) / (bad_high - good_high))
    if metric_type == "lower_bad":
        return _clip((good_low - metric_value) / (good_low - bad_low))
    low_risk = _clip((good_low - metric_value) / (good_low - bad_low))
    high_risk = _clip((metric_value - good_high) / (bad_high - good_high))
    return max(low_risk, high_risk)


def _score_metrics(metrics: dict[str, float]) -> tuple[float, dict[str, float]]:
    risks: dict[str, float] = {}
    total = 0.0
    for metric_name in METRIC_ORDER:
        risk = _metric_risk(metric_name, metrics[metric_name])
        risks[metric_name] = risk
        total += METRIC_SPECS[metric_name]["weight"] * risk
    return total, risks


def _build_matchers() -> tuple[set[str], TokenTrie, CharTrie, CharTrie]:
    sensitive_en = get_sensitive_words_en()
    sensitive_zh = get_sensitive_words_zh()
    chinese_stopwords = get_chinese_stopwords()

    en_single: set[str] = set()
    en_phrases: list[tuple[str, ...]] = []
    for phrase in sensitive_en:
        tokens = tuple(LATIN_WORD_RE.findall(phrase.lower()))
        if not tokens:
            continue
        if len(tokens) == 1:
            en_single.add(tokens[0])
        else:
            en_phrases.append(tokens)

    return en_single, TokenTrie(en_phrases), CharTrie(sensitive_zh), CharTrie(chinese_stopwords)


EN_SINGLE_SENSITIVE, EN_PHRASE_TRIE, ZH_SENSITIVE_TRIE, ZH_STOPWORD_TRIE = _build_matchers()
EN_STOPWORDS = get_english_stopwords()


def compute_metrics(text: str) -> dict[str, Any]:
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    paragraphs = _paragraphs_from_text(text)
    visible_chars = _visible_char_count(text)
    sentences = _sentences_from_text(text, lines)
    segments_for_terminal = sentences if sentences else lines
    words, english_tokens, language_counter = _tokenize_words(text)
    n_words = len(words)

    alpha_count = len(LETTER_RE.findall(text))
    han_count = len(HAN_CHAR_RE.findall(text))
    upper_count = len(UPPER_RE.findall(text))
    punct_count = _punctuation_count(text)
    short_line_count = 0
    list_line_count = 0

    for line in lines:
        line_word_count = len(_tokenize_words(line)[0])
        line_visible = _visible_char_count(line)
        if line_visible < SHORT_LINE_CHAR_THRESHOLD or line_word_count < SHORT_LINE_WORD_THRESHOLD:
            short_line_count += 1
        if LIST_LINE_RE.match(line):
            list_line_count += 1

    terminal_punct_count = _count_terminal_punctuation(segments_for_terminal)
    duplication_ratio = _duplication_ratio(lines, paragraphs)
    entropy = _char_entropy(text)

    sentence_lengths = [_visible_char_count(sentence) for sentence in sentences] if sentences else []
    avg_sentence_length = (
        sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else float(_visible_char_count(text))
    )

    avg_word_length = (sum(len(word) for word in words) / n_words) if n_words else 0.0

    english_stop_count = sum(1 for token in english_tokens if token in EN_STOPWORDS)
    chinese_stop_count = ZH_STOPWORD_TRIE.count_matches(text)
    stopword_count = english_stop_count + chinese_stop_count

    english_sensitive_count = sum(1 for token in english_tokens if token in EN_SINGLE_SENSITIVE)
    english_sensitive_count += EN_PHRASE_TRIE.count_matches(english_tokens)
    chinese_sensitive_count = ZH_SENSITIVE_TRIE.count_matches(text)
    sensitive_count = english_sensitive_count + chinese_sensitive_count

    total_alpha_tokens = sum(language_counter.values())
    if total_alpha_tokens <= 1:
        multilingual_mixing = 0.0
    else:
        entropy_mix = 0.0
        for count in language_counter.values():
            ratio = count / total_alpha_tokens
            entropy_mix -= ratio * math.log2(ratio)
        multilingual_mixing = entropy_mix / math.log2(3)

    metrics = {
        "alpha_han_ratio": (alpha_count + han_count) / max(visible_chars, 1),
        "uppercase_ratio": upper_count / max(alpha_count, 1),
        "terminal_punctuation_ratio": terminal_punct_count / max(len(segments_for_terminal), 1),
        "short_line_ratio": short_line_count / max(len(lines), 1),
        "list_line_ratio": list_line_count / max(len(lines), 1),
        "duplication_ratio": duplication_ratio,
        "char_entropy": entropy,
        "avg_sentence_length": avg_sentence_length,
        "punctuation_to_word_ratio": punct_count / max(n_words, 1),
        "avg_word_length": avg_word_length,
        "stopword_ratio": stopword_count / max(n_words, 1),
        "sensitive_word_density": sensitive_count / max(n_words, 1),
        "multilingual_mixing": multilingual_mixing,
        "high_freq_3gram_coverage": _high_freq_ngram_coverage(text, 3, 3),
        "high_freq_7gram_coverage": _high_freq_ngram_coverage(text, 7, 2),
    }

    return {
        "metrics": metrics,
        "counts": {
            "visible_chars": visible_chars,
            "lines": len(lines),
            "paragraphs": len(paragraphs),
            "sentences": len(sentences),
            "words": n_words,
            "stopwords": stopword_count,
            "sensitive_words": sensitive_count,
        },
    }


def _chunk_text(text: str, source_type: str) -> list[ChunkData]:
    params = CHUNK_PARAMS.get(source_type, CHUNK_PARAMS["html"])
    visible_chars = _visible_char_count(text)
    if visible_chars <= params["max"]:
        return [ChunkData(index=0, text=text, visible_chars=visible_chars)]

    paragraphs = _paragraphs_from_text(text)
    chunks: list[str] = []
    current_parts: list[str] = []
    current_visible = 0

    def flush_current() -> None:
        nonlocal current_parts, current_visible
        if current_parts:
            chunks.append("\n\n".join(current_parts).strip())
        current_parts = []
        current_visible = 0

    def append_unit(unit: str) -> None:
        nonlocal current_visible
        unit_visible = _visible_char_count(unit)
        if current_parts and current_visible + unit_visible > params["max"]:
            flush_current()
        current_parts.append(unit.strip())
        current_visible += unit_visible
        if current_visible >= params["target"]:
            flush_current()

    for paragraph in paragraphs:
        paragraph_visible = _visible_char_count(paragraph)
        if paragraph_visible <= params["max"]:
            append_unit(paragraph)
            continue
        paragraph_lines = [line for line in paragraph.split("\n") if line.strip()]
        sentence_source = " ".join(paragraph_lines)
        sentences = _sentences_from_text(sentence_source, paragraph_lines)
        for sentence in sentences:
            sentence_visible = _visible_char_count(sentence)
            if sentence_visible <= params["max"]:
                append_unit(sentence)
                continue
            visible_sentence = sentence.strip()
            start = 0
            while start < len(visible_sentence):
                end = min(len(visible_sentence), start + params["max"])
                append_unit(visible_sentence[start:end])
                start = end
    flush_current()

    if len(chunks) >= 2 and _visible_char_count(chunks[-1]) < params["min"]:
        merged = f"{chunks[-2]}\n\n{chunks[-1]}".strip()
        if _visible_char_count(merged) <= params["max"] * 1.35:
            chunks[-2] = merged
            chunks.pop()

    return [
        ChunkData(index=index, text=chunk, visible_chars=_visible_char_count(chunk))
        for index, chunk in enumerate(chunk for chunk in chunks if chunk)
    ]


def _precheck(normalized_text: str, source_type: str, ocr_confidence: float | None) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    visible_chars = _visible_char_count(normalized_text)
    if visible_chars < MIN_VISIBLE_CHARS:
        issues.append(
            {
                "code": "text_too_short",
                "severity": "manual_review",
                "message": f"Visible characters below minimum threshold ({visible_chars} < {MIN_VISIBLE_CHARS}).",
            }
        )
    if source_type == "pdf_ocr" and ocr_confidence is not None and ocr_confidence < MIN_OCR_CONFIDENCE:
        issues.append(
            {
                "code": "ocr_low_confidence",
                "severity": "manual_review",
                "message": f"OCR confidence below threshold ({ocr_confidence:.3f} < {MIN_OCR_CONFIDENCE}).",
            }
        )
    return issues


def _hard_rules(
    document_metrics: dict[str, float],
    rho_bad: float,
    critical_bad_chunks: list[int],
    source_type: str,
    ocr_confidence: float | None,
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    if source_type == "pdf_ocr" and ocr_confidence is not None and ocr_confidence < MIN_OCR_CONFIDENCE:
        issues.append({"code": "ocr_low_confidence", "severity": "manual_review"})
    if document_metrics["alpha_han_ratio"] < 0.25:
        issues.append({"code": "alpha_han_ratio_too_low", "severity": "reject"})
    if document_metrics["duplication_ratio"] > 0.55:
        issues.append({"code": "duplication_ratio_too_high", "severity": "reject"})
    if document_metrics["char_entropy"] < 1.2:
        issues.append({"code": "char_entropy_too_low", "severity": "reject"})
    if document_metrics["sensitive_word_density"] > 0.05:
        issues.append({"code": "sensitive_density_high", "severity": "manual_review"})
    if document_metrics["high_freq_7gram_coverage"] > 0.60:
        issues.append({"code": "high_freq_7gram_coverage_too_high", "severity": "reject"})
    if rho_bad > 0.30:
        issues.append({"code": "bad_chunk_ratio_high", "severity": "manual_review"})
    if critical_bad_chunks:
        severity = "reject" if len(critical_bad_chunks) > 1 else "manual_review"
        issues.append({"code": "critical_bad_chunk", "severity": severity, "chunk_indexes": critical_bad_chunks})
    return issues


def _decision_from_rules(score: float | None, rule_hits: list[dict[str, Any]]) -> str:
    severities = {hit["severity"] for hit in rule_hits}
    if "reject" in severities:
        return "reject"
    if "manual_review" in severities:
        return "manual_review"
    if score is None:
        return "manual_review"
    if score >= 70.0:
        return "pass"
    if score < 55.0:
        return "reject"
    return "manual_review"


def _format_result(
    full_result: dict[str, Any],
    output_profile: str = "compact",
    *,
    include_input_meta: bool | None = None,
    include_dependency_report: bool | None = None,
    include_normalized_text_length: bool | None = None,
    include_score_detail: bool | None = None,
    include_chunk_metrics: bool | None = None,
    include_chunk_meta: bool | None = None,
) -> dict[str, Any]:
    if output_profile not in OUTPUT_PROFILE_DEFAULTS:
        raise ValueError(f"Unsupported output profile: {output_profile}")

    options = dict(OUTPUT_PROFILE_DEFAULTS[output_profile])
    overrides = {
        "include_input_meta": include_input_meta,
        "include_dependency_report": include_dependency_report,
        "include_normalized_text_length": include_normalized_text_length,
        "include_score_detail": include_score_detail,
        "include_chunk_metrics": include_chunk_metrics,
        "include_chunk_meta": include_chunk_meta,
    }
    for key, value in overrides.items():
        if value is not None:
            options[key] = value

    result = {
        "document_metrics": full_result["document_metrics"],
        "final_score": full_result["final_score"],
        "final_decision": full_result["final_decision"],
    }
    warnings = full_result["dependency_report"]["warnings"]
    if warnings:
        result["dependency_warnings"] = warnings
    if options["include_input_meta"]:
        result["input_meta"] = full_result["input_meta"]
    if options["include_dependency_report"]:
        result["dependency_report"] = full_result["dependency_report"]
    if options["include_normalized_text_length"]:
        result["normalized_text_length"] = full_result["normalized_text_length"]
    if options["include_score_detail"]:
        result["score_detail"] = full_result["score_detail"]
    if options["include_chunk_metrics"]:
        result["chunk_metrics"] = full_result["chunk_metrics"]
    if options["include_chunk_meta"]:
        result["chunk_meta"] = full_result["chunk_meta"]
    return result


def _evaluate_record_full(record: dict[str, Any]) -> dict[str, Any]:
    text = record.get("text", "")
    meta = dict(record.get("meta", {}) or {})
    source_type = meta.get("source_type", "html")
    extract_mode = meta.get("extract_mode", "direct")
    ocr_confidence = meta.get("ocr_confidence")
    dependency_report = get_dependency_report()

    normalized_text = normalize_text(text)
    precheck_hits = _precheck(normalized_text, source_type, ocr_confidence)

    if precheck_hits and any(hit["code"] == "text_too_short" for hit in precheck_hits):
        return {
            "input_meta": {
                **meta,
                "source_type": source_type,
                "extract_mode": extract_mode,
                "ocr_confidence": ocr_confidence,
            },
            "dependency_report": dependency_report,
            "normalized_text_length": _visible_char_count(normalized_text),
            "document_metrics": {},
            "chunk_metrics": [],
            "chunk_meta": [],
            "score_detail": {
                "dependency_warnings": dependency_report["warnings"],
                "precheck_hits": precheck_hits,
                "rule_hits": precheck_hits,
                "document_risk": None,
                "tail_risk": None,
                "bad_chunk_ratio": None,
                "chunk_risks": [],
            },
            "final_score": None,
            "final_decision": "manual_review",
        }

    chunks = _chunk_text(normalized_text, source_type)
    chunk_metrics: list[dict[str, Any]] = []
    chunk_risks: list[float] = []
    critical_bad_chunks: list[int] = []
    total_visible = sum(chunk.visible_chars for chunk in chunks) or 1

    for chunk in chunks:
        chunk_result = compute_metrics(chunk.text)
        risk, metric_risks = _score_metrics(chunk_result["metrics"])
        chunk_entry = {
            "chunk_index": chunk.index,
            "metrics": chunk_result["metrics"],
            "metric_risks": metric_risks,
            "risk": risk,
        }
        chunk_metrics.append(chunk_entry)
        chunk_risks.append(risk)
        metrics = chunk_result["metrics"]
        if (
            metrics["alpha_han_ratio"] < 0.20
            or metrics["char_entropy"] < 1.0
            or metrics["high_freq_7gram_coverage"] > 0.75
        ):
            critical_bad_chunks.append(chunk.index)

    document_result = compute_metrics(normalized_text)
    base_risk, document_metric_risks = _score_metrics(document_result["metrics"])
    weighted_chunk_pairs = [
        (risk, chunk.visible_chars / total_visible) for risk, chunk in zip(chunk_risks, chunks, strict=True)
    ]
    bad_chunk_ratio = sum(weight for risk, weight in weighted_chunk_pairs if risk >= 0.60)
    tail_risk = _weighted_quantile(weighted_chunk_pairs, 0.90)
    document_risk = 0.55 * base_risk + 0.25 * tail_risk + 0.20 * bad_chunk_ratio
    final_score = round(100.0 * (1.0 - document_risk), 4)

    rule_hits = precheck_hits + _hard_rules(
        document_result["metrics"],
        bad_chunk_ratio,
        critical_bad_chunks,
        source_type,
        ocr_confidence,
    )
    final_decision = _decision_from_rules(final_score, rule_hits)

    return {
        "input_meta": {
            **meta,
            "source_type": source_type,
            "extract_mode": extract_mode,
            "ocr_confidence": ocr_confidence,
        },
        "dependency_report": dependency_report,
        "normalized_text_length": _visible_char_count(normalized_text),
        "document_metrics": document_result["metrics"],
        "chunk_metrics": chunk_metrics,
        "chunk_meta": [
            {
                "chunk_index": chunk.index,
                "visible_chars": chunk.visible_chars,
                "char_weight": round(chunk.visible_chars / total_visible, 6),
            }
            for chunk in chunks
        ],
        "score_detail": {
            "dependency_warnings": dependency_report["warnings"],
            "precheck_hits": precheck_hits,
            "rule_hits": rule_hits,
            "document_metric_risks": document_metric_risks,
            "document_base_risk": round(base_risk, 6),
            "document_risk": round(document_risk, 6),
            "tail_risk": round(tail_risk, 6),
            "bad_chunk_ratio": round(bad_chunk_ratio, 6),
            "chunk_risks": [round(risk, 6) for risk in chunk_risks],
            "critical_bad_chunks": critical_bad_chunks,
        },
        "final_score": final_score,
        "final_decision": final_decision,
    }


def evaluate_record(
    record: dict[str, Any],
    output_profile: str = "compact",
    *,
    include_input_meta: bool | None = None,
    include_dependency_report: bool | None = None,
    include_normalized_text_length: bool | None = None,
    include_score_detail: bool | None = None,
    include_chunk_metrics: bool | None = None,
    include_chunk_meta: bool | None = None,
) -> dict[str, Any]:
    full_result = _evaluate_record_full(record)
    return _format_result(
        full_result,
        output_profile,
        include_input_meta=include_input_meta,
        include_dependency_report=include_dependency_report,
        include_normalized_text_length=include_normalized_text_length,
        include_score_detail=include_score_detail,
        include_chunk_metrics=include_chunk_metrics,
        include_chunk_meta=include_chunk_meta,
    )


def _record_from_json(payload: Any, text_field: str) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [_coerce_record(item, text_field) for item in payload]
    return [_coerce_record(payload, text_field)]


def _coerce_record(payload: Any, text_field: str) -> dict[str, Any]:
    if isinstance(payload, str):
        return {"text": payload, "meta": {}}
    if not isinstance(payload, dict):
        raise TypeError("Input payload must be a string, object, or list of objects.")
    if "text" in payload:
        meta = payload.get("meta", {})
        return {"text": payload["text"], "meta": meta if isinstance(meta, dict) else {}}
    if text_field not in payload:
        raise KeyError(f"Missing text field '{text_field}' in JSON payload.")
    meta = payload.get("meta", {})
    return {"text": payload[text_field], "meta": meta if isinstance(meta, dict) else {}}


def load_records_from_path(path: str | Path, text_field: str = "text") -> list[dict[str, Any]]:
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        fitz = get_pymupdf_module()
        if fitz is None:
            report = get_dependency_report()
            warning = next(
                (item for item in report["warnings"] if item["dependency"] == "pymupdf"),
                None,
            )
            if warning:
                raise ImportError(f"{warning['message']} Install with: {warning['install_hint']}")
            raise ImportError("PyMuPDF is required for PDF extraction.")
        with fitz.open(path) as doc:
            page_texts = [page.get_text("text") for page in doc]
            return [
                {
                    "text": "\n\n".join(page_texts),
                    "meta": {
                        "source_type": "pdf_text",
                        "extract_mode": "direct",
                        "page_count": doc.page_count,
                        "source_path": str(path),
                    },
                }
            ]
    with path.open("r", encoding="utf-8") as handle:
        if suffix in {".txt", ".md", ".tex"}:
            return [{"text": handle.read(), "meta": {}}]
        if suffix == ".json":
            return _record_from_json(json.load(handle), text_field)
        if suffix == ".jsonl":
            records: list[dict[str, Any]] = []
            for line_number, line in enumerate(handle, start=1):
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    payload = json.loads(stripped)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSONL at line {line_number}: {exc}") from exc
                records.extend(_record_from_json(payload, text_field))
            return records
    raise ValueError(f"Unsupported input file type: {path.suffix}")


def evaluate_records(
    records: list[dict[str, Any]],
    output_profile: str = "compact",
    *,
    include_input_meta: bool | None = None,
    include_dependency_report: bool | None = None,
    include_normalized_text_length: bool | None = None,
    include_score_detail: bool | None = None,
    include_chunk_metrics: bool | None = None,
    include_chunk_meta: bool | None = None,
) -> list[dict[str, Any]]:
    return [
        evaluate_record(
            record,
            output_profile,
            include_input_meta=include_input_meta,
            include_dependency_report=include_dependency_report,
            include_normalized_text_length=include_normalized_text_length,
            include_score_detail=include_score_detail,
            include_chunk_metrics=include_chunk_metrics,
            include_chunk_meta=include_chunk_meta,
        )
        for record in records
    ]
