import os
from fpdf import FPDF
from features.pdf_extractor.logic.pipeline import build_pdf_pipeline

def create_sample_pdf(file_path: str):
    """
    制造一个极其简陋的双栏 PDF，或者两页测试文本，
    供本地 MVP 流水线调错验证。
    """
    pdf = FPDF()
    pdf.add_page()
    
    # 模拟左上侧栏
    pdf.set_font("Arial", 'B', 16)
    pdf.set_xy(10, 20)
    pdf.cell(50, 10, txt="Left Title Column")
    
    pdf.set_font("Arial", size=12)
    pdf.set_xy(10, 35)
    pdf.multi_cell(50, 6, txt="This is some text\non the left column.\nIt simulates a basic\nlayout.")
    
    # 模拟右上主体文本
    pdf.set_font("Arial", 'B', 16)
    pdf.set_xy(100, 20)
    pdf.cell(80, 10, txt="Right Main Content")
    
    pdf.set_font("Arial", size=12)
    pdf.set_xy(100, 35)
    pdf.multi_cell(80, 6, txt="This text is on the right side of the page.\nIf reading order fails, it might interleave with left column lines.\nHowever, our XY-Cut or tolerance sort should keep paragraphs intact.")
    
    pdf.output(file_path)
    print(f"[Init] 生成了临时测试 PDF: {file_path}")

if __name__ == "__main__":
    TEST_FILE = "sample_test.pdf"
    
    try:
        # 1. 自动造假数据
        create_sample_pdf(TEST_FILE)
        
        # 2. 跑通我们搭建的管道入口
        print("======== 开始执行 PDF Pipeline ========")
        result = build_pdf_pipeline(TEST_FILE)
        
        print("\n======== 最终输出体 (Dict Keys) ========")
        print([k for k in result.keys()])
        print(f"Processing Time: {result['_processing_time_ms']} ms")
        
        print("\n======== 真实 Markdown 渲染结果 ========\n")
        print(result["markdown_content"])
        
    finally:
        if os.path.exists(TEST_FILE):
            os.remove(TEST_FILE)
            print(f"\n[Cleanup] 已清理临时文件: {TEST_FILE}")
