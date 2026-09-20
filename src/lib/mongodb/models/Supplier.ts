import mongoose, { Schema, type Document } from "mongoose";

export interface ISupplier extends Document {
  name: string;
  contactPerson?: string;
  phone?: string;
  mobileNo?: string;
  email?: string;
  gstin?: string;
  panNo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  bankName?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  remarks?: string;
  creditDays: number;
  openingBalance: number;
  openingBalanceType: "Cr" | "Dr" | "Debit" | "Credit";
  openingBalanceDate?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    mobileNo: { type: String, default: "" },
    email: { type: String, default: "" },
    gstin: { type: String, default: "" },
    panNo: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "Maharashtra" },
    pincode: { type: String, default: "" },
    country: { type: String, default: "India" },
    bankName: { type: String, default: "" },
    bankAccountNo: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    remarks: { type: String, default: "" },
    creditDays: { type: Number, default: 30 },
    openingBalance: { type: Number, default: 0 },
    openingBalanceType: { type: String, default: "Debit" },
    openingBalanceDate: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SupplierSchema.index({ name: 1 });
SupplierSchema.index({ isActive: 1 });

export const SupplierModel =
  (mongoose.models["Supplier"] as mongoose.Model<ISupplier>) ??
  mongoose.model<ISupplier>("Supplier", SupplierSchema);

const SEED_SUPPLIERS: any[] = [];

export async function seedSuppliers(): Promise<void> {
  // Auto-seeding disabled to preserve clean database state
}
