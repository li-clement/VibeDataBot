# 模块设计文档：PDF 文本提取与预训练语料生产模块 (PDF Extraction & Pre-training Corpus Pipeline)

## 1. 模块摘要 (Module Summary)

本模块是 **DataAgent** 数据开发平台的核心数据处理算子（Operator）流，旨在提供针对非结构化 PDF 文件的端到端高精准度文本提取、内容清洗、去重与语料组装功能。
为了满足大语言模型（LLM）和多模态视觉模型（VLM）海量高质量训练数据的需求，该模块不仅提取基础文本，解析复杂的文档物理布局并按**阅读顺序 (Reading Order)** 组装，更进一步引入了多级去重、启发式与模型级质检以及合规的语料序列化机制。最终输出可直接用于大模型预训练或微调的高质量数据集（如 JSONL 或 Parquet 格式），并无缝融入现有的 **Ray 分布式架构**，以支撑对 TB 级别 PDF 文档子集的高吞吐量并行处理。

## 2. 核心痛点与目标 (Pain Points & Goals)

### 2.1 核心痛点
* **异构的文档格式**：PDF 存在原生文本 PDF 和纯扫描件（基于图像）的 PDF，单一工具无法同时兼顾高效率和高准确度。
* **物理版面解析困难**：论文、财报通常包含多栏排版、页眉、脚注、浮动图表等，直接提取极易导致“跨栏拼接错误”和语义截断。
* **数据冗余与质量参差不齐**：海量文档库中存在大量重复段落（如免责声明、模板化套话）以及 OCR 错误带来的乱码，直接训练会导致大模型产生幻觉或过拟合。
* **高昂的模型推理成本**：视觉文档理解（VDU）模型和 OCR 模型重度依赖 GPU，容易由于数据 IO 瓶颈成为分布式计算中的“长尾”节点。

### 2.2 核心目标
* **智能解析与结构保持**：支持文档物理块（Block）的框选检测，将复杂结构（如表格）拉平至 Markdown 格式，保存原生层级。
* **高信噪比语料提纯**：建立“提取-清洗-去重-质检”的完整防线，剔除低信息密度和毒性内容。
* **并发吞吐最大化**：利用 Ray 的 Actor Pool 横向扩展算力，并融合 `ProcessPoolExecutor` 提供灵活的多进程适配能力。

## 3. 架构设计：路由与组装流水线 (Routing & Assembly Pipeline)

系统逻辑工作流可划分为四大阶段：文档分发路由、核心版面识别、OCR/文本抽取，以及最终序列组装。

### 3.1 预处理与分发路由 (Routing)
* 模块接收到 PDF 文件流后，首先对单页进行探索。检测文档每一页的属性特征（如是否含有文字内嵌对象，是否是全图扫描件）。
* **快速通道 (Fast-Track)**: 如果文档是原生结构（如电子合同、Word导出），则下发至轻量级解析器（如 `PyMuPDF` / `pdfplumber`）。
* **深度识别通道 (Deep-Track)**: 对于扫描版或纯图格式，触发 GPU 节点队列，引导至 OCR 视觉大模型链路。

### 3.2 版面分析 (Layout Analysis)
* 引入视觉预训练模型（如 `LayoutLMv3`、`YOLO-Doc` 或基于 HuggingFace 的轻量化版面检测库）对页面上的元素进行包裹（BBox 检测）。
* 类别标签包括：标题 (Title)、段落 (Text)、列表 (List)、表格 (Table)、图片 (Figure)、页眉/页脚 (Header/Footer)。

### 3.3 核心信息提取 (Content Extraction)
针对上一步划分出的不同区域（Block），执行相应的特异性提取算子：
* **Text / Title**: 抽取原始文本内容，清洗掉连字符或非预期断行。
* **Table**: 引入专门的表格识别模型（如 `TableTransformer` 或 `PaddleOCR-Table`），将表格结构精确渲染为 HTML 格式或 Markdown 格式（`|---|---|`）。
* **Figure**: 裁切图像并转存至外部对象存储（如 S3 或本地缓存），提取为 `![Image_ID](URL)` 的多模态占位符。

### 3.4 阅读顺序列化与组装 (Reading Order Sorting & Assembly)
* 获取各种 Blocks 的坐标之后，模块利用启发式几何排序规则和 NLP 线索（如 X-Y Cut 算法），按真实阅读顺序从上到下、由左及右串联所有节点区块，组合合并为连贯的长文本 JSON 或 Markdown 格式。
* 在组装中完成废弃物剔除：自动去除标记为 Header、Footer 或 Watermark（水印）的无关视觉干扰。

---

## 4. 语料提纯阶段：清洗、去重与质检 (Corpus Refinement Pipeline)

在获取到结构化的 Markdown 文本后，系统进入语料级处理流，以确保文本满足 LLM 预训练的标准。

### 4.1 深度数据清洗 (Data Cleaning)
* **不可见字符与乱码过滤**：利用正则引擎剔除无效的 Unicode 控制字符、零宽空格以及 OCR 识别错误产生的乱码块。
* **连字符与换行修复 (Hyphenation & Line-break Fix)**：基于 N-gram 语言模型和字典，智能修复跨行断词（如将 "infor-\nmation" 合并为 "information"），并压缩冗余的连续空行。
* **隐私与敏感信息打码 (PII Anonymization)**：集成 NLP 实体识别模型，自动识别并掩码电话号码、邮箱、身份证号及其他敏感个人信息（PII）。

### 4.2 多粒度数据去重 (Data Deduplication)
针对互联网和企业内部文档的高度冗余特性，执行两级去重策略：
* **文档级去重 (Document-Level Exact/Fuzzy Match)**：
  * 计算整个文档的 SHA-256 Hash 值进行精确去重。
  * 利用 **MinHash + LSH (Locality-Sensitive Hashing)** 算法检测高相似度的变体文档，丢弃高度重合的版本。
* **段落/句子级去重 (Paragraph-Level N-gram Overlap)**：
  * 构建全局的 Bloom Filter 或 Redis 缓存集合，对文档中的独立段落进行去重。
  * 尤为针对论文/财报中反复出现的套话（如标准版权声明、免责条款）进行过滤。

### 4.3 多维数据质检 (Quality Inspection & Filtering)
* **启发式规则评估 (Heuristics)**：
  * 文本字符占比：过滤掉文本长度极短、标点符号占比过高或全为特殊符号的“脏页面”提取物。
  * 语言识别 (LangID)：利用 `fastText` 模型进行语种分类，筛选出目标语种语料，剔除混合语种乱码。
* **模型级质量打分 (Model-based Quality Scoring)**：
  * **困惑度检查 (Perplexity Filter)**：引入轻量级语言模型（如 `KenLM`）计算文本段落的困惑度评分。评分异常高（意味着语言不连贯、不符合人类自然语言规律）的段落将被标记为低质量并剔除。

---

## 5. 预训练语料生产与序列化 (Pre-training Corpus Production)

经过上述所有流水线的纯净数据，将进入最终的语料封装层。

* **块分割与上下文拼接 (Chunking)**：按照大模型常见的 Context Window（如 2048, 4096 Tokens），将长篇 PDF 按物理段落（不截断核心语义）切分为适合预训练的连续 Text Chunks。
* **元数据增强 (Metadata Enrichment)**：保留原始数据血缘，在语料中注入 `source_url`, `domain`, `language`, `timestamp`, `token_count` 等高质量元信息。
* **标准格式导出**：
  * 将结果序列化为 LLM 训练标准格式（如 **JSONL** 或 **Parquet** 压缩列式存储）。
  * 自动同步并推送到分布式对象存储（S3/HDFS），或者生成兼容 HuggingFace `datasets` 库的格式字典。

---

## 6. Ray 分布式集成方案 (Ray Orchestration)

基于 Ray Data 打造流式高吞吐，模块需要对外暴露一个兼容的数据流式算子界面（Mapper Operator）。

### 6.1 核心数据结构接口定义

```python
# 模块的统一输入输出协议
from typing import TypedDict, List, Optional

class LLMPretrainCorpusResult(TypedDict):
    doc_id: str
    source_url: str
    markdown_content: str               # 完全按照阅读顺序排列且经过清洗的 Markdown
    metadata: dict                      # 页数、作者、语种、字数等信息
    extracted_images: List[str]         # 图像块的 S3 存放路径指针
    quality_score: float                # 文本连贯性质量评分 (e.g., 基于 Perplexity)
    _is_scanned_pdf: bool               # 是否完全触发了 OCR 通道
    _processing_time_ms: float
    _dropped_duplicate_paragraphs: int  # 记录去重剔除的段落数
```

### 6.2 Actor Pool 分发策略
利用 Ray 构建动态多实例调度：
1. **CPU 解析与清洗池**: 给定 30 个轻量级 Actor，接收原生文本处理、正则表达式清洗、MinHash 去重等 CPU 密集型/内存密集型操作。
2. **GPU 推理池**: 配置有限规模带有 `@ray.remote(num_gpus=1)` 注解的深度 OCR、版面分析与轻量级质检（KenLM）Actor 实例。
3. **流水线调度 (Pipelining)**: CPU 节点将需要执行重度计算的张量（Tensors）或数据块通过 Ray 零拷贝对象存储（Plasma）分发，实现前后端环节解耦。

---

## 7. 项目结构与代码骨架规划 (Code Structure)

在工程实施中，建议按如下结构拆分功能模块：
```bash
ray-data-agent-proto/features/pdf_extractor/
├── logic/
│   ├── router.py            # PDF 类型判定与分发策略
│   ├── layout_analyzer.py   # 版面检测算法 (BBox 计算)
│   ├── ocr_engine.py        # 文本 / 表格深度抓取
│   └── order_assembler.py   # Reading Order 排序及 Markdown 拼接
├── refinement/              # [新增] 语料提纯流
│   ├── cleaner.py           # 乱码与连字符清洗、PII打码
│   ├── deduplicator.py      # MinHash 文档去重与段落去重
│   └── quality_checker.py   # LangID 与 KenLM 困惑度打分质检
├── export/                  # [新增] 预训练语料生产
│   └── corpus_builder.py    # Chunking 切分与 JSONL/Parquet 序列化封装
└── types/
    └── PdfStructures.ts     # （用于 TUI 预览和对照映射的类型声明）
```

---

## 8. 实施现状与完成度总结 (Current Status & Implementation Summary)

截至目前，本模块的原型已被**完全实现并高度集成**于 Next.js + Local Node.js 体系内，形成了端到端的“全栈数据处理 Agent”的完整体验：

### 8.1 底层 Python 抽取与提纯引擎 (Backend Python Engine)
* **核心剥离与编排**：已完成利用 `PyMuPDF` 提供基础支撑的 Fast-Track 提取，内建了基于 Y 轴坐标阈值的阅读顺序启发式算法（XY-Cut-like Sort），避免了多栏文献提取乱序。
* **提纯流水线初版**：清洗模块已包含基础的换行符合并与中英文字符串规整，去重模块已引入基于局部敏感哈希（LSH）的段落级排重策略。
* **CLI/stdout 封装网关**：实现通过 `cli.py` 向外提供无缝接口，并在 stdout 安全隔离日志流与 JSON 返回实体对象。

### 8.2 全局 Agent 协调器升级 (Agent Orchestration & Pipeline)
* **语义指令解析拓扑**：强化调度中心 `PlanGenerator` 对 `EXTRACT_PDF`, `CLEAN_TEXT`, `DEDUPLICATE`, `GENERATE_CORPUS` 等动作指令识别。
* **物理节点级联模拟**：重构 `ExecutionEngine` 支持依赖状态下发，当触发指令：“提取 PDF 并清洗去重” 时，系统会自动通过内存 ArtifactPayload 将抽取后的源文向清洗（空行压缩、多余空格去除）、去重（Set 集合段落排重）层层渗透，并输出记录下剔除字符数的增强型 Metadata。

### 8.3 前端沉浸式 Web 交付 (Immersive Web TUI/GUI)
* **Local Workspace (本地机器扫描仪)**：在 `Sidebar` 内嵌入了能够打通真实文件系统的本地文件浏览器 `FileTree.tsx`。用户在树中勾选 `.pdf` 时即可自动组装并发出请求指令。
* **Pipeline Inspect (白盒图表视窗)**：实现无论节点是否已开始执行数据计算，只要在顶层横向连通图点击任何 Node，即在屏幕主画板为您抛出该业务背后生成的大模型 `Python 预备代码快照`，达成极端透明。
* **Data Diff / Markdown Viewer**：专设非结构化 PDF 对齐显示框，左边附着处理信息（耗时、图片指针和去杂项比率），右侧以 Markdown 完整滚动透出保留了物理段落层级的还原文本，并以高亮标记被清洗或剔除的冗余内容。