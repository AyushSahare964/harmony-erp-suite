import mongoose, { Schema, Document } from "mongoose";

export interface IOwner extends Document {
  ownerId: string;
  name: string;
  phone: string;
  altPhone?: string | undefined;
  email?: string | undefined;
  gender?: "Male" | "Female" | "Other" | undefined;
  dob?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  idProofType?: "Aadhaar" | "PAN" | "Driving License" | "Passport" | "Other" | undefined;
  idProofNo?: string | undefined;
  preferredPaymentMode?: "UPI" | "Cash" | "Card" | "Credit" | undefined;
  referredBy?: string | undefined;
  notes?: string | undefined;
  outstandingBalance: number;
  status?: "Active" | "Inactive" | undefined;

  /** Link to the unified Party record — written by migration 02, kept in
   *  step by savePartyFn. The Party record, not this one, is the source of
   *  truth for billing fields; these mirror the common ones for quick reads
   *  in CRM screens that never touch the finance module. */
  partyId?: string | undefined;
  gstin?: string | undefined;
  pan?: string | undefined;
  /** Two-digit GST state code, e.g. "27" for Maharashtra. */
  stateCode?: string | undefined;
  billingAddress?: string | undefined;
  pin?: string | undefined;
  creditAllowed?: boolean | undefined;
  creditLimit?: number | undefined;
  openingBalance?: number | undefined;
  openingType?: "DR" | "CR" | undefined;
  anniversary?: string | undefined;

  createdAt: Date;
  updatedAt: Date;
}

const OwnerSchema = new Schema<IOwner>(
  {
    ownerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    altPhone: { type: String },
    email: { type: String },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    dob: { type: String },
    address: { type: String },
    city: { type: String, default: "Nagpur" },
    idProofType: { type: String, enum: ["Aadhaar", "PAN", "Driving License", "Passport", "Other"] },
    idProofNo: { type: String },
    preferredPaymentMode: { type: String, enum: ["UPI", "Cash", "Card", "Credit"], default: "UPI" },
    referredBy: { type: String },
    notes: { type: String },
    outstandingBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },

    partyId: { type: String, default: "", index: true },
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    stateCode: { type: String, default: "27" },
    billingAddress: { type: String, default: "" },
    pin: { type: String, default: "" },
    creditAllowed: { type: Boolean, default: false },
    creditLimit: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    openingType: { type: String, enum: ["DR", "CR"], default: "DR" },
    anniversary: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Owner = (mongoose.models["Owner"] ||
  mongoose.model<IOwner>("Owner", OwnerSchema)) as mongoose.Model<IOwner>;
