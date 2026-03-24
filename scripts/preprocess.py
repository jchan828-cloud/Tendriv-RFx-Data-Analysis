#!/usr/bin/env python3
"""
RFx Data Preprocessing Script
Reads the contract history CSV(s) and generates aggregated JSON files
for the dashboard. Run once; re-run when new data arrives.

Output: dashboard/public/data/*.json
"""

import csv
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, date
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "Data"
OUT_DIR = REPO_ROOT / "dashboard" / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Primary source — complete history (large, local only)
COMPLETE_CSV = DATA_DIR / "contractHistoryComplete-contratsOctroyesComplet.csv"
# Fallback to yearly files if complete is missing
YEARLY_FILES = sorted(DATA_DIR.glob("*-contractHistory-*.csv"))
AWARD_NOTICE = DATA_DIR / "2025-2026-awardNotice-avisAttribution.csv"

# ---------------------------------------------------------------------------
# Field name constants (English columns)
# ---------------------------------------------------------------------------
F_TITLE = "title-titre-eng"
F_REF = "referenceNumber-numeroReference"
F_AMENDMENT_NO = "amendmentNumber-numeroModification"
F_PUB_DATE = "publicationDate-datePublication"
F_AWARD_DATE = "contractAwardDate-dateAttributionContrat"
F_START_DATE = "contractStartDate-contratDateDebut"
F_END_DATE = "contractEndDate-dateFinContrat"
F_AMOUNT = "contractAmount-montantContrat"
F_TOTAL = "totalContractValue-valeurTotaleContrat"
F_CURRENCY = "contractCurrency-contratMonnaie"
F_GSIN = "gsin-nibs"
F_GSIN_DESC = "gsinDescription-nibsDescription-eng"
F_CATEGORY = "procurementCategory-categorieApprovisionnement"
F_NOTICE_TYPE = "noticeType-avisType-eng"
F_METHOD = "procurementMethod-methodeApprovisionnement-eng"
F_CRITERIA = "selectionCriteria-criteresSelection-eng"
F_TRADE = "tradeAgreements-accordsCommerciaux-eng"
F_REGIONS = "regionsOfDelivery-regionsLivraison-eng"
F_SUPPLIER_NAME = "supplierLegalName-nomLegalFournisseur-eng"
F_SUPPLIER_NORM = "supplierStandardizedName-nomNormaliseFournisseur-eng"
F_SUPPLIER_PROV = "supplierAddressProvince-fournisseurAdresseProvince-eng"
F_SUPPLIER_CITY = "supplierAddressCity-fournisseurAdresseVille-eng"
F_ENTITY = "contractingEntityName-nomEntitContractante-eng"
F_NUM_RECORDS = "numberOfRecords-nombreEnregistrements"
F_TENDER_DESC = "tenderDescription-descriptionAppelOffres-eng"

CATEGORY_LABELS = {
    "*CNST": "Construction",
    "*GD": "Goods",
    "*SRV": "Services",
    "*SRVTGD": "Services & Goods",
    "CNST": "Construction",
    "GD": "Goods",
    "SRV": "Services",
    "SRVTGD": "Services & Goods",
}

def clean_category(raw):
    raw = (raw or "").strip().lstrip("*")
    labels = {"CNST": "Construction", "GD": "Goods", "SRV": "Services", "SRVTGD": "Services & Goods"}
    return labels.get(raw, raw or "Unknown")

def safe_float(v):
    try:
        return float(str(v).replace(",", "").strip()) if v else 0.0
    except (ValueError, TypeError):
        return 0.0

def fiscal_year(date_str):
    """Convert YYYY-MM-DD to fiscal year string e.g. '2024-25'"""
    if not date_str or len(date_str) < 7:
        return "Unknown"
    try:
        y = int(date_str[:4])
        m = int(date_str[5:7])
        if m >= 4:
            return f"{y}-{str(y+1)[2:]}"
        else:
            return f"{y-1}-{str(y)[2:]}"
    except (ValueError, IndexError):
        return "Unknown"

def parse_date(s):
    if not s or len(s) < 10:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None

def normalize_entity(name):
    """Normalize known entity name variants"""
    if not name:
        return "Unknown"
    n = name.strip()
    # Consolidate PSPC variants only
    if n in ("Public Works and Government Services Canada",
             "Department of Public Works and Government Services (PSPC)",
             "Travaux publics et Services gouvernementaux Canada"):
        return "Public Works and Government Services Canada (PSPC)"
    return n

def clean_method(m):
    if not m:
        return "Unknown"
    m = m.strip()
    if "Open bidding" in m:
        return "Competitive - Open"
    if "Traditional" in m:
        return "Competitive - Traditional"
    if "Selective" in m:
        return "Competitive - Selective"
    if "Non-competitive" in m or "non-competitive" in m:
        return "Non-competitive"
    if "Advance contract" in m or "ACAN" in m:
        return "ACAN"
    return m

def value_band(amount):
    if amount < 25000:
        return "<$25K"
    elif amount < 100000:
        return "$25K–$100K"
    elif amount < 500000:
        return "$100K–$500K"
    elif amount < 2000000:
        return "$500K–$2M"
    else:
        return "$2M+"

VALUE_BAND_ORDER = ["<$25K", "$25K–$100K", "$100K–$500K", "$500K–$2M", "$2M+"]

# Award notice field mapping to contract history fields
AWARD_FIELD_MAP = {
    "awardStatus-attributionStatut-eng": "contractStatus-statutContrat-eng",
    "awardDescription-descriptionAttribution-eng": "tenderDescription-descriptionAppelOffres-eng",
}

def load_rows():
    """Load from complete CSV + all yearly files + award notices."""
    all_files = []

    # Contract history: use complete file + all yearly files (deduplicate by ref)
    if COMPLETE_CSV.exists():
        all_files.append((COMPLETE_CSV, "contract"))
    for yf in YEARLY_FILES:
        all_files.append((yf, "contract"))

    # Award notice
    if AWARD_NOTICE.exists():
        all_files.append((AWARD_NOTICE, "award"))

    if not all_files:
        print("ERROR: No CSV data files found.", file=sys.stderr)
        sys.exit(1)

    rows = []
    seen_refs = set()  # deduplicate by reference number

    for fpath, ftype in all_files:
        print(f"  Reading {fpath.name}...", flush=True)
        new_count = 0
        with open(fpath, encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ref = row.get(F_REF, "").strip()
                amend = row.get(F_AMENDMENT_NO, "0").strip()
                key = f"{ref}~{amend}"
                if key and key in seen_refs:
                    continue
                if key:
                    seen_refs.add(key)
                # Normalize award notice fields to contract history schema
                if ftype == "award":
                    for src, dst in AWARD_FIELD_MAP.items():
                        if src in row and dst not in row:
                            row[dst] = row[src]
                rows.append(row)
                new_count += 1
        print(f"    -> +{new_count:,} new rows  ({len(rows):,} total)")
    return rows

# ---------------------------------------------------------------------------
# Aggregations
# ---------------------------------------------------------------------------
def build_agency_spend(rows):
    """Total value + count per entity × fiscal year"""
    data = defaultdict(lambda: defaultdict(lambda: {"value": 0.0, "count": 0}))
    for r in rows:
        entity = normalize_entity(r.get(F_ENTITY, ""))
        fy = fiscal_year(r.get(F_AWARD_DATE) or r.get(F_PUB_DATE, ""))
        amount = safe_float(r.get(F_AMOUNT))
        if entity and fy != "Unknown":
            data[entity][fy]["value"] += amount
            data[entity][fy]["count"] += 1

    # Flatten and rank by total value
    totals = []
    for entity, years in data.items():
        total_value = sum(v["value"] for v in years.values())
        total_count = sum(v["count"] for v in years.values())
        totals.append({
            "entity": entity,
            "total_value": round(total_value, 2),
            "total_count": total_count,
            "by_year": {fy: {"value": round(v["value"], 2), "count": v["count"]}
                        for fy, v in sorted(years.items())},
        })
    totals.sort(key=lambda x: x["total_value"], reverse=True)
    return totals[:100]  # top 100 entities


def build_category_trends(rows):
    """Contract count + value by category × fiscal year"""
    data = defaultdict(lambda: defaultdict(lambda: {"value": 0.0, "count": 0}))
    for r in rows:
        cat = clean_category(r.get(F_CATEGORY, ""))
        fy = fiscal_year(r.get(F_AWARD_DATE) or r.get(F_PUB_DATE, ""))
        amount = safe_float(r.get(F_AMOUNT))
        if fy != "Unknown":
            data[cat][fy]["value"] += amount
            data[cat][fy]["count"] += 1

    result = []
    for cat, years in data.items():
        result.append({
            "category": cat,
            "by_year": {fy: {"value": round(v["value"], 2), "count": v["count"]}
                        for fy, v in sorted(years.items())},
        })
    return result


def build_procurement_methods(rows):
    """Distribution of methods and selection criteria"""
    methods = defaultdict(lambda: {"value": 0.0, "count": 0})
    criteria = defaultdict(lambda: {"value": 0.0, "count": 0})
    method_by_fy = defaultdict(lambda: defaultdict(lambda: {"value": 0.0, "count": 0}))

    for r in rows:
        m = clean_method(r.get(F_METHOD, ""))
        c = (r.get(F_CRITERIA) or "Not specified").strip() or "Not specified"
        fy = fiscal_year(r.get(F_AWARD_DATE) or r.get(F_PUB_DATE, ""))
        amount = safe_float(r.get(F_AMOUNT))

        methods[m]["value"] += amount
        methods[m]["count"] += 1
        criteria[c]["value"] += amount
        criteria[c]["count"] += 1
        if fy != "Unknown":
            method_by_fy[fy][m]["value"] += amount
            method_by_fy[fy][m]["count"] += 1

    return {
        "methods": [{"method": k, "value": round(v["value"], 2), "count": v["count"]}
                    for k, v in sorted(methods.items(), key=lambda x: -x[1]["count"])],
        "criteria": [{"criteria": k, "value": round(v["value"], 2), "count": v["count"]}
                     for k, v in sorted(criteria.items(), key=lambda x: -x[1]["count"])],
        "method_by_year": {fy: {m: {"value": round(v["value"], 2), "count": v["count"]}
                                 for m, v in methods_dict.items()}
                           for fy, methods_dict in sorted(method_by_fy.items())},
    }


def build_regional_distribution(rows):
    """Supplier province × contract value × count"""
    data = defaultdict(lambda: {"value": 0.0, "count": 0})
    province_category = defaultdict(lambda: defaultdict(lambda: {"value": 0.0, "count": 0}))

    for r in rows:
        prov = (r.get(F_SUPPLIER_PROV) or "Unknown").strip()
        # Normalize French/English duplicates
        prov_map = {"Québec": "Quebec", "Qu\ufffdebec": "Quebec", "Qu\xe9bec": "Quebec"}
        prov = prov_map.get(prov, prov) or "Unknown"
        cat = clean_category(r.get(F_CATEGORY, ""))
        amount = safe_float(r.get(F_AMOUNT))

        data[prov]["value"] += amount
        data[prov]["count"] += 1
        province_category[prov][cat]["value"] += amount
        province_category[prov][cat]["count"] += 1

    result = []
    for prov, totals in sorted(data.items(), key=lambda x: -x[1]["value"]):
        result.append({
            "province": prov,
            "value": round(totals["value"], 2),
            "count": totals["count"],
            "by_category": {cat: {"value": round(v["value"], 2), "count": v["count"]}
                            for cat, v in province_category[prov].items()},
        })
    return result


def build_renewal_windows(rows):
    """Contracts by end-date month to show renewal clustering"""
    by_month = defaultdict(lambda: {"count": 0, "value": 0.0})
    upcoming = []  # contracts ending in next 18 months
    today = date.today()

    for r in rows:
        end_str = r.get(F_END_DATE, "")
        end = parse_date(end_str)
        amount = safe_float(r.get(F_AMOUNT))
        cat = clean_category(r.get(F_CATEGORY, ""))

        if end:
            key = f"{end.year}-{end.month:02d}"
            by_month[key]["count"] += 1
            by_month[key]["value"] += amount

            # Upcoming renewals: within next 18 months
            delta = (end - today).days
            if 0 <= delta <= 548:
                upcoming.append({
                    "title": (r.get(F_TITLE) or r.get(F_GSIN_DESC) or "")[:80],
                    "entity": normalize_entity(r.get(F_ENTITY, "")),
                    "supplier": (r.get(F_SUPPLIER_NORM) or r.get(F_SUPPLIER_NAME) or "")[:60],
                    "end_date": end_str[:10],
                    "amount": round(amount, 2),
                    "category": cat,
                    "method": clean_method(r.get(F_METHOD, "")),
                    "days_remaining": delta,
                })

    upcoming.sort(key=lambda x: x["days_remaining"])

    return {
        "by_month": [{"month": k, "count": v["count"], "value": round(v["value"], 2)}
                     for k, v in sorted(by_month.items())],
        "upcoming_renewals": upcoming[:500],
    }


def build_supplier_concentration(rows):
    """Top suppliers by total awarded value"""
    data = defaultdict(lambda: {"value": 0.0, "count": 0, "agencies": set(), "categories": set()})

    for r in rows:
        sup = (r.get(F_SUPPLIER_NORM) or r.get(F_SUPPLIER_NAME) or "Unknown").strip()
        sup = sup[:80]
        amount = safe_float(r.get(F_AMOUNT))
        entity = normalize_entity(r.get(F_ENTITY, ""))
        cat = clean_category(r.get(F_CATEGORY, ""))

        data[sup]["value"] += amount
        data[sup]["count"] += 1
        data[sup]["agencies"].add(entity)
        data[sup]["categories"].add(cat)

    result = []
    for sup, v in sorted(data.items(), key=lambda x: -x[1]["value"]):
        result.append({
            "supplier": sup,
            "total_value": round(v["value"], 2),
            "win_count": v["count"],
            "agency_count": len(v["agencies"]),
            "categories": sorted(v["categories"]),
        })
    return result[:200]


def build_amendment_patterns(rows):
    """Amendment count distribution, avg value premium"""
    # Group by reference number to find amendment chains
    by_ref = defaultdict(list)
    for r in rows:
        ref = r.get(F_REF, "")
        if ref:
            by_ref[ref].append(r)

    amendment_counts = defaultdict(int)
    value_at_award = []
    total_values = []
    notice_type_amendments = defaultdict(lambda: {"total_amendments": 0, "count": 0})

    for ref, records in by_ref.items():
        n_amendments = len(records) - 1  # first record = original
        amendment_counts[n_amendments] += 1

        amounts = [safe_float(r.get(F_AMOUNT)) for r in records]
        total_vals = [safe_float(r.get(F_TOTAL)) for r in records]

        if amounts:
            value_at_award.append(amounts[0])
        if total_vals:
            total_values.append(max(total_vals))

        # Notice type from first record
        nt = (records[0].get(F_NOTICE_TYPE) or "Unknown").strip() or "Unknown"
        notice_type_amendments[nt]["total_amendments"] += n_amendments
        notice_type_amendments[nt]["count"] += 1

    # Value premium
    paired = [(a, t) for a, t in zip(value_at_award, total_values) if a > 0 and t >= a]
    avg_premium_pct = (sum((t - a) / a for a, t in paired) / len(paired) * 100) if paired else 0

    return {
        "amendment_distribution": [
            {"amendments": k, "contracts": v}
            for k, v in sorted(amendment_counts.items())
            if k <= 15
        ],
        "avg_value_premium_pct": round(avg_premium_pct, 1),
        "by_notice_type": [
            {
                "notice_type": nt,
                "avg_amendments": round(v["total_amendments"] / v["count"], 2) if v["count"] else 0,
                "contract_count": v["count"],
            }
            for nt, v in sorted(notice_type_amendments.items(), key=lambda x: -x[1]["count"])
        ],
    }


def build_value_bands(rows):
    """Contract count + value by value bucket"""
    bands = defaultdict(lambda: {"count": 0, "value": 0.0})
    bands_by_category = defaultdict(lambda: defaultdict(lambda: {"count": 0, "value": 0.0}))
    bands_by_method = defaultdict(lambda: defaultdict(lambda: {"count": 0, "value": 0.0}))

    for r in rows:
        amount = safe_float(r.get(F_AMOUNT))
        band = value_band(amount)
        cat = clean_category(r.get(F_CATEGORY, ""))
        method = clean_method(r.get(F_METHOD, ""))

        bands[band]["count"] += 1
        bands[band]["value"] += amount
        bands_by_category[band][cat]["count"] += 1
        bands_by_category[band][cat]["value"] += amount
        bands_by_method[band][method]["count"] += 1
        bands_by_method[band][method]["value"] += amount

    result = []
    for band in VALUE_BAND_ORDER:
        v = bands[band]
        result.append({
            "band": band,
            "count": v["count"],
            "value": round(v["value"], 2),
            "by_category": {cat: {"count": cv["count"], "value": round(cv["value"], 2)}
                            for cat, cv in bands_by_category[band].items()},
            "by_method": {m: {"count": mv["count"], "value": round(mv["value"], 2)}
                          for m, mv in bands_by_method[band].items()},
        })
    return result


def build_contracts_index(rows):
    """Flat list of contracts with key fields for the table"""
    contracts = []
    for r in rows:
        amount = safe_float(r.get(F_AMOUNT))
        total = safe_float(r.get(F_TOTAL))
        contracts.append({
            "ref": (r.get(F_REF) or "")[:50],
            "amendment": r.get(F_AMENDMENT_NO, "0"),
            "title": (r.get(F_TITLE) or r.get(F_GSIN_DESC) or "")[:100],
            "entity": normalize_entity(r.get(F_ENTITY, "")),
            "supplier": (r.get(F_SUPPLIER_NORM) or r.get(F_SUPPLIER_NAME) or "")[:80],
            "supplier_province": (r.get(F_SUPPLIER_PROV) or "")[:40],
            "category": clean_category(r.get(F_CATEGORY, "")),
            "gsin": (r.get(F_GSIN) or "")[:20],
            "gsin_desc": (r.get(F_GSIN_DESC) or "")[:80],
            "method": clean_method(r.get(F_METHOD, "")),
            "criteria": (r.get(F_CRITERIA) or "")[:60],
            "notice_type": (r.get(F_NOTICE_TYPE) or "")[:50],
            "award_date": (r.get(F_AWARD_DATE) or r.get(F_PUB_DATE) or "")[:10],
            "end_date": (r.get(F_END_DATE) or "")[:10],
            "amount": round(amount, 2),
            "total_value": round(total, 2),
            "fiscal_year": fiscal_year(r.get(F_AWARD_DATE) or r.get(F_PUB_DATE, "")),
        })
    # Sort by award date descending
    contracts.sort(key=lambda x: x["award_date"], reverse=True)
    return contracts


def build_metadata(rows, sources):
    dates = [r.get(F_AWARD_DATE) or r.get(F_PUB_DATE, "") for r in rows]
    dates = [d for d in dates if d and len(d) >= 10]
    return {
        "generated_at": datetime.now().isoformat(),
        "total_records": len(rows),
        "date_range": {
            "min": min(dates)[:10] if dates else None,
            "max": max(dates)[:10] if dates else None,
        },
        "sources": [str(s.name) for s in sources],
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=== RFx Dashboard Preprocessor ===")
    print(f"Output: {OUT_DIR}")

    sources = ([COMPLETE_CSV] if COMPLETE_CSV.exists() else list(YEARLY_FILES))
    if AWARD_NOTICE.exists():
        sources.append(AWARD_NOTICE)

    print("\nLoading rows...")
    rows = load_rows()
    print(f"\nTotal rows loaded: {len(rows):,}")

    steps = [
        ("agency_spend", build_agency_spend),
        ("category_trends", build_category_trends),
        ("procurement_methods", build_procurement_methods),
        ("regional_distribution", build_regional_distribution),
        ("renewal_windows", build_renewal_windows),
        ("supplier_concentration", build_supplier_concentration),
        ("amendment_patterns", build_amendment_patterns),
        ("value_bands", build_value_bands),
        ("contracts_index", build_contracts_index),
    ]

    for name, fn in steps:
        print(f"\n  Building {name}...", end=" ", flush=True)
        result = fn(rows)
        out_path = OUT_DIR / f"{name}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
        size_kb = out_path.stat().st_size / 1024
        count = len(result) if isinstance(result, list) else "dict"
        print(f"✓  {count} records  ({size_kb:.0f} KB)")

    # Metadata
    meta = build_metadata(rows, sources)
    with open(OUT_DIR / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"\n  metadata.json written")

    print("\n✅ Preprocessing complete.")
    print(f"   Files in: {OUT_DIR}")


if __name__ == "__main__":
    main()
