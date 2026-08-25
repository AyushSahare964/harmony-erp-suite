import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_BOARDING = [
  { id: "BRD-101", pet: "Bruno", species: "Canine", breed: "Golden Retriever", owner: "Tariq Hussain", phone: "+91 90000 11111", suite: "Deluxe Suite 02", checkIn: "2026-08-20", checkOut: "2026-08-25", diet: "Royal Canin 320g/day", status: "Occupied" },
  { id: "BRD-102", pet: "Luna", species: "Feline", breed: "Persian", owner: "Vikram Shetty", phone: "+91 90000 66666", suite: "Cat Condo 01", checkIn: "2026-08-21", checkOut: "2026-08-24", diet: "Renal Wet & Kibble", status: "Occupied" },
  { id: "BRD-103", pet: "Coco", species: "Canine", breed: "Shih Tzu", owner: "Deepika Iyer", phone: "+91 90000 33333", suite: "Standard Kennel 05", checkIn: "2026-08-22", checkOut: "2026-08-23", diet: "Hypoallergenic", status: "Booked" },
  { id: "BRD-104", pet: "Simba", species: "Feline", breed: "Maine Coon", owner: "Nalini Prasad", phone: "+91 90000 22222", suite: "Cat Condo 03", checkIn: "2026-08-19", checkOut: "2026-08-22", diet: "Hairball care", status: "Checked Out" },
];

const SEED_SWIMMING = [
  { id: "SW-201", pet: "Rocky", species: "Canine", breed: "German Shepherd", owner: "Kavitha Nair", phone: "+91 90000 77777", sessionType: "Hydrotherapy Rehab (45 min)", trainer: "Arjun Pillai (Physio)", timeSlot: "10:00 AM", status: "Completed" },
  { id: "SW-202", pet: "Bruno", species: "Canine", breed: "Golden Retriever", owner: "Tariq Hussain", phone: "+91 90000 11111", sessionType: "Fitness & Conditioning", trainer: "Sanjana K", timeSlot: "11:30 AM", status: "In Session" },
  { id: "SW-203", pet: "Milo", species: "Canine", breed: "Beagle", owner: "Ananya Sharma", phone: "+91 90000 55555", sessionType: "Fun Splash & Swim", trainer: "Arjun Pillai", timeSlot: "03:00 PM", status: "Booked" },
  { id: "SW-204", pet: "Keechu", species: "Canine", breed: "Labrador", owner: "Ria Meshram", phone: "+91 90000 44444", sessionType: "Weight Loss Hydro", trainer: "Sanjana K", timeSlot: "04:30 PM", status: "Booked" },
];

// ─── Boarding Server Functions ───────────────────────────────────────────────

export const listBoardingBookingsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const count = await ErpRow.countDocuments({ moduleId: "boarding_bookings" });
    if (count === 0) {
      for (const item of SEED_BOARDING) {
        await ErpRow.create({ moduleId: "boarding_bookings", data: item });
      }
    }
    const docs = await ErpRow.find({ moduleId: "boarding_bookings" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createBoardingBookingFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "boarding_bookings",
      data,
    });
    return toPlain(doc.data);
  });

export const updateBoardingStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), status: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndUpdate(
      { moduleId: "boarding_bookings", "data.id": data.id },
      { $set: { "data.status": data.status } }
    );
    return true;
  });

// ─── Swimming & Hydrotherapy Server Functions ───────────────────────────────

export const listSwimSessionsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const count = await ErpRow.countDocuments({ moduleId: "swimming_sessions" });
    if (count === 0) {
      for (const item of SEED_SWIMMING) {
        await ErpRow.create({ moduleId: "swimming_sessions", data: item });
      }
    }
    const docs = await ErpRow.find({ moduleId: "swimming_sessions" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createSwimSessionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "swimming_sessions",
      data,
    });
    return toPlain(doc.data);
  });

export const updateSwimStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), status: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndUpdate(
      { moduleId: "swimming_sessions", "data.id": data.id },
      { $set: { "data.status": data.status } }
    );
    return true;
  });
