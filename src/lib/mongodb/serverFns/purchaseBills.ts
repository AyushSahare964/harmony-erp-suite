import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { PurchaseBillModel, type IPurchaseBill } from "@/lib/mongodb/models/PurchaseBill";
import { SupplierModel } from "@/lib/mongodb/models/Supplier";
import { SupplierPaymentModel } from "@/lib/mongodb/models/SupplierPayment";
import { todayIST, fiscalYearRange } from "@/lib/utils/dateUtils";
import { nextSeq } from "./counters";

export interface PurchaseBillItemRow {
  lineNo: number;
  itemType: "INVENTORY" | "NON_INVENTORY";
  inventoryItemId?: string;
  expenseCategoryId?: string;
  description: string;
  hsnCode?: string;
  batchNo?: string;
  expiryDate?: string;
  qty: number;
  freeQty: number;
  unit?: string;
  purchaseRate: number;
  mrp?: number;
  discountPct: number;
  gstPct: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PurchaseBillRow {
  _id: string;
  internalRef: string;
  supplierId: string;
  supplierName: string;
  billNumber: string;
  billDate: string;
  dueDate?: string;
  taxType: "INTRA" | "INTER";
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "VOID";
  remarks?: string;
  attachmentUrl?: string;
  voidReason?: string;
  items: PurchaseBillItemRow[];
  createdAt: string;
}

function toBillRow(d: any): PurchaseBillRow {
  return {
    _id: String(d._id),
    internalRef: d.internalRef,
    supplierId: String(d.supplierId),
    supplierName: d.supplierName,
    billNumber: d.billNumber,
    billDate: d.billDate,
    dueDate: d.dueDate,
    taxType: d.taxType ?? "INTRA",
    subtotal: d.subtotal ?? 0,
    discountTotal: d.discountTotal ?? 0,
    taxableTotal: d.taxableTotal ?? 0,
    cgstTotal: d.cgstTotal ?? 0,
    sgstTotal: d.sgstTotal ?? 0,
    igstTotal: d.igstTotal ?? 0,
    otherCharges: d.otherCharges ?? 0,
    roundOff: d.roundOff ?? 0,
    grandTotal: d.grandTotal ?? 0,
    amountPaid: d.amountPaid ?? 0,
    status: d.status ?? "UNPAID",
    remarks: d.remarks,
    attachmentUrl: d.attachmentUrl,
    voidReason: d.voidReason,
    items: (d.items ?? []).map((it: any) => ({
      lineNo: it.lineNo,
      itemType: it.itemType ?? "INVENTORY",
      inventoryItemId: it.inventoryItemId,
      expenseCategoryId: it.expenseCategoryId,
      description: it.description,
      hsnCode: it.hsnCode,
      batchNo: it.batchNo,
      expiryDate: it.expiryDate,
      qty: it.qty,
      freeQty: it.freeQty ?? 0,
      unit: it.unit,
      purchaseRate: it.purchaseRate,
      mrp: it.mrp,
      discountPct: it.discountPct ?? 0,
      gstPct: it.gstPct ?? 0,
      taxableAmount: it.taxableAmount ?? 0,
      taxAmount: it.taxAmount ?? 0,
      lineTotal: it.lineTotal ?? 0,
    })),
    createdAt: d.createdAt?.toISOString?.() ?? "",
  };
}

export const listPurchaseBillsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      supplierId: z.string().optional(),
      status: z.enum(["UNPAID", "PARTIAL", "PAID", "VOID", "ALL"]).optional(),
      q: z.string().optional(),
    }).optional().parse(raw)
  )
  .handler(async ({ data }): Promise<PurchaseBillRow[]> => {
    await connectDB();
    const today = todayIST();
    const from = data?.from ?? today.slice(0, 7) + "-01";
    const to = data?.to ?? today;
    const filter: Record<string, any> = { billDate: { $gte: from, $lte: to } };
    if (data?.supplierId) filter.supplierId = data.supplierId;
    if (data?.status && data.status !== "ALL") filter.status = data.status;
    else if (!data?.status) filter.status = { $ne: "VOID" };
    if (data?.q) {
      const q = data.q.trim();
      const re = { $regex: q, $options: "i" };
      filter.$or = [{ internalRef: re }, { billNumber: re }, { supplierName: re }];
    }
    const docs = await PurchaseBillModel.find(filter).sort({ billDate: -1, createdAt: -1 }).lean();
    return docs.map(toBillRow);
  });

export const getPurchaseBillFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<PurchaseBillRow | null> => {
    await connectDB();
    const doc = await PurchaseBillModel.findById(data.id).lean();
    return doc ? toBillRow(doc) : null;
  });

const ItemInputZ = z.object({
  lineNo: z.number(),
  itemType: z.enum(["INVENTORY", "NON_INVENTORY"]).default("INVENTORY"),
  inventoryItemId: z.string().optional(),
  expenseCategoryId: z.string().optional(),
  description: z.string().min(1),
  hsnCode: z.string().optional(),
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
  qty: z.number().positive(),
  freeQty: z.number().default(0),
  unit: z.string().optional(),
  purchaseRate: z.number().nonnegative(),
  mrp: z.number().optional(),
  discountPct: z.number().default(0),
  gstPct: z.number().default(0),
  taxableAmount: z.number(),
  taxAmount: z.number(),
  lineTotal: z.number(),
});

const PaymentLineInputZ = z.object({
  mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"]),
  accountId: z.string(),
  accountName: z.string(),
  amount: z.number().positive(),
  referenceNo: z.string().optional(),
  chequeDate: z.string().optional(),
});

export const createPurchaseBillFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      supplierId: z.string(),
      supplierName: z.string().optional(),
      billNumber: z.string().min(1),
      billDate: z.string(),
      dueDate: z.string().optional(),
      taxType: z.enum(["INTRA", "INTER"]).default("INTRA"),
      items: z.array(ItemInputZ).min(1),
      subtotal: z.number(),
      discountTotal: z.number().default(0),
      taxableTotal: z.number(),
      cgstTotal: z.number().default(0),
      sgstTotal: z.number().default(0),
      igstTotal: z.number().default(0),
      otherCharges: z.number().default(0),
      roundOff: z.number().default(0),
      grandTotal: z.number().positive(),
      remarks: z.string().optional(),
      attachmentUrl: z.string().optional(),
      paymentNow: z.boolean().default(false),
      paymentLines: z.array(PaymentLineInputZ).optional(),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ ok: boolean; _id: string; internalRef: string }> => {
    await connectDB();
    const supplier = await SupplierModel.findById(data.supplierId).lean();
    const supplierName = supplier?.name ?? data.supplierName ?? "Unknown Supplier";

    const { from } = fiscalYearRange(data.billDate);
    const fyStart = parseInt(from.slice(0, 4), 10);
    const fyShort = `${fyStart}-${String(fyStart + 1).slice(2)}`;
    const id = await nextSeq(`purchase_bill_${fyStart}`, `PB/${fyShort}`, 4);
    const internalRef = id.replace(/-(\d{4})$/, "/$1");

    let amountPaid = 0;
    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";

    if (data.paymentNow && data.paymentLines && data.paymentLines.length > 0) {
      amountPaid = data.paymentLines.reduce((s, l) => s + l.amount, 0);
      if (amountPaid >= data.grandTotal - 0.01) {
        status = "PAID";
      } else if (amountPaid > 0) {
        status = "PARTIAL";
      }
    }

    const items = data.items.map((it) => {
      const itemDoc: Record<string, any> = {
        lineNo: it.lineNo,
        itemType: it.itemType,
        description: it.description,
        qty: it.qty,
        freeQty: it.freeQty,
        purchaseRate: it.purchaseRate,
        discountPct: it.discountPct,
        gstPct: it.gstPct,
        taxableAmount: it.taxableAmount,
        taxAmount: it.taxAmount,
        lineTotal: it.lineTotal,
      };
      if (it.inventoryItemId) itemDoc.inventoryItemId = it.inventoryItemId;
      if (it.expenseCategoryId) itemDoc.expenseCategoryId = it.expenseCategoryId;
      if (it.hsnCode) itemDoc.hsnCode = it.hsnCode;
      if (it.batchNo) itemDoc.batchNo = it.batchNo;
      if (it.expiryDate) itemDoc.expiryDate = it.expiryDate;
      if (it.unit) itemDoc.unit = it.unit;
      if (it.mrp !== undefined) itemDoc.mrp = it.mrp;
      return itemDoc;
    });

    const billData: Record<string, any> = {
      internalRef,
      supplierId: data.supplierId,
      supplierName,
      billNumber: data.billNumber,
      billDate: data.billDate,
      taxType: data.taxType,
      subtotal: data.subtotal,
      discountTotal: data.discountTotal,
      taxableTotal: data.taxableTotal,
      cgstTotal: data.cgstTotal,
      sgstTotal: data.sgstTotal,
      igstTotal: data.igstTotal,
      otherCharges: data.otherCharges,
      roundOff: data.roundOff,
      grandTotal: data.grandTotal,
      amountPaid,
      status,
      items,
    };
    if (data.dueDate) billData.dueDate = data.dueDate;
    if (data.remarks) billData.remarks = data.remarks;
    if (data.attachmentUrl) billData.attachmentUrl = data.attachmentUrl;

    const billDoc: any = await PurchaseBillModel.create(billData);
    const billId = String(billDoc._id);

    // If payment was recorded on the spot, create SupplierPayment entry
    if (data.paymentNow && data.paymentLines && data.paymentLines.length > 0 && amountPaid > 0) {
      const paySeqId = await nextSeq(`payment_out_${fyStart}`, `PO/${fyShort}`, 4);
      const voucherNo = paySeqId.replace(/-(\d{4})$/, "/$1");

      const paymentLines = data.paymentLines.map((l) => ({
        mode: l.mode,
        accountId: l.accountId,
        accountName: l.accountName,
        amount: l.amount,
        ...(l.referenceNo ? { referenceNo: l.referenceNo } : {}),
        ...(l.chequeDate ? { chequeDate: l.chequeDate } : {}),
      }));

      await SupplierPaymentModel.create({
        voucherNo,
        supplierId: data.supplierId,
        supplierName,
        paymentDate: data.billDate,
        totalAmount: amountPaid,
        source: "BILL_ENTRY",
        allocationMode: "SELECTED",
        paymentLines,
        allocations: [
          {
            purchaseBillId: billId,
            billRef: `${internalRef} (${data.billNumber})`,
            amount: amountPaid,
            allocatedOn: data.billDate,
          },
        ],
        status: "ACTIVE",
      });
    }

    return { ok: true, _id: billId, internalRef };
  });

export const voidPurchaseBillFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), reason: z.string().min(3) }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    const bill = await PurchaseBillModel.findById(data.id);
    if (!bill) throw new Error("Purchase bill not found");
    if (bill.status === "VOID") throw new Error("Bill already voided");
    bill.status = "VOID";
    bill.voidReason = data.reason;
    await bill.save();

    // Void any payment created directly from this bill
    await SupplierPaymentModel.updateMany(
      { "allocations.purchaseBillId": data.id, source: "BILL_ENTRY" },
      { status: "VOID", voidReason: `Auto-voided on bill cancellation: ${data.reason}` }
    );

    return { ok: true };
  });
