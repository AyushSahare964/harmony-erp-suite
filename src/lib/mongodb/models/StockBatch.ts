/**
 * StockBatch — extended Goods Receipt Note (GRN) batch record.
 * Each batch represents one physical lot received from a supplier.
 * Running stock qty is maintained here; ledger tracks all movements.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

export type BatchStatus = "Active" | "Exhausted" | "Rejected" | "Expired";

export interface IStockBatch {
  // ── References ────────────────────────────────────────────────────────────
  batchCode: string;         // auto: B-0001
  itemId: string;            // InventoryItem._id
  itemCode: string;          // denormalized for display
  itemName: string;          // denormalized for display

  // ── Batch Identity ────────────────────────────────────────────────────────
  batchNo: string;           // lot/batch number from manufacturer
  manufacturingDate: string; // ISO date YYYY-MM-DD
  expiryDate: string;        // ISO date YYYY-MM-DD

  // ── Receipt Info ──────────────────────────────────────────────────────────
  supplierId: string;
  supplierName: string;
  purchaseOrderRef: string;  // PO reference
  invoiceBillNo: string;     // supplier invoice
  receivedDate: string;      // ISO date

  // ── Quantities ────────────────────────────────────────────────────────────
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason: string;
  qty: number;               // running balance = acceptedQty minus sales/adjustments

  // ── Pricing ───────────────────────────────────────────────────────────────
  purchasePricePerUnit: number;
  landingCost: number;       // total freight/landing for this batch
  landingCostPerUnit: number;// = landingCost / acceptedQty
  gstOnPurchase: number;     // % applied on purchase
  totalValue: number;        // = acceptedQty × (purchasePricePerUnit + landingCostPerUnit)

  // ── Storage & QC ─────────────────────────────────────────────────────────
  storageLocation: string;
  qualityChecked: boolean;
  qcInspectorName: string;
  remarks: string;

  // ── Meta ──────────────────────────────────────────────────────────────────
  status: BatchStatus;
  tenantId?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type StockBatchDocument = IStockBatch & mongoose.Document;

const stockBatchSchema = new Schema<StockBatchDocument>(
  {
    batchCode:    { type: String, required: true, unique: true, index: true },
    itemId:       { type: String, required: true, index: true },
    itemCode:     { type: String, required: true },
    itemName:     { type: String, required: true },

    batchNo:          { type: String, required: true },
    manufacturingDate:{ type: String, default: "" },
    expiryDate:       { type: String, required: true },

    supplierId:      { type: String, default: "" },
    supplierName:    { type: String, default: "" },
    purchaseOrderRef:{ type: String, default: "" },
    invoiceBillNo:   { type: String, default: "" },
    receivedDate:    { type: String, required: true },

    receivedQty: { type: Number, required: true, min: 0 },
    acceptedQty: { type: Number, required: true, min: 0 },
    rejectedQty: { type: Number, default: 0, min: 0 },
    rejectionReason: { type: String, default: "" },
    qty:         { type: Number, required: true, min: 0 }, // running balance

    purchasePricePerUnit: { type: Number, required: true, min: 0 },
    landingCost:          { type: Number, default: 0, min: 0 },
    landingCostPerUnit:   { type: Number, default: 0 },
    gstOnPurchase:        { type: Number, default: 0 },
    totalValue:           { type: Number, default: 0 },

    storageLocation: { type: String, default: "" },
    qualityChecked:  { type: Boolean, default: false },
    qcInspectorName: { type: String, default: "" },
    remarks:         { type: String, default: "" },

    status:    { type: String, enum: ["Active", "Exhausted", "Rejected", "Expired"], default: "Active", index: true },
    tenantId:  { type: String, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "stock_batches" }
);

stockBatchSchema.index({ itemId: 1, expiryDate: 1 }); // for FEFO
stockBatchSchema.index({ itemId: 1, status: 1, qty: -1 });

export const StockBatch: mongoose.Model<StockBatchDocument> =
  (mongoose.models["StockBatch"] as mongoose.Model<StockBatchDocument>) ??
  model<StockBatchDocument>("StockBatch", stockBatchSchema);
