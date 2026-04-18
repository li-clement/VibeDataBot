"""CLI entrypoint for the atomic quality evaluator."""

from __future__ import annotations

import argparse
import json
import sys

from .dependencies import get_dependency_report
from .evaluate import evaluate_record, evaluate_records, load_records_from_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Atomic data quality evaluator")
    parser.add_argument("--input-path", type=str, help="Path to .txt/.md/.tex/.json/.jsonl input")
    parser.add_argument("--text", type=str, help="Direct text payload to evaluate")
    parser.add_argument("--source-type", type=str, default="html", choices=["html", "pdf_text", "pdf_ocr"])
    parser.add_argument("--extract-mode", type=str, default="direct", choices=["direct", "ocr"])
    parser.add_argument("--ocr-confidence", type=float, default=None)
    parser.add_argument("--text-field", type=str, default="text", help="JSON/JSONL text field name")
    parser.add_argument(
        "--output-profile",
        type=str,
        default="compact",
        choices=["compact", "standard", "full"],
        help="Output verbosity profile. Default keeps chunk-level details silent.",
    )
    parser.add_argument("--include-input-meta", action="store_true", help="Include input metadata in the output.")
    parser.add_argument(
        "--include-dependency-report",
        action="store_true",
        help="Include the full runtime dependency report in the output.",
    )
    parser.add_argument(
        "--include-normalized-text-length",
        action="store_true",
        help="Include normalized visible character count in the output.",
    )
    parser.add_argument(
        "--include-score-detail",
        action="store_true",
        help="Include score details and rule-hit explanations in the output.",
    )
    parser.add_argument(
        "--include-chunk-metrics",
        action="store_true",
        help="Include chunk-level metric outputs in the output.",
    )
    parser.add_argument(
        "--include-chunk-meta",
        action="store_true",
        help="Include chunk-level metadata in the output.",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    parser.add_argument(
        "--strict-deps",
        action="store_true",
        help="Fail fast when runtime dependency warnings are present.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.input_path and args.text is None:
        parser.error("One of --input-path or --text is required.")

    try:
        dependency_report = get_dependency_report()
        if dependency_report["has_warnings"]:
            for warning in dependency_report["warnings"]:
                print(
                    f"[dependency-warning] {warning['message']} Install with: {warning['install_hint']}",
                    file=sys.stderr,
                )
            if args.strict_deps:
                raise RuntimeError("Runtime dependencies are incomplete; aborting due to --strict-deps.")

        if args.text is not None:
            result = evaluate_record(
                {
                    "text": args.text,
                    "meta": {
                        "source_type": args.source_type,
                        "extract_mode": args.extract_mode,
                        "ocr_confidence": args.ocr_confidence,
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
        else:
            records = load_records_from_path(args.input_path, args.text_field)
            for record in records:
                record.setdefault("meta", {})
                record["meta"].setdefault("source_type", args.source_type)
                record["meta"].setdefault("extract_mode", args.extract_mode)
                if args.ocr_confidence is not None:
                    record["meta"].setdefault("ocr_confidence", args.ocr_confidence)
            result = evaluate_records(
                records,
                output_profile=args.output_profile,
                include_input_meta=args.include_input_meta,
                include_dependency_report=args.include_dependency_report,
                include_normalized_text_length=args.include_normalized_text_length,
                include_score_detail=args.include_score_detail,
                include_chunk_metrics=args.include_chunk_metrics,
                include_chunk_meta=args.include_chunk_meta,
            )

        indent = 2 if args.pretty else None
        print(json.dumps(result, ensure_ascii=False, indent=indent))
        return 0
    except Exception as exc:
        error_payload = {"error": True, "message": str(exc)}
        print(json.dumps(error_payload, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
