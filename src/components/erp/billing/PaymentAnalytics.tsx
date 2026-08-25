import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, CreditCard, Banknote, Smartphone,
  Building2, Zap, Clock,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/erp/StatusPill";

/* ─── Data ───────────────────────────────────────────────────────── */
const METHOD_DATA = [
  { name: "Cash",      value: 38400, color: "#10b981" },
  { name: "UPI",       value: 51200, color: "#6366f1" },
  { name: "Card",      value: 22800, color: "#f59e0b" },
  { name: "Bank",      value: 9600,  color: "#3b82f6" },
  { name: "Razorpay",  value: 17650, color: "#ec4899" },
];

const DAILY_TREND = [
  { day: "10 Aug", collected: 98200, outstanding: 14200 },
  { day: "11 Aug", collected: 112400, outstanding: 12600 },
  { day: "12 Aug", collected: 88700, outstanding: 18300 },
  { day: "13 Aug", collected: 124850, outstanding: 11400 },
  { day: "14 Aug", collected: 109300, outstanding: 13800 },
  { day: "15 Aug", collected: 139650, outstanding: 9200 },
  { day: "16 Aug", collected: 124850, outstanding: 16800 },
];

const MONTHLY_TREND = [
  { name: "Mar", value: 182000 },
  { name: "Apr", value: 194000 },
  { name: "May", value: 201000 },
  { name: "Jun", value: 208000 },
  { name: "Jul", value: 210000 },
  { name: "Aug", value: 216000 },
];

const AGEING_DATA = [
  { owner: "Deepika Iyer", invoice: "INV-20483", dept: "Laboratory", amount: 1650, daysOverdue: 5, status: "Overdue" },
  { owner: "Rajan Kumar",  invoice: "INV-20484", dept: "OPD",        amount: 600,  daysOverdue: 3, status: "Overdue" },
  { owner: "Vikram Shetty",invoice: "INV-20485", dept: "Boarding",   amount: 4500, daysOverdue: 0, status: "Partial" },
  { owner: "Meena Joshi",  invoice: "INV-20479", dept: "Swimming",   amount: 1300, daysOverdue: 12,status: "Overdue" },
  { owner: "Farhan Mirza", invoice: "INV-20471", dept: "OPD",        amount: 900,  daysOverdue: 21,status: "Overdue" },
];

const KPIS = [
  { label: "Total Collected (MTD)", value: "₹21.6L", trend: "+9.4%", trendUp: true, Icon: TrendingUp },
  { label: "Outstanding",           value: "₹38,400", trend: "+₹4.2k", trendUp: false, Icon: TrendingDown },
  { label: "Refunded (MTD)",        value: "₹6,400",  trend: "3 requests", trendUp: true, Icon: CreditCard },
  { label: "Razorpay Success Rate", value: "96.8%",   trend: "+1.2%",   trendUp: true, Icon: Zap },
];

const METHOD_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Cash: Banknote, UPI: Smartphone, Card: CreditCard, Bank: Building2, Razorpay: Zap,
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
export function PaymentAnalytics() {
  const [range, setRange] = useState("7d");
  const [method, setMethod] = useState("all");
  const trendData = range === "monthly" ? MONTHLY_TREND : DAILY_TREND;
  const totalDonut = METHOD_DATA.reduce((s, m) => s + m.value, 0);

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
              {METHOD_DATA.map((m) => (
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
              <BarChart data={METHOD_DATA} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => money(v)}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive>
                  {METHOD_DATA.map((m) => (
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
                  data={METHOD_DATA}
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
                  {METHOD_DATA.map((m) => (
                    <Cell key={m.name} fill={m.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {METHOD_DATA.map((m) => (
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
        {METHOD_DATA.map((m, i) => {
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
                <p className="text-xs text-muted-foreground">{((m.value / totalDonut) * 100).toFixed(1)}%</p>
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
          <span className="ml-auto text-xs text-muted-foreground">{AGEING_DATA.length} outstanding</span>
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
              {AGEING_DATA.map((row) => (
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
