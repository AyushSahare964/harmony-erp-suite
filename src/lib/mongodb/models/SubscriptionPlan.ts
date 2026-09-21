import mongoose, { Schema, type Document } from "mongoose";

export interface ISubscriptionPlan extends Document {
  planId: string;
  name: string;
  price: number;
  billingType: "recurring" | "session_pack";
  frequency: "monthly" | "quarterly" | "annual" | null;
  sessionCount: number | null;
  validityDays: number;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    planId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    billingType: { type: String, enum: ["recurring", "session_pack"], required: true },
    frequency: { type: String, enum: ["monthly", "quarterly", "annual", null], default: null },
    sessionCount: { type: Number, default: null },
    validityDays: { type: Number, required: true },
    category: { type: String, default: "Clinic" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SubscriptionPlanSchema.index({ isActive: 1 });

export const SubscriptionPlanModel =
  (mongoose.models["SubscriptionPlan"] as mongoose.Model<ISubscriptionPlan>) ??
  mongoose.model<ISubscriptionPlan>("SubscriptionPlan", SubscriptionPlanSchema);
