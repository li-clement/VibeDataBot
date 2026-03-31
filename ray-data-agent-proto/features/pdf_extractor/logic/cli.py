import sys
import json
import argparse
from features.pdf_extractor.logic.pipeline import build_pdf_pipeline

def main():
    parser = argparse.ArgumentParser(description="PDF Extraction CLI for Next.js API")
    parser.add_argument("--file_path", type=str, required=True, help="Absolute or relative path to the PDF file")
    
    args = parser.parse_args()
    
    try:
        # Calls the existing python pipeline
        result = build_pdf_pipeline(args.file_path)
        # Serialize the Dict to a JSON string and print it to stdout so Node.js can read it
        print(json.dumps(result))
    except Exception as e:
        # Return error as JSON object pointing out failure
        error_result = {
            "error": True,
            "message": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
