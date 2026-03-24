import type {
  AgencySpend,
  CategoryTrend,
  ProcurementMethods,
  RegionalDistribution,
  RenewalWindows,
  SupplierConcentration,
  AmendmentPatterns,
  ValueBand,
  Metadata,
} from "./types";

const DATA_BASE = process.env.NEXT_PUBLIC_DATA_BASE ?? "";

async function loadJson<T>(file: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}/data/${file}`);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadAgencySpend = () => loadJson<AgencySpend[]>("agency_spend.json");
export const loadCategoryTrends = () => loadJson<CategoryTrend[]>("category_trends.json");
export const loadProcurementMethods = () => loadJson<ProcurementMethods>("procurement_methods.json");
export const loadRegionalDistribution = () => loadJson<RegionalDistribution[]>("regional_distribution.json");
export const loadRenewalWindows = () => loadJson<RenewalWindows>("renewal_windows.json");
export const loadSupplierConcentration = () => loadJson<SupplierConcentration[]>("supplier_concentration.json");
export const loadAmendmentPatterns = () => loadJson<AmendmentPatterns>("amendment_patterns.json");
export const loadValueBands = () => loadJson<ValueBand[]>("value_bands.json");
export const loadMetadata = () => loadJson<Metadata>("metadata.json");

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-CA").format(value);
}

export const CATEGORY_COLORS: Record<string, string> = {
  Services: "#6366f1",
  Goods: "#22d3ee",
  Construction: "#f59e0b",
  "Services & Goods": "#a78bfa",
  Unknown: "#6b7280",
};

export const METHOD_COLORS: Record<string, string> = {
  "Competitive - Open": "#22d3ee",
  "Competitive - Traditional": "#6366f1",
  "Competitive - Selective": "#a78bfa",
  "Non-competitive": "#f87171",
  ACAN: "#fb923c",
  Unknown: "#6b7280",
};

export const ALL_FISCAL_YEARS = ["2022-23", "2023-24", "2024-25", "2025-26"];
