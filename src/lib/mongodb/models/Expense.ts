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
  /** Link to the unified Party record when the payee is a registered supplier. */
  partyId?: string;
  billRefNo?: string;
  totalAmount: number;
  /** Value net of GST — populated when itcClaimed so the ITC register reconciles. */
  taxableValue?: number;
  gstAmount?: number;
  vendorGstin?: string;
  /** Whether input tax credit is being claimed on this expense. */
  itcClaimed?: boolean;
  paidByStaffId?: string;
  paidByStaffName?: string;
  description?: string;
  attachmentUrl?: string;
  paymentLines: IPaymentLine[];
  status: "ACTIVE" | "VOID";
  voidReason?: string;
  /** True for a generated template row rather than a real spend. */
  isRecurringTemplate?: boolean;
  recurEvery?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  /** Next date the template should be instantiated. */
  recurNextDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentLineSchema = new Schema<IPaymentLine>(
  {
    mode: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"],
      required: true,
    },
    accountId: String,
    accountName: String,
    amount: { type: Number, required: true },
    referenceNo: String,
    chequeDate: String,
  },
  { _id: false },
);

const ExpenseSchema = new Schema<IExpense>(
  {
    voucherNo: { type: String, required: true, unique: true },
    expenseDate: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    categoryName: { type: String, required: true },
    categoryNature: { type: String, enum: ["BUSINESS", "PERSONAL"], default: "BUSINESS" },
    paidTo: String,
    partyId: { type: String, default: "", index: true },
    billRefNo: String,
    totalAmount: { type: Number, required: true },
    taxableValue: Number,
    gstAmount: Number,
    vendorGstin: String,
    itcClaimed: { type: Boolean, default: false },
    paidByStaffId: { type: String, default: "" },
    paidByStaffName: { type: String, default: "" },
    description: String,
    attachmentUrl: String,
    paymentLines: { type: [PaymentLineSchema], default: [] },
    status: { type: String, enum: ["ACTIVE", "VOID"], default: "ACTIVE" },
    voidReason: String,
    isRecurringTemplate: { type: Boolean, default: false },
    recurEvery: { type: String, enum: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] },
    recurNextDate: { type: String, default: "" },
  },
  { timestamps: true },
);

ExpenseSchema.index({ expenseDate: 1 });
ExpenseSchema.index({ categoryId: 1 });
ExpenseSchema.index({ status: 1 });
ExpenseSchema.index({ isRecurringTemplate: 1, recurNextDate: 1 });

export const ExpenseModel =
  (mongoose.models["Expense"] as mongoose.Model<IExpense>) ??
  mongoose.model<IExpense>("Expense", ExpenseSchema);
