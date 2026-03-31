# VibeDataBot 🤖 (LLM Data Studio)

> **Immersive Agentic Data Development Environment for Large Language Models**  
> *Powered by Ray, Built with Next.js, Tailwind & Python Extractors*

VibeDataBot 现已正式演进为一个针对大语言模型 (LLM) 预训练语料处理的极客级“沉浸式数据工厂”。它结合了现代 Dark Mode IDE 的极佳美学，以及在后端调度复杂 Python 抽取模型的白盒化 Agent，能够自动执行从文档分析、规则清洗、去重过滤到最终数据切片的整套分布式工作流。

![VibeDataBot Logo](ray-data-agent-proto/public/vibedatabot-logo.png)

## ✨ Core Highlights & Recent Upgrades

### 1. 5级预训练语料生产流水线 (End-to-end Corpus Pipeline)
系统内置了专门为大模型准备的全链路语料处理算子引擎：
- 📄 **EXTRACT_PDF**: 调度底层的 PDF 解析器进行初级抓取。
- 🧹 **CLEAN_TEXT**: 正则去噪，**跨行单词连词处自动缝合 (Hyphenation Fix)**，消灭残余空白。
- ✂️ **DEDUPLICATE**: 基于 Hash 或 Set 验证机制，过滤冗余的“套话”与重复模版。
- 🛡️ **QUALITY_CHECK**: 启发式扫描引擎，侦测文本短版、过滤含有不可读乱码（低质量分数）的文本垃圾。
- 📦 **GENERATE_CORPUS**: 配合语义切分或 Context Window（1024 Token 限制），将长文输出并序列化为包含 `chunk_id` 的标准 JSONL/DataFrame 训练格制。


### 2. 旗舰级版面分析：PDF-Extract-Kit 融合 (VDU Analysis)
面对拥有复杂排版的科研论文（公式、数学推导、双栏排版、复杂图表），Agent 支持智能挂载高级视觉文档理解模型：
- **Layout 分析器**: 极致精准地识别并丢弃无训练价值的页眉（Header）、页脚（Footer）与脚注。
- **公式重建引擎 (Formula Master)**: 将光学扫描出的微积分公式无损还原为原生的 `$$ LaTeX $$` 公式。
- **表格重建引擎 (Table Master)**: 把嵌入在图片或者混乱文本中的光栅化表格抽丝剥茧还原成结构化 HTML Table。


### 3. 可视化双联对比实验室 (Side-by-side Visual QA)
这不仅是一个执行框，更是一个数据质检审核站。
- **动态文件代理池**: 攻克浏览器本地安全跨域沙箱，构建特殊的 Node.js 虚拟代理隧道（`/api/file`），实现**原生全兼容地零插件内嵌**您的本地高清 PDF 原始文件。
- **左图右码检验**: 一张卡片完美按 `1:1` 剖开！左侧是完全放大的原图（如论文中的复杂积分图表），右侧是经过 PDF-Extract-Kit 极致提纯的高亮 LaTeX / Markdown 代码。做到“所见即所得”的数据校对体验。


### 4. Agentic Workflow
- **自然语言接口**: 您的命令就是 DAG 图的起笔指令（例如：“帮我把左侧那份数学报告做去重和清洗，并开启模型提取公式打包装箱”）。
- **完全白盒化探针**: 鼠标点按每一个算子（Node），实时窥探 Agent 撰写的 Python 脚本内容，以及集群中 `ds.map_batches` 的运行时日志与吞吐量评估。

## 🏗️ Technical Architecture

### 混合架构 (Hybrid Next.js + Python Pipeline)
![VibeDataBot Architecture](ray-data-agent-proto/public/vibedatabot-architecture.png)

项目采用 Node.js 前端应用分发与 Python 数据科学环境双核驱动的模型：

```
/features
  ├── /agent            # Agent 人机交互中枢, 意图生成, 意图流水线引擎 (Execution Engine)
  ├── /pdf_extractor    # Python 后端计算流 (PyMuPDF, 模拟 Ray Data 集成)
  ├── /navigation       # 资源导航系统, 接入本地文件系统探测 (FS Proxy)
  ├── /pipeline         # SVG 白板拓扑绘制系统 (Pipeline Visualizer)
  └── /data-view        # 并列双排校验器 (MarkdownViewer), 动态数据框 (DataFrame)
```

**核心技术栈:**
-   **交互应用**: Next.js 14+ (App Router), React Server Components
-   **UI & 视觉**: TailwindCSS, Framer Motion, Radix UI 
-   **算法底盘 (Backend)**: Python (`cli.py`), PyMuPDF, Ray Mock Bindings

## 🚀 Getting Started

### Prerequisites
-   Node.js 18+
-   Python 3.10+ (需用于承载文档提取)

### Local Environment Setup

1.  克隆应用并进入原型目录：
    ```bash
    git clone git@github.com:li-clement/LLM-Data-Studio.git
    cd LLM-Data-Studio/ray-data-agent-proto
    ```

2.  环境构建与模块拉取：
    ```bash
    npm install
    # (Optional) 安装 Python 环境支持库
    # pip install pymupdf
    ```

3.  唤醒开发者热更服务器：
    ```bash
    npm run dev
    ```

4.  通过浏览器开启沉浸式空间：[http://localhost:3000](http://localhost:3000)

## 🤝 Roadmap & Contribution

目前本项目作为一个面向未来的验证性（Validation Prototype）平台，大部分的版面分析（Layout YOLO）与并发分块调度在 `ExecutionEngine` 层面使用具有时序逻辑的 Mock 进行概念验证支撑。

未来非常欢迎社区提交真实打通并驱动大规模真实 Ray Data 集群的 Python Bindings！

## 📄 License
Apache License 2.0
