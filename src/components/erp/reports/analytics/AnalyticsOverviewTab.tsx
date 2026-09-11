import { motion } from "framer-motion";
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
} from "recharts";
import {
  Dog,
  Users,
  CalendarClock,
  DollarSign,
  FlaskConical,
  Package,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

const PIE_COLORS = ["#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export function AnalyticsOverviewTab({ data, onDrilldown }: Props) {
  const { overview, petAnalytics, appointmentAnalytics, billingRevenue } = data;

  return (
    <div className="space-y-6">
      {/* ── Executive Cross-Module KPI Grid ───────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Executive Performance Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => onDrilldown({ title: "Registered Pets Overview", type: "Pets", data: petAnalytics.speciesSplit })}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <KpiCard
              kpi={{
                label: "TOTAL PATIENTS",
                value: String(overview.totalPets),
                trend: `${overview.activePets} active`,
                trendTone: "up",
              }}
              index={0}
            />
          </div>

          <div
            onClick={() => onDrilldown({ title: "Client Base Overview", type: "Clients", data: overview })}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <KpiCard
              kpi={{
                label: "TOTAL CLIENTS",
                value: String(overview.totalClients),
                trend: `${overview.clientsWithOutstanding} with dues`,
                trendTone: overview.clientsWithOutstanding > 0 ? "down" : "flat",
              }}
              index={1}
            />
          </div>

          <div
            onClick={() => onDrilldown({ title: "Appointments Overview", type: "Appointments", data: appointmentAnalytics.statusBreakdown })}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <KpiCard
              kpi={{
                label: "APPOINTMENTS",
                value: String(overview.totalAppointments),
                trend: `${overview.completedAppointments} completed`,
                trendTone: "up",
              }}
              index={2}
            />
          </div>

          <div
            onClick={() => onDrilldown({ title: "Gross Revenue Overview", type: "Revenue", data: billingRevenue.serviceLineRevenue })}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <KpiCard
              kpi={{
                label: "TOTAL BILLED",
                value: `₹${(overview.totalRevenue / 1000).toFixed(1)}k`,
                trend: `₹${(overview.totalCollected / 1000).toFixed(1)}k collected`,
                trendTone: "up",
              }}
              index={3}
            />
          </div>

          <div
            onClick={() => onDrilldown({ title: "Laboratory Orders Overview", type: "Lab", data: data.laboratoryAnalytics.statusBreakdown })}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <KpiCard
              kpi={{
                label: "LAB ORDERS",
                value: String(overview.totalLabOrders),
                trend: `${overview.pendingLabOrders} in process`,
                trendTone: "flat",
              }}
              index={4}
            />
          </div>

          <div
            onClick={() => onDrilldown({ title: "Inventory Valuation Overview", type: "Inventory", data: data.inventorySales.categorySplit })}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <KpiCard
              kpi={{
                label: "INVENTORY VALUE",
                value: `₹${(overview.inventoryTotalValue / 1000).toFixed(1)}k`,
                trend: `${overview.lowStockCount} low stock alerts`,
                trendTone: overview.lowStockCount > 0 ? "down" : "up",
              }}
              index={5}
            />
          </div>
        </div>
      </div>

      {/* ── Conversion Funnel: Appointments -> Consultations -> Invoiced -> Paid ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="erp-card p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              END-TO-END PATIENT LIFECYCLE &amp; REVENUE CONVERSION FUNNEL
            </p>
            <p className="text-[11px] text-muted-foreground">
              Booking flow from queue entry to consultation completion and payment settlement
            </p>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
            Conversion Efficiency
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">1. Bookings Issued</p>
            <p className="text-2xl font-bold text-foreground">{overview.conversionFunnel.totalBookings}</p>
            <p className="text-[11px] text-muted-foreground">100% Top of Funnel</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">2. Consultations Done</p>
            <p className="text-2xl font-bold text-primary">{overview.conversionFunnel.completedVisits}</p>
            <p className="text-[11px] text-emerald-600 font-semibold">
              {overview.conversionFunnel.totalBookings > 0
                ? `${Math.round((overview.conversionFunnel.completedVisits / overview.conversionFunnel.totalBookings) * 100)}% visit completion`
                : "0%"}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">3. Invoices Generated</p>
            <p className="text-2xl font-bold text-foreground">{overview.conversionFunnel.invoicesGenerated}</p>
            <p className="text-[11px] text-muted-foreground">
              {overview.conversionFunnel.completedVisits > 0
                ? `${Math.round((overview.conversionFunnel.invoicesGenerated / overview.conversionFunnel.completedVisits) * 100)}% billed`
                : "0%"}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
            <p className="text-[10px] font-bold text-emerald-700 uppercase">4. Fully Settled</p>
            <p className="text-2xl font-bold text-emerald-600">{overview.conversionFunnel.fullyPaidInvoices}</p>
            <p className="text-[11px] text-emerald-600 font-bold">
              {overview.conversionFunnel.invoicesGenerated > 0
                ? `${Math.round((overview.conversionFunnel.fullyPaidInvoices / overview.conversionFunnel.invoicesGenerated) * 100)}% paid in full`
                : "0%"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Charts: Service Line Breakdown & Species Split ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              REVENUE DISTRIBUTION BY SERVICE LINE
            </p>
            <p className="text-[11px] text-muted-foreground">Earnings across clinical, pharmacy, diagnostics, and boarding</p>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={billingRevenue.serviceLineRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="service" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Billed Amount"]}
                />
                <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              PATIENT SPECIES DEMOGRAPHICS
            </p>
            <p className="text-[11px] text-muted-foreground">Active caseload split across Canines, Felines, and Exotics</p>
          </div>

          <div className="h-[220px] w-full flex items-center justify-center">
            {petAnalytics.speciesSplit.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={petAnalytics.speciesSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {petAnalytics.speciesSplit.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                    formatter={(val: any) => [`${val} patients`, "Volume"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground italic">No data available for the selected period</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
