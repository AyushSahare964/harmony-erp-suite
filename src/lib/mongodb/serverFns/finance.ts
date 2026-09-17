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
  { code: "1000", name: "Assets",                type: "Assets",      subtype: "",            isGroup: true,  currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "1100", name: "Cash",                  type: "Assets",      subtype: "Cash",        isGroup: false, parent: "1000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: true },
  { code: "1200", name: "Bank — HDFC Current",   type: "Assets",      subtype: "Bank",        isGroup: false, parent: "1000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: true },
  { code: "1300", name: "Accounts Receivable",   type: "Assets",      subtype: "Receivable",  isGroup: false, parent: "1000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "1400", name: "Inventory",             type: "Assets",      subtype: "Stock",       isGroup: false, parent: "1000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "2000", name: "Liabilities",           type: "Liabilities", subtype: "",            isGroup: true,  currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "2100", name: "Accounts Payable",      type: "Liabilities", subtype: "Payable",     isGroup: false, parent: "2000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "2200", name: "GST Payable",          type: "Liabilities", subtype: "Tax",         isGroup: false, parent: "2000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "3000", name: "Equity",                type: "Equity",      subtype: "",            isGroup: true,  currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "3100", name: "Owner's Capital",       type: "Equity",      subtype: "Equity",      isGroup: false, parent: "3000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "4000", name: "Income",                type: "Income",      subtype: "",            isGroup: true,  currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "4100", name: "Consultation Income",   type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "4200", name: "Pharmacy Income",       type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "4300", name: "Laboratory Income",     type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "4400", name: "Boarding Income",       type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "4500", name: "Swimming Income",       type: "Income",      subtype: "Other",       isGroup: false, parent: "4000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "5000", name: "Expense",               type: "Expense",     subtype: "",            isGroup: true,  currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "5100", name: "Salaries",              type: "Expense",     subtype: "Other",       isGroup: false, parent: "5000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "5200", name: "Supplier Payments",     type: "Expense",     subtype: "Payable",     isGroup: false, parent: "5000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
  { code: "5300", name: "Utilities & Rent",      type: "Expense",     subtype: "Other",       isGroup: false, parent: "5000", currency: "INR", openingBalance: 0, freezeAccount: false, allowReconciliation: false },
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

// ─── getFinancialKpisFn ───────────────────────────────────────────────────────

import { ExpenseModel } from "@/lib/mongodb/models/Expense";
import { PurchaseBillModel } from "@/lib/mongodb/models/PurchaseBill";
import { SupplierPaymentModel } from "@/lib/mongodb/models/SupplierPayment";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { SalesDocModel } from "@/lib/mongodb/models/SalesDoc";
import { PaymentDocModel } from "@/lib/mongodb/models/PaymentDoc";
import { todayIST } from "@/lib/utils/dateUtils";

export interface FinancialOverviewKpis {
  from: string;
  to: string;
  totalRevenue: number;
  totalExpenses: number;
  totalPurchases: number;
  totalPayables: number;
  totalPaidToSuppliers: number;
  cashInflow: number;
  digitalInflow: number;
  cashOutflow: number;
  digitalOutflow: number;
  netIncome: number;
  plWeekly: Array<{ month: string; income: number; expense: number; net: number }>;
  cashFlowSeries: Array<{ day: string; in: number; out: number }>;
}

export const getFinancialKpisFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional().parse(raw)
  )
  .handler(async ({ data }): Promise<FinancialOverviewKpis> => {
    await connectDB();
    const today = todayIST();
    const from = data?.from ?? `${today.slice(0, 7)}-01`;
    const to = data?.to ?? today;

    // 1. Business Expenses in range
    const expenses = await ExpenseModel.find({
      expenseDate: { $gte: from, $lte: to },
      status: "ACTIVE",
    }).lean();

    let totalExpenses = 0;
    let cashOutflow = 0;
    let digitalOutflow = 0;

    for (const exp of expenses) {
      if (exp.categoryNature !== "PERSONAL") {
        totalExpenses += Number(exp.totalAmount || 0);
      }
      for (const line of exp.paymentLines || []) {
        const amt = Number(line.amount || 0);
        if (String(line.mode || "").toUpperCase().includes("CASH")) {
          cashOutflow += amt;
        } else {
          digitalOutflow += amt;
        }
      }
    }

    // 2. Supplier Bills in range
    const bills = await PurchaseBillModel.find({
      billDate: { $gte: from, $lte: to },
      status: { $ne: "VOID" },
    }).lean();

    const totalPurchases = bills.reduce((s, b) => s + Number(b.grandTotal || 0), 0);

    // 3. Outstanding payables across all unpaid/partial bills
    const activeUnpaidBills = await PurchaseBillModel.find({
      status: { $in: ["UNPAID", "PARTIAL"] },
    }).lean();

    const totalPayables = activeUnpaidBills.reduce(
      (s, b) => s + Math.max(0, Number(b.grandTotal || 0) - Number(b.amountPaid || 0)),
      0
    );

    // 4. Supplier Payments in range
    const supplierPayments = await SupplierPaymentModel.find({
      paymentDate: { $gte: from, $lte: to },
      status: "ACTIVE",
    }).lean();

    const totalPaidToSuppliers = supplierPayments.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
    for (const p of supplierPayments) {
      for (const line of p.paymentLines || []) {
        const amt = Number(line.amount || 0);
        if (String(line.mode || "").toUpperCase().includes("CASH")) {
          cashOutflow += amt;
        } else {
          digitalOutflow += amt;
        }
      }
    }

    // 5. Billing Invoices (Clinical Visits & Sales Docs) in range
    const visits = await ClinicalVisit.find({
      status: { $nin: ["Cancelled", "CANCELLED", "VOID", "Void", "cancelled", "void"] },
    }).lean();

    const inRangeVisits = visits.filter((v: any) => {
      const dStr = (typeof v.date === "string" ? v.date : (v.createdAt ? new Date(v.createdAt).toISOString() : "")).slice(0, 10);
      return dStr >= from && dStr <= to;
    });

    const salesDocs = await SalesDocModel.find({
      docKind: "INVOICE",
      docStatus: { $nin: ["CANCELLED", "VOID", "DRAFT"] },
    }).lean();

    const inRangeSalesDocs = salesDocs.filter((s: any) => {
      const dStr = (s.docDate || (s.createdAt ? new Date(s.createdAt).toISOString() : "")).slice(0, 10);
      return dStr >= from && dStr <= to;
    });

    let totalRevenue = 0;
    let cashInflow = 0;
    let digitalInflow = 0;

    for (const v of inRangeVisits) {
      totalRevenue += Number(v.totalAmount || 0);

      if (Array.isArray(v.payments) && v.payments.length > 0) {
        for (const p of v.payments) {
          const pDate = (p.date || p.timestamp || v.date || "").slice(0, 10);
          if (!pDate || (pDate >= from && pDate <= to)) {
            const amt = Number(p.amount || 0);
            const mode = String(p.mode || "").toUpperCase();
            if (mode.includes("CASH")) {
              cashInflow += amt;
            } else {
              digitalInflow += amt;
            }
          }
        }
      } else if (v.amountPaid && v.amountPaid > 0) {
        const mode = String(v.paymentMode || "").toUpperCase();
        if (mode.includes("CASH")) {
          cashInflow += Number(v.amountPaid);
        } else {
          digitalInflow += Number(v.amountPaid);
        }
      }
    }

    for (const s of inRangeSalesDocs) {
      totalRevenue += Number(s.grandTotal || 0);
    }

    // 6. Direct Inward Payment Docs
    const paymentInDocs = await PaymentDocModel.find({
      direction: "IN",
      status: { $ne: "VOID" },
    }).lean();

    for (const doc of paymentInDocs) {
      const pDate = (doc.paymentDate || "").slice(0, 10);
      if (pDate >= from && pDate <= to) {
        for (const split of doc.splits || []) {
          const amt = Number(split.amount || 0);
          if (split.payMode === "CASH") cashInflow += amt;
          else digitalInflow += amt;
        }
      }
    }

    // 7. Direct Outward Payment Docs
    const paymentOutDocs = await PaymentDocModel.find({
      direction: "OUT",
      status: { $ne: "VOID" },
    }).lean();

    for (const doc of paymentOutDocs) {
      const pDate = (doc.paymentDate || "").slice(0, 10);
      if (pDate >= from && pDate <= to) {
        for (const split of doc.splits || []) {
          const amt = Number(split.amount || 0);
          if (split.payMode === "CASH") cashOutflow += amt;
          else digitalOutflow += amt;
        }
      }
    }

    // Finance Transactions Payments (if any recorded in accounting)
    const extraIncomeTx = await FinanceTransaction.find({
      type: "payment",
      "data.paymentType": "Receive",
      "data.paymentDate": { $gte: from, $lte: to },
    }).lean();

    for (const tx of extraIncomeTx) {
      const amt = Number(tx.data?.paidAmount || 0);
      const mode = String(tx.data?.modeOfPayment || "").toUpperCase();
      if (mode.includes("CASH")) cashInflow += amt;
      else digitalInflow += amt;
    }

    const netIncome = totalRevenue - totalExpenses - totalPurchases;

    // 8. Dynamic Weekly P&L breakdown for the date range
    const startDate = new Date(from);
    const endDate = new Date(to);
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1);
    const numBuckets = 4;
    const bucketDays = Math.max(1, Math.ceil(totalDays / numBuckets));

    const plWeekly = Array.from({ length: numBuckets }).map((_, i) => {
      const bStart = new Date(startDate);
      bStart.setDate(bStart.getDate() + i * bucketDays);
      const bEnd = new Date(startDate);
      bEnd.setDate(Math.min(endDate.getDate(), bStart.getDate() + bucketDays - 1));

      const bStartStr = bStart.toLocaleDateString("en-CA");
      const bEndStr = bEnd.toLocaleDateString("en-CA");

      const bIncome =
        inRangeVisits
          .filter((v: any) => {
            const d = (v.date || "").slice(0, 10);
            return d >= bStartStr && d <= bEndStr;
          })
          .reduce((s: number, v: any) => s + Number(v.totalAmount || 0), 0) +
        inRangeSalesDocs
          .filter((s: any) => {
            const d = (s.docDate || "").slice(0, 10);
            return d >= bStartStr && d <= bEndStr;
          })
          .reduce((s: number, sDoc: any) => s + Number(sDoc.grandTotal || 0), 0);

      const bExp =
        expenses
          .filter((e: any) => e.expenseDate >= bStartStr && e.expenseDate <= bEndStr && e.categoryNature !== "PERSONAL")
          .reduce((s: number, e: any) => s + Number(e.totalAmount || 0), 0) +
        bills
          .filter((b: any) => b.billDate >= bStartStr && b.billDate <= bEndStr)
          .reduce((s: number, b: any) => s + Number(b.grandTotal || 0), 0);

      return {
        month: `Week ${i + 1}`,
        income: Math.round(bIncome / 1000),
        expense: Math.round(bExp / 1000),
        net: Math.round((bIncome - bExp) / 1000),
      };
    });

    // 9. Dynamic Cash Flow timeline series
    const cashFlowSeries = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
      const pointTime = startDate.getTime() + pct * (endDate.getTime() - startDate.getTime());
      const pDate = new Date(pointTime);
      const dayLabel = pDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const isoDay = pDate.toLocaleDateString("en-CA");

      const dayIn = inRangeVisits
        .filter((v: any) => (v.date || "").slice(0, 10) === isoDay)
        .reduce((s: number, v: any) => s + Number(v.amountPaid || 0), 0);

      const dayOut =
        expenses
          .filter((e: any) => e.expenseDate === isoDay)
          .reduce((s: number, e: any) => s + Number(e.totalAmount || 0), 0) +
        supplierPayments
          .filter((p: any) => p.paymentDate === isoDay)
          .reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0);

      return {
        day: dayLabel,
        in: Math.round(dayIn / 1000),
        out: Math.round(dayOut / 1000),
      };
    });

    return {
      from,
      to,
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      totalPurchases: Math.round(totalPurchases),
      totalPayables: Math.round(totalPayables),
      totalPaidToSuppliers: Math.round(totalPaidToSuppliers),
      cashInflow: Math.round(cashInflow),
      digitalInflow: Math.round(digitalInflow),
      cashOutflow: Math.round(cashOutflow),
      digitalOutflow: Math.round(digitalOutflow),
      netIncome: Math.round(netIncome),
      plWeekly,
      cashFlowSeries,
    };
  });

// ─── getReceivablesPayablesFn ──────────────────────────────────────────────────

export interface ReceivablesPayablesData {
  arRows: Array<{
    owner: string;
    invoice: string;
    date: string;
    due: string;
    amount: number;
    outstanding: number;
    bucket: "0–30" | "31–60" | "61–90" | "90+";
    status: "Unpaid" | "Partially paid" | "Overdue";
  }>;
  apRows: Array<{
    supplier: string;
    bill: string;
    date: string;
    due: string;
    amount: number;
    outstanding: number;
    bucket: "0–30" | "31–60" | "61–90" | "90+";
    status: "Unpaid" | "Partially paid" | "Overdue";
  }>;
}

export const getReceivablesPayablesFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<ReceivablesPayablesData> => {
    await connectDB();
    const today = new Date();

    const visits = await ClinicalVisit.find({
      status: { $nin: ["Cancelled", "CANCELLED", "VOID", "Void", "cancelled", "void"] },
    }).sort({ createdAt: -1 }).limit(500).lean();

    const salesDocs = await SalesDocModel.find({
      docKind: "INVOICE",
      docStatus: { $nin: ["CANCELLED", "VOID", "DRAFT"] },
    }).sort({ createdAt: -1 }).limit(500).lean();

    const purchaseBills = await PurchaseBillModel.find({
      status: { $in: ["UNPAID", "PARTIAL"] },
    }).sort({ billDate: -1, createdAt: -1 }).limit(500).lean();

    const arRows: ReceivablesPayablesData["arRows"] = [];
    const seenInvoices = new Set<string>();

    for (const inv of visits as any[]) {
      const totalAmt = Number(inv.totalAmount || 0);
      const paidAmt = Number(inv.amountPaid || 0);
      const out = Math.max(0, typeof inv.balanceDue === "number" ? inv.balanceDue : (totalAmt - paidAmt));

      if (out > 0) {
        const invNo = inv.invoiceNo || inv.visitId || "INV-???";
        seenInvoices.add(invNo);

        const invDate = (typeof inv.date === "string" ? inv.date : (inv.createdAt ? new Date(inv.createdAt).toISOString() : "")).slice(0, 10);
        const d = invDate ? new Date(invDate) : today;
        const diffDays = Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24)));

        let bucket: "0–30" | "31–60" | "61–90" | "90+" = "0–30";
        if (diffDays > 90) bucket = "90+";
        else if (diffDays > 60) bucket = "61–90";
        else if (diffDays > 30) bucket = "31–60";

        const dueD = new Date(d);
        dueD.setDate(dueD.getDate() + 7);
        const due = inv.dueDate || dueD.toLocaleDateString("en-CA");

        let status: "Unpaid" | "Partially paid" | "Overdue" = "Unpaid";
        if (paidAmt > 0) status = "Partially paid";
        else if (diffDays > 30 || due < today.toLocaleDateString("en-CA")) status = "Overdue";

        arRows.push({
          owner: inv.ownerName || "Walk-in Client",
          invoice: invNo,
          date: invDate || "—",
          due,
          amount: totalAmt,
          outstanding: out,
          bucket,
          status,
        });
      }
    }

    for (const s of salesDocs as any[]) {
      const invNo = s.docNumber;
      if (seenInvoices.has(invNo)) continue;

      const totalAmt = Number(s.grandTotal || 0);
      const paidAmt = Number(s.amountPaid || 0);
      const out = Math.max(0, typeof s.balanceDue === "number" ? s.balanceDue : (totalAmt - paidAmt));

      if (out > 0) {
        seenInvoices.add(invNo);
        const sDate = (s.docDate || "").slice(0, 10);
        const d = sDate ? new Date(sDate) : today;
        const diffDays = Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24)));

        let bucket: "0–30" | "31–60" | "61–90" | "90+" = "0–30";
        if (diffDays > 90) bucket = "90+";
        else if (diffDays > 60) bucket = "61–90";
        else if (diffDays > 30) bucket = "31–60";

        const dueD = new Date(d);
        dueD.setDate(dueD.getDate() + 15);
        const due = s.dueDate || dueD.toLocaleDateString("en-CA");

        let status: "Unpaid" | "Partially paid" | "Overdue" = "Unpaid";
        if (paidAmt > 0) status = "Partially paid";
        else if (diffDays > 30 || due < today.toLocaleDateString("en-CA")) status = "Overdue";

        arRows.push({
          owner: s.partyName || "Client",
          invoice: invNo,
          date: sDate || "—",
          due,
          amount: totalAmt,
          outstanding: out,
          bucket,
          status,
        });
      }
    }

    const apRows: ReceivablesPayablesData["apRows"] = [];
    for (const b of purchaseBills as any[]) {
      const out = Math.max(0, Number(b.grandTotal || 0) - Number(b.amountPaid || 0));
      if (out <= 0) continue;

      const billD = b.billDate ? new Date(b.billDate) : today;
      const diffDays = Math.max(0, Math.floor((today.getTime() - billD.getTime()) / (1000 * 3600 * 24)));

      let bucket: "0–30" | "31–60" | "61–90" | "90+" = "0–30";
      if (diffDays > 90) bucket = "90+";
      else if (diffDays > 60) bucket = "61–90";
      else if (diffDays > 30) bucket = "31–60";

      let status: "Unpaid" | "Partially paid" | "Overdue" = "Unpaid";
      if (b.amountPaid > 0) status = "Partially paid";
      else if (diffDays > 30 || (b.dueDate && b.dueDate < today.toLocaleDateString("en-CA"))) status = "Overdue";

      apRows.push({
        supplier: b.supplierName || "Supplier",
        bill: b.internalRef || b.billNumber || "PB-???",
        date: b.billDate,
        due: b.dueDate || b.billDate,
        amount: Number(b.grandTotal || 0),
        outstanding: out,
        bucket,
        status,
      });
    }

    return toPlain({
      arRows,
      apRows,
    });
  });

// ─── Bank Reconciliation Server Functions ────────────────────────────────────

export interface BankAccountItem {
  id: string;
  bank: string;
  accountNo: string;
  type: "Current" | "Savings";
  ledgerBalance: number;
  statementBalance: number;
  uncollectedAmount: number;
  lastReconciled: string;
  status: "Reconciled" | "Pending";
}

export interface BankEntryItem {
  id: string;
  date: string;
  party: string;
  reference: string;
  amount: number;
  type: "Deposit" | "Withdrawal";
  status: "Matched" | "Unmatched" | "Excluded";
}

export interface BankReconciliationResult {
  accounts: BankAccountItem[];
  entries: BankEntryItem[];
}

export const getBankReconciliationDataFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ accountId: z.string().optional() }).optional().parse(raw)
  )
  .handler(async (): Promise<BankReconciliationResult> => {
    await connectDB();

    // 1. Gather all Bank GL Accounts
    let dbAccounts = await FinanceTransaction.find({
      type: "account",
      $or: [{ "data.subtype": "Bank" }, { "data.code": { $regex: /^12/ } }],
    })
      .sort({ "data.code": 1 })
      .lean();

    if (dbAccounts.length === 0) {
      await FinanceTransaction.create({
        type: "account",
        data: {
          code: "1200",
          name: "Bank — HDFC Current",
          type: "Assets",
          subtype: "Bank",
          parent: "1000",
          isGroup: false,
          currency: "INR",
          openingBalance: 0,
          freezeAccount: false,
          allowReconciliation: true,
          bankName: "HDFC Bank",
          bankAccountNo: "••••4821",
          bankAccountType: "Current",
          lastReconciled: "Pending",
        },
      });
      dbAccounts = await FinanceTransaction.find({
        type: "account",
        $or: [{ "data.subtype": "Bank" }, { "data.code": { $regex: /^12/ } }],
      }).lean();
    }

    // 2. Fetch Live Bank Transactions (Deposits & Withdrawals)
    const entries: BankEntryItem[] = [];
    const seenRefs = new Set<string>();

    // A) Clinical Visits (UPI, Card, NetBanking, Cheque receipts)
    const visits = await ClinicalVisit.find({
      status: { $nin: ["Cancelled", "CANCELLED", "VOID", "Void", "cancelled", "void"] },
      "payments.0": { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    for (const v of visits as any[]) {
      for (const p of v.payments || []) {
        const mode = String(p.mode || "").toUpperCase();
        if (mode && mode !== "CASH" && mode !== "ACCOUNT DUE") {
          const ref = p.trxRef || v.invoiceNo || v.visitId || `UPI-${v._id}`;
          if (!seenRefs.has(ref)) {
            seenRefs.add(ref);
            const pDate = p.timestamp ? p.timestamp.slice(0, 10) : (v.date || (v.createdAt ? new Date(v.createdAt).toISOString() : "")).slice(0, 10);
            entries.push({
              id: `VISIT-${v._id}-${ref}`,
              date: pDate || new Date().toISOString().slice(0, 10),
              party: `Consultation — ${v.ownerName || "Client"}${v.patientName ? ` (${v.patientName})` : ""}`,
              reference: ref,
              amount: Math.abs(Number(p.amount || 0)),
              type: "Deposit",
              status: "Matched",
            });
          }
        }
      }
    }

    // B) Direct Payment Docs (Receipts and Outward payments)
    const paymentDocs = await PaymentDocModel.find({
      status: { $ne: "VOID" },
    })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(300)
      .lean();

    for (const doc of paymentDocs as any[]) {
      const pDate = (doc.paymentDate || "").slice(0, 10);
      const isReceive = doc.direction === "IN";
      for (const split of doc.splits || []) {
        const mode = String(split.payMode || "").toUpperCase();
        if (mode && mode !== "CASH") {
          const ref = split.referenceNo || doc.paymentNumber || `PAY-${doc._id}`;
          if (!seenRefs.has(ref)) {
            seenRefs.add(ref);
            const amt = Math.abs(Number(split.amount || 0));
            entries.push({
              id: `PAYDOC-${doc._id}-${ref}`,
              date: pDate || new Date().toISOString().slice(0, 10),
              party: `${doc.partyName || (isReceive ? "Customer" : "Supplier")} — ${doc.paymentNumber}`,
              reference: ref,
              amount: isReceive ? amt : -amt,
              type: isReceive ? "Deposit" : "Withdrawal",
              status: "Matched",
            });
          }
        }
      }
    }

    // C) FinanceTransaction Payments
    const financePayments = await FinanceTransaction.find({
      type: "payment",
      "data.status": { $ne: "Cancelled" },
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    for (const tx of financePayments as any[]) {
      const pData = tx.data || {};
      const mode = String(pData.modeOfPayment || "").toUpperCase();
      if (mode && mode !== "CASH") {
        const ref = pData.referenceNo || pData.paymentNo || `FIN-${tx._id}`;
        if (!seenRefs.has(ref)) {
          seenRefs.add(ref);
          const isReceive = pData.paymentType === "Receive";
          const amt = Math.abs(Number(pData.paidAmount || 0));
          entries.push({
            id: `FIN-${tx._id}`,
            date: (pData.paymentDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
            party: `${pData.partyName || "Party"} (${pData.paymentNo || "Payment"})`,
            reference: ref,
            amount: isReceive ? amt : -amt,
            type: isReceive ? "Deposit" : "Withdrawal",
            status: "Matched",
          });
        }
      }
    }

    // D) Active Expenses with Bank/Digital Payments
    const expenses = await ExpenseModel.find({
      status: "ACTIVE",
    })
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(300)
      .lean();

    for (const exp of expenses as any[]) {
      for (const line of exp.paymentLines || []) {
        const mode = String(line.mode || "").toUpperCase();
        if (mode && mode !== "CASH") {
          const ref = line.referenceNo || exp.billRefNo || exp.voucherNo || `EXP-${exp._id}`;
          if (!seenRefs.has(ref)) {
            seenRefs.add(ref);
            const amt = Math.abs(Number(line.amount || 0));
            entries.push({
              id: `EXP-${exp._id}-${ref}`,
              date: (exp.expenseDate || "").slice(0, 10),
              party: `${exp.categoryName || "Expense"}${exp.paidTo ? ` — ${exp.paidTo}` : ""}`,
              reference: ref,
              amount: -amt,
              type: "Withdrawal",
              status: "Matched",
            });
          }
        }
      }
    }

    // E) Active Supplier Payments
    const supplierPayments = await SupplierPaymentModel.find({
      status: "ACTIVE",
    })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(300)
      .lean();

    for (const sp of supplierPayments as any[]) {
      for (const line of sp.paymentLines || []) {
        const mode = String(line.mode || "").toUpperCase();
        if (mode && mode !== "CASH") {
          const ref = line.referenceNo || sp.voucherNo || `SP-${sp._id}`;
          if (!seenRefs.has(ref)) {
            seenRefs.add(ref);
            const amt = Math.abs(Number(line.amount || 0));
            entries.push({
              id: `SP-${sp._id}-${ref}`,
              date: (sp.paymentDate || "").slice(0, 10),
              party: `Supplier — ${sp.supplierName || "Vendor"}`,
              reference: ref,
              amount: -amt,
              type: "Withdrawal",
              status: "Matched",
            });
          }
        }
      }
    }

    // Sort entries newest to oldest
    entries.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate totals for bank balances
    const totalDeposits = entries
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    const totalWithdrawals = entries
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const accounts: BankAccountItem[] = dbAccounts.map((d: any) => {
      const a = d.data || {};
      const ob = Number(a.openingBalance || 0);
      const ledger = ob + totalDeposits - totalWithdrawals;
      const stmt = typeof a.statementBalance === "number" ? a.statementBalance : ledger;
      const lastRec = a.lastReconciled || (a.status === "Reconciled" ? "Recent" : "Pending");
      return {
        id: a.code,
        bank: a.bankName || a.name || "Bank Account",
        accountNo: a.bankAccountNo ? (a.bankAccountNo.startsWith("••••") ? a.bankAccountNo : `••••${a.bankAccountNo.slice(-4)}`) : "••••4821",
        type: (a.bankAccountType as "Current" | "Savings") || "Current",
        ledgerBalance: ledger,
        statementBalance: stmt,
        uncollectedAmount: 0,
        lastReconciled: lastRec,
        status: lastRec !== "Pending" ? "Reconciled" : "Pending",
      };
    });

    return toPlain({
      accounts,
      entries,
    });
  });

export const postBankReconciliationFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      accountCode: z.string(),
      statementBalance: z.number(),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ success: boolean; lastReconciled: string }> => {
    await connectDB();
    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    await FinanceTransaction.findOneAndUpdate(
      { type: "account", "data.code": data.accountCode },
      {
        $set: {
          "data.lastReconciled": today,
          "data.statementBalance": data.statementBalance,
          "data.status": "Reconciled",
        },
      }
    );

    return { success: true, lastReconciled: today };
  });

// ─── Taxation & Compliance Server Functions ──────────────────────────────────

export interface TaxTemplateItem {
  id?: string;
  name: string;
  appliesTo: "Sales" | "Purchase" | "Both";
  rates: string;
  isDefault: boolean;
  status: "Active" | "Inactive";
}

export interface TaxationComplianceData {
  outputGst: number;
  inputGst: number;
  netGstPayable: number;
  taxableSales: number;
  taxablePurchases: number;
  salesCount: number;
  purchaseCount: number;
  currentPeriodLabel: string;
  gstrJsonData: Record<string, unknown>;
  rateBreakdown: Array<{
    slab: string;
    salesTaxable: number;
    outputTax: number;
    purchaseTaxable: number;
    inputTax: number;
    netTax: number;
  }>;
  templates: TaxTemplateItem[];
}

export const getTaxationComplianceDataFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ period: z.string().optional() }).optional().parse(raw)
  )
  .handler(async (): Promise<TaxationComplianceData> => {
    await connectDB();

    const now = new Date();
    const currentPeriodLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const currentFp = `${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;

    // 1. Fetch Sales / Billing Section data (Output GST)
    const salesDocs = await SalesDocModel.find({
      docType: { $in: ["INVOICE", "POS_INVOICE"] },
      status: { $nin: ["CANCELLED", "VOID", "DRAFT"] },
    })
      .sort({ docDate: -1, createdAt: -1 })
      .limit(1000)
      .lean();

    const visits = await ClinicalVisit.find({
      status: { $nin: ["Cancelled", "CANCELLED", "VOID", "Void", "cancelled", "void"] },
    })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    let taxableSales = 0;
    let outputGst = 0;
    let salesCount = 0;

    const slabMap: Record<
      string,
      { salesTaxable: number; outputTax: number; purchaseTaxable: number; inputTax: number }
    > = {
      "18%": { salesTaxable: 0, outputTax: 0, purchaseTaxable: 0, inputTax: 0 },
      "12%": { salesTaxable: 0, outputTax: 0, purchaseTaxable: 0, inputTax: 0 },
      "5%": { salesTaxable: 0, outputTax: 0, purchaseTaxable: 0, inputTax: 0 },
      "0% / Exempt": { salesTaxable: 0, outputTax: 0, purchaseTaxable: 0, inputTax: 0 },
      "Other": { salesTaxable: 0, outputTax: 0, purchaseTaxable: 0, inputTax: 0 },
    };

    const b2bInvoices: any[] = [];
    let b2csTotal = 0;
    let b2csTaxTotal = 0;
    const seenSalesDocNumbers = new Set<string>();

    for (const doc of salesDocs as any[]) {
      seenSalesDocNumbers.add(doc.docNumber);
      salesCount++;
      const taxVal = Number(doc.taxableValue || 0);
      const taxAmt = Number(
        (doc.cgst || 0) + (doc.sgst || 0) + (doc.igst || 0) + (doc.cess || 0)
      );
      taxableSales += taxVal;
      outputGst += taxAmt;

      if (doc.partyGstin && doc.partyGstin.trim().length === 15) {
        b2bInvoices.push({
          inum: doc.docNumber,
          idt: (doc.docDate || "").slice(0, 10),
          val: Number(doc.grandTotal || 0),
          pos: doc.placeOfSupply || "27",
          rchrg: doc.reverseCharge ? "Y" : "N",
          inv_typ: "R",
          itms: [
            {
              num: 1,
              itm_det: {
                txval: taxVal,
                rt: taxVal > 0 ? Math.round((taxAmt / taxVal) * 100) : 18,
                camt: Number(doc.cgst || 0),
                samt: Number(doc.sgst || 0),
                iamt: Number(doc.igst || 0),
              },
            },
          ],
        });
      } else {
        b2csTotal += taxVal;
        b2csTaxTotal += taxAmt;
      }

      if (doc.lines && doc.lines.length > 0) {
        for (const line of doc.lines) {
          const lTaxVal = Number(line.taxableValue || 0);
          const lTaxAmt = Number((line.cgst || 0) + (line.sgst || 0) + (line.igst || 0));
          const rate = Number(line.gstRate || 0);
          const slabKey =
            rate === 18
              ? "18%"
              : rate === 12
              ? "12%"
              : rate === 5
              ? "5%"
              : rate === 0
              ? "0% / Exempt"
              : "Other";
          slabMap[slabKey].salesTaxable += lTaxVal;
          slabMap[slabKey].outputTax += lTaxAmt;
        }
      } else {
        const rate = taxVal > 0 ? Math.round((taxAmt / taxVal) * 100) : 18;
        const slabKey =
          rate === 18
            ? "18%"
            : rate === 12
            ? "12%"
            : rate === 5
            ? "5%"
            : rate === 0
            ? "0% / Exempt"
            : "Other";
        slabMap[slabKey].salesTaxable += taxVal;
        slabMap[slabKey].outputTax += taxAmt;
      }
    }

    // Process clinical visits not already covered in salesDocs
    for (const v of visits as any[]) {
      const invNo = v.invoiceNo || v.visitId;
      if (invNo && seenSalesDocNumbers.has(invNo)) continue;
      salesCount++;
      const vGst = Number(v.gstAmount || 0);
      const vTaxable = Number(
        v.taxableAmount || (v.totalAmount ? Math.max(0, v.totalAmount - vGst) : 0)
      );
      taxableSales += vTaxable;
      outputGst += vGst;
      b2csTotal += vTaxable;
      b2csTaxTotal += vGst;

      const slabKey = vGst > 0 ? "18%" : "0% / Exempt";
      slabMap[slabKey].salesTaxable += vTaxable;
      slabMap[slabKey].outputTax += vGst;
    }

    // 2. Fetch Inventory Section GST Bills (Input Tax Credit / Purchases)
    const purchaseBills = await PurchaseBillModel.find({
      status: { $nin: ["VOID", "CANCELLED"] },
    })
      .sort({ billDate: -1, createdAt: -1 })
      .limit(1000)
      .lean();

    const expenses = await ExpenseModel.find({
      status: "ACTIVE",
      categoryNature: "BUSINESS",
      gstAmount: { $gt: 0 },
    })
      .sort({ expenseDate: -1 })
      .limit(500)
      .lean();

    let taxablePurchases = 0;
    let inputGst = 0;
    let purchaseCount = 0;

    for (const bill of purchaseBills as any[]) {
      purchaseCount++;
      const bTaxable = Number(bill.taxableTotal || 0);
      const bTax = Number(
        (bill.cgstTotal || 0) + (bill.sgstTotal || 0) + (bill.igstTotal || 0)
      );
      taxablePurchases += bTaxable;
      if (bill.itcEligible !== false) {
        inputGst += bTax;
      }

      if (bill.items && bill.items.length > 0) {
        for (const item of bill.items) {
          const iTaxVal = Number(item.taxableAmount || 0);
          const iTax = Number(item.taxAmount || 0);
          const rate = Number(item.gstPct || 0);
          const slabKey =
            rate === 18
              ? "18%"
              : rate === 12
              ? "12%"
              : rate === 5
              ? "5%"
              : rate === 0
              ? "0% / Exempt"
              : "Other";
          slabMap[slabKey].purchaseTaxable += iTaxVal;
          if (bill.itcEligible !== false) {
            slabMap[slabKey].inputTax += iTax;
          }
        }
      } else {
        const rate = bTaxable > 0 ? Math.round((bTax / bTaxable) * 100) : 18;
        const slabKey =
          rate === 18
            ? "18%"
            : rate === 12
            ? "12%"
            : rate === 5
            ? "5%"
            : rate === 0
            ? "0% / Exempt"
            : "Other";
        slabMap[slabKey].purchaseTaxable += bTaxable;
        if (bill.itcEligible !== false) {
          slabMap[slabKey].inputTax += bTax;
        }
      }
    }

    // Process business expenses with ITC
    for (const exp of expenses as any[]) {
      const eTaxable = Number(
        exp.taxableValue || Math.max(0, exp.totalAmount - (exp.gstAmount || 0))
      );
      const eGst = Number(exp.gstAmount || 0);
      taxablePurchases += eTaxable;
      if (exp.itcClaimed) {
        inputGst += eGst;
      }
      slabMap["18%"].purchaseTaxable += eTaxable;
      if (exp.itcClaimed) {
        slabMap["18%"].inputTax += eGst;
      }
    }

    const netGstPayable = outputGst - inputGst;

    // Rate breakdown array
    const rateBreakdown = Object.entries(slabMap).map(([slab, data]) => ({
      slab,
      salesTaxable: Math.round(data.salesTaxable * 100) / 100,
      outputTax: Math.round(data.outputTax * 100) / 100,
      purchaseTaxable: Math.round(data.purchaseTaxable * 100) / 100,
      inputTax: Math.round(data.inputTax * 100) / 100,
      netTax: Math.round((data.outputTax - data.inputTax) * 100) / 100,
    }));

    // GSTR-1 JSON Payload
    const gstrJsonData = {
      gstin: "27AABCV1234F1Z5",
      fp: currentFp,
      cur_gt: taxableSales,
      gt: taxableSales,
      b2b: b2bInvoices.length > 0 ? [{ ctin: "27AABCM8890K1ZP", inv: b2bInvoices }] : [],
      b2cs:
        b2csTotal > 0
          ? [
              {
                sply_ty: "INTRA",
                txval: b2csTotal,
                rt: 18,
                camt: b2csTaxTotal / 2,
                samt: b2csTaxTotal / 2,
              },
            ]
          : [],
    };

    // 3. GST Tax Templates from DB
    const templateDocs = await FinanceTransaction.find({ type: "tax_template" })
      .sort({ createdAt: -1 })
      .lean();

    let templates: TaxTemplateItem[] = [];
    if (templateDocs.length > 0) {
      templates = templateDocs.map((d: any) => {
        const t = d.data || {};
        const rates =
          (t.rows || []).map((r: any) => `${r.taxType} ${r.rate}%`).join(" + ") || "0%";
        return {
          id: String(d._id),
          name: t.name,
          appliesTo: t.appliesTo || "Sales",
          rates,
          isDefault: Boolean(t.isDefault),
          status: "Active" as const,
        };
      });
    } else {
      const defaultSlabs = [
        {
          name: "GST 18% (Standard Rate)",
          appliesTo: "Both" as const,
          isDefault: true,
          isInclusive: false,
          rows: [
            { account: "CGST", taxType: "CGST" as const, rate: 9 },
            { account: "SGST", taxType: "SGST" as const, rate: 9 },
          ],
        },
        {
          name: "GST 12% (Sales & Supplies)",
          appliesTo: "Both" as const,
          isDefault: false,
          isInclusive: false,
          rows: [
            { account: "CGST", taxType: "CGST" as const, rate: 6 },
            { account: "SGST", taxType: "SGST" as const, rate: 6 },
          ],
        },
        {
          name: "GST 5% (Medicines & Pharma)",
          appliesTo: "Both" as const,
          isDefault: false,
          isInclusive: false,
          rows: [
            { account: "CGST", taxType: "CGST" as const, rate: 2.5 },
            { account: "SGST", taxType: "SGST" as const, rate: 2.5 },
          ],
        },
        {
          name: "GST 0% (Exempt Services & Live Animals)",
          appliesTo: "Sales" as const,
          isDefault: false,
          isInclusive: false,
          rows: [
            { account: "CGST", taxType: "CGST" as const, rate: 0 },
            { account: "SGST", taxType: "SGST" as const, rate: 0 },
          ],
        },
      ];

      for (const t of defaultSlabs) {
        await FinanceTransaction.create({ type: "tax_template", data: t });
      }

      const fresh = await FinanceTransaction.find({ type: "tax_template" }).lean();
      templates = fresh.map((d: any) => {
        const t = d.data || {};
        const rates =
          (t.rows || []).map((r: any) => `${r.taxType} ${r.rate}%`).join(" + ") || "0%";
        return {
          id: String(d._id),
          name: t.name,
          appliesTo: t.appliesTo || "Sales",
          rates,
          isDefault: Boolean(t.isDefault),
          status: "Active" as const,
        };
      });
    }

    return toPlain({
      outputGst: Math.round(outputGst * 100) / 100,
      inputGst: Math.round(inputGst * 100) / 100,
      netGstPayable: Math.round(netGstPayable * 100) / 100,
      taxableSales: Math.round(taxableSales * 100) / 100,
      taxablePurchases: Math.round(taxablePurchases * 100) / 100,
      salesCount,
      purchaseCount,
      currentPeriodLabel,
      gstrJsonData,
      rateBreakdown,
      templates,
    });
  });

