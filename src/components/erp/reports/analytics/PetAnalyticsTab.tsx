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
import { Dog } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

const COLORS = ["#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export function PetAnalyticsTab({ data, onDrilldown }: Props) {
  const { overview, petAnalytics } = data;

  return (
    <div className="space-y-6">
      {/* 4 Pet Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{ label: "REGISTERED PATIENTS", value: String(overview.totalPets), trend: "All cohorts", trendTone: "up" }}
          index={0}
        />
        <KpiCard
          kpi={{ label: "ACTIVE PATIENTS", value: String(overview.activePets), trend: "Under regular care", trendTone: "up" }}
          index={1}
        />
        <KpiCard
          kpi={{ label: "CANINE SHARE", value: `${petAnalytics.speciesSplit.find((s) => s.name === "Canine")?.value || 0}`, trend: "Primary species", trendTone: "flat" }}
          index={2}
        />
        <KpiCard
          kpi={{ label: "FELINE SHARE", value: `${petAnalytics.speciesSplit.find((s) => s.name === "Feline")?.value || 0}`, trend: "Growing segment", trendTone: "up" }}
          index={3}
        />
      </div>

      {/* Charts Row 1: Species Split & Breed Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              SPECIES PROFILE (CANINE vs FELINE vs EXOTIC)
            </p>
            <p className="text-[11px] text-muted-foreground">Breakdown of patient registrations</p>
          </div>

          <div className="h-[230px] w-full flex items-center justify-center">
            {petAnalytics.speciesSplit.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={petAnalytics.speciesSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {petAnalytics.speciesSplit.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                    formatter={(val: any) => [`${val} pets`, "Volume"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground italic">No data available for the selected period</p>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              TOP BREEDS REGISTERED
            </p>
            <p className="text-[11px] text-muted-foreground">Most prevalent breeds attending the hospital</p>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={petAnalytics.topBreeds} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis dataKey="breed" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} patients`, "Count"]}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2: Age Brackets & Visit Frequency Cohorts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              PATIENT AGE DEMOGRAPHICS
            </p>
            <p className="text-[11px] text-muted-foreground">Distribution across pediatric, adult, and geriatric life stages</p>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={petAnalytics.ageBrackets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="bracket" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} pets`, "Volume"]}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              VISIT FREQUENCY COHORTS
            </p>
            <p className="text-[11px] text-muted-foreground">Annual hospital visit density per patient</p>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={petAnalytics.visitFrequencyCohorts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="cohort" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any) => [`${val} patients`, "Count"]}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
