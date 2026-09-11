import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_APPOINTMENTS = [
  { token: 1, pet: "Bruno", petId: "PET-0001", species: "Canine", breed: "Golden Retriever", owner: "Tariq Hussain", phone: "+91 90000 11111", doctor: "Dr. Rohit Sharma", reason: "Annual Health Check & Vaccine", slot: "09:30 AM", status: "In Consultation", priority: "Routine" },
  { token: 2, pet: "Luna", petId: "PET-0002", species: "Feline", breed: "Persian", owner: "Vikram Shetty", phone: "+91 90000 66666", doctor: "Dr. Rohit Sharma", reason: "Kidney Profile Review", slot: "10:00 AM", status: "Waiting", priority: "Routine" },
  { token: 3, pet: "Rocky", petId: "PET-0003", species: "Canine", breed: "German Shepherd", owner: "Kavitha Nair", phone: "+91 90000 77777", doctor: "Dr. Aisha Nair", reason: "Post-op Cruciate Follow-up", slot: "10:15 AM", status: "Waiting", priority: "Priority" },
  { token: 4, pet: "Milo", petId: "PET-0005", species: "Canine", breed: "Beagle", owner: "Ananya Sharma", phone: "+91 90000 55555", doctor: "Dr. Aisha Nair", reason: "Ear Infection & Scratching", slot: "10:30 AM", status: "Waiting", priority: "Routine" },
  { token: 5, pet: "Coco", petId: "PET-0008", species: "Canine", breed: "Shih Tzu", owner: "Deepika Iyer", phone: "+91 90000 33333", doctor: "Dr. Rohit Sharma", reason: "Skin Allergy Consultation", slot: "11:00 AM", status: "Completed", priority: "Routine" },
  { token: 6, pet: "Simba", petId: "PET-0007", species: "Feline", breed: "Maine Coon", owner: "Nalini Prasad", phone: "+91 90000 22222", doctor: "Dr. Rohit Sharma", reason: "Vomiting & Hairball Check", slot: "11:30 AM", status: "Waiting", priority: "Emergency STAT" },
];

const appointmentCategoryEnum = z.enum(["call", "whatsapp", "social_media"]).nullable().optional();

export const listAppointmentsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const count = await ErpRow.countDocuments({ moduleId: "appointments" });
    if (count === 0) {
      for (const item of SEED_APPOINTMENTS) {
        await ErpRow.create({ moduleId: "appointments", data: item });
      }
    }
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
