"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Database, FileJson, ShieldAlert, CheckCircle, ArrowRight, Wand2, Save, FileText, Eraser, Scissors, Package, ShieldCheck } from "lucide-react";
import { useAgent } from "@/features/agent/context/AgentContext";
import { StepType } from "@/features/agent/types/AgentTypes";

export function PipelineVisualizer({ onNodeClick }: { onNodeClick?: (nodeId: string) => void }) {
    const { plan } = useAgent();

    if (!plan || !plan.steps) {
        return null;
    }

    const getIconForType = (type: StepType) => {
        switch (type) {
            case "LOAD_DATA": return <Database size={20} />;
            case "INSPECT_SCHEMA": return <FileJson size={20} />;
            case "SCAN_PII": return <ShieldAlert size={20} />;
            case "TRANSFORM": return <Wand2 size={20} />;
            case "EXTRACT_PDF": return <FileText size={20} />;
            case "CLEAN_TEXT": return <Eraser size={20} />;
            case "DEDUPLICATE": return <Scissors size={20} />;
            case "QUALITY_CHECK": return <ShieldCheck size={20} />;
            case "GENERATE_CORPUS": return <Package size={20} />;
            case "WRITE_DATA": return <Save size={20} />;
            default: return <CheckCircle size={20} />;
        }
    };

    return (
        <div className="w-full h-64 bg-card/40 border border-border/50 rounded-xl relative overflow-hidden flex items-center justify-center p-8">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-border -translate-y-1/2 z-0" />

            <div className="flex justify-between w-full max-w-2xl relative z-10">
                {plan.steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <PipelineNode
                            icon={getIconForType(step.type)}
                            label={step.label}
                            status={step.status === "completed" ? "done" : step.status === "running" ? "active" : "pending"}
                            onClick={() => onNodeClick?.(step.id)}
                            description={step.description}
                        />
                        {index < plan.steps.length - 1 && <PipelineArrow />}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

interface PipelineNodeProps {
    icon: React.ReactNode;
    label: string;
    description?: string;
    status: "done" | "active" | "pending";
    onClick?: () => void;
}

function PipelineNode({ icon, label, description, status, onClick }: PipelineNodeProps) {
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "flex flex-col items-center gap-2 group focus:outline-none relative",
                onClick && "cursor-pointer hover:scale-105 transition-transform"
            )}
            title={description}
        >
            <div className={cn(
                "w-12 h-12 rounded-full border-2 flex items-center justify-center bg-background transition-all duration-500 relative z-10",
                status === "done" && "border-green-500 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]",
                status === "active" && "border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse",
                status === "pending" && "border-muted text-muted-foreground bg-card"
            )}>
                {icon}
            </div>
            <div className="flex flex-col items-center">
                <span className={cn(
                    "text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded-full border border-transparent",
                    status === "done" && "text-green-500 bg-green-500/10 border-green-500/20",
                    status === "active" && "text-primary bg-primary/10 border-primary/20",
                    status === "pending" && "text-muted-foreground"
                )}>{label}</span>
                <span className="text-[10px] text-muted-foreground/50 max-w-[100px] truncate">
                    {status === "active" ? "Running..." : ""}
                </span>
            </div>
        </button>
    );
}

function PipelineArrow() {
    return (
        <div className="flex items-center justify-center text-muted-foreground/30 flex-1">
            <ArrowRight size={20} />
        </div>
    )
}
