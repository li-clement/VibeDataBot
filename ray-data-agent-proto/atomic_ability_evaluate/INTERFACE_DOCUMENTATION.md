# Atomic Ability Evaluate Interface

## 1. Purpose

`atomic_ability_evaluate` is a portable Python atomic ability package for:

1. ingesting text or PDF-extracted text,
2. computing 15 heuristic document-quality metrics,
3. producing a heuristic scalar quality score,
4. returning integration-friendly JSON for VibeDataBot.

The folder is self-contained. Resource files are stored in `resource_data/` and are loaded by package-relative paths.

## 2. Runtime Dependencies

Required runtime libraries:

1. `jieba`
2. `PyMuPDF`
3. `regex`

Required bundled resources:

1. `resource_data/stopwords_en.txt`
2. `resource_data/stopwords_zh.txt`
3. `resource_data/sensitive_word_library_en.txt`
4. `resource_data/sensitive_word_library_zh.txt`

Dependency warnings do not need to be shown in the default compact output, but they can be exposed by interface switches.

## 3. Public Python API

Main entrypoints:

1. `atomic_ability_evaluate.evaluate.evaluate_record(record, ...)`
2. `atomic_ability_evaluate.evaluate.evaluate_records(records, ...)`
3. `atomic_ability_evaluate.evaluate.load_records_from_path(path, text_field="text")`

Minimal record shape:

```python
{
  "text": "...",
  "meta": {
    "source_type": "html" | "pdf_text" | "pdf_ocr",
    "extract_mode": "direct" | "ocr",
    "ocr_confidence": 0.93
  }
}
```

## 4. Output Profiles

### 4.1 Default behavior

Default output profile is `compact`.

It returns only:

1. `document_metrics`
2. `final_score`
3. `final_decision`

Chunk-level scoring is silent by default.

### 4.2 Supported profiles

1. `compact`
2. `standard`
3. `full`

Profile behavior:

1. `compact`: global 15 metrics + final score + final decision
2. `standard`: compact output plus `input_meta`, `normalized_text_length`, `score_detail`
3. `full`: standard output plus `dependency_report`, `chunk_metrics`, `chunk_meta`

## 5. Fine-Grained Output Switches

Both `evaluate_record()` and `evaluate_records()` support these optional switches:

1. `include_input_meta`
2. `include_dependency_report`
3. `include_normalized_text_length`
4. `include_score_detail`
5. `include_chunk_metrics`
6. `include_chunk_meta`

These switches override profile defaults.

Example:

```python
from atomic_ability_evaluate.evaluate import evaluate_record

result = evaluate_record(
    {
        "text": "Example text.",
        "meta": {"source_type": "html", "extract_mode": "direct"},
    },
    output_profile="compact",
    include_score_detail=True,
)
```

## 6. CLI

CLI entrypoint:

```bash
python -m atomic_ability_evaluate.cli --input-path /abs/path/file.pdf
```

Useful CLI flags:

1. `--output-profile compact|standard|full`
2. `--include-input-meta`
3. `--include-dependency-report`
4. `--include-normalized-text-length`
5. `--include-score-detail`
6. `--include-chunk-metrics`
7. `--include-chunk-meta`
8. `--strict-deps`

Example:

```bash
python -m atomic_ability_evaluate.cli \
  --input-path /abs/path/file.pdf \
  --output-profile compact \
  --include-score-detail \
  --pretty
```

## 7. PDF Test Script

Portable local test script:

```bash
python /absolute/path/to/atomic_ability_evaluate/tests/run_pdf_evaluate.py
```

Default behavior:

1. extracts `tests/test_data.pdf` with `PyMuPDF`,
2. evaluates extracted text,
3. prints a compact JSON report.

Optional switches are the same as the main output-profile switches:

1. `--output-profile compact|standard|full`
2. `--include-input-meta`
3. `--include-dependency-report`
4. `--include-normalized-text-length`
5. `--include-score-detail`
6. `--include-chunk-metrics`
7. `--include-chunk-meta`

## 8. Default Compact Output Schema

```json
{
  "document_metrics": {
    "alpha_han_ratio": 0.0,
    "uppercase_ratio": 0.0,
    "terminal_punctuation_ratio": 0.0,
    "short_line_ratio": 0.0,
    "list_line_ratio": 0.0,
    "duplication_ratio": 0.0,
    "char_entropy": 0.0,
    "avg_sentence_length": 0.0,
    "punctuation_to_word_ratio": 0.0,
    "avg_word_length": 0.0,
    "stopword_ratio": 0.0,
    "sensitive_word_density": 0.0,
    "multilingual_mixing": 0.0,
    "high_freq_3gram_coverage": 0.0,
    "high_freq_7gram_coverage": 0.0
  },
  "final_score": 0.0,
  "final_decision": "pass"
}
```

If dependency or resource warnings exist, the output may additionally contain:

```json
{
  "dependency_warnings": [
    {
      "dependency": "stopwords_en.txt",
      "message": "...",
      "install_hint": "..."
    }
  ]
}
```

## 9. Integration Recommendation For VibeDataBot

Recommended VibeDataBot integration mode:

1. Use `compact` as the default production output.
2. Turn on `include_score_detail` during debugging or audit mode.
3. Turn on `full` only for developer troubleshooting or UI drill-down pages.
4. Keep chunk-level outputs off by default in high-throughput production paths.
