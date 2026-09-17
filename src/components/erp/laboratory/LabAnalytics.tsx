import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ANALYZER_STATUS = [
  { name: "Mindray BC-5000 Vet (Hematology)", status: "Calibrated & Online", lastQC: "Today 07:30 AM", reagentLevel: "88%", nextCalib: "2026-09-01" },
  { name: "Fuji Dri-Chem NX500i (Biochemistry)", status: "Calibrated & Online", lastQC: "Today 08:00 AM", reagentLevel: "92%", nextCalib: "2026-08-30" },
  { name: "Edan i15 Vet (Blood Gas / Electrolytes)", status: "Ready", lastQC: "Yesterday 05:00 PM", reagentLevel: "74%", nextCalib: "2026-09-15" },
  { name: "Olympus CX23 Diagnostic Microscope", status: "Cleaned & Aligned", lastQC: "Weekly Review", reagentLevel: "—", nextCalib: "2026-10-01" },
];

interface Props {
  orders?: any[];
}

export function LabAnalytics({ orders = [] }: Props) {
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const weeklyVolumeData = useMemo(() => {
    const data = daysOfWeek.map((day) => ({ name: day, cbc: 0, biochem: 0, serology: 0 }));

    orders.forEach((o) => {
      const d = o.collected || o.createdAt || o.date;
      if (!d) return;
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return;
      const dayIndex = (dateObj.getDay() + 6) % 7; // Monday=0 .. Sunday=6
      const bucket = data[dayIndex];
      if (!bucket) return;

      const testName = String(o.test || o.testName || "").toLowerCase();
      if (testName.includes("cbc") || testName.includes("blood") || testName.includes("hema")) {
        bucket.cbc += 1;
      } else if (testName.includes("lft") || testName.includes("kft") || testName.includes("chem") || testName.includes("bio")) {
        bucket.biochem += 1;
      } else {
        bucket.serology += 1;
      }
    });

    return data;
  }, [orders]);

  const totalWeeklyTests = useMemo(() => {
    return weeklyVolumeData.reduce((acc, d) => acc + d.cbc + d.biochem + d.serology, 0);
  }, [weeklyVolumeData]);

  const maxWeeklyVal = useMemo(() => {
    return Math.max(0, ...weeklyVolumeData.map((d) => Math.max(d.cbc, d.biochem, d.serology)));
  }, [weeklyVolumeData]);

  return (
    <div className="space-y-6">
      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Volume Chart */}
        <div className="erp-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">WEEKLY TEST VOLUMES</h4>
              <p className="text-[11px] text-muted-foreground">Breakdown of Hematology, Biochemistry &amp; Serology tests</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-primary bg-primary/10">
              {totalWeeklyTests} tests this week
            </Badge>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  domain={[0, maxWeeklyVal > 0 ? "auto" : 5]}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }}
                />
                <Bar dataKey="cbc" name="CBC Hematology" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="biochem" name="Biochemistry" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="serology" name="Serology" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Equipment & Quality Control (QC) Panel */}
        <div className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ANALYZER CALIBRATION &amp; QC STATUS</h4>
              <p className="text-[11px] text-muted-foreground">Automated veterinary diagnostic instruments</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.success("Ran diagnostic QC check on all analyzers.")} className="h-7 text-[11px] gap-1">
              <RotateCcw className="size-3" /> Run QC Test
            </Button>
          </div>

          <div className="space-y-2.5">
            {ANALYZER_STATUS.map((inst) => (
              <div key={inst.name} className="p-3 rounded-xl border border-border bg-card flex items-center justify-between shadow-2xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    <span>{inst.name}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">Last QC: {inst.lastQC} · Next Calibration: {inst.nextCalib}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    {inst.status}
                  </Badge>
                  {inst.reagentLevel !== "—" && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Reagent: {inst.reagentLevel}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
