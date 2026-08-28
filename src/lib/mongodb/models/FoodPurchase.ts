import mongoose, { Schema, Document } from "mongoose";

export interface IFoodPurchase extends Document {
  purchaseId: string;
  patientId: string;
  visitId?: string;
  itemId: string;
  quantity: number;
  packSize?: string;
  purchaseDate: string;
  estimatedRunoutDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FoodPurchaseSchema = new Schema<IFoodPurchase>(
  {
    purchaseId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    visitId: { type: String },
    itemId: { type: String, required: true },
    quantity: { type: Number, required: true },
    packSize: { type: String },
    purchaseDate: { type: String, required: true },
    estimatedRunoutDate: { type: String },
  },
  { timestamps: true }
);

export const FoodPurchase = (mongoose.models["FoodPurchase"] || mongoose.model<IFoodPurchase>("FoodPurchase", FoodPurchaseSchema)) as mongoose.Model<IFoodPurchase>;
