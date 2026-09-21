import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Ban,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  CreditCard,
  BarChart2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
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
  listPurchaseBillsFn,
  voidPurchaseBillFn,
  type PurchaseBillRow,
} from "@/lib/mongodb/serverFns/purchaseBills";
import {
  listSuppliersFn,
  type SupplierMasterRow,
} from "@/lib/mongodb/serverFns/masters";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { SupplierBillFormModal } from "./SupplierBillFormModal";
import { toast } from "sonner";

interface SupplierBillsTabProps {
  onPayBill?: (supplierId: string, billId: string) => void;
}

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

const STATUS_COLORS: Record<string, string> = {
  PAID: "#10b981",
  PARTIAL: "#f59e0b",
  UNPAID: "#f43f5e",
  VOID: "#94a3b8",
};

const SUPPLIER_BAR_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

export function SupplierBillsTab({ onPayBill }: SupplierBillsTabProps) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"UNPAID" | "PARTIAL" | "PAID" | "VOID" | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [bills, setBills] = useState<PurchaseBillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [billingRevenue, setBillingRevenue] = useState(0);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    listSuppliersFn()
      .then(setSuppliers)
      .catch((err) => console.error("Failed to load suppliers:", err));
  }, []);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPurchaseBillsFn({
        data: {
          from: dateRange.from,
          to: dateRange.to,
          supplierId: selectedSupplier === "ALL" ? undefined : selectedSupplier,
          status: selectedStatus === "ALL" ? undefined : selectedStatus,
          q: searchQuery.trim() || undefined,
        },
      });
      setBills(data);
    } catch (err) {
      console.error("Failed to load purchase bills:", err);
      toast.error("Failed to load purchase bills");
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedSupplier, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

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

  const handleVoid = async (id: string, ref: string) => {
    const reason = window.prompt(`Enter cancellation reason for purchase bill ${ref}:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error("A valid cancellation reason is required (at least 3 characters)");
      return;
    }

    try {
      await voidPurchaseBillFn({ data: { id, reason: reason.trim() } });
      toast.success(`Purchase Bill ${ref} cancelled`);
      fetchBills();
    } catch (err: any) {
      console.error("Void failed:", err);
      toast.error(err.message || "Failed to cancel bill");
    }
  };

  // Calculations
  const activeBills = bills.filter((b) => b.status !== "VOID");
  const totalPurchases = activeBills.reduce((s, b) => s + b.grandTotal, 0);

  // Chart data: Monthly spend trend
  const monthlySpendData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const b of bills) {
      if (b.status === "VOID") continue;
      const month = b.billDate?.slice(0, 7) ?? "Unknown";
      byMonth[month] = (byMonth[month] || 0) + b.grandTotal;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([m, v]) => ({
        month: new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        "Bill Total": Math.round(v),
      }));
  }, [bills]);

  // Chart data: Status distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bills) {
      counts[b.status] = (counts[b.status] || 0) + b.grandTotal;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [bills]);

  // Chart data: Top 5 suppliers by spend
  const topSuppliersData = useMemo(() => {
    const bySupplier: Record<string, number> = {};
    for (const b of activeBills) {
      bySupplier[b.supplierName] = (bySupplier[b.supplierName] || 0) + b.grandTotal;
    }
    return Object.entries(bySupplier)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, value: Math.round(value) }));
  }, [activeBills]);

  const netPosition = billingRevenue - totalPurchases;
  const totalPaid = activeBills.reduce((s, b) => s + b.amountPaid, 0);
  const totalOutstanding = Math.max(0, totalPurchases - totalPaid);
  const unpaidCount = activeBills.filter((b) => b.status === "UNPAID" || b.status === "PARTIAL").length;

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
            onClick={fetchBills}
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
            <Plus className="size-4" /> New Supplier Bill
          </Button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Inward Bills</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <FileSpreadsheet className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activeBills.length} active bill{activeBills.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Amount Settled</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Paid against bills</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Outstanding Balance</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600">
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {unpaidCount} unpaid / partial bill{unpaidCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Registered Suppliers</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {suppliers.length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Active supply vendors</div>
        </div>
      </div>

      {/* ── Analytics Panel ── */}
      {showAnalytics && (
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-foreground">Purchase Analytics</p>
            <p className="text-xs text-muted-foreground">Spend trends, supplier breakdown &amp; clinic revenue context</p>
          </div>

          {/* Billing Revenue Cross-Link Band */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                Clinic Billing Revenue
              </p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {billingLoading ? "…" : `₹${billingRevenue.toLocaleString("en-IN")}`}
              </p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500 mt-0.5">From patient invoices (billing module)</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                Total Supplier Spend
              </p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                ₹{totalPurchases.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-blue-600/70 dark:text-blue-500 mt-0.5">From purchase bills (this module)</p>
            </div>
            <div className={`rounded-xl border p-4 ${netPosition >= 0 ? "border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-900" : "border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900"}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${netPosition >= 0 ? "text-indigo-700 dark:text-indigo-400" : "text-rose-700 dark:text-rose-400"}`}>
                Net Position
              </p>
              <div className="flex items-center gap-1.5">
                {netPosition >= 0
                  ? <TrendingUp className="size-4 text-indigo-600" />
                  : <TrendingDown className="size-4 text-rose-600" />}
                <p className={`text-xl font-bold ${netPosition >= 0 ? "text-indigo-700 dark:text-indigo-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {netPosition >= 0 ? "+" : ""}₹{Math.abs(netPosition).toLocaleString("en-IN")}
                </p>
              </div>
              <p className={`text-[10px] mt-0.5 ${netPosition >= 0 ? "text-indigo-600/70" : "text-rose-600/70"}`}>Revenue minus purchase spend</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Monthly Spend Trend */}
            <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Monthly Purchase Spend</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Supplier bill totals by month (last 6 months)</p>
              {monthlySpendData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No data for selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthlySpendData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={rupeeK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="Bill Total" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status Distribution Pie */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Bills by Status</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Spend distribution by payment status</p>
              {statusData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No bills found</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={3}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => rupeeK(v)} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Suppliers Horizontal Bar */}
          {topSuppliersData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Top Suppliers by Spend</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Highest purchase bill totals in selected period</p>
              <div className="space-y-2.5">
                {topSuppliersData.map((s, i) => {
                  const pct = topSuppliersData[0].value > 0 ? (s.value / topSuppliersData[0].value) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-32 min-w-[8rem] truncate text-xs font-medium text-foreground" title={s.name}>{s.name}</div>
                      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: SUPPLIER_BAR_COLORS[i] || "#6366f1" }}
                        />
                      </div>
                      <div className="w-20 text-right text-xs font-semibold text-foreground tabular-nums">{rupeeK(s.value)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search internal ref, supplier bill #, or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Supplier: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="UNPAID">Unpaid</SelectItem>
            <SelectItem value="PARTIAL">Partially Paid</SelectItem>
            <SelectItem value="PAID">Fully Paid</SelectItem>
            <SelectItem value="VOID">Cancelled / Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Bills Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Bill Date</th>
                <th className="px-4 py-3">Internal Ref</th>
                <th className="px-4 py-3">Supplier Invoice #</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3 text-right">Bill Total (₹)</th>
                <th className="px-4 py-3 text-right">Paid (₹)</th>
                <th className="px-4 py-3 text-right">Balance (₹)</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    Loading supplier bills...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    No supplier bills found matching your criteria.
                  </td>
                </tr>
              ) : (
                bills.map((row) => {
                  const isVoid = row.status === "VOID";
                  const balance = Math.max(0, row.grandTotal - row.amountPaid);
                  return (
                    <tr
                      key={row._id}
                      className={`transition-colors hover:bg-muted/30 ${
                        isVoid ? "opacity-50 bg-destructive/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDisplayDate(row.billDate)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                        {row.internalRef}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                        {row.billNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.supplierName}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        ₹{row.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium whitespace-nowrap">
                        ₹{row.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          balance > 0 ? "text-rose-600" : "text-muted-foreground"
                        }`}
                      >
                        ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {row.dueDate ? formatDisplayDate(row.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            row.status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : row.status === "PARTIAL"
                              ? "bg-amber-500/10 text-amber-600"
                              : row.status === "UNPAID"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {!isVoid ? (
                          <div className="flex items-center justify-center gap-1">
                            {balance > 0 && onPayBill && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPayBill(row.supplierId, row._id)}
                                className="h-6 px-2 text-[10px] gap-1 text-primary border-primary/20 hover:bg-primary/10"
                              >
                                <CreditCard className="size-3" /> Pay
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleVoid(row._id, row.internalRef)}
                              title="Void Bill"
                              className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                            >
                              <Ban className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Cancelled</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {activeBills.length > 0 && (
              <tfoot className="border-t border-border bg-muted/30 font-semibold text-foreground">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right">
                    Total Active Bills ({activeBills.length}):
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    ₹{totalPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">
                    ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-rose-600">
                    ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      <SupplierBillFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchBills}
      />
    </div>
  );
}
