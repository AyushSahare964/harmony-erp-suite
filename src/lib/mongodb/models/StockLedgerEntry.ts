/**
 * StockLedgerEntry — one row per physical stock movement.
 *
 * Replaces the loose `erp_rows{moduleId:"inventory_ledger"}` documents with a
 * real collection, so closing stock can be proved against `StockBatch.qty` by
 * the nightly reconciliation.
 *
 * Valuation rule: purchases are written at LANDED cost (rate plus apportioned
 * freight), not at the supplier's invoice rate — otherwise every margin report
 * is wrong by the freight.
 */

import mongoose, { Schema, type Document } from "mongoose";

export type StockSourceKind =
  | "OPENING"
  | "PURCHASE"
  | "SALE"
  | "RETURN_IN"
  | "RETURN_OUT"
  | "ADJUST"
  | "EXPIRY"
  | "CONSUMPTION";

export const STOCK_SOURCE_KINDS: StockSourceKind[] = [
  "OPENING",
  "PURCHASE",
  "SALE",
  "RETURN_IN",
  "RETURN_OUT",
  "ADJUST",
  "EXPIRY",
  "CONSUMPTION",
];

export interface IStockLedgerEntry extends Document {
  itemId?: string;
  itemCode: string;
  itemName: string;
  batchId?: string;
  batchNo?: string;
  entryDate: string;
  sourceKind: StockSourceKind;
  sourceId?: string;
  sourceNumber?: string;
  qtyIn: number;
  qtyOut: number;
  /** Per-unit valuation rate for this movement. */
  rate: number;
  /** rate × (qtyIn − qtyOut). */
  value: number;
  /** Running item balance immediately after this movement. */
  balanceAfter: number;
  narration?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockLedgerEntrySchema = new Schema<IStockLedgerEntry>(
  {
    itemId: { type: String, default: "" },
    itemCode: { type: String, required: true, index: true },
    itemName: { type: String, default: "" },
    batchId: { type: String, default: "", index: true },
    batchNo: { type: String, default: "" },
    entryDate: { type: String, required: true, index: true },
    sourceKind: { type: String, required: true, enum: STOCK_SOURCE_KINDS },
    sourceId: { type: String, default: "" },
    sourceNumber: { type: String, default: "", index: true },
    qtyIn: { type: Number, default: 0 },
    qtyOut: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    narration: { type: String, default: "" },
  },
  { timestamps: true, collection: "stock_ledger" },
);

StockLedgerEntrySchema.index({ itemCode: 1, entryDate: 1, _id: 1 });

export const StockLedgerEntryModel =
  (mongoose.models["StockLedgerEntry"] as mongoose.Model<IStockLedgerEntry>) ??
  mongoose.model<IStockLedgerEntry>("StockLedgerEntry", StockLedgerEntrySchema);

/** Net quantity on hand for an item, computed from movements alone. */
export async function computeItemQty(itemCode: string): Promise<number> {
  const [agg] = await StockLedgerEntryModel.aggregate<{ inQty: number; outQty: number }>([
    { $match: { itemCode } },
    { $group: { _id: null, inQty: { $sum: "$qtyIn" }, outQty: { $sum: "$qtyOut" } } },
  ]);
  return (agg?.inQty ?? 0) - (agg?.outQty ?? 0);
}

/** Net quantity per batch — what the reconciliation compares to StockBatch.qty. */
export async function computeBatchQtys(): Promise<Map<string, number>> {
  const rows = await StockLedgerEntryModel.aggregate<{
    _id: string;
    inQty: number;
    outQty: number;
  }>([
    { $match: { batchId: { $ne: "" } } },
    { $group: { _id: "$batchId", inQty: { $sum: "$qtyIn" }, outQty: { $sum: "$qtyOut" } } },
  ]);
  return new Map(rows.map((r) => [r._id, (r.inQty ?? 0) - (r.outQty ?? 0)]));
}
