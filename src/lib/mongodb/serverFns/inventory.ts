/**
 * Inventory Server Functions — full CRUD for InventoryItem, StockBatch, and LedgerEntry.
 * All functions run server-side only via TanStack Server Functions.
 *
 * Return types use concrete interfaces and toPlain() JSON sanitization so TanStack Start's
 * seroval serialization passes without Object/BSON errors.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { nextSeq, peekNextSeq } from "@/lib/mongodb/serverFns/counters";



// ─── Concrete serializable return types ───────────────────────────────────────

export interface InventoryItemRow {
  itemCode: string;
  productType: "MEDICINE" | "FOOD" | "ACCESSORY";
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  category: string;
  subGroup: string;
  hasVariants: boolean;
  sku: string;
  medicineDetails?: {
    medicineType?: string;
    genericComposition?: string;
    strength?: string;
    dosageForm?: string;
    packSize?: string;
    batchNumber?: string;
    expiryDate?: string;
  };
  foodDetails?: {
    foodType?: string;
    species?: string;
    variantFlavour?: string;
    packSize?: string;
  };
  accessoryDetails?: {
    accessoryType?: string;
    sizeVariant?: string;
  };
  unit: string;
  purchaseUom: string;
  salesUom: string;
  uomConversions: { uom: string; conversionFactor: number }[];
  maintainStock: boolean;
  valuationMethod: string;
  currentStock: number;
  minStockLevel: number;
  reorderLevel: number;
  reorderQty: number;
  safetyStock: number;
  storageLocation: string;
  batchTracking: boolean;
  serialTracking: boolean;
  allowNegativeStock: boolean;
  defaultSalePrice: number;
  defaultPurchasePrice: number;
  mrp: number;
  minSalePrice: number;
  maxDiscountPct: number;
  valuationRate: number;
  lastPurchaseRate: number;
  gstRate: number;
  hsnCode: string;
  taxCategory: string;
  isZeroRated: boolean;
  isExempt: boolean;
  isImport: boolean;
  defaultSupplierId: string;
  defaultSupplierName: string;
  leadTimeDays: number;
  minOrderQty: number;
  purchaseAccount: string;
  expenseAccount: string;
  incomeAccount: string;
  costCenter: string;
  isSalesItem: boolean;
  allowAlternativeItem: boolean;
  status: string;
  createdAt?: string | undefined;
}

export interface StockBatchRow {
  batchCode: string; itemId: string; itemCode: string; itemName: string;
  batchNo: string; manufacturingDate: string; expiryDate: string;
  supplierId: string; supplierName: string; purchaseOrderRef: string;
  invoiceBillNo: string; receivedDate: string; receivedQty: number;
  acceptedQty: number; rejectedQty: number; rejectionReason: string;
  qty: number; purchasePricePerUnit: number; landingCost: number;
  landingCostPerUnit: number; gstOnPurchase: number; totalValue: number;
  storageLocation: string; qualityChecked: boolean; qcInspectorName: string;
  remarks: string; status: string; createdAt?: string | undefined;
}

export interface LedgerEntryRow {
  id: string; medicineId: string; medicineName: string; batchId: string;
  batchNo: string; movementType: string; quantity: number; sourceType: string;
  sourceRef: string; balanceAfter: number; actorName: string;
  createdAt: string; reason?: string | undefined;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const UomConversionZ = z.object({
  uom: z.string(),
  conversionFactor: z.number().positive(),
});

const MedicineDetailsZ = z.object({
  medicineType: z.string().default(""),
  genericComposition: z.string().default(""),
  strength: z.string().default(""),
  dosageForm: z.string().default(""),
  packSize: z.string().default(""),
  batchNumber: z.string().default(""),
  expiryDate: z.string().default(""),
}).partial();

const FoodDetailsZ = z.object({
  foodType: z.string().default(""),
  species: z.string().default(""),
  variantFlavour: z.string().default(""),
  packSize: z.string().default(""),
}).partial();

const AccessoryDetailsZ = z.object({
  accessoryType: z.string().default(""),
  sizeVariant: z.string().default(""),
}).partial();

const InventoryItemInputZ = z.object({
  // Identity
  productType: z.enum(["MEDICINE", "FOOD", "ACCESSORY"]).default("MEDICINE"),
  name:        z.string().min(1, "Item name is required"),
  genericName: z.string().default(""),
  brand:       z.string().default(""),
  manufacturer:z.string().default(""),
  description: z.string().default(""),
  category:    z.enum(["Medicine", "Food", "Accessory", "Consumable", "Animal Food", "Animal Accessories"]),
  subGroup:    z.string().default(""),
  hasVariants: z.boolean().default(false),
  sku:         z.string().default(""),

  medicineDetails: MedicineDetailsZ.optional(),
  foodDetails: FoodDetailsZ.optional(),
  accessoryDetails: AccessoryDetailsZ.optional(),

  // Stock
  unit:               z.string().min(1, "Unit of measure is required"),
  purchaseUom:        z.string().default(""),
  salesUom:           z.string().default(""),
  uomConversions:     z.array(UomConversionZ).default([]),
  maintainStock:      z.boolean().default(true),
  valuationMethod:    z.enum(["FEFO", "FIFO", "Moving Average"]).default("FEFO"),
  currentStock:       z.number().min(0).default(0),
  minStockLevel:      z.number().min(0).default(0),
  reorderLevel:       z.number().min(0).default(10),
  reorderQty:         z.number().min(0).default(20),
  safetyStock:        z.number().min(0).default(0),
  storageLocation:    z.string().default(""),
  batchTracking:      z.boolean().default(true),
  serialTracking:     z.boolean().default(false),
  allowNegativeStock: z.boolean().default(false),

  // Pricing
  defaultSalePrice:     z.number().min(0),
  defaultPurchasePrice: z.number().min(0).default(0),
  mrp:                  z.number().min(0).default(0),
  minSalePrice:         z.number().min(0).default(0),
  maxDiscountPct:       z.number().min(0).max(100).default(0),
  valuationRate:        z.number().min(0).default(0),
  lastPurchaseRate:     z.number().min(0).default(0),

  // Tax
  gstRate:     z.number().min(0).max(28).default(12),
  hsnCode:     z.string().default(""),
  taxCategory: z.string().default(""),
  isZeroRated: z.boolean().default(false),
  isExempt:    z.boolean().default(false),
  isImport:    z.boolean().default(false),

  // Purchasing
  defaultSupplierId:   z.string().default(""),
  defaultSupplierName: z.string().default(""),
  leadTimeDays:        z.number().min(0).default(0),
  minOrderQty:         z.number().min(0).default(1),
  purchaseAccount:     z.string().default(""),
  expenseAccount:      z.string().default(""),

  // Sales & Accounts
  incomeAccount:        z.string().default(""),
  costCenter:           z.string().default(""),
  isSalesItem:          z.boolean().default(true),
  allowAlternativeItem: z.boolean().default(false),

  status: z.enum(["Active", "Inactive"]).default("Active"),
});

const StockBatchInputZ = z.object({
  itemCode:         z.string(),
  itemName:         z.string(),
  batchNo:          z.string().min(1, "Batch number is required"),
  manufacturingDate:z.string().default(""),
  expiryDate:       z.string().min(1, "Expiry date is required"),
  supplierId:       z.string().default(""),
  supplierName:     z.string().default(""),
  purchaseOrderRef: z.string().default(""),
  invoiceBillNo:    z.string().default(""),
  receivedDate:     z.string(),
  receivedQty:      z.number().positive(),
  acceptedQty:      z.number().min(0),
  rejectedQty:      z.number().min(0).default(0),
  rejectionReason:  z.string().default(""),
  purchasePricePerUnit: z.number().min(0),
  landingCost:      z.number().min(0).default(0),
  gstOnPurchase:    z.number().min(0).default(0),
  storageLocation:  z.string().default(""),
  qualityChecked:   z.boolean().default(false),
  qcInspectorName:  z.string().default(""),
  remarks:          z.string().default(""),
  actor:            z.string().default("System"),
});

const StockAdjustmentInputZ = z.object({
  itemId:       z.string(),
  itemCode:     z.string(),
  itemName:     z.string(),
  batchId:      z.string(),
  batchCode:    z.string(),
  batchNo:      z.string(),
  movementType: z.enum(["adjustment_in", "adjustment_out", "expiry_writeoff", "damage_writeoff", "transfer"]),
  adjustedQty:  z.number().positive(),
  targetLocation:z.string().default(""),
  referenceNo:  z.string().default(""),
  reasonCode:   z.enum(["Damage", "Expiry", "Pilferage", "Count Error", "Transfer", "Other"]),
  remarks:      z.string().min(1, "Remarks required for adjustments"),
  authorizedBy: z.string().default(""),
  dateTime:     z.string(),
  actor:        z.string().default("System"),
});

// ─── Serialization helper ───────────────────────────────────────────────────
function toPlain<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

// ─── getItemsFn ───────────────────────────────────────────────────────────────

export const getItemsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      type: z.enum(["MEDICINE", "FOOD", "ACCESSORY"]).optional(),
      status: z.enum(["Active", "Inactive", "all"]).optional(),
      dosageForms: z.array(z.string()).optional(),
      injectableOnly: z.boolean().optional(),
      search: z.string().optional(),
    }).optional().parse(raw)
  )
  .handler(async ({ data }): Promise<InventoryItemRow[]> => {
    await connectDB();


    const query: Record<string, unknown> = {};
    if (data?.type) query["productType"] = data.type;
    if (data?.status && data.status !== "all") query["status"] = data.status;

    if (data?.dosageForms && data.dosageForms.length > 0) {
      query["medicineDetails.dosageForm"] = { $in: data.dosageForms.map((df) => new RegExp(df, "i")) };
    } else if (data?.injectableOnly) {
      query["$or"] = [
        { "medicineDetails.dosageForm": { $regex: /injection|vaccine|vial/i } },
        { category: "Vaccine" },
        { name: { $regex: /inj|vaccine|vial/i } },
      ];
    }

    if (data?.search && data.search.trim()) {
      const regex = new RegExp(data.search.trim(), "i");
      query["$and"] = [
        ...(query["$and"] ? (query["$and"] as any[]) : []),
        {
          $or: [
            { name: { $regex: regex } },
            { genericName: { $regex: regex } },
            { brand: { $regex: regex } },
            { itemCode: { $regex: regex } },
          ],
        },
      ];
    }

    const docs = await InventoryItem.find(query).sort({ itemCode: 1 }).lean();
    return toPlain(docs) as unknown as InventoryItemRow[];
  });

// ─── peekItemCodeFn ───────────────────────────────────────────────────────────

export const peekItemCodeFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      type: z.enum(["MEDICINE", "FOOD", "ACCESSORY"]).optional(),
    }).optional().parse(raw)
  )
  .handler(async ({ data }): Promise<string> => {
    await connectDB();
    const pType = data?.type || "MEDICINE";
    const prefix = pType === "FOOD" ? "F" : pType === "ACCESSORY" ? "A" : "M";
    return peekNextSeq("inventory_item_" + prefix, prefix, 4);
  });

// ─── addItemFn ────────────────────────────────────────────────────────────────

export const addItemFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => InventoryItemInputZ.parse(raw))
  .handler(async ({ data }): Promise<InventoryItemRow> => {
    await connectDB();
    const prefix = data.productType === "FOOD" ? "F" : data.productType === "ACCESSORY" ? "A" : "M";
    const itemCode = await nextSeq("inventory_item_" + prefix, prefix, 4);
    const newItem = await InventoryItem.create({
      ...(data as unknown as Record<string, unknown>),
      itemCode,
    });

    // If initial stock is provided, record OPENING_STOCK transaction in ledger
    if (data.currentStock && data.currentStock > 0) {
      await ErpRow.create({
        moduleId: "inventory_ledger",
        data: {
          id: await nextSeq("ledger_entry", "L", 4),
          medicineId: itemCode,
          medicineName: data.name,
          batchId: `OPN-${itemCode}`,
          batchNo: data.medicineDetails?.batchNumber || "OPENING-STOCK",
          movementType: "opening_stock",
          quantity: data.currentStock,
          sourceType: "manual_adjustment",
          sourceRef: `OPN-${itemCode}`,
          balanceAfter: data.currentStock,
          actorName: "System / Initial Setup",
          createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
          reason: "Opening stock balance",
        },
      });
    }

    return toPlain(newItem.toObject()) as unknown as InventoryItemRow;
  });

// ─── updateItemFn ─────────────────────────────────────────────────────────────

export const updateItemFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      itemCode: z.string(),
      patch: InventoryItemInputZ.partial(),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<InventoryItemRow> => {
    await connectDB();
    // Enforce immutability: productType cannot be modified post-creation (§3.1, §4.1, §5)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { productType: _ignored, ...safePatch } = data.patch as Record<string, unknown>;

    const updated = await InventoryItem.findOneAndUpdate(
      { itemCode: data.itemCode },
      { $set: safePatch },
      { returnDocument: "after" }
    ).lean();
    if (!updated) throw new Error(`Item not found: ${data.itemCode}`);
    return toPlain(updated) as unknown as InventoryItemRow;
  });

// ─── toggleItemStatusFn ───────────────────────────────────────────────────────

export const toggleItemStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      itemCode: z.string(),
      status: z.enum(["Active", "Inactive"]),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<{ success: boolean; status: string }> => {
    await connectDB();
    await InventoryItem.findOneAndUpdate({ itemCode: data.itemCode }, { status: data.status });
    return { success: true, status: data.status };
  });

// ─── deactivateItemFn ─────────────────────────────────────────────────────────

export const deactivateItemFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ itemCode: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();
    await InventoryItem.findOneAndUpdate({ itemCode: data.itemCode }, { status: "Inactive" });
    return { success: true };
  });

// ─── addStockFn ───────────────────────────────────────────────────────────────

export const addStockFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => StockBatchInputZ.parse(raw))
  .handler(async ({ data }): Promise<StockBatchRow> => {
    await connectDB();

    const batchCode = await nextSeq("stock_batch", "B", 4);
    const landingCostPerUnit = data.acceptedQty > 0 ? data.landingCost / data.acceptedQty : 0;
    const totalValue = data.acceptedQty * (data.purchasePricePerUnit + landingCostPerUnit);

    const batch = await StockBatch.create({
      ...data,
      batchCode,
      qty: data.acceptedQty,
      landingCostPerUnit,
      totalValue,
    });

    // Update lastPurchaseRate on the item
    await InventoryItem.findOneAndUpdate(
      { itemCode: data.itemCode },
      { lastPurchaseRate: data.purchasePricePerUnit }
    );

    // Record ledger entry in ErpRow
    await ErpRow.create({
      moduleId: "inventory_ledger",
      data: {
        id: await nextSeq("ledger_entry", "L", 4),
        medicineId: data.itemCode,
        medicineName: data.itemName,
        batchId: batch.batchCode,
        batchNo: data.batchNo,
        movementType: "purchase_in",
        quantity: data.acceptedQty,
        sourceType: "purchase",
        sourceRef: data.purchaseOrderRef || `GRN-${Date.now()}`,
        balanceAfter: data.acceptedQty,
        actorName: data.actor,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      },
    });

    return toPlain(batch.toObject()) as unknown as StockBatchRow;
  });

// ─── adjustStockFn ────────────────────────────────────────────────────────────

export const adjustStockFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => StockAdjustmentInputZ.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; newQty: number; referenceNo: string }> => {
    await connectDB();

    const batch = await StockBatch.findOne({ batchCode: data.batchId }).lean();
    if (!batch) throw new Error("Batch not found");

    const isIn = data.movementType === "adjustment_in" || data.movementType === "transfer";
    const newQty = isIn
      ? batch.qty + data.adjustedQty
      : Math.max(0, batch.qty - data.adjustedQty);

    await StockBatch.findOneAndUpdate({ batchCode: data.batchId }, { qty: newQty });

    const adjRef = data.referenceNo || (await nextSeq("stock_adjustment", "ADJ", 4));

    // Ledger entry
    await ErpRow.create({
      moduleId: "inventory_ledger",
      data: {
        id: await nextSeq("ledger_entry", "L", 4),
        medicineId: data.itemCode,
        medicineName: data.itemName,
        batchId: data.batchId,
        batchNo: data.batchNo,
        movementType: data.movementType,
        quantity: data.adjustedQty,
        sourceType: "manual_adjustment",
        sourceRef: adjRef,
        balanceAfter: newQty,
        actorName: data.actor,
        createdAt: data.dateTime || new Date().toISOString().replace("T", " ").slice(0, 16),
        reason: `${data.reasonCode}: ${data.remarks}`,
      },
    });

    return { success: true, newQty, referenceNo: adjRef };
  });

// ─── getBatchesFn ─────────────────────────────────────────────────────────────

export const getBatchesFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ itemCode: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<StockBatchRow[]> => {
    await connectDB();
    const docs = await StockBatch.find({ itemCode: data.itemCode, status: { $ne: "Rejected" } })
      .sort({ expiryDate: 1 })
      .lean();
    return toPlain(docs) as unknown as StockBatchRow[];
  });

// ─── getLedgerFn ──────────────────────────────────────────────────────────────

export const getLedgerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      itemCode: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<LedgerEntryRow[]> => {
    await connectDB();
    const filter: Record<string, unknown> = { moduleId: "inventory_ledger" };
    if (data.itemCode) filter["data.medicineId"] = data.itemCode;
    const docs = await ErpRow.find(filter).sort({ createdAt: -1 }).limit(data.limit).lean();
    return toPlain(docs.map((d) => d.data)) as unknown as LedgerEntryRow[];
  });

// ─── clearInventoryFn ─────────────────────────────────────────────────────────
// Deletes all InventoryItem, StockBatch, and inventory ledger rows from MongoDB.

export const clearInventoryFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ deleted: { items: number; batches: number; ledger: number } }> => {
    await connectDB();
    const [items, batches, ledger] = await Promise.all([
      InventoryItem.deleteMany({}),
      StockBatch.deleteMany({}),
      ErpRow.deleteMany({ moduleId: "inventory_ledger" }),
    ]);
    return {
      deleted: {
        items: items.deletedCount ?? 0,
        batches: batches.deletedCount ?? 0,
        ledger: ledger.deletedCount ?? 0,
      },
    };
  });
