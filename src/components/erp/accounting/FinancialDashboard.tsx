import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  ShoppingBag,
  CreditCard,
  Receipt,
  Wallet,
  Building2,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Line,
  LineChart,
} from "recharts";
import { KpiCard } from "@/components/erp/KpiCard";
import { Button } from "@/components/ui/button";
import {
  DateRangeFilter,
  defaultDateRange,
  type DateRange,
} from "@/components/erp/shared/DateRangeFilter";
import {
  getFinancialKpisFn,
  type FinancialOverviewKpis,
} from "@/lib/mongodb/serverFns/finance";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { toast } from "sonner";

function rupeeK(v: number) {
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="erp-card px-3 py-2 text-xs shadow-md border border-border bg-card">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{rupeeK(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

interface FinancialDashboardProps {
  onGoToTab: (id: string) => void;
}

export function FinancialDashboard({ onGoToTab }: FinancialDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());
  const [kpis, setKpis] = useState<FinancialOverviewKpis | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchKpis = async () => {
    setLoading(true);
    try {
      const res = await getFinancialKpisFn({
        data: {
          from: dateRange.from,
          to: dateRange.to,
        },
      });
      setKpis(res);
    } catch (err) {
      console.error("Failed to load financial overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [dateRange]);

  // Dynamic series from server KPIs
  const plMonthlyData = useMemo(() => {
    if (kpis?.plWeekly && kpis.plWeekly.length > 0) {
      return kpis.plWeekly;
    }
    return [
      { month: "Week 1", income: 0, expense: 0, net: 0 },
      { month: "Week 2", income: 0, expense: 0, net: 0 },
      { month: "Week 3", income: 0, expense: 0, net: 0 },
      { month: "Week 4", income: 0, expense: 0, net: 0 },
    ];
  }, [kpis?.plWeekly]);

  const cashFlowData = useMemo(() => {
    if (kpis?.cashFlowSeries && kpis.cashFlowSeries.length > 0) {
      return kpis.cashFlowSeries;
    }
    return [
      { day: "1st", in: 0, out: 0 },
      { day: "8th", in: 0, out: 0 },
      { day: "15th", in: 0, out: 0 },
      { day: "22nd", in: 0, out: 0 },
      { day: "28th", in: 0, out: 0 },
    ];
  }, [kpis?.cashFlowSeries]);

  const netRev = kpis?.totalRevenue ?? 0;
  const totExp = kpis?.totalExpenses ?? 0;
  const totPurch = kpis?.totalPurchases ?? 0;
  const totPayables = kpis?.totalPayables ?? 0;

  const totalIn = (kpis?.cashInflow || 0) + (kpis?.digitalInflow || 0);
  const totalOut = (kpis?.cashOutflow || 0) + (kpis?.digitalOutflow || 0);
  const netDelta = totalIn - totalOut;

  const formatMoney = (v: number) => {
    if (!v) return "₹0.00";
    if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
    if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
    return `₹${v.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Date Range Filter + Quick Actions ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onGoToTab("supplier-bills")}
            className="h-8 gap-1.5 text-xs"
          >
            <ShoppingBag className="size-3.5 text-blue-600" /> + Supplier Bill
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onGoToTab("payment-out")}
            className="h-8 gap-1.5 text-xs"
          >
            <CreditCard className="size-3.5 text-purple-600" /> + Payment Out
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onGoToTab("expenses")}
            className="h-8 gap-1.5 text-xs"
          >
            <Receipt className="size-3.5 text-rose-600" /> + Expense
          </Button>

          <Button
            size="sm"
            onClick={() => onGoToTab("reports")}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <FileSpreadsheet className="size-3.5" /> Full Statements
          </Button>
        </div>
      </div>

      {/* ── Primary KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Period Revenue
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground font-mono">
            ₹{(netRev / 100000).toFixed(2)}L
          </div>
          <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
            <ArrowUpRight className="size-3.5" /> Inward OPD Collections
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Operating Expenses
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground font-mono">
            ₹{(totExp / 100000).toFixed(2)}L
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            Utilities, Rent, Salaries &amp; Admin
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Medicine Purchases
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <ShoppingBag className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground font-mono">
            ₹{(totPurch / 100000).toFixed(2)}L
          </div>
          <div className="mt-1 text-xs text-blue-600 font-medium flex items-center gap-1">
            Supplier bills recorded
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Outstanding Payables
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 font-mono">
            ₹{(totPayables / 100000).toFixed(2)}L
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Due to medicine &amp; feed suppliers
          </div>
        </div>
      </div>

      {/* ── Cash Flow Movement Strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xs flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <ArrowUpRight className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Cash Inflow
            </p>
            <p className="mt-0.5 text-lg font-bold leading-none text-emerald-600">
              {formatMoney(kpis?.cashInflow || 0)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xs flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
            <ArrowDownRight className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Cash Disbursed
            </p>
            <p className="mt-0.5 text-lg font-bold leading-none text-rose-600">
              {formatMoney(kpis?.cashOutflow || 0)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xs flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Bank &amp; Digital Outflow
            </p>
            <p className="mt-0.5 text-lg font-bold leading-none text-foreground">
              {formatMoney(kpis?.digitalOutflow || 0)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xs flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
            <Wallet className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier Payments
            </p>
            <p className="mt-0.5 text-lg font-bold leading-none text-purple-600">
              {formatMoney(kpis?.totalPaidToSuppliers || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* P&L Chart */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Profit &amp; Loss Overview</p>
              <p className="text-xs text-muted-foreground">
                Revenue vs Operating Expenses &amp; Purchases (₹ thousands)
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
              Period View
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={plMonthlyData} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={rupeeK} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="net" name="Net Margin" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cash Flow Timeline */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
          <p className="mb-1 font-semibold text-foreground">Cash Flow Movement</p>
          <p className="mb-4 text-xs text-muted-foreground">Receipts vs Disbursements</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}k`} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="in" name="Incoming" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="out" name="Outgoing" stroke="#f43f5e" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
            <span>Flow Status</span>
            <span className={netDelta >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
              {netDelta > 0
                ? `+${formatMoney(netDelta)} Cash Delta`
                : netDelta < 0
                ? `-${formatMoney(Math.abs(netDelta))} Cash Deficit`
                : "Balanced Flow (₹0)"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
