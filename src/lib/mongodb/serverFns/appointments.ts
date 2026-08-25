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
    return toPlain(docs.map((d) => d.data));
  });

export const createAppointmentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "appointments",
      data,
    });
    return toPlain(doc.data);
  });

export const updateAppointmentStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ token: z.number(), status: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndUpdate(
      { moduleId: "appointments", "data.token": data.token },
      { $set: { "data.status": data.status } }
    );
    return true;
  });
