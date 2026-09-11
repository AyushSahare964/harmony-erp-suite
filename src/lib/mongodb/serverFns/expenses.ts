import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ExpenseModel } from "@/lib/mongodb/models/Expense";
import { ExpenseCategoryModel, seedExpenseCategories } from "@/lib/mongodb/models/ExpenseCategory";
import { todayIST, fiscalYearRange } from "@/lib/utils/dateUtils";
import { nextSeq } from "./counters";

export interface ExpenseRow {
  _id: string; voucherNo: string; expenseDate: string; categoryId: string;
  categoryName: string; categoryNature: "BUSINESS" | "PERSONAL"; paidTo?: string;
  billRefNo?: string; totalAmount: number; gstAmount?: number; vendorGstin?: string;
  description?: string;
  paymentLines: { mode: string; accountId: string; accountName: string; amount: number; referenceNo?: string; chequeDate?: string; }[];
  status: "ACTIVE" | "VOID"; voidReason?: string; createdAt: string;
}

function toRow(d: any): ExpenseRow {
  return {
    _id: String(d._id), voucherNo: d.voucherNo, expenseDate: d.expenseDate,
    categoryId: String(d.categoryId), categoryName: d.categoryName, categoryNature: d.categoryNature,
    paidTo: d.paidTo, billRefNo: d.billRefNo, totalAmount: d.totalAmount,
    gstAmount: d.gstAmount, vendorGstin: d.vendorGstin, description: d.description,
    paymentLines: (d.paymentLines ?? []).map((l: any) => ({
      mode: l.mode, accountId: l.accountId, accountName: l.accountName,
      amount: l.amount, referenceNo: l.referenceNo, chequeDate: l.chequeDate,
    })),
    status: d.status, voidReason: d.voidReason, createdAt: d.createdAt?.toISOString?.() ?? "",
  };
}

export const listExpensesFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({
    from: z.string().optional(), to: z.string().optional(),
    categoryId: z.string().optional(), mode: z.string().optional(),
    nature: z.enum(["BUSINESS", "PERSONAL", "ALL"]).optional(),
    q: z.string().optional(), status: z.enum(["ACTIVE", "VOID", "ALL"]).optional(),
  }).optional().parse(raw))
  .handler(async ({ data }): Promise<ExpenseRow[]> => {
    await connectDB();
    const today = todayIST();
    const from = data?.from ?? today.slice(0, 7) + "-01";
    const to = data?.to ?? today;
    const filter: Record<string, any> = { expenseDate: { ["$gte"]: from, ["$lte"]: to } };
    if (data?.status && data.status !== "ALL") filter["status"] = data.status;
    else if (!data?.status) filter["status"] = "ACTIVE";
    if (data?.categoryId) filter["categoryId"] = data.categoryId;
    if (data?.nature && data.nature !== "ALL") filter["categoryNature"] = data.nature;
    if (data?.mode) filter["paymentLines.mode"] = data.mode;
    if (data?.q) {
      const q = data.q.trim();
      const re = { ["$regex"]: q, ["$options"]: "i" };
      filter["$or"] = [{ voucherNo: re }, { categoryName: re }, { paidTo: re }, { description: re }];
    }
    const docs = await ExpenseModel.find(filter).sort({ expenseDate: -1, createdAt: -1 }).lean();
    return docs.map(toRow);
  });

const PaymentLineZ = z.object({
  mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"]),
  accountId: z.string(), accountName: z.string(), amount: z.number().positive(),
  referenceNo: z.string().optional(), chequeDate: z.string().optional(),
});

export const createExpenseFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({
    expenseDate: z.string(), categoryId: z.string(), paidTo: z.string().optional(),
    billRefNo: z.string().optional(), totalAmount: z.number().positive(),
    gstAmount: z.number().optional(), vendorGstin: z.string().optional(),
    description: z.string().optional(), attachmentUrl: z.string().optional(),
    paymentLines: z.array(PaymentLineZ).min(1),
  }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean; _id: string; voucherNo: string }> => {
    await connectDB();
    await seedExpenseCategories();
    const linesTotal = data.paymentLines.reduce((s, l) => s + l.amount, 0);
    if (Math.abs(linesTotal - data.totalAmount) > 0.01)
      throw new Error(`Payment lines total (₹${linesTotal.toFixed(2)}) does not match expense total (₹${data.totalAmount.toFixed(2)})`);
    for (const l of data.paymentLines)
      if (l.mode === "CHEQUE" && !l.chequeDate) throw new Error("Cheque payment requires a cheque date");
    const cat = await ExpenseCategoryModel.findById(data.categoryId).lean();
    if (!cat) throw new Error("Invalid expense category");
    const { from } = fiscalYearRange(data.expenseDate);
    const fyStart = parseInt(from.slice(0, 4), 10);
    const fyShort = `${fyStart}-${String(fyStart + 1).slice(2)}`;
    const id = await nextSeq(`expense_${fyStart}`, `EX/${fyShort}`, 4);
    const voucherNo = id.replace(/-(\d{4})$/, "/$1");

    const paymentLines = data.paymentLines.map((l) => ({
      mode: l.mode,
      accountId: l.accountId,
      accountName: l.accountName,
      amount: l.amount,
      ...(l.referenceNo ? { referenceNo: l.referenceNo } : {}),
      ...(l.chequeDate ? { chequeDate: l.chequeDate } : {}),
    }));

    const docData: Record<string, any> = {
      voucherNo,
      expenseDate: data.expenseDate,
      categoryId: data.categoryId,
      categoryName: cat.name,
      categoryNature: cat.nature,
      totalAmount: data.totalAmount,
      paymentLines,
      status: "ACTIVE",
    };
    if (data.paidTo) docData.paidTo = data.paidTo;
    if (data.billRefNo) docData.billRefNo = data.billRefNo;
    if (data.gstAmount !== undefined) docData.gstAmount = data.gstAmount;
    if (data.vendorGstin) docData.vendorGstin = data.vendorGstin;
    if (data.description) docData.description = data.description;
    if (data.attachmentUrl) docData.attachmentUrl = data.attachmentUrl;

    const doc: any = await ExpenseModel.create(docData);
    return { ok: true, _id: String(doc._id), voucherNo };
  });

export const voidExpenseFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), reason: z.string().min(3) }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    const doc = await ExpenseModel.findById(data.id);
    if (!doc) throw new Error("Expense not found");
    if (doc.status === "VOID") throw new Error("Already voided");
    doc.status = "VOID"; doc.voidReason = data.reason;
    await doc.save();
    return { ok: true };
  });

export interface ExpenseSummary { total: number; byMode: Record<string, number>; byCategory: { categoryName: string; total: number }[]; }

export const getExpenseSummaryFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ from: z.string(), to: z.string() }).optional().parse(raw))
  .handler(async ({ data }): Promise<ExpenseSummary> => {
    await connectDB();
    const today = todayIST();
    const from = data?.from ?? today.slice(0, 7) + "-01";
    const to = data?.to ?? today;
    const docs = await ExpenseModel.find({ expenseDate: { ["$gte"]: from, ["$lte"]: to }, status: "ACTIVE" }).lean();
    const total = docs.reduce((s, d) => s + d.totalAmount, 0);
    const byMode: Record<string, number> = {};
    const byCat: Record<string, number> = {};
    for (const d of docs) {
      byCat[d.categoryName] = (byCat[d.categoryName] || 0) + d.totalAmount;
      for (const l of d.paymentLines) byMode[l.mode] = (byMode[l.mode] || 0) + l.amount;
    }
    return {
      total, byMode,
      byCategory: Object.entries(byCat).map(([categoryName, t]) => ({ categoryName, total: t as number })).sort((a, b) => b.total - a.total),
    };
  });
