import mongoose, { Schema, Document } from "mongoose";

export interface IBloodTest extends Document {
  testId: string;
  patientId: string;
  visitId?: string;
  testType: string;
  orderedDate: string;
  resultDate?: string;
  reportFileUrl?: string;
  status: "Ordered" | "Processing" | "Completed" | "Cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const BloodTestSchema = new Schema<IBloodTest>(
  {
    testId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    visitId: { type: String },
    testType: { type: String, required: true },
    orderedDate: { type: String, required: true },
    resultDate: { type: String },
    reportFileUrl: { type: String },
    status: { type: String, enum: ["Ordered", "Processing", "Completed", "Cancelled"], default: "Ordered" },
  },
  { timestamps: true }
);

export const BloodTest = (mongoose.models["BloodTest"] || mongoose.model<IBloodTest>("BloodTest", BloodTestSchema)) as mongoose.Model<IBloodTest>;
