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

const SEED_SUPPLIERS = [
  { name: "Boehringer Ingelheim India Pvt Ltd", contactPerson: "Rajesh Sharma", phone: "9820011223", gstin: "27AAACB1234F1Z1", creditDays: 30, openingBalance: 45000, openingBalanceType: "Cr" },
  { name: "Zoetis India Limited", contactPerson: "Ananya Deshmukh", phone: "9820044556", gstin: "27AAACZ5678G1Z2", creditDays: 45, openingBalance: 120000, openingBalanceType: "Cr" },
  { name: "Virbac Animal Health India", contactPerson: "Kunal Verma", phone: "9830077889", gstin: "27AAACV9012H1Z3", creditDays: 30, openingBalance: 28000, openingBalanceType: "Cr" },
  { name: "Intas Pharmaceuticals Ltd - Vet Division", contactPerson: "Pooja Mehta", phone: "9840033445", gstin: "27AAACI3456J1Z4", creditDays: 30, openingBalance: 65000, openingBalanceType: "Cr" },
  { name: "MSD Animal Health India", contactPerson: "Siddharth Rao", phone: "9810066778", gstin: "27AAACM7890K1Z5", creditDays: 60, openingBalance: 0, openingBalanceType: "Cr" },
  { name: "Himalaya Wellness - Animal Health", contactPerson: "Vikas Patel", phone: "9890088990", gstin: "27AAACH2345L1Z6", creditDays: 15, openingBalance: 15000, openingBalanceType: "Cr" },
];

export async function seedSuppliers(): Promise<void> {
  // Auto-seeding disabled to preserve clean database state
}
