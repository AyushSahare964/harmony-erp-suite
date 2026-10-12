import { parseDate } from "./dates";

/** "14 Aug 2025" */
export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Whole days from b to a. */
export const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

export const rupee = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const today = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

export type Tone = "ok" | "soon" | "late";

/** Red "Overdue by N days", yellow "Due in N days" (14 days or less), green otherwise. */
export function dueState(dueIso: string): { tone: Tone; label: string } {
  const d = dayDiff(parseDate(dueIso), today());
  if (d < 0) return { tone: "late", label: `Overdue by ${-d} day${-d === 1 ? "" : "s"}` };
  if (d === 0) return { tone: "soon", label: "Due today" };
  if (d <= 14) return { tone: "soon", label: `Due in ${d} day${d === 1 ? "" : "s"}` };
  return { tone: "ok", label: `Due in ${d} days` };
}
