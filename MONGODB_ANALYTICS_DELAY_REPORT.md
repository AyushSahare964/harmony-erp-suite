> **Status: fixed 2026-09-27.** Items 1–4 and 5 below were applied (see commit). Item 6 (materialized rollups) and rotating the leaked credential are left open — noted at the bottom.

# MongoDB Data-Fetch Delay — Root Cause Report

**Scope:** Why loading data (Reports & Analytics dashboard in particular) feels slow, and why that will get *worse*, not better, as data grows.

## TL;DR

The delay isn't MongoDB, the connection, or the network. It's the query pattern: the analytics endpoint pulls **entire collections** into the Node server on every request and does all filtering/grouping in JavaScript, with **zero caching**. Every dashboard load = N full collection scans, no matter how narrow the date filter is. There's also a silent data bug (moduleId mismatch) making one whole analytics section always empty, and a connection-pool size that will bite under concurrent users.

## 1. Primary cause — full collection loads on every request

[analytics.ts:245-253](src/lib/mongodb/serverFns/analytics.ts#L245-L253) — `getCentralAnalyticsFn`, called every time the Reports & Analytics page loads or a filter changes ([ClinicalReportsHub.tsx:116](src/components/erp/reports/ClinicalReportsHub.tsx#L116)):

```ts
Pet.find({}).lean(),
Owner.find({}).lean(),
ClinicalVisit.find({}).lean(),
InventoryItem.find({}).lean(),
ErpRow.find({ moduleId: "appointments" }).lean(),
ErpRow.find({ moduleId: "laboratory" }).lean(),
ErpRow.find({ moduleId: "clinical-reports" }).lean(),
```

None of these queries use the `dateRange`/`startDate`/`endDate` the user picked — **the date filter is applied in JS after fetching every document** ([analytics.ts:264-268](src/lib/mongodb/serverFns/analytics.ts#L264-L268)). Selecting "Today" still pulls every pet, owner, visit, and inventory item ever created, then throws most of it away in memory.

This is O(total records in the system), not O(records in the selected range). It's fast today because the dataset is small. It will get linearly slower as pets/owners/visits/inventory grow — which matches exactly what's being observed ("little delay now").

On top of the fetch, [`toPlain()`](src/lib/mongodb/serverFns/analytics.ts#L10-L12) round-trips the whole result through `JSON.stringify` + `JSON.parse` — extra CPU and memory for a payload that's already bigger than it needs to be.

**This is the one root cause worth fixing first** — every other item below is secondary.

## 2. No caching anywhere in this path

- The analytics call bypasses React Query entirely — it's a raw `useCallback` + `fetch` in [ClinicalReportsHub.tsx:113-132](src/components/erp/reports/ClinicalReportsHub.tsx#L113-L132), re-run on every filter change with no memoization or dedup.
- The app's `QueryClient` itself has no defaults ([router.tsx:6](src/router.tsx#L6) — `new QueryClient()`), so anywhere else in the app that *does* use React Query refetches on every mount/window-focus (`staleTime` defaults to 0). This compounds the "whole system feels slow" perception beyond just this one page.
- There's already a working precedent for pre-aggregation in this codebase — `fin_daily_summary` ([FinDailySummary.ts](src/lib/mongodb/models/FinDailySummary.ts)) is a materialized daily rollup updated incrementally in [salesDocs.ts:795](src/lib/mongodb/serverFns/salesDocs.ts#L795). Analytics doesn't use this pattern anywhere — it recomputes everything from raw rows every time, for data that doesn't need to be real-time-fresh.

## 3. Data-visibility bug (not delay, but "can't see the data")

Clinical reports are written with `moduleId: "clinical_reports"` (underscore) in two places:
- [clinical.ts:1426](src/lib/mongodb/serverFns/clinical.ts#L1426)
- [reports.ts:132](src/lib/mongodb/serverFns/reports.ts#L132)

But analytics reads `moduleId: "clinical-reports"` (hyphen) — [analytics.ts:252](src/lib/mongodb/serverFns/analytics.ts#L252).

Result: the **Clinical Analytics section of the dashboard always shows zero/empty**, regardless of how much data exists. This looks like "the data isn't showing up," but it's a naming typo, not a performance issue.

## 4. Connection pool ceiling

[client.ts:71](src/lib/mongodb/client.ts#L71) — `maxPoolSize: 5`. The connection caching pattern itself is correct (global cache, reused across calls — good for serverless). But a pool of 5 means only 5 concurrent MongoDB operations across the *entire app instance*. The analytics call alone fires 7 parallel queries — one dashboard load can nearly exhaust the pool by itself. Add a second user hitting any other page at the same time and requests start queueing for a free connection, which shows up as random, hard-to-reproduce "delay" elsewhere in the system.

## 5. Other unbounded reads (smaller, same pattern)

Same "no limit / full scan" shape elsewhere, lower blast radius today because callers already cap most of them:

- [finance.ts:667](src/lib/mongodb/serverFns/finance.ts#L667) — `ClinicalVisit.find({}).select(...)` with **no limit** at all.
- [appointments.ts:31](src/lib/mongodb/serverFns/appointments.ts#L31), [clinical.ts:176](src/lib/mongodb/serverFns/clinical.ts#L176), [crm.ts:175](src/lib/mongodb/serverFns/crm.ts#L175)/[198](src/lib/mongodb/serverFns/crm.ts#L198) — already have `.limit(...)`, fine for now but will need pagination once those limits are regularly hit.

## 6. Not delay-related, but worth flagging

[client.ts:34](src/lib/mongodb/client.ts#L34) — a full MongoDB Atlas connection string with a live username/password is hardcoded as `DEFAULT_URI`, committed to source, used as the fallback whenever `MONGODB_URI`/`VITE_MONGODB_URI` isn't set. Independent of performance, but worth rotating/removing since it's sitting in git history.

## Fix priority (for when you want to act on this)

1. **Push the date filter into the MongoDB query** for `getCentralAnalyticsFn` (`{ date: { $gte, $lte } }` / equivalent on each collection) instead of filtering in JS after fetching everything. Biggest single win, fixes the "gets worse over time" problem directly.
2. **Cache the analytics response** for a short TTL (even 30–60s server-side, or `staleTime` on a React Query call) — a dashboard doesn't need to recompute from scratch on every render/filter tweak.
3. **Fix the `clinical_reports` vs `clinical-reports` mismatch** (one-line fix, [analytics.ts:252](src/lib/mongodb/serverFns/analytics.ts#L252)).
4. Set sane `QueryClient` defaults (`staleTime`) in [router.tsx](src/router.tsx#L6) so the rest of the app isn't refetching on every focus.
5. Raise `maxPoolSize` from 5 to something like 10–20 once queries are cheaper (no point pooling more connections for queries that shouldn't be running at that cost in the first place).
6. Longer-term, once this grows further: precompute rollups the way `fin_daily_summary` already does, for the sections of analytics that don't need to be live (species split, top breeds, revenue trend, etc.) instead of aggregating raw collections per request.
7. Rotate the credentials in [client.ts:34](src/lib/mongodb/client.ts#L34) and drop the hardcoded fallback.

## What was actually done

1. `getCentralAnalyticsFn` ([analytics.ts](src/lib/mongodb/serverFns/analytics.ts)) now pushes the date range down to MongoDB for the three `erp_rows`-backed lists (appointments, laboratory, clinical reports) instead of fetching every row and filtering in JS — the "all time" case is unchanged (still needs every row), narrow ranges (today/7d/30d/etc.) now only pull matching rows.
2. Added `.select(...)` projections on the `Pet` / `Owner` / `ClinicalVisit` / `InventoryItem` full-collection reads, so only the fields the analytics code actually uses cross the wire.
3. Fixed the `clinical_reports` vs `clinical-reports` moduleId typo — the Clinical Analytics tab was always empty; verified live against Atlas (3 clinical-report rows now match, 0 remain under the old wrong key).
4. Added a 30-second in-process response cache in `getCentralAnalyticsFn`, keyed by the exact filter combination — repeat loads/filter toggles within that window are free.
5. Added two indexes on `erp_rows` (`moduleId + data.date`, `moduleId + data.appointment_date`) so the new date-range queries can actually use an index instead of a filtered scan — applied to the live Atlas cluster via `db:ensure-indexes` (72/72 indexes confirmed).
6. Raised `maxPoolSize` from 5 → 15 in [client.ts](src/lib/mongodb/client.ts) so one analytics load (7 parallel queries) can't nearly exhaust the pool by itself.
7. Set a default `staleTime: 30_000` on the app's `QueryClient` ([router.tsx](src/router.tsx)) so React Query consumers elsewhere in the app stop refetching on every mount/focus.
8. Removed the hardcoded Atlas connection string (with live credentials) that was committed as `DEFAULT_URI` in `client.ts` — it now throws a clear error if `MONGODB_URI`/`VITE_MONGODB_URI` isn't set, instead of silently falling back to a checked-in password.

## Left open (not done here)

- **Rotate the leaked Atlas password.** Removing it from `client.ts` doesn't remove it from git history — it's still recoverable from old commits. Change the database user's password in Atlas and update `.env` / deployment env vars. The string also still appears in `IMPLEMENTATION_PLAN_INTEGRATION.md` (documentation, not code) — worth scrubbing once rotated.
- **Materialized rollups** (item 6 in the original list) — using the existing `fin_daily_summary` pattern for the parts of analytics that don't need to be live (species split, breed counts, revenue trend, etc.) instead of aggregating raw collections per request. Bigger, longer-term change; the caching + query pushdown above should absorb the current pain, revisit if the dataset grows enough to strain those.
- Didn't rewire `ClinicalReportsHub.tsx`'s analytics fetch through React Query — the server-side cache now makes repeat calls cheap, so the payoff of that refactor is smaller; worth doing if you want automatic cross-tab request de-duping too.
