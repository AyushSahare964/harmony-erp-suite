import mongoose, { Schema, Document } from "mongoose";

export interface IVaccination extends Document {
  vaccinationId: string;
  patientId: string;
  visitId?: string;
  vaccineType: "All-in-1" | "Anti-rabies" | "Kennel Cough" | string;
  dateGiven: string;
  nextDueDate: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VaccinationSchema = new Schema<IVaccination>(
  {
    vaccinationId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    visitId: { type: String },
    vaccineType: { type: String, required: true },
    dateGiven: { type: String, required: true },
    nextDueDate: { type: String, required: true },
    createdBy: { type: String },
  },
  { timestamps: true }
);

export const Vaccination = (mongoose.models["Vaccination"] || mongoose.model<IVaccination>("Vaccination", VaccinationSchema)) as mongoose.Model<IVaccination>;
