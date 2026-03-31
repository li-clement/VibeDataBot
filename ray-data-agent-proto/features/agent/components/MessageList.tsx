import React from "react";
import { AgentMessage } from "../types/AgentTypes";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import { motion } from "framer-motion";

export function MessageList({ messages }: { messages: AgentMessage[] }) {
    if (messages.length === 0) return null;

    return (
        <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto pb-10">
            {messages.map((msg, index) => (
                <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                        "flex gap-4",
                        msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    )}>
                        {msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}
                    </div>

                    <div className={cn(
                        "flex flex-col gap-1 max-w-[80%]",
                        msg.sender === "user" ? "items-end" : "items-start"
                    )}>
                        <div className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                            msg.sender === "user"
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-card border border-border/50 text-foreground rounded-tl-none shadow-sm"
                        )}>
                            {msg.content}
                        </div>
                        <span className="text-[10px] text-muted-foreground/50 px-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
