import mongoose, { Schema, type Document } from "mongoose";

export interface IPurchaseBillItem {
  lineNo: number;
  itemType: "INVENTORY" | "NON_INVENTORY";
  inventoryItemId?: string;
  expenseCategoryId?: string;
  description: string;
  hsnCode?: string;
  batchNo?: string;
  expiryDate?: string; // YYYY-MM (stored as last day of month internally)
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
  /** rate + this line's apportioned share of shipping — what stock_ledger values the receipt at. */
  landedCost?: number;
}

export interface IPurchaseBill extends Document {
  /** PURCHASE (default) | DEBIT_NOTE — a return against an earlier purchase. */
  docType?: "PURCHASE" | "DEBIT_NOTE";
  internalRef: string;
  supplierId: string;
  supplierName: string;
  /** Link to the unified Party record for the ledger and outstanding reports. */
  partyId?: string;
  billNumber: string;
  billDate: string; // ISO YYYY-MM-DD
  dueDate?: string;
  /** Supplier's own P.O. reference. */
  poNumber?: string;
  /** The date printed on the supplier's own bill — may differ from entry date. */
  supplierBillDate?: string;
  /** Two-digit GST state code the goods are deemed supplied to. */
  placeOfSupply?: string;
  taxType: "INTRA" | "INTER";
  /** Whether input tax credit can be claimed on this bill. */
  itcEligible?: boolean;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  otherCharges: number;
  /** Freight/handling added to the bill, apportioned into each line's landedCost. */
  shippingAmount?: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "VOID";
  /** For a DEBIT_NOTE: the purchase it reverses. */
  againstBillId?: string;
  remarks?: string;
  attachmentUrl?: string;
  voidReason?: string;
  items: IPurchaseBillItem[];
  createdAt: Date;
  updatedAt: Date;
}

const BillItemSchema = new Schema<IPurchaseBillItem>(
  {
    lineNo: Number,
    itemType: { type: String, enum: ["INVENTORY", "NON_INVENTORY"], default: "INVENTORY" },
    inventoryItemId: String,
    expenseCategoryId: String,
    description: { type: String, required: true },
    hsnCode: String,
    batchNo: String,
    expiryDate: String,
    qty: { type: Number, required: true },
    freeQty: { type: Number, default: 0 },
    unit: String,
    purchaseRate: { type: Number, required: true },
    mrp: Number,
    discountPct: { type: Number, default: 0 },
    gstPct: { type: Number, default: 0 },
    taxableAmount: Number,
    taxAmount: Number,
    lineTotal: Number,
    landedCost: Number,
  },
  { _id: false },
);

const PurchaseBillSchema = new Schema<IPurchaseBill>(
  {
    docType: { type: String, enum: ["PURCHASE", "DEBIT_NOTE"], default: "PURCHASE", index: true },
    internalRef: { type: String, required: true, unique: true },
    supplierId: { type: String, required: true },
    supplierName: { type: String, required: true },
    partyId: { type: String, default: "", index: true },
    billNumber: { type: String, required: true },
    billDate: { type: String, required: true },
    dueDate: String,
    poNumber: { type: String, default: "" },
    supplierBillDate: { type: String, default: "" },
    placeOfSupply: { type: String, default: "27" },
    taxType: { type: String, enum: ["INTRA", "INTER"], default: "INTRA" },
    itcEligible: { type: Boolean, default: true },
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    shippingAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    status: { type: String, enum: ["UNPAID", "PARTIAL", "PAID", "VOID"], default: "UNPAID" },
    againstBillId: { type: String, default: "" },
    remarks: String,
    attachmentUrl: String,
    voidReason: String,
    items: { type: [BillItemSchema], default: [] },
  },
  { timestamps: true },
);

PurchaseBillSchema.index({ billDate: 1 });
PurchaseBillSchema.index({ supplierId: 1, status: 1 });
PurchaseBillSchema.index({ status: 1 });
PurchaseBillSchema.index({ partyId: 1, billDate: -1 });
// Duplicate-bill guard (plan §4.5): the same supplier cannot enter the same
// bill number twice within one purchase-doc type. Sparse so historical rows
// created before this index existed, if any lack billNumber, don't collide.
PurchaseBillSchema.index(
  { supplierId: 1, billNumber: 1, docType: 1 },
  { unique: true, partialFilterExpression: { billNumber: { $gt: "" } } },
);

export const PurchaseBillModel =
  (mongoose.models["PurchaseBill"] as mongoose.Model<IPurchaseBill>) ??
  mongoose.model<IPurchaseBill>("PurchaseBill", PurchaseBillSchema);

export const PurchaseBill = PurchaseBillModel;
