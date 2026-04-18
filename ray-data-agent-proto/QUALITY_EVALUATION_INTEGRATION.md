# Quality Evaluation Integration

This VibeDataBot build now embeds the `atomic_ability_evaluate` package directly under the app root so the whole quality-evaluation capability can move with the project.

## What Was Added

- Python package: `atomic_ability_evaluate/`
- Next.js API route: `app/api/evaluate-quality/route.ts`
- UI visualization: `features/quality/components/QualityEvaluationCard.tsx`
- Pipeline execution hook: `features/agent/logic/ExecutionEngine.ts`

## Runtime Contract

### POST `/api/evaluate-quality`

Request body:

```json
{
  "text": "optional raw document text",
  "filePath": "optional local file path",
  "sourceType": "pdf_text",
  "extractMode": "direct",
  "ocrConfidence": null,
  "outputProfile": "standard",
  "includeInputMeta": true,
  "includeDependencyReport": false,
  "includeNormalizedTextLength": true,
  "includeScoreDetail": true,
  "includeChunkMetrics": false,
  "includeChunkMeta": false,
  "inputMeta": {
    "source_path": "/abs/path/to/file.pdf",
    "page_count": 23
  }
}
```

Rules:

- Provide either `text` or `filePath`.
- `outputProfile` supports `compact`, `standard`, and `full`.
- Default integration uses `standard`, which keeps chunk scores silent while returning document-level metrics and rule hits.

Response shape:

```json
{
  "document_metrics": {
    "alpha_han_ratio": 0.91,
    "duplication_ratio": 0.08
  },
  "final_score": 78.42,
  "final_decision": "pass",
  "normalized_text_length": 12540,
  "input_meta": {
    "source_type": "pdf_text",
    "extract_mode": "direct"
  },
  "score_detail": {
    "rule_hits": []
  }
}
```

## Execution Flow

1. `EXTRACT_PDF` generates a `_is_pdf_result` artifact.
2. `CLEAN_TEXT` and `DEDUPLICATE` keep updating the latest PDF artifact.
3. `QUALITY_CHECK` posts the latest text to `/api/evaluate-quality`.
4. The API invokes the active project Python interpreter with `-m atomic_ability_evaluate.cli`.
5. The frontend renders the returned result with `QualityEvaluationCard`.
6. `GENERATE_CORPUS` is blocked unless the latest quality decision is `pass`.

## Dependency Notes

- Python runtime must be able to import:
  - `jieba`
  - `nltk`
  - `regex`
  - `PyMuPDF`
- Package-relative stopwords and sensitive-word resources are bundled inside `atomic_ability_evaluate/resource_data/`.
- See `atomic_ability_evaluate/requirements.txt` for the Python dependency list.

## Recommended Git Ignore

The project `.gitignore` should keep these out of version control:

- `node_modules/`
- `.next/`
- `__pycache__/`
- `.pytest_cache/`
- `*.pyc`

## Reference

For the atomic capability contract itself, read:

- `atomic_ability_evaluate/INTERFACE_DOCUMENTATION.md`
