import mongoose, { Schema, Document } from "mongoose";

export interface IFollowUp extends Document {
  followUpId: string;
  patientId: string;
  visitId?: string;
  type: string;
  source: "manual" | "quick-date";
  computedDate: string;
  appointmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    followUpId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    visitId: { type: String },
    type: { type: String, required: true },
    source: { type: String, enum: ["manual", "quick-date"], default: "manual" },
    computedDate: { type: String, required: true },
    appointmentId: { type: String },
  },
  { timestamps: true }
);

export const FollowUp = (mongoose.models["FollowUp"] || mongoose.model<IFollowUp>("FollowUp", FollowUpSchema)) as mongoose.Model<IFollowUp>;
