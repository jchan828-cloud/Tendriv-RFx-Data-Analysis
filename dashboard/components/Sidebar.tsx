"use client";

import { BarChart3, Building2, DollarSign, Clock, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewId = "overview" | "agency" | "pricing" | "timing";

const NAV_ITEMS: { id: ViewId; label: string; icon: React.ElementType; description: string }[] = [
  { id: "overview", label: "Overview", icon: BarChart3, description: "Macro landscape" },
  { id: "agency", label: "Agency Intel", icon: Building2, description: "Buyer deep dive" },
  { id: "pricing", label: "Pricing Intel", icon: DollarSign, description: "Win price analysis" },
  { id: "timing", label: "Opportunity Timing", icon: Clock, description: "Renewal pipeline" },
];

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (v: ViewId) => void;
  onToggleChat: () => void;
  chatOpen: boolean;
  metadata?: { total_records: number; date_range: { min: string | null; max: string | null } };
}

export function Sidebar({ activeView, onViewChange, onToggleChat, chatOpen, metadata }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 flex flex-col h-full bg-zinc-900 border-r border-zinc-800">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-sm tracking-tight text-zinc-100">RFx Intelligence</span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">GC Procurement Analytics</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                active
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              )}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium leading-none">{item.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* AI Chat toggle */}
      <div className="px-2 pb-3">
        <button
          onClick={onToggleChat}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
            chatOpen
              ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          )}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <div className="text-left">
            <div className="text-xs font-medium leading-none">AI Assistant</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Ask the data</div>
          </div>
        </button>
      </div>

      {/* Data footer */}
      {metadata && (
        <div className="px-4 py-3 border-t border-zinc-800 text-[10px] text-zinc-600 font-mono">
          <div>{metadata.total_records.toLocaleString()} records</div>
          {metadata.date_range.min && (
            <div>{metadata.date_range.min.slice(0, 7)} → {metadata.date_range.max?.slice(0, 7)}</div>
          )}
        </div>
      )}
    </aside>
  );
}
