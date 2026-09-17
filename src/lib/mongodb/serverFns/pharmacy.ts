import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_RETAIL_BILLS: any[] = [];

export const listRetailSalesFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
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
