/**
 * OrgBranch — the billing entity. Its `stateCode` is what every document's
 * place of supply is compared against to decide CGST+SGST vs IGST, so this
 * record is a hard dependency of the tax engine.
 */

import mongoose, { Schema, type Document } from "mongoose";

export interface IOrgBranch extends Document {
  code: string;
  name: string;
  legalName?: string;
  gstin?: string;
  pan?: string;
  /** Two-digit GST state code — "27" for Maharashtra. Drives intra vs inter. */
  stateCode: string;
  address?: string;
  city?: string;
  pin?: string;
  phone?: string;
  email?: string;
  /** Printed at the foot of every invoice. */
  invoiceFooter?: string;
  /** Composition dealers issue a Bill of Supply and charge no GST. */
  isComposition: boolean;
  /** Export under a Letter of Undertaking is zero-rated. */
  lutEnabled: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrgBranchSchema = new Schema<IOrgBranch>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String, default: "" },
    gstin: { type: String, default: "", uppercase: true, trim: true },
    pan: { type: String, default: "", uppercase: true, trim: true },
    stateCode: { type: String, required: true, default: "27" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    pin: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    invoiceFooter: { type: String, default: "" },
    isComposition: { type: Boolean, default: false },
    lutEnabled: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "org_branches" },
);

export const OrgBranchModel =
  (mongoose.models["OrgBranch"] as mongoose.Model<IOrgBranch>) ??
  mongoose.model<IOrgBranch>("OrgBranch", OrgBranchSchema);

export const DEFAULT_BRANCH_CODE = "MAIN";

/**
 * The branch every document defaults to.
 * Falls back to a synthetic Maharashtra branch so the tax engine can still run
 * on a database where masters were never seeded.
 */
export async function getDefaultBranch(): Promise<
  Pick<IOrgBranch, "code" | "name" | "stateCode" | "gstin" | "isComposition" | "lutEnabled">
> {
  const found =
    (await OrgBranchModel.findOne({ isDefault: true }).lean()) ??
    (await OrgBranchModel.findOne({ code: DEFAULT_BRANCH_CODE }).lean()) ??
    (await OrgBranchModel.findOne({ isActive: true }).lean());

  if (found) {
    return {
      code: found.code,
      name: found.name,
      stateCode: found.stateCode,
      gstin: found.gstin ?? "",
      isComposition: found.isComposition ?? false,
      lutEnabled: found.lutEnabled ?? false,
    };
  }

  return {
    code: DEFAULT_BRANCH_CODE,
    name: "Real Care Small Animal Clinic",
    stateCode: "27",
    gstin: "",
    isComposition: false,
    lutEnabled: false,
  };
}
