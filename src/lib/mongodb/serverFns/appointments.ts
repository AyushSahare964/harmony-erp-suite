import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_APPOINTMENTS: any[] = [];

const appointmentCategoryEnum = z.enum(["call", "whatsapp", "social_media"]).nullable().optional();

export const listAppointmentsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const docs = await ErpRow.find({ moduleId: "appointments" }).sort({ createdAt: -1 }).lean();

    // Auto-sync appointment status with clinical visits (e.g. when patient treatment is completed)
    try {
      const activeAppts = docs.filter((d: any) => {
        const st = String(d.data?.status || "").toLowerCase().trim();
        return st !== "completed" && st !== "cancelled" && st !== "no-show";
      });

      if (activeAppts.length > 0) {
        const visits = await ClinicalVisit.find({}).sort({ createdAt: -1 }).limit(100).lean();

        for (const doc of activeAppts) {
          const appData = (doc.data || {}) as Record<string, any>;
          const appTokenStr = String(appData["token"] || "").trim().toLowerCase();
          const appPetId = String(appData["petId"] || "").trim().toLowerCase();
          const appPetName = String(appData["pet"] || "").trim().toLowerCase();
          const appDate = String(appData["appointment_date"] || appData["date"] || "").slice(0, 10);

          const matchingVisit = visits.find((v: any) => {
            // Match 1: Explicit appointmentToken
            if (appTokenStr && v.appointmentToken && String(v.appointmentToken).trim().toLowerCase() === appTokenStr) {
              return true;
            }
            // Match 2: vitals.complaint contains Token <token>
            if (appTokenStr && v.vitals?.complaint && String(v.vitals.complaint).toLowerCase().includes(appTokenStr)) {
              return true;
            }
            // Match 3: Matching petId or petName and same appointment date
            const vPetId = String(v.petId || "").trim().toLowerCase();
            const vPetName = String(v.petName || "").trim().toLowerCase();
            const vDate = String(v.date || v.createdAt || "").slice(0, 10);

            const petMatches = (appPetId && vPetId && appPetId === vPetId) || (appPetName && vPetName && appPetName === vPetName);
            const dateMatches = !appDate || !vDate || appDate === vDate;

            return petMatches && dateMatches;
          });

          if (matchingVisit) {
            const vStatus = String(matchingVisit.status || "").toLowerCase();
            const isCompleted =
              vStatus === "paid" ||
              vStatus === "settled" ||
              vStatus === "completed" ||
              vStatus === "billed" ||
              (Number(matchingVisit.totalAmount || 0) > 0 && Number(matchingVisit.amountPaid || 0) >= Number(matchingVisit.totalAmount || 0)) ||
              Boolean(matchingVisit.diagnosis && matchingVisit.diagnosis !== "OPD Visit" && matchingVisit.diagnosis !== "Routine Consultation");

            if (isCompleted) {
              appData["status"] = "Completed";
              await ErpRow.updateOne({ _id: doc._id }, { $set: { "data.status": "Completed" } });
            } else if (vStatus === "in consultation" || vStatus === "admitted") {
              if (String(appData["status"] || "").toLowerCase() === "waiting") {
                appData["status"] = "In consultation";
                await ErpRow.updateOne({ _id: doc._id }, { $set: { "data.status": "In consultation" } });
              }
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn("[listAppointmentsFn] Auto-sync with visits warning:", syncErr);
    }

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
