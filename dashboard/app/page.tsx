"use client";

import { useState, useEffect } from "react";
import { Sidebar, type ViewId } from "@/components/Sidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { OverviewPanel } from "@/components/panels/OverviewPanel";
import { AgencyPanel } from "@/components/panels/AgencyPanel";
import { PricingPanel } from "@/components/panels/PricingPanel";
import { TimingPanel } from "@/components/panels/TimingPanel";
import { loadMetadata } from "@/lib/data";
import type { Metadata } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

const VIEW_TITLES: Record<ViewId, { title: string; sub: string }> = {
  overview: { title: "Overview", sub: "Macro procurement landscape — spend trends, method mix, value distribution" },
  agency: { title: "Agency Intelligence", sub: "Deep dive on a specific contracting entity — spend profile, method breakdown, top suppliers" },
  pricing: { title: "Pricing Intelligence", sub: "Win price analysis — value distribution, amendment premiums, supplier pricing landscape" },
  timing: { title: "Opportunity Timing", sub: "Renewal pipeline — upcoming expirations, seasonal patterns, fiscal year-end signals" },
};

export default function DashboardPage() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [chatOpen, setChatOpen] = useState(false);
  const [metadata, setMetadata] = useState<Metadata | undefined>();

  useEffect(() => {
    loadMetadata().then(setMetadata).catch(() => undefined);
  }, []);

  const title = VIEW_TITLES[activeView];

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatOpen={chatOpen}
        metadata={metadata}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <h1 className="text-base font-semibold text-zinc-100">{title.title}</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">{title.sub}</p>
        </header>

        {/* View content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-5">
            {activeView === "overview" && <OverviewPanel />}
            {activeView === "agency" && <AgencyPanel />}
            {activeView === "pricing" && <PricingPanel />}
            {activeView === "timing" && <TimingPanel />}
          </div>
        </ScrollArea>
      </div>

      {/* AI Chat Panel */}
      {chatOpen && (
        <ChatPanel
          onClose={() => setChatOpen(false)}
          context={{ activeView }}
        />
      )}
    </div>
  );
}
