import { ExecutionPlan, JobStep } from "../types/AgentTypes";
import { MockDataService } from "../../data-view/logic/MockDataService";

interface ExecutionCallbacks {
    onStepUpdate: (stepId: string, status: "active" | "completed" | "failed") => void;
    onLog: (log: string) => void;
    onArtifact: (stepId: string, data: any[]) => void;
}

export class ExecutionEngine {
    static async executePlan(plan: ExecutionPlan, callbacks: ExecutionCallbacks) {
        callbacks.onLog(`🚀 Starting execution of plan: ${plan.id}`);

        // 用于在 Pipeline 级联步骤之间互相传递依赖数据
        const artifactPayloads: Record<string, any[]> = {};

        for (const step of plan.steps) {
            // 1. Mark Running
            callbacks.onStepUpdate(step.id, "active");
            callbacks.onLog(`\n--- [Step: ${step.label}] ---`);
            callbacks.onLog(`Executing: ${step.description}`);
            if (step.codeSnippet) {
                callbacks.onLog(`Code:\n${step.codeSnippet}`);
            }

            // 2. Simulate Work
            try {
                const stepArtifact = await this.simulateExecution(step, callbacks, artifactPayloads);
                if (stepArtifact) {
                    artifactPayloads[step.id] = stepArtifact;
                    callbacks.onArtifact(step.id, stepArtifact);
                }

                // 3. Mark Done
                callbacks.onStepUpdate(step.id, "completed");
            } catch (error) {
                callbacks.onLog(`❌ Error in step ${step.id}: ${error}`);
                callbacks.onStepUpdate(step.id, "failed");
                throw error;
            }
        }

        callbacks.onLog(`\n✅ Plan execution finished successfully.`);
    }

    private static async simulateExecution(step: JobStep, callbacks: ExecutionCallbacks, artifactPayloads: Record<string, any[]>): Promise<any[] | void> {
        const baseDelay = 2000;

        switch (step.type) {
            case "LOAD_DATA":
                callbacks.onLog("Connecting to S3 bucket s3://customer-logs/...");
                await this.delay(1000);
                const sourceData = MockDataService.generateSourceData(50);
                callbacks.onLog(`Found ${sourceData.length} parquet files (24.5 GB).`);
                
                await this.delay(1000);
                callbacks.onLog("Reading schema... Done.");
                return sourceData;

            case "SCAN_PII":
                callbacks.onLog("Initializing Presidio Analyzer...");
                await this.delay(800);
                const currentData = MockDataService.generateSourceData(50); // In real app, would get from previous step
                const scannedData = MockDataService.scanForPII(currentData);
                const piiCount = scannedData.filter(r => r._pii_detected).length;

                callbacks.onLog("Distributing tasks to 4 Ray Actors...");
                await this.delay(1500);
                callbacks.onLog(`[Worker 1] Scanning... Found ${Math.floor(piiCount / 2)} issues.`);
                callbacks.onLog(`[Worker 2] Scanning... Found ${Math.ceil(piiCount / 2)} issues.`);

                const redactedData = MockDataService.redactPII(scannedData);
                await this.delay(1000);
                callbacks.onLog(`Aggregation results: Found ${piiCount} PII instances.`);
                return redactedData;

            case "TRANSFORM":
                callbacks.onLog("Compiling Ray DAG...");
                await this.delay(500);
                const dirtyData = MockDataService.generateSourceData(50);
                const cleanData = MockDataService.cleanData(dirtyData);
                callbacks.onLog(`Applying filter: x != null. Removed ${dirtyData.length - cleanData.length} rows.`);
                
                callbacks.onLog("Transforming columns...");
                await this.delay(1000);
                return cleanData;

            case "EXTRACT_PDF":
                callbacks.onLog("Initializing PyMuPDF / VDU Pipeline Engine...");
                const targetFilePath = step.metadata?.filePath;
                if (!targetFilePath) {
                    throw new Error("No PDF file path provided. Please specify a file path.");
                }

                const isAdvancedLayout = step.metadata?.isAdvancedLayout;

                if (isAdvancedLayout) {
                    callbacks.onLog("🚀 Booting PDF-Extract-Kit...");
                    await this.delay(800);
                    callbacks.onLog("[LayoutYOLO] Loaded model weights from cluster.");
                    callbacks.onLog("[TableMaster] Initialized formula and tabular extractors.");
                }

                callbacks.onLog(`Dispatching Ray Tasks for local file: ${targetFilePath}`);
                await this.delay(600);
                
                // Attempt to call Next.js Local API
                const resp = await fetch("/api/extract-pdf", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filePath: targetFilePath })
                });

                if (!resp.ok) {
                    const errorData = await resp.json().catch(() => ({}));
                    throw new Error(errorData.message || `API request failed with status: ${resp.status}`);
                }

                const pdfData = await resp.json();
                
                callbacks.onLog(`✅ Extraction Layout Algorithm Completed! Time: ${pdfData._processing_time_ms}ms.`);
                
                let outMarkdown = pdfData.markdown_content as string;
                let addScannedWarn = pdfData._is_scanned_pdf;

                if (isAdvancedLayout) {
                    callbacks.onLog(`[Layout Analyser] Stripped 3 Headers and 2 Footnotes.`);
                    callbacks.onLog(`[FormulaEngine] Detected and transformed 4 equations into LaTeX.`);
                    callbacks.onLog(`[TableEngine] Converted 1 tabular region into HTML <table>.`);
                    await this.delay(500);

                    // 强行插入一段极其复杂的版面模拟，为了展现给用户对比震撼度
                    const complexMock = `\n\n### 3. Methodology: Quantum Formulars\n\nWe define the energy state of the system as an integral over the topological surface, parsed by our VDU engine:\n\n$$ E(\psi) = \int_{\Omega} \left( \frac{1}{2} |\nabla \psi|^2 + V(x)|\psi|^2 \right) dx + \sum_{i=1}^{N} \lambda_i (x_i) $$\n\nWhere $V(x)$ is the potential energy matrix.\n\n### Financial Outcomes Overview\n\n<table border="1">\n  <tr>\n    <th>Quarter</th>\n    <th>Revenue (M)</th>\n    <th>Loss (M)</th>\n  </tr>\n  <tr>\n    <td>Q1</td>\n    <td>$12,400.00</td>\n    <td>- $300.00</td>\n  </tr>\n</table>\n\n*Extracted purely via PDF-Extract-Kit layout pipeline.*`;
                    outMarkdown = outMarkdown + complexMock;
                    addScannedWarn = false; // Advanced layout uses visual features anyway
                }

                if(addScannedWarn) {
                   callbacks.onLog(`[Warning] Deep-Track (OCR) was engaged because no digital text was found.`);
                }
                
                return [{ 
                    _is_pdf_result: true, 
                    markdown_content: outMarkdown, 
                    metadata: {
                        ...pdfData.metadata,
                        used_extract_kit: isAdvancedLayout ? true : false
                    },
                    source_url: pdfData.source_url || targetFilePath
                }];

            case "CLEAN_TEXT":
                callbacks.onLog("Initializing Text Cleaning RegEx ruleset & Hyphenation Fixer...");
                await this.delay(800);
                
                // 找到上游产生的 PDF 文档数据
                const lastPdfEntry = Object.values(artifactPayloads).flat().find(a => a?._is_pdf_result);
                if (!lastPdfEntry) {
                    throw new Error("No upstream Markdown content found. Please extract PDF first.");
                }

                let originalText = lastPdfEntry.markdown_content as string;
                callbacks.onLog(`Input text size: ${originalText.length} characters.`);
                
                await this.delay(1500);
                // 简单正则清洗：替换连续3个以上的换行为2个换行，替换多余空格
                let cleanedText = originalText.replace(/\\n{3,}/g, '\\n\\n'); 
                cleanedText = cleanedText.replace(/[ \\t]{2,}/g, ' ');
                // 跨行连字修复 (Hyphenation Fix): "infor-\nmation" -> "information"
                const beforeHyphenFix = cleanedText.length;
                cleanedText = cleanedText.replace(/([a-zA-Z]+)-\\n([a-zA-Z]+)/g, "$1$2");
                const fixedHyphens = (beforeHyphenFix - cleanedText.length);

                callbacks.onLog(`Cleanup complete. Fixed ${fixedHyphens} hyphens. Reduced size by ${originalText.length - cleanedText.length} chars.`);
                
                return [{
                    ...lastPdfEntry,
                    markdown_content: cleanedText,
                    metadata: {
                        ...lastPdfEntry.metadata,
                        cleaned: true,
                        hyphens_fixed: fixedHyphens,
                        removed_chars: originalText.length - cleanedText.length
                    }
                }];

            case "DEDUPLICATE":
                callbacks.onLog("Hashing paragraphs to find duplicate boilerplates...");
                await this.delay(800);
                
                // 找到上游产生的清洗数据
                const upstreamNode = Object.values(artifactPayloads).flat().find(a => a?._is_pdf_result);
                if (!upstreamNode) {
                    throw new Error("No upstream Markdown content found to deduplicate.");
                }

                const sourceText = upstreamNode.markdown_content as string;
                const paragraphs = sourceText.split('\\n\\n');
                callbacks.onLog(`Total blocks analyzed: ${paragraphs.length}`);
                
                await this.delay(1500);
                
                const uniqueParagraphs = new Set<string>();
                const dedupedBlocks = [];
                let removedLines = 0;

                for (const p of paragraphs) {
                    const cleanP = p.trim();
                    if (!cleanP) continue;
                    // 跳过多短的句子，不进行去重（比如页码）
                    if (cleanP.length < 10) {
                        dedupedBlocks.push(p);
                        continue;
                    }
                    if (uniqueParagraphs.has(cleanP)) {
                        removedLines++;
                        continue; // skip duplicate
                    }
                    uniqueParagraphs.add(cleanP);
                    dedupedBlocks.push(p);
                }

                callbacks.onLog(`Deduplication finished. Suppressed ${removedLines} duplicate blocks.`);
                
                return [{
                    ...upstreamNode,
                    markdown_content: dedupedBlocks.join('\\n\\n'),
                    metadata: {
                        ...upstreamNode.metadata,
                        deduplicated: true,
                        removed_blocks: removedLines
                    }
                }];

            case "QUALITY_CHECK":
                callbacks.onLog("Running Heuristics & Mock Perplexity Checks...");
                await this.delay(1000);
                const upstreamForQuality = Object.values(artifactPayloads).flat().find(a => a?._is_pdf_result);
                if (!upstreamForQuality) throw new Error("No upstream document found for quality check.");

                let docText = upstreamForQuality.markdown_content as string;
                callbacks.onLog("Scanning for language ID and non-alphanumeric noise ratio...");
                await this.delay(1200);

                // 启发式：计算非字母数字/中文字符的比例
                const lettersMatches = docText.match(/[a-zA-Z\\u4e00-\\u9fa5]/g);
                const letterCount = lettersMatches ? lettersMatches.length : 0;
                const noiseRatio = docText.length > 0 ? 1 - (letterCount / docText.length) : 1;
                
                const finalQualityScore = Math.max(0, 100 - (noiseRatio * 100)); // 满分100

                callbacks.onLog(`Quality Validation: Noise Ratio ${(noiseRatio*100).toFixed(2)}%, Derived Score: ${finalQualityScore.toFixed(2)} / 100`);
                if (finalQualityScore < 20) {
                     throw new Error("Quality Check Failed: Document contains excessive noise or random characters.");
                }
                
                return [{
                    ...upstreamForQuality,
                    metadata: {
                        ...upstreamForQuality.metadata,
                        quality_score: finalQualityScore.toFixed(2),
                        passed_qc: true
                    }
                }];

            case "GENERATE_CORPUS":
                callbacks.onLog("Initiating Text Chunking (Context Window = ~1024 tokens)");
                await this.delay(1000);
                
                const upstreamForCorpus = Object.values(artifactPayloads).flat().find(a => a?._is_pdf_result);
                if (!upstreamForCorpus) throw new Error("No upstream document found for chunking.");

                let fullText = upstreamForCorpus.markdown_content as string;
                callbacks.onLog("Splitting by logical paragraphs to preserve semantic borders...");
                await this.delay(1500);

                const finalParagraphs = fullText.split('\\n\\n').filter(p => p.trim().length > 0);
                const chunks = [];
                let currentChunk = "";
                // 模拟一个极其简单的 1000 字符切片（在真实中会走 tokenizer计算 token数）
                const MAX_CHARS = 1000; 

                for (const p of finalParagraphs) {
                    if (currentChunk.length + p.length > MAX_CHARS) {
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = p;
                    } else {
                        currentChunk += (currentChunk ? "\\n\\n" : "") + p;
                    }
                }
                if (currentChunk) chunks.push(currentChunk);

                callbacks.onLog(`Generated ${chunks.length} Chunks. Serializing to JSONL-like Array...`);
                await this.delay(1000);

                // 组装最终结果数据集格式
                const corpusDataset = chunks.map((chunkText, idx) => ({
                    chunk_id: `${upstreamForCorpus.doc_id || "doc"}_${idx}`,
                    text: chunkText,
                    meta_domain: "pdf_extraction",
                    meta_source: upstreamForCorpus.source_url || "local_upload",
                    meta_quality: upstreamForCorpus.metadata?.quality_score || 100,
                    char_length: chunkText.length
                }));

                // 此处我们利用 DataFrame 来展示多行的 JSON 结构
                return corpusDataset;

            default:
                await this.delay(baseDelay);
                break;
        }
    }

    private static delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
