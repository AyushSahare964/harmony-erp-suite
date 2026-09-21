import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Receipt,
  Ban,
  Wallet,
  ArrowDownRight,
  Building2,
  RefreshCw,
  BarChart2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DateRangeFilter,
  defaultDateRange,
  type DateRange,
} from "@/components/erp/shared/DateRangeFilter";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import {
  listExpensesFn,
  voidExpenseFn,
  type ExpenseRow,
} from "@/lib/mongodb/serverFns/expenses";
import {
  listExpenseCategoriesFn,
  type ExpenseCategoryRow,
} from "@/lib/mongodb/serverFns/masters";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { toast } from "sonner";

function rupeeK(v: number) {
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${Math.round(v)}`;
}

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{rupeeK(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const CAT_PALETTE = ["#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e", "#3b82f6", "#ec4899", "#14b8a6"];

export function ExpensesTab() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedNature, setSelectedNature] = useState<"ALL" | "BUSINESS" | "PERSONAL">("ALL");
  const [selectedMode, setSelectedMode] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "VOID" | "ALL">("ACTIVE");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [billingRevenue, setBillingRevenue] = useState(0);
  const [billingLoading, setBillingLoading] = useState(false);

  // Load masters
  useEffect(() => {
    listExpenseCategoriesFn()
      .then(setCategories)
      .catch((err) => console.error("Error loading categories:", err));
  }, []);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listExpensesFn({
        data: {
          from: dateRange.from,
          to: dateRange.to,
          categoryId: selectedCategory === "ALL" ? undefined : selectedCategory,
          nature: selectedNature === "ALL" ? undefined : selectedNature,
          mode: selectedMode === "ALL" ? undefined : selectedMode,
          status: statusFilter,
          q: searchQuery.trim() || undefined,
        },
      });
      setExpenses(data);
    } catch (err) {
      console.error("Failed to load expenses:", err);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCategory, selectedNature, selectedMode, statusFilter, searchQuery]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Fetch billing revenue cross-link
  useEffect(() => {
    if (!showAnalytics) return;
    setBillingLoading(true);
    listInvoicesFn({
      datePreset: "all",
      startDate: dateRange.from,
      endDate: dateRange.to,
      status: "all",
    })
      .then((invoices: any[]) => {
        const rev = invoices.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        setBillingRevenue(rev);
      })
      .catch(() => setBillingRevenue(0))
      .finally(() => setBillingLoading(false));
  }, [showAnalytics, dateRange]);

  // Handle Void
  const handleVoid = async (id: string, voucherNo: string) => {
    const reason = window.prompt(`Enter cancellation/void reason for voucher ${voucherNo}:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error("A valid void reason is required (at least 3 chars)");
      return;
    }

    try {
      await voidExpenseFn({ data: { id, reason: reason.trim() } });
      toast.success(`Voucher ${voucherNo} voided`);
      fetchExpenses();
    } catch (err: any) {
      console.error("Void failed:", err);
      toast.error(err.message || "Failed to void voucher");
    }
  };

  // Calculations for Summary Strip
  const activeExpenses = expenses.filter((e) => e.status === "ACTIVE");
  const totalAmount = activeExpenses.reduce((s, e) => s + e.totalAmount, 0);

  let cashTotal = 0;
  let digitalTotal = 0;
  const catTotals: Record<string, number> = {};

  for (const e of activeExpenses) {
    catTotals[e.categoryName] = (catTotals[e.categoryName] || 0) + e.totalAmount;
    for (const l of e.paymentLines) {
      if (l.mode === "CASH") cashTotal += l.amount;
      else digitalTotal += l.amount;
    }
  }

  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  // Chart data: Daily expense area chart
  const dailyTrendData = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const e of activeExpenses) {
      const d = e.expenseDate?.slice(0, 10) ?? "Unknown";
      byDay[d] = (byDay[d] || 0) + e.totalAmount;
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([d, v]) => ({
        day: new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        Expenses: Math.round(v),
      }));
  }, [activeExpenses]);

  // Chart data: Category donut
  const categoryData = useMemo(() =>
    Object.entries(catTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, value: Math.round(value) })),
  [catTotals]);

  // Chart data: Payment mode bar
  const modeData = useMemo(() => {
    const byMode: Record<string, number> = {};
    for (const e of activeExpenses) {
      for (const l of e.paymentLines) {
        byMode[l.mode] = (byMode[l.mode] || 0) + l.amount;
      }
    }
    return Object.entries(byMode).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [activeExpenses]);

  const revenueToExpenseRatio = billingRevenue > 0 ? (totalAmount / billingRevenue) * 100 : 0;

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* ── Top Bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnalytics((v) => !v)}
            className="gap-1.5"
          >
            <BarChart2 className="size-3.5" />
            Analytics
            {showAnalytics ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExpenses}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-1.5 shadow-xs"
          >
            <Plus className="size-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Expenses</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activeExpenses.length} active voucher{activeExpenses.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cash Outflow</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{cashTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Physical cash paid</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Bank &amp; Digital</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{digitalTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">UPI, Card &amp; Bank transfers</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Top Category</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <ArrowDownRight className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-foreground truncate" title={topCategory ? topCategory[0] : "None"}>
            {topCategory ? topCategory[0] : "—"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {topCategory ? `₹${topCategory[1].toLocaleString("en-IN")}` : "No expenses"}
          </div>
        </div>
      </div>

      {/* ── Analytics Panel ── */}
      {showAnalytics && (
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-foreground">Expense Analytics</p>
            <p className="text-xs text-muted-foreground">Spend trends, category breakdown &amp; billing revenue context</p>
          </div>

          {/* Billing Context Band */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">Total Expenses</p>
              <p className="text-xl font-bold text-rose-700 dark:text-rose-300">₹{totalAmount.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-rose-600/70 mt-0.5">{activeExpenses.length} active vouchers</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Clinic Billing Revenue</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {billingLoading ? "…" : `₹${billingRevenue.toLocaleString("en-IN")}`}
              </p>
              <p className="text-[10px] text-emerald-600/70 mt-0.5">From patient invoices (billing module)</p>
            </div>
            <div className={`rounded-xl border p-4 ${revenueToExpenseRatio <= 30 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : revenueToExpenseRatio <= 60 ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20" : "border-rose-200 bg-rose-50 dark:bg-rose-950/20"}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${revenueToExpenseRatio <= 30 ? "text-emerald-700" : revenueToExpenseRatio <= 60 ? "text-amber-700" : "text-rose-700"}`}>
                Expense/Revenue Ratio
              </p>
              <div className="flex items-center gap-2">
                <p className={`text-xl font-bold ${revenueToExpenseRatio <= 30 ? "text-emerald-700" : revenueToExpenseRatio <= 60 ? "text-amber-700" : "text-rose-700"}`}>
                  {billingRevenue > 0 ? `${revenueToExpenseRatio.toFixed(1)}%` : "—"}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Expenses as % of billing revenue</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Daily Trend Area Chart */}
            <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Daily Expense Trend</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Expense spend per day (up to last 30 days)</p>
              {dailyTrendData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No data for selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={dailyTrendData}>
                    <defs>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={rupeeK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category Donut */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">By Category</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Spend distribution by expense category</p>
              {categoryData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No expenses found</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={3}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={CAT_PALETTE[i % CAT_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => rupeeK(v)} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Payment Mode Bar */}
          {modeData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Payment Mode Breakdown</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Cash vs digital payment split</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={modeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={rupeeK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Filters & Search ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search voucher, beneficiary, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Category: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMode} onValueChange={setSelectedMode}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Mode: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Modes</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="UPI">UPI</SelectItem>
            <SelectItem value="CARD">Card</SelectItem>
            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
            <SelectItem value="CHEQUE">Cheque</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="VOID">Voided</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Paid To / Ref</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Payment Breakdown</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No expense records found for the selected filters.
                  </td>
                </tr>
              ) : (
                expenses.map((row) => {
                  const isVoid = row.status === "VOID";
                  return (
                    <tr
                      key={row._id}
                      className={`transition-colors hover:bg-muted/30 ${
                        isVoid ? "opacity-50 bg-destructive/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDisplayDate(row.expenseDate)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                        {row.voucherNo}
                        {isVoid && (
                          <span className="ml-1.5 rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[9px] font-bold text-rose-600">
                            VOID
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{row.categoryName}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {row.categoryNature}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{row.paidTo || "—"}</div>
                        {row.billRefNo && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Ref: {row.billRefNo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                        {row.description || "—"}
                        {isVoid && row.voidReason && (
                          <div className="text-[10px] text-rose-500 italic">
                            Reason: {row.voidReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.paymentLines.map((l, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                            >
                              <span>{l.mode}:</span>
                              <span className="font-semibold">₹{l.amount.toLocaleString("en-IN")}</span>
                              {l.referenceNo && (
                                <span className="text-muted-foreground">({l.referenceNo})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!isVoid ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVoid(row._id, row.voucherNo)}
                            title="Void Voucher"
                            className="size-7 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                          >
                            <Ban className="size-3.5" />
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Voided</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {activeExpenses.length > 0 && (
              <tfoot className="border-t border-border bg-muted/30 font-semibold text-foreground">
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-right">
                    Total Active Expenses ({activeExpenses.length}):
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      <ExpenseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchExpenses}
      />
    </div>
  );
}
