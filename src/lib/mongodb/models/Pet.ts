import mongoose, { Schema, Document } from "mongoose";

export interface IPet extends Document {
  petId: string;
  ownerId: string;
  name: string;
  species: "Canine" | "Feline" | "Avian" | "Rabbit" | "Exotic" | "Other";
  breed: string;
  gender: "Male" | "Female" | "Neutered Male" | "Spayed Female";
  dob?: string | undefined;
  ageYears?: number | undefined;
  ageMonths?: number | undefined;
  color?: string | undefined;
  weightKg?: number | undefined;
  microchipNo?: string | undefined;
  sterilizationStatus: "Intact" | "Sterilized" | "Unknown";
  bloodGroup?: string | undefined;
  allergies: string[];
  chronicConditions: string[];
  dietPreference?: string | undefined;
  medicalNotes?: string | undefined;
  photoUrl?: string | undefined;
  status: "Active" | "Vaccination due" | "Under treatment" | "Deceased" | "Transferred" | "Inactive";
  lastVisitDate?: string | undefined;
  nextVaccineDate?: string | undefined;
  nextDewormingDate?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const PetSchema = new Schema<IPet>(
  {
    petId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    species: { type: String, required: true, enum: ["Canine", "Feline", "Avian", "Rabbit", "Exotic", "Other"], default: "Canine" },
    breed: { type: String, required: true },
    gender: { type: String, required: true, enum: ["Male", "Female", "Neutered Male", "Spayed Female"], default: "Male" },
    dob: { type: String },
    ageYears: { type: Number },
    ageMonths: { type: Number },
    color: { type: String },
    weightKg: { type: Number },
    microchipNo: { type: String },
    sterilizationStatus: { type: String, enum: ["Intact", "Sterilized", "Unknown"], default: "Unknown" },
    bloodGroup: { type: String },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    dietPreference: { type: String },
    medicalNotes: { type: String },
    photoUrl: { type: String },
    status: { type: String, enum: ["Active", "Vaccination due", "Under treatment", "Deceased", "Transferred", "Inactive"], default: "Active" },
    lastVisitDate: { type: String },
    nextVaccineDate: { type: String },
    nextDewormingDate: { type: String },
  },
  { timestamps: true }
);

export const Pet = (mongoose.models["Pet"] || mongoose.model<IPet>("Pet", PetSchema)) as mongoose.Model<IPet>;

