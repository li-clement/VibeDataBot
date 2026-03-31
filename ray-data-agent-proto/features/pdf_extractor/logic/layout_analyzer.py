import fitz
from typing import List, Dict, Any

def extract_blocks_from_page(page: fitz.Page, page_index: int) -> List[Dict[str, Any]]:
    """
    通过 PyMuPDF 获取页面的所有渲染区块(Blocks)。
    每个 Block 的典型格式包含：(x0, y0, x1, y1, text, block_no, block_type)
    - block_type: 0 表示文本，1 表示图像。
    """
    raw_blocks = page.get_text("blocks")
    processed_blocks = []
    
    for b in raw_blocks:
        x0, y0, x1, y1, text_or_img, block_no, block_type = b
        
        # 为了更好地保留文档结构，我们将非空区块保存并标记几何坐标
        # 后续将用于版面的拉平组装
        if block_type == 0:  # Text block
            text = text_or_img.strip()
            if not text:
                continue
            
            processed_blocks.append({
                "type": "text",
                "content": text,
                "bbox": (x0, y0, x1, y1),
                "page": page_index,
                "block_no": block_no
            })
        elif block_type == 1:  # Image block
            processed_blocks.append({
                "type": "image",
                "content": "[IMAGE PENDING OCR OR MULTIMODAL EXTRACTION]",
                "bbox": (x0, y0, x1, y1),
                "page": page_index,
                "block_no": block_no
            })
            
    return processed_blocks
