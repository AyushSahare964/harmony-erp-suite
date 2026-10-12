// Graph report data and the green / yellow / red rules (ported from reference/vetos-dashboard-v3.html).
import {
  LAB_PARAMS,
  LAB_REPORTS,
  PROBLEM_ON,
  PURCHASE_INVOICES,
  VISITS,
  invoiceTotal,
} from "@/data/doctor/history";
import type { Pet, Section } from "@/data/doctor/types";
import { dayDiff, rupee } from "./format";
import { petHistory } from "./records";

export type Zone = "g" | "y" | "r";

export interface Point {
  date: Date;
  v: number;
  sub: string;
  /** Overall-status points only. */
  z?: Zone;
  why?: string;
  text?: string;
}

export interface Metric {
  key: string;
  name: string;
  unit: string;
  hint?: string;
  lo?: number;
  hi?: number;
  rangeText?: string;
  /** Coloured by change from the previous record (weight). */
  trend?: boolean;
  /** Three-lane Normal / Warning / Danger chart. */
  special?: "status";
  fmt?: (v: number) => string;
  points: Point[];
}

export interface GraphData {
  title: string;
  def: string;
  metrics: Metric[];
}

export interface ZoneInfo {
  z: Zone | null;
  dir?: string | undefined;
  why?: string | undefined;
}

export const ZONE_COLOR: Record<Zone, string> = { g: "#2f9e6b", y: "#e5a512", r: "#d64541" };
export const ZONE_TEXT: Record<Zone, string> = { g: "#08233f", y: "#8a5a00", r: "#b3261e" };
export const ZONE_WORD: Record<Zone, string> = { g: "Normal", y: "Warning", r: "Danger" };
export const ZONE_HEAD: Record<Zone, string> = {
  g: "Green: normal readings",
  y: "Yellow: warning, keep an eye on these",
  r: "Red: danger, problems found",
};

const WHY: Record<string, { high: string; low: string }> = {
  hb: {
    high: "Hemoglobin is high. The blood was thick, often from dehydration.",
    low: "Hemoglobin is low. This can mean anemia or blood loss.",
  },
  rbc: {
    high: "Red blood cells are high. This often happens with dehydration.",
    low: "Red blood cells are low. This can mean anemia.",
  },
  pcv: {
    high: "PCV is high. The body lost water (dehydration).",
    low: "PCV is low. This can mean anemia.",
  },
  wbc: {
    high: "White blood cells are high. The body was fighting an infection or stress.",
    low: "White blood cells are low. The body's defence may be weak.",
  },
  plt: {
    high: "Platelets are high. This can come from inflammation.",
    low: "Platelets are low. Bleeding or clotting problems are possible.",
  },
  glu: {
    high: "Blood sugar is high. This can come from stress, illness or diabetes.",
    low: "Blood sugar is low. The pet may not have eaten enough.",
  },
  cre: {
    high: "Creatinine is high. The kidneys were under stress, often from dehydration.",
    low: "Creatinine is low. This is not usually a problem.",
  },
  bun: {
    high: "BUN is high. The kidneys were under stress, often from dehydration.",
    low: "BUN is low. The liver or diet may be the cause.",
  },
  alt: {
    high: "ALT is high. The liver was under stress.",
    low: "ALT is low. This is not usually a problem.",
  },
  t: {
    high: "Temperature is high. This can be a fever from an infection.",
    low: "Temperature is low. The pet may be cold or unwell.",
  },
};

/**
 * Zone rule. Range metrics: inside the range but within 10% of the range width from a limit = yellow;
 * outside by more than 10% = red; else green. Trend metrics (weight): change from the previous record,
 * up to 1.5% green, up to 3% yellow, more red. Others (money, counts) are not coloured.
 */
export function zonesFor(m: Metric, pts: Point[]): ZoneInfo[] {
  if (m.special === "status") return pts.map((q) => ({ z: q.z ?? null, why: q.why }));
  return pts.map((q, i) => {
    let z: Zone | null = null;
    let dir: string | undefined;
    if (m.lo != null && m.hi != null) {
      const tol = (m.hi - m.lo) * 0.1;
      if (q.v < m.lo - tol) [z, dir] = ["r", "low"];
      else if (q.v > m.hi + tol) [z, dir] = ["r", "high"];
      else if (q.v < m.lo + tol) [z, dir] = ["y", q.v < m.lo ? "low" : "lowedge"];
      else if (q.v > m.hi - tol) [z, dir] = ["y", q.v > m.hi ? "high" : "highedge"];
      else z = "g";
    } else if (m.trend) {
      if (i === 0) z = "g";
      else {
        const prev = pts[i - 1]!.v;
        const pct = (Math.abs(q.v - prev) / prev) * 100;
        z = pct <= 1.5 ? "g" : pct <= 3 ? "y" : "r";
        dir = q.v > prev ? "up" : "down";
      }
    }
    if (!z) return { z: null };
    let s: string;
    if (m.trend)
      s =
        i === 0
          ? "This is the first record, so it is the starting weight."
          : z === "g"
            ? "Weight is steady compared with the last record."
            : `Weight went ${dir} by ${Math.abs(q.v - pts[i - 1]!.v).toFixed(1)} kg since the last record. Watch food and exercise.`;
    else if (z === "g") s = "Inside the normal range. No problem.";
    else if (WHY[m.key] && (dir === "high" || dir === "low")) s = WHY[m.key]![dir];
    else if (dir === "highedge")
      s =
        m.key === "t"
          ? "Temperature is at the upper limit. A slight fever level."
          : "Close to the upper limit. Keep an eye on it.";
    else if (dir === "lowedge") s = "Close to the lower limit. Keep an eye on it.";
    else
      s = `${m.name} is ${dir === "high" ? "above" : "below"} the normal range (${m.rangeText}).`;
    const prob = PROBLEM_ON[q.date.getTime()];
    if (z !== "g" && prob) s += ` Problem at that time: ${prob}.`;
    return { z, dir, why: s };
  });
}

const byDate = (pts: Point[]) => pts.slice().sort((a, b) => a.date.getTime() - b.date.getTime());

/** Overall status: three lanes; each report takes its worst test. */
function overallMetric(metrics: Metric[], name: string, hint: string): Metric {
  const sorted = metrics.map((m) => byDate(m.points));
  const zs = metrics.map((m, j) => zonesFor(m, sorted[j]!));
  const say = (d?: string) =>
    ({
      high: "is high",
      low: "is low",
      highedge: "is near the upper limit",
      lowedge: "is near the lower limit",
      up: "went up a lot",
      down: "went down a lot",
    })[d ?? ""] ?? "is out of range";
  const points = sorted[0]!.map((base, i): Point => {
    const c = { g: 0, y: 0, r: 0 };
    const issues: string[] = [];
    metrics.forEach((m, j) => {
      const zz = zs[j]![i]!;
      if (!zz.z) return;
      c[zz.z]++;
      if (zz.z !== "g") issues.push(`${m.name} ${say(zz.dir)}`);
    });
    const z: Zone = c.r ? "r" : c.y ? "y" : "g";
    let why =
      z === "g"
        ? `All ${c.g} tests are normal.`
        : `${z === "r" ? "Danger. " : "Warning. "}${issues.join(", ")}.`;
    const prob = PROBLEM_ON[base.date.getTime()];
    if (z !== "g" && prob) why += ` Problem at that time: ${prob}.`;
    return {
      date: base.date,
      v: z === "g" ? 0 : z === "y" ? 1 : 2,
      z,
      why,
      text: `${c.g} normal · ${c.y} warning · ${c.r} danger`,
      sub: base.sub,
    };
  });
  return { key: "overall", name, hint, special: "status", unit: "", points };
}

export function graphData(p: Pet, section: Section): GraphData {
  const h = petHistory(p);
  const gaps = <T extends { date: Date }>(rows: T[], label: (r: T) => string): Point[] =>
    rows.slice(0, -1).map((r, i) => {
      const d = dayDiff(r.date, rows[i + 1]!.date);
      return { date: r.date, v: d, sub: `${label(r)} · ${d} days after the dose before` };
    });

  if (section === "lab") {
    const base: Metric[] = LAB_PARAMS.map((pm, i) => ({
      key: pm.key,
      name: pm.name,
      unit: pm.unit,
      lo: pm.lo,
      hi: pm.hi,
      rangeText: `Normal ${pm.lo} to ${pm.hi}`,
      points: LAB_REPORTS.map((r) => ({
        date: r.date,
        v: r.values[i] ?? 0,
        sub: `${r.title} · ${r.by}`,
      })),
    }));
    return {
      title: "Blood report graph",
      def: "overall",
      metrics: [overallMetric(base, "Overall status", "All tests together"), ...base],
    };
  }
  if (section === "medical") {
    const sub = (r: (typeof VISITS)[number]) => `${r.title} · ${r.by}`;
    const base: Metric[] = [
      {
        key: "w",
        name: "Weight",
        unit: "kg",
        trend: true,
        points: VISITS.map((r) => ({ date: r.date, v: r.weight, sub: sub(r) })),
      },
      {
        key: "t",
        name: "Temperature",
        unit: "°F",
        lo: 100.5,
        hi: 102.5,
        rangeText: "Normal 100.5 to 102.5",
        points: VISITS.map((r) => ({ date: r.date, v: r.temp, sub: sub(r) })),
      },
      {
        key: "h",
        name: "Heart rate",
        unit: "per minute",
        lo: 70,
        hi: 140,
        rangeText: "Normal 70 to 140",
        points: VISITS.map((r) => ({ date: r.date, v: r.heart, sub: sub(r) })),
      },
    ];
    const bill: Metric = {
      key: "b",
      name: "Visit bill",
      unit: "₹",
      fmt: rupee,
      points: VISITS.map((r) => ({ date: r.date, v: r.bill, sub: sub(r) })),
    };
    return {
      title: "Health journey graph",
      def: "overall",
      metrics: [overallMetric(base, "Overall health", "All checks together"), ...base, bill],
    };
  }
  if (section === "vaccine")
    return {
      title: "Vaccine graph",
      def: "g",
      metrics: [
        {
          key: "g",
          name: "Days between doses",
          unit: "days",
          lo: 350,
          hi: 380,
          rangeText: "On time: about once a year",
          points: gaps(h.vaccines, (r) => r.name),
        },
        {
          key: "w",
          name: "Weight on the day",
          unit: "kg",
          points: h.vaccines.map((r) => ({
            date: r.date,
            v: r.weight,
            sub: `${r.name} · ${r.by}`,
          })),
        },
      ],
    };
  if (section === "deworm")
    return {
      title: "Deworming graph",
      def: "g",
      metrics: [
        {
          key: "g",
          name: "Days between doses",
          unit: "days",
          lo: 85,
          hi: 100,
          rangeText: "On time: about every 3 months",
          points: gaps(h.deworms, () => p.deworm.name),
        },
        {
          key: "w",
          name: "Weight on the day",
          unit: "kg",
          trend: true,
          points: h.deworms.map((r) => ({
            date: r.date,
            v: r.weight,
            sub: `${p.deworm.name} · ${r.by}`,
          })),
        },
      ],
    };

  // purchase: money and item counts per visit day
  const byDay = new Map<number, { date: Date; spent: number; items: number; nos: string[] }>();
  for (const no of PURCHASE_INVOICES) {
    const v = h.invoices[no]!;
    const k = v.date.getTime();
    const day = byDay.get(k) ?? { date: v.date, spent: 0, items: 0, nos: [] };
    day.spent += invoiceTotal(v);
    day.items += v.items.length;
    day.nos.push(no);
    byDay.set(k, day);
  }
  const days = [...byDay.values()];
  return {
    title: "Spending graph",
    def: "s",
    metrics: [
      {
        key: "s",
        name: "Money spent",
        unit: "₹",
        fmt: rupee,
        points: days.map((d) => ({
          date: d.date,
          v: d.spent,
          sub: `Invoices: ${d.nos.join(", ")}`,
        })),
      },
      {
        key: "i",
        name: "Items bought",
        unit: "items",
        points: days.map((d) => ({
          date: d.date,
          v: d.items,
          sub: `Invoices: ${d.nos.join(", ")}`,
        })),
      },
    ],
  };
}

export const sortedPoints = byDate;
export const valFmt = (m: Metric, v: number) => (m.fmt ? m.fmt(v) : String(+v.toFixed(2)));
export const valUnit = (m: Metric, v: number, q?: Point) =>
  m.special && q ? (q.text ?? "") : valFmt(m, v) + (m.unit && !m.fmt ? ` ${m.unit}` : "");
