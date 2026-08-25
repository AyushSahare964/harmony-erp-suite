import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_RETAIL_BILLS = [
  { bill: "RET-401", item: "Amoxicillin 250mg (x20), Royal Canin Maxi 4kg", category: "Medicine", qty: 21, amount: 2330, payment: "UPI", customer: "Tariq Hussain (Bruno)", date: "2026-08-22", status: "Completed" },
  { bill: "RET-402", item: "Ergonomic Padded Dog Harness (L), Nylon Leash 6ft", category: "Accessory", qty: 2, amount: 1700, payment: "Card", customer: "Vikram Shetty (Luna)", date: "2026-08-22", status: "Completed" },
  { bill: "RET-403", item: "Deworming Syrup 30ml, Tick & Flea Collar (L)", category: "Medicine", qty: 2, amount: 415, payment: "Cash", customer: "Walk-in Customer", date: "2026-08-22", status: "Completed" },
  { bill: "RET-404", item: "Orthopedic Memory Foam Pet Bed (XL)", category: "Accessory", qty: 1, amount: 3200, payment: "UPI", customer: "Kavitha Nair (Rocky)", date: "2026-08-22", status: "Completed" },
  { bill: "RET-405", item: "Hooded Feline Litter Box (Anti-Odour)", category: "Accessory", qty: 1, amount: 1850, payment: "UPI", customer: "Nalini Prasad (Simba)", date: "2026-08-22", status: "Completed" },
];

export const listRetailSalesFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const count = await ErpRow.countDocuments({ moduleId: "retail_sales" });
    if (count === 0) {
      for (const item of SEED_RETAIL_BILLS) {
        await ErpRow.create({ moduleId: "retail_sales", data: item });
      }
    }
    const docs = await ErpRow.find({ moduleId: "retail_sales" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createRetailSaleFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "retail_sales",
      data,
    });
    return toPlain(doc.data);
  });
