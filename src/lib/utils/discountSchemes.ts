import type { DiscountSchemeRow } from "@/lib/mongodb/serverFns/discountSchemes";

export function todayYmd(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type SchemeStatus = "ongoing" | "upcoming" | "expired" | "inactive";

export function schemeStatus(s: DiscountSchemeRow, today = todayYmd()): SchemeStatus {
  if (!s.isActive) return "inactive";
  if (today < s.startDate) return "upcoming";
  if (today > s.endDate) return "expired";
  return "ongoing";
}

/** Ongoing schemes, best discount first. */
export function ongoingSchemes(all: DiscountSchemeRow[]): DiscountSchemeRow[] {
  return all
    .filter((s) => schemeStatus(s) === "ongoing")
    .sort((a, b) => b.discountPercent - a.discountPercent);
}
