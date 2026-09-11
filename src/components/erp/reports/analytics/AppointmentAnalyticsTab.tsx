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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CalendarClock, Phone, MessageSquare, Share2, Eye } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

const COLORS = ["#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ef4444"];

export function AppointmentAnalyticsTab({ data, onDrilldown }: Props) {
  const { overview, appointmentAnalytics } = data;

  return (
    <div className="space-y-6">
      {/* 4 Appointment Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{ label: "TOTAL APPOINTMENTS", value: String(overview.totalAppointments), trend: "In period", trendTone: "up" }}
          index={0}
        />
        <KpiCard
          kpi={{ label: "COMPLETED ENCOUNTERS", value: String(overview.completedAppointments), trend: "Successfully seen", trendTone: "up" }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "NO-SHOWS",
            value: String(overview.noShowAppointments),
            trend: "Patient absent",
            trendTone: overview.noShowAppointments > 0 ? "down" : "flat",
          }}
          index={2}
        />
        <KpiCard
          kpi={{ label: "WAITING / IN QUEUE", value: String(overview.waitingAppointments), trend: "Live OPD queue", trendTone: "flat" }}
          index={3}
        />
      </div>

      {/* Charts: Appointments Timeline & Visit Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              APPOINTMENT DEMAND TREND
            </p>
            <p className="text-[11px] text-muted-foreground">Daily booking volume over the selected period</p>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={appointmentAnalytics.appointmentTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} appointments`, "Volume"]}
                />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              CLINICAL VISIT TYPE DISTRIBUTION
            </p>
            <p className="text-[11px] text-muted-foreground">Consultations, vaccinations, follow-ups, and procedures</p>
          </div>

          <div className="h-[210px] w-full flex items-center justify-center">
            {appointmentAnalytics.typeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appointmentAnalytics.typeBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="count"
                    label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                  >
                    {appointmentAnalytics.typeBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                    formatter={(val: any) => [`${val} visits`, "Volume"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground italic">No data available for the selected period</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Booking Channel & Conversion Table (Call / WhatsApp / Social Media) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              BOOKING CHANNEL INFLOW &amp; OUTCOME CONVERSION (Call vs WhatsApp vs Social Media)
            </p>
            <p className="text-[11px] text-muted-foreground">
              Conversion rate from booking acquisition to completed consultation
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            Channel Acquisition
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">CHANNEL / SOURCE</th>
                <th className="px-4 py-3 text-center">TOTAL BOOKINGS</th>
                <th className="px-4 py-3 text-center">COMPLETED</th>
                <th className="px-4 py-3 text-center">CANCELLED / NO-SHOW</th>
                <th className="px-4 py-3 text-right">CONVERSION RATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointmentAnalytics.channelBreakdown.map((ch) => (
                <tr key={ch.channel} className="hover:bg-primary-soft/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      {ch.channel === "Call" && <Phone className="size-3.5 text-sky-600" />}
                      {ch.channel === "WhatsApp" && <MessageSquare className="size-3.5 text-emerald-600" />}
                      {ch.channel === "Social Media" && <Share2 className="size-3.5 text-purple-600" />}
                      <span>{ch.channel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-foreground">{ch.count}</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-600">{ch.completed}</td>
                  <td className="px-4 py-3 text-center font-bold text-destructive">{ch.cancelledOrNoShow}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">
                    <span className="bg-primary/10 px-2 py-0.5 rounded">{ch.conversionRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Per-Doctor Performance Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              CLINICIAN ENCOUNTER PERFORMANCE
            </p>
            <p className="text-[11px] text-muted-foreground">Caseload handled, completion rate, and average queue wait</p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            Doctor Workload
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">ATTENDING DOCTOR</th>
                <th className="px-4 py-3 text-center">APPOINTMENTS</th>
                <th className="px-4 py-3 text-center">COMPLETED</th>
                <th className="px-4 py-3 text-center">NO-SHOWS</th>
                <th className="px-4 py-3 text-right">AVG. WAIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointmentAnalytics.doctorPerformance.map((doc) => (
                <tr key={doc.doctor} className="hover:bg-primary-soft/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{doc.doctor}</td>
                  <td className="px-4 py-3 text-center font-bold">{doc.total}</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-600">{doc.completed}</td>
                  <td className="px-4 py-3 text-center font-bold text-destructive">{doc.noShow}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {doc.avgWaitMins} min
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
