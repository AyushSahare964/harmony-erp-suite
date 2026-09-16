/**
 * FinDailySummary — materialised daily totals.
 *
 * The dashboard reads ONLY this. Scanning raw invoice lines for a KPI strip is
 * what makes a billing screen feel slow once a clinic has a year of history.
 * Refreshed on every post / cancel / payment, and rebuildable from scratch by
 * migration 07.
 */

import mongoose, { Schema, type Document } from "mongoose";

export interface IFinDailySummary extends Document {
  branchId: string;
  date: string;
  saleTaxable: number;
  saleTax: number;
  saleTotal: number;
  creditNoteTotal: number;
  received: number;
  paidOut: number;
  purchaseTotal: number;
  expenseTotal: number;
  cashIn: number;
  cashOut: number;
  invoiceCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const FinDailySummarySchema = new Schema<IFinDailySummary>(
  {
    branchId: { type: String, required: true, default: "MAIN" },
    date: { type: String, required: true },
    saleTaxable: { type: Number, default: 0 },
    saleTax: { type: Number, default: 0 },
    saleTotal: { type: Number, default: 0 },
    creditNoteTotal: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
    paidOut: { type: Number, default: 0 },
    purchaseTotal: { type: Number, default: 0 },
    expenseTotal: { type: Number, default: 0 },
    cashIn: { type: Number, default: 0 },
    cashOut: { type: Number, default: 0 },
    invoiceCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "fin_daily_summary" },
);

FinDailySummarySchema.index({ branchId: 1, date: 1 }, { unique: true });

export const FinDailySummaryModel =
  (mongoose.models["FinDailySummary"] as mongoose.Model<IFinDailySummary>) ??
  mongoose.model<IFinDailySummary>("FinDailySummary", FinDailySummarySchema);
