from typing import List, Dict, Any

def assemble_blocks_to_markdown(blocks: List[Dict[str, Any]], y_tolerance: float = 8.0) -> str:
    """
    接收来自不同页面的 Blocks，运用启发式空间坐标容差算法重新排序。
    目的：规避 PDF 左半栏阅读完，应该接右半栏，或者是同一行跨栏带来的拼接错乱。
    这种 `(y0 // tolerance, x0)` 算是极简版本的 XY-Cut。
    """
    
    # 构建基于容差的长文本行排序
    def sort_key(block):
        x0, y0, x1, y1 = block["bbox"]
        page_num = block["page"]
        
        # 将 y 坐标量化：只要 y0 在容差（如 8 像素）内波动，我们就认为是属于“同一行/段落起始”
        quantized_y = round(y0 / y_tolerance)
        
        # 排序权重: 页码第一，量化 Y 轴第二，X 轴第三
        return (page_num, quantized_y, x0)

    # 就地排序
    sorted_blocks = sorted(blocks, key=sort_key)
    
    # 合并处理 (Markdown Assembly)
    md_lines = []
    for block in sorted_blocks:
        if block["type"] == "text":
            text = block["content"].strip()
            # 简单清洗如连接符断行
            text = text.replace("-\n", "").replace("\n", " ")
            md_lines.append(text + "\n\n")
        elif block["type"] == "image":
            # 向下文丢弃图表描述图片链接的占位
            md_lines.append(f"\n> 🖼️ `[Image {block['block_no']} Placeholder]`\n\n")
            
    return "".join(md_lines).strip()
