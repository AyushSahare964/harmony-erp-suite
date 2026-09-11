import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, CreditCard, AlertCircle } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

export function BillingRevenueTab({ data, onDrilldown }: Props) {
  const { overview, billingRevenue } = data;

  return (
    <div className="space-y-6">
      {/* 4 Revenue Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{ label: "TOTAL INVOICED", value: `₹${overview.totalRevenue.toLocaleString("en-IN")}`, trend: `${overview.invoiceCount} bills`, trendTone: "up" }}
          index={0}
        />
        <KpiCard
          kpi={{ label: "TOTAL COLLECTED", value: `₹${overview.totalCollected.toLocaleString("en-IN")}`, trend: "Settled payments", trendTone: "up" }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "OUTSTANDING RECEIVABLES",
            value: `₹${overview.totalOutstanding.toLocaleString("en-IN")}`,
            trend: "Patient dues",
            trendTone: overview.totalOutstanding > 0 ? "down" : "flat",
          }}
          index={2}
        />
        <KpiCard
          kpi={{ label: "AVERAGE TICKET SIZE", value: `₹${overview.avgInvoiceValue.toLocaleString("en-IN")}`, trend: "Per encounter", trendTone: "up" }}
          index={3}
        />
      </div>

      {/* Charts: Revenue Timeline & Service Lines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              REVENUE &amp; COLLECTION TRAJECTORY
            </p>
            <p className="text-[11px] text-muted-foreground">Billed vs collected volume over the period</p>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={billingRevenue.revenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString("en-IN")}`, name === "billed" ? "Billed" : "Collected"]}
                />
                <Line type="monotone" dataKey="billed" stroke="#2563eb" strokeWidth={2.5} name="billed" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} name="collected" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              SERVICE LINE REVENUE CONTRIBUTION
            </p>
            <p className="text-[11px] text-muted-foreground">Clinical, pharmacy, diagnostics, boarding, and nutrition</p>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={billingRevenue.serviceLineRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="service" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Billed Total"]}
                />
                <Bar dataKey="amount" fill="#06b6d4" radius={[6, 6, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Invoice Status Distribution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
          <p className="text-[10px] font-bold text-emerald-700 uppercase">Fully Paid Invoices</p>
          <p className="text-2xl font-bold text-emerald-600">{billingRevenue.invoicesSummary.paidCount}</p>
          <p className="text-[11px] text-muted-foreground">Zero outstanding balance</p>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
          <p className="text-[10px] font-bold text-amber-700 uppercase">Partially Paid Invoices</p>
          <p className="text-2xl font-bold text-amber-600">{billingRevenue.invoicesSummary.partialCount}</p>
          <p className="text-[11px] text-muted-foreground">Installment or token advance received</p>
        </div>

        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1">
          <p className="text-[10px] font-bold text-destructive uppercase">Unpaid / Pending Invoices</p>
          <p className="text-2xl font-bold text-destructive">{billingRevenue.invoicesSummary.unpaidCount}</p>
          <p className="text-[11px] text-muted-foreground">Pending reception settlement</p>
        </div>
      </div>
    </div>
  );
}
