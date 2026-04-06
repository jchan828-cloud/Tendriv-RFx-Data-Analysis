# Data Analytics Mapping Document

## Overview
This document maps the concepts explored in the experimental Data Analytics repository to practical implementations in the Admin and Marketing repositories.

## 1. Admin Repository (Internal Project Health Dashboard)
The Admin repo is an internal tool used to monitor project health, users, customer feedback, and payments. We will adapt the UI structure (Sidebar and Panels) and data visualizations from the data analytics repo to display internal SaaS metrics.

### Concept Mapping
| Data Analytics Concept (from `preprocess.py`) | Admin Repo Equivalent | Description |
| :--- | :--- | :--- |
| `build_agency_spend` (Spend by Agency) | **Revenue by Plan/Cohort** | MRR breakdown, spend per customer segment, or revenue by pricing tier. |
| `build_category_trends` (Trends over time) | **User Growth & Activity Trends** | Signups, active users (DAU/MAU), and feature usage over time. |
| `build_renewal_windows` (Upcoming contract renewals) | **Subscription Renewals & Churn Risk** | Upcoming subscription renewals, expiring credit cards, churn risk indicators. |
| `build_supplier_concentration` (Top Suppliers) | **Power Users & Top Customers** | Users with highest engagement, highest LTV, or most API usage. |
| `build_amendment_patterns` (Contract changes) | **Plan Upgrades/Downgrades** | Tracking how users change their subscription tiers over time (Expansion MRR). |
| `build_value_bands` (Spend distribution) | **Customer Lifetime Value (LTV) Bands** | Grouping customers by total revenue generated. |

### Architecture Adaptation
*   **Data Source:** Instead of reading static JSON files generated from CSVs, the Admin dashboard will query the production database (e.g., PostgreSQL via Supabase or Prisma) via Next.js API routes.
*   **UI Components:** We will reuse the Recharts components (`BarChart`, `PieChart`, etc.) and the `Sidebar`/`Panel` layout from the analytics dashboard.
*   **Panels:**
    *   `OverviewPanel`: High-level metrics (MRR, Total Users, Active Users).
    *   `UsersPanel`: User growth, power users, churn metrics.
    *   `PaymentsPanel`: Revenue bands, upgrades/downgrades, upcoming renewals.
    *   `SystemHealthPanel`: API usage, error rates, feedback metrics.

## 2. Marketing Repository (Public Content Generation)
The Marketing repo generates public-facing blog content to entice signups. It currently pulls limited data. We need to formalize how it integrates with the production "Scout" function.

### Concept Mapping
| Data Analytics Concept | Marketing Repo Equivalent | Description |
| :--- | :--- | :--- |
| High-level aggregated stats | **Industry Insights/Teasers** | Use aggregated data (e.g., "Top 5 growing procurement categories") as hooks for blog posts. |
| Specific contract details | **Case Studies/Examples (Anonymized or Public)** | Highlighting interesting trends using specific, sanitized data points. |

### Integration with "Scout" Function
*   **The "Scout" Function:** A secure, read-only internal API or serverless function connected to the production database.
*   **Data Access Strategy:**
    *   **Principle of Least Privilege:** The Marketing repo should *never* have direct database access.
    *   **Aggregated Data Only:** The Scout function should return pre-aggregated metrics (e.g., counts, averages) rather than raw user or transaction records.
    *   **No PII:** Absolutely no Personally Identifiable Information (names, emails, specific un-anonymized transaction details) should be exposed to the Marketing repo.
*   **Implementation Flow:**
    1.  Marketing Next.js app calls the Scout function endpoint (e.g., `GET /api/scout/market-trends`) with a secure API key.
    2.  Scout function queries the production DB, aggregates the data, and returns a JSON payload.
    3.  Marketing app uses this payload to dynamically generate or hydrate static pages (e.g., via Next.js `getStaticProps` or React Server Components).


## 3. Designing the Admin Analytics Architecture

### Backend Changes (Admin Repo)
We will transition the data processing logic from the static Python script (`preprocess.py`) to dynamic API routes (Next.js App Router).

#### API Routes
Create a set of secure API routes in `app/api/admin/metrics/route.ts` (or similar structure) to handle requests from the dashboard panels.

*   `GET /api/admin/metrics/overview`: Returns high-level MRR, total users, active users, and recent signups.
*   `GET /api/admin/metrics/users`: Returns user growth trends, engagement distribution (power users), and churn data.
*   `GET /api/admin/metrics/payments`: Returns revenue bands, MRR changes (upgrades/downgrades), and upcoming renewals.
*   `GET /api/admin/metrics/health`: Returns API usage stats, error rates, and system uptime.

#### Database Queries
These API routes will query the production database (e.g., PostgreSQL). We'll map the complex Python data aggregation to SQL queries or ORM (e.g., Prisma) functions.

*   **Example (Python `build_value_bands` to SQL):**
    ```sql
    SELECT
      CASE
        WHEN mrr >= 1000 THEN 'Enterprise'
        WHEN mrr >= 100 THEN 'Pro'
        ELSE 'Starter'
      END as plan_tier,
      COUNT(*) as user_count,
      SUM(mrr) as total_mrr
    FROM users
    WHERE status = 'active'
    GROUP BY plan_tier;
    ```
*   **Example (Python `build_category_trends` to SQL):**
    ```sql
    SELECT
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as new_users
    FROM users
    GROUP BY month
    ORDER BY month;
    ```

### Frontend Changes (Admin Repo)
Adapt the UI components from the `dashboard` repository.

#### Directory Structure Integration
```text
admin-repo/
├── app/
│   ├── (dashboard)/            # Group layout for dashboard
│   │   ├── admin/
│   │   │   ├── page.tsx        # Main dashboard container
│   │   │   └── layout.tsx      # Sidebar layout wrapper
│   ├── api/
│   │   ├── admin/              # Secured API routes for dashboard data
│   │   │   └── metrics/
│   │   │       └── route.ts
├── components/
│   ├── admin/                  # Adapted dashboard components
│   │   ├── Sidebar.tsx         # Updated navigation items
│   │   ├── panels/
│   │   │   ├── OverviewPanel.tsx
│   │   │   ├── UsersPanel.tsx
│   │   │   ├── PaymentsPanel.tsx
│   │   │   └── SystemHealthPanel.tsx
│   │   └── ui/                 # Existing shadcn/ui components (cards, charts)
├── lib/
│   └── admin-api.ts            # Client-side fetching logic
```

#### Component Adaptation (`Sidebar.tsx`)
Update the `NAV_ITEMS` to reflect Admin contexts:
```tsx
const NAV_ITEMS = [
  { id: "overview", label: "Project Overview", icon: BarChart3, description: "High-level metrics" },
  { id: "users", label: "User Health", icon: Users, description: "Growth & Engagement" },
  { id: "payments", label: "Payments & Revenue", icon: DollarSign, description: "MRR & Subscriptions" },
  { id: "health", label: "System Health", icon: Activity, description: "Errors & Usage" },
];
```

#### Component Adaptation (`OverviewPanel.tsx` Example)
Instead of static JSON fetching (`loadAgencySpend`), use React Query or SWR to fetch data from the new `/api/admin/metrics/overview` endpoint. The `StatCard` and `Recharts` components can be reused directly to display the new metrics (e.g., MRR instead of Contract Value).

## 4. Designing the Marketing API Integration ("Scout" Function)

### Purpose
The Marketing repo generates blog posts, SEO pages, and promotional material using real-world data from the application to demonstrate value and attract users.

### The "Scout" Function
The "Scout" function acts as a read-only, heavily restricted gateway between the production database and the public-facing Marketing site. It should only expose aggregated, non-sensitive data ("interest pool" data) necessary for content generation.

#### Architecture
The Scout function can be implemented as:
1.  **A dedicated Next.js API route in the Admin repo:** Since the Admin repo already connects to the production DB, it can host a `/api/scout/...` endpoint secured by an API key that the Marketing repo provides.
2.  **A standalone Serverless Function (Vercel/AWS Lambda):** A lightweight function that queries a read replica of the production DB.

**Recommendation:** A dedicated, secured API route within the Admin repository (or whichever service acts as the central API gateway) is the simplest and most robust approach.

#### Endpoints
The Scout function should expose specific endpoints tailored to the Marketing team's needs.

*   `GET /api/scout/industry-trends`: Returns aggregated data on the most popular features, highest-growth user segments, or general usage trends.
    *   **Response format:** `[ { "industry": "Technology", "growth_rate": 0.15, "top_feature": "API Access" }, ... ]`
*   `GET /api/scout/anonymized-case-studies`: Returns heavily sanitized examples of successful use cases (e.g., "A mid-sized company increased efficiency by 20% using feature X").
    *   **Response format:** `[ { "company_size": "50-200", "industry": "Retail", "metric_improved": "efficiency", "improvement_pct": 20 } ]`

#### Security and Data Privacy
*   **Authentication:** The endpoint must require a valid API key (e.g., passed in the `Authorization` header) that is only known to the Marketing repo's backend.
*   **Rate Limiting:** Implement strict rate limiting to prevent abuse or accidental overload of the production DB.
*   **Data Masking:** Ensure all returned data is aggregated (counts, averages, sums) or thoroughly anonymized. No emails, names, exact revenue figures, or proprietary IDs should be exposed.

#### Marketing Repo Integration
The Marketing Next.js application will call the Scout function during its build process (`getStaticProps`) or Server-Side Rendering (`getServerSideProps`/RSC) to generate dynamic content.

```tsx
// Example Marketing Repo Server Component (app/blog/trends/page.tsx)
import { Suspense } from 'react';

async function fetchTrends() {
  const res = await fetch('https://admin.yourdomain.com/api/scout/industry-trends', {
    headers: {
      Authorization: `Bearer ${process.env.SCOUT_API_KEY}`,
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

export default async function TrendsPage() {
  const trends = await fetchTrends();

  return (
    <main>
      <h1>Latest Industry Trends</h1>
      {/* Map over trends and render charts or content */}
    </main>
  );
}
```

## Summary Action Plan

1.  **Admin Repo Setup:** Migrate the `dashboard/components` (Sidebar, Panels, Recharts) into the Admin repo's `app/(dashboard)` directory.
2.  **Admin API Development:** Create the `/api/admin/metrics/*` endpoints, replacing the Python CSV parsing with direct database queries.
3.  **Scout Function Development:** Create the highly restricted `/api/scout/*` endpoints in the Admin repo (or standalone function) for the Marketing repo.
4.  **Marketing Integration:** Update the Marketing repo to fetch data from the new Scout endpoints using a secure API key, removing any legacy direct database access or manual data pulls.
