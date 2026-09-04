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
