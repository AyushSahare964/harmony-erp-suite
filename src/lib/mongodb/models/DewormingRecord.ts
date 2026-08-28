import mongoose, { Schema, Document } from "mongoose";

export interface IDewormingRecord extends Document {
  recordId: string;
  patientId: string;
  visitId?: string;
  dateGiven: string;
  nextDueDate: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DewormingRecordSchema = new Schema<IDewormingRecord>(
  {
    recordId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    visitId: { type: String },
    dateGiven: { type: String, required: true },
    nextDueDate: { type: String, required: true },
    source: { type: String },
  },
  { timestamps: true }
);

export const DewormingRecord = (mongoose.models["DewormingRecord"] || mongoose.model<IDewormingRecord>("DewormingRecord", DewormingRecordSchema)) as mongoose.Model<IDewormingRecord>;
