/**
 * FinanceTransaction — polymorphic document covering:
 *   "account"      → Chart of Accounts / GL Account Master
 *   "payment"      → Payment Entry (receive / pay)
 *   "journal"      → Journal Entry (double-entry)
 *   "budget"       → Budget (annual + monthly breakdown)
 *   "tax_template" → Tax Rate Template (GST/TDS)
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

export type FinanceTransactionType =
  | "account"
  | "payment"
  | "journal"
  | "budget"
  | "tax_template";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

// Account Master sub-document
export interface GLAccount {
  code: string;
  name: string;
  type: "Assets" | "Liabilities" | "Equity" | "Income" | "Expense";
  subtype:
    | "Bank"
    | "Cash"
    | "Receivable"
    | "Payable"
    | "Fixed Asset"
    | "Stock"
    | "Tax"
    | "Other"
    | "";
  parent?: string;
  isGroup: boolean;
  currency: string;
  openingBalance: number;
  balanceAsOf?: string;
  freezeAccount: boolean;
  allowReconciliation: boolean;
  costCenter?: string;
  // Bank details (only when subtype === "Bank")
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  accountHolderName?: string;
  bankAccountType?: "Current" | "Savings" | "";
}

// Payment Entry invoice allocation row
export interface PaymentReference {
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  outstanding: number;
  allocatedAmount: number;
}

// Payment Entry
export interface PaymentEntry {
  paymentNo: string; // auto: PE-NNNN
  paymentType: "Receive" | "Pay" | "Internal Transfer";
  paymentDate: string;
  partyType: "Customer" | "Supplier" | "Employee";
  partyName: string;
  contactName?: string;
  references: PaymentReference[];
  modeOfPayment: string;
  bankAccount: string;
  referenceNo?: string;
  referenceDate?: string;
  paidAmount: number;
  totalAllocated: number;
  differenceAmount: number;
  writeOffAccount?: string;
  writeOffAmount?: number;
  writeOffCostCenter?: string;
  narration?: string;
  status: "Draft" | "Submitted" | "Cancelled";
}

// Journal Entry line
export interface JournalLine {
  account: string;
  costCenter?: string;
  debit: number;
  credit: number;
  remarks?: string;
}

// Journal Entry
export interface JournalEntry {
  journalNo: string; // auto: JV-NNNN
  date: string;
  voucherType:
    | "Journal Entry"
    | "Contra Entry"
    | "Credit Note"
    | "Debit Note"
    | "Bank Entry";
  chequeNo?: string;
  chequeDate?: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  narration?: string;
  isOpeningEntry: boolean;
  isAccrual: boolean;
  status: "Draft" | "Submitted" | "Cancelled";
}

// Budget line item (per GL account)
export interface BudgetLine {
  account: string;
  annualBudget: number;
  q1: number; // Apr–Jun
  q2: number; // Jul–Sep
  q3: number; // Oct–Dec
  q4: number; // Jan–Mar
  monthly: number[]; // 12 values Apr→Mar
}

// Budget
export interface Budget {
  budgetNo: string; // auto: BUD-NNN
  budgetName: string;
  fiscalYear: string;
  costCenter: string;
  budgetActionOnOverage: "Warn" | "Stop" | "Ignore";
  monthlyDistribution: "Equal" | "Custom";
  lines: BudgetLine[];
  totalBudget: number;
  remarks?: string;
  status: "Draft" | "Active" | "Closed";
}

// Tax Template rate row
export interface TaxRateRow {
  account: string;
  taxType: "CGST" | "SGST" | "IGST" | "Cess" | "TDS" | "Custom";
  rate: number;
}

// Tax Template
export interface TaxTemplate {
  name: string;
  appliesTo: "Sales" | "Purchase" | "Both";
  rows: TaxRateRow[];
  isDefault: boolean;
  isInclusive: boolean;
  status: "Active" | "Inactive";
}

// ─── Main Document Interface ──────────────────────────────────────────────────

export interface IFinanceTransaction {
  type: FinanceTransactionType;
  branchId?: string;
  tenantId?: string;
  data:
    | GLAccount
    | PaymentEntry
    | JournalEntry
    | Budget
    | TaxTemplate
    | Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
}

export type FinanceTransactionDocument = IFinanceTransaction &
  mongoose.Document;

const financeTransactionSchema = new Schema<FinanceTransactionDocument>(
  {
    type: {
      type: String,
      required: true,
      enum: ["account", "payment", "journal", "budget", "tax_template"],
      index: true,
    },
    branchId: { type: String, index: true },
    tenantId: { type: String, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "finance_transactions" }
);

financeTransactionSchema.index({ type: 1, createdAt: -1 });

export const FinanceTransaction: mongoose.Model<FinanceTransactionDocument> =
  (mongoose.models[
    "FinanceTransaction"
  ] as mongoose.Model<FinanceTransactionDocument>) ??
  model<FinanceTransactionDocument>(
    "FinanceTransaction",
    financeTransactionSchema
  );
