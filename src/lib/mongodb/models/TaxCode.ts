/**
 * TaxCode — HSN (goods) and SAC (services) master with rate history.
 *
 * Rates are NEVER overwritten. When a slab changes, close the current row by
 * setting `effectiveTo` and insert a new one. Re-printing a two-year-old bill
 * must reproduce the rate that applied on its own document date.
 */

import mongoose, { Schema, type Document } from "mongoose";

export type TaxCodeKind = "HSN" | "SAC";

export interface ITaxCode extends Document {
  code: string;
  kind: TaxCodeKind;
  description: string;
  /** Total GST %, split 50/50 into CGST+SGST for intra-state supply. */
  gstRate: number;
  cessRate: number;
  /** ISO YYYY-MM-DD. */
  effectiveFrom: string;
  /** ISO YYYY-MM-DD, or null while this is the current rate. */
  effectiveTo?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaxCodeSchema = new Schema<ITaxCode>(
  {
    code: { type: String, required: true, trim: true, index: true },
    kind: { type: String, required: true, enum: ["HSN", "SAC"], index: true },
    description: { type: String, default: "" },
    gstRate: { type: Number, required: true, min: 0, max: 100 },
    cessRate: { type: Number, default: 0, min: 0, max: 100 },
    effectiveFrom: { type: String, required: true },
    effectiveTo: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "tax_codes" },
);

// One row per code per effective-from date — that IS the rate history.
TaxCodeSchema.index({ code: 1, effectiveFrom: 1 }, { unique: true });

export const TaxCodeModel =
  (mongoose.models["TaxCode"] as mongoose.Model<ITaxCode>) ??
  mongoose.model<ITaxCode>("TaxCode", TaxCodeSchema);

/**
 * The rate in force for a code on a given date.
 * Returns undefined when the code is unknown — callers must decide whether
 * that is a validation error or a fall-back to the item's own gstRate.
 */
export async function resolveTaxRate(
  code: string,
  onIsoDate: string,
): Promise<{ gstRate: number; cessRate: number } | undefined> {
  const row = await TaxCodeModel.findOne({
    code,
    effectiveFrom: { $lte: onIsoDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: onIsoDate } }],
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  if (!row) return undefined;
  return { gstRate: row.gstRate, cessRate: row.cessRate ?? 0 };
}
