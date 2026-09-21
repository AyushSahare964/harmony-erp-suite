import mongoose, { Schema, type Document } from "mongoose";

export interface IClientSubscription extends Document {
  subId: string;
  planId: string;
  planName: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  status: "Active" | "Expiring" | "Expired" | "Cancelled";
  startDate: string;
  endDate: string | null;
  sessionsRemaining: number | null;
  nextBillingDate: string | null;
  totalPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSubscriptionSchema = new Schema<IClientSubscription>(
  {
    subId: { type: String, required: true, unique: true, index: true },
    planId: { type: String, required: true, index: true },
    planName: { type: String, required: true },
    petId: { type: String, required: true, index: true },
    petName: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
    status: {
      type: String,
      enum: ["Active", "Expiring", "Expired", "Cancelled"],
      default: "Active",
    },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    sessionsRemaining: { type: Number, default: null },
    nextBillingDate: { type: String, default: null },
    totalPaid: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ClientSubscriptionSchema.index({ status: 1 });

export const ClientSubscriptionModel =
  (mongoose.models["ClientSubscription"] as mongoose.Model<IClientSubscription>) ??
  mongoose.model<IClientSubscription>("ClientSubscription", ClientSubscriptionSchema);
