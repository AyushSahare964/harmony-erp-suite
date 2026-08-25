/**
 * InventoryItem — full Item Master document for Harmony ERP.
 * Covers all fields across identity, stock, pricing, tax, purchasing, and sales tabs.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

export type MedicineCategory = "Medicine" | "Food" | "Accessory" | "Consumable";
export type UnitOfMeasure =
  | "Tablet"
  | "ml"
  | "Vial"
  | "Box"
  | "Strip"
  | "Kg"
  | "Bottle"
  | "Unit"
  | "Piece"
  | "Gm"
  | "Litre";
export type ValuationMethod = "FEFO" | "FIFO" | "Moving Average";
export type ItemStatus = "Active" | "Inactive";

export interface UomConversion {
  uom: string;
  conversionFactor: number;
}

export interface IInventoryItem {
  // ── Identity ──────────────────────────────────────────────────────────────
  itemCode: string;       // auto-generated: M-0001
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  category: MedicineCategory;
  subGroup: string;
  hasVariants: boolean;

  // ── Stock & Inventory ─────────────────────────────────────────────────────
  unit: UnitOfMeasure;
  purchaseUom: string;
  salesUom: string;
  uomConversions: UomConversion[];
  maintainStock: boolean;
  valuationMethod: ValuationMethod;
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
  minSalePrice: number;
  maxDiscountPct: number;
  valuationRate: number;
  lastPurchaseRate: number;

  // ── Tax & Compliance ──────────────────────────────────────────────────────
  gstRate: number;
  hsnCode: string;
  taxCategory: string;
  isZeroRated: boolean;
  isExempt: boolean;
  isImport: boolean;

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
  { _id: false }
);

const inventoryItemSchema = new Schema<InventoryItemDocument>(
  {
    // Identity
    itemCode:       { type: String, required: true, unique: true, index: true },
    name:           { type: String, required: true },
    genericName:    { type: String, default: "" },
    brand:          { type: String, default: "" },
    manufacturer:   { type: String, default: "" },
    description:    { type: String, default: "" },
    category:       { type: String, required: true, enum: ["Medicine", "Food", "Accessory", "Consumable"] },
    subGroup:       { type: String, default: "" },
    hasVariants:    { type: Boolean, default: false },

    // Stock & Inventory
    unit:               { type: String, required: true },
    purchaseUom:        { type: String, default: "" },
    salesUom:           { type: String, default: "" },
    uomConversions:     { type: [uomConversionSchema], default: [] },
    maintainStock:      { type: Boolean, default: true },
    valuationMethod:    { type: String, enum: ["FEFO", "FIFO", "Moving Average"], default: "FEFO" },
    reorderLevel:       { type: Number, default: 10 },
    reorderQty:         { type: Number, default: 20 },
    safetyStock:        { type: Number, default: 0 },
    storageLocation:    { type: String, default: "" },
    batchTracking:      { type: Boolean, default: true },
    serialTracking:     { type: Boolean, default: false },
    allowNegativeStock: { type: Boolean, default: false },

    // Pricing
    defaultSalePrice:     { type: Number, required: true, default: 0 },
    defaultPurchasePrice: { type: Number, default: 0 },
    minSalePrice:         { type: Number, default: 0 },
    maxDiscountPct:       { type: Number, default: 0 },
    valuationRate:        { type: Number, default: 0 },
    lastPurchaseRate:     { type: Number, default: 0 },

    // Tax & Compliance
    gstRate:      { type: Number, default: 12 },
    hsnCode:      { type: String, default: "" },
    taxCategory:  { type: String, default: "" },
    isZeroRated:  { type: Boolean, default: false },
    isExempt:     { type: Boolean, default: false },
    isImport:     { type: Boolean, default: false },

    // Purchasing
    defaultSupplierId:   { type: String, default: "" },
    defaultSupplierName: { type: String, default: "" },
    leadTimeDays:        { type: Number, default: 7 },
    minOrderQty:         { type: Number, default: 1 },
    purchaseAccount:     { type: String, default: "" },
    expenseAccount:      { type: String, default: "" },

    // Sales
    incomeAccount:        { type: String, default: "" },
    costCenter:           { type: String, default: "" },
    isSalesItem:          { type: Boolean, default: true },
    allowAlternativeItem: { type: Boolean, default: false },

    // Meta
    status:    { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    tenantId:  { type: String, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "inventory_items" }
);

inventoryItemSchema.index({ category: 1, status: 1 });
inventoryItemSchema.index({ name: "text", genericName: "text" });

export const InventoryItem: mongoose.Model<InventoryItemDocument> =
  (mongoose.models["InventoryItem"] as mongoose.Model<InventoryItemDocument>) ??
  model<InventoryItemDocument>("InventoryItem", inventoryItemSchema);
