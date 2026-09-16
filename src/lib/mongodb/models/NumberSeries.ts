/**
 * NumberSeries — gapless, financial-year-aware document numbering.
 *
 * GST requires a consecutive series per financial year. Two rules follow from
 * that, and both are enforced in `allocateDocNumber` rather than by convention:
 *
 *   1. A number is allocated only when a document is POSTED, never for a draft.
 *      Pre-allocating for a draft that is later abandoned leaves a gap, and a
 *      gap is what triggers a GST notice.
 *   2. The FY comes from the document's own date, not from today.
 *
 * Cancelled documents keep their number forever. Numbers are never reused.
 */

import mongoose, { Schema, type Document } from "mongoose";

/** Document families that carry their own series. */
export type SeriesDocType =
  | "INV" // sale invoice
  | "QTN" // quotation
  | "CRN" // credit note (sales return)
  | "PUR" // purchase bill
  | "DBN" // debit note (purchase return)
  | "PIN" // payment in
  | "POUT" // payment out
  | "EXP"; // expense voucher

export const SERIES_DOC_TYPES: SeriesDocType[] = [
  "INV",
  "QTN",
  "CRN",
  "PUR",
  "DBN",
  "PIN",
  "POUT",
  "EXP",
];

export const SERIES_LABELS: Record<SeriesDocType, string> = {
  INV: "Sale Invoice",
  QTN: "Quotation",
  CRN: "Credit Note",
  PUR: "Purchase Bill",
  DBN: "Debit Note",
  PIN: "Payment In",
  POUT: "Payment Out",
  EXP: "Expense Voucher",
};

export interface INumberSeries extends Document {
  branchId: string;
  docType: SeriesDocType;
  /** "2026-27" */
  fyCode: string;
  prefix: string;
  padding: number;
  /**
   * The LAST number handed out — not the next one. Starts at 0, so an atomic
   * `$inc` returning the post-increment value *is* the number just claimed.
   *
   * Storing "next" instead would be ambiguous on the very first call: whether
   * the upsert applies the schema default before or after the `$inc` decides
   * between claiming 1 and claiming 2, and the answer depends on driver
   * behaviour. Starting from 0 removes that question entirely.
   */
  lastNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const NumberSeriesSchema = new Schema<INumberSeries>(
  {
    branchId: { type: String, required: true, default: "MAIN" },
    docType: { type: String, required: true, enum: SERIES_DOC_TYPES },
    fyCode: { type: String, required: true },
    prefix: { type: String, required: true, uppercase: true, trim: true },
    padding: { type: Number, default: 4, min: 1, max: 10 },
    lastNumber: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: "number_series" },
);

NumberSeriesSchema.index({ branchId: 1, docType: 1, fyCode: 1 }, { unique: true });

export const NumberSeriesModel =
  (mongoose.models["NumberSeries"] as mongoose.Model<INumberSeries>) ??
  mongoose.model<INumberSeries>("NumberSeries", NumberSeriesSchema);
