import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_APPOINTMENTS: any[] = [];

const appointmentCategoryEnum = z.enum(["call", "whatsapp", "social_media"]).nullable().optional();

export const listAppointmentsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const docs = await ErpRow.find({ moduleId: "appointments" }).sort({ createdAt: -1 }).lean();
    return toPlain(
      docs.map((d: any) => ({
        ...d.data,
        appointment_date: (d.data as any)?.appointment_date || (d.data as any)?.date || null,
        appointment_category: (d.data as any)?.appointment_category || null,
        slot: (d.data as any)?.slot || (d.data as any)?.time || null,
        time: (d.data as any)?.time || (d.data as any)?.slot || null,
      }))
    );
  });

const appointmentPayloadSchema = z
  .object({
    token: z.union([z.number(), z.string()]).optional(),
    appointment_date: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    appointment_category: appointmentCategoryEnum,
  })
  .passthrough();

export const createAppointmentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => appointmentPayloadSchema.parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const payload = {
      ...data,
      appointment_category: data.appointment_category ?? null,
      appointment_date: data.appointment_date ?? data.date ?? null,
      date: data.appointment_date ?? data.date ?? null,
    };
    const doc = await ErpRow.create({
      moduleId: "appointments",
      data: payload,
    });
    return toPlain(doc.data);
  });

const updateAppointmentPayloadSchema = z
  .object({
    token: z.union([z.number(), z.string()]),
    appointment_date: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    appointment_category: appointmentCategoryEnum,
  })
  .passthrough();

export const updateAppointmentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => updateAppointmentPayloadSchema.parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const token = data.token;
    const numToken = Number(token);
    const orClauses: any[] = [{ "data.token": token }, { "data.token": String(token) }];
    if (!Number.isNaN(numToken)) {
      orClauses.push({ "data.token": numToken });
    }

    const existing = await ErpRow.findOne({
      moduleId: "appointments",
      $or: orClauses,
    });

    if (!existing) {
      throw new Error(`Appointment with token ${token} not found`);
    }

    const updatedData = {
      ...existing.data,
      ...data,
      appointment_date: data.appointment_date ?? (existing.data as any)?.appointment_date ?? (existing.data as any)?.date ?? null,
      date: data.appointment_date ?? (existing.data as any)?.date ?? (existing.data as any)?.appointment_date ?? null,
      appointment_category: data.appointment_category !== undefined ? data.appointment_category : ((existing.data as any)?.appointment_category ?? null),
    };

    existing.data = updatedData;
    existing.markModified("data");
    await existing.save();

    return toPlain(updatedData);
  });

export const updateAppointmentStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ token: z.union([z.number(), z.string()]), status: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    const token = data.token;
    const numToken = Number(token);
    const orClauses: any[] = [{ "data.token": token }, { "data.token": String(token) }];
    if (!Number.isNaN(numToken)) {
      orClauses.push({ "data.token": numToken });
    }

    await ErpRow.findOneAndUpdate(
      { moduleId: "appointments", $or: orClauses },
      { $set: { "data.status": data.status } }
    );
    return true;
  });

export const deleteAppointmentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ token: z.union([z.number(), z.string()]) }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    const token = data.token;
    const numToken = Number(token);
    const orClauses: any[] = [{ "data.token": token }, { "data.token": String(token) }];
    if (!Number.isNaN(numToken)) {
      orClauses.push({ "data.token": numToken });
    }

    await ErpRow.deleteMany({
      moduleId: "appointments",
      $or: orClauses,
    });
    return true;
  });
