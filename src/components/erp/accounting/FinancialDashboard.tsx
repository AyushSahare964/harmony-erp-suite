import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  FileSpreadsheet, Calendar,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend,
  Line, LineChart,
} from "recharts";
import { KpiCard } from "@/components/erp/KpiCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Period Data Sets ─────────────────────────────────────────────────────────

const PERIOD_METRICS: Record<"mtd" | "q1" | "ytd", {
  kpis: Array<{ label: string; value: string; trend: string; trendTone: "up" | "down" | "flat" }>;
  cashFlowStats: Array<{ label: string; value: string; icon: typeof ArrowUpRight; color: string }>;
  plMonthly: Array<{ month: string; income: number; expense: number; net: number }>;
  cashFlow30d: Array<{ day: string; in: number; out: number }>;
}> = {
  mtd: {
    kpis: [
      { label: "MTD Net Revenue", value: "₹21.6L", trend: "+9.4% vs last month", trendTone: "up" },
      { label: "MTD Expenses", value: "₹9.2L", trend: "-3.1% vs last month", trendTone: "up" },
      { label: "Cash & Bank Balance", value: "₹14.3L", trend: "HDFC + Cash in Hand", trendTone: "flat" },
      { label: "GST Payable (Aug)", value: "₹1.8L", trend: "⚠ Due on 20th Sep", trendTone: "down" },
    ],
    cashFlowStats: [
      { label: "Incoming Bills (Receivables Raised)", value: "₹26.4L", icon: ArrowUpRight, color: "text-success" },
      { label: "Outgoing Bills (Payables Raised)", value: "₹11.8L", icon: ArrowDownRight, color: "text-destructive" },
      { label: "Incoming Payments (Cash Received)", value: "₹24.1L", icon: TrendingUp, color: "text-success" },
      { label: "Outgoing Payments (Cash Disbursed)", value: "₹10.2L", icon: TrendingDown, color: "text-warning" },
    ],
    plMonthly: [
      { month: "Week 1", income: 510, expense: 220, net: 290 },
      { month: "Week 2", income: 540, expense: 230, net: 310 },
      { month: "Week 3", income: 580, expense: 240, net: 340 },
      { month: "Week 4", income: 530, expense: 230, net: 300 },
    ],
    cashFlow30d: [
      { day: "1 Aug", in: 82, out: 44 },
      { day: "5 Aug", in: 94, out: 51 },
      { day: "10 Aug", in: 78, out: 60 },
      { day: "15 Aug", in: 110, out: 48 },
      { day: "20 Aug", in: 96, out: 55 },
      { day: "25 Aug", in: 88, out: 42 },
    ],
  },
  q1: {
    kpis: [
      { label: "Q1 Net Revenue", value: "₹58.8L", trend: "+14.2% vs Q4", trendTone: "up" },
      { label: "Q1 Expenses", value: "₹26.4L", trend: "+2.5% vs Q4", trendTone: "flat" },
      { label: "Cash & Bank Balance", value: "₹13.8L", trend: "Average closing", trendTone: "flat" },
      { label: "GST Paid (Q1)", value: "₹4.9L", trend: "✓ Fully Paid", trendTone: "up" },
    ],
    cashFlowStats: [
      { label: "Incoming Bills (Receivables Raised)", value: "₹64.2L", icon: ArrowUpRight, color: "text-success" },
      { label: "Outgoing Bills (Payables Raised)", value: "₹31.5L", icon: ArrowDownRight, color: "text-destructive" },
      { label: "Incoming Payments (Cash Received)", value: "₹59.0L", icon: TrendingUp, color: "text-success" },
      { label: "Outgoing Payments (Cash Disbursed)", value: "₹28.2L", icon: TrendingDown, color: "text-warning" },
    ],
    plMonthly: [
      { month: "Apr", income: 1890, expense: 910, net: 980 },
      { month: "May", income: 1950, expense: 880, net: 1070 },
      { month: "Jun", income: 2040, expense: 850, net: 1190 },
    ],
    cashFlow30d: [
      { day: "Apr", in: 1890, out: 910 },
      { day: "May", in: 1950, out: 880 },
      { day: "Jun", in: 2040, out: 850 },
    ],
  },
  ytd: {
    kpis: [
      { label: "YTD Total Revenue", value: "₹1.27Cr", trend: "+18.6% YoY growth", trendTone: "up" },
      { label: "YTD Total Expenses", value: "₹54.7L", trend: "Within 92% budget", trendTone: "up" },
      { label: "Cash & Bank Balance", value: "₹14.3L", trend: "Liquid funds active", trendTone: "flat" },
      { label: "Cumulative GST Paid", value: "₹10.8L", trend: "All filings up to date", trendTone: "up" },
    ],
    cashFlowStats: [
      { label: "Incoming Bills (Receivables Raised)", value: "₹1.42Cr", icon: ArrowUpRight, color: "text-success" },
      { label: "Outgoing Bills (Payables Raised)", value: "₹62.8L", icon: ArrowDownRight, color: "text-destructive" },
      { label: "Incoming Payments (Cash Received)", value: "₹1.35Cr", icon: TrendingUp, color: "text-success" },
      { label: "Outgoing Payments (Cash Disbursed)", value: "₹58.1L", icon: TrendingDown, color: "text-warning" },
    ],
    plMonthly: [
      { month: "Mar", income: 1640, expense: 840, net: 800 },
      { month: "Apr", income: 1890, expense: 910, net: 980 },
      { month: "May", income: 1950, expense: 880, net: 1070 },
      { month: "Jun", income: 2020, expense: 920, net: 1100 },
      { month: "Jul", income: 2040, expense: 900, net: 1140 },
      { month: "Aug", income: 2160, expense: 920, net: 1240 },
    ],
    cashFlow30d: [
      { day: "1 Aug", in: 82, out: 44 },
      { day: "5 Aug", in: 94, out: 51 },
      { day: "10 Aug", in: 78, out: 60 },
      { day: "15 Aug", in: 110, out: 48 },
      { day: "20 Aug", in: 96, out: 55 },
      { day: "25 Aug", in: 88, out: 42 },
    ],
  },
};

const setupItems = [
  { id: "coa", label: "Review Chart of Accounts", done: true, tab: "coa" },
  { id: "tax", label: "Set up Taxes (GST / TDS templates)", done: true, tab: "tax" },
  { id: "settings", label: "Configure Bank Accounts & Reconciliation", done: true, tab: "banking" },
  { id: "costcenters", label: "Define Cost Centers & Budget Allocations", done: true, tab: "budget" },
  { id: "opening", label: "Review Financial Statements & Reports", done: true, tab: "reports" },
  { id: "first", label: "Post Invoices & Settle Payments (AR/AP)", done: true, tab: "ar" },
];

function rupeeK(v: number) { return `₹${v}k`; }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="erp-card px-3 py-2 text-xs shadow-md">
      <p className="section-label mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{rupeeK(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

interface FinancialDashboardProps {
  onGoToTab: (id: string) => void;
}

export function FinancialDashboard({ onGoToTab }: FinancialDashboardProps) {
  const [setupOpen, setSetupOpen] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<"mtd" | "q1" | "ytd">("mtd");
  const data = useMemo(() => PERIOD_METRICS[selectedPeriod] || PERIOD_METRICS["mtd"], [selectedPeriod]);
  const doneCount = setupItems.filter((i) => i.done).length;

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Period Switcher & Quick Navigation ──────────────────────── */}
      <div className="erp-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Financial Overview Period:</span>
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as "mtd" | "q1" | "ytd")}>
            <SelectTrigger className="h-8 text-xs w-48 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">Month to Date (Aug 2026)</SelectItem>
              <SelectItem value="q1">Q1 FY 2026–27 (Apr–Jun)</SelectItem>
              <SelectItem value="ytd">Full Year (FY 2026–27)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onGoToTab("reports")}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
          >
            <FileSpreadsheet className="size-3.5" /> View Full Financial Statements
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.kpis.map((k, idx) => (
          <KpiCard key={k.label + selectedPeriod} kpi={k} index={idx} />
        ))}
      </div>

      {/* ── Cash Flow Strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.cashFlowStats.map((s, i) => (
          <motion.div
            key={s.label + selectedPeriod}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            className="erp-card flex items-center gap-3 px-4 py-3"
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted ${s.color}`}>
              <s.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className={`mt-0.5 text-lg font-bold leading-none ${s.color}`}>{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* P&L Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="erp-card col-span-2 p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-navy">Profit & Loss Overview</p>
              <p className="text-xs text-muted-foreground">Income · Expense · Net Profit (₹ thousands)</p>
            </div>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold text-primary uppercase">
              {selectedPeriod.toUpperCase()} View
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.plMonthly} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={rupeeK} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#ec4899" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#1F4ED8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="net" name="Net Profit/Loss" fill="#168A47" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Cash Flow mini chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="erp-card p-5"
        >
          <p className="mb-1 font-semibold text-navy">Cash Flow Movement</p>
          <p className="mb-4 text-xs text-muted-foreground">Incoming Receipts vs Outgoing Disbursals</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.cashFlow30d}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}k`} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="in" name="Incoming" stroke="#168A47" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="out" name="Outgoing" stroke="#C0362C" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" />Incoming</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" />Outgoing</span>
          </div>
        </motion.div>
      </div>

      {/* ── Setup Checklist ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="erp-card overflow-hidden"
      >
        <button
          className="flex w-full items-center justify-between px-5 py-4"
          onClick={() => setSetupOpen((o) => !o)}
        >
          <div className="flex items-center gap-3">
            <span className="section-label">Accounting Setup &amp; Audit Checklist</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${doneCount === setupItems.length ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
              {doneCount}/{setupItems.length} active
            </span>
          </div>
          {setupOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {setupOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="border-t border-border px-5 pb-4">
                {setupItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
                    <div className="flex items-center gap-3">
                      {item.done
                        ? <CheckCircle2 className="size-4 text-success" />
                        : <Circle className="size-4 text-muted-foreground/50" />
                      }
                      <span className="text-sm text-foreground font-medium">
                        {idx + 1}. {item.label}
                      </span>
                    </div>
                    <button
                      onClick={() => onGoToTab(item.tab)}
                      className="flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                    >
                      Open Section <ArrowUpRight className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
