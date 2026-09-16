/**
 * Reminder — dues follow-ups and clinical recalls surfaced on the billing desk.
 * `generateDueRemindersFn` creates these automatically once an invoice passes
 * the party's credit days.
 */

import mongoose, { Schema, type Document } from "mongoose";

export type ReminderChannel = "IN_APP" | "SMS" | "WHATSAPP" | "EMAIL";
export type ReminderStatus = "OPEN" | "DONE" | "SNOOZED";
export type ReminderLinkKind = "SALE" | "PURCHASE" | "PAYMENT" | "VISIT" | "NONE";

export interface IReminder extends Document {
  remindOn: string;
  remindTime?: string;
  title: string;
  notes?: string;
  partyId?: string;
  partyName?: string;
  animalId?: string;
  linkKind: ReminderLinkKind;
  linkId?: string;
  linkNumber?: string;
  amount?: number;
  channel: ReminderChannel;
  status: ReminderStatus;
  /** Set when auto-generated, so a re-run updates instead of duplicating. */
  autoKey?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    remindOn: { type: String, required: true, index: true },
    remindTime: { type: String, default: "" },
    title: { type: String, required: true },
    notes: { type: String, default: "" },
    partyId: { type: String, default: "", index: true },
    partyName: { type: String, default: "" },
    animalId: { type: String, default: "" },
    linkKind: {
      type: String,
      enum: ["SALE", "PURCHASE", "PAYMENT", "VISIT", "NONE"],
      default: "NONE",
    },
    linkId: { type: String, default: "" },
    linkNumber: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    channel: {
      type: String,
      enum: ["IN_APP", "SMS", "WHATSAPP", "EMAIL"],
      default: "IN_APP",
    },
    status: { type: String, enum: ["OPEN", "DONE", "SNOOZED"], default: "OPEN", index: true },
    autoKey: { type: String, default: "" },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: "reminders" },
);

ReminderSchema.index({ status: 1, remindOn: 1 });
ReminderSchema.index(
  { autoKey: 1 },
  { unique: true, partialFilterExpression: { autoKey: { $gt: "" } } },
);

export const ReminderModel =
  (mongoose.models["Reminder"] as mongoose.Model<IReminder>) ??
  mongoose.model<IReminder>("Reminder", ReminderSchema);
