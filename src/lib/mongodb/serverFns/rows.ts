/**
 * ERP Row Server Functions — CRUD for all module rows stored in MongoDB.
 * Replaces the localStorage row store in store.tsx.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { WORKSPACES, type Row } from "@/lib/erp/workspaces";

// ─── getRowsFn ───────────────────────────────────────────────────────────────

export const getRowsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ moduleId: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<Row[]> => {
    await connectDB();

    const docs = await ErpRow.find({ moduleId: data.moduleId })
      .sort({ createdAt: -1 })
      .lean();

    if (docs.length > 0) {
      return docs.map((d) => d.data as Row);
    }

    // Fall back to static seed data on first access (auto-seeds the module)
    const seed = WORKSPACES[data.moduleId]?.rows ?? [];
    if (seed.length > 0) {
      await ErpRow.insertMany(
        seed.map((row) => ({ moduleId: data.moduleId, data: row }))
      );
    }
    return seed;
  });

// ─── addRowFn ────────────────────────────────────────────────────────────────

export const addRowFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      moduleId: z.string(),
      row:      z.record(z.unknown()),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ success: boolean; id: string }> => {
    await connectDB();

    const doc = await ErpRow.create({
      moduleId: data.moduleId,
      data:     data.row,
    });

    return { success: true, id: (doc._id as { toString(): string }).toString() };
  });

// ─── deleteRowFn ─────────────────────────────────────────────────────────────

export const deleteRowFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      moduleId: z.string(),
      index:    z.number().int().min(0),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();

    // Find all docs for the module sorted newest-first (matches UI order)
    const docs = await ErpRow.find({ moduleId: data.moduleId })
      .sort({ createdAt: -1 })
      .lean();

    const target = docs[data.index];
    if (!target) return { success: false };

    await ErpRow.deleteOne({ _id: target._id });
    return { success: true };
  });

// ─── resetRowsFn ─────────────────────────────────────────────────────────────

export const resetRowsFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ moduleId: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();

    // Delete all persisted rows for this module
    await ErpRow.deleteMany({ moduleId: data.moduleId });

    // Re-seed from static workspace definition
    const seed = WORKSPACES[data.moduleId]?.rows ?? [];
    if (seed.length > 0) {
      await ErpRow.insertMany(
        seed.map((row) => ({ moduleId: data.moduleId, data: row }))
      );
    }
    return { success: true };
  });
