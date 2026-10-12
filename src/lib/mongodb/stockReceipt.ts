/**
 * Server-only: receive one lot into stock (batch + item balance + ledger row).
 * Shared by addStockFn (manual Add Stock) and createPurchaseBillFn (receive from a bill).
 * Kept out of serverFns/ so it is never bundled into the browser.
 */
import { connectDB } from "@/lib/mongodb/client";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { nextSeq } from "@/lib/mongodb/serverFns/counters";

export interface StockReceiptInput {
  itemId: string;
  itemCode: string;
  itemName: string;
  batchNo: string;
  manufacturingDate: string;
  expiryDate: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderRef: string;
  invoiceBillNo: string;
  receivedDate: string;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason: string;
  purchasePricePerUnit: number;
  landingCost: number;
  gstOnPurchase: number;
  storageLocation: string;
  qualityChecked: boolean;
  qcInspectorName: string;
  remarks: string;
  actor: string;
}

export async function receiveStockBatch(data: StockReceiptInput) {
  await connectDB();

  const batchCode = await nextSeq("stock_batch", "B", 4);
  const landingCostPerUnit = data.acceptedQty > 0 ? data.landingCost / data.acceptedQty : 0;
  const totalValue = data.acceptedQty * (data.purchasePricePerUnit + landingCostPerUnit);

  const batch = await StockBatch.create({
    ...data,
    batchCode,
    qty: data.acceptedQty,
    landingCostPerUnit,
    totalValue,
  });

  // Update lastPurchaseRate and currentStock on the item
  await InventoryItem.findOneAndUpdate(
    { itemCode: data.itemCode },
    { lastPurchaseRate: data.purchasePricePerUnit, $inc: { currentStock: data.acceptedQty } }
  );

  // Record ledger entry in ErpRow
  await ErpRow.create({
    moduleId: "inventory_ledger",
    data: {
      id: await nextSeq("ledger_entry", "L", 4),
      medicineId: data.itemCode,
      medicineName: data.itemName,
      batchId: batch.batchCode,
      batchNo: data.batchNo,
      movementType: "purchase_in",
      quantity: data.acceptedQty,
      sourceType: "purchase",
      sourceRef: data.purchaseOrderRef || `GRN-${Date.now()}`,
      balanceAfter: data.acceptedQty,
      actorName: data.actor,
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    },
  });

  return batch;
}
