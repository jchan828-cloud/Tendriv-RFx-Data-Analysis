"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { loadRenewalWindows, loadCategoryTrends, loadAmendmentPatterns, formatCurrency, formatNumber, CATEGORY_COLORS } from "@/lib/data";
import type { RenewalWindows, CategoryTrend } from "@/lib/types";

const TOOLTIP_STYLE = {
  backgroundColor: "#18181b", border: "1px solid #3f3f46",
  borderRadius: "6px", fontSize: "11px", color: "#e4e4e7",
};

function daysLabel(d: number) {
  if (d <= 30) return "< 30 days";
  if (d <= 90) return "< 90 days";
  if (d <= 180) return "< 180 days";
  return "< 18 months";
}

function urgencyColor(days: number) {
  if (days <= 30) return "bg-red-500/15 text-red-300 border-red-500/30";
  if (days <= 90) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (days <= 180) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  return "bg-zinc-700/50 text-zinc-400 border-zinc-600";
}

export function TimingPanel() {
  const [renewal, setRenewal] = useState<RenewalWindows | null>(null);
  const [categories, setCategories] = useState<CategoryTrend[]>([]);
  const [amendments, setAmendments] = useState<{ avg_value_premium_pct: number } | null>(null);

  useEffect(() => {
    Promise.all([
      loadRenewalWindows(),
      loadCategoryTrends(),
      loadAmendmentPatterns(),
    ]).then(([r, c, a]) => {
      setRenewal(r);
      setCategories(c);
      setAmendments(a);
    });
  }, []);

  // Heatmap: contracts by month (last 4 years)
  const heatmapData = useMemo(() => {
    if (!renewal) return [];
    const monthlyMap: Record<string, { count: number; value: number }> = {};
    renewal.by_month.forEach((m) => {
      monthlyMap[m.month] = { count: m.count, value: m.value };
    });
    // Get last 36 months of data
    const sorted = renewal.by_month
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-36);
    return sorted.map((m) => ({
      month: m.month.slice(0, 7),
      count: m.count,
      valueM: Math.round(m.value / 1e6),
    }));
  }, [renewal]);

  // Upcoming renewals by category
  const upcomingByCategory = useMemo(() => {
    if (!renewal) return [];
    const byCat: Record<string, { count: number; value: number }> = {};
    renewal.upcoming_renewals.forEach((r) => {
      if (!byCat[r.category]) byCat[r.category] = { count: 0, value: 0 };
      byCat[r.category].count += 1;
      byCat[r.category].value += r.amount;
    });
    return Object.entries(byCat)
      .map(([cat, v]) => ({ cat, count: v.count, valueM: Math.round(v.value / 1e6) }))
      .sort((a, b) => b.valueM - a.valueM);
  }, [renewal]);

  // Month-of-year seasonality (how many contracts expire in each calendar month)
  const seasonality = useMemo(() => {
    if (!renewal) return [];
    const byMonthOfYear: Record<number, number> = {};
    renewal.by_month.forEach((m) => {
      const month = parseInt(m.month.slice(5, 7));
      byMonthOfYear[month] = (byMonthOfYear[month] ?? 0) + m.count;
    });
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthNames.map((name, i) => ({
      name,
      count: byMonthOfYear[i + 1] ?? 0,
    }));
  }, [renewal]);

  // Category trend for Q4 note
  const q4Total = seasonality.slice(0, 3).reduce((s, m) => s + m.count, 0);
  const annualTotal = seasonality.reduce((s, m) => s + m.count, 0);
  const q4Pct = annualTotal > 0 ? Math.round((q4Total / annualTotal) * 100) : 0;

  const upcomingRenewals = renewal?.upcoming_renewals ?? [];
  const urgent = upcomingRenewals.filter((r) => r.days_remaining <= 30).length;
  const soon = upcomingRenewals.filter((r) => r.days_remaining > 30 && r.days_remaining <= 90).length;

  if (!renewal) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Upcoming Renewals</p>
            </div>
            <p className="text-2xl font-semibold font-mono text-zinc-100">{formatNumber(upcomingRenewals.length)}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Next 18 months</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-red-900/30 border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3.5 w-3.5 text-red-400" />
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Urgent (&lt;30d)</p>
            </div>
            <p className="text-2xl font-semibold font-mono text-red-300">{formatNumber(urgent)}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Act now</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-amber-900/30 border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Coming Soon (&lt;90d)</p>
            </div>
            <p className="text-2xl font-semibold font-mono text-amber-300">{formatNumber(soon)}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Prepare proposals</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Q4 (Jan–Mar) Share</p>
            </div>
            <p className="text-2xl font-semibold font-mono text-emerald-300">{q4Pct}%</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Of all expirations</p>
          </CardContent>
        </Card>
      </div>

      {/* Seasonality + upcoming by category */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Contract Expiry Seasonality (by Calendar Month)</CardTitle>
            <p className="text-[11px] text-zinc-500">Jan–Mar surge = fiscal year-end rush</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={seasonality} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), "Expirations"]} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {seasonality.map((entry, i) => (
                    <rect key={i} fill={i < 3 ? "#f59e0b" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Upcoming Renewals by Category (Next 18 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={upcomingByCategory} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis dataKey="cat" type="category" width={90} tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [name === "valueM" ? `$${v}M` : formatNumber(Number(v)), name === "valueM" ? "Total Value" : "Count"]} />
                <Bar dataKey="count" fill="#22d3ee" radius={[0, 3, 3, 0]} name="count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Renewal heatmap over time */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Contract Expiry Volume Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={heatmapData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#71717a" }} angle={-45} textAnchor="end" interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#6366f1" name="Expirations" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Upcoming renewals list */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Upcoming Contract Renewals</CardTitle>
          <p className="text-[11px] text-zinc-500 mt-0.5">Sorted by urgency — contracts expiring soonest first</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left px-4 py-2 font-medium">Title</th>
                  <th className="text-left px-4 py-2 font-medium">Agency</th>
                  <th className="text-left px-4 py-2 font-medium">Supplier</th>
                  <th className="text-left px-4 py-2 font-medium">Category</th>
                  <th className="text-right px-4 py-2 font-medium">Value</th>
                  <th className="text-left px-4 py-2 font-medium">Expires</th>
                  <th className="text-left px-4 py-2 font-medium">Urgency</th>
                </tr>
              </thead>
              <tbody>
                {upcomingRenewals.slice(0, 30).map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-2 text-zinc-300 max-w-48 truncate">{r.title || "—"}</td>
                    <td className="px-4 py-2 text-zinc-400 max-w-40 truncate">{r.entity}</td>
                    <td className="px-4 py-2 text-zinc-400 max-w-32 truncate">{r.supplier || "—"}</td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-300">{r.category}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-300">{formatCurrency(r.amount, true)}</td>
                    <td className="px-4 py-2 font-mono text-zinc-500">{r.end_date}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-[10px] ${urgencyColor(r.days_remaining)}`}>
                        {r.days_remaining}d
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-zinc-800 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-56 bg-zinc-800 rounded-lg" />
        <div className="h-56 bg-zinc-800 rounded-lg" />
      </div>
      <div className="h-48 bg-zinc-800 rounded-lg" />
      <div className="h-64 bg-zinc-800 rounded-lg" />
    </div>
  );
}
