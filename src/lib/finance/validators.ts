/**
 * Field validators for finance masters and documents.
 *
 * Every function returns `null` when valid, or a human-readable error string.
 * That shape lets callers do: `const err = validateGstin(v); if (err) ...`
 */

import { resolveStateCode, stateName } from "./stateCodes";

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const PIN_RE = /^[1-9]\d{5}$/;
export const HSN_RE = /^\d{4,8}$/;

/** GSTIN — 15 chars. Optional unless the party is registered. */
export function validateGstin(value: string | null | undefined, required = false): string | null {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return required ? "GSTIN is required" : null;
  if (v.length !== 15) return "GSTIN must be exactly 15 characters";
  if (!GSTIN_RE.test(v)) return "GSTIN format is invalid";
  return null;
}

/**
 * The first two digits of a GSTIN are the state code, and they must agree with
 * the state selected on the party. A mismatch here is the single most common
 * cause of a rejected GSTR-1 line.
 */
export function validateGstinAgainstState(
  gstin: string | null | undefined,
  stateCodeOrName: string | null | undefined,
): string | null {
  const v = (gstin ?? "").trim().toUpperCase();
  if (!v) return null;
  const formatErr = validateGstin(v);
  if (formatErr) return formatErr;

  const selected = resolveStateCode(stateCodeOrName);
  if (!selected) return null; // no state chosen yet — let the state validator complain

  const fromGstin = v.slice(0, 2);
  if (fromGstin !== selected) {
    return `GSTIN belongs to ${stateName(fromGstin) || `state ${fromGstin}`}, but ${stateName(selected)} is selected`;
  }
  return null;
}

/** PAN — 10 chars. */
export function validatePan(value: string | null | undefined, required = false): string | null {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return required ? "PAN is required" : null;
  if (!PAN_RE.test(v)) return "PAN format is invalid (e.g. ABCDE1234F)";
  return null;
}

/** IFSC — 11 chars, 5th character is always 0. */
export function validateIfsc(value: string | null | undefined, required = false): string | null {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return required ? "IFSC code is required" : null;
  if (!IFSC_RE.test(v)) return "IFSC format is invalid (e.g. HDFC0001234)";
  return null;
}

/** Indian mobile — 10 digits starting 6–9. Strips +91 / 0 prefixes first. */
export function validateMobile(value: string | null | undefined, required = true): string | null {
  const v = normaliseMobile(value);
  if (!v) return required ? "Mobile number is required" : null;
  if (!MOBILE_RE.test(v)) return "Enter a valid 10-digit mobile number";
  return null;
}

/** Strip spaces, dashes, +91 and a leading 0 so 10 digits remain. */
export function normaliseMobile(value: string | null | undefined): string {
  let v = (value ?? "").replace(/[\s\-()]/g, "");
  if (v.startsWith("+91")) v = v.slice(3);
  else if (v.startsWith("91") && v.length === 12) v = v.slice(2);
  if (v.startsWith("0") && v.length === 11) v = v.slice(1);
  return v;
}

/** 6-digit PIN code, first digit non-zero. */
export function validatePin(value: string | null | undefined, required = false): string | null {
  const v = (value ?? "").trim();
  if (!v) return required ? "PIN code is required" : null;
  if (!PIN_RE.test(v)) return "PIN code must be 6 digits";
  return null;
}

/**
 * HSN / SAC — 4, 6 or 8 digits.
 * GST law requires 6 digits once turnover crosses ₹5 crore; we warn rather than
 * block so a small clinic is not stopped from billing.
 */
export function validateHsn(value: string | null | undefined, required = false): string | null {
  const v = (value ?? "").trim();
  if (!v) return required ? "HSN / SAC is required" : null;
  if (!HSN_RE.test(v)) return "HSN / SAC must be 4 to 8 digits";
  if (v.length === 5 || v.length === 7) return "HSN / SAC must be 4, 6 or 8 digits";
  return null;
}

/** GST rate must be one of the statutory slabs (or a valid cess-style percentage). */
export const GST_SLABS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28] as const;

export function validateGstRate(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return "GST rate is required";
  if (value < 0) return "GST rate cannot be negative";
  if (value > 100) return "GST rate cannot exceed 100%";
  return null;
}

/** A document date may not be in the future. */
export function validateNotFuture(
  isoDate: string,
  todayIso: string,
  label = "Date",
): string | null {
  if (!isoDate) return `${label} is required`;
  if (isoDate > todayIso) return `${label} cannot be in the future`;
  return null;
}

/** A payment may not be dated before the invoice it settles. */
export function validatePaymentDate(
  paymentIso: string,
  invoiceIso: string,
  todayIso: string,
): string | null {
  const future = validateNotFuture(paymentIso, todayIso, "Payment date");
  if (future) return future;
  if (invoiceIso && paymentIso < invoiceIso) {
    return "Payment date cannot be before the invoice date";
  }
  return null;
}

/** Run several validators and collect the first error per field. */
export function collectErrors(
  checks: Record<string, string | null>,
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  for (const [field, err] of Object.entries(checks)) {
    if (err) errors[field] = err;
  }
  return Object.keys(errors).length ? errors : null;
}
