export interface PdfExtractionMetadata {
    page_count: number;
    fast_track_enabled: boolean;
    [key: string]: any; // Allow future dynamic metadata like confidence scores
}

export interface PdfExtractionResult {
    doc_id: string;               // e.g. "report-2024.pdf"
    source_url: string;           // Where the PDF was loaded from (S3, local)
    markdown_content: string;     // The fully assembled reading-order markdown string
    metadata: PdfExtractionMetadata;
    extracted_images: string[];   // Array of S3/CDN URLs for the cropped image blocks
    _is_scanned_pdf: boolean;     // Indicates if DEEP_TRACK (OCR) was forced
    _processing_time_ms: number;  // The time taken by the Ray backend
}
