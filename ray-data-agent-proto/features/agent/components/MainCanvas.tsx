import React, { useEffect, useRef, useState } from "react";
import { useAgent, Resource } from "@/features/agent/context/AgentContext";
import { PipelineVisualizer } from "@/features/pipeline/components/PipelineVisualizer";
import { DataFrame } from "@/features/data-view/components/DataFrame";
import { MarkdownViewer } from "@/features/data-view/components/MarkdownViewer";
import { ResourceDetailView } from "@/features/resources/components/ResourceDetailView";
import { MessageList } from "@/features/agent/components/MessageList";
import { motion, AnimatePresence } from "framer-motion";
import { TerminalSquare, Loader2, Bot } from "lucide-react";

const MOCK_SOURCE_DATA = [
    { id: "101", timestamp: "2024-01-20T10:00:00Z", message: "User login from 192.168.1.1", email: "alice@example.com" },
    { id: "102", timestamp: "2024-01-20T10:05:00Z", message: "Purchase completed", email: "bob@gmail.com" },
    { id: "103", timestamp: "2024-01-20T10:12:00Z", message: "Failed login attempt", email: "charlie@corp.net" },
];

const MOCK_PII_DATA = [
    { id: "101", timestamp: "2024-01-20T10:00:00Z", message: "User login from [IP]", email: "[EMAIL_REDACTED]" },
    { id: "102", timestamp: "2024-01-20T10:05:00Z", message: "Purchase completed", email: "[EMAIL_REDACTED]" },
    { id: "103", timestamp: "2024-01-20T10:12:00Z", message: "Failed login attempt", email: "[EMAIL_REDACTED]" },
];

export function MainCanvas() {
    const { status, logs, messages, selectedResource, plan } = useAgent();
    const bottomRef = useRef<HTMLDivElement>(null);
    const [activePreview, setActivePreview] = useState<string | null>(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, messages, status, activePreview]);

    // If a resource is selected in the Sidebar, show its details instead of the Chat/Pipeline
    if (selectedResource) {
        return <ResourceDetailView resource={selectedResource} />;
    }

    return (
        <div className="flex-1 w-full bg-background/50 relative overflow-hidden flex flex-col">
            {/* Background Grid Pattern */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                    backgroundSize: "24px 24px",
                }}
            />

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    {/* Welcome Message - Only show when no messages */}
                    {messages.length === 0 && (
                        <div className="flex flex-col gap-2 p-8 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm text-center items-center justify-center min-h-[400px]">
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                                Data Engineering, Reimagined.
                            </h1>
                            <p className="text-muted-foreground max-w-lg">
                                Describe your data task, and VibeDataBot will orchestrate the Ray cluster to execute it at scale.
                            </p>
                        </div>
                    )}

                    {/* Chat History */}
                    <MessageList messages={messages} />

                    {/* Planning Phase Visualizer - Show if plan exists */}
                    <AnimatePresence>
                        {plan && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col gap-4 mb-4"
                            >
                                <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    Active Execution Plan
                                </div>
                                <PipelineVisualizer onNodeClick={setActivePreview} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Data Preview Modal Area */}
                    <AnimatePresence>
                        {activePreview && plan && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden flex flex-col gap-4"
                            >
                                {(() => {
                                    const step = plan.steps.find((s) => s.id === activePreview);
                                    if (!step) return null;

                                    const artifacts = plan.artifacts?.[activePreview];

                                    return (
                                        <>
                                            {/* 上半部分：白盒动作与代码透视区 */}
                                            <div className="p-5 rounded-xl border border-primary/20 bg-card/60 backdrop-blur-md shadow-lg flex flex-col gap-3 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10 group-hover:bg-primary/10 transition-colors" />
                                                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                                    <h3 className="font-semibold flex items-center gap-2 relative text-foreground">
                                                        <span className="w-1.5 h-6 bg-primary rounded-full" />
                                                        {step.label}
                                                    </h3>
                                                    <div className="px-2 py-0.5 rounded text-[11px] font-mono tracking-wider bg-muted/80 text-muted-foreground uppercase border border-border/50">
                                                        {step.status}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                                                    {step.description}
                                                </p>
                                                {step.codeSnippet && (
                                                    <div className="bg-[#1e1e1e] border border-border/30 rounded-lg p-4 overflow-x-auto text-[13px] text-green-400 font-mono shadow-inner mt-2">
                                                        <pre><code className="leading-relaxed">{step.codeSnippet}</code></pre>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 下半部分：执行数据挂载区 */}
                                            {artifacts ? (
                                                <div className="overflow-hidden relative z-10">
                                                    {artifacts[0]?._is_pdf_result ? (
                                                        <MarkdownViewer
                                                            title={`Result Artifacts: ${step.label}`}
                                                            data={artifacts[0]}
                                                            className="border-primary/20 shadow-xl"
                                                        />
                                                    ) : (
                                                        <DataFrame
                                                            title={`Result Artifacts: ${step.label}`}
                                                            data={artifacts}
                                                            columns={
                                                                artifacts[0]?.chunk_id 
                                                                    ? ["chunk_id", "text", "meta_source", "meta_quality", "char_length"] 
                                                                    : ["id", "timestamp", "source_ip", "user_email", "message"]
                                                            }
                                                            highlightColumns={activePreview.includes("PII") ? ["user_email", "message"] : (artifacts[0]?.chunk_id ? ["text"] : [])}
                                                            className="border-primary/20 shadow-xl"
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center p-8 border border-dashed border-border/40 rounded-xl text-muted-foreground/50 text-sm bg-muted/5">
                                                    Agent execution strategy pending. Click 'Execute' to attach data artifacts.
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Terminal / Logs Section */}
                    {logs.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full bg-black/40 border border-border/50 rounded-lg overflow-hidden font-mono text-xs mt-4"
                        >
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/10 text-muted-foreground">
                                <TerminalSquare size={14} />
                                <span>Ray Cluster Terminal</span>
                            </div>
                            <div className="p-3 max-h-48 overflow-y-auto flex flex-col gap-1 text-muted-foreground/80">
                                {logs.map((log, i) => (
                                    <div key={i} className="whitespace-pre-wrap font-mono">{log}</div>
                                ))}
                                {status === "EXECUTING" && (
                                    <div className="flex items-center gap-2 text-primary/80 animate-pulse">
                                        <Loader2 size={12} className="animate-spin" />
                                        Running task...
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {status === "THINKING" && (
                        <div className="flex items-center gap-2 text-muted-foreground/50 text-sm animate-pulse px-4">
                            <Bot size={14} />
                            VibeDataBot is thinking...
                        </div>
                    )}

                    {/* Spacer to prevent content from being hidden behind the floating chat */}
                    <div className="h-48" />
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    );
}
