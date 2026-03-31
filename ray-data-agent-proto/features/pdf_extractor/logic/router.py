from typing import Any, Dict
import fitz  # PyMuPDF
import sys

class RoutingStrategy:
    FAST_TRACK = "fast_track"  # 纯文本通道 (依赖 fitz)
    DEEP_TRACK = "deep_track"  # 深度模型通道 (OCR/视觉大模型)

def analyze_pdf_and_route(doc: fitz.Document) -> str:
    """
    预检 PDF 文档，判断它是文本型文档还是全图扫描件。
    MVP 阶段：如果在第一页中找到了任何真实文字（非空白图），就走快速通道。
    生产环境：需要扫描多页抽样计算 文本/图像 的比例。
    """
    try:
        if doc.page_count == 0:
            return RoutingStrategy.FAST_TRACK
            
        first_page = doc[0]
        text = first_page.get_text("text").strip()
        
        if len(text) > 10:
            return RoutingStrategy.FAST_TRACK
        
        # 否则假设这是一个完全被图片覆盖的扫描件
        return RoutingStrategy.DEEP_TRACK
    except Exception as e:
        print(f"路由判定阶段发生异常: {e}，默认降级为 Deep Track", file=sys.stderr)
        return RoutingStrategy.DEEP_TRACK
