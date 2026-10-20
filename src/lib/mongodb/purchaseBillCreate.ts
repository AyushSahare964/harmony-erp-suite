import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb/client";
import { PurchaseBillModel } from "@/lib/mongodb/models/PurchaseBill";
import { SupplierModel } from "@/lib/mongodb/models/Supplier";
import { SupplierPaymentModel } from "@/lib/mongodb/models/SupplierPayment";
import { fiscalYearRange } from "@/lib/utils/dateUtils";
import { nextSeq } from "@/lib/mongodb/serverFns/counters";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { receiveStockBatch } from "@/lib/mongodb/stockReceipt";
import { convertToBase } from "@/lib/inventory/packagingUtils";
import type { CreateBillInput } from "@/lib/mongodb/serverFns/purchaseBills";

/** "2027-03" -> "2027-03-31" (batches expire at month end); full dates pass through. */
function monthEnd(v: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return v;
  return `${m[1]}-${m[2]}-${String(new Date(Number(m[1]), Number(m[2]), 0).getDate()).padStart(2, "0")}`;
}

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
