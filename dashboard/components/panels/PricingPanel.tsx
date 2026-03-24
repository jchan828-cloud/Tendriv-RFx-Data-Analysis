"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ScatterChart, Scatter, LineChart, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  loadValueBands, loadAmendmentPatterns, loadCategoryTrends,
  loadProcurementMethods, loadSupplierConcentration,
  formatCurrency, formatNumber, ALL_FISCAL_YEARS,
} from "@/lib/data";
import type { ValueBand, AmendmentPatterns, CategoryTrend, SupplierConcentration } from "@/lib/types";

const TOOLTIP_STYLE = {
  backgroundColor: "#18181b", border: "1px solid #3f3f46",
  borderRadius: "6px", fontSize: "11px", color: "#e4e4e7",
};

const CATEGORIES = ["All", "Services", "Goods", "Construction", "Services & Goods"];
const METHODS = ["All", "Competitive - Open", "Competitive - Traditional", "Non-competitive", "ACAN"];

export function PricingPanel() {
  const [bands, setBands] = useState<ValueBand[]>([]);
  const [amendments, setAmendments] = useState<AmendmentPatterns | null>(null);
  const [categoryTrends, setCategoryTrends] = useState<CategoryTrend[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierConcentration[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All");

  useEffect(() => {
    Promise.all([
      loadValueBands(),
      loadAmendmentPatterns(),
      loadCategoryTrends(),
      loadSupplierConcentration(),
    ]).then(([b, a, ct, s]) => {
      setBands(b);
      setAmendments(a);
      setCategoryTrends(ct);
      setSuppliers(s);
    });
  }, []);

  // Filtered bands
  const filteredBands = useMemo(() => {
    if (selectedCategory === "All" && selectedMethod === "All") return bands;
    return bands.map((b) => {
      let count = b.count;
      let value = b.value;
      if (selectedCategory !== "All" && b.by_category[selectedCategory]) {
        count = b.by_category[selectedCategory].count;
        value = b.by_category[selectedCategory].value;
      } else if (selectedCategory !== "All") {
        count = 0; value = 0;
      }
      if (selectedMethod !== "All" && b.by_method[selectedMethod]) {
        const ratio = count > 0 ? b.by_method[selectedMethod].count / b.count : 0;
        count = Math.round(count * ratio);
        value = value * ratio;
      } else if (selectedMethod !== "All") {
        count = 0; value = 0;
      }
      return { ...b, count, value };
    });
  }, [bands, selectedCategory, selectedMethod]);

  // Price trend: median value per fiscal year for selected category
  const priceTrend = useMemo(() => {
    const cat = categoryTrends.find((c) => c.category === selectedCategory);
    const allCat = selectedCategory === "All" ? categoryTrends : (cat ? [cat] : []);
    return ALL_FISCAL_YEARS.map((fy) => {
      const total = allCat.reduce((s, c) => s + (c.by_year[fy]?.value ?? 0), 0);
      const count = allCat.reduce((s, c) => s + (c.by_year[fy]?.count ?? 0), 0);
      return {
        fy,
        avg: count > 0 ? Math.round(total / count / 1000) : 0, // in $K
      };
    }).filter((d) => d.avg > 0);
  }, [categoryTrends, selectedCategory]);

  // Selection criteria vs avg value
  const criteriaVsValue = useMemo(() => {
    // Use value_bands by_category split
    if (bands.length === 0) return [];
    const totalByBand = bands.map((b) => ({ band: b.band, count: b.count, value: b.value }));
    const medians = totalByBand.map((b) => ({
      name: b.band,
      avgK: b.count > 0 ? Math.round(b.value / b.count / 1000) : 0,
    }));
    return medians;
  }, [bands]);

  // Amendment premium data
  const amendDist = amendments?.amendment_distribution ?? [];
  const amendPremium = amendments?.avg_value_premium_pct ?? 0;
  const byNoticeType = amendments?.by_notice_type ?? [];

  // Top suppliers pricing landscape
  const supplierData = useMemo(() =>
    suppliers.slice(0, 12).map((s) => ({
      name: s.supplier.slice(0, 28),
      valueM: Math.round(s.total_value / 1e6),
      wins: s.win_count,
      agencies: s.agency_count,
    })),
    [suppliers]
  );

  if (bands.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400">Category:</span>
        <Select value={selectedCategory} onValueChange={(v) => v && setSelectedCategory(v)}>
          <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-zinc-300 text-xs">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-zinc-400 ml-2">Method:</span>
        <Select value={selectedMethod} onValueChange={(v) => v && setSelectedMethod(v)}>
          <SelectTrigger className="w-52 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {METHODS.map((m) => <SelectItem key={m} value={m} className="text-zinc-300 text-xs">{m}</SelectItem>)}
          </SelectContent>
        </Select>
        {amendPremium > 0 && (
          <Badge className="ml-auto bg-amber-600/20 text-amber-300 border-amber-500/30 text-[11px]">
            Avg amendment premium: +{amendPremium}%
          </Badge>
        )}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Contract Value Distribution (Count)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={filteredBands} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="band" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), "Contracts"]} />
                <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} name="count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Avg Contract Value Trend ($K)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={priceTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="fy" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${Number(v)}K`, "Avg Value"]} />
                <Line type="monotone" dataKey="avg" stroke="#f59e0b" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Amendment patterns */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Amendment Count Distribution</CardTitle>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Contracts with 0 amendments = clean award. Higher amendment count = scope creep risk.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={amendDist.slice(0, 12)} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="amendments" tick={{ fontSize: 10, fill: "#a1a1aa" }} label={{ value: "# Amendments", position: "insideBottom", offset: -2, fontSize: 10, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), "Contracts"]} />
                <Bar dataKey="contracts" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Avg Amendments by Notice Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mt-2">
              {byNoticeType.slice(0, 8).map((n) => (
                <div key={n.notice_type} className="flex items-center gap-2">
                  <div className="text-[11px] text-zinc-400 w-48 truncate">{n.notice_type || "Unknown"}</div>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (n.avg_amendments / 5) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-mono text-zinc-300 w-8 text-right">{n.avg_amendments.toFixed(1)}</div>
                  <div className="text-[10px] text-zinc-600 w-16 text-right">({formatNumber(n.contract_count)})</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier pricing landscape */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Supplier Pricing Landscape — Top 12 by Total Value</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={supplierData} layout="vertical" margin={{ top: 2, right: 16, left: 8, bottom: 2 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
              <YAxis dataKey="name" type="category" width={196} tick={{ fontSize: 10, fill: "#a1a1aa" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [name === "valueM" ? `$${v}M` : formatNumber(Number(v)), name === "valueM" ? "Total Value" : "Wins"]} />
              <Bar dataKey="valueM" fill="#6366f1" radius={[0, 3, 3, 0]} name="valueM" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-96 bg-zinc-800 rounded" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-2 gap-4">
          <div className="h-56 bg-zinc-800 rounded-lg" />
          <div className="h-56 bg-zinc-800 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
