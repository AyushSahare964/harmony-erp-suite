import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CreditCard, CheckCircle2, Clock, AlertTriangle, Wallet } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

const METHOD_COLORS: Record<string, string> = {
  Cash: "#10b981",
  UPI: "#6366f1",
  Card: "#2563eb",
  "Net Banking": "#8b5cf6",
  Other: "#64748b",
};

export function PaymentAnalysisTab({ data, onDrilldown }: Props) {
  const { overview, billingRevenue, paymentAnalysis } = data;

  const totalInvoices =
    billingRevenue.invoicesSummary.paidCount +
    billingRevenue.invoicesSummary.partialCount +
    billingRevenue.invoicesSummary.unpaidCount;

  return (
    <div className="space-y-6">
      {/* 4 Payment Health KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{
            label: "1-TIME FULL SETTLEMENTS",
            value: `${paymentAnalysis.oneTimeFullPayPct}%`,
            trend: `${paymentAnalysis.oneTimeFullPayCount} invoices`,
            trendTone: "up",
          }}
          index={0}
        />
        <KpiCard
          kpi={{
            label: "FULL PAYMENT VOLUME",
            value: `₹${paymentAnalysis.oneTimeFullPayCollected.toLocaleString("en-IN")}`,
            trend: "Immediate full clearance",
            trendTone: "up",
          }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "PARTIAL PAYMENT ENCOUNTERS",
            value: `${paymentAnalysis.partialPayCount}`,
            trend: `₹${paymentAnalysis.partialPayCollected.toLocaleString("en-IN")} collected`,
            trendTone: paymentAnalysis.partialPayCount > 0 ? "down" : "flat",
          }}
          index={2}
        />
        <KpiCard
          kpi={{
            label: "TOTAL RECEIVABLE DUES",
            value: `₹${overview.totalOutstanding.toLocaleString("en-IN")}`,
            trend: `${billingRevenue.invoicesSummary.unpaidCount} unpaid`,
            trendTone: overview.totalOutstanding > 0 ? "down" : "flat",
          }}
          index={3}
        />
      </div>

      {/* Payment Settlement Split & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              INVOICE SETTLEMENT STATUS
            </p>
            <p className="text-[11px] text-muted-foreground">Settlement breakdown across all invoices</p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div
              className="p-3.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 transition-colors"
              onClick={() =>
                onDrilldown({
                  title: "Fully Paid Invoices",
                  type: "invoices",
                  data: { status: "Paid", count: billingRevenue.invoicesSummary.paidCount },
                })
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Paid In Full</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-foreground mt-1">
                {billingRevenue.invoicesSummary.paidCount}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {totalInvoices > 0
                  ? `${Math.round((billingRevenue.invoicesSummary.paidCount / totalInvoices) * 100)}% of total`
                  : "No bills"}
              </p>
            </div>

            <div
              className="p-3.5 rounded-lg border bg-amber-500/5 border-amber-500/20 cursor-pointer hover:bg-amber-500/10 transition-colors"
              onClick={() =>
                onDrilldown({
                  title: "Partially Paid Invoices",
                  type: "invoices",
                  data: { status: "Partial", count: billingRevenue.invoicesSummary.partialCount },
                })
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Partially Paid</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-foreground mt-1">
                {billingRevenue.invoicesSummary.partialCount}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {totalInvoices > 0
                  ? `${Math.round((billingRevenue.invoicesSummary.partialCount / totalInvoices) * 100)}% of total`
                  : "No bills"}
              </p>
            </div>

            <div
              className="p-3.5 rounded-lg border bg-rose-500/5 border-rose-500/20 cursor-pointer hover:bg-rose-500/10 transition-colors"
              onClick={() =>
                onDrilldown({
                  title: "Unpaid Invoices",
                  type: "invoices",
                  data: { status: "Unpaid", count: billingRevenue.invoicesSummary.unpaidCount },
                })
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Unpaid</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-xl font-bold text-foreground mt-1">
                {billingRevenue.invoicesSummary.unpaidCount}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {totalInvoices > 0
                  ? `${Math.round((billingRevenue.invoicesSummary.unpaidCount / totalInvoices) * 100)}% of total`
                  : "No bills"}
              </p>
            </div>
          </div>

          <div className="pt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Overall Collection Efficiency:</span>
            <span className="font-semibold text-foreground">
              {overview.totalRevenue > 0
                ? `${Math.round((overview.totalCollected / overview.totalRevenue) * 100)}%`
                : "N/A"}
            </span>
          </div>
        </motion.div>

        {/* Payment Methods Distribution */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              PAYMENT METHOD ADOPTION
            </p>
            <p className="text-[11px] text-muted-foreground">Volume collected via Cash, UPI, and Card</p>
          </div>

          {paymentAnalysis.paymentMethodSplit.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              No payment transactions recorded for this period
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentAnalysis.paymentMethodSplit}
                      dataKey="amount"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {paymentAnalysis.paymentMethodSplit.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={METHOD_COLORS[entry.method] || "#3b82f6"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Collected"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {paymentAnalysis.paymentMethodSplit.map((m) => (
                  <div
                    key={m.method}
                    className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() =>
                      onDrilldown({
                        title: `Payment Method: ${m.method}`,
                        type: "payment-method",
                        data: m,
                      })
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: METHOD_COLORS[m.method] || "#3b82f6" }}
                      />
                      <span className="font-medium">{m.method}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{m.amount.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-muted-foreground">{m.count} txns</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Aging Receivables Analysis */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              OUTSTANDING AGING BUCKETS
            </p>
            <p className="text-[11px] text-muted-foreground">Overdue receivable distribution by aging duration</p>
          </div>
          <Badge variant="outline" className="text-xs">
            Total Outstanding: ₹{overview.totalOutstanding.toLocaleString("en-IN")}
          </Badge>
        </div>

        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentAnalysis.agingBuckets} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                formatter={(val: any, name: any) => [
                  name === "amount" ? `₹${Number(val).toLocaleString("en-IN")}` : val,
                  name === "amount" ? "Outstanding" : "Invoices",
                ]}
              />
              <Bar dataKey="amount" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Aging Bucket Table */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-2.5">Aging Period</th>
                <th className="p-2.5">Unpaid Bills Count</th>
                <th className="p-2.5">Outstanding Amount</th>
                <th className="p-2.5">% of Total Receivables</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paymentAnalysis.agingBuckets.map((bucket) => {
                const pct =
                  overview.totalOutstanding > 0
                    ? Math.round((bucket.amount / overview.totalOutstanding) * 100)
                    : 0;
                return (
                  <tr key={bucket.bucket} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2.5 font-medium">{bucket.bucket}</td>
                    <td className="p-2.5">{bucket.count}</td>
                    <td className="p-2.5 font-bold text-rose-500">₹{bucket.amount.toLocaleString("en-IN")}</td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span>{pct}%</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() =>
                          onDrilldown({
                            title: `Aging Bucket: ${bucket.bucket}`,
                            type: "aging-bucket",
                            data: bucket,
                          })
                        }
                        className="text-[11px] text-primary hover:underline font-semibold"
                      >
                        Inspect Dues →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
