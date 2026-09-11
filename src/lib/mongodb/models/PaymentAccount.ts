import mongoose, { Schema, type Document } from "mongoose";

export interface IPaymentAccount extends Document {
  name: string;
  type: "CASH" | "BANK";
  glAccountCode?: string;
  isDefault: boolean;
  isActive: boolean;
}

const PaymentAccountSchema = new Schema<IPaymentAccount>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["CASH", "BANK"], required: true },
    glAccountCode: { type: String },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const SEED_ACCOUNTS = [
  { name: "Cash in Hand", type: "CASH", isDefault: false, isActive: true },
  { name: "HDFC Current A/c", type: "BANK", isDefault: true, isActive: true },
];

export async function seedPaymentAccounts() {
  const count = await PaymentAccountModel.countDocuments();
  if (count === 0) {
    await PaymentAccountModel.insertMany(SEED_ACCOUNTS);
  }
}

export const PaymentAccountModel =
  (mongoose.models["PaymentAccount"] as mongoose.Model<IPaymentAccount>) ??
  mongoose.model<IPaymentAccount>("PaymentAccount", PaymentAccountSchema);
