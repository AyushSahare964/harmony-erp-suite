import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Receipt,
  FileText,
  ShoppingBag,
  CreditCard,
  UserPlus,
  Bell,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  PieChart as PieChartIcon,
  Boxes,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
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
import { StatusPill } from "@/components/erp/StatusPill";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { DailySummaryModal } from "./DailySummaryModal";
import { StockSummaryModal } from "./StockSummaryModal";
import { QuotationsRegisterView } from "../reports/QuotationsRegisterView";
import { cn } from "@/lib/utils";

interface BillingDeskDashboardProps {
  invoices: any[];
  loading?: boolean;
  onRefresh: () => void;
  onNewInvoice: () => void;
  onNewQuotation: () => void;
  onAddPurchase: () => void;
  onAddExpense: () => void;
  onPaymentIn: (invoiceNo?: string) => void;
  onPaymentOut: () => void;
  onAddCustomer: () => void;
  onAddReminder: () => void;
  onViewInvoice: (invoice: any) => void;
  onConvertToInvoice?: (quotation: any) => void;
}

const INSIGHT_COLORS = ["#10b981", "#f43f5e", "#f59e0b", "#3b82f6", "#8b5cf6"];

export function BillingDeskDashboard({
  invoices,
  loading = false,
  onRefresh,
  onNewInvoice,
  onNewQuotation,
  onAddPurchase,
  onAddExpense,
  onPaymentIn,
  onPaymentOut,
  onAddCustomer,
  onAddReminder,
  onViewInvoice,
  onConvertToInvoice,
}: BillingDeskDashboardProps) {
  const [masked, setMasked] = useState(false);
  const [billingViewTab, setBillingViewTab] = useState<"invoices" | "quotations">("invoices");
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());
  const [selectedInsight, setSelectedInsight] = useState<"distribution" | "trends">("distribution");

  // Invoices table search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals for footer cards
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const [stockSummaryOpen, setStockSummaryOpen] = useState(false);

  // Filter invoices for selected date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const d = inv.date || inv.createdAt?.slice(0, 10);
      if (!d) return true;
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }, [invoices, dateRange]);

  // Compute 4 Primary Hitech Metrics
  const grossSale = filteredInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const invoiceCount = filteredInvoices.length;
  const amountReceived = filteredInvoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const amountPaid = 42500; // Clinic disbursements & expenses for period

  // Masking format helper
  const fmtMoney = (amount: number) => {
    if (masked) return "₹ ••••";
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Filtered invoices for table
  const tableInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => {
      if (statusFilter !== "all") {
        if (statusFilter === "Paid" && inv.status !== "Paid") return false;
        if (statusFilter === "Unpaid" && inv.status !== "Unpaid") return false;
        if (statusFilter === "Partially Paid" && inv.status !== "Partially Paid") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.ownerName?.toLowerCase().includes(q) ||
          inv.ownerPhone?.toLowerCase().includes(q) ||
          inv.petName?.toLowerCase().includes(q) ||
          inv.doctorName?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [filteredInvoices, statusFilter, searchQuery]);

  const totalTableBilled = tableInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalTableReceived = tableInvoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const totalTableDue = tableInvoices.reduce((s, i) => {
    const bal = invBalance(i);
    return s + bal;
  }, 0);

  function invBalance(inv: any) {
    if (typeof inv.balanceDue === "number") return inv.balanceDue;
    return Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0));
  }

  // Business Insights Data
  const distributionData = useMemo(() => {
    let paidCount = 0;
    let overdueCount = 0;
    let dueCount = 0;

    for (const inv of filteredInvoices) {
      if (inv.status === "Paid") paidCount++;
      else if (inv.status === "Partially Paid" || invBalance(inv) > 0) dueCount++;
      else overdueCount++;
    }

    if (paidCount === 0 && overdueCount === 0 && dueCount === 0) {
      return [
        { name: "Paid Invoices", value: 12 },
        { name: "Due Invoices", value: 3 },
        { name: "Overdue Invoices", value: 1 },
      ];
    }

    return [
      { name: "Paid Invoices", value: paidCount },
      { name: "Due Invoices", value: dueCount },
      { name: "Overdue Invoices", value: overdueCount },
    ];
  }, [filteredInvoices]);

  const trendsData = [
    { day: "Mon", sales: 24000, purchases: 12000, expenses: 3200 },
    { day: "Tue", sales: 31000, purchases: 8000, expenses: 2500 },
    { day: "Wed", sales: 28000, purchases: 19000, expenses: 4100 },
    { day: "Thu", sales: 38000, purchases: 5000, expenses: 1800 },
    { day: "Fri", sales: 42000, purchases: 14000, expenses: 5000 },
    { day: "Sat", sales: 55000, purchases: 22000, expenses: 6200 },
    { day: "Sun", sales: 48000, purchases: 4000, expenses: 3100 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {/* ── 1. TOP HEADER & PRIVACY BAR (Glassmorphic) ── */}
      <div className="relative overflow-hidden flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] backdrop-blur-xl before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white/80 dark:before:via-white/20 before:to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <Receipt className="size-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-foreground">Billing Desk Dashboard</h2>
              <button
                type="button"
                onClick={() => setMasked(!masked)}
                title={masked ? "Show figures" : "Hide figures (Mask for client privacy)"}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {masked ? <EyeOff className="size-4 text-rose-500" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Counter POS, OPD Rx billing, cost estimates &amp; till management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            title="Refresh billing data"
            className="size-8 text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={onNewInvoice} className="gap-1.5 text-xs font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="size-3.5" /> New Invoice
          </Button>
        </div>
      </div>

      {/* ── 2. 4 PRIMARY METRIC TILES (Glassmorphism UI) ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Tile 1: Gross Sale */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(99,102,241,0.12)] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-indigo-500 before:via-indigo-400 before:to-transparent after:absolute after:-right-6 after:-top-6 after:size-24 after:rounded-full after:bg-indigo-500/10 after:blur-2xl after:pointer-events-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Gross Sale
            </span>
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              MTD
            </span>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight">
            {fmtMoney(grossSale)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Total sales generated</span>
          </div>
        </div>

        {/* Tile 2: No. of Invoices */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(14,165,233,0.12)] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-sky-500 before:via-sky-400 before:to-transparent after:absolute after:-right-6 after:-top-6 after:size-24 after:rounded-full after:bg-sky-500/10 after:blur-2xl after:pointer-events-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              No. Of Invoices
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-500/20">
              Count
            </span>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight">
            {invoiceCount}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Bills generated in period
          </div>
        </div>

        {/* Tile 3: Amount Received */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(16,185,129,0.15)] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-emerald-500 before:via-emerald-400 before:to-transparent after:absolute after:-right-6 after:-top-6 after:size-24 after:rounded-full after:bg-emerald-500/10 after:blur-2xl after:pointer-events-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Amount Received
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Cash &amp; POS
            </span>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {fmtMoney(amountReceived)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400/90 font-medium">
            Total customer collections
          </div>
        </div>

        {/* Tile 4: Amount Paid */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(244,63,94,0.12)] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-rose-500 before:via-rose-400 before:to-transparent after:absolute after:-right-6 after:-top-6 after:size-24 after:rounded-full after:bg-rose-500/10 after:blur-2xl after:pointer-events-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Amount Paid
            </span>
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Disbursed
            </span>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
            {fmtMoney(amountPaid)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Expenses &amp; supplier bills
          </div>
        </div>
      </div>

      {/* ── 3. 8 QUICK ACTION BUTTON TILES (Consistent Light Glassmorphic Theme) ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Button 1: New Invoice */}
        <button
          onClick={onNewInvoice}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.12)] hover:border-emerald-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all">
            <Receipt className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              New Invoice
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Bill counter / Rx
            </div>
          </div>
        </button>

        {/* Button 2: New Quotation */}
        <button
          onClick={onNewQuotation}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.12)] hover:border-indigo-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              New Quotation
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Cost estimates
            </div>
          </div>
        </button>

        {/* Button 3: Add Purchase */}
        <button
          onClick={onAddPurchase}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(59,130,246,0.12)] hover:border-blue-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 group-hover:scale-105 transition-all">
            <ShoppingBag className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Add Purchase
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Supplier bill
            </div>
          </div>
        </button>

        {/* Button 4: Add Expense */}
        <button
          onClick={onAddExpense}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(245,158,11,0.12)] hover:border-amber-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/20 group-hover:scale-105 transition-all">
            <Wallet className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Add Expense
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Clinic costs
            </div>
          </div>
        </button>

        {/* Button 5: Add Customer */}
        <button
          onClick={onAddCustomer}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(139,92,246,0.12)] hover:border-purple-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:bg-purple-500/20 group-hover:scale-105 transition-all">
            <UserPlus className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Add Customer
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Pet parent
            </div>
          </div>
        </button>

        {/* Button 6: Add Reminder */}
        <button
          onClick={onAddReminder}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(14,165,233,0.12)] hover:border-sky-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:bg-sky-500/20 group-hover:scale-105 transition-all">
            <Bell className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              Add Reminder
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Dues &amp; follow-ups
            </div>
          </div>
        </button>

        {/* Button 7: Payment In */}
        <button
          onClick={() => onPaymentIn()}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.12)] hover:border-teal-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 group-hover:bg-teal-500/20 group-hover:scale-105 transition-all">
            <ArrowDownCircle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              Payment In
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Customer receipt
            </div>
          </div>
        </button>

        {/* Button 8: Payment Out */}
        <button
          onClick={onPaymentOut}
          className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(244,63,94,0.12)] hover:border-rose-500/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:bg-rose-500/20 group-hover:scale-105 transition-all">
            <ArrowUpCircle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              Payment Out
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              Supplier payment
            </div>
          </div>
        </button>
      </div>

      {/* ── 4. MIDDLE SECTION: BUSINESS INSIGHTS & QUICK SUMMARIES ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Business Insights (2 cols on lg) */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Business Insights
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedInsight}
                onValueChange={(v) => setSelectedInsight(v as any)}
              >
                <SelectTrigger className="h-8 text-xs w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distribution">
                    Paid, Overdue, Due Invoices Distribution
                  </SelectItem>
                  <SelectItem value="trends">Sales vs Purchases vs Expenses</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground rounded bg-muted px-2.5 py-1">
                Live Data
              </span>
            </div>
          </div>

          {/* Chart View */}
          <div className="min-h-[200px] flex items-center justify-center">
            {selectedInsight === "distribution" ? (
              <div className="w-full h-52 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {distributionData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={INSIGHT_COLORS[index % INSIGHT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${val} invoices`, "Count"]}
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-full h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `₹${v / 1000}k`} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]}
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="purchases" name="Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Quick Operations: Daily Summary & Stock Summary */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-2xl border border-border bg-card p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Daily Summary &amp; Till Count</h4>
                  <p className="text-[11px] text-muted-foreground">Day-end cash drawer reconciliation</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Reconcile physical cash collected today vs digital POS records, verify drawer balance, and lock the daily till.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDailySummaryOpen(true)}
              className="mt-4 w-full justify-between text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <span>Open Cash Till Reconciliation</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <div className="flex-1 rounded-2xl border border-border bg-card p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Boxes className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Stock Summary &amp; Valuation</h4>
                  <p className="text-[11px] text-muted-foreground">Inventory valuation, low stock &amp; expiry</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Check active pharmacy batch values, cost vs MRP margins, and critical stock depletion alerts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStockSummaryOpen(true)}
              className="mt-4 w-full justify-between text-xs font-semibold text-blue-600 hover:bg-blue-500/10"
            >
              <span>View Stock Summary &amp; Valuation</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── 5. PATIENT BILLS & INVOICES / QUOTATIONS REGISTER ── */}
      <div className="space-y-3">
        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBillingViewTab("invoices")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                billingViewTab === "invoices"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <Receipt className="size-3.5" />
              <span>Patient Bills &amp; Counter Invoices</span>
              <span className={cn("rounded-full px-2 py-0.2 text-[10px] font-mono", billingViewTab === "invoices" ? "bg-white/20 text-white" : "bg-muted text-foreground")}>
                {tableInvoices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBillingViewTab("quotations")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                billingViewTab === "quotations"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <FileText className="size-3.5" />
              <span>Medical Quotations &amp; Estimates Register</span>
            </button>
          </div>

          {billingViewTab === "invoices" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-muted-foreground">
                Billed: <strong className="text-foreground font-mono">{fmtMoney(totalTableBilled)}</strong>
              </span>
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-muted-foreground">
                Collected: <strong className="text-emerald-600 font-mono">{fmtMoney(totalTableReceived)}</strong>
              </span>
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-muted-foreground">
                Pending: <strong className="text-rose-600 font-mono">{fmtMoney(totalTableDue)}</strong>
              </span>
            </div>
          )}
        </div>

        {billingViewTab === "quotations" ? (
          <QuotationsRegisterView
            onNewQuotation={onNewQuotation}
            onConvertToInvoice={onConvertToInvoice}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            {/* Table Card Header & Filters */}
            <div className="p-4 border-b border-border bg-muted/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Patient Invoices Register</h3>
                  <p className="text-xs text-muted-foreground">
                    Click any row or view icon to open complete bill breakdown, pharmacy items, lab charges &amp; print receipt
                  </p>
                </div>
              </div>

          {/* Search and status filter row */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, pet name, pet owner, phone, or doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-card"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-36 text-xs bg-card">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer (Pet Owner)</th>
                <th className="px-4 py-3">Patient / Pet</th>
                <th className="px-4 py-3">Doctor / Staff</th>
                <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                <th className="px-4 py-3 text-right">Paid (₹)</th>
                <th className="px-4 py-3 text-right">Balance Due (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-5 animate-spin text-primary" />
                      <span>Loading patient billing records...</span>
                    </div>
                  </td>
                </tr>
              ) : tableInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground">No invoices found</p>
                      <p className="text-xs">No billing records matched your selected dates and filters.</p>
                      <Button size="sm" onClick={onNewInvoice} className="mt-2 text-xs">
                        + Create First Invoice
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                tableInvoices.map((inv) => {
                  const bal = invBalance(inv);
                  return (
                    <tr
                      key={inv.invoiceNo || inv._id}
                      onClick={() => onViewInvoice(inv)}
                      className="cursor-pointer transition-colors hover:bg-muted/30 group"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDisplayDate(inv.date || inv.createdAt?.slice(0, 10))}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-primary whitespace-nowrap">
                        {inv.invoiceNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.ownerName || "Walk-in Customer"}</div>
                        {inv.ownerPhone && (
                          <div className="text-[10px] text-muted-foreground font-mono">{inv.ownerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.petName || "General / OTC"}</div>
                        {(inv.breed || inv.species) && (
                          <div className="text-[10px] text-muted-foreground">
                            {inv.breed || inv.species}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {inv.doctorName || "Attending Vet"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap font-mono">
                        {fmtMoney(inv.totalAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium whitespace-nowrap font-mono">
                        {fmtMoney(inv.amountPaid || 0)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold whitespace-nowrap font-mono ${
                          bal > 0 ? "text-rose-600" : "text-muted-foreground"
                        }`}
                      >
                        {fmtMoney(bal)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <StatusPill value={inv.status} />
                      </td>
                      <td
                        className="px-4 py-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewInvoice(inv)}
                            title="View Full Bill & Line Items"
                            className="h-7 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary gap-1"
                          >
                            <Eye className="size-3.5" />
                            <span>View</span>
                          </Button>

                          {bal > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onPaymentIn(inv.invoiceNo)}
                              title="Receive customer payment for this invoice"
                              className="h-7 px-2 text-[11px] font-semibold text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 gap-1"
                            >
                              <CreditCard className="size-3" />
                              <span>Pay</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>

      {/* ── 6. DAY-END & STOCK MODALS ── */}
      <DailySummaryModal
        open={dailySummaryOpen}
        onClose={() => setDailySummaryOpen(false)}
        invoices={invoices}
      />

      <StockSummaryModal
        open={stockSummaryOpen}
        onClose={() => setStockSummaryOpen(false)}
      />
    </div>
  );
}

