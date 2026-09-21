/**
 * InventoryItem — full Item Master document for Harmony ERP.
 * Covers all fields across identity, stock, pricing, tax, purchasing, and sales tabs.
 */

import mongoose, { Schema, model } from "mongoose";

export type MedicineCategory =
  "Medicine" | "Injection" | "Food" | "Accessory" | "Consumable" | "Animal Food" | "Animal Accessories";
export type UnitOfMeasure =
  "Tablet" | "ml" | "Vial" | "Box" | "Strip" | "Kg" | "Bottle" | "Unit" | "Piece" | "Gm" | "Litre";
export type ValuationMethod = "FEFO" | "FIFO" | "Moving Average";
export type ItemStatus = "Active" | "Inactive";

export interface UomConversion {
  uom: string;
  conversionFactor: number;
}

export type ProductType = "MEDICINE" | "INJECTION" | "FOOD" | "ACCESSORY";

export interface MedicineDetails {
  composition?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  storageCondition?: string;
  schedule?: string;
  controlledSubstance?: boolean;
}

export interface FoodDetails {
  targetSpecies?: string;
  foodType?: string;
  lifeStage?: string;
  flavour?: string;
  packSize?: string;
  dietaryIndication?: string;
}

export interface AccessoryDetails {
  accessoryType?: string;
  petSize?: string;
  material?: string;
  color?: string;
}

export interface InjectionDetails {
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
}

export interface IInventoryItem {
  // ── Identity ──────────────────────────────────────────────────────────────
  itemCode: string; // auto-generated: M-0001, F-0001, A-0001
  productType: ProductType;
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  category: MedicineCategory;
  subGroup: string;
  hasVariants: boolean;
  sku: string;

  // Category specific details (1:1 with Product Master)
  medicineDetails?: MedicineDetails;
  foodDetails?: FoodDetails;
  accessoryDetails?: AccessoryDetails;
  injectionDetails?: InjectionDetails;

  // ── Stock & Inventory ─────────────────────────────────────────────────────
  unit: UnitOfMeasure;
  purchaseUom: string;
  salesUom: string;
  uomConversions: UomConversion[];
  maintainStock: boolean;
  valuationMethod: ValuationMethod;
  currentStock: number;
  minStockLevel: number;
  reorderLevel: number;
  reorderQty: number;
  safetyStock: number;
  storageLocation: string;
  batchTracking: boolean;
  serialTracking: boolean;
  allowNegativeStock: boolean;

  // ── Pricing ───────────────────────────────────────────────────────────────
  defaultSalePrice: number;
  defaultPurchasePrice: number;
  mrp: number;
  minSalePrice: number;
  maxDiscountPct: number;
  valuationRate: number;
  lastPurchaseRate: number;

  // ── Tax & Compliance ──────────────────────────────────────────────────────
  /** GOODS carries HSN + batch/stock; SERVICE carries SAC, no stock, zero cost. */
  itemClass?: "GOODS" | "SERVICE";
  /** Services Accounting Code — used instead of hsnCode when itemClass is SERVICE. */
  sacCode?: string;
  gstRate: number;
  hsnCode: string;
  taxCategory: string;
  isZeroRated: boolean;
  isExempt: boolean;
  isImport: boolean;
  /** defaultSalePrice already includes GST (MRP-style pricing) when true. */
  priceInclusive?: boolean;
  /** Schedule H / H1 prescription drug — logged in the prescriber register on sale. */
  isScheduleH?: boolean;

  // ── Purchasing ────────────────────────────────────────────────────────────
  defaultSupplierId: string;
  defaultSupplierName: string;
  leadTimeDays: number;
  minOrderQty: number;
  purchaseAccount: string;
  expenseAccount: string;

  // ── Sales ─────────────────────────────────────────────────────────────────
  incomeAccount: string;
  costCenter: string;
  isSalesItem: boolean;
  allowAlternativeItem: boolean;

  // ── Meta ──────────────────────────────────────────────────────────────────
  status: ItemStatus;
  tenantId?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryItemDocument = IInventoryItem & mongoose.Document;

const uomConversionSchema = new Schema<UomConversion>(
  {
    uom: { type: String, required: true },
    conversionFactor: { type: Number, required: true, default: 1 },
  },
  { _id: false },
);

const medicineDetailsSchema = new Schema<MedicineDetails>(
  {
    composition: { type: String, default: "" },
    strength: { type: String, default: "" },
    dosageForm: { type: String, default: "" },
    route: { type: String, default: "" },
    storageCondition: { type: String, default: "" },
    schedule: { type: String, default: "" },
    controlledSubstance: { type: Boolean, default: false },
  },
  { _id: false },
);

const foodDetailsSchema = new Schema<FoodDetails>(
  {
    targetSpecies: { type: String, default: "" },
    foodType: { type: String, default: "" },
    lifeStage: { type: String, default: "" },
    flavour: { type: String, default: "" },
    packSize: { type: String, default: "" },
    dietaryIndication: { type: String, default: "" },
  },
  { _id: false },
);

const accessoryDetailsSchema = new Schema<AccessoryDetails>(
  {
    accessoryType: { type: String, default: "" },
    petSize: { type: String, default: "" },
    material: { type: String, default: "" },
    color: { type: String, default: "" },
  },
  { _id: false },
);

const injectionDetailsSchema = new Schema<InjectionDetails>(
  {
    composition: { type: String, default: "" },
    strength: { type: String, default: "" },
    route: { type: String, default: "" },
    injectionSite: { type: String, default: "" },
    vialSize: { type: String, default: "" },
    withdrawalPeriod: { type: String, default: "" },
    coldChainRequired: { type: Boolean, default: false },
    storageCondition: { type: String, default: "" },
    schedule: { type: String, default: "" },
    controlledSubstance: { type: Boolean, default: false },
  },
  { _id: false },
);

const inventoryItemSchema = new Schema<InventoryItemDocument>(
  {
    // Identity
    itemCode: { type: String, required: true, unique: true, index: true },
    productType: {
      type: String,
      enum: ["MEDICINE", "INJECTION", "FOOD", "ACCESSORY"],
      default: "MEDICINE",
      index: true,
    },
    name: { type: String, required: true },
    genericName: { type: String, default: "" },
    brand: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    description: { type: String, default: "" },
    category: {
      type: String,
      required: true,
      enum: ["Medicine", "Injection", "Food", "Accessory", "Consumable", "Animal Food", "Animal Accessories"],
    },
    subGroup: { type: String, default: "" },
    hasVariants: { type: Boolean, default: false },
    sku: { type: String, default: "", index: true },

    medicineDetails: { type: medicineDetailsSchema, default: () => ({}) },
    foodDetails: { type: foodDetailsSchema, default: () => ({}) },
    accessoryDetails: { type: accessoryDetailsSchema, default: () => ({}) },
    injectionDetails: { type: injectionDetailsSchema, default: () => ({}) },

    // Stock & Inventory
    unit: { type: String, required: true },
    purchaseUom: { type: String, default: "" },
    salesUom: { type: String, default: "" },
    uomConversions: { type: [uomConversionSchema], default: [] },
    maintainStock: { type: Boolean, default: true },
    valuationMethod: { type: String, enum: ["FEFO", "FIFO", "Moving Average"], default: "FEFO" },
    currentStock: { type: Number, default: 0 },
    minStockLevel: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 10 },
    reorderQty: { type: Number, default: 20 },
    safetyStock: { type: Number, default: 0 },
    storageLocation: { type: String, default: "" },
    batchTracking: { type: Boolean, default: true },
    serialTracking: { type: Boolean, default: false },
    allowNegativeStock: { type: Boolean, default: false },

    // Pricing
    defaultSalePrice: { type: Number, required: true, default: 0 },
    defaultPurchasePrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    minSalePrice: { type: Number, default: 0 },
    maxDiscountPct: { type: Number, default: 0 },
    valuationRate: { type: Number, default: 0 },
    lastPurchaseRate: { type: Number, default: 0 },

    // Tax & Compliance
    itemClass: { type: String, enum: ["GOODS", "SERVICE"], default: "GOODS", index: true },
    sacCode: { type: String, default: "" },
    gstRate: { type: Number, default: 12 },
    hsnCode: { type: String, default: "" },
    taxCategory: { type: String, default: "" },
    isZeroRated: { type: Boolean, default: false },
    isExempt: { type: Boolean, default: false },
    isImport: { type: Boolean, default: false },
    priceInclusive: { type: Boolean, default: false },
    isScheduleH: { type: Boolean, default: false, index: true },

    // Purchasing
    defaultSupplierId: { type: String, default: "" },
    defaultSupplierName: { type: String, default: "" },
    leadTimeDays: { type: Number, default: 7 },
    minOrderQty: { type: Number, default: 1 },
    purchaseAccount: { type: String, default: "" },
    expenseAccount: { type: String, default: "" },

    // Sales
    incomeAccount: { type: String, default: "" },
    costCenter: { type: String, default: "" },
    isSalesItem: { type: Boolean, default: true },
    allowAlternativeItem: { type: Boolean, default: false },

    // Meta
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    tenantId: { type: String, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "inventory_items" },
);

inventoryItemSchema.index({ productType: 1, status: 1 });
inventoryItemSchema.index({ category: 1, status: 1 });
inventoryItemSchema.index({ name: "text", genericName: "text" });

// `mongoose.models` caches the compiled schema for the lifetime of the Node process — a Vite
// dev-server HMR reload of this file does NOT re-register it. After changing any field on the
// schema above, fully restart `npm run dev`; otherwise writes silently keep using the old shape
// (fields not in the stale cached schema get dropped, with no error).
export const InventoryItem: mongoose.Model<InventoryItemDocument> =
  (mongoose.models["InventoryItem"] as mongoose.Model<InventoryItemDocument>) ??
  model<InventoryItemDocument>("InventoryItem", inventoryItemSchema);
