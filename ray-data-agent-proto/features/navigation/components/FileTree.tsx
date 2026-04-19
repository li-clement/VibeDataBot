"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight, Folder, File, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgent } from "@/features/agent/context/AgentContext";

interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
}

interface FileTreeProps {
    initialDir?: string;
}

function getBaseName(targetPath: string) {
    const trimmed = targetPath.replace(/[\\/]+$/, "");
    if (!trimmed) {
        return "VibeDataBot-main";
    }
    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] || "VibeDataBot-main";
}

export function FileTree({ initialDir = "" }: FileTreeProps) {
    return (
        <div className="w-full text-sm text-foreground/80 p-2 max-h-[400px] overflow-y-auto scrollbar-thin">
            <TreeNode path={initialDir} name="" isDirectory={true} isRoot={true} defaultExpanded={true} />
        </div>
    );
}

function TreeNode({ path, name, isDirectory, isRoot, defaultExpanded = false }: { path: string; name: string; isDirectory: boolean; isRoot?: boolean; defaultExpanded?: boolean }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [children, setChildren] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [resolvedPath, setResolvedPath] = useState(path);
    
    // Auto-inject context
    const { setChatInput } = useAgent();

    const fetchFolder = async (dirPath: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/fs?dir=${encodeURIComponent(dirPath)}`);
            if (res.ok) {
                const data = await res.json();
                setChildren(data.items || []);
                if (typeof data.path === "string") {
                    setResolvedPath(data.path);
                }
            }
        } catch (e) {
            console.error("Failed to load fs", e);
        } finally {
            setLoading(false);
            setHasFetched(true);
        }
    };

    useEffect(() => {
        if (expanded && !hasFetched && isDirectory) {
            fetchFolder(path);
        }
    }, [expanded, path, isDirectory, hasFetched]);

    const handleToggle = () => {
        if (isDirectory) {
            setExpanded(!expanded);
        } else {
            // It's a file!
            if (name.toLowerCase().endsWith(".pdf")) {
                setChatInput(`提取该 PDF 文件内容，路径是：${path}`);
            } else {
                setChatInput(`载入本地文件：${path}`);
            }
        }
    };

    const getIcon = () => {
        if (isDirectory) {
            return expanded ? <Folder size={14} className="text-primary/70 fill-primary/20" /> : <Folder size={14} className="text-muted-foreground" />;
        }
        if (name.toLowerCase().endsWith(".pdf")) {
            return <FileText size={14} className="text-red-400" />;
        }
        return <File size={14} className="text-muted-foreground/70" />;
    };

    const displayName = isRoot ? getBaseName(resolvedPath) : name;

    return (
        <div className="flex flex-col">
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1 px-1 hover:bg-muted/50 rounded cursor-pointer select-none transition-colors",
                    isRoot && "font-semibold mb-1"
                )}
                onClick={handleToggle}
            >
                {/* Expand Indicator */}
                <div className="w-4 flex justify-center shrink-0">
                    {isDirectory && (
                        <div className={cn("text-muted-foreground transition-transform", expanded && "rotate-90")}>
                            {loading ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={14} />}
                        </div>
                    )}
                </div>

                {/* File/Folder Icon */}
                {getIcon()}

                {/* Label */}
                <span className="truncate flex-1">{displayName}</span>
            </div>

            {/* Children List */}
            {expanded && isDirectory && (
                <div className="ml-3 pl-2 border-l border-border/30 flex flex-col gap-0.5 mt-0.5">
                    {children.map((child, i) => (
                        <TreeNode
                            key={`${child.path}-${i}`}
                            path={child.path}
                            name={child.name}
                            isDirectory={child.isDirectory}
                        />
                    ))}
                    {hasFetched && children.length === 0 && (
                        <div className="text-xs text-muted-foreground/50 italic px-4 py-1">Empty directory</div>
                    )}
                </div>
            )}
        </div>
    );
}
