/**
 * Indian GST state codes — the first two digits of every GSTIN.
 *
 * This is the single source for every Place of Supply / State dropdown in the
 * finance module. Never hard-code a state list in a component.
 */

export interface StateCode {
  /** Two-digit GST state code, e.g. "27" */
  code: string;
  /** Full state / UT name, e.g. "Maharashtra" */
  name: string;
  /** Short alpha code, e.g. "MH" */
  alpha: string;
}

export const STATE_CODES: readonly StateCode[] = [
  { code: "01", name: "Jammu and Kashmir", alpha: "JK" },
  { code: "02", name: "Himachal Pradesh", alpha: "HP" },
  { code: "03", name: "Punjab", alpha: "PB" },
  { code: "04", name: "Chandigarh", alpha: "CH" },
  { code: "05", name: "Uttarakhand", alpha: "UK" },
  { code: "06", name: "Haryana", alpha: "HR" },
  { code: "07", name: "Delhi", alpha: "DL" },
  { code: "08", name: "Rajasthan", alpha: "RJ" },
  { code: "09", name: "Uttar Pradesh", alpha: "UP" },
  { code: "10", name: "Bihar", alpha: "BR" },
  { code: "11", name: "Sikkim", alpha: "SK" },
  { code: "12", name: "Arunachal Pradesh", alpha: "AR" },
  { code: "13", name: "Nagaland", alpha: "NL" },
  { code: "14", name: "Manipur", alpha: "MN" },
  { code: "15", name: "Mizoram", alpha: "MZ" },
  { code: "16", name: "Tripura", alpha: "TR" },
  { code: "17", name: "Meghalaya", alpha: "ML" },
  { code: "18", name: "Assam", alpha: "AS" },
  { code: "19", name: "West Bengal", alpha: "WB" },
  { code: "20", name: "Jharkhand", alpha: "JH" },
  { code: "21", name: "Odisha", alpha: "OD" },
  { code: "22", name: "Chhattisgarh", alpha: "CG" },
  { code: "23", name: "Madhya Pradesh", alpha: "MP" },
  { code: "24", name: "Gujarat", alpha: "GJ" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", alpha: "DH" },
  { code: "27", name: "Maharashtra", alpha: "MH" },
  { code: "29", name: "Karnataka", alpha: "KA" },
  { code: "30", name: "Goa", alpha: "GA" },
  { code: "31", name: "Lakshadweep", alpha: "LD" },
  { code: "32", name: "Kerala", alpha: "KL" },
  { code: "33", name: "Tamil Nadu", alpha: "TN" },
  { code: "34", name: "Puducherry", alpha: "PY" },
  { code: "35", name: "Andaman and Nicobar Islands", alpha: "AN" },
  { code: "36", name: "Telangana", alpha: "TS" },
  { code: "37", name: "Andhra Pradesh", alpha: "AP" },
  { code: "38", name: "Ladakh", alpha: "LA" },
  { code: "97", name: "Other Territory", alpha: "OT" },
  { code: "99", name: "Centre Jurisdiction", alpha: "CJ" },
] as const;

/** The clinic's home state. Overridden by OrgBranch.stateCode at runtime. */
export const DEFAULT_STATE_CODE = "27"; // Maharashtra

const BY_CODE = new Map(STATE_CODES.map((s) => [s.code, s]));
const BY_NAME = new Map(STATE_CODES.map((s) => [s.name.toLowerCase(), s]));

/** Look up a state by its two-digit GST code. */
export function stateByCode(code: string | null | undefined): StateCode | undefined {
  if (!code) return undefined;
  return BY_CODE.get(String(code).padStart(2, "0"));
}

/** Look up a state by full name (case-insensitive). */
export function stateByName(name: string | null | undefined): StateCode | undefined {
  if (!name) return undefined;
  return BY_NAME.get(String(name).trim().toLowerCase());
}

/** Display name for a state code, falling back to the raw code. */
export function stateName(code: string | null | undefined): string {
  return stateByCode(code)?.name ?? String(code ?? "");
}

/**
 * Resolve a state code from either a code ("27") or a name ("Maharashtra").
 * Existing records store the name; new records store the code.
 */
export function resolveStateCode(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const raw = String(input).trim();
  if (/^\d{1,2}$/.test(raw)) return stateByCode(raw)?.code;
  return stateByName(raw)?.code;
}

/**
 * Is this transaction inter-state?
 * Inter-state means IGST; intra-state means CGST + SGST.
 */
export function isInterstate(
  branchStateCode: string | null | undefined,
  placeOfSupply: string | null | undefined,
): boolean {
  const branch = resolveStateCode(branchStateCode);
  const pos = resolveStateCode(placeOfSupply);
  // Unknown place of supply is treated as intra-state — the safer default for a
  // single-state clinic, and the user can always override on the document.
  if (!branch || !pos) return false;
  return branch !== pos;
}
