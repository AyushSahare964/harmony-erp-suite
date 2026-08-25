/**
 * Finance Server Functions — full CRUD for:
 *   - Chart of Accounts / GL Account Master
 *   - Payment Entry (Receive / Pay)
 *   - Journal Entry (double-entry)
 *   - Budget (annual + monthly breakdown)
 *   - Tax Template
 *
 * Return types use concrete interfaces and toPlain() sanitization so TanStack Start's
 * seroval serialization passes without Object/BSON errors.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { FinanceTransaction } from "@/lib/mongodb/models/FinanceTransaction";
import { nextSeq } from "@/lib/mongodb/serverFns/counters";

// ─── Concrete serializable return types ───────────────────────────────────────

export interface GLAccountRow {
  code: string;
  name: string;
  type: string;
  subtype: string;
  parent?: string | undefined;
  isGroup: boolean;
  currency: string;
  openingBalance: number;
  balanceAsOf?: string | undefined;
  freezeAccount: boolean;
  allowReconciliation: boolean;
  costCenter?: string | undefined;
  bankName?: string | undefined;
  bankBranch?: string | undefined;
  bankAccountNo?: string | undefined;
  ifscCode?: string | undefined;
  accountHolderName?: string | undefined;
  bankAccountType?: string | undefined;
}

export interface PaymentRefRow {
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  outstanding: number;
  allocatedAmount: number;
}

export interface PaymentRow {
  paymentNo: string;
  paymentType: string;
  paymentDate: string;
  partyType: string;
  partyName: string;
  contactName?: string | undefined;
  references: PaymentRefRow[];
  modeOfPayment: string;
  bankAccount: string;
  referenceNo?: string | undefined;
  referenceDate?: string | undefined;
  paidAmount: number;
  totalAllocated: number;
  differenceAmount: number;
  writeOffAccount?: string | undefined;
  writeOffAmount?: number | undefined;
  writeOffCostCenter?: string | undefined;
  narration?: string | undefined;
  status: string;
  _id?: string | undefined;
}

export interface JournalLineRow {
  account: string;
  costCenter?: string | undefined;
  debit: number;
  credit: number;
  remarks?: string | undefined;
}

export interface JournalRow {
  journalNo: string;
  date: string;
  voucherType: string;
  chequeNo?: string | undefined;
  chequeDate?: string | undefined;
  lines: JournalLineRow[];
  totalDebit: number;
  totalCredit: number;
  narration?: string | undefined;
  isOpeningEntry: boolean;
  isAccrual: boolean;
  status: string;
  _id?: string | undefined;
}

export interface BudgetLineRow {
  account: string;
  annualBudget: number;
  q1?: number | undefined;
  q2?: number | undefined;
  q3?: number | undefined;
  q4?: number | undefined;
  monthly?: number[] | undefined;
}

export interface BudgetRow {
  budgetNo: string;
  budgetName: string;
  fiscalYear: string;
  costCenter: string;
  budgetActionOnOverage: string;
  monthlyDistribution: string;
  lines: BudgetLineRow[];
  totalBudget: number;
  remarks?: string | undefined;
  status: string;
  _id?: string | undefined;
}

export interface TaxTemplateRow {
  name: string;
  appliesTo: string;
  isDefault: boolean;
  isInclusive: boolean;
  rows: { account: string; taxType: string; rate: number }[];
  status: string;
  _id?: string | undefined;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const GLAccountInputZ = z.object({
  code:                z.string().min(1, "Account code required"),
  name:                z.string().min(1, "Account name required"),
  type:                z.enum(["Assets", "Liabilities", "Equity", "Income", "Expense"]),
  subtype:             z.string().default(""),
  parent:              z.string().optional(),
  isGroup:             z.boolean().default(false),
  currency:            z.string().default("INR"),
  openingBalance:      z.number().default(0),
  balanceAsOf:         z.string().optional(),
  freezeAccount:       z.boolean().default(false),
  allowReconciliation: z.boolean().default(true),
  costCenter:          z.string().optional(),
  bankName:            z.string().optional(),
  bankBranch:          z.string().optional(),
  bankAccountNo:       z.string().optional(),
  ifscCode:            z.string().optional(),
  accountHolderName:   z.string().optional(),
  bankAccountType:     z.enum(["Current", "Savings"]).optional(),
});

const PaymentRefInputZ = z.object({
  invoiceNo:       z.string(),
  invoiceDate:     z.string(),
  dueDate:         z.string(),
  invoiceAmount:   z.number(),
  outstanding:     z.number(),
  allocatedAmount: z.number().min(0),
});

const PaymentEntryInputZ = z.object({
  paymentType:        z.enum(["Receive", "Pay", "Internal Transfer"]),
  paymentDate:        z.string(),
  partyType:          z.enum(["Customer", "Supplier", "Employee", "Shareholder"]),
  partyName:          z.string().min(1, "Party name required"),
  contactName:        z.string().optional(),
  references:         z.array(PaymentRefInputZ).default([]),
  modeOfPayment:      z.string().default("UPI"),
  bankAccount:        z.string().default("Bank — HDFC Current"),
  referenceNo:        z.string().optional(),
  referenceDate:      z.string().optional(),
  paidAmount:         z.number().positive("Amount must be positive"),
  writeOffAccount:    z.string().optional(),
  writeOffAmount:     z.number().optional(),
  writeOffCostCenter: z.string().optional(),
  narration:          z.string().optional(),
});

const JournalLineInputZ = z.object({
  account:    z.string().min(1, "Account required"),
  costCenter: z.string().optional(),
  debit:      z.number().min(0).default(0),
  credit:     z.number().min(0).default(0),
  remarks:    z.string().optional(),
});

const JournalEntryInputZ = z.object({
  date:           z.string(),
  voucherType:    z.enum(["Journal Entry", "Contra Entry", "Credit Note", "Debit Note"]).default("Journal Entry"),
  chequeNo:       z.string().optional(),
  chequeDate:     z.string().optional(),
  lines:          z.array(JournalLineInputZ).min(2, "Journal entry requires at least 2 lines"),
  narration:      z.string().optional(),
  isOpeningEntry: z.boolean().default(false),
  isAccrual:      z.boolean().default(false),
});

const BudgetLineInputZ = z.object({
  account:      z.string().min(1),
  annualBudget: z.number().positive(),
  q1:           z.number().optional(),
  q2:           z.number().optional(),
  q3:           z.number().optional(),
  q4:           z.number().optional(),
  monthly:      z.array(z.number()).optional(),
});

const BudgetInputZ = z.object({
  budgetName:            z.string().min(1),
  fiscalYear:            z.string(),
  costCenter:            z.string(),
  budgetActionOnOverage: z.enum(["Stop", "Warn", "Ignore"]).default("Warn"),
  monthlyDistribution:   z.enum(["Equal", "Custom"]).default("Equal"),
  lines:                 z.array(BudgetLineInputZ),
  remarks:               z.string().optional(),
});

const TaxTemplateRowInputZ = z.object({
  account: z.string(),
  taxType: z.enum(["CGST", "SGST", "IGST", "Cess", "Other"]),
  rate:    z.number().min(0).max(100),
});

const TaxTemplateInputZ = z.object({
  name:        z.string().min(1),
  appliesTo:   z.enum(["Sales", "Purchase", "Both"]),
  isDefault:   z.boolean().default(false),
  isInclusive: z.boolean().default(false),
  rows:        z.array(TaxTemplateRowInputZ).min(1),
});

// ─── Default Chart of Accounts ────────────────────────────────────────────────

const SEED_ACCOUNTS: GLAccountRow[] = [
  { code: "1000", name: "Assets",                type: "Assets",      subtype: "",            isGroup: true,  currency: "INR", openingBalance: 1430000, freezeAccount: false, allowReconciliation: false },
  { code: "1100", name: "Cash",                  type: "Assets",      subtype: "Cash",        isGroup: false, parent: "1000", currency: "INR", openingBalance: 142000,  freezeAccount: false, allowReconciliation: true },
  { code: "1200", name: "Bank — HDFC Current",   type: "Assets",      subtype: "Bank",        isGroup: false, parent: "1000", currency: "INR", openingBalance: 1288000, freezeAccount: false, allowReconciliation: true },
  { code: "1300", name: "Accounts Receivable",   type: "Assets",      subtype: "Receivable",  isGroup: false, parent: "1000", currency: "INR", openingBalance: 680000,  freezeAccount: false, allowReconciliation: false },
  { code: "1400", name: "Inventory",             type: "Assets",      subtype: "Stock",       isGroup: false, parent: "1000", currency: "INR", openingBalance: 1160000, freezeAccount: false, allowReconciliation: false },
  { code: "2000", name: "Liabilities",           type: "Liabilities", subtype: "",            isGroup: true,  currency: "INR", openingBalance: 420000,  freezeAccount: false, allowReconciliation: false },
  { code: "2100", name: "Accounts Payable",      type: "Liabilities", subtype: "Payable",     isGroup: false, parent: "2000", currency: "INR", openingBalance: 240000,  freezeAccount: false, allowReconciliation: false },
  { code: "2200", name: "GST Payable",          type: "Liabilities", subtype: "Tax",         isGroup: false, parent: "2000", currency: "INR", openingBalance: 180000,  freezeAccount: false, allowReconciliation: false },
  { code: "3000", name: "Equity",                type: "Equity",      subtype: "",            isGroup: true,  currency: "INR", openingBalance: 1610000, freezeAccount: false, allowReconciliation: false },
  { code: "3100", name: "Owner's Capital",       type: "Equity",      subtype: "Equity",      isGroup: false, parent: "3000", currency: "INR", openingBalance: 1610000, freezeAccount: false, allowReconciliation: false },
  { code: "4000", name: "Income",                type: "Income",      subtype: "",            isGroup: true,  currency: "INR", openingBalance: 2160000, freezeAccount: false, allowReconciliation: false },
  { code: "4100", name: "Consultation Income",   type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 845000,  freezeAccount: false, allowReconciliation: false },
  { code: "4200", name: "Pharmacy Income",       type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 462000,  freezeAccount: false, allowReconciliation: false },
  { code: "4300", name: "Laboratory Income",     type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 411000,  freezeAccount: false, allowReconciliation: false },
  { code: "4400", name: "Boarding Income",       type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 340000,  freezeAccount: false, allowReconciliation: false },
  { code: "4500", name: "Swimming Income",       type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 102000,  freezeAccount: false, allowReconciliation: false },
  { code: "5000", name: "Expense",               type: "Expense",     subtype: "",            isGroup: true,  currency: "INR", openingBalance: 920000,  freezeAccount: false, allowReconciliation: false },
  { code: "5100", name: "Salaries",              type: "Expense",     subtype: "Other",       isGroup: false, parent: "5000", currency: "INR", openingBalance: 740000,  freezeAccount: false, allowReconciliation: false },
  { code: "5200", name: "Supplier Payments",     type: "Expense",     subtype: "Payable",     isGroup: false, parent: "5000", currency: "INR", openingBalance: 112000,  freezeAccount: false, allowReconciliation: false },
  { code: "5300", name: "Utilities & Rent",      type: "Expense",     subtype: "Other",       isGroup: false, parent: "5000", currency: "INR", openingBalance: 68000,   freezeAccount: false, allowReconciliation: false },
];

// ─── DB & Serialization helpers ─────────────────────────────────────────────

function toPlain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function toDbData(v: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
}

// ─── getAccountsFn ────────────────────────────────────────────────────────────

export const getAccountsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<GLAccountRow[]> => {
    await connectDB();

    const count = await FinanceTransaction.countDocuments({ type: "account" });
    if (count === 0) {
      const bulkOps = SEED_ACCOUNTS.map((acct) => ({
        updateOne: {
          filter: { type: "account", "data.code": acct.code },
          update: { $setOnInsert: { type: "account", data: acct as unknown as Record<string, unknown> } },
          upsert: true,
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await FinanceTransaction.bulkWrite(bulkOps as any[], { ordered: false });
    }

    const docs = await FinanceTransaction.find({ type: "account" })
      .sort({ "data.code": 1 })
      .lean();
    return toPlain(docs.map((d) => d.data as GLAccountRow));
  });

// ─── createAccountFn ─────────────────────────────────────────────────────────

export const createAccountFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => GLAccountInputZ.parse(raw))
  .handler(async ({ data }): Promise<GLAccountRow> => {
    await connectDB();
    await FinanceTransaction.create({ type: "account", data });
    return toPlain(data) as GLAccountRow;
  });

// ─── updateAccountFn ─────────────────────────────────────────────────────────

export const updateAccountFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ code: z.string(), patch: GLAccountInputZ.partial() }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();
    const setOps = Object.fromEntries(
      Object.entries(data.patch).map(([k, v]) => [`data.${k}`, v])
    );
    await FinanceTransaction.findOneAndUpdate(
      { type: "account", "data.code": data.code },
      { $set: setOps },
      { returnDocument: "after" }
    ).lean();
    return { success: true };
  });

// ─── createPaymentFn ─────────────────────────────────────────────────────────

export const createPaymentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => PaymentEntryInputZ.parse(raw))
  .handler(async ({ data }): Promise<PaymentRow> => {
    await connectDB();
    const paymentNo = await nextSeq("payment_entry", "PE", 4);
    const totalAllocated = data.references.reduce((s, r) => s + r.allocatedAmount, 0);
    const entry: PaymentRow = {
      paymentNo,
      paymentType: data.paymentType,
      paymentDate: data.paymentDate,
      partyType: data.partyType,
      partyName: data.partyName,
      ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
      references: data.references,
      modeOfPayment: data.modeOfPayment,
      bankAccount: data.bankAccount,
      ...(data.referenceNo !== undefined ? { referenceNo: data.referenceNo } : {}),
      ...(data.referenceDate !== undefined ? { referenceDate: data.referenceDate } : {}),
      paidAmount: data.paidAmount,
      totalAllocated,
      differenceAmount: data.paidAmount - totalAllocated,
      ...(data.writeOffAccount !== undefined ? { writeOffAccount: data.writeOffAccount } : {}),
      ...(data.writeOffAmount !== undefined ? { writeOffAmount: data.writeOffAmount } : {}),
      ...(data.writeOffCostCenter !== undefined ? { writeOffCostCenter: data.writeOffCostCenter } : {}),
      ...(data.narration !== undefined ? { narration: data.narration } : {}),
      status: "Submitted",
    };
    const doc = await FinanceTransaction.create({ type: "payment", data: toDbData(entry) });
    return toPlain({ ...entry, _id: (doc._id as { toString(): string }).toString() });
  });

// ─── getPaymentsFn ────────────────────────────────────────────────────────────

export const getPaymentsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ partyType: z.string().default("all") }).parse(raw)
  )
  .handler(async ({ data }): Promise<PaymentRow[]> => {
    await connectDB();
    const filter: Record<string, unknown> = { type: "payment" };
    if (data.partyType !== "all") filter["data.partyType"] = data.partyType;
    const docs = await FinanceTransaction.find(filter).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data as PaymentRow));
  });

// ─── createJournalFn ─────────────────────────────────────────────────────────

export const createJournalFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => JournalEntryInputZ.parse(raw))
  .handler(async ({ data }): Promise<JournalRow> => {
    await connectDB();
    const totalDebit  = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Unbalanced: Debit ₹${totalDebit.toFixed(2)} ≠ Credit ₹${totalCredit.toFixed(2)}`
      );
    }
    const journalNo = await nextSeq("journal_entry", "JV", 4);
    const entry: JournalRow = {
      journalNo,
      date: data.date,
      voucherType: data.voucherType,
      ...(data.chequeNo !== undefined ? { chequeNo: data.chequeNo } : {}),
      ...(data.chequeDate !== undefined ? { chequeDate: data.chequeDate } : {}),
      lines: data.lines,
      totalDebit,
      totalCredit,
      ...(data.narration !== undefined ? { narration: data.narration } : {}),
      isOpeningEntry: data.isOpeningEntry,
      isAccrual: data.isAccrual,
      status: "Submitted",
    };
    const doc = await FinanceTransaction.create({ type: "journal", data: toDbData(entry) });
    return toPlain({ ...entry, _id: (doc._id as { toString(): string }).toString() });
  });

// ─── getJournalsFn ───────────────────────────────────────────────────────────

export const getJournalsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<JournalRow[]> => {
    await connectDB();
    const docs = await FinanceTransaction.find({ type: "journal" })
      .sort({ createdAt: -1 }).limit(100).lean();
    return toPlain(docs.map((d) => d.data as JournalRow));
  });

// ─── createBudgetFn ──────────────────────────────────────────────────────────

export const createBudgetFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => BudgetInputZ.parse(raw))
  .handler(async ({ data }): Promise<BudgetRow> => {
    await connectDB();
    const budgetNo    = await nextSeq("budget", "BUD", 3);
    const totalBudget = data.lines.reduce((s, l) => s + l.annualBudget, 0);

    const lines: BudgetLineRow[] = data.lines.map((line) => {
      if (data.monthlyDistribution === "Equal") {
        const m = Math.round(line.annualBudget / 12);
        const q1 = m * 3; const q2 = m * 3; const q3 = m * 3;
        const q4 = line.annualBudget - q1 - q2 - q3;
        return {
          ...line, q1, q2, q3, q4,
          monthly: [m,m,m,m,m,m,m,m,m,m,m, line.annualBudget - m * 11],
        };
      }
      return line;
    });

    const budget: BudgetRow = {
      budgetNo,
      budgetName: data.budgetName,
      fiscalYear: data.fiscalYear,
      costCenter: data.costCenter,
      budgetActionOnOverage: data.budgetActionOnOverage,
      monthlyDistribution: data.monthlyDistribution,
      lines,
      totalBudget,
      ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
      status: "Active",
    };
    const doc = await FinanceTransaction.create({ type: "budget", data: budget });
    return toPlain({ ...budget, _id: (doc._id as { toString(): string }).toString() });
  });

// ─── getBudgetsFn ────────────────────────────────────────────────────────────

export const getBudgetsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<BudgetRow[]> => {
    await connectDB();
    const docs = await FinanceTransaction.find({ type: "budget" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data as BudgetRow));
  });

// ─── createTaxTemplateFn ─────────────────────────────────────────────────────

export const createTaxTemplateFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => TaxTemplateInputZ.parse(raw))
  .handler(async ({ data }): Promise<TaxTemplateRow> => {
    await connectDB();
    if (data.isDefault) {
      await FinanceTransaction.updateMany(
        { type: "tax_template", "data.appliesTo": data.appliesTo, "data.isDefault": true },
        { $set: { "data.isDefault": false } }
      );
    }
    const template: TaxTemplateRow = { ...data, status: "Active" };
    const doc = await FinanceTransaction.create({ type: "tax_template", data: template });
    return toPlain({ ...template, _id: (doc._id as { toString(): string }).toString() });
  });

// ─── getTaxTemplatesFn ───────────────────────────────────────────────────────

export const getTaxTemplatesFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<TaxTemplateRow[]> => {
    await connectDB();
    const docs = await FinanceTransaction.find({ type: "tax_template" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data as TaxTemplateRow));
  });

// ─── getTransactionsFn ───────────────────────────────────────────────────────

export const getTransactionsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      type:  z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<PaymentRow[]> => {
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (data.type) filter["type"] = data.type;
    const docs = await FinanceTransaction.find(filter)
      .sort({ createdAt: -1 }).limit(data.limit).lean();
    return toPlain(docs.map((d) => d.data as PaymentRow));
  });
