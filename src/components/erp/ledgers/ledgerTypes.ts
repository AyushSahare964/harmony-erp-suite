import type { LedgerType } from "@/lib/mongodb/serverFns/ledgers";

/** The four ledgers — drives both the sidebar flyout and the landing tiles. */
export const LEDGER_TYPES: { id: LedgerType; label: string; hint: string }[] = [
  { id: "customer", label: "Customer Ledger", hint: "Invoices, receipts, credit notes" },
  { id: "supplier", label: "Supplier Ledger", hint: "Purchase bills and payments" },
  { id: "staff", label: "Staff Ledger", hint: "Salary, advances, reimbursements" },
  { id: "cash", label: "Cash Ledger", hint: "Cash in hand — day by day" },
];

export function isLedgerType(v: string | undefined): v is LedgerType {
  return LEDGER_TYPES.some((t) => t.id === v);
}
