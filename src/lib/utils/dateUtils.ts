/**
 * VetOS Shared Date Utilities
 * ────────────────────────────
 * Global date standard: DD/MM/YYYY for all display, input placeholders, invoices, receipts.
 * Storage/internal: YYYY-MM-DD (ISO) for <input type="date"> and DB fields.
 *
 * NEVER format dates inline in components — always use these helpers.
 */

/**
 * Format an ISO date string (YYYY-MM-DD) or Date object to DD/MM/YYYY for display.
 * Returns empty string if input is falsy or invalid.
 *
 * @example formatDisplayDate("2026-09-05") → "05/09/2026"
 * @example formatDisplayDate(new Date(2026, 8, 5)) → "05/09/2026"
 */
export function formatDisplayDate(input: string | Date | null | undefined): string {
  if (!input) return "";

  let year: number, month: number, day: number;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return "";
    year = input.getFullYear();
    month = input.getMonth() + 1;
    day = input.getDate();
  } else {
    const str = String(input).trim();
    // Already in DD/MM/YYYY format — return as-is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

    // ISO date: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      year = parseInt(isoMatch[1]!, 10);
      month = parseInt(isoMatch[2]!, 10);
      day = parseInt(isoMatch[3]!, 10);
    } else {
      return str; // Return unknown format as-is rather than silently breaking
    }
  }

  // Pad to 2 digits
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year);

  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Parse a DD/MM/YYYY display string to ISO YYYY-MM-DD for storage and input[type=date].
 * Returns empty string if input is falsy or doesn't match the expected format.
 *
 * @example parseDisplayDate("05/09/2026") → "2026-09-05"
 */
export function parseDisplayDate(ddmmyyyy: string): string {
  if (!ddmmyyyy) return "";
  const str = ddmmyyyy.trim();
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";

  const day = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const year = parseInt(match[3]!, 10);

  if (!isValidDateParts(day, month, year)) return "";

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Validate a DD/MM/YYYY date string.
 * Rejects impossible dates (31/02, 29/02 on non-leap years, month > 12, etc.)
 *
 * @example isValidDisplayDate("31/02/2026") → false
 * @example isValidDisplayDate("29/02/2024") → true (2024 is a leap year)
 * @example isValidDisplayDate("29/02/2026") → false (2026 is not a leap year)
 */
export function isValidDisplayDate(ddmmyyyy: string): boolean {
  if (!ddmmyyyy) return false;
  const match = ddmmyyyy.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const day = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const year = parseInt(match[3]!, 10);

  return isValidDateParts(day, month, year);
}

/**
 * Convert a JS Date to ISO YYYY-MM-DD string.
 * Uses local time, not UTC — appropriate for clinic date entry.
 */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as ISO YYYY-MM-DD string.
 */
export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Get today's date as DD/MM/YYYY display string.
 */
export function todayDisplay(): string {
  return formatDisplayDate(new Date());
}

/**
 * Add days to an ISO date string and return the result as ISO YYYY-MM-DD.
 * @example addDaysToISO("2026-09-05", 7) → "2026-09-12"
 */
export function addDaysToISO(isoDate: string, days: number): string {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T00:00:00");
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/**
 * Add months to an ISO date string and return the result as ISO YYYY-MM-DD.
 */
export function addMonthsToISO(isoDate: string, months: number): string {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T00:00:00");
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

/**
 * Add years to an ISO date string and return the result as ISO YYYY-MM-DD.
 */
export function addYearsToISO(isoDate: string, years: number): string {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T00:00:00");
  date.setFullYear(date.getFullYear() + years);
  return toISODate(date);
}

/**
 * Check if a "next due" date is not before an "administered" date.
 * Both inputs are ISO YYYY-MM-DD strings.
 * Returns true if nextDue >= adminDate (valid), false otherwise.
 */
export function isNextDueAfterAdmin(adminISO: string, nextDueISO: string): boolean {
  if (!adminISO || !nextDueISO) return true; // nothing to validate
  return nextDueISO >= adminISO;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number): number {
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return days[month] ?? 0;
}

function isValidDateParts(day: number, month: number, year: number): boolean {
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2200) return false;
  if (day < 1 || day > daysInMonth(month, year)) return false;
  return true;
}

// ─── Quick Dates Calculator (§1.11, §11.2) ──────────────────────────────────

import { addDays, addMonths, addYears } from "date-fns";

export type QuickDateCode =
  | "TODAY"
  | "3D"
  | "5D"
  | "7D"
  | "14D"
  | "15D"
  | "1M"
  | "3M"
  | "6M"
  | "1Y";

export function calculateQuickDate(
  baseInput: string | Date | null | undefined,
  quickCode: QuickDateCode | string
): string {
  let base: Date;
  if (baseInput instanceof Date) {
    base = new Date(baseInput.getFullYear(), baseInput.getMonth(), baseInput.getDate());
  } else if (typeof baseInput === "string" && baseInput.trim()) {
    const parts = baseInput.trim().split("-");
    if (parts.length === 3) {
      base = new Date(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10) - 1, parseInt(parts[2]!, 10));
    } else {
      const d = new Date(baseInput);
      base = isNaN(d.getTime()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  } else {
    const now = new Date();
    base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const code = (quickCode || "").toUpperCase().trim();
  if (code === "TODAY") {
    return toISODate(base);
  }

  const match = code.match(/^(\d+)([DWMY])$/);
  if (match) {
    const num = parseInt(match[1]!, 10);
    const unit = match[2]!;
    if (unit === "D") return toISODate(addDays(base, num));
    if (unit === "W") return toISODate(addDays(base, num * 7));
    if (unit === "M") return toISODate(addMonths(base, num));
    if (unit === "Y") return toISODate(addYears(base, num));
  }

  switch (code) {
    case "3D": return toISODate(addDays(base, 3));
    case "5D": return toISODate(addDays(base, 5));
    case "7D": return toISODate(addDays(base, 7));
    case "14D": return toISODate(addDays(base, 14));
    case "15D": return toISODate(addDays(base, 15));
    case "1M": return toISODate(addMonths(base, 1));
    case "3M": return toISODate(addMonths(base, 3));
    case "6M": return toISODate(addMonths(base, 6));
    case "1Y": return toISODate(addYears(base, 1));
    default: return toISODate(base);
  }
}

// ─── IST-aware helpers for Accounting & Finance ─────────────────────────────
// The server (Vercel) runs in UTC. Without IST conversion, entries between
// 00:00–05:30 IST land on the wrong calendar date. Use these on both client
// and server wherever "today" or "this month" is computed.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Returns today's ISO date (YYYY-MM-DD) in Asia/Kolkata timezone. */
export function todayIST(): string {
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns {from, to} for the Indian fiscal year (Apr–Mar) containing the given ISO date. */
export function fiscalYearRange(isoDate?: string): { from: string; to: string } {
  const iso = isoDate ?? todayIST();
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const fyStart = m >= 4 ? y : y - 1;
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
}

/** Returns {from, to} for the previous Indian fiscal year. */
export function prevFiscalYearRange(isoDate?: string): { from: string; to: string } {
  const iso = isoDate ?? todayIST();
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const fyStart = m >= 4 ? y - 1 : y - 2;
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
}

/** Indian FY quarter start (Apr/Jul/Oct/Jan) for the given ISO date. */
function quarterStart(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number) as [number, number];
  const fyMonth = ((m - 4 + 12) % 12); // months since April (0=Apr, 1=May…)
  const qStartFyMonth = Math.floor(fyMonth / 3) * 3; // 0, 3, 6, 9
  const calMonth = (qStartFyMonth + 4 - 1) % 12 + 1;
  const calYear = calMonth < 4 ? y + 1 : y;
  return `${calYear}-${String(calMonth).padStart(2, "0")}-01`;
}

export type DatePreset =
  | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "LAST_7" | "THIS_MONTH"
  | "LAST_MONTH" | "LAST_30" | "THIS_QUARTER" | "THIS_FY" | "LAST_FY" | "CUSTOM";

export interface DateRange { from: string; to: string; preset: DatePreset; }

/**
 * Compute {from, to} for each preset. All values are IST-correct ISO dates.
 */
export function presetDateRange(preset: DatePreset): { from: string; to: string } {
  const today = todayIST();

  switch (preset) {
    case "TODAY":
      return { from: today, to: today };

    case "YESTERDAY": {
      const d = addDaysToISO(today, -1);
      return { from: d, to: d };
    }

    case "THIS_WEEK": {
      // Monday of current week
      const dt = new Date(today + "T00:00:00");
      const day = dt.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day;
      const mon = addDaysToISO(today, diff);
      return { from: mon, to: today };
    }

    case "LAST_7":
      return { from: addDaysToISO(today, -6), to: today };

    case "THIS_MONTH": {
      const [y, m] = today.split("-").map(Number) as [number, number];
      const from = `${y}-${String(m).padStart(2, "0")}-01`;
      return { from, to: today };
    }

    case "LAST_MONTH": {
      const [y, m] = today.split("-").map(Number) as [number, number];
      const lm = m === 1 ? 12 : m - 1;
      const ly = m === 1 ? y - 1 : y;
      const from = `${ly}-${String(lm).padStart(2, "0")}-01`;
      // Last day of that month
      const lastDay = new Date(ly, lm, 0).getDate();
      const to = `${ly}-${String(lm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { from, to };
    }

    case "LAST_30":
      return { from: addDaysToISO(today, -29), to: today };

    case "THIS_QUARTER":
      return { from: quarterStart(today), to: today };

    case "THIS_FY":
      return { from: fiscalYearRange(today).from, to: today };

    case "LAST_FY":
      return prevFiscalYearRange(today);

    case "CUSTOM":
    default:
      return { from: today, to: today };
  }
}

/**
 * Given a from/to range, returns the equal-length previous period for comparison.
 * e.g. MTD 01/09–11/09 → previous: 01/08–11/08
 */
export function compareRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  const spanDays = Math.round((t.getTime() - f.getTime()) / 86400000);
  const prevTo = addDaysToISO(from, -1);
  const prevFrom = addDaysToISO(from, -(spanDays + 1));
  return { from: prevFrom, to: prevTo };
}

/** Format a voucher number with Indian FY, e.g. PB/2026-27/0001 */
export function fmtVoucherNo(prefix: string, seq: number, isoDate?: string): string {
  const iso = isoDate ?? todayIST();
  const { from } = fiscalYearRange(iso);
  const fyStart = parseInt(from.slice(0, 4), 10);
  const fyShort = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  return `${prefix}/${fyShort}/${String(seq).padStart(4, "0")}`;
}

