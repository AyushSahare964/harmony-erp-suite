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
  productType: "MEDICINE" | "INJECTION" | "FOOD" | "ACCESSORY";
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
    composition?: string;
    strength?: string;
    dosageForm?: string;
    route?: string;
    storageCondition?: string;
    schedule?: string;
    controlledSubstance?: boolean;
  };
  foodDetails?: {
    targetSpecies?: string;
    foodType?: string;
    lifeStage?: string;
    flavour?: string;
    packSize?: string;
    dietaryIndication?: string;
  };
  accessoryDetails?: {
    accessoryType?: string;
    petSize?: string;
    material?: string;
    color?: string;
  };
  injectionDetails?: {
    composition?: string;
    strength?: string;
    route?: string;
    injectionSite?: string;
    vialSize?: string;
    withdrawalPeriod?: string;
    coldChainRequired?: boolean;
    storageCondition?: string;
    schedule?: string;
    controlledSubstance?: boolean;
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
  composition: z.string().default(""),
  strength: z.string().default(""),
  dosageForm: z.string().default(""),
  route: z.string().default(""),
  storageCondition: z.string().default(""),
  schedule: z.string().default(""),
  controlledSubstance: z.boolean().default(false),
}).partial();

const FoodDetailsZ = z.object({
  targetSpecies: z.string().default(""),
  foodType: z.string().default(""),
  lifeStage: z.string().default(""),
  flavour: z.string().default(""),
  packSize: z.string().default(""),
  dietaryIndication: z.string().default(""),
}).partial();

const AccessoryDetailsZ = z.object({
  accessoryType: z.string().default(""),
  petSize: z.string().default(""),
  material: z.string().default(""),
  color: z.string().default(""),
}).partial();

const InjectionDetailsZ = z.object({
  composition: z.string().default(""),
  strength: z.string().default(""),
  route: z.string().default(""),
  injectionSite: z.string().default(""),
  vialSize: z.string().default(""),
  withdrawalPeriod: z.string().default(""),
  coldChainRequired: z.boolean().default(false),
  storageCondition: z.string().default(""),
  schedule: z.string().default(""),
  controlledSubstance: z.boolean().default(false),
}).partial();

const InventoryItemInputZ = z.object({
  // Identity
  productType: z.enum(["MEDICINE", "INJECTION", "FOOD", "ACCESSORY"]).default("MEDICINE"),
  name:        z.string().min(1, "Item name is required"),
  genericName: z.string().default(""),
  brand:       z.string().default(""),
  manufacturer:z.string().default(""),
  description: z.string().default(""),
  category:    z.enum(["Medicine", "Injection", "Food", "Accessory", "Consumable", "Animal Food", "Animal Accessories"]),
  subGroup:    z.string().default(""),
  hasVariants: z.boolean().default(false),
  sku:         z.string().default(""),

  medicineDetails: MedicineDetailsZ.optional(),
  foodDetails: FoodDetailsZ.optional(),
  accessoryDetails: AccessoryDetailsZ.optional(),
  injectionDetails: InjectionDetailsZ.optional(),

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
  itemId:           z.string(),
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
  itemId:       z.string().optional().default(""),
  itemCode:     z.string(),
  itemName:     z.string().optional().default(""),
  batchId:      z.string().optional().default(""),
  batchCode:    z.string().optional().default(""),
  batchNo:      z.string().optional().default(""),
  movementType: z.enum(["adjustment_in", "adjustment_out", "expiry_writeoff", "damage_writeoff", "transfer"]),
  adjustedQty:  z.number().positive(),
  targetLocation:z.string().optional().default(""),
  referenceNo:  z.string().optional().default(""),
  reasonCode:   z.string().default("Other"),
  remarks:      z.string().optional().default(""),
  authorizedBy: z.string().optional().default(""),
  dateTime:     z.string().optional().default(""),
  actor:        z.string().optional().default("System"),
});

// ─── Serialization helper ───────────────────────────────────────────────────
function toPlain<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

// ─── Item-code prefix ───────────────────────────────────────────────────────
function productTypePrefix(pType: string | undefined): string {
  switch (pType) {
    case "FOOD": return "F";
    case "ACCESSORY": return "A";
    case "INJECTION": return "I";
    default: return "M";
  }
}

// ─── getItemsFn ───────────────────────────────────────────────────────────────

export const getItemsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      type: z.enum(["MEDICINE", "INJECTION", "FOOD", "ACCESSORY"]).optional(),
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
      type: z.enum(["MEDICINE", "INJECTION", "FOOD", "ACCESSORY"]).optional(),
    }).optional().parse(raw)
  )
  .handler(async ({ data }): Promise<string> => {
    await connectDB();
    const prefix = productTypePrefix(data?.type);
    return peekNextSeq("inventory_item_" + prefix, prefix, 4);
  });

// ─── addItemFn ────────────────────────────────────────────────────────────────

export const addItemFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => InventoryItemInputZ.parse(raw))
  .handler(async ({ data }): Promise<InventoryItemRow> => {
    await connectDB();
    const prefix = productTypePrefix(data.productType);
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
          batchNo: "OPENING-STOCK",
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

// ─── deleteItemFn ─────────────────────────────────────────────────────────────

export const deleteItemFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ itemCode: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();
    await InventoryItem.findOneAndDelete({ itemCode: data.itemCode });
    return { success: true };
  });

// ─── setItemStockFn ───────────────────────────────────────────────────────────
// Direct, manual stock-quantity override for the catalogue's inline "set stock" control.
// Distinct from addStockFn/adjustStockFn (which are GRN/reason-coded batch adjustments) —
// this just sets InventoryItem.currentStock to the given number and logs the delta.

export const setItemStockFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      itemCode: z.string().min(1),
      newStock: z.number().min(0, "Stock cannot be negative"),
      actor: z.string().optional(),
    }).parse(raw)
  )
  .handler(async ({ data }): Promise<InventoryItemRow> => {
    await connectDB();
    const item = await InventoryItem.findOne({ itemCode: data.itemCode });
    if (!item) throw new Error(`Item not found: ${data.itemCode}`);

    const previousStock = item.currentStock || 0;
    const delta = data.newStock - previousStock;
    item.currentStock = data.newStock;
    await item.save();

    if (delta !== 0) {
      await ErpRow.create({
        moduleId: "inventory_ledger",
        data: {
          id: `LEDGER-${Date.now()}`,
          medicineId: item.itemCode,
          medicineName: item.name,
          batchId: "",
          batchNo: "",
          movementType: delta > 0 ? "adjustment_in" : "adjustment_out",
          quantity: Math.abs(delta),
          sourceType: "MANUAL_ADJUSTMENT",
          sourceRef: "Catalogue quick edit",
          balanceAfter: data.newStock,
          actorName: data.actor || "Front Desk",
          createdAt: new Date().toISOString(),
        },
      });
    }

    return toPlain(item.toObject ? item.toObject() : item) as unknown as InventoryItemRow;
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

    // Update lastPurchaseRate and currentStock on the item
    await InventoryItem.findOneAndUpdate(
      { itemCode: data.itemCode },
      { lastPurchaseRate: data.purchasePricePerUnit, $inc: { currentStock: data.acceptedQty } }
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

    const isIn = data.movementType === "adjustment_in" || data.movementType === "transfer";
    const stockDelta = isIn ? data.adjustedQty : -data.adjustedQty;

    // Find the item
    const item = await InventoryItem.findOne({ itemCode: data.itemCode });
    if (!item) {
      throw new Error(`Item ${data.itemCode} not found in inventory`);
    }

    let batchDoc: any = null;

    if (data.batchId && data.batchId !== "DIRECT") {
      // batchCode (e.g. "B-0013") is the only identifier callers ever send — it's
      // what Batch.id is throughout the client. Matching against `_id` too looks more
      // defensive, but Mongoose eagerly casts every $or branch against the schema
      // before running the query, and a non-ObjectId string in an `_id` branch throws
      // a CastError that aborts the whole query — even though the batchCode branch
      // alone would have matched fine. So: batchCode only.
      batchDoc = await StockBatch.findOne({ batchCode: data.batchId });
      if (batchDoc) {
        const newBatchQty = isIn
          ? batchDoc.qty + data.adjustedQty
          : Math.max(0, batchDoc.qty - data.adjustedQty);
        batchDoc.qty = newBatchQty;
        if (newBatchQty === 0 && !isIn) {
          batchDoc.status = "Exhausted";
        }
        await batchDoc.save();
      }
    } else if (!isIn) {
      // If adjusting out without a specific batch, try FIFO across active batches
      const activeBatches = await StockBatch.find({
        itemCode: data.itemCode,
        status: "Active",
        qty: { $gt: 0 },
      }).sort({ expiryDate: 1 });

      let remainingToDeduct = data.adjustedQty;
      for (const b of activeBatches) {
        if (remainingToDeduct <= 0) break;
        const take = Math.min(b.qty, remainingToDeduct);
        b.qty -= take;
        remainingToDeduct -= take;
        if (b.qty === 0) {
          b.status = "Exhausted";
        }
        await b.save();
      }
    }

    // Keep InventoryItem.currentStock in sync
    const newStock = Math.max(0, (item.currentStock ?? 0) + stockDelta);
    item.currentStock = newStock;
    await item.save();

    const adjRef = data.referenceNo || (await nextSeq("stock_adjustment", "ADJ", 4));

    // Ledger entry in ErpRow
    await ErpRow.create({
      moduleId: "inventory_ledger",
      data: {
        id: await nextSeq("ledger_entry", "L", 4),
        medicineId: data.itemCode,
        medicineName: data.itemName || item.name,
        batchId: data.batchId || (batchDoc ? batchDoc.batchCode : "DIRECT"),
        batchNo: data.batchNo || (batchDoc ? batchDoc.batchNo : "ADJ-DIRECT"),
        movementType: data.movementType,
        quantity: data.adjustedQty,
        sourceType: "manual_adjustment",
        sourceRef: adjRef,
        balanceAfter: newStock,
        actorName: data.actor || "Staff",
        createdAt: data.dateTime || new Date().toISOString().replace("T", " ").slice(0, 16),
        reason: data.remarks ? `${data.reasonCode}: ${data.remarks}` : data.reasonCode,
      },
    });

    return { success: true, newQty: newStock, referenceNo: adjRef };
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
