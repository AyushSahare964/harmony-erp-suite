import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_LAB_ORDERS: any[] = [];

export const listLabOrdersFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const docs = await ErpRow.find({ moduleId: "lab_orders" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createLabOrderFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "lab_orders",
      data,
    });
    return toPlain(doc.data);
  });

export const updateLabResultsFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ orderId: z.string(), patch: z.record(z.any()) }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    const existing = await ErpRow.findOne({ moduleId: "lab_orders", "data.orderId": data.orderId });
    if (existing) {
      existing.data = { ...existing.data, ...data.patch };
      existing.markModified("data");
      await existing.save();
    }
    return true;
  });
