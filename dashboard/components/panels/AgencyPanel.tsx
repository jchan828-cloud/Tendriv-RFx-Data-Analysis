"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { loadAgencySpend, loadProcurementMethods, loadSupplierConcentration, formatCurrency, CATEGORY_COLORS, METHOD_COLORS, ALL_FISCAL_YEARS } from "@/lib/data";
import type { AgencySpend, ProcurementMethods, SupplierConcentration, Contract } from "@/lib/types";

const TOOLTIP_STYLE = {
  backgroundColor: "#18181b", border: "1px solid #3f3f46",
  borderRadius: "6px", fontSize: "11px", color: "#e4e4e7",
};

export function AgencyPanel() {
  const [agencies, setAgencies] = useState<AgencySpend[]>([]);
  const [methods, setMethods] = useState<ProcurementMethods | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierConcentration[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    Promise.all([loadAgencySpend(), loadProcurementMethods(), loadSupplierConcentration()])
      .then(([a, m, s]) => {
        setAgencies(a);
        setMethods(m);
        setSuppliers(s);
        if (a.length > 0) setSelectedEntity(a[0].entity);
      });
  }, []);

  useEffect(() => {
    if (!selectedEntity) return;
    setContractsLoading(true);
    setPage(1);
    fetch(`/api/contracts?entity=${encodeURIComponent(selectedEntity)}&page=1&page_size=20`)
      .then((r) => r.json())
      .then((d) => { setContracts(d.contracts); setTotal(d.total); setContractsLoading(false); });
  }, [selectedEntity]);

  const loadPage = (p: number) => {
    setContractsLoading(true);
    fetch(`/api/contracts?entity=${encodeURIComponent(selectedEntity)}&page=${p}&page_size=20`)
      .then((r) => r.json())
      .then((d) => { setContracts(d.contracts); setPage(p); setContractsLoading(false); });
  };

  const agency = useMemo(() => agencies.find((a) => a.entity === selectedEntity), [agencies, selectedEntity]);

  // Spend over time
  const spendData = useMemo(() => {
    if (!agency) return [];
    return ALL_FISCAL_YEARS
      .filter((fy) => agency.by_year[fy])
      .map((fy) => ({
        fy,
        value: Math.round((agency.by_year[fy]?.value ?? 0) / 1e6),
        count: agency.by_year[fy]?.count ?? 0,
      }));
  }, [agency]);

  // Method breakdown for this entity — from global method_by_year
  const methodData = useMemo(() => {
    if (!methods) return [];
    const byMethod: Record<string, number> = {};
    Object.values(methods.method_by_year).forEach((yearMethods) => {
      Object.entries(yearMethods).forEach(([m, v]) => {
        byMethod[m] = (byMethod[m] ?? 0) + v.count;
      });
    });
    return Object.entries(byMethod)
      .filter(([m]) => m !== "Unknown")
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [methods]);

  // Top suppliers at this agency
  const agencySuppliers = useMemo(() => {
    if (!selectedEntity) return [];
    return suppliers
      .filter((s) => s.categories.length > 0)
      .slice(0, 10);
  }, [suppliers, selectedEntity]);

  if (agencies.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      {/* Agency selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400 shrink-0">Select Agency:</span>
        <Select value={selectedEntity} onValueChange={(v) => v && setSelectedEntity(v)}>
          <SelectTrigger className="w-96 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
            <SelectValue placeholder="Choose an agency..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700 max-h-72">
            {agencies.slice(0, 85).map((a) => (
              <SelectItem key={a.entity} value={a.entity} className="text-zinc-300 text-xs">
                {a.entity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {agency && (
          <div className="flex gap-2 ml-2">
            <Badge variant="outline" className="text-indigo-300 border-indigo-500/40 text-[11px]">
              {formatCurrency(agency.total_value, true)} total
            </Badge>
            <Badge variant="outline" className="text-zinc-400 border-zinc-600 text-[11px]">
              {agency.total_count.toLocaleString()} contracts
            </Badge>
          </div>
        )}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Annual Spend at Agency ($M + Contract Count)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={spendData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="fy" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot name="Value $M" />
                <Line yAxisId="right" type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot name="# Contracts" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Procurement Method Distribution (All Agencies)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={methodData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" name="Contracts" radius={[0, 3, 3, 0]}>
                  {methodData.map((entry) => (
                    <rect key={entry.name} fill={METHOD_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top suppliers */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Top Suppliers (All Agencies)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={agencySuppliers.map(s => ({ name: s.supplier.slice(0, 30), value: Math.round(s.total_value / 1e6), wins: s.win_count }))} layout="vertical" margin={{ top: 2, right: 16, left: 8, bottom: 2 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
              <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 10, fill: "#a1a1aa" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [name === "value" ? `$${Number(v)}M` : v, name === "value" ? "Total Value" : "Wins"]} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]} name="value" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Contract table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm text-zinc-300">
            Contracts at {selectedEntity ? selectedEntity.slice(0, 50) : "Agency"}
            <span className="ml-2 text-zinc-500 font-normal">({total.toLocaleString()} total)</span>
          </CardTitle>
          <div className="flex gap-2">
            <button onClick={() => page > 1 && loadPage(page - 1)} disabled={page <= 1} className="text-xs text-zinc-400 hover:text-zinc-100 disabled:opacity-30 px-2 py-1 bg-zinc-800 rounded">← Prev</button>
            <span className="text-xs text-zinc-500 px-2 py-1">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => page < Math.ceil(total / 20) && loadPage(page + 1)} disabled={page >= Math.ceil(total / 20)} className="text-xs text-zinc-400 hover:text-zinc-100 disabled:opacity-30 px-2 py-1 bg-zinc-800 rounded">Next →</button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ContractTable contracts={contracts} loading={contractsLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

function ContractTable({ contracts, loading }: { contracts: Contract[]; loading: boolean }) {
  if (loading) return <div className="py-8 text-center text-xs text-zinc-500 animate-pulse">Loading contracts…</div>;
  if (contracts.length === 0) return <div className="py-8 text-center text-xs text-zinc-500">No contracts found</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500">
            <th className="text-left px-4 py-2 font-medium">Title</th>
            <th className="text-left px-4 py-2 font-medium">Supplier</th>
            <th className="text-left px-4 py-2 font-medium">Category</th>
            <th className="text-left px-4 py-2 font-medium">Method</th>
            <th className="text-right px-4 py-2 font-medium">Amount</th>
            <th className="text-left px-4 py-2 font-medium">Award Date</th>
            <th className="text-left px-4 py-2 font-medium">End Date</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c, i) => (
            <tr key={`${c.ref}-${i}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-2 text-zinc-300 max-w-48 truncate">{c.title || c.gsin_desc || "—"}</td>
              <td className="px-4 py-2 text-zinc-400 max-w-36 truncate">{c.supplier || "—"}</td>
              <td className="px-4 py-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-300">{c.category}</span>
              </td>
              <td className="px-4 py-2 text-zinc-400 max-w-32 truncate">{c.method}</td>
              <td className="px-4 py-2 text-right font-mono text-zinc-300">{formatCurrency(c.amount, true)}</td>
              <td className="px-4 py-2 font-mono text-zinc-500">{c.award_date?.slice(0, 10) || "—"}</td>
              <td className="px-4 py-2 font-mono text-zinc-500">{c.end_date?.slice(0, 10) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-96 bg-zinc-800 rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-56 bg-zinc-800 rounded-lg" />
        <div className="h-56 bg-zinc-800 rounded-lg" />
      </div>
      <div className="h-48 bg-zinc-800 rounded-lg" />
      <div className="h-64 bg-zinc-800 rounded-lg" />
    </div>
  );
}
