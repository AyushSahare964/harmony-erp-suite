import mongoose, { Schema, type Document } from "mongoose";

export interface ISupplierPaymentLine {
  mode: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CHEQUE";
  accountId: string;
  accountName: string;
  amount: number;
  referenceNo?: string;
  chequeDate?: string;
}

export interface IPaymentAllocation {
  purchaseBillId: string;
  billRef: string;
  amount: number;
  allocatedOn: string; // ISO date
}

export interface ISupplierPayment extends Document {
  voucherNo: string;
  supplierId: string;
  supplierName: string;
  paymentDate: string; // ISO YYYY-MM-DD
  totalAmount: number;
  source: "PAYMENT_OUT" | "BILL_ENTRY";
  allocationMode: "SELECTED" | "OLDEST_FIRST" | "ON_ACCOUNT";
  paymentLines: ISupplierPaymentLine[];
  allocations: IPaymentAllocation[];
  remarks?: string;
  status: "ACTIVE" | "VOID";
  voidReason?: string;
  createdAt: Date;
}

const SupplierPaymentLineSchema = new Schema<ISupplierPaymentLine>({
  mode: { type: String, enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"], required: true },
  accountId: String,
  accountName: String,
  amount: { type: Number, required: true },
  referenceNo: String,
  chequeDate: String,
}, { _id: false });

const AllocationSchema = new Schema<IPaymentAllocation>({
  purchaseBillId: { type: String, required: true },
  billRef: String,
  amount: { type: Number, required: true },
  allocatedOn: { type: String, required: true },
}, { _id: false });

const SupplierPaymentSchema = new Schema<ISupplierPayment>(
  {
    voucherNo: { type: String, required: true, unique: true },
    supplierId: { type: String, required: true },
    supplierName: { type: String, required: true },
    paymentDate: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    source: { type: String, enum: ["PAYMENT_OUT", "BILL_ENTRY"], default: "PAYMENT_OUT" },
    allocationMode: { type: String, enum: ["SELECTED", "OLDEST_FIRST", "ON_ACCOUNT"], default: "SELECTED" },
    paymentLines: { type: [SupplierPaymentLineSchema], default: [] },
    allocations: { type: [AllocationSchema], default: [] },
    remarks: String,
    status: { type: String, enum: ["ACTIVE", "VOID"], default: "ACTIVE" },
    voidReason: String,
  },
  { timestamps: true }
);

SupplierPaymentSchema.index({ paymentDate: 1 });
SupplierPaymentSchema.index({ supplierId: 1 });

export const SupplierPaymentModel =
  (mongoose.models["SupplierPayment"] as mongoose.Model<ISupplierPayment>) ??
  mongoose.model<ISupplierPayment>("SupplierPayment", SupplierPaymentSchema);
