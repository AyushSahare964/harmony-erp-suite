import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FlaskConical, CheckCircle, Clock, AlertCircle, FileText } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  "in-progress": "#3b82f6",
  pending: "#f59e0b",
  cancelled: "#ef4444",
};

export function LaboratoryAnalyticsTab({ data, onDrilldown }: Props) {
  const { laboratoryAnalytics } = data;
  const totalLabOrders = laboratoryAnalytics.statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  const completedOrders =
    laboratoryAnalytics.statusBreakdown.find((s) => s.status.toLowerCase() === "completed")?.count ?? 0;
  const pendingOrders =
    laboratoryAnalytics.statusBreakdown.find(
      (s) => s.status.toLowerCase() === "pending" || s.status.toLowerCase() === "in-progress"
    )?.count ?? 0;
  const totalLabRevenue = laboratoryAnalytics.topTests.reduce((sum, t) => sum + t.revenue, 0);

  return (
    <div className="space-y-6">
      {/* 4 Laboratory Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{
            label: "TOTAL LAB ORDERS",
            value: totalLabOrders.toString(),
            trend: "Diagnostic requests",
            trendTone: "up",
          }}
          index={0}
        />
        <KpiCard
          kpi={{
            label: "COMPLETED TESTS",
            value: completedOrders.toString(),
            trend: totalLabOrders > 0 ? `${Math.round((completedOrders / totalLabOrders) * 100)}% completion` : "No tests",
            trendTone: "up",
          }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "PENDING / PROCESSING",
            value: pendingOrders.toString(),
            trend: "Active bench work",
            trendTone: pendingOrders > 0 ? "flat" : "up",
          }}
          index={2}
        />
        <KpiCard
          kpi={{
            label: "DIAGNOSTIC REVENUE",
            value: `₹${totalLabRevenue.toLocaleString("en-IN")}`,
            trend: "Direct lab billing",
            trendTone: "up",
          }}
          index={3}
        />
      </div>

      {/* Status Breakdown & Order Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              TEST STATUS DISTRIBUTION
            </p>
            <p className="text-[11px] text-muted-foreground">Completed, pending, and in-progress diagnostic pipeline</p>
          </div>

          {laboratoryAnalytics.statusBreakdown.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              No laboratory tests recorded for the selected period
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={laboratoryAnalytics.statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {laboratoryAnalytics.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status.toLowerCase()] || "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                      formatter={(val: any) => [`${val} orders`, "Status"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {laboratoryAnalytics.statusBreakdown.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() =>
                      onDrilldown({
                        title: `Lab Orders: Status ${s.status}`,
                        type: "lab-status",
                        data: s,
                      })
                    }
                  >
                    <div className="flex items-center gap-2 capitalize">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[s.status.toLowerCase()] || "#64748b" }}
                      />
                      <span className="font-medium">{s.status}</span>
                    </div>
                    <span className="font-bold">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              LAB ORDER TRAJECTORY
            </p>
            <p className="text-[11px] text-muted-foreground">Daily volume of diagnostic investigation requests</p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={laboratoryAnalytics.ordersTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} orders`, "Orders"]}
                />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Top Laboratory Panels Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            TOP DIAGNOSTIC PANELS &amp; PROFILES
          </p>
          <p className="text-[11px] text-muted-foreground">Most frequently requested laboratory investigation panels</p>
        </div>

        {laboratoryAnalytics.topTests.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No diagnostic tests recorded for the selected period
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="p-2.5">Test / Panel Name</th>
                  <th className="p-2.5">Orders Count</th>
                  <th className="p-2.5">Share of Lab Volume</th>
                  <th className="p-2.5">Generated Revenue</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {laboratoryAnalytics.topTests.map((t) => {
                  const share = totalLabOrders > 0 ? Math.round((t.count / totalLabOrders) * 100) : 0;
                  return (
                    <tr key={t.test} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-medium flex items-center gap-2">
                        <FlaskConical className="w-3.5 h-3.5 text-primary" />
                        {t.test}
                      </td>
                      <td className="p-2.5 font-bold">{t.count}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                          <span>{share}%</span>
                        </div>
                      </td>
                      <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{t.revenue.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() =>
                            onDrilldown({
                              title: `Lab Test Panel: ${t.test}`,
                              type: "lab-panel",
                              data: t,
                            })
                          }
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
