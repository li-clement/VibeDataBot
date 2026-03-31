from typing import List, Dict, Any
import sys

class BaseOCREngine:
    def process_image(self, image_bytes: bytes) -> str:
        raise NotImplementedError()

class MockOCREngine(BaseOCREngine):
    """
    当前为 MVP 占位符。当路由检测到纯图片 PDF，或排版探测到 Image Block 时，
    将会向基于 GPU 的 `Ray Actor (paddleocr/tesseract)` 请求处理。
    """
    def process_image(self, image_bytes: bytes) -> str:
        return "[MOCK OCR RECOGNIZED TEXT]"

def run_deep_ocr_pipeline(file_path: str) -> List[Dict[str, Any]]:
    """
    深层提取通道模拟。
    未来在分布式架构中，此逻辑将向 Ray Submit，将整页图片传递给视觉大模型节点进行图文信息剥离。
    """
    print(f"[{file_path}] [Warning] Document routed to Deep Track OCR Pipeline.", file=sys.stderr)
    return [
        {
            "type": "text",
            "content": "[SCANNED DOCUMENT OCR CONTENT MOCK]",
            "bbox": (0, 0, 100, 100),
            "page": 0,
            "block_no": 0
        }
    ]
