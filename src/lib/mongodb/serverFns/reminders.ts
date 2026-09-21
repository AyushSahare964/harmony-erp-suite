import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { BillingReminderModel } from "@/lib/mongodb/models/BillingReminder";
import { nextSeq } from "@/lib/mongodb/serverFns/counters";

function toPlain<T>(v: unknown): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export interface BillingReminderRow {
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
  createdAt: string;
}

export const listRemindersFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<BillingReminderRow[]> => {
    await connectDB();
    const docs = await BillingReminderModel.find({}).sort({ scheduledDate: 1, createdAt: -1 }).lean();
    return toPlain(docs.map((d) => ({
      reminderId: d.reminderId,
      invoiceNo: d.invoiceNo || undefined,
      petName: d.petName,
      ownerName: d.ownerName,
      ownerPhone: d.ownerPhone,
      dueAmount: d.dueAmount,
      reminderType: d.reminderType,
      scheduledDate: d.scheduledDate,
      channel: d.channel,
      priority: d.priority,
      status: d.status,
      notes: d.notes,
      createdAt: (d.createdAt as Date).toISOString(),
    })));
  });

const CreateReminderInputZ = z.object({
  invoiceNo: z.string().optional(),
  petName: z.string().min(1),
  ownerName: z.string().min(1),
  ownerPhone: z.string().optional().default(""),
  dueAmount: z.number().min(0).default(0),
  reminderType: z.enum(["Payment Due", "Post-Op Settlement", "Vaccine Fee", "Insurance Claim", "Cheque Clearance"]),
  scheduledDate: z.string().min(1),
  channel: z.enum(["WhatsApp", "Call", "SMS"]),
  priority: z.enum(["Normal", "High", "Urgent"]),
  notes: z.string().optional().default(""),
});

export const createReminderFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => CreateReminderInputZ.parse(raw))
  .handler(async ({ data }): Promise<BillingReminderRow> => {
    await connectDB();
    const reminderId = await nextSeq("billing_reminder", "REM", 4);
    const doc = await BillingReminderModel.create({
      reminderId,
      invoiceNo: data.invoiceNo || "",
      petName: data.petName,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      dueAmount: data.dueAmount,
      reminderType: data.reminderType,
      scheduledDate: data.scheduledDate,
      channel: data.channel,
      priority: data.priority,
      status: "Pending",
      notes: data.notes,
    });
    return toPlain({
      reminderId: doc.reminderId,
      invoiceNo: doc.invoiceNo || undefined,
      petName: doc.petName,
      ownerName: doc.ownerName,
      ownerPhone: doc.ownerPhone,
      dueAmount: doc.dueAmount,
      reminderType: doc.reminderType,
      scheduledDate: doc.scheduledDate,
      channel: doc.channel,
      priority: doc.priority,
      status: doc.status,
      notes: doc.notes,
      createdAt: (doc.createdAt as Date).toISOString(),
    });
  });

const ReminderIdInputZ = z.object({ reminderId: z.string().min(1) });

export const settleReminderFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => ReminderIdInputZ.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();
    await BillingReminderModel.findOneAndUpdate({ reminderId: data.reminderId }, { $set: { status: "Settled" } });
    return { success: true };
  });

const SnoozeReminderInputZ = z.object({ reminderId: z.string().min(1), newDate: z.string().min(1) });

export const snoozeReminderFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SnoozeReminderInputZ.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();
    await BillingReminderModel.findOneAndUpdate(
      { reminderId: data.reminderId },
      { $set: { scheduledDate: data.newDate, status: "Pending" } }
    );
    return { success: true };
  });

export const deleteReminderFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => ReminderIdInputZ.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();
    await BillingReminderModel.findOneAndDelete({ reminderId: data.reminderId });
    return { success: true };
  });
