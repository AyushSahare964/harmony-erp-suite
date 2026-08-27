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
import { nextSeq, peekNextSeq, parseSeqNum } from "@/lib/mongodb/serverFns/counters";

/** Returns the current max numeric portion of all itemCodes in the collection. */
async function maxInventorySeq(): Promise<number> {
  const last = await InventoryItem.findOne({}, { itemCode: 1 })
    .sort({ itemCode: -1 })
    .lean();
  if (!last?.itemCode) return 0;
  return parseSeqNum(last.itemCode as string, "M");
}

// ─── Concrete serializable return types ───────────────────────────────────────

export interface InventoryItemRow {
  itemCode: string; name: string; genericName: string; brand: string;
  manufacturer: string; description: string; category: string; subGroup: string;
  hasVariants: boolean; unit: string; purchaseUom: string; salesUom: string;
  uomConversions: { uom: string; conversionFactor: number }[];
  maintainStock: boolean; valuationMethod: string; reorderLevel: number;
  reorderQty: number; safetyStock: number; storageLocation: string;
  batchTracking: boolean; serialTracking: boolean; allowNegativeStock: boolean;
  defaultSalePrice: number; defaultPurchasePrice: number; minSalePrice: number;
  maxDiscountPct: number; valuationRate: number; lastPurchaseRate: number;
  gstRate: number; hsnCode: string; taxCategory: string; isZeroRated: boolean;
  isExempt: boolean; isImport: boolean; defaultSupplierId: string;
  defaultSupplierName: string; leadTimeDays: number; minOrderQty: number;
  purchaseAccount: string; expenseAccount: string; incomeAccount: string;
  costCenter: string; isSalesItem: boolean; allowAlternativeItem: boolean;
  status: string; createdAt?: string | undefined;
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

const InventoryItemInputZ = z.object({
  // Identity
  name:        z.string().min(1, "Item name is required"),
  genericName: z.string().default(""),
  brand:       z.string().default(""),
  manufacturer:z.string().default(""),
  description: z.string().default(""),
  category:    z.enum(["Medicine", "Food", "Accessory", "Consumable", "Animal Food", "Animal Accessories"]),
  subGroup:    z.string().default(""),
  hasVariants: z.boolean().default(false),

  // Stock
  unit:               z.string().min(1, "Unit of measure is required"),
  purchaseUom:        z.string().default(""),
  salesUom:           z.string().default(""),
  uomConversions:     z.array(UomConversionZ).default([]),
  maintainStock:      z.boolean().default(true),
  valuationMethod:    z.enum(["FEFO", "FIFO", "Moving Average"]).default("FEFO"),
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

const SEED_ITEMS = [
  { itemCode: "M-0001", name: "Amoxicillin 250mg", genericName: "Amoxicillin", brand: "", manufacturer: "", description: "", category: "Medicine" as const, subGroup: "", hasVariants: false, unit: "Tablet" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 50, reorderQty: 100, safetyStock: 20, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 24, defaultPurchasePrice: 16, minSalePrice: 18, maxDiscountPct: 10, valuationRate: 16, lastPurchaseRate: 16, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-01", defaultSupplierName: "MedVet Distributors", leadTimeDays: 7, minOrderQty: 50, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0002", name: "Rabies Vaccine 1ml", genericName: "Rabies glycoprotein vaccine", brand: "", manufacturer: "", description: "", category: "Medicine" as const, subGroup: "", hasVariants: false, unit: "Vial" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 20, reorderQty: 30, safetyStock: 5, storageLocation: "Cold Storage", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 480, defaultPurchasePrice: 340, minSalePrice: 380, maxDiscountPct: 5, valuationRate: 340, lastPurchaseRate: 340, gstRate: 5, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-02", defaultSupplierName: "BioPharm", leadTimeDays: 14, minOrderQty: 10, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0003", name: "IV Fluid RL 500ml", genericName: "Ringer's Lactate", brand: "", manufacturer: "", description: "", category: "Medicine" as const, subGroup: "", hasVariants: false, unit: "Bottle" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 30, reorderQty: 60, safetyStock: 10, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 65, defaultPurchasePrice: 42, minSalePrice: 50, maxDiscountPct: 10, valuationRate: 42, lastPurchaseRate: 42, gstRate: 5, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-03", defaultSupplierName: "CareSupplies", leadTimeDays: 3, minOrderQty: 24, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0004", name: "Dexamethasone 4mg", genericName: "Dexamethasone", brand: "", manufacturer: "", description: "", category: "Medicine" as const, subGroup: "", hasVariants: false, unit: "Vial" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 15, reorderQty: 30, safetyStock: 5, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 95, defaultPurchasePrice: 68, minSalePrice: 75, maxDiscountPct: 10, valuationRate: 68, lastPurchaseRate: 68, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-02", defaultSupplierName: "BioPharm", leadTimeDays: 7, minOrderQty: 10, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0005", name: "Royal Canin Maxi 4kg", genericName: "Canine adult maintenance diet", brand: "Royal Canin", manufacturer: "Royal Canin", description: "", category: "Food" as const, subGroup: "", hasVariants: false, unit: "Box" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 10, reorderQty: 20, safetyStock: 3, storageLocation: "", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 1850, defaultPurchasePrice: 1400, minSalePrice: 1600, maxDiscountPct: 5, valuationRate: 1400, lastPurchaseRate: 1400, gstRate: 5, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-04", defaultSupplierName: "PetNutri", leadTimeDays: 7, minOrderQty: 5, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0006", name: "Tick & Flea Collar (L)", genericName: "Permethrin collar", brand: "", manufacturer: "", description: "", category: "Accessory" as const, subGroup: "", hasVariants: false, unit: "Box" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 10, reorderQty: 20, safetyStock: 3, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 320, defaultPurchasePrice: 220, minSalePrice: 260, maxDiscountPct: 10, valuationRate: 220, lastPurchaseRate: 220, gstRate: 18, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "Supplier 05", leadTimeDays: 10, minOrderQty: 5, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0007", name: "Deworming Syrup 30ml", genericName: "Pyrantel pamoate", brand: "", manufacturer: "", description: "", category: "Medicine" as const, subGroup: "", hasVariants: false, unit: "Bottle" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 20, reorderQty: 40, safetyStock: 5, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 95, defaultPurchasePrice: 62, minSalePrice: 75, maxDiscountPct: 10, valuationRate: 62, lastPurchaseRate: 62, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-02", defaultSupplierName: "BioPharm", leadTimeDays: 7, minOrderQty: 12, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0008", name: "IV Catheter 20G", genericName: "Peripheral IV catheter", brand: "", manufacturer: "", description: "", category: "Consumable" as const, subGroup: "", hasVariants: false, unit: "Box" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 40, reorderQty: 100, safetyStock: 10, storageLocation: "", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 45, defaultPurchasePrice: 30, minSalePrice: 35, maxDiscountPct: 10, valuationRate: 30, lastPurchaseRate: 30, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-03", defaultSupplierName: "CareSupplies", leadTimeDays: 5, minOrderQty: 20, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0009", name: "Metronidazole 200mg", genericName: "Metronidazole", brand: "", manufacturer: "", description: "", category: "Medicine" as const, subGroup: "", hasVariants: false, unit: "Tablet" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 100, reorderQty: 200, safetyStock: 30, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 8, defaultPurchasePrice: 5, minSalePrice: 6, maxDiscountPct: 10, valuationRate: 5, lastPurchaseRate: 5, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-01", defaultSupplierName: "MedVet Distributors", leadTimeDays: 7, minOrderQty: 100, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0010", name: "Grooming Shampoo 500ml", genericName: "Medicated pet shampoo", brand: "", manufacturer: "", description: "", category: "Accessory" as const, subGroup: "", hasVariants: false, unit: "Bottle" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO" as const, reorderLevel: 8, reorderQty: 15, safetyStock: 2, storageLocation: "", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 390, defaultPurchasePrice: 260, minSalePrice: 320, maxDiscountPct: 10, valuationRate: 260, lastPurchaseRate: 260, gstRate: 18, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "Supplier 05", leadTimeDays: 7, minOrderQty: 6, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0011", name: "Ergonomic Padded Dog Harness (L)", genericName: "No-pull canine chest harness", brand: "PawShield", manufacturer: "PetCare Gear", description: "Reflective breathable padded harness for medium-large breeds", category: "Accessory" as const, subGroup: "Gear", hasVariants: true, unit: "Piece" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO" as const, reorderLevel: 5, reorderQty: 15, safetyStock: 2, storageLocation: "Retail Shelf A3", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 1250, defaultPurchasePrice: 750, minSalePrice: 1050, maxDiscountPct: 10, valuationRate: 750, lastPurchaseRate: 750, gstRate: 18, hsnCode: "42010000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "PetCare Gear India", leadTimeDays: 5, minOrderQty: 5, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Pharmacy", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0012", name: "Nylon Training Leash 6ft (Reflective)", genericName: "Heavy-duty dog walking leash", brand: "PawShield", manufacturer: "PetCare Gear", description: "Shock absorbing padded handle with metal carabiner", category: "Accessory" as const, subGroup: "Gear", hasVariants: false, unit: "Piece" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO" as const, reorderLevel: 10, reorderQty: 25, safetyStock: 3, storageLocation: "Retail Shelf A3", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 450, defaultPurchasePrice: 220, minSalePrice: 380, maxDiscountPct: 10, valuationRate: 220, lastPurchaseRate: 220, gstRate: 18, hsnCode: "42010000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "PetCare Gear India", leadTimeDays: 5, minOrderQty: 10, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Pharmacy", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0013", name: "Hooded Feline Litter Box (Anti-Odour)", genericName: "Cat litter box with carbon filter", brand: "PurrClean", manufacturer: "CleanPet Tech", description: "Enclosed privacy litter box with door flap and scoop", category: "Accessory" as const, subGroup: "Hygiene", hasVariants: false, unit: "Unit" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO" as const, reorderLevel: 4, reorderQty: 10, safetyStock: 1, storageLocation: "Retail Shelf C1", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 1850, defaultPurchasePrice: 1100, minSalePrice: 1550, maxDiscountPct: 5, valuationRate: 1100, lastPurchaseRate: 1100, gstRate: 18, hsnCode: "39249090", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "CleanPet Tech", leadTimeDays: 7, minOrderQty: 3, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Pharmacy", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0014", name: "Orthopedic Memory Foam Pet Bed (XL)", genericName: "Joint support orthopedic pet mattress", brand: "ComfyPaws", manufacturer: "SleepWell Pets", description: "Waterproof lining with washable plush cover for arthritic pets", category: "Accessory" as const, subGroup: "Comfort", hasVariants: true, unit: "Piece" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO" as const, reorderLevel: 3, reorderQty: 8, safetyStock: 1, storageLocation: "Retail Display Front", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 3200, defaultPurchasePrice: 1900, minSalePrice: 2800, maxDiscountPct: 5, valuationRate: 1900, lastPurchaseRate: 1900, gstRate: 18, hsnCode: "94049000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "SleepWell Pets", leadTimeDays: 7, minOrderQty: 2, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Pharmacy", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
  { itemCode: "M-0015", name: "Stainless Steel Anti-Skid Feeding Bowl", genericName: "Heavy duty non-tip pet bowl", brand: "DinePaws", manufacturer: "PetKitchen", description: "Rust-proof hygienic feeding bowl with rubber ring", category: "Accessory" as const, subGroup: "Feeding", hasVariants: false, unit: "Unit" as const, purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO" as const, reorderLevel: 8, reorderQty: 20, safetyStock: 2, storageLocation: "Retail Shelf B2", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 650, defaultPurchasePrice: 350, minSalePrice: 520, maxDiscountPct: 10, valuationRate: 350, lastPurchaseRate: 350, gstRate: 18, hsnCode: "73239390", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "PetKitchen Supplies", leadTimeDays: 5, minOrderQty: 6, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Pharmacy", isSalesItem: true, allowAlternativeItem: false, status: "Active" as const },
];


// ─── getItemsFn ───────────────────────────────────────────────────────────────

export const getItemsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<InventoryItemRow[]> => {
    await connectDB();

    // Upsert seed items by itemCode so we never get E11000 on repeated startups
    const count = await InventoryItem.countDocuments();
    if (count === 0) {
      const bulkOps = SEED_ITEMS.map((item) => ({
        updateOne: {
          filter: { itemCode: item.itemCode },
          update: { $setOnInsert: item as unknown as Record<string, unknown> },
          upsert: true,
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await InventoryItem.bulkWrite(bulkOps as any[], { ordered: false });
    }

    const docs = await InventoryItem.find().sort({ itemCode: 1 }).lean();
    return toPlain(docs) as unknown as InventoryItemRow[];
  });

// ─── peekItemCodeFn ───────────────────────────────────────────────────────────

export const peekItemCodeFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<string> => {
    await connectDB();
    // Always preview based on the actual highest itemCode in the collection
    return peekNextSeq("inventory_item", "M", 4, maxInventorySeq);
  });

// ─── addItemFn ────────────────────────────────────────────────────────────────

export const addItemFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => InventoryItemInputZ.parse(raw))
  .handler(async ({ data }): Promise<InventoryItemRow> => {
    await connectDB();
    // Sync counter from actual max then increment — prevents any clash
    const itemCode = await nextSeq("inventory_item", "M", 4, maxInventorySeq);
    const newItem = await InventoryItem.create({ ...(data as unknown as Record<string, unknown>), itemCode });
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
    const updated = await InventoryItem.findOneAndUpdate(
      { itemCode: data.itemCode },
      { $set: data.patch },
      { returnDocument: "after" }
    ).lean();
    if (!updated) throw new Error(`Item not found: ${data.itemCode}`);
    return toPlain(updated) as unknown as InventoryItemRow;
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
