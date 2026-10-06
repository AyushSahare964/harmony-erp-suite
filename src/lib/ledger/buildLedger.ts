/**
 * Pure ledger maths, shared by every ledger type (customer, supplier, cash,
 * staff). Convention is Hitech's: balance = Σdebit − Σcredit.
 * Positive = Dr (they owe us / cash in hand), negative = Cr (we owe them).
 * Balances are always computed from events, never stored.
 */
import { roundMoney } from "@/lib/utils/moneyUtils";

export interface LedgerEvent {
  /** ISO YYYY-MM-DD. */
  date: string;
  /** Tie-break for same-day events. */
  sortKey?: number;
  voucherNo: string;
  particulars: string;
  debit: number;
  credit: number;
}

export interface LedgerRow extends LedgerEvent {
  balance: number;
}

export interface BuiltLedger {
  openingBalance: number;
  closingBalance: number;
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
}

/** `base` is the signed balance before any event (party opening balance). */
export function buildLedger(
  base: number,
  events: LedgerEvent[],
  from: string,
  to: string,
): BuiltLedger {
  const sorted = [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.sortKey ?? 0) - (b.sortKey ?? 0),
  );

  let running = base;
  let totalDebit = 0;
  let totalCredit = 0;
  let openingBalance = base;
  const rows: LedgerRow[] = [];

  for (const e of sorted) {
    if (e.date > to) break;
    running = roundMoney(running + e.debit - e.credit);
    if (e.date < from) {
      openingBalance = running;
      continue;
    }
    totalDebit += e.debit;
    totalCredit += e.credit;
    rows.push({ ...e, balance: running });
  }

  return {
    openingBalance: roundMoney(openingBalance),
    closingBalance: roundMoney(running),
    rows,
    totalDebit: roundMoney(totalDebit),
    totalCredit: roundMoney(totalCredit),
  };
}

/** Signed opening balance from an amount + Dr/Cr label (several spellings exist in the data). */
export function signedOpening(amount: number, type: string | undefined): number {
  const isCredit = type === "Cr" || type === "CR" || type === "Credit";
  return roundMoney(isCredit ? -amount : amount);
}

export const STAFF_ENTRY_KINDS = ["SALARY", "ADVANCE", "PAYMENT", "REPAYMENT", "ADJUSTMENT"] as const;
export type StaffEntryKind = (typeof STAFF_ENTRY_KINDS)[number];
