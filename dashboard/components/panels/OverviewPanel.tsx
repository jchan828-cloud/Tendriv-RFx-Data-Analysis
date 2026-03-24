"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadAgencySpend, loadCategoryTrends, loadProcurementMethods, loadValueBands,
  formatCurrency, formatNumber, CATEGORY_COLORS, METHOD_COLORS, ALL_FISCAL_YEARS,
} from "@/lib/data";
import type { AgencySpend, CategoryTrend, ProcurementMethods, ValueBand } from "@/lib/types";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "6px",
  fontSize: "11px",
  color: "#e4e4e7",
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-5 pb-4">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-semibold font-mono text-zinc-100 mt-1">{value}</p>
        {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function OverviewPanel() {
  const [agencies, setAgencies] = useState<AgencySpend[]>([]);
  const [categories, setCategories] = useState<CategoryTrend[]>([]);
  const [methods, setMethods] = useState<ProcurementMethods | null>(null);
  const [bands, setBands] = useState<ValueBand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadAgencySpend(),
      loadCategoryTrends(),
      loadProcurementMethods(),
      loadValueBands(),
    ]).then(([a, c, m, b]) => {
      setAgencies(a);
      setCategories(c);
      setMethods(m);
      setBands(b);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSkeleton />;

  const totalValue = agencies.reduce((s, a) => s + a.total_value, 0);
  const totalContracts = agencies.reduce((s, a) => s + a.total_count, 0);
  const uniqueAgencies = agencies.length;

  // Median contract value
  const allAmounts = agencies.flatMap((a) =>
    Object.values(a.by_year).map((y) => (y.count > 0 ? y.value / y.count : 0))
  ).filter((v) => v > 0).sort((a, b) => a - b);
  const median = allAmounts[Math.floor(allAmounts.length / 2)] ?? 0;

  // Annual spend trend (category stacked bar)
  const fySet = new Set<string>();
  categories.forEach((c) => Object.keys(c.by_year).forEach((fy) => fySet.add(fy)));
  const fiscalYears = [...fySet].filter((fy) => ALL_FISCAL_YEARS.includes(fy)).sort();

  const annualData = fiscalYears.map((fy) => {
    const row: Record<string, string | number> = { fy };
    categories.forEach((c) => {
      row[c.category] = Math.round((c.by_year[fy]?.value ?? 0) / 1e6);
    });
    return row;
  });

  const categoryNames = categories.map((c) => c.category).filter((c) => c !== "Unknown");

  // Method donut
  const methodData = (methods?.methods ?? [])
    .filter((m) => m.method !== "Unknown" && m.count > 0)
    .map((m) => ({ name: m.method, value: m.count }));

  // Criteria horizontal bar
  const criteriaData = (methods?.criteria ?? [])
    .filter((c) => c.criteria && c.criteria !== "Not specified" && c.count > 10)
    .slice(0, 8)
    .map((c) => ({
      name: c.criteria.length > 40 ? c.criteria.slice(0, 40) + "…" : c.criteria,
      count: c.count,
    }));

  // Value band chart
  const bandData = bands.map((b) => ({
    name: b.band,
    count: b.count,
    value: Math.round(b.value / 1e6),
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Awarded Value" value={formatCurrency(totalValue, true)} sub="All fiscal years" />
        <StatCard label="Total Contracts" value={formatNumber(totalContracts)} sub="Unique records" />
        <StatCard label="Contracting Entities" value={formatNumber(uniqueAgencies)} sub="Unique agencies" />
        <StatCard label="Median Contract" value={formatCurrency(median, true)} sub="Per entity/year" />
      </div>

      {/* Row 2: Annual trend + Method mix */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Annual Spend by Category ($M)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={annualData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="fy" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`$${Number(v)}M`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {categoryNames.map((cat) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] ?? "#6b7280"} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Procurement Method Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={methodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={({ percent }: { percent?: number }) =>
                    (percent ?? 0) > 0.04 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                  }
                  labelLine={false}
                >
                  {methodData.map((entry) => (
                    <Cell key={entry.name} fill={METHOD_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), "Contracts"]} />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => String(value).replace("Competitive - ", "")}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Selection criteria + Value bands */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Selection Criteria Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={criteriaData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Contract Value Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bandData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar yAxisId="left" dataKey="count" fill="#22d3ee" name="Count" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="right" dataKey="value" fill="#f59e0b" name="Value $M" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-zinc-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 rounded-lg bg-zinc-800" />
        <div className="h-64 rounded-lg bg-zinc-800" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 rounded-lg bg-zinc-800" />
        <div className="h-64 rounded-lg bg-zinc-800" />
      </div>
    </div>
  );
}
