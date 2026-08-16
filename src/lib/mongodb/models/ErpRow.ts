/**
 * Generic ERP Row model — stores all module rows in "erp_rows" collection.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

export interface IErpRow {
  moduleId: string;
  tenantId?: string;
  createdBy?: mongoose.Types.ObjectId;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ErpRowDocument = IErpRow & mongoose.Document;

const erpRowSchema = new Schema<ErpRowDocument>(
  {
    moduleId:  { type: String, required: true, index: true },
    tenantId:  { type: String, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    data:      { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "erp_rows" }
);

erpRowSchema.index({ moduleId: 1, createdAt: -1 });

export const ErpRow: mongoose.Model<ErpRowDocument> =
  (mongoose.models["ErpRow"] as mongoose.Model<ErpRowDocument>) ??
  model<ErpRowDocument>("ErpRow", erpRowSchema);
