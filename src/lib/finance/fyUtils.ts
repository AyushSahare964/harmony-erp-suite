/**
 * Indian financial-year helpers for document numbering and statutory periods.
 *
 * FY runs 1 April – 31 March. The FY of a document is always derived from its
 * own docDate, never from today — a bill dated 28/03/2027 belongs to FY 2026-27
 * even if it is entered on 02/04/2027.
 */

import { formatDisplayDate } from "@/lib/utils/dateUtils";

/** FY code for an ISO date, e.g. "2026-09-16" → "2026-27". */
export function fyCodeFor(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number) as [number, number];
  if (!y || !m) throw new Error(`fyCodeFor: invalid ISO date "${isoDate}"`);
  const fyStart = m >= 4 ? y : y - 1;
  return `${fyStart}-${String(fyStart + 1).slice(2)}`;
}

/** ISO bounds of an FY code, e.g. "2026-27" → 2026-04-01 … 2027-03-31. */
export function fyBounds(fyCode: string): { from: string; to: string } {
  const start = parseInt(fyCode.slice(0, 4), 10);
  if (!start) throw new Error(`fyBounds: invalid FY code "${fyCode}"`);
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

/** Human FY label, e.g. "FY 2026-27 (01/04/2026 – 31/03/2027)". */
export function fyLabel(fyCode: string): string {
  const { from, to } = fyBounds(fyCode);
  return `FY ${fyCode} (${formatDisplayDate(from)} – ${formatDisplayDate(to)})`;
}

/** Does this ISO date fall inside the given FY? */
export function isInFy(isoDate: string, fyCode: string): boolean {
  const { from, to } = fyBounds(fyCode);
  return isoDate >= from && isoDate <= to;
}

/** The FY code immediately before the given one, e.g. "2026-27" → "2025-26". */
export function prevFyCode(fyCode: string): string {
  const start = parseInt(fyCode.slice(0, 4), 10) - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

/**
 * Build a document number.
 * @example buildDocNumber("INV", "2026-27", 42, 4) → "INV/2026-27/0042"
 */
export function buildDocNumber(prefix: string, fyCode: string, seq: number, padding = 4): string {
  return `${prefix}/${fyCode}/${String(seq).padStart(padding, "0")}`;
}

/** Split a document number back into its parts. Returns null if it doesn't match. */
export function parseDocNumber(
  docNumber: string,
): { prefix: string; fyCode: string; seq: number } | null {
  const m = docNumber.match(/^([A-Z]+)\/(\d{4}-\d{2})\/(\d+)$/);
  if (!m) return null;
  return { prefix: m[1]!, fyCode: m[2]!, seq: parseInt(m[3]!, 10) };
}

/** ISO bounds of a calendar month, e.g. "2026-09" → 2026-09-01 … 2026-09-30. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  if (!y || !m || m < 1 || m > 12) throw new Error(`monthBounds: invalid month "${month}"`);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}
