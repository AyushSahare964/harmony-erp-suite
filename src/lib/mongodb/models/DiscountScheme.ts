import mongoose, { Schema, type Document } from "mongoose";

export interface IDiscountScheme extends Document {
  name: string;
  description?: string;
  discountPercent: number;
  /** Inclusive, local calendar dates as YYYY-MM-DD */
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const DiscountSchemeSchema = new Schema<IDiscountScheme>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
    discountPercent: { type: Number, required: true, min: 0.01, max: 100 },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "discount_schemes" },
);

export const DiscountSchemeModel: mongoose.Model<IDiscountScheme> =
  (mongoose.models["DiscountScheme"] as mongoose.Model<IDiscountScheme>) ??
  mongoose.model<IDiscountScheme>("DiscountScheme", DiscountSchemeSchema);
