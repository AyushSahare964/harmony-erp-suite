import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { DiscountSchemeModel } from "@/lib/mongodb/models/DiscountScheme";

export interface DiscountSchemeRow {
  _id: string;
  name: string;
  description: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listDiscountSchemesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscountSchemeRow[]> => {
    await connectDB();
    const docs = await DiscountSchemeModel.find({}).sort({ startDate: -1 }).lean();
    return docs.map((d) => ({
      _id: String(d._id),
      name: d.name,
      description: d.description ?? "",
      discountPercent: d.discountPercent,
      startDate: d.startDate,
      endDate: d.endDate,
      isActive: d.isActive,
    }));
  },
);

export const saveDiscountSchemeFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        _id: z.string().optional(),
        name: z.string().trim().min(1).max(80),
        description: z.string().max(300).optional(),
        discountPercent: z.number().gt(0).max(100),
        startDate: ymd,
        endDate: ymd,
        isActive: z.boolean().default(true),
      })
      .refine((v) => v.endDate >= v.startDate, { message: "End date must be on or after start date" })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    const { _id, ...fields } = data;
    if (_id) await DiscountSchemeModel.findByIdAndUpdate(_id, fields as Record<string, unknown>);
    else await DiscountSchemeModel.create(fields as Record<string, unknown>);
    return { ok: true };
  });

export const deleteDiscountSchemeFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ _id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    await DiscountSchemeModel.findByIdAndDelete(data._id);
    return { ok: true };
  });
