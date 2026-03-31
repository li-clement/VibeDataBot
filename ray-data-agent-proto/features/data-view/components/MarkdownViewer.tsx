"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { FileText, Eye, Clock, Hash } from "lucide-react";

interface MarkdownViewerProps {
    data: {
        markdown_content: string;
        metadata: any;
        source_url: string;
        _is_pdf_result?: boolean;
    };
    title?: string;
    className?: string;
}

export function MarkdownViewer({ data, title, className }: MarkdownViewerProps) {
    // Generate safe proxy URL for local pdf
    const pdfUrl = data.source_url 
        ? `/api/file?path=${encodeURIComponent(data.source_url)}` 
        : "";

    return (
        <div className={cn("rounded-lg border border-border overflow-hidden bg-card shadow-sm flex flex-col h-[700px]", className)}>
            {/* Header / Meta Strip */}
            <div className="bg-muted/30 px-4 py-3 border-b border-border flex flex-col gap-2 shadow-sm z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText size={16} className="text-primary" />
                        <span>{title || "PDF Extraction Result"}</span>
                        {data.metadata?.used_extract_kit && (
                            <span className="ml-2 text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-wider">
                                🚀 PDF-Extract-Kit
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <span className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-1 rounded flex items-center gap-1 border border-border/50">
                            <Clock size={10} /> {data.metadata?._processing_time_ms || 0} ms
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded flex items-center gap-1">
                            <Hash size={10} /> {data.metadata?.page_count || 1} PGs
                        </span>
                        <span className="text-[10px] bg-muted-foreground/10 text-muted-foreground px-2 py-1 rounded flex items-center gap-1">
                            <Eye size={10} /> {data.metadata?.fast_track_enabled ? "Fast (Native)" : "Deep (VDU)"}
                        </span>
                    </div>
                </div>
                
                {data.source_url && (
                    <div className="text-[10px] font-mono text-muted-foreground truncate w-full flex items-center gap-1">
                        FILE: {data.source_url}
                    </div>
                )}
            </div>

            {/* Split View Content: Side-by-side Visual QA */}
            <div className="flex flex-1 overflow-hidden h-full">

                {/* Left Area: Original Document View (iframe Proxy) */}
                <div className="w-1/2 border-r border-border bg-black/5 flex flex-col relative group">
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md opacity-50 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        Original Document
                    </div>
                    {pdfUrl ? (
                         <iframe 
                             src={pdfUrl + "#toolbar=0&navpanes=0"} 
                             className="w-full h-full border-0 bg-white" 
                             style={{ colorScheme: "light" }}
                             title="PDF Preview"
                         />
                    ) : (
                        <div className="m-auto text-sm text-muted-foreground italic flex flex-col items-center gap-2">
                            <FileText className="opacity-20" size={48} />
                            No source file provided for preview.
                        </div>
                    )}
                </div>

                {/* Right Area: Parsed LaTeX/Markdown Result */}
                <div className="w-1/2 bg-background p-6 overflow-y-auto font-sans leading-relaxed text-[13px] text-foreground relative group">
                    <div className="absolute top-2 right-2 bg-primary/10 text-primary text-[10px] px-2 py-1 rounded backdrop-blur-md opacity-50 group-hover:opacity-100 transition-opacity z-10">
                        Extracted Struct
                    </div>
                    
                    {/* Render raw text allowing math equations and HTML tables to be seen clearly */}
                    <div className="prose prose-sm prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap font-sans bg-transparent p-0 m-0 border-0">
                            {data.markdown_content || "Empty content returned"}
                        </pre>
                    </div>
                    
                    {/* Footnote about extracted images if any */}
                    {data.metadata?.extracted_images?.length > 0 && (
                        <div className="mt-8 pt-4 border-t border-border/40">
                             <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Image Pointers</div>
                             <ul className="text-[11px] text-muted-foreground pl-4 space-y-1">
                                 {data.metadata.extracted_images.map((img: string, i: number) => (
                                     <li key={i}>{img}</li>
                                 ))}
                             </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
