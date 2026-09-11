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
}

export interface IPurchaseBill extends Document {
  internalRef: string;
  supplierId: string;
  supplierName: string;
  billNumber: string;
  billDate: string; // ISO YYYY-MM-DD
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
  items: IPurchaseBillItem[];
  createdAt: Date;
  updatedAt: Date;
}

const BillItemSchema = new Schema<IPurchaseBillItem>({
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
}, { _id: false });

const PurchaseBillSchema = new Schema<IPurchaseBill>(
  {
    internalRef: { type: String, required: true, unique: true },
    supplierId: { type: String, required: true },
    supplierName: { type: String, required: true },
    billNumber: { type: String, required: true },
    billDate: { type: String, required: true },
    dueDate: String,
    taxType: { type: String, enum: ["INTRA", "INTER"], default: "INTRA" },
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    status: { type: String, enum: ["UNPAID", "PARTIAL", "PAID", "VOID"], default: "UNPAID" },
    remarks: String,
    attachmentUrl: String,
    voidReason: String,
    items: { type: [BillItemSchema], default: [] },
  },
  { timestamps: true }
);

PurchaseBillSchema.index({ billDate: 1 });
PurchaseBillSchema.index({ supplierId: 1, status: 1 });
PurchaseBillSchema.index({ status: 1 });

export const PurchaseBillModel =
  (mongoose.models["PurchaseBill"] as mongoose.Model<IPurchaseBill>) ??
  mongoose.model<IPurchaseBill>("PurchaseBill", PurchaseBillSchema);
