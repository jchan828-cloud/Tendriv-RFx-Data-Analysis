import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import type { Contract } from "@/lib/types";

// Load and cache in module scope (persists across requests in dev/prod)
let _contracts: Contract[] | null = null;

function getContracts(): Contract[] {
  if (_contracts) return _contracts;
  const filePath = join(process.cwd(), "public", "data", "contracts_index.json");
  const raw = readFileSync(filePath, "utf-8");
  _contracts = JSON.parse(raw) as Contract[];
  return _contracts;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("page_size") ?? "50", 10), 200);
  const entity = searchParams.get("entity") ?? "";
  const category = searchParams.get("category") ?? "";
  const method = searchParams.get("method") ?? "";
  const fy = searchParams.get("fiscal_year") ?? "";
  const search = (searchParams.get("search") ?? "").toLowerCase();
  const province = searchParams.get("province") ?? "";

  let contracts = getContracts();

  // Filter
  if (entity) contracts = contracts.filter((c) => c.entity === entity);
  if (category) contracts = contracts.filter((c) => c.category === category);
  if (method) contracts = contracts.filter((c) => c.method === method);
  if (fy) contracts = contracts.filter((c) => c.fiscal_year === fy);
  if (province) contracts = contracts.filter((c) => c.supplier_province === province);
  if (search) {
    contracts = contracts.filter(
      (c) =>
        c.title.toLowerCase().includes(search) ||
        c.supplier.toLowerCase().includes(search) ||
        c.entity.toLowerCase().includes(search) ||
        c.gsin_desc.toLowerCase().includes(search)
    );
  }

  const total = contracts.length;
  const start = (page - 1) * pageSize;
  const paginated = contracts.slice(start, start + pageSize);

  return NextResponse.json({
    contracts: paginated,
    total,
    page,
    page_size: pageSize,
  });
}
