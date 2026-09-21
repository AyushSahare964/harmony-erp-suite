import mongoose, { Schema, type Document } from "mongoose";

export interface IBillingReminder extends Document {
  reminderId: string;
  invoiceNo?: string;
  petName: string;
  ownerName: string;
  ownerPhone: string;
  dueAmount: number;
  reminderType: "Payment Due" | "Post-Op Settlement" | "Vaccine Fee" | "Insurance Claim" | "Cheque Clearance";
  scheduledDate: string;
  channel: "WhatsApp" | "Call" | "SMS";
  priority: "Normal" | "High" | "Urgent";
  status: "Pending" | "Settled" | "Snoozed";
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillingReminderSchema = new Schema<IBillingReminder>(
  {
    reminderId: { type: String, required: true, unique: true, index: true },
    invoiceNo: { type: String, default: "" },
    petName: { type: String, required: true },
    ownerName: { type: String, required: true },
    ownerPhone: { type: String, default: "" },
    dueAmount: { type: Number, default: 0 },
    reminderType: {
      type: String,
      enum: ["Payment Due", "Post-Op Settlement", "Vaccine Fee", "Insurance Claim", "Cheque Clearance"],
      default: "Payment Due",
    },
    scheduledDate: { type: String, required: true, index: true },
    channel: { type: String, enum: ["WhatsApp", "Call", "SMS"], default: "WhatsApp" },
    priority: { type: String, enum: ["Normal", "High", "Urgent"], default: "Normal" },
    status: { type: String, enum: ["Pending", "Settled", "Snoozed"], default: "Pending", index: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

BillingReminderSchema.index({ status: 1, scheduledDate: 1 });

export const BillingReminderModel =
  (mongoose.models["BillingReminder"] as mongoose.Model<IBillingReminder>) ??
  mongoose.model<IBillingReminder>("BillingReminder", BillingReminderSchema);
