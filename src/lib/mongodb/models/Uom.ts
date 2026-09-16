/**
 * Uom — unit of measure master, plus per-item conversions.
 *
 * A conversion is item-scoped on purpose: one STRIP is 10 TAB for one brand and
 * 15 TAB for another, so a global factor would be wrong.
 */

import mongoose, { Schema, type Document } from "mongoose";

export interface IUom extends Document {
  code: string;
  name: string;
  /** Decimal places allowed when entering a quantity in this unit. */
  decimals: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UomSchema = new Schema<IUom>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    decimals: { type: Number, default: 0, min: 0, max: 3 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "uoms" },
);

export const UomModel =
  (mongoose.models["Uom"] as mongoose.Model<IUom>) ?? mongoose.model<IUom>("Uom", UomSchema);

export interface IUomConversion extends Document {
  itemCode: string;
  fromUom: string;
  toUom: string;
  /** 1 fromUom = `factor` toUom. */
  factor: number;
  createdAt: Date;
  updatedAt: Date;
}

const UomConversionSchema = new Schema<IUomConversion>(
  {
    itemCode: { type: String, required: true, index: true },
    fromUom: { type: String, required: true, uppercase: true },
    toUom: { type: String, required: true, uppercase: true },
    factor: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: "uom_conversions" },
);

UomConversionSchema.index({ itemCode: 1, fromUom: 1, toUom: 1 }, { unique: true });

export const UomConversionModel =
  (mongoose.models["UomConversion"] as mongoose.Model<IUomConversion>) ??
  mongoose.model<IUomConversion>("UomConversion", UomConversionSchema);

/** Convert a quantity between two units for one item. Returns null if no rule exists. */
export async function convertQty(
  itemCode: string,
  qty: number,
  fromUom: string,
  toUom: string,
): Promise<number | null> {
  const from = fromUom.toUpperCase();
  const to = toUom.toUpperCase();
  if (from === to) return qty;

  const direct = await UomConversionModel.findOne({ itemCode, fromUom: from, toUom: to }).lean();
  if (direct) return qty * direct.factor;

  const inverse = await UomConversionModel.findOne({ itemCode, fromUom: to, toUom: from }).lean();
  if (inverse && inverse.factor !== 0) return qty / inverse.factor;

  return null;
}
