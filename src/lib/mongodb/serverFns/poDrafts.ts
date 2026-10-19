/**
 * Purchase-order drafts — shared server-side so a receptionist's draft shows up
 * in the admin's register. Stored in the generic erp_rows collection.
 * Receptionist/admin can create; only admin can edit/delete, and only within 30 days.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { getMeFn } from "./auth";
import type { ClinicPurchaseOrderRecord } from "@/components/erp/billing/PurchaseOrderModal";

const MODULE_ID = "purchase-order-drafts";
const PO_DRAFT_EDIT_DAYS = 30;

const recordZ = z.record(z.unknown());

async function requireRole(allowed: string[]) {
  const me = await getMeFn();
  if (!me || !allowed.includes(me.roleId)) throw new Error("Not permitted");
  return me;
}

const toRecord = (d: any): ClinicPurchaseOrderRecord => ({
  ...(d.data as ClinicPurchaseOrderRecord),
  id: String(d._id),
  status: "DRAFT",
  draftCreatedAt: d.createdAt.toISOString(),
});

export const listPoDraftsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<ClinicPurchaseOrderRecord[]> => {
    await requireRole(["admin", "reception"]);
    await connectDB();
    const docs = await ErpRow.find({ moduleId: MODULE_ID }).sort({ createdAt: -1 }).lean();
    return docs.map(toRecord);
  });

export const savePoDraftFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ record: recordZ }).parse(raw))
  .handler(async ({ data }): Promise<{ id: string }> => {
    await requireRole(["admin", "reception"]);
    await connectDB();
    const doc = await ErpRow.create({ moduleId: MODULE_ID, data: data.record });
    return { id: String(doc._id) };
  });

/** Admin only, and only while the draft is younger than PO_DRAFT_EDIT_DAYS. */
export const updatePoDraftFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), record: recordZ }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireRole(["admin"]);
    await connectDB();
    const doc = await ErpRow.findOne({ _id: data.id, moduleId: MODULE_ID });
    if (!doc) throw new Error("Draft not found");
    if (Date.now() - doc.createdAt.getTime() > PO_DRAFT_EDIT_DAYS * 864e5) {
      throw new Error(`Draft is older than ${PO_DRAFT_EDIT_DAYS} days and can no longer be changed`);
    }
    doc.data = data.record;
    doc.markModified("data");
    await doc.save();
    return { success: true };
  });

/** Admin only. Used after a draft is issued as a real PO, or to discard it. */
export const deletePoDraftFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireRole(["admin"]);
    await connectDB();
    await ErpRow.deleteOne({ _id: data.id, moduleId: MODULE_ID });
    return { success: true };
  });
