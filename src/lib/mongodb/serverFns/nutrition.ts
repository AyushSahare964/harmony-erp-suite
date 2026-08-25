import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_FEEDING_PLANS = [
  { plan: "NUT-202", pet: "Luna", petId: "PET-0002", species: "Feline", breed: "Persian", owner: "Vikram Shetty", ownerPhone: "+91 90000 66666", diet: "Renal support", qtyPerDay: 180, nextReview: "2026-08-18", status: "Review due" },
  { plan: "NUT-203", pet: "Milo", petId: "PET-0005", species: "Canine", breed: "Beagle", owner: "Ananya Sharma", ownerPhone: "+91 90000 55555", diet: "Puppy growth", qtyPerDay: 260, nextReview: "2026-09-02", status: "Active" },
  { plan: "NUT-204", pet: "Coco", petId: "PET-0008", species: "Canine", breed: "Shih Tzu", owner: "Deepika Iyer", ownerPhone: "+91 90000 33333", diet: "Hypoallergenic", qtyPerDay: 300, nextReview: "2026-08-16", status: "Review due" },
  { plan: "NUT-205", pet: "Simba", petId: "PET-0007", species: "Feline", breed: "Maine Coon", owner: "Nalini Prasad", ownerPhone: "+91 90000 22222", diet: "Hairball control", qtyPerDay: 90, nextReview: "2026-09-10", status: "Active" },
  { plan: "NUT-201", pet: "Bruno", petId: "PET-0001", species: "Canine", breed: "Golden Retriever", owner: "Tariq Hussain", ownerPhone: "+91 90000 11111", diet: "Weight control", qtyPerDay: 320, nextReview: "2026-08-22", status: "Active" },
];

export const listFeedingPlansFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const count = await ErpRow.countDocuments({ moduleId: "nutrition_plans" });
    if (count === 0) {
      for (const item of SEED_FEEDING_PLANS) {
        await ErpRow.create({ moduleId: "nutrition_plans", data: item });
      }
    }
    const docs = await ErpRow.find({ moduleId: "nutrition_plans" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createFeedingPlanFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "nutrition_plans",
      data,
    });
    return toPlain(doc.data);
  });

export const deleteFeedingPlanFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ plan: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndDelete({ moduleId: "nutrition_plans", "data.plan": data.plan });
    return true;
  });
