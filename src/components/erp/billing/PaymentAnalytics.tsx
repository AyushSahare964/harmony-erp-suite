import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, CreditCard, Banknote, Smartphone,
  Building2, Zap, Clock, Wallet,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/erp/StatusPill";
import { getPaymentAnalyticsFn, type PaymentAnalyticsData } from "@/lib/mongodb/serverFns/finance";

const METHOD_COLORS: Record<string, string> = {
  Cash: "#10b981", UPI: "#6366f1", Card: "#f59e0b", NetBanking: "#3b82f6",
  "Bank Transfer": "#3b82f6", Cheque: "#8b5cf6", "Account Due": "#94a3b8", Razorpay: "#ec4899",
};
const FALLBACK_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"];
function colorFor(name: string, i: number) {
  return METHOD_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

const METHOD_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Cash: Banknote, UPI: Smartphone, Card: CreditCard, NetBanking: Building2,
  "Bank Transfer": Building2, Razorpay: Zap,
};

function money(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

/* ─── Donut center label ──────────────────────────────────────────── */
function DonutLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.5em" style={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}>Total</tspan>
      <tspan x={cx} dy="1.4em" style={{ fontSize: 13, fontWeight: 700, fill: "var(--color-foreground)" }}>
        {money(total)}
      </tspan>
    </text>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */
const EMPTY_DATA: PaymentAnalyticsData = {
  methodBreakdown: [], dailyTrend: [], monthlyTrend: [], ageing: [],
  kpis: { totalCollectedMTD: 0, totalCollectedTrendPct: 0, outstanding: 0, outstandingOverdueCount: 0, avgBillMTD: 0, avgBillTrendPct: 0, digitalSharePct: 0, digitalShareTrendPct: 0 },
};

export function PaymentAnalytics() {
  const [range, setRange] = useState("7d");
  const [method, setMethod] = useState("all");
  const [data, setData] = useState<PaymentAnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentAnalyticsFn()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const methodData = data.methodBreakdown.map((m, i) => ({ ...m, color: colorFor(m.name, i) }));
  const trendData = range === "monthly" ? data.monthlyTrend : data.dailyTrend;
  const totalDonut = methodData.reduce((s, m) => s + m.value, 0);

  const KPIS = [
    { label: "Total Collected (MTD)", value: money(data.kpis.totalCollectedMTD), trend: `${data.kpis.totalCollectedTrendPct >= 0 ? "+" : ""}${data.kpis.totalCollectedTrendPct}%`, trendUp: data.kpis.totalCollectedTrendPct >= 0, Icon: TrendingUp },
    { label: "Outstanding",           value: money(data.kpis.outstanding), trend: `${data.kpis.outstandingOverdueCount} overdue`, trendUp: false, Icon: TrendingDown },
    { label: "Avg Bill Value (MTD)",  value: money(data.kpis.avgBillMTD), trend: `${data.kpis.avgBillTrendPct >= 0 ? "+" : ""}${data.kpis.avgBillTrendPct}%`, trendUp: data.kpis.avgBillTrendPct >= 0, Icon: Wallet },
    { label: "Digital Payment Share", value: `${data.kpis.digitalSharePct}%`, trend: `${data.kpis.digitalShareTrendPct >= 0 ? "+" : ""}${data.kpis.digitalShareTrendPct}pp`, trendUp: data.kpis.digitalShareTrendPct >= 0, Icon: Zap },
  ];

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading payment analytics…</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Payment Analytics</h2>
          <p className="text-sm text-muted-foreground">
            How are we getting paid — and is it reconciling?
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px] text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="monthly">Monthly trend</SelectItem>
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[140px] text-xs h-8">
              <SelectValue placeholder="All methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {methodData.map((m) => (
                <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="erp-card px-4 py-3 flex items-start gap-3"
          >
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <k.Icon className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
              <p className="text-xl font-bold mt-0.5">{k.value}</p>
              <p className={`text-xs mt-0.5 ${k.trendUp ? "text-emerald-600" : "text-rose-500"}`}>
                {k.trend}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Bar — by method */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="erp-card p-5"
        >
          <p className="section-label mb-4">Collection by Method</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodData} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => money(v)}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive>
                  {methodData.map((m) => (
                    <Cell key={m.name} fill={m.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Line — trend */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="erp-card p-5"
        >
          <p className="section-label mb-4">Collection Trend</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey={range === "monthly" ? "name" : "day"} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Line type="monotone" dataKey="collected" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} name="Collected" />
                {"outstanding" in (trendData[0] || {}) && (
                  <Line type="monotone" dataKey="outstanding" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Outstanding" />
                )}
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Donut — method share */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.29 }}
          className="erp-card p-5"
        >
          <p className="section-label mb-4">Method Share</p>
          <div className="h-[220px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={methodData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={3}
                  isAnimationActive
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {methodData.map((m) => (
                    <Cell key={m.name} fill={m.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {methodData.map((m) => (
              <div key={m.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full" style={{ background: m.color }} />
                {m.name}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Method breakdown cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {methodData.map((m, i) => {
          const Icon = METHOD_ICONS[m.name] ?? CreditCard;
          return (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="erp-card px-4 py-3 flex items-center gap-3"
              style={{ borderLeft: `3px solid ${m.color}` }}
            >
              <Icon className="size-5 shrink-0" style={{ color: m.color }} />
              <div>
                <p className="text-xs text-muted-foreground">{m.name}</p>
                <p className="font-bold text-sm">{money(m.value)}</p>
                <p className="text-xs text-muted-foreground">{totalDonut ? ((m.value / totalDonut) * 100).toFixed(1) : "0.0"}%</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Receivables ageing */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="erp-card overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Clock className="size-4 text-amber-500" />
          <p className="font-semibold text-sm">Receivables Ageing</p>
          <span className="ml-auto text-xs text-muted-foreground">{data.ageing.length} outstanding</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                {["Owner", "Invoice", "Department", "Amount", "Days Overdue", "Status"].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-bold uppercase tracking-wide ${h === "Amount" ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.ageing.map((row) => (
                <tr key={row.invoice} className="hover:bg-primary-soft/25 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.owner}</td>
                  <td className="px-4 py-3 font-mono text-primary">{row.invoice}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.dept}</td>
                  <td className="px-4 py-3 text-right font-semibold">{money(row.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${row.daysOverdue > 10 ? "text-rose-500" : row.daysOverdue > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {row.daysOverdue === 0 ? "Today" : `${row.daysOverdue}d`}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusPill value={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
