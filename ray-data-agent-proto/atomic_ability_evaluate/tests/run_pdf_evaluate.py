from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from atomic_ability_evaluate.evaluate import evaluate_record  # noqa: E402
from atomic_ability_evaluate.resources import get_pymupdf_module  # noqa: E402
from atomic_ability_evaluate.dependencies import get_dependency_report  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run PDF extraction + evaluation on tests/test_data.pdf")
    parser.add_argument(
        "--output-profile",
        type=str,
        default="compact",
        choices=["compact", "standard", "full"],
        help="Output verbosity profile. Default keeps chunk-level outputs silent.",
    )
    parser.add_argument("--include-input-meta", action="store_true")
    parser.add_argument("--include-dependency-report", action="store_true")
    parser.add_argument("--include-normalized-text-length", action="store_true")
    parser.add_argument("--include-score-detail", action="store_true")
    parser.add_argument("--include-chunk-metrics", action="store_true")
    parser.add_argument("--include-chunk-meta", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    pdf_path = Path(__file__).resolve().parent / "test_data.pdf"
    fitz = get_pymupdf_module()
    dependency_report = get_dependency_report()

    if fitz is None:
        print(
            json.dumps(
                {
                    "error": True,
                    "message": "PyMuPDF is unavailable.",
                    "dependency_report": dependency_report,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1

    with fitz.open(pdf_path) as doc:
        page_count = doc.page_count
        page_texts = [page.get_text("text") for page in doc]
        extracted_text = "\n\n".join(page_texts)
        result = evaluate_record(
            {
                "text": extracted_text,
                "meta": {
                    "source_type": "pdf_text",
                    "extract_mode": "direct",
                    "page_count": page_count,
                    "source_path": str(pdf_path),
                },
            },
            output_profile=args.output_profile,
            include_input_meta=args.include_input_meta,
            include_dependency_report=args.include_dependency_report,
            include_normalized_text_length=args.include_normalized_text_length,
            include_score_detail=args.include_score_detail,
            include_chunk_metrics=args.include_chunk_metrics,
            include_chunk_meta=args.include_chunk_meta,
        )

    payload = {
        "pdf_path": str(pdf_path),
        "extraction_summary": {
            "page_count": page_count if "page_count" in locals() else None,
            "visible_chars": len("".join(ch for ch in extracted_text if not ch.isspace())),
            "text_preview": extracted_text[:1000],
        },
        "evaluation": result,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
