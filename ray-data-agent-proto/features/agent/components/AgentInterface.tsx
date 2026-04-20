"use client";

import React, { useEffect, useRef, useState } from "react";

import { Sidebar } from "@/features/navigation/components/Sidebar";
import { MainCanvas } from "@/features/agent/components/MainCanvas";
import { ChatInterface } from "@/features/agent/components/ChatInterface";
import { AgentProvider } from "@/features/agent/context/AgentContext";

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_DEFAULT_WIDTH = 320;

export function AgentInterface() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const resizeFrame = useRef<number | null>(null);

    useEffect(() => {
        if (!isResizingSidebar) {
            return undefined;
        }

        const handleMouseMove = (event: MouseEvent) => {
            const nextWidth = Math.min(
                SIDEBAR_MAX_WIDTH,
                Math.max(SIDEBAR_MIN_WIDTH, event.clientX),
            );

            if (resizeFrame.current !== null) {
                cancelAnimationFrame(resizeFrame.current);
            }

            resizeFrame.current = requestAnimationFrame(() => {
                setSidebarWidth(nextWidth);
            });
        };

        const handleMouseUp = () => {
            setIsResizingSidebar(false);
            if (resizeFrame.current !== null) {
                cancelAnimationFrame(resizeFrame.current);
                resizeFrame.current = null;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            if (resizeFrame.current !== null) {
                cancelAnimationFrame(resizeFrame.current);
                resizeFrame.current = null;
            }
        };
    }, [isResizingSidebar]);

    return (
        <AgentProvider>
            <div className="flex h-full w-full bg-background text-foreground">
                {/* Sidebar */}
                <Sidebar
                    isOpen={sidebarOpen}
                    width={sidebarWidth}
                    toggle={() => setSidebarOpen(!sidebarOpen)}
                    onResizeStart={() => setIsResizingSidebar(true)}
                />

                {/* Main Content Area */}
                <div className="flex flex-1 flex-col overflow-hidden relative transition-all duration-300">
                    <MainCanvas />

                    {/* Floating Chat Interface */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50">
                        <ChatInterface />
                    </div>
                </div>
            </div>
        </AgentProvider>
    );
}
