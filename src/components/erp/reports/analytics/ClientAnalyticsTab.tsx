import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Users, Eye, Phone } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

export function ClientAnalyticsTab({ data, onDrilldown }: Props) {
  const { overview, clientAnalytics } = data;

  return (
    <div className="space-y-6">
      {/* 4 Client Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{ label: "REGISTERED CLIENTS", value: String(overview.totalClients), trend: "All pet parents", trendTone: "up" }}
          index={0}
        />
        <KpiCard
          kpi={{ label: "ACTIVE CLIENTS", value: String(overview.activeClients), trend: "Healthy accounts", trendTone: "up" }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "CLIENTS WITH DUES",
            value: String(overview.clientsWithOutstanding),
            trend: "Follow-up required",
            trendTone: overview.clientsWithOutstanding > 0 ? "down" : "flat",
          }}
          index={2}
        />
        <KpiCard
          kpi={{ label: "AVG. SPEND / CLIENT", value: `₹${overview.avgInvoiceValue * 2}`, trend: "LTV proxy", trendTone: "up" }}
          index={3}
        />
      </div>

      {/* Charts: Acquisition Trend & Retention Cohort */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              NEW CLIENT ACQUISITION TIMELINE
            </p>
            <p className="text-[11px] text-muted-foreground">Monthly onboarding growth of pet parents</p>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={clientAnalytics.acquisitionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} new clients`, "Acquisition"]}
                />
                <Line type="monotone" dataKey="newClients" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              CLIENT ENGAGEMENT &amp; RETENTION COHORTS
            </p>
            <p className="text-[11px] text-muted-foreground">Regular attendees vs first-time vs dormant profiles</p>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientAnalytics.retentionCohorts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} clients`, "Count"]}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Top Clients Ranked Table with Drill-down */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              TOP CLIENTS BY VISIT DENSITY &amp; REVENUE
            </p>
            <p className="text-[11px] text-muted-foreground">Ranked by overall spending and clinic patronage</p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            Top 10 Pet Parents
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">CLIENT ID</th>
                <th className="px-4 py-3">CLIENT NAME</th>
                <th className="px-4 py-3">CONTACT</th>
                <th className="px-4 py-3 text-center">REGISTERED PETS</th>
                <th className="px-4 py-3 text-center">VISITS</th>
                <th className="px-4 py-3 text-right">TOTAL SPEND</th>
                <th className="px-4 py-3 text-right">OUTSTANDING</th>
                <th className="px-4 py-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clientAnalytics.topClients.map((c) => (
                <tr key={c.ownerId} className="hover:bg-primary-soft/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                      {c.ownerId}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{c.phone}</td>
                  <td className="px-4 py-3 text-center font-bold">{c.petsCount}</td>
                  <td className="px-4 py-3 text-center font-bold">{c.totalVisits}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">
                    ₹{c.totalSpend.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {c.outstanding > 0 ? (
                      <span className="text-destructive">₹{c.outstanding.toLocaleString("en-IN")}</span>
                    ) : (
                      <span className="text-emerald-600">₹0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDrilldown({ title: `Client Dossier: ${c.name} (${c.ownerId})`, type: "Client Profile", data: c })}
                      className="h-7 text-xs font-semibold text-primary"
                    >
                      <Eye className="size-3 mr-1" /> View Profile
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
