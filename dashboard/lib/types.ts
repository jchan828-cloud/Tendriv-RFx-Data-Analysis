// Shared types for all dashboard data

export interface AgencySpend {
  entity: string;
  total_value: number;
  total_count: number;
  by_year: Record<string, { value: number; count: number }>;
}

export interface CategoryTrend {
  category: string;
  by_year: Record<string, { value: number; count: number }>;
}

export interface ProcurementMethods {
  methods: { method: string; value: number; count: number }[];
  criteria: { criteria: string; value: number; count: number }[];
  method_by_year: Record<string, Record<string, { value: number; count: number }>>;
}

export interface RegionalDistribution {
  province: string;
  value: number;
  count: number;
  by_category: Record<string, { value: number; count: number }>;
}

export interface RenewalWindows {
  by_month: { month: string; count: number; value: number }[];
  upcoming_renewals: {
    title: string;
    entity: string;
    supplier: string;
    end_date: string;
    amount: number;
    category: string;
    method: string;
    days_remaining: number;
  }[];
}

export interface SupplierConcentration {
  supplier: string;
  total_value: number;
  win_count: number;
  agency_count: number;
  categories: string[];
}

export interface AmendmentPatterns {
  amendment_distribution: { amendments: number; contracts: number }[];
  avg_value_premium_pct: number;
  by_notice_type: { notice_type: string; avg_amendments: number; contract_count: number }[];
}

export interface ValueBand {
  band: string;
  count: number;
  value: number;
  by_category: Record<string, { count: number; value: number }>;
  by_method: Record<string, { count: number; value: number }>;
}

export interface Contract {
  ref: string;
  amendment: string;
  title: string;
  entity: string;
  supplier: string;
  supplier_province: string;
  category: string;
  gsin: string;
  gsin_desc: string;
  method: string;
  criteria: string;
  notice_type: string;
  award_date: string;
  end_date: string;
  amount: number;
  total_value: number;
  fiscal_year: string;
}

export interface Metadata {
  generated_at: string;
  total_records: number;
  date_range: { min: string | null; max: string | null };
  sources: string[];
}

export interface ContractsApiResponse {
  contracts: Contract[];
  total: number;
  page: number;
  page_size: number;
}
