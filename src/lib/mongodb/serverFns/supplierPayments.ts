import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { SupplierPaymentModel, type ISupplierPayment } from "@/lib/mongodb/models/SupplierPayment";
import { PurchaseBillModel } from "@/lib/mongodb/models/PurchaseBill";
import { SupplierModel } from "@/lib/mongodb/models/Supplier";
import { todayIST, fiscalYearRange } from "@/lib/utils/dateUtils";
import { nextSeq } from "./counters";

export interface SupplierPaymentRow {
  _id: string;
  voucherNo: string;
  supplierId: string;
  supplierName: string;
  paymentDate: string;
  totalAmount: number;
  source: "PAYMENT_OUT" | "BILL_ENTRY";
  allocationMode: "SELECTED" | "OLDEST_FIRST" | "ON_ACCOUNT";
  paymentLines: {
    mode: string;
    accountId: string;
    accountName: string;
    amount: number;
    referenceNo?: string;
    chequeDate?: string;
  }[];
  allocations: {
    purchaseBillId: string;
    billRef: string;
    amount: number;
    allocatedOn: string;
  }[];
  remarks?: string;
  status: "ACTIVE" | "VOID";
  voidReason?: string;
  createdAt: string;
}

function toPaymentRow(d: any): SupplierPaymentRow {
  return {
    _id: String(d._id),
    voucherNo: d.voucherNo,
    supplierId: String(d.supplierId),
    supplierName: d.supplierName,
    paymentDate: d.paymentDate,
    totalAmount: d.totalAmount,
    source: d.source ?? "PAYMENT_OUT",
    allocationMode: d.allocationMode ?? "SELECTED",
    paymentLines: (d.paymentLines ?? []).map((l: any) => ({
      mode: l.mode,
      accountId: l.accountId,
      accountName: l.accountName,
      amount: l.amount,
      referenceNo: l.referenceNo,
      chequeDate: l.chequeDate,
    })),
    allocations: (d.allocations ?? []).map((a: any) => ({
      purchaseBillId: a.purchaseBillId,
      billRef: a.billRef,
      amount: a.amount,
      allocatedOn: a.allocatedOn,
    })),
    remarks: d.remarks,
    status: d.status,
    voidReason: d.voidReason,
    createdAt: d.createdAt?.toISOString?.() ?? "",
  };
}

export const listSupplierPaymentsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      supplierId: z.string().optional(),
      mode: z.string().optional(),
      status: z.enum(["ACTIVE", "VOID", "ALL"]).optional(),
      q: z.string().optional(),
    }).optional().parse(raw)
  )
  .handler(async ({ data }): Promise<SupplierPaymentRow[]> => {
    await connectDB();
    const today = todayIST();
    const from = data?.from ?? today.slice(0, 7) + "-01";
    const to = data?.to ?? today;
    const filter: Record<string, any> = { paymentDate: { $gte: from, $lte: to } };
    if (data?.supplierId) filter["supplierId"] = data.supplierId;
    if (data?.status && data.status !== "ALL") filter["status"] = data.status;
    else if (!data?.status) filter["status"] = "ACTIVE";
    if (data?.mode) filter["paymentLines.mode"] = data.mode;
    if (data?.q) {
      const q = data.q.trim();
      const re = { $regex: q, $options: "i" };
      filter["$or"] = [{ voucherNo: re }, { supplierName: re }, { remarks: re }];
    }
    const docs = await SupplierPaymentModel.find(filter).sort({ paymentDate: -1, createdAt: -1 }).lean();
    return docs.map(toPaymentRow);
  });

const PaymentLineInputZ = z.object({
  mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"]),
  accountId: z.string(),
  accountName: z.string(),
  amount: z.number().positive(),
  referenceNo: z.string().optional(),
  chequeDate: z.string().optional(),
});

const AllocationInputZ = z.object({
  purchaseBillId: z.string(),
  billRef: z.string(),
  amount: z.number().positive(),
});

export const createSupplierPaymentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      supplierId: z.string(),
      supplierName: z.string().optional(),
      paymentDate: z.string(),
      totalAmount: z.number().positive(),
      allocationMode: z.enum(["SELECTED", "OLDEST_FIRST", "ON_ACCOUNT"]).default("SELECTED"),
      paymentLines: z.array(PaymentLineInputZ).min(1),
      allocations: z.array(AllocationInputZ).default([]),
      remarks: z.string().optional(),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ ok: boolean; _id: string; voucherNo: string }> => {
    await connectDB();
    const supplier = await SupplierModel.findById(data.supplierId).lean();
    const supplierName = supplier?.name ?? data.supplierName ?? "Unknown Supplier";

    const linesTotal = data.paymentLines.reduce((s, l) => s + l.amount, 0);
    if (Math.abs(linesTotal - data.totalAmount) > 0.01) {
      throw new Error(`Payment lines total (₹${linesTotal.toFixed(2)}) does not match total amount (₹${data.totalAmount.toFixed(2)})`);
    }

    const { from } = fiscalYearRange(data.paymentDate);
    const fyStart = parseInt(from.slice(0, 4), 10);
    const fyShort = `${fyStart}-${String(fyStart + 1).slice(2)}`;
    const id = await nextSeq(`payment_out_${fyStart}`, `PO/${fyShort}`, 4);
    const voucherNo = id.replace(/-(\d{4})$/, "/$1");

    const paymentLines = data.paymentLines.map((l) => ({
      mode: l.mode,
      accountId: l.accountId,
      accountName: l.accountName,
      amount: l.amount,
      ...(l.referenceNo ? { referenceNo: l.referenceNo } : {}),
      ...(l.chequeDate ? { chequeDate: l.chequeDate } : {}),
    }));

    const allocations = data.allocations.map((a) => ({
      purchaseBillId: a.purchaseBillId,
      billRef: a.billRef,
      amount: a.amount,
      allocatedOn: data.paymentDate,
    }));

    // Update purchase bills amountPaid and status
    for (const alloc of allocations) {
      const bill = await PurchaseBillModel.findById(alloc.purchaseBillId);
      if (bill && bill.status !== "VOID") {
        bill.amountPaid = (bill.amountPaid || 0) + alloc.amount;
        if (bill.amountPaid >= bill.grandTotal - 0.01) {
          bill.status = "PAID";
        } else {
          bill.status = "PARTIAL";
        }
        await bill.save();
      }
    }

    const docData: Record<string, any> = {
      voucherNo,
      supplierId: data.supplierId,
      supplierName,
      paymentDate: data.paymentDate,
      totalAmount: data.totalAmount,
      source: "PAYMENT_OUT",
      allocationMode: data.allocationMode,
      paymentLines,
      allocations,
      status: "ACTIVE",
    };
    if (data.remarks) docData["remarks"] = data.remarks;

    const doc: any = await SupplierPaymentModel.create(docData);
    return { ok: true, _id: String(doc._id), voucherNo };
  });

export const voidSupplierPaymentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), reason: z.string().min(3) }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    const payment = await SupplierPaymentModel.findById(data.id);
    if (!payment) throw new Error("Payment voucher not found");
    if (payment.status === "VOID") throw new Error("Already voided");

    // Reverse allocations on bills
    for (const alloc of payment.allocations || []) {
      const bill = await PurchaseBillModel.findById(alloc.purchaseBillId);
      if (bill && bill.status !== "VOID") {
        bill.amountPaid = Math.max(0, (bill.amountPaid || 0) - alloc.amount);
        if (bill.amountPaid === 0) {
          bill.status = "UNPAID";
        } else {
          bill.status = "PARTIAL";
        }
        await bill.save();
      }
    }

    payment.status = "VOID";
    payment.voidReason = data.reason;
    await payment.save();
    return { ok: true };
  });

// ─── Supplier Ledger & Payables Summary ──────────────────────────────────────────

export interface LedgerEntry {
  date: string;
  type: "OPENING" | "BILL" | "PAYMENT";
  voucherNo: string;
  particulars: string;
  debit: number;   // payment reduces liability (Debit)
  credit: number;  // bill increases liability (Credit)
  balance: number; // running balance
  balanceType: "Cr" | "Dr";
}

export interface SupplierLedgerResult {
  supplier: {
    _id: string;
    name: string;
    phone?: string;
    gstin?: string;
    creditDays: number;
    openingBalance: number;
    openingBalanceType: "Cr" | "Dr";
  };
  openingBalance: number;
  openingBalanceType: "Cr" | "Dr";
  closingBalance: number;
  closingBalanceType: "Cr" | "Dr";
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
}

export const getSupplierLedgerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      supplierId: z.string(),
      from: z.string(),
      to: z.string(),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<SupplierLedgerResult> => {
    await connectDB();
    const supplier = await SupplierModel.findById(data.supplierId).lean();
    if (!supplier) throw new Error("Supplier not found");

    const baseOpening = supplier.openingBalance || 0;
    const isBaseCredit = (supplier.openingBalanceType ?? "Cr") === "Cr";
    let priorBalance = isBaseCredit ? baseOpening : -baseOpening;

    // Prior bills before `from`
    const priorBills = await PurchaseBillModel.find({
      supplierId: data.supplierId,
      billDate: { $lt: data.from },
      status: { $ne: "VOID" },
    }).lean();
    for (const b of priorBills) {
      priorBalance += b.grandTotal; // liability increases (Credit)
    }

    // Prior payments before `from`
    const priorPayments = await SupplierPaymentModel.find({
      supplierId: data.supplierId,
      paymentDate: { $lt: data.from },
      status: "ACTIVE",
    }).lean();
    for (const p of priorPayments) {
      priorBalance -= p.totalAmount; // liability decreases (Debit)
    }

    const openingBalance = Math.abs(priorBalance);
    const openingBalanceType = priorBalance >= 0 ? "Cr" : "Dr";

    // Current period bills
    const periodBills = await PurchaseBillModel.find({
      supplierId: data.supplierId,
      billDate: { $gte: data.from, $lte: data.to },
      status: { $ne: "VOID" },
    }).lean();

    // Current period payments
    const periodPayments = await SupplierPaymentModel.find({
      supplierId: data.supplierId,
      paymentDate: { $gte: data.from, $lte: data.to },
      status: "ACTIVE",
    }).lean();

    // Merge and sort chronologically
    const allEvents: { date: string; createdAt: Date; type: "BILL" | "PAYMENT"; raw: any }[] = [
      ...periodBills.map((b) => ({ date: b.billDate, createdAt: b.createdAt, type: "BILL" as const, raw: b })),
      ...periodPayments.map((p) => ({ date: p.paymentDate, createdAt: p.createdAt, type: "PAYMENT" as const, raw: p })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime());

    let running = priorBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries: LedgerEntry[] = [];
    for (const ev of allEvents) {
      if (ev.type === "BILL") {
        const b = ev.raw;
        running += b.grandTotal;
        totalCredit += b.grandTotal;
        entries.push({
          date: b.billDate,
          type: "BILL",
          voucherNo: b.internalRef,
          particulars: `Purchase Bill #${b.billNumber}`,
          debit: 0,
          credit: b.grandTotal,
          balance: Math.abs(running),
          balanceType: running >= 0 ? "Cr" : "Dr",
        });
      } else {
        const p = ev.raw;
        running -= p.totalAmount;
        totalDebit += p.totalAmount;
        entries.push({
          date: p.paymentDate,
          type: "PAYMENT",
          voucherNo: p.voucherNo,
          particulars: `Payment Out (${(p.paymentLines || []).map((l: any) => l.mode).join(", ")})`,
          debit: p.totalAmount,
          credit: 0,
          balance: Math.abs(running),
          balanceType: running >= 0 ? "Cr" : "Dr",
        });
      }
    }

    const closingBalance = Math.abs(running);
    const closingBalanceType = running >= 0 ? "Cr" : "Dr";

    return {
      supplier: {
        _id: String(supplier._id),
        name: supplier.name,
        ...(supplier.phone ? { phone: supplier.phone } : {}),
        ...(supplier.gstin ? { gstin: supplier.gstin } : {}),
        creditDays: supplier.creditDays ?? 30,
        openingBalance: supplier.openingBalance ?? 0,
        openingBalanceType: (supplier.openingBalanceType === "Debit" || supplier.openingBalanceType === "Dr") ? "Dr" : "Cr",
      },
      openingBalance,
      openingBalanceType,
      closingBalance,
      closingBalanceType,
      entries,
      totalDebit,
      totalCredit,
    };
  });

export interface PayablesAgeingRow {
  supplierId: string;
  supplierName: string;
  phone?: string | undefined;
  creditDays: number;
  totalOutstanding: number;
  current: number; // 0-30 days
  thirtyPlus: number; // 31-60
  sixtyPlus: number; // 61-90
  ninetyPlus: number; // >90
}

export const getPayablesSummaryFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<PayablesAgeingRow[]> => {
    await connectDB();
    const suppliers = await SupplierModel.find({ isActive: true }).lean();
    const activeBills = await PurchaseBillModel.find({
      status: { $in: ["UNPAID", "PARTIAL"] },
    }).lean();

    const today = new Date(todayIST());

    const map: Record<string, PayablesAgeingRow> = {};
    for (const s of suppliers) {
      const id = String(s._id);
      map[id] = {
        supplierId: id,
        supplierName: s.name,
        ...(s.phone ? { phone: s.phone } : {}),
        creditDays: s.creditDays ?? 30,
        totalOutstanding: s.openingBalance && s.openingBalanceType === "Cr" ? s.openingBalance : 0,
        current: 0,
        thirtyPlus: 0,
        sixtyPlus: 0,
        ninetyPlus: 0,
      };
    }

    for (const b of activeBills) {
      const sid = String(b.supplierId);
      if (!map[sid]) {
        map[sid] = {
          supplierId: sid,
          supplierName: b.supplierName,
          creditDays: 30,
          totalOutstanding: 0,
          current: 0,
          thirtyPlus: 0,
          sixtyPlus: 0,
          ninetyPlus: 0,
        };
      }
      const balance = Math.max(0, (b.grandTotal || 0) - (b.amountPaid || 0));
      if (balance <= 0) continue;

      map[sid].totalOutstanding += balance;
      const billDate = new Date(b.billDate);
      const diffDays = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        map[sid].current += balance;
      } else if (diffDays <= 60) {
        map[sid].thirtyPlus += balance;
      } else if (diffDays <= 90) {
        map[sid].sixtyPlus += balance;
      } else {
        map[sid].ninetyPlus += balance;
      }
    }

    return Object.values(map)
      .filter((r) => r.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  });
