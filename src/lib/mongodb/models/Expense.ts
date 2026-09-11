import mongoose, { Schema, type Document } from "mongoose";

export interface IPaymentLine {
  mode: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CHEQUE";
  accountId: string;
  accountName: string;
  amount: number;
  referenceNo?: string;
  chequeDate?: string;
}

export interface IExpense extends Document {
  voucherNo: string;
  expenseDate: string; // ISO YYYY-MM-DD
  categoryId: mongoose.Types.ObjectId;
  categoryName: string;
  categoryNature: "BUSINESS" | "PERSONAL";
  paidTo?: string;
  billRefNo?: string;
  totalAmount: number;
  gstAmount?: number;
  vendorGstin?: string;
  description?: string;
  attachmentUrl?: string;
  paymentLines: IPaymentLine[];
  status: "ACTIVE" | "VOID";
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentLineSchema = new Schema<IPaymentLine>({
  mode: { type: String, enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"], required: true },
  accountId: String,
  accountName: String,
  amount: { type: Number, required: true },
  referenceNo: String,
  chequeDate: String,
}, { _id: false });

const ExpenseSchema = new Schema<IExpense>(
  {
    voucherNo: { type: String, required: true, unique: true },
    expenseDate: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    categoryName: { type: String, required: true },
    categoryNature: { type: String, enum: ["BUSINESS", "PERSONAL"], default: "BUSINESS" },
    paidTo: String,
    billRefNo: String,
    totalAmount: { type: Number, required: true },
    gstAmount: Number,
    vendorGstin: String,
    description: String,
    attachmentUrl: String,
    paymentLines: { type: [PaymentLineSchema], default: [] },
    status: { type: String, enum: ["ACTIVE", "VOID"], default: "ACTIVE" },
    voidReason: String,
  },
  { timestamps: true }
);

ExpenseSchema.index({ expenseDate: 1 });
ExpenseSchema.index({ "categoryId": 1 });
ExpenseSchema.index({ status: 1 });

export const ExpenseModel =
  (mongoose.models["Expense"] as mongoose.Model<IExpense>) ??
  mongoose.model<IExpense>("Expense", ExpenseSchema);
