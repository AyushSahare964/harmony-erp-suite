import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb/client";
import { PurchaseBillModel, type IPurchaseBill } from "@/lib/mongodb/models/PurchaseBill";
import { SupplierModel } from "@/lib/mongodb/models/Supplier";
import { SupplierPaymentModel } from "@/lib/mongodb/models/SupplierPayment";
import { todayIST, fiscalYearRange } from "@/lib/utils/dateUtils";
import { nextSeq } from "./counters";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { receiveStockBatch } from "@/lib/mongodb/stockReceipt";
import { convertToBase } from "@/lib/inventory/packagingUtils";

/** "2027-03" -> "2027-03-31" (batches expire at month end); full dates pass through. */
function monthEnd(v: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return v;
  return `${m[1]}-${m[2]}-${String(new Date(Number(m[1]), Number(m[2]), 0).getDate()).padStart(2, "0")}`;
}

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
    if (data?.supplierId) filter["supplierId"] = data.supplierId;
    if (data?.status && data.status !== "ALL") filter["status"] = data.status;
    else if (!data?.status) filter["status"] = { $ne: "VOID" };
    if (data?.q) {
      const q = data.q.trim();
      const re = { $regex: q, $options: "i" };
      filter["$or"] = [{ internalRef: re }, { billNumber: re }, { supplierName: re }];
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

export const CreateBillZ = z.object({
      supplierId: z.string(),
      supplierName: z.string().optional(),
      billNumber: z.string().min(1),
      billDate: z.string(),
      dueDate: z.string().optional(),
      taxType: z.enum(["INTRA", "INTER"]).default("INTRA"),
      purchaseType: z.enum(["GST", "Non-GST", "Bill of Supply"]).optional(),
      placeOfSupply: z.string().optional(),
      poNumber: z.string().optional(),
      items: z.array(ItemInputZ).min(1),
      subtotal: z.number(),
      discountTotal: z.number().default(0),
      taxableTotal: z.number(),
      cgstTotal: z.number().default(0),
      sgstTotal: z.number().default(0),
      igstTotal: z.number().default(0),
      otherCharges: z.number().default(0),
      roundOff: z.number().default(0),
      grandTotal: z.number().nonnegative(),
      shippingAmount: z.number().min(0).optional(),
      receiveStock: z.boolean().default(false),
      remarks: z.string().optional(),
      attachmentUrl: z.string().optional(),
      paymentNow: z.boolean().default(false),
      paymentLines: z.array(PaymentLineInputZ).optional(),
    });
export type CreateBillInput = z.infer<typeof CreateBillZ>;

export async function createPurchaseBill(data: CreateBillInput): Promise<{ ok: boolean; _id: string; internalRef: string; stockPosted: number; stockErrors: string[] }> {
  await connectDB();
  // supplierId can be a placeholder (e.g. GENERIC_SUPPLIER) — only look up real ids
  const supplier = mongoose.isValidObjectId(data.supplierId)
    ? await SupplierModel.findById(data.supplierId).lean()
    : null;
  const supplierName = supplier?.name ?? data.supplierName ?? "Unknown Supplier";

  const { from } = fiscalYearRange(data.billDate);
  const fyStart = parseInt(from.slice(0, 4), 10);
  const fyShort = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  const id = await nextSeq(`purchase_bill_${fyStart}`, `PB/${fyShort}`, 4);
  const internalRef = id.replace(/-(\d{4})$/, "/$1");

  let amountPaid = 0;
  let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";

  if (data.grandTotal <= 0.01) status = "PAID";
  if (data.paymentNow && data.paymentLines && data.paymentLines.length > 0) {
    amountPaid = data.paymentLines.reduce((s, l) => s + l.amount, 0);
    if (amountPaid >= data.grandTotal - 0.01) {
      status = "PAID";
    } else if (amountPaid > 0) {
      status = "PARTIAL";
    }
  }

  // Link inventory lines by item code (the id the stock ledger uses); accepts an _id too.
  const resolved = new Map<number, any>();
  for (const it of data.items) {
    if (it.itemType !== "INVENTORY" || !it.inventoryItemId) continue;
    const q = mongoose.isValidObjectId(it.inventoryItemId)
      ? { $or: [{ itemCode: it.inventoryItemId }, { _id: it.inventoryItemId }] }
      : { itemCode: it.inventoryItemId };
    const found = await InventoryItem.findOne(q).lean();
    if (found) resolved.set(it.lineNo, found);
  }
  if (data.receiveStock) {
    const bad = data.items
      .filter((it) => resolved.has(it.lineNo) && (!it.batchNo?.trim() || !it.expiryDate?.trim()))
      .map((it) => it.description);
    if (bad.length > 0) {
      throw new Error(`Batch No. and Expiry are required to receive stock: ${bad.join(", ")}`);
    }
  }
  const shipping = data.shippingAmount ?? data.otherCharges;
  const taxableSum = data.items.reduce((sum, it) => sum + it.taxableAmount, 0);
  const shippingShare = (it: { taxableAmount: number }) =>
    taxableSum > 0 ? (shipping * it.taxableAmount) / taxableSum : 0;

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
    const linked = resolved.get(it.lineNo);
    if (linked) itemDoc["inventoryItemId"] = linked.itemCode;
    else if (it.inventoryItemId) itemDoc["inventoryItemId"] = it.inventoryItemId;
    itemDoc["landedCost"] =
      it.qty > 0 ? Math.round((it.purchaseRate + shippingShare(it) / it.qty) * 10000) / 10000 : it.purchaseRate;
    if (it.expenseCategoryId) itemDoc["expenseCategoryId"] = it.expenseCategoryId;
    if (it.hsnCode) itemDoc["hsnCode"] = it.hsnCode;
    if (it.batchNo) itemDoc["batchNo"] = it.batchNo;
    if (it.expiryDate) itemDoc["expiryDate"] = it.expiryDate;
    if (it.unit) itemDoc["unit"] = it.unit;
    if (it.mrp !== undefined) itemDoc["mrp"] = it.mrp;
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
    shippingAmount: shipping,
    roundOff: data.roundOff,
    grandTotal: data.grandTotal,
    amountPaid,
    status,
    items,
  };
  if (data.purchaseType) {
    billData["purchaseType"] = data.purchaseType;
    // No input tax credit on Non-GST / Bill of Supply purchases
    billData["itcEligible"] = data.purchaseType === "GST";
  }
  if (data.placeOfSupply) billData["placeOfSupply"] = data.placeOfSupply;
  if (data.poNumber) billData["poNumber"] = data.poNumber;
  if (data.dueDate) billData["dueDate"] = data.dueDate;
  if (data.remarks) billData["remarks"] = data.remarks;
  if (data.attachmentUrl) billData["attachmentUrl"] = data.attachmentUrl;

  let billDoc: any;
  try {
    billDoc = await PurchaseBillModel.create(billData);
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new Error(`Bill No. ${data.billNumber} is already entered for ${supplierName}.`);
    }
    throw err;
  }
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

  // Optional: receive the bill's inventory lines into stock (one batch per line)
  let stockPosted = 0;
  const stockErrors: string[] = [];
  if (data.receiveStock) {
    for (const it of data.items) {
      const item = resolved.get(it.lineNo);
      if (!item) continue;
      try {
        const h = item.packagingHierarchy;
        const unit = it.unit || h?.baseUnit || "";
        const accepted = h ? convertToBase(it.qty + it.freeQty, unit, h) : it.qty + it.freeQty;
        if (accepted <= 0) continue;
        await receiveStockBatch({
          itemId: String(item._id),
          itemCode: item.itemCode,
          itemName: item.name,
          batchNo: (it.batchNo ?? "").trim(),
          manufacturingDate: "",
          expiryDate: monthEnd((it.expiryDate ?? "").trim()),
          supplierId: data.supplierId,
          supplierName,
          purchaseOrderRef: data.poNumber || internalRef,
          invoiceBillNo: data.billNumber,
          receivedDate: data.billDate,
          receivedQty: accepted,
          acceptedQty: accepted,
          rejectedQty: 0,
          rejectionReason: "",
          // cost per base unit: what was actually paid (after discount, free qty spread in)
          purchasePricePerUnit: it.taxableAmount / accepted,
          landingCost: shippingShare(it),
          gstOnPurchase: it.gstPct,
          storageLocation: item.storageLocation || "",
          qualityChecked: false,
          qcInspectorName: "",
          remarks: `Received from purchase bill ${internalRef}`,
          actor: "Purchase Bill",
        });
        stockPosted++;
      } catch (e: any) {
        stockErrors.push(`${it.description}: ${e?.message ?? "stock posting failed"}`);
      }
    }
  }

  return { ok: true, _id: billId, internalRef, stockPosted, stockErrors };
}

export const createPurchaseBillFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => CreateBillZ.parse(raw))
  .handler(({ data }) => createPurchaseBill(data));

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

export const markPurchaseBillPaidFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      id: z.string(),
      mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"]).default("BANK_TRANSFER"),
      paymentDate: z.string().optional(),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    const bill = await PurchaseBillModel.findById(data.id);
    if (!bill) throw new Error("Purchase bill not found");
    if (bill.status === "PAID") return { ok: true };

    const payDate = data.paymentDate || todayIST();
    const remaining = Math.max(0, bill.grandTotal - (bill.amountPaid || 0));

    bill.amountPaid = bill.grandTotal;
    bill.status = "PAID";
    await bill.save();

    // Create a corresponding SupplierPayment voucher
    const { from } = fiscalYearRange(payDate);
    const fyStart = parseInt(from.slice(0, 4), 10);
    const fyShort = `${fyStart}-${String(fyStart + 1).slice(2)}`;
    const paySeqId = await nextSeq(`payment_out_${fyStart}`, `PO/${fyShort}`, 4);
    const voucherNo = paySeqId.replace(/-(\d{4})$/, "/$1");

    await SupplierPaymentModel.create({
      voucherNo,
      supplierId: bill.supplierId,
      supplierName: bill.supplierName,
      paymentDate: payDate,
      totalAmount: remaining > 0 ? remaining : bill.grandTotal,
      source: "BILL_ENTRY",
      allocationMode: "SELECTED",
      paymentLines: [
        {
          mode: data.mode,
          accountId: "DEFAULT_PAYMENT",
          accountName: data.mode === "CASH" ? "Cash Register" : "Main Bank Account",
          amount: remaining > 0 ? remaining : bill.grandTotal,
        },
      ],
      allocations: [
        {
          purchaseBillId: String(bill._id),
          billRef: `${bill.internalRef} (${bill.billNumber})`,
          amount: remaining > 0 ? remaining : bill.grandTotal,
          allocatedOn: payDate,
        },
      ],
      status: "ACTIVE",
    });

    return { ok: true };
  });

export const deletePurchaseBillFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    const bill = await PurchaseBillModel.findById(data.id);
    if (!bill) throw new Error("Purchase bill not found");

    // Remove any supplier payments directly generated from this bill entry
    await SupplierPaymentModel.deleteMany({
      "allocations.purchaseBillId": data.id,
      source: "BILL_ENTRY",
    });

    // Remove allocation reference from any other payments
    await SupplierPaymentModel.updateMany(
      { "allocations.purchaseBillId": data.id },
      { $pull: { allocations: { purchaseBillId: data.id } } }
    );

    // Delete the purchase bill document
    await PurchaseBillModel.findByIdAndDelete(data.id);

    return { ok: true };
  });
