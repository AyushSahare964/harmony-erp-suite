:::: page {margins=1in size=a4}
::: footer {text-align=center}
[@page]
:::

# Reports & Analytics Consolidation {#reports-analytics-consolidation .title}

[Harmony ERP (VetOS) · Implementation Plan · Prepared for Guildify · September 9, 2026]{.muted}

## 1\. Objective {#1-objective}

Convert the existing `/m/reports` page — currently a **Clinical Reports & Medical Records** archive — into the **single centralized analytics hub** for the whole ERP, without touching the underlying Appointments, Billing, Inventory, Laboratory, or Clinical workflows. The analytics layer is a **read/aggregation layer**\: it queries existing records, computes KPIs and charts on the fly, and never becomes a second source of truth.

[No repo access was available while drafting this plan, so every data\-source reference below is an assumption inferred from the live pages (`/m/reports`, `/m/appointments`, `/m/billing`, `/m/inventory`). Section 3 lists exactly what must be verified against the real schema before Phase 1 starts.]{.muted}

## 2\. Non\-Negotiable Guardrails {#2-non-negotiable-guardrails}

- No duplicate tables for appointments, billing, inventory, or clinical data — analytics reads existing records only.
- No changes to existing workflows, statuses, or permissions in Appointments, Queue, Billing, Pharmacy, Inventory, Boarding, Swimming, or Accounting.
- Existing Clinical Reports & Medical Records functionality (archive, verification, doctor review, external uploads) stays fully intact and reachable.
- All KPIs, charts, and insight text are computed dynamically from live data — nothing hard\-coded.
- Empty states say "No data available for the selected period," never a misleading `₹0` or `100%`.
- Every analytics view respects the viewer's existing role/permissions; no new exposure of financial, patient, or medical data.

## 3\. Pre\-Implementation Discovery (Phase 0) {#3-pre-implementation-discovery-phase-0}

Before writing any analytics code, spend a short, time\-boxed pass confirming the real shape of the data. This de\-risks every later phase.

| Check | Why it matters |
| --- | --- |
| Entity\-relationship map for Pet, Client, Appointment, Invoice, Payment, LabTest, InventoryItem, StockMovement, ClinicalReport | Confirms foreign keys (e.g., does `Invoice` link to `Appointment`, or only to `Client`?) so cross\-module joins in §8.9 are actually possible |
| Existing API routes/services that already compute stats (Appointments' "today's count," Billing's "outstanding," Inventory's "low stock") | These are your first aggregation functions to reuse, not reimplement |
| Field names for status enums (appointment status, invoice status, test status) | Charts in §8 group by these values — wrong enum values silently produce empty charts |
| Existing pagination/query helpers on the backend | Determines whether new analytics endpoints can share infrastructure or need their own |
| Current auth/permission middleware shape | Determines how §11 (permissions) hooks into the new endpoints |
| Timezone handling in existing date fields | The global date\-range filter (§5) must bucket "Today"/"This Month" consistently with how other modules already do it |

Output of Phase 0: a one\-page data\-source map (entity → fields → existing endpoint, or "needs new query") that Phases 2–7 are written against.

## 4\. Proposed Architecture {#4-proposed-architecture}

```text
Existing ERP Data (Pets, Clients, Appointments, Billing,
Payments, Laboratory, Inventory, Clinical Records)
                    │
                    ▼
     Analytics Aggregation Layer (new, read-only)
     ─ per-module query/aggregation functions
     ─ shared date-range + filter resolver
     ─ insight-rule evaluator
                    │
                    ▼
       Reports & Analytics API (new endpoints,
       namespaced e.g. /api/analytics/*)
                    │
                    ▼
     Reports & Analytics Frontend (/m/reports)
     ┌───────────────┬────────────────────────┐
     ▼                                         ▼
Analytics Dashboard                 Medical Reports & Records
(Overview + module tabs)            (existing functionality, unchanged)
```

Key architectural decision: analytics endpoints are **additive** (new routes under an `/analytics` namespace), so nothing already calling the existing Appointments/Billing/Inventory endpoints is affected.

## 5\. Information Architecture {#5-information-architecture}

Replace the current single\-purpose `/m/reports` page with two top\-level tabs on the same route, preserving the existing clinical functionality as a sibling rather than a replacement:

```text
Reports & Analytics
├── Analytics Dashboard   (new)
│   ├── Overview
│   ├── Pet Analytics
│   ├── Client Analytics
│   ├── Appointment Analytics
│   ├── Billing & Revenue
│   ├── Payment Analysis
│   ├── Laboratory Analytics
│   ├── Inventory Analytics
│   ├── Product & Sales Analytics
│   └── Clinical Analytics
└── Medical Reports & Records   (existing — moved, not rebuilt)
    ├── All Reports
    ├── Patient Dossiers
    └── External Reports
```

The existing stat cards and table on `/m/reports` (Total Clinical Reports, Verified & Signed, Pending Doctor Review, External Uploads, and the report table) become the content of the **Medical Reports & Records** tab, unmodified. The **Clinical Analytics** tab under Analytics Dashboard is a separate, new view that re\-slices the same clinical\-report data by category/doctor/date (§8.9).

## 6\. Global Filter Bar {#6-global-filter-bar}

A single filter bar sits above the Analytics Dashboard tabs (not above Medical Reports & Records, which keeps its own existing filters) and drives every chart/KPI beneath it.

**Always present:** Date Range (Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, This Year, Custom, All Time), Apply, Reset.

**Contextual, shown only on the relevant tab:** Doctor, Pet, Client, Appointment Type, Appointment Category, Payment Status, Payment Method, Lab Test, Inventory Category, Product, Service.

Implementation note: resolve the date range to a `{startDate, endDate}` pair in one shared utility function used by every analytics query, so "This Month" means the same thing on the Billing tab as on the Appointment tab.

## 7\. Delivery Phases {#7-delivery-phases}

| Phase | Scope | Depends on |
| --- | --- | --- |
| 0 | Discovery — data\-source map (§3) | — |
| 1 | Aggregation layer \+ shared date/filter resolver \+ analytics API skeleton | Phase 0 |
| 2 | Frontend shell: two\-tab `/m/reports`, move existing clinical UI under "Medical Reports & Records" unchanged | Phase 0 |
| 3 | Overview tab (cross\-module KPI cards, §8.1) | Phase 1, 2 |
| 4 | Pet, Client, Appointment analytics tabs (§8.2–8.4) | Phase 1, 2 |
| 5 | Billing, Payment Analysis, Laboratory, Inventory, Product & Sales tabs (§8.5–8.8) | Phase 1, 2 |
| 6 | Clinical Analytics tab \+ cross\-module drill\-downs (§8.9, §9) | Phase 1–5 |
| 7 | Insights engine, export, drill\-down interactivity (§10–12) | Phase 3–6 |
| 8 | Performance pass, permission audit, empty\-state polish, QA (§13–15) | All above |

Recommended order within Phase 4–6 mirrors data availability confirmed in Phase 0 — build the tab backed by the cleanest existing data first (typically Appointments and Billing) to validate the aggregation pattern before repeating it for Laboratory and Inventory.

## 8\. Module\-by\-Module Analytics Spec {#8-module-by-module-analytics-spec}

Each subsection lists the KPI/chart, its likely existing data source (to confirm in Phase 0), and the chart type. Treat the "Source" column as a hypothesis, not a schema fact.

### 8\.1 Overview (Executive Dashboard) {#81-overview-executive-dashboard}

| KPI group | Metrics | Chart/format |
| --- | --- | --- |
| Pets | Total, new, returning, active, sex split, species split | Stat cards \+ 2 small donuts |
| Clients | Total, new, returning, active, with outstanding balance | Stat cards |
| Appointments | Total, completed, cancelled, no\-show, pending, avg wait, today's count | Stat cards |
| Financial | Total revenue, invoiced, collected, outstanding, invoice count, avg invoice | Stat cards |
| Laboratory | Total/completed/pending/cancelled tests, lab revenue | Stat cards |
| Inventory | Total value, low\-stock, out\-of\-stock, expiring, expired | Stat cards |

### 8\.2 Pet Analytics {#82-pet-analytics}

| Metric | Source (to verify) | Chart |
| --- | --- | --- |
| Total / new / returning / active pets | Pet records \+ first/last visit dates | Stat cards |
| Species distribution | Pet.species | Donut |
| Breed distribution (top N) | Pet.breed | Horizontal bar |
| Age bands (0–1, 1–3, 3–7, 7–10, 10\+) | Pet.dateOfBirth | Bar |
| New vs returning trend | Pet.createdAt vs appointment history | Line/bar over time |
| Visit\-frequency cohorts (1, 2–3, 4–6, 7\+ visits) | Appointment count grouped by Pet | Bar |

### 8\.3 Client Analytics {#83-client-analytics}

| Metric | Source | Chart |
| --- | --- | --- |
| Total / new / returning / active clients | Client records \+ visit history | Stat cards |
| Acquisition trend (daily/weekly/monthly) | Client.createdAt | Line |
| Retention cohort (first\-time vs returning vs inactive) | Appointment history per client | Stacked bar |
| Top clients by visits / by spend | Appointment count \+ Invoice sum per client | Ranked table (mask contact details per §11) |

### 8\.4 Appointment Analytics {#84-appointment-analytics}

| Metric | Source | Chart |
| --- | --- | --- |
| Total / completed / waiting / scheduled / cancelled / no\-show / in\-consultation | Appointment.status | Stat cards |
| Appointment trend | Appointment.date, grouped daily/weekly/monthly | Line |
| Type distribution (consultation, follow\-up, dental, vaccination, etc.) | Appointment.type | Donut/bar |
| Source/category distribution (Call, WhatsApp, Social Media) | Appointment.source *(new field — confirm it exists or needs adding)* | Bar \+ conversion table (bookings → completed → cancelled → no\-show, per source) |
| Per\-doctor performance (appointments, completed, no\-show, avg wait) | Appointment.doctorId | Ranked table |

Note: §9 of the master prompt (source/category analysis) depends on an `Appointment.source` field. If it doesn't exist yet, this is the one place a schema addition is unavoidable — flag it explicitly in Phase 0 rather than discovering it mid\-build.

### 8\.5 Billing & Revenue Analytics {#85-billing-revenue-analytics}

| Metric | Source | Chart |
| --- | --- | --- |
| Total invoiced / collected / outstanding, invoice count, avg invoice, fully/partially/unpaid counts | Invoice \+ Payment records | Stat cards |
| Revenue by service line (Clinical, Pharmacy, Lab, Boarding, Swimming, Nutrition, Food, Accessories) | Invoice line items or Invoice.category | Stacked bar / donut |
| Revenue trend | Invoice.date or Payment.date | Line |

### 8\.6 Payment Analysis {#86-payment-analysis}

| Metric | Source | Chart |
| --- | --- | --- |
| Fully paid / partially paid / unpaid split | Invoice.status derived from paid vs total | Stacked bar (as in master prompt's ASCII bar) |
| One\-time full\-payment customers: count, %, total collected, avg invoice, common methods | Payment records where 1 payment \= invoice total | Stat cards |
| Partial/multi\-payment customers | Payment records grouped by Invoice, count \> 1 | Table |
| Outstanding aging (0–7, 8–30, 31–60, 61–90, 90\+ days) | Invoice.dueDate / Invoice.date vs today | Table \+ bar |
| Payment method breakdown (Cash, UPI, Card) | Payment.method | Donut \+ table |

### 8\.7 Laboratory Analytics {#87-laboratory-analytics}

| Metric | Source | Chart |
| --- | --- | --- |
| Total/completed/pending/cancelled tests, tests/month, lab revenue, avg test value | LabTest records | Stat cards |
| Most common tests by count and by revenue | LabTest.testType | Ranked table |
| Status breakdown | LabTest.status | Donut |
| Revenue trend | LabTest.date \+ associated invoice amount | Line |

### 8\.8 Inventory & Product/Sales Analytics {#88-inventory-productsales-analytics}

| Metric | Source | Chart |
| --- | --- | --- |
| Total value, active/low\-stock/out\-of\-stock/expiring/expired items | InventoryItem \+ batch/expiry records | Stat cards |
| Category breakdown (Medicines, Food, Accessories, Consumables) | InventoryItem.category | Bar |
| Stock movement (purchases, sales, adjustments, returns) | StockMovement records (existing) | Line/bar over time |
| Low\-stock table | InventoryItem.currentStock vs minLevel | Table with status column |
| Expiry risk buckets (expired, ≤7d, ≤30d, ≤90d, safe) | Batch.expiryDate | Table |
| Top\-selling products (by units and by revenue), by category | Sale/Invoice line items joined to InventoryItem | Ranked table |

### 8\.9 Clinical Analytics {#89-clinical-analytics}

Re\-slices the existing clinical\-report data (already shown as stat cards on today's `/m/reports`) by additional dimensions, without altering the archive itself:

| Metric | Source | Chart |
| --- | --- | --- |
| Total records, verified, pending review, external uploads (already exist) | ClinicalReport records | Stat cards (reused) |
| Reports by category | ClinicalReport.category | Donut |
| Reports by doctor | ClinicalReport.doctorId | Bar |
| Reports by date | ClinicalReport.date | Line |
| Reports per patient | ClinicalReport grouped by Pet | Table |

### 8\.10 Cross\-Module Analysis {#810-cross-module-analysis}

| Chain | What it answers | Format |
| --- | --- | --- |
| Pet → Appointments → Billing | Per\-pet lifetime visits, services, billed, paid, outstanding | Drill\-down table from Pet Analytics |
| Client → Pets → Revenue | Per\-client pets, visits, invoices, spend, outstanding | Drill\-down table from Client Analytics |
| Appointment → Billing | Completed visits → invoices generated → amount collected (conversion rate) | Funnel/stat card on Overview |

These require joining across the same tables the single\-module tabs already query — no new data model, just a query that spans Pet/Client → Appointment → Invoice.

## 9\. Insights Engine {#9-insights-engine}

A small rule\-evaluation step that runs after each tab's aggregation query and turns notable values into one\-line, plain\-language statements — never hard\-coded text.

Pattern: `if (metric condition) → template string with interpolated value`. Examples of rules to implement (values always computed, never literal):

- Highest\-share appointment source → "`{source}` generated `{pct}`% of bookings during the selected period."
- Share of invoices paid in a single payment → "`{pct}`% of invoices were fully paid in a single payment."
- Count of items within 7 days of expiry → "`{count}` products are approaching expiry."
- Most\-performed lab test → "`{test}` is the most frequently performed laboratory test."
- Compare returning\-client revenue share vs new\-client revenue share → whichever is higher gets surfaced.

Keep the rule set small and specific at launch (5–8 rules covering the modules above); add more once real data patterns are visible rather than guessing at launch.

## 10\. Export {#10-export}

- Scope: PDF, Excel, CSV.
- The export must serialize whatever the user is currently looking at — same date range, same filters, same tab — not a full dump. Implementation\-wise, the export endpoint should accept the same query parameters the on\-screen fetch used, not a separate "generate everything" job.
- Large exports (e.g., full outstanding\-invoice aging with underlying records) should be generated server\-side and streamed/downloaded, not assembled in the browser.

## 11\. Drill\-Down & Interactivity {#11-drill-down-interactivity}

Charts and KPI cards that represent a sum of individually meaningful records (e.g., "WhatsApp — 120 appointments," "Outstanding ₹85,000") should be clickable, opening a filtered table of the underlying records using the same filter/date\-range state already in effect. This reuses the ranked\-table components from §8 rather than introducing a new UI pattern.

## 12\. Performance {#12-performance}

- Every KPI/chart is backed by an aggregation query (SQL `GROUP BY`/`SUM`/`COUNT`, or the ORM equivalent) — never "fetch all records, compute in JS."
- Detailed tables (top clients, low\-stock, aging) are paginated server\-side.
- Consider a short\-TTL cache (e.g., 60–120s) on Overview KPIs only, since that tab is the most frequently viewed and least filter\-specific; module tabs with heavy filtering are less cache\-friendly and can stay uncached initially.

## 13\. Security & Permissions {#13-security-permissions}

- New analytics endpoints sit behind the same auth/role middleware as the existing module endpoints they read from (an analytics query for Billing data requires the same role as Billing itself).
- Client\-facing tables (Top Clients, Pet owner info) should reuse existing field\-level redaction rules rather than defining new ones.
- No new roles are introduced by this work unless Phase 0 discovery reveals the current permission model can't express "can view analytics but not raw records" — flag that as a decision point if it comes up, don't design around a role that doesn't exist yet.

## 14\. Acceptance Checklist {#14-acceptance-checklist}

- [ ] Single centralized Analytics Dashboard exists alongside an unmodified Medical Reports & Records tab.
- [ ] Global date filter and contextual filters apply consistently across tabs.
- [ ] Overview, Pet, Client, Appointment, Billing, Payment, Laboratory, Inventory, Product/Sales, and Clinical tabs are all present and backed by live queries.
- [ ] Cross\-module drill\-downs (Pet→Billing, Client→Revenue, Appointment→Billing) work.
- [ ] Insight statements are computed, not hard\-coded.
- [ ] Export respects active tab/date range/filters.
- [ ] Empty states show "No data available" rather than misleading zeros.
- [ ] No new tables duplicate existing Appointment/Billing/Inventory/Clinical data.
- [ ] No existing workflow, permission, or record was altered or deleted.
- [ ] Load\-tested against realistic data volume (Phase 8) before rollout.

## 15\. Open Questions to Resolve in Phase 0 {#15-open-questions-to-resolve-in-phase-0}

- Does an `Appointment.source` (Call/WhatsApp/Social Media) field already exist, or does §8.4's source analysis require a net\-new field on an existing table?
- Do invoices carry a service\-line/category tag today, or does §8.5's revenue\-by\-service split need to be derived from line items instead?
- Is there an existing permission tier that would need a new "analytics viewer" role, or does every current role that can see a module's raw data also make sense as an analytics viewer for that module?
- What is the actual current record volume (appointments, invoices, inventory movements) — this determines how urgent the caching/pagination work in §12 is for launch versus a fast\-follow.
::::