/**
 * Party — one collection for clients (pet owners) and suppliers.
 *
 * Owner and Supplier stay where they are for CRM and procurement; each gains a
 * `partyId` pointing here. Billing fields (GSTIN, credit limit, opening
 * balance, billing address) live ONLY on this record, so there is exactly one
 * ledger and one outstanding figure per counterparty.
 */

import mongoose, { type Document } from "mongoose";

const Schema = mongoose.Schema;

export type PartyType = "CLIENT" | "SUPPLIER" | "BOTH";
export type OpeningType = "DR" | "CR";
export type GstTreatment = "REGULAR" | "COMPOSITION" | "UNREGISTERED" | "SEZ" | "EXPORT";

export interface IParty extends Document {
  partyId: string;
  partyType: PartyType;
  /** Link to the existing CRM owner record. */
  ownerId?: string;
  /** Link to the existing Supplier record (its _id as a string). */
  supplierRefId?: string;

  displayName: string;
  legalName?: string;
  contactPerson?: string;

  mobile: string;
  phone?: string;
  email?: string;

  billingAddress?: string;
  city?: string;
  stateCode: string;
  pin?: string;
  country: string;

  gstin?: string;
  pan?: string;
  gstTreatment: GstTreatment;

  /** KYC — Aadhaar / Driving Licence / Passport / PAN. */
  docType?: string;
  docNumber?: string;

  openingBalance: number;
  openingType: OpeningType;
  openingDate?: string;

  creditAllowed: boolean;
  creditLimit: number;
  creditDays: number;

  dateOfBirth?: string;
  anniversary?: string;

  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;

  photoPath?: string;
  remark?: string;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const PartySchema = new Schema<IParty>(
  {
    partyId: { type: String, required: true, unique: true, index: true },
    partyType: {
      type: String,
      required: true,
      enum: ["CLIENT", "SUPPLIER", "BOTH"],
      index: true,
    },
    ownerId: { type: String, default: "", index: true },
    supplierRefId: { type: String, default: "", index: true },

    displayName: { type: String, required: true, trim: true, index: true },
    legalName: { type: String, default: "" },
    contactPerson: { type: String, default: "" },

    mobile: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },

    billingAddress: { type: String, default: "" },
    city: { type: String, default: "" },
    stateCode: { type: String, default: "27" },
    pin: { type: String, default: "" },
    country: { type: String, default: "India" },

    gstin: { type: String, default: "", uppercase: true, trim: true, index: true },
    pan: { type: String, default: "", uppercase: true, trim: true },
    gstTreatment: {
      type: String,
      enum: ["REGULAR", "COMPOSITION", "UNREGISTERED", "SEZ", "EXPORT"],
      default: "UNREGISTERED",
    },

    docType: { type: String, default: "" },
    docNumber: { type: String, default: "" },

    openingBalance: { type: Number, default: 0 },
    openingType: { type: String, enum: ["DR", "CR"], default: "DR" },
    openingDate: { type: String, default: "" },

    creditAllowed: { type: Boolean, default: false },
    creditLimit: { type: Number, default: 0 },
    creditDays: { type: Number, default: 0 },

    dateOfBirth: { type: String, default: "" },
    anniversary: { type: String, default: "" },

    bankName: { type: String, default: "" },
    bankAccount: { type: String, default: "" },
    bankIfsc: { type: String, default: "" },

    photoPath: { type: String, default: "" },
    remark: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "parties" },
);

PartySchema.index({ partyType: 1, isActive: 1 });
PartySchema.index({ displayName: "text", mobile: "text" });

export const PartyModel =
  (mongoose.models["Party"] as mongoose.Model<IParty>) ??
  mongoose.model<IParty>("Party", PartySchema);

/** Does this party act as a client? (BOTH counts.) */
export function isClient(p: Pick<IParty, "partyType">): boolean {
  return p.partyType === "CLIENT" || p.partyType === "BOTH";
}

/** Does this party act as a supplier? (BOTH counts.) */
export function isSupplier(p: Pick<IParty, "partyType">): boolean {
  return p.partyType === "SUPPLIER" || p.partyType === "BOTH";
}
