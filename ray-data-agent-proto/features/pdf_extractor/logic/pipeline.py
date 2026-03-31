import time
import os
import sys
import fitz
from typing import Dict, Any

from .router import analyze_pdf_and_route, RoutingStrategy
from .layout_analyzer import extract_blocks_from_page
from .order_assembler import assemble_blocks_to_markdown
from .ocr_engine import run_deep_ocr_pipeline

def build_pdf_pipeline(file_path: str) -> Dict[str, Any]:
    """
    对外界暴露的核心提取主入点。
    返回的 Dict 符合 `PDFExtractionResult` （供前端直接使用或 Ray Node 后处理）。
    """
    start_time = time.time()
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF 文件未找到: {file_path}")

    # 1. 加载文档验证
    doc = fitz.open(file_path)
    page_count = doc.page_count
    
    # 2. 路由 (Fast vs Deep)
    route = analyze_pdf_and_route(doc)
    
    all_blocks = []
    
    if route == RoutingStrategy.FAST_TRACK:
        print(f"[{file_path}] [Info] Routed to Fast Track.", file=sys.stderr)
        # 3. 逐页提取 (Fast-Track)
        for i in range(page_count):
            page = doc[i]
            blocks = extract_blocks_from_page(page, i)
            all_blocks.extend(blocks)
            
    elif route == RoutingStrategy.DEEP_TRACK:
        # 深度提取目前使用 Mock/Placeholder 逻辑
        all_blocks = run_deep_ocr_pipeline(file_path)

    doc.close()

    # 4. 组装 Markdown 与净化阅读顺序
    markdown_result = assemble_blocks_to_markdown(all_blocks)
    
    end_time = time.time()
    
    # 5. 返回约定的大字典对象
    return {
        "doc_id": os.path.basename(file_path),
        "source_url": f"local://{file_path}",
        "markdown_content": markdown_result,
        "metadata": {
            "page_count": page_count,
            "fast_track_enabled": route == RoutingStrategy.FAST_TRACK,
        },
        "extracted_images": [],  # S3 路径指针 (尚未对接环境)
        "_is_scanned_pdf": route == RoutingStrategy.DEEP_TRACK,
        "_processing_time_ms": round((end_time - start_time) * 1000, 2)
    }
