import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CreditCard,
  Plus,
  Search,
  BookOpen,
  RefreshCw,
  Ban,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wallet,
  BarChart2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Building2,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitPaymentInput, type PaymentLine, type PaymentAccount } from "@/components/erp/shared/SplitPaymentInput";
import {
  DateRangeFilter,
  defaultDateRange,
  type DateRange,
} from "@/components/erp/shared/DateRangeFilter";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";
import {
  listSupplierPaymentsFn,
  createSupplierPaymentFn,
  voidSupplierPaymentFn,
  type SupplierPaymentRow,
} from "@/lib/mongodb/serverFns/supplierPayments";
import {
  listPurchaseBillsFn,
  type PurchaseBillRow,
} from "@/lib/mongodb/serverFns/purchaseBills";
import {
  listSuppliersFn,
  listPaymentAccountsFn,
  type SupplierMasterRow,
} from "@/lib/mongodb/serverFns/masters";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { SupplierLedgerModal } from "./SupplierLedgerModal";
import { toast } from "sonner";

const MODE_COLORS: Record<string, string> = {
  BANK_TRANSFER: "#3b82f6",
  UPI: "#8b5cf6",
  CASH: "#10b981",
  CARD: "#f59e0b",
  CHEQUE: "#6366f1",
  OTHER: "#94a3b8",
};

const MODE_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI / QR",
  CASH: "Cash",
  CARD: "Card",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

const SUP_PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

const rupeeK = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${val}`;
};

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-medium text-foreground">
            ₹{Number(p.value).toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
}

interface BillAllocationRow {
  billId: string;
  internalRef: string;
  billNumber: string;
  billDate: string;
  dueDate?: string | undefined;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  payAmount: number;
  selected: boolean;
}

export function PaymentOutTab({
  initialSupplierId,
  initialBillId,
}: {
  initialSupplierId?: string | undefined;
  initialBillId?: string | undefined;
}) {
  const [viewMode, setViewMode] = useState<"RECORD" | "HISTORY">("RECORD");
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId || "");

  // Record Form States
  const [paymentDate, setPaymentDate] = useState(todayIST());
  const [allocationMode, setAllocationMode] = useState<"SELECTED" | "OLDEST_FIRST" | "ON_ACCOUNT">("SELECTED");
  const [unpaidBills, setUnpaidBills] = useState<BillAllocationRow[]>([]);
  const [onAccountAmount, setOnAccountAmount] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    {
      id: "line_1",
      mode: "BANK_TRANSFER",
      accountId: "",
      amount: 0,
      referenceNo: "",
      chequeDate: "",
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [ledgerModalSupplierId, setLedgerModalSupplierId] = useState<string | null>(null);

  // History Filter States
  const [historyDateRange, setHistoryDateRange] = useState<DateRange>(defaultDateRange());
  const [historyPayments, setHistoryPayments] = useState<SupplierPaymentRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // Analytics & Billing Integration States
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [billingReceipts, setBillingReceipts] = useState(0);
  const [billingLoading, setBillingLoading] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"ALL" | "CONFIRMED" | "VOID">("ALL");
  const [historyModeFilter, setHistoryModeFilter] = useState<string>("ALL");
  const [expandedVouchers, setExpandedVouchers] = useState<Record<string, boolean>>({});

  const toggleExpandVoucher = (id: string) => {
    setExpandedVouchers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Load masters
  useEffect(() => {
    Promise.all([listSuppliersFn(), listPaymentAccountsFn()])
      .then(([sups, accs]) => {
        setSuppliers(sups);
        setAccounts(accs);
        if (sups.length > 0 && !selectedSupplierId && sups[0]) {
          setSelectedSupplierId(sups[0]._id);
        }
      })
      .catch((err) => console.error("Error loading masters:", err));
  }, []);

  // Fetch unpaid bills when supplier changes
  useEffect(() => {
    if (!selectedSupplierId) {
      setUnpaidBills([]);
      return;
    }

    listPurchaseBillsFn({
      data: {
        supplierId: selectedSupplierId,
        status: "ALL",
        from: "2020-01-01", // fetch all historical pending bills
        to: todayIST(),
      },
    })
      .then((bills) => {
        const pending = bills
          .filter((b) => b.status === "UNPAID" || b.status === "PARTIAL")
          .map((b) => {
            const balance = Math.max(0, b.grandTotal - b.amountPaid);
            const isInitial = initialBillId && b._id === initialBillId;
            return {
              billId: b._id,
              internalRef: b.internalRef,
              billNumber: b.billNumber,
              billDate: b.billDate,
              dueDate: b.dueDate,
              grandTotal: b.grandTotal,
              amountPaid: b.amountPaid,
              balance,
              payAmount: isInitial ? balance : 0,
              selected: !!isInitial,
            };
          });
        setUnpaidBills(pending);

        // If an initial bill was targeted, auto-fill the payment lines
        if (initialBillId) {
          const target = pending.find((p) => p.billId === initialBillId);
          if (target) {
            setPaymentLines([
              {
                id: "line_1",
                mode: "BANK_TRANSFER",
                accountId: accounts.find((a) => a.type === "BANK")?._id || "",
                amount: target.balance,
                referenceNo: "",
                chequeDate: "",
              },
            ]);
          }
        }
      })
      .catch((err) => console.error("Error fetching unpaid bills:", err));
  }, [selectedSupplierId, initialBillId, accounts]);

  // Load payment history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await listSupplierPaymentsFn({
        data: {
          from: historyDateRange.from,
          to: historyDateRange.to,
          q: historySearch.trim() || undefined,
        },
      });
      setHistoryPayments(data);
    } catch (err) {
      console.error("Error loading payment history:", err);
      toast.error("Failed to load payment history");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDateRange, historySearch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Fetch billing collections cross-link
  useEffect(() => {
    if (!showAnalytics) return;
    setBillingLoading(true);
    listInvoicesFn({
      datePreset: "all",
      startDate: historyDateRange.from,
      endDate: historyDateRange.to,
      status: "all",
    })
      .then((invoices: any[]) => {
        const totalReceived = invoices.reduce((s, inv) => s + (inv.amountPaid || 0), 0);
        setBillingReceipts(totalReceived);
      })
      .catch(() => setBillingReceipts(0))
      .finally(() => setBillingLoading(false));
  }, [showAnalytics, historyDateRange]);

  // Analytics Data Memos
  const activePayments = useMemo(
    () => historyPayments.filter((p) => p.status !== "VOID"),
    [historyPayments]
  );

  const totalPaidOut = useMemo(
    () => activePayments.reduce((s, p) => s + (p.totalAmount || 0), 0),
    [activePayments]
  );

  const voidedTotal = useMemo(
    () => historyPayments.filter((p) => p.status === "VOID").reduce((s, p) => s + (p.totalAmount || 0), 0),
    [historyPayments]
  );

  const netLiquidity = billingReceipts - totalPaidOut;

  // Trend data: daily outflow
  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...activePayments].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
    sorted.forEach((p) => {
      const d = p.paymentDate ? p.paymentDate.slice(5) : "Other";
      map.set(d, (map.get(d) || 0) + (p.totalAmount || 0));
    });
    return Array.from(map.entries()).map(([day, Outflow]) => ({
      day,
      Outflow,
    })).slice(-15);
  }, [activePayments]);

  // Mode breakdown
  const modeData = useMemo(() => {
    const map = new Map<string, number>();
    activePayments.forEach((p) => {
      p.paymentLines?.forEach((l) => {
        const mode = l.mode || "OTHER";
        map.set(mode, (map.get(mode) || 0) + (l.amount || 0));
      });
    });
    return Array.from(map.entries())
      .map(([mode, value]) => ({
        name: MODE_LABELS[mode] || mode,
        rawMode: mode,
        value,
      }))
      .filter((d) => d.value > 0);
  }, [activePayments]);

  // Supplier breakdown
  const supplierData = useMemo(() => {
    const map = new Map<string, number>();
    activePayments.forEach((p) => {
      const name = p.supplierName || "Unknown";
      map.set(name, (map.get(name) || 0) + (p.totalAmount || 0));
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [activePayments]);

  // Filtered history payments
  const filteredHistoryPayments = useMemo(() => {
    return historyPayments.filter((row) => {
      if (historyStatusFilter === "CONFIRMED" && row.status === "VOID") return false;
      if (historyStatusFilter === "VOID" && row.status !== "VOID") return false;
      if (historyModeFilter !== "ALL") {
        const hasMode = row.paymentLines?.some((l) => l.mode === historyModeFilter);
        if (!hasMode) return false;
      }
      return true;
    });
  }, [historyPayments, historyStatusFilter, historyModeFilter]);

  // Allocation calculation
  const totalAllocated =
    allocationMode === "ON_ACCOUNT"
      ? typeof onAccountAmount === "number"
        ? onAccountAmount
        : 0
      : unpaidBills.reduce((s, b) => s + (b.selected ? b.payAmount || 0 : 0), 0);

  const linesTotal = paymentLines.reduce((s, l) => s + (l.amount || 0), 0);
  const diff = totalAllocated - linesTotal;

  // Toggle bill selection
  const handleToggleBill = (billId: string) => {
    setUnpaidBills((prev) =>
      prev.map((b) => {
        if (b.billId === billId) {
          const nextSelected = !b.selected;
          return {
            ...b,
            selected: nextSelected,
            payAmount: nextSelected ? b.balance : 0,
          };
        }
        return b;
      })
    );
  };

  const handlePayAmountChange = (billId: string, amount: number) => {
    setUnpaidBills((prev) =>
      prev.map((b) => {
        if (b.billId === billId) {
          return {
            ...b,
            payAmount: Math.min(b.balance, Math.max(0, amount)),
          };
        }
        return b;
      })
    );
  };

  // Oldest First FIFO auto-distribution
  const handleApplyOldestFirst = (enteredTotal: number) => {
    let remaining = enteredTotal;
    setUnpaidBills((prev) =>
      prev.map((b) => {
        if (remaining <= 0) {
          return { ...b, selected: false, payAmount: 0 };
        }
        const alloc = Math.min(b.balance, remaining);
        remaining -= alloc;
        return {
          ...b,
          selected: alloc > 0,
          payAmount: alloc,
        };
      })
    );
  };

  // Synchronize payment lines with totalAllocated
  const handleSyncPaymentLines = () => {
    const firstLine = paymentLines[0];
    if (paymentLines.length === 1 && totalAllocated > 0 && firstLine) {
      setPaymentLines([{ ...firstLine, amount: totalAllocated }]);
    }
  };

  const handleSavePayment = async () => {
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (totalAllocated <= 0) {
      toast.error("Please allocate an amount to pay");
      return;
    }
    if (Math.abs(diff) > 0.01) {
      toast.error(`Payment lines total does not match allocation amount (difference: ₹${diff.toFixed(2)})`);
      return;
    }

    const sup = suppliers.find((s) => s._id === selectedSupplierId);

    const allocations =
      allocationMode === "ON_ACCOUNT"
        ? []
        : unpaidBills
            .filter((b) => b.selected && b.payAmount > 0)
            .map((b) => ({
              purchaseBillId: b.billId,
              billRef: `${b.internalRef} (${b.billNumber})`,
              amount: b.payAmount,
            }));

    setSubmitting(true);
    try {
      const res = await createSupplierPaymentFn({
        data: {
          supplierId: selectedSupplierId,
          supplierName: sup?.name,
          paymentDate,
          totalAmount: totalAllocated,
          allocationMode,
          remarks: remarks.trim() || undefined,
          allocations,
          paymentLines: paymentLines.map((l) => {
            const acc = accounts.find((a) => a._id === l.accountId);
            return {
              mode: l.mode,
              accountId: l.accountId,
              accountName: l.mode === "CASH" ? "Cash" : acc?.name || "Bank",
              amount: l.amount,
              referenceNo: l.referenceNo || undefined,
              chequeDate: l.chequeDate || undefined,
            };
          }),
        },
      });

      toast.success(`Payment recorded! Voucher: ${res.voucherNo}`);
      // Reset form
      setRemarks("");
      setOnAccountAmount("");
      setPaymentLines([
        {
          id: Math.random().toString(36).slice(2),
          mode: "BANK_TRANSFER",
          accountId: accounts.find((a) => a.type === "BANK")?._id || "",
          amount: 0,
          referenceNo: "",
          chequeDate: "",
        },
      ]);
      // Refresh bills
      setSelectedSupplierId(selectedSupplierId);
      setViewMode("HISTORY");
    } catch (err: any) {
      console.error("Payment out failed:", err);
      toast.error(err.message || "Failed to record payment out");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidVoucher = async (id: string, voucherNo: string) => {
    const reason = window.prompt(`Enter reason to cancel/void payment voucher ${voucherNo}:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error("A valid cancellation reason is required");
      return;
    }

    try {
      await voidSupplierPaymentFn({ data: { id, reason: reason.trim() } });
      toast.success(`Payment voucher ${voucherNo} cancelled`);
      fetchHistory();
    } catch (err: any) {
      console.error("Void payment failed:", err);
      toast.error(err.message || "Failed to cancel payment voucher");
    }
  };

  const selectedSupplier = suppliers.find((s) => s._id === selectedSupplierId);

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* ── Sub-view Tabs & Top Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-muted/40 p-1">
          <button
            onClick={() => setViewMode("RECORD")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "RECORD"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            + Record Payment Out
          </button>
          <button
            onClick={() => setViewMode("HISTORY")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "HISTORY"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Payment Vouchers History ({historyPayments.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="gap-1.5 text-xs border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10"
          >
            <BarChart2 className="size-3.5" />
            {showAnalytics ? "Hide Analytics" : "Analytics & Trends"}
          </Button>

          {selectedSupplierId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLedgerModalSupplierId(selectedSupplierId)}
              className="gap-1.5 text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
            >
              <BookOpen className="size-3.5" /> View Supplier Ledger
            </Button>
          )}
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Outflow */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Outflow</span>
            <div className="rounded-md bg-rose-500/10 p-1.5 text-rose-600">
              <TrendingDown className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalPaidOut.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activePayments.length} confirmed voucher{activePayments.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Clinic Billing Receipts (Billing Module Cross-link) */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Clinic Billing Receipts</span>
            <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {billingLoading ? "…" : `₹${billingReceipts.toLocaleString("en-IN")}`}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/70">
            From patient billing invoices
          </div>
        </div>

        {/* Net Liquidity Margin */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Receipts vs Outflow</span>
            <div className="rounded-md bg-blue-500/10 p-1.5 text-blue-600">
              <Wallet className="size-3.5" />
            </div>
          </div>
          <div className={`mt-2 text-xl font-bold ${netLiquidity >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            ₹{netLiquidity.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {netLiquidity >= 0 ? "Net positive liquidity" : "Disbursements exceed receipts"}
          </div>
        </div>

        {/* Voided Vouchers */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Voided / Reversed</span>
            <div className="rounded-md bg-slate-500/10 p-1.5 text-slate-500">
              <Ban className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {historyPayments.filter((p) => p.status === "VOID").length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            ₹{voidedTotal.toLocaleString("en-IN")} reversed
          </div>
        </div>
      </div>

      {/* ── Analytics Panel ── */}
      {showAnalytics && (
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-foreground">Disbursement &amp; Inflow Analytics</p>
            <p className="text-xs text-muted-foreground">Supplier disbursements, payment channel distribution, and billing module reconciliation</p>
          </div>

          {/* Billing & Outflow Context Band */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">
                Supplier Payments Out
              </p>
              <p className="text-xl font-bold text-rose-700 dark:text-rose-300">
                ₹{totalPaidOut.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-rose-600/70 mt-0.5">Disbursed to suppliers / vendors</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                Clinic Billing Receipts
              </p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {billingLoading ? "…" : `₹${billingReceipts.toLocaleString("en-IN")}`}
              </p>
              <p className="text-[10px] text-emerald-600/70 mt-0.5">Collected from patient billing module</p>
            </div>
            <div className={`rounded-xl border p-4 ${netLiquidity >= 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50 dark:bg-rose-950/20"}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${netLiquidity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                Coverage Ratio
              </p>
              <p className={`text-xl font-bold ${netLiquidity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {totalPaidOut > 0 ? `${((billingReceipts / totalPaidOut) * 100).toFixed(0)}%` : "100%"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Billing receipts vs AP outflow ratio</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Daily Outflow Trend Area Chart */}
            <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Payment Outflow Timeline</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Disbursement amounts by payment date</p>
              {trendData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  No payment vouchers recorded in this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={rupeeK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="Outflow" stroke="#6366f1" strokeWidth={2} fill="url(#outGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Payment Mode Donut Chart */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Payment Mode Split</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Bank transfer, UPI, cash, cheque breakdown</p>
              {modeData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  No payment data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={modeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={35}
                      paddingAngle={3}
                    >
                      {modeData.map((d, i) => (
                        <Cell key={i} fill={MODE_COLORS[d.rawMode] || SUP_PALETTE[i % SUP_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => rupeeK(v)} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Suppliers by Outflow Bar Chart */}
          {supplierData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-0.5 text-sm font-semibold text-foreground">Top Suppliers Disbursed To</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Highest payee recipients in selected period</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={supplierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={rupeeK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {viewMode === "RECORD" ? (
        /* ── RECORD VIEW ── */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left 2 Cols: Form & Allocations */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header selection card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="pay-sup">Supplier *</Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger id="pay-sup">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pay-date">Payment Date</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>

              {selectedSupplier && (
                <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/20 p-2.5 text-xs text-muted-foreground border border-border/60">
                  <span>Contact: <strong>{selectedSupplier.contactPerson || "—"}</strong></span>
                  <span>Phone: <strong>{selectedSupplier.phone || "—"}</strong></span>
                  <span>Credit Days: <strong>{selectedSupplier.creditDays}d</strong></span>
                  <span>
                    Opening:{" "}
                    <strong>
                      ₹{selectedSupplier.openingBalance.toLocaleString("en-IN")} {selectedSupplier.openingBalanceType}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Bill Allocation Section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Allocate Against Bills</h3>
                  <p className="text-xs text-muted-foreground">Select how this payment settles outstanding bills</p>
                </div>

                <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAllocationMode("SELECTED")}
                    className={`rounded px-2.5 py-1 font-medium transition-all ${
                      allocationMode === "SELECTED" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Select Bills
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllocationMode("OLDEST_FIRST");
                      const amt = prompt("Enter total payment amount to allocate against oldest bills first:");
                      if (amt && !isNaN(Number(amt))) {
                        handleApplyOldestFirst(Number(amt));
                      }
                    }}
                    className={`rounded px-2.5 py-1 font-medium transition-all ${
                      allocationMode === "OLDEST_FIRST" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Oldest First (FIFO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode("ON_ACCOUNT")}
                    className={`rounded px-2.5 py-1 font-medium transition-all ${
                      allocationMode === "ON_ACCOUNT" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    On Account / Advance
                  </button>
                </div>
              </div>

              {allocationMode === "ON_ACCOUNT" ? (
                <div className="py-4 space-y-2">
                  <Label htmlFor="on-acc-amt">Advance / On Account Amount (₹) *</Label>
                  <Input
                    id="on-acc-amt"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={onAccountAmount}
                    onChange={(e) => setOnAccountAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className="max-w-xs font-semibold text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    This advance will be recorded on the supplier's account and can be adjusted later against future bills.
                  </p>
                </div>
              ) : unpaidBills.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No unpaid or partial bills found for this supplier. You can use <strong>On Account / Advance</strong> mode.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground sticky top-0">
                      <tr>
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2">Bill Date</th>
                        <th className="px-3 py-2">Ref / Inv #</th>
                        <th className="px-3 py-2 text-right">Bill Total (₹)</th>
                        <th className="px-3 py-2 text-right">Outstanding (₹)</th>
                        <th className="px-3 py-2 w-32 text-right">Pay Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unpaidBills.map((b) => (
                        <tr key={b.billId} className={`hover:bg-muted/30 ${b.selected ? "bg-primary/5" : ""}`}>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={b.selected}
                              onChange={() => handleToggleBill(b.billId)}
                              className="size-4 rounded border-border text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {formatDisplayDate(b.billDate)}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-mono font-medium text-foreground">{b.internalRef}</span>
                            <span className="ml-1 text-muted-foreground">({b.billNumber})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            ₹{b.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-rose-600 whitespace-nowrap">
                            ₹{b.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              max={b.balance}
                              step="0.01"
                              value={b.payAmount || ""}
                              disabled={!b.selected}
                              onChange={(e) =>
                                handlePayAmountChange(b.billId, parseFloat(e.target.value) || 0)
                              }
                              className="h-7 text-xs text-right font-bold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Total Allocated to Pay:
                </span>
                <span className="text-base font-bold text-primary font-mono">
                  ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Split Payment Input Section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Payment Modes &amp; Accounts</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncPaymentLines}
                  className="h-7 text-xs"
                >
                  Match Allocated (₹{totalAllocated.toFixed(2)})
                </Button>
              </div>

              <SplitPaymentInput
                total={totalAllocated}
                lines={paymentLines}
                onChange={setPaymentLines}
                accounts={accounts}
                requireExactMatch={true}
                defaultMode="BANK_TRANSFER"
              />
            </div>
          </div>

          {/* Right Col: Summary & Confirmation */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-semibold text-foreground">Payment Summary</h3>

              <div className="space-y-2 text-xs divide-y divide-border">
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Supplier:</span>
                  <span className="font-semibold text-foreground">{selectedSupplier?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Payment Date:</span>
                  <span className="font-semibold text-foreground">{formatDisplayDate(paymentDate)}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Mode of Allocation:</span>
                  <span className="font-semibold text-foreground uppercase">{allocationMode}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Total Bill Amount:</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Payment Lines Sum:</span>
                  <span className={`font-mono font-bold ${Math.abs(diff) <= 0.01 ? "text-emerald-600" : "text-rose-600"}`}>
                    ₹{linesTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {Math.abs(diff) > 0.01 && (
                <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600">
                  Mismatch: Payment lines differ from allocated total by ₹{diff.toFixed(2)}. Click "Match Allocated" above to sync.
                </div>
              )}

              <div className="space-y-1.5 pt-2">
                <Label htmlFor="pay-remarks" className="text-xs">Remarks / Cheque Details / Notes</Label>
                <Input
                  id="pay-remarks"
                  placeholder="e.g. Cleared via RTGS UTR 128912"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="text-xs"
                />
              </div>

              <Button
                onClick={handleSavePayment}
                disabled={submitting || totalAllocated <= 0 || Math.abs(diff) > 0.01}
                className="w-full gap-2 shadow-xs"
              >
                <CheckCircle2 className="size-4" />
                Confirm &amp; Record Payment Out
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── HISTORY VIEW ── */
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DateRangeFilter value={historyDateRange} onChange={setHistoryDateRange} />

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search voucher # or supplier..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {/* Status Filter */}
              <Select value={historyStatusFilter} onValueChange={(v: any) => setHistoryStatusFilter(v)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Status: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed Only</SelectItem>
                  <SelectItem value="VOID">Voided Only</SelectItem>
                </SelectContent>
              </Select>

              {/* Mode Filter */}
              <Select value={historyModeFilter} onValueChange={setHistoryModeFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Mode: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Modes</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI / QR</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchHistory}
                disabled={historyLoading}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className={`size-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-3 text-center"></th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Voucher #</th>
                    <th className="px-3 py-3">Supplier Name</th>
                    <th className="px-3 py-3">Payment Modes</th>
                    <th className="px-3 py-3">Allocations (Bills Settled)</th>
                    <th className="px-3 py-3 text-right">Amount (₹)</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        Loading payment history...
                      </td>
                    </tr>
                  ) : filteredHistoryPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        No payment out vouchers match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryPayments.map((row) => {
                      const isVoid = row.status === "VOID";
                      const isExpanded = !!expandedVouchers[row._id];
                      return (
                        <>
                          <tr
                            key={row._id}
                            className={`transition-colors hover:bg-muted/30 cursor-pointer ${
                              isVoid ? "opacity-50 bg-destructive/5" : ""
                            }`}
                            onClick={() => toggleExpandVoucher(row._id)}
                          >
                            <td className="px-2 py-3 text-center">
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground transition-transform"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandVoucher(row._id);
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="size-3.5 text-primary" />
                                ) : (
                                  <ChevronDown className="size-3.5" />
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                              {formatDisplayDate(row.paymentDate)}
                            </td>
                            <td className="px-3 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                              {row.voucherNo}
                            </td>
                            <td className="px-3 py-3 font-medium text-foreground">
                              {row.supplierName}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {row.paymentLines.map((l, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                                  >
                                    <span>{MODE_LABELS[l.mode] || l.mode}:</span>
                                    <span className="font-semibold">₹{l.amount.toLocaleString("en-IN")}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {row.allocations.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground italic">On Account / Advance</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {row.allocations.map((a, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                                    >
                                      {a.billRef} (₹{a.amount.toLocaleString("en-IN")})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-foreground whitespace-nowrap font-mono">
                              ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  !isVoid
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-rose-500/10 text-rose-600"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {!isVoid ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleVoidVoucher(row._id, row.voucherNo)}
                                  title="Void Voucher & Reverse Allocations"
                                  className="size-7 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                                >
                                  <Ban className="size-3.5" />
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Voided</span>
                              )}
                            </td>
                          </tr>

                          {/* Expandable Details Drawer */}
                          {isExpanded && (
                            <tr key={`${row._id}-exp`} className="bg-muted/15 border-b border-border/60">
                              <td colSpan={9} className="p-4 pl-10">
                                <div className="space-y-3 rounded-lg border border-border/80 bg-background/80 p-3.5 text-xs shadow-inner">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="size-4 text-indigo-500" />
                                      <span className="font-semibold text-foreground">Voucher Details: {row.voucherNo}</span>
                                      <span className="text-muted-foreground">({row.allocationMode} allocation)</span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      Payment Date: <strong className="text-foreground">{formatDisplayDate(row.paymentDate)}</strong>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {/* Payment Lines Breakdown */}
                                    <div className="space-y-1.5">
                                      <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                        <Wallet className="size-3 text-muted-foreground" /> Payment Channels &amp; Accounts
                                      </p>
                                      <div className="divide-y divide-border/60 rounded border border-border/50 bg-card p-2">
                                        {row.paymentLines.map((line, idx) => (
                                          <div key={idx} className="flex items-center justify-between py-1 text-xs">
                                            <div>
                                              <span className="font-medium text-foreground">{MODE_LABELS[line.mode] || line.mode}</span>
                                              {line.accountName && (
                                                <span className="ml-1 text-[11px] text-muted-foreground">({line.accountName})</span>
                                              )}
                                              {line.referenceNo && (
                                                <div className="text-[10px] text-muted-foreground font-mono">Ref: {line.referenceNo}</div>
                                              )}
                                            </div>
                                            <span className="font-mono font-semibold text-foreground">
                                              ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Settled Bills Breakdown */}
                                    <div className="space-y-1.5">
                                      <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3 text-emerald-500" /> Allocated Purchase Bills
                                      </p>
                                      {row.allocations.length === 0 ? (
                                        <div className="rounded border border-border/50 bg-card p-3 text-[11px] text-muted-foreground italic">
                                          Advance / On-Account payment — not tied to a specific purchase bill.
                                        </div>
                                      ) : (
                                        <div className="divide-y divide-border/60 rounded border border-border/50 bg-card p-2">
                                          {row.allocations.map((alloc, idx) => (
                                            <div key={idx} className="flex items-center justify-between py-1 text-xs">
                                              <span className="font-mono text-muted-foreground">{alloc.billRef}</span>
                                              <span className="font-mono font-semibold text-emerald-600">
                                                ₹{alloc.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {row.remarks && (
                                    <div className="rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                                      <strong>Remarks:</strong> {row.remarks}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Supplier Statement Ledger Modal ── */}
      {ledgerModalSupplierId && (
        <SupplierLedgerModal
          open={!!ledgerModalSupplierId}
          onClose={() => setLedgerModalSupplierId(null)}
          supplierId={ledgerModalSupplierId}
        />
      )}
    </div>
  );
}
