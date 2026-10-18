/** The nine Accounts sub-menu reports — drives both the sidebar and the hub. */
export const ACCOUNT_REPORTS = [
  { id: "cash-book", label: "Cash Book", hint: "Cash in hand, voucher by voucher" },
  { id: "business-book", label: "Business Book", hint: "Every rupee in and out, all modes" },
  { id: "payment-paid", label: "Payment Paid", hint: "Supplier payments, expenses and refunds" },
  { id: "payment-received", label: "Payment Received", hint: "Receipts from clients" },
  { id: "daily-summary", label: "Daily Summary", hint: "Sales, purchases and cash, day by day" },
  { id: "gst", label: "Input / Output Tax", hint: "GST collected, GST credit and net payable" },
  { id: "profit-loss", label: "Profit & Loss Summary", hint: "Income, purchases and expenses" },
  {
    id: "chart-of-accounts",
    label: "Chart of Accounts",
    hint: "Every account with its live balance",
  },
  { id: "balance-sheet", label: "Balance Sheet", hint: "What the clinic owns and owes" },
] as const;

export type AccountReportId = (typeof ACCOUNT_REPORTS)[number]["id"];

export const DEFAULT_ACCOUNT_REPORT: AccountReportId = "daily-summary";

export function isAccountReport(v: string | undefined): v is AccountReportId {
  return ACCOUNT_REPORTS.some((r) => r.id === v);
}
