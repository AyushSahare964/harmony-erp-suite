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
import { FileText, Stethoscope, User, Calendar, Activity } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

const REPORT_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];

export function ClinicalAnalyticsTab({ data, onDrilldown }: Props) {
  const { clinicalAnalytics } = data;
  const totalReports = clinicalAnalytics.reportsByCategory.reduce((sum, c) => sum + c.count, 0);
  const uniquePatients = clinicalAnalytics.reportsPerPatient.length;
  const avgReportsPerPatient =
    uniquePatients > 0 ? (totalReports / uniquePatients).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* 4 Clinical Documentation KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{
            label: "TOTAL CLINICAL REPORTS",
            value: totalReports.toString(),
            trend: "Encounter records",
            trendTone: "up",
          }}
          index={0}
        />
        <KpiCard
          kpi={{
            label: "PATIENTS WITH REPORTS",
            value: uniquePatients.toString(),
            trend: "Distinct dossiers",
            trendTone: "up",
          }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "AVG REPORTS / PATIENT",
            value: avgReportsPerPatient,
            trend: "Documentation depth",
            trendTone: "up",
          }}
          index={2}
        />
        <KpiCard
          kpi={{
            label: "ACTIVE CLINICIANS",
            value: clinicalAnalytics.reportsByDoctor.length.toString(),
            trend: "Authoring doctors",
            trendTone: "up",
          }}
          index={3}
        />
      </div>

      {/* Reports by Category & Authoring Doctor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              REPORTS BY SPECIALTY CATEGORY
            </p>
            <p className="text-[11px] text-muted-foreground">Distribution across consultation, radiology, surgery, and discharge</p>
          </div>

          {clinicalAnalytics.reportsByCategory.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              No clinical reports recorded for the selected period
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={clinicalAnalytics.reportsByCategory}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {clinicalAnalytics.reportsByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={REPORT_COLORS[index % REPORT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                      formatter={(val: any) => [`${val} reports`, "Volume"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {clinicalAnalytics.reportsByCategory.map((cat, i) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() =>
                      onDrilldown({
                        title: `Report Category: ${cat.category}`,
                        type: "clinical-category",
                        data: cat,
                      })
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: REPORT_COLORS[i % REPORT_COLORS.length] }}
                      />
                      <span className="font-medium truncate max-w-[100px]">{cat.category}</span>
                    </div>
                    <span className="font-bold">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Doctor Documentation Volume */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              REPORTS BY VETERINARY CLINICIAN
            </p>
            <p className="text-[11px] text-muted-foreground">Documented summaries authored per practitioner</p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clinicalAnalytics.reportsByDoctor} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="doctor" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} reports`, "Authored"]}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Reports per Patient Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            PATIENT DOSSIER DOCUMENTATION DENSITY
          </p>
          <p className="text-[11px] text-muted-foreground">Patients with active clinical notes, attachments, and summaries</p>
        </div>

        {clinicalAnalytics.reportsPerPatient.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No patient clinical files recorded for the selected period
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="p-2.5">Patient Name</th>
                  <th className="p-2.5">Owner / Parent</th>
                  <th className="p-2.5 text-center">Reports Count</th>
                  <th className="p-2.5">Recent Category</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clinicalAnalytics.reportsPerPatient.map((item) => (
                  <tr key={item.petId} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2.5 font-medium flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      {item.pet}
                    </td>
                    <td className="p-2.5 text-muted-foreground">{item.owner}</td>
                    <td className="p-2.5 text-center font-bold">{item.count}</td>
                    <td className="p-2.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {item.latestCategory}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() =>
                          onDrilldown({
                            title: `Patient Dossier: ${item.pet}`,
                            type: "patient-dossier",
                            data: item,
                          })
                        }
                        className="text-[11px] text-primary hover:underline font-semibold"
                      >
                        Inspect Record →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
