"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const METRIC_LABELS: Record<string, string> = {
    alpha_han_ratio: "Alpha / Han Ratio",
    uppercase_ratio: "Uppercase Ratio",
    terminal_punctuation_ratio: "Terminal Punctuation",
    short_line_ratio: "Short Line Ratio",
    list_line_ratio: "List Line Ratio",
    duplication_ratio: "Duplication Ratio",
    char_entropy: "Character Entropy",
    avg_sentence_length: "Avg Sentence Length",
    punctuation_to_word_ratio: "Punct / Word Ratio",
    avg_word_length: "Avg Word Length",
    stopword_ratio: "Stopword Ratio",
    sensitive_word_density: "Sensitive Density",
    multilingual_mixing: "Multilingual Mixing",
    high_freq_3gram_coverage: "3-gram Coverage",
    high_freq_7gram_coverage: "7-gram Coverage",
};

type QualityPayload = {
    _is_quality_result?: boolean;
    evaluation: {
        document_metrics: Record<string, number>;
        final_score: number | null;
        final_decision: "pass" | "reject" | "manual_review";
        dependency_warnings?: Array<{ message: string }>;
        normalized_text_length?: number;
        input_meta?: Record<string, unknown>;
        score_detail?: {
            rule_hits?: Array<{ code: string; severity: string }>;
        };
    };
    source_url?: string;
    document_preview?: string;
    metadata?: {
        page_count?: number;
        source_type?: string;
        extract_mode?: string;
        used_extract_kit?: boolean;
    };
};

interface QualityEvaluationCardProps {
    data: QualityPayload;
    title?: string;
    className?: string;
}

export function QualityEvaluationCard({ data, title, className }: QualityEvaluationCardProps) {
    const evaluation = data.evaluation;
    const score = evaluation.final_score ?? 0;
    const decision = evaluation.final_decision;
    const ruleHits = evaluation.score_detail?.rule_hits ?? [];
    const dependencyWarnings = evaluation.dependency_warnings ?? [];
    const metricEntries = Object.entries(evaluation.document_metrics ?? {});

    return (
        <div className={cn("rounded-lg border border-border bg-card shadow-sm overflow-hidden", className)}>
            <div className="border-b border-border/60 bg-muted/20 px-5 py-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-primary" />
                        <div>
                            <div className="text-sm font-semibold text-foreground">
                                {title || "Atomic Quality Evaluation"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                15 heuristics, one document-level decision
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ScoreRing score={score} decision={decision} />
                        <DecisionBadge decision={decision} />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {data.metadata?.page_count ? <MetaPill label={`${data.metadata.page_count} pages`} /> : null}
                    {evaluation.normalized_text_length ? <MetaPill label={`${evaluation.normalized_text_length} chars`} /> : null}
                    {data.metadata?.source_type ? <MetaPill label={data.metadata.source_type} /> : null}
                    {data.metadata?.extract_mode ? <MetaPill label={data.metadata.extract_mode} /> : null}
                    {data.metadata?.used_extract_kit ? <MetaPill label="PDF-Extract-Kit" tone="accent" /> : null}
                </div>

                {data.source_url ? (
                    <div className="text-[11px] font-mono text-muted-foreground truncate">
                        FILE: {data.source_url}
                    </div>
                ) : null}
            </div>

            <div className="p-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {metricEntries.map(([key, value]) => (
                        <MetricTile key={key} label={METRIC_LABELS[key] ?? key} value={value} />
                    ))}
                </div>

                <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                            Evaluation Signals
                        </div>
                        <div className="flex flex-col gap-2">
                            {ruleHits.length > 0 ? (
                                ruleHits.map((hit, index) => (
                                    <SignalRow
                                        key={`${hit.code}-${index}`}
                                        icon={hit.severity === "reject" ? ShieldAlert : AlertTriangle}
                                        tone={hit.severity === "reject" ? "danger" : "warn"}
                                        label={hit.code}
                                        detail={hit.severity}
                                    />
                                ))
                            ) : (
                                <SignalRow
                                    icon={CheckCircle2}
                                    tone="success"
                                    label="No blocking rule hits"
                                    detail="The heuristic gate passed cleanly."
                                />
                            )}
                            {dependencyWarnings.map((warning, index) => (
                                <SignalRow
                                    key={`dep-${index}`}
                                    icon={AlertTriangle}
                                    tone="warn"
                                    label="Dependency warning"
                                    detail={warning.message}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                            <FileText size={14} />
                            Document Preview
                        </div>
                        <pre className="whitespace-pre-wrap text-xs leading-6 text-foreground/80 font-sans max-h-[260px] overflow-y-auto">
                            {data.document_preview || "No preview available."}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ScoreRing({ score, decision }: { score: number; decision: QualityPayload["evaluation"]["final_decision"] }) {
    const toneClass =
        decision === "pass"
            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
            : decision === "reject"
                ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
                : "text-amber-400 border-amber-500/30 bg-amber-500/10";

    return (
        <div className={cn("h-16 w-16 rounded-full border flex items-center justify-center font-semibold", toneClass)}>
            {score.toFixed(1)}
        </div>
    );
}

function DecisionBadge({ decision }: { decision: QualityPayload["evaluation"]["final_decision"] }) {
    const label = decision === "manual_review" ? "Manual Review" : decision.toUpperCase();
    const toneClass =
        decision === "pass"
            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
            : decision === "reject"
                ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
                : "text-amber-300 bg-amber-500/10 border-amber-500/30";
    return <span className={cn("px-3 py-1 rounded-full border text-xs font-semibold tracking-wide", toneClass)}>{label}</span>;
}

function MetaPill({ label, tone = "default" }: { label: string; tone?: "default" | "accent" }) {
    return (
        <span
            className={cn(
                "px-2.5 py-1 rounded-full border text-[11px]",
                tone === "accent"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/30 text-muted-foreground"
            )}
        >
            {label}
        </span>
    );
}

function MetricTile({ label, value }: { label: string; value: number }) {
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(4);
    return (
        <div className="rounded-xl border border-border/60 bg-background/60 p-4 flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold text-foreground">{formatted}</div>
        </div>
    );
}

function SignalRow({
    icon: Icon,
    tone,
    label,
    detail,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tone: "success" | "warn" | "danger";
    label: string;
    detail: string;
}) {
    const toneClass =
        tone === "success"
            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
            : tone === "danger"
                ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                : "text-amber-300 bg-amber-500/10 border-amber-500/20";

    return (
        <div className={cn("rounded-lg border p-3 flex gap-3 items-start", toneClass)}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
                <div className="text-sm font-medium break-all">{label}</div>
                <div className="text-xs opacity-80 break-words">{detail}</div>
            </div>
        </div>
    );
}
