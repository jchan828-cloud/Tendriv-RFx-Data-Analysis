"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, X, Bot, User } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatPanelProps {
  onClose: () => void;
  context?: Record<string, string>;
}

const SUGGESTIONS = [
  "Which agencies have the highest non-competitive rate?",
  "What's the average contract value for services?",
  "When do most contracts expire?",
  "Who are the top 5 suppliers by value?",
];

export function ChatPanel({ onClose, context }: ChatPanelProps) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { context },
    }),
  });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-80 shrink-0 flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-100">AI Assistant</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-3">
        {messages.length === 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-zinc-500">Ask questions about the procurement data:</p>
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="w-full text-left text-[11px] text-zinc-400 hover:text-zinc-100 bg-zinc-800/50 hover:bg-zinc-800 px-2.5 py-1.5 rounded border border-zinc-700/50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 mt-2">
          {messages.map((m) => {
            const isUser = m.role === "user";
            const textPart = m.parts?.find((p) => p.type === "text");
            const text = textPart?.type === "text" ? textPart.text : "";

            return (
              <div key={m.id} className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
                {!isUser && (
                  <div className="shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] text-[12px] leading-relaxed rounded-lg px-3 py-2 whitespace-pre-wrap",
                    isUser
                      ? "bg-indigo-600/30 text-zinc-100 border border-indigo-500/30"
                      : "bg-zinc-800 text-zinc-300 border border-zinc-700/50"
                  )}
                >
                  {text}
                </div>
                {isUser && (
                  <div className="shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2">
              <Bot className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="bg-zinc-800 border border-zinc-700/50 rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <div className="px-3 py-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the data..."
            className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-md p-2 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
