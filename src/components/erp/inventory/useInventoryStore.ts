import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getItemsFn,
  addItemFn,
  updateItemFn,
  deactivateItemFn,
  toggleItemStatusFn,
  addStockFn,
  adjustStockFn,
  getBatchesFn,
  type InventoryItemRow,
  type StockBatchRow,
} from "@/lib/mongodb/serverFns/inventory";
import {
  ALL_SEED_ITEMS,
  type SeedItem,
  type MedicineDetails,
  type FoodDetails,
  type AccessoryDetails,
} from "./seedData";

// ─── Data Types ───────────────────────────────────────────────────────────────

export type ProductType = "MEDICINE" | "FOOD" | "ACCESSORY";
export type MedicineCategory = "Medicine" | "Food" | "Accessory" | "Consumable" | "Animal Food" | "Animal Accessories";
export type UnitOfMeasure =
  | "Tablet" | "ml" | "Vial" | "Box" | "Strip"
  | "Kg" | "Bottle" | "Unit" | "Piece" | "Gm" | "Litre";
export type ValuationMethod = "FEFO" | "FIFO" | "Moving Average";
export type MedicineStatus = "Active" | "Inactive";
export type BatchStatus = "Active" | "Exhausted" | "Rejected" | "Expired";

export interface UomConversion {
  uom: string;
  conversionFactor: number;
}

// ─── Extended Medicine (Item Master) ─────────────────────────────────────────

export interface Medicine {
  // Identity
  id: string;             // itemCode (M-0001 / F-0001 / A-0001)
  itemCode: string;
  sku?: string | undefined;
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  category: MedicineCategory;
  productType?: ProductType | undefined;
  subGroup: string;
  hasVariants: boolean;

  // Stock & Inventory
  unit: UnitOfMeasure;
  purchaseUom: string;
  salesUom: string;
  uomConversions: UomConversion[];
  maintainStock: boolean;
  valuationMethod: ValuationMethod;
  reorderLevel: number;
  reorderQty: number;
  safetyStock: number;
  currentStock?: number | undefined;
  minStockLevel?: number | undefined;
  storageLocation: string;
  batchTracking: boolean;
  serialTracking: boolean;
  allowNegativeStock: boolean;

  // Pricing
  defaultSalePrice: number;
  defaultPurchasePrice: number;
  minSalePrice: number;
  maxDiscountPct: number;
  valuationRate: number;
  lastPurchaseRate: number;
  mrp?: number | undefined;
  samplePriceNote?: string | undefined;

  // Category-specific details
  medicineDetails?: MedicineDetails | any;
  foodDetails?: FoodDetails | any;
  accessoryDetails?: AccessoryDetails | any;

  // Tax & Compliance
  gstRate: number;
  hsnCode: string;
  taxCategory: string;
  isZeroRated: boolean;
  isExempt: boolean;
  isImport: boolean;

  // Purchasing
  defaultSupplierId: string;
  defaultSupplierName: string;
  leadTimeDays: number;
  minOrderQty: number;
  purchaseAccount: string;
  expenseAccount: string;

  // Sales
  incomeAccount: string;
  costCenter: string;
  isSalesItem: boolean;
  allowAlternativeItem: boolean;

  // Meta
  status: MedicineStatus;
  createdAt: string;
  updatedAt?: string;
}

// ─── Extended Batch (GRN / Stock Batch) ──────────────────────────────────────

export interface Batch {
  id: string;             // batchCode (B-0001)
  batchCode: string;
  medicineId: string;     // itemCode
  itemCode: string;
  itemName: string;

  batchNo: string;
  manufacturingDate: string;
  expiryDate: string;

  supplierId: string;
  supplierName: string;
  purchaseOrderRef: string;
  invoiceBillNo: string;
  receivedDate: string;

  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason: string;
  qty: number;            // running balance

  purchasePrice: number;  // alias for purchasePricePerUnit
  purchasePricePerUnit: number;
  landingCost: number;
  landingCostPerUnit: number;
  gstOnPurchase: number;
  totalValue: number;

  storageLocation: string;
  qualityChecked: boolean;
  qcInspectorName: string;
  remarks: string;

  status: BatchStatus;
  createdAt: string;
}

export type MovementType =
  | "purchase_in"
  | "sale_out"
  | "return_in"
  | "adjustment_in"
  | "adjustment_out"
  | "expiry_writeoff"
  | "damage_writeoff"
  | "transfer";

export type SourceType =
  | "purchase"
  | "invoice"
  | "manual_bill"
  | "manual_adjustment"
  | "supplier_return";

export interface LedgerEntry {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNo: string;
  movementType: MovementType;
  quantity: number;
  sourceType: SourceType;
  sourceRef: string;
  balanceAfter: number;
  actorName: string;
  createdAt: string;
  reason?: string;
}

// ─── Helper: map InventoryItemRow → Medicine ─────────────────────────────────

function mapToMedicine(raw: InventoryItemRow): Medicine {
  const resolvedProductType: ProductType =
    (raw.productType as ProductType) ||
    (raw.category === "Food" || raw.category === "Animal Food"
      ? "FOOD"
      : raw.category === "Accessory" || raw.category === "Animal Accessories"
      ? "ACCESSORY"
      : "MEDICINE");

  return {
    id: raw.itemCode,
    itemCode: raw.itemCode,
    sku: raw.sku,
    name: raw.name,
    genericName: raw.genericName,
    brand: raw.brand,
    manufacturer: raw.manufacturer,
    description: raw.description,
    category: raw.category as MedicineCategory,
    productType: resolvedProductType,
    subGroup: raw.subGroup,
    hasVariants: raw.hasVariants,
    unit: raw.unit as UnitOfMeasure,
    purchaseUom: raw.purchaseUom,
    salesUom: raw.salesUom,
    uomConversions: (raw.uomConversions || []) as UomConversion[],
    maintainStock: raw.maintainStock,
    valuationMethod: raw.valuationMethod as ValuationMethod,
    reorderLevel: raw.reorderLevel,
    reorderQty: raw.reorderQty,
    safetyStock: raw.safetyStock,
    currentStock: raw.currentStock ?? 0,
    minStockLevel: raw.minStockLevel ?? raw.reorderLevel,
    storageLocation: raw.storageLocation,
    batchTracking: raw.batchTracking,
    serialTracking: raw.serialTracking,
    allowNegativeStock: raw.allowNegativeStock,
    defaultSalePrice: raw.defaultSalePrice,
    defaultPurchasePrice: raw.defaultPurchasePrice,
    minSalePrice: raw.minSalePrice,
    maxDiscountPct: raw.maxDiscountPct,
    valuationRate: raw.valuationRate,
    lastPurchaseRate: raw.lastPurchaseRate,
    mrp: raw.mrp ?? raw.defaultSalePrice,
    samplePriceNote: (raw as any).samplePriceNote,
    medicineDetails: raw.medicineDetails,
    foodDetails: raw.foodDetails,
    accessoryDetails: raw.accessoryDetails,
    gstRate: raw.gstRate,
    hsnCode: raw.hsnCode,
    taxCategory: raw.taxCategory,
    isZeroRated: raw.isZeroRated,
    isExempt: raw.isExempt,
    isImport: raw.isImport,
    defaultSupplierId: raw.defaultSupplierId,
    defaultSupplierName: raw.defaultSupplierName,
    leadTimeDays: raw.leadTimeDays,
    minOrderQty: raw.minOrderQty,
    purchaseAccount: raw.purchaseAccount,
    expenseAccount: raw.expenseAccount,
    incomeAccount: raw.incomeAccount,
    costCenter: raw.costCenter,
    isSalesItem: raw.isSalesItem,
    allowAlternativeItem: raw.allowAlternativeItem,
    status: raw.status as MedicineStatus,
    createdAt: raw.createdAt
      ? new Date(raw.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  };
}

// ─── Helper: map StockBatchRow → Batch ──────────────────────────────────────

function mapToBatch(raw: StockBatchRow): Batch {
  return {
    id: raw.batchCode,
    batchCode: raw.batchCode,
    medicineId: raw.itemCode,
    itemCode: raw.itemCode,
    itemName: raw.itemName,
    batchNo: raw.batchNo,
    manufacturingDate: raw.manufacturingDate,
    expiryDate: raw.expiryDate,
    supplierId: raw.supplierId,
    supplierName: raw.supplierName,
    purchaseOrderRef: raw.purchaseOrderRef,
    invoiceBillNo: raw.invoiceBillNo,
    receivedDate: raw.receivedDate,
    receivedQty: raw.receivedQty,
    acceptedQty: raw.acceptedQty,
    rejectedQty: raw.rejectedQty,
    rejectionReason: raw.rejectionReason,
    qty: raw.qty,
    purchasePrice: raw.purchasePricePerUnit,
    purchasePricePerUnit: raw.purchasePricePerUnit,
    landingCost: raw.landingCost,
    landingCostPerUnit: raw.landingCostPerUnit,
    gstOnPurchase: raw.gstOnPurchase,
    totalValue: raw.totalValue,
    storageLocation: raw.storageLocation,
    qualityChecked: raw.qualityChecked,
    qcInspectorName: raw.qcInspectorName,
    remarks: raw.remarks,
    status: raw.status as BatchStatus,
    createdAt: raw.createdAt
      ? new Date(raw.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface InventoryContextValue {
  medicines: Medicine[];
  medicinesList: Medicine[];
  foodList: Medicine[];
  accessoriesList: Medicine[];
  batches: Batch[];
  ledger: LedgerEntry[];
  loadingItems: boolean;

  addMedicine: (m: Omit<Medicine, "id" | "itemCode" | "createdAt" | "status">) => Promise<void>;
  updateMedicine: (itemCode: string, patch: Partial<Medicine>) => Promise<void>;
  deactivateMedicine: (itemCode: string) => Promise<void>;
  toggleStatus: (itemCode: string) => Promise<void>;

  addStock: (batchData: {
    itemCode: string;
    itemName: string;
    batchNo: string;
    manufacturingDate?: string;
    expiryDate: string;
    supplierId?: string;
    supplierName?: string;
    purchaseOrderRef?: string;
    invoiceBillNo?: string;
    receivedDate: string;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty?: number;
    rejectionReason?: string;
    purchasePricePerUnit: number;
    landingCost?: number;
    gstOnPurchase?: number;
    storageLocation?: string;
    qualityChecked?: boolean;
    qcInspectorName?: string;
    remarks?: string;
    actor: string;
  }) => Promise<void>;

  adjustStock: (data: {
    itemCode: string;
    itemName: string;
    batchId: string;
    batchCode: string;
    batchNo: string;
    movementType: "adjustment_in" | "adjustment_out" | "expiry_writeoff" | "damage_writeoff" | "transfer";
    adjustedQty: number;
    targetLocation?: string;
    referenceNo?: string;
    reasonCode: "Damage" | "Expiry" | "Pilferage" | "Count Error" | "Transfer" | "Other";
    remarks: string;
    authorizedBy?: string;
    dateTime: string;
    actor: string;
  }) => Promise<{ newQty: number; referenceNo: string }>;

  removeStock: (data: { medicineId: string; batchId: string; qty: number; reason: string; actor: string }) => void;
  recordSale: (data: { medicineId: string; qty: number; sourceRef: string; actor: string }) => { ok: boolean; error?: string };

  getTotalQty: (itemCode: string) => number;
  getBatches: (itemCode: string) => Batch[];
  getStockStatus: (itemCode: string) => "OK" | "Low" | "Out of Stock";
  getExpiryStatus: (expiryDate: string) => "safe" | "expiring-soon" | "critical" | "expired";

  refetchItems: () => Promise<void>;
  refetchBatches: (itemCode: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

// ─── Seed Batches (in-memory only, for immediate display) ─────────────────────
const SEED_BATCHES: Batch[] = [
  { id: "B-0001", batchCode: "B-0001", medicineId: "M-0001", itemCode: "M-0001", itemName: "Amoxicillin 250mg", batchNo: "AMX-2024-01", manufacturingDate: "", expiryDate: "2026-11-30", supplierId: "SUP-01", supplierName: "MedVet Distributors", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-01-12", receivedQty: 100, acceptedQty: 100, rejectedQty: 0, rejectionReason: "", qty: 42, purchasePrice: 16, purchasePricePerUnit: 16, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 12, totalValue: 1600, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-01-12" },
  { id: "B-0002", batchCode: "B-0002", medicineId: "M-0001", itemCode: "M-0001", itemName: "Amoxicillin 250mg", batchNo: "AMX-2024-02", manufacturingDate: "", expiryDate: "2026-08-20", supplierId: "SUP-01", supplierName: "MedVet Distributors", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-01-12", receivedQty: 50, acceptedQty: 50, rejectedQty: 0, rejectionReason: "", qty: 8, purchasePrice: 16, purchasePricePerUnit: 16, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 12, totalValue: 800, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-01-12" },
  { id: "B-0003", batchCode: "B-0003", medicineId: "M-0002", itemCode: "M-0002", itemName: "Rabies Vaccine 1ml", batchNo: "RBV-2025-01", manufacturingDate: "", expiryDate: "2026-09-15", supplierId: "SUP-02", supplierName: "BioPharm", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-04-02", receivedQty: 30, acceptedQty: 30, rejectedQty: 0, rejectionReason: "", qty: 12, purchasePrice: 340, purchasePricePerUnit: 340, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 10200, storageLocation: "Cold Storage", qualityChecked: true, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-04-02" },
  { id: "B-0004", batchCode: "B-0004", medicineId: "M-0003", itemCode: "M-0003", itemName: "IV Fluid RL 500ml", batchNo: "IVF-2025-03", manufacturingDate: "", expiryDate: "2027-03-01", supplierId: "SUP-03", supplierName: "CareSupplies", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-05-20", receivedQty: 48, acceptedQty: 48, rejectedQty: 0, rejectionReason: "", qty: 6, purchasePrice: 42, purchasePricePerUnit: 42, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 2016, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-05-20" },
  { id: "B-0005", batchCode: "B-0005", medicineId: "M-0004", itemCode: "M-0004", itemName: "Dexamethasone 4mg", batchNo: "DEX-2025-01", manufacturingDate: "", expiryDate: "2026-12-31", supplierId: "SUP-02", supplierName: "BioPharm", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-03-01", receivedQty: 28, acceptedQty: 28, rejectedQty: 0, rejectionReason: "", qty: 28, purchasePrice: 68, purchasePricePerUnit: 68, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 12, totalValue: 1904, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-03-01" },
  { id: "B-0006", batchCode: "B-0006", medicineId: "M-0005", itemCode: "M-0005", itemName: "Royal Canin Maxi 4kg", batchNo: "RC-2025-08", manufacturingDate: "", expiryDate: "2027-06-30", supplierId: "SUP-04", supplierName: "PetNutri", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-08-01", receivedQty: 18, acceptedQty: 18, rejectedQty: 0, rejectionReason: "", qty: 18, purchasePrice: 1400, purchasePricePerUnit: 1400, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 25200, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-08-01" },
  { id: "B-0007", batchCode: "B-0007", medicineId: "M-0006", itemCode: "M-0006", itemName: "Tick & Flea Collar (L)", batchNo: "TFC-2024-06", manufacturingDate: "", expiryDate: "2026-08-23", supplierId: "SUP-05", supplierName: "Supplier 05", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2024-06-01", receivedQty: 20, acceptedQty: 20, rejectedQty: 0, rejectionReason: "", qty: 7, purchasePrice: 220, purchasePricePerUnit: 220, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 18, totalValue: 4400, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2024-06-01" },
  { id: "B-0008", batchCode: "B-0008", medicineId: "M-0007", itemCode: "M-0007", itemName: "Deworming Syrup 30ml", batchNo: "DWS-2025-04", manufacturingDate: "", expiryDate: "2027-01-15", supplierId: "SUP-02", supplierName: "BioPharm", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-04-01", receivedQty: 25, acceptedQty: 25, rejectedQty: 0, rejectionReason: "", qty: 25, purchasePrice: 62, purchasePricePerUnit: 62, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 12, totalValue: 1550, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-04-01" },
  { id: "B-0009", batchCode: "B-0009", medicineId: "M-0008", itemCode: "M-0008", itemName: "IV Catheter 20G", batchNo: "IVC-2025-02", manufacturingDate: "", expiryDate: "2028-01-01", supplierId: "SUP-03", supplierName: "CareSupplies", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-06-01", receivedQty: 50, acceptedQty: 50, rejectedQty: 0, rejectionReason: "", qty: 0, purchasePrice: 30, purchasePricePerUnit: 30, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 12, totalValue: 1500, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Exhausted", createdAt: "2025-06-01" },
  { id: "B-0010", batchCode: "B-0010", medicineId: "M-0009", itemCode: "M-0009", itemName: "Metronidazole 200mg", batchNo: "MTZ-2025-01", manufacturingDate: "", expiryDate: "2027-05-31", supplierId: "SUP-01", supplierName: "MedVet Distributors", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-01-01", receivedQty: 180, acceptedQty: 180, rejectedQty: 0, rejectionReason: "", qty: 180, purchasePrice: 5, purchasePricePerUnit: 5, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 12, totalValue: 900, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-01-01" },
  { id: "B-0011", batchCode: "B-0011", medicineId: "M-0009", itemCode: "M-0009", itemName: "Metronidazole 200mg", batchNo: "MTZ-2024-12", manufacturingDate: "", expiryDate: "2026-08-19", supplierId: "SUP-01", supplierName: "MedVet Distributors", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2024-12-01", receivedQty: 40, acceptedQty: 40, rejectedQty: 0, rejectionReason: "", qty: 40, purchasePrice: 5, purchasePricePerUnit: 5, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 12, totalValue: 200, storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2024-12-01" },
  { id: "B-0012", batchCode: "B-0012", medicineId: "F-0001", itemCode: "F-0001", itemName: "Royal Canin Maxi Adult 4kg", batchNo: "RC-M-2025-01", manufacturingDate: "2025-01-01", expiryDate: "2027-01-01", supplierId: "SUP-04", supplierName: "PetNutri", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-08-01", receivedQty: 24, acceptedQty: 24, rejectedQty: 0, rejectionReason: "", qty: 24, purchasePrice: 1400, purchasePricePerUnit: 1400, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 33600, storageLocation: "Retail Shelf D1", qualityChecked: true, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-08-01" },
  { id: "B-0013", batchCode: "B-0013", medicineId: "F-0002", itemCode: "F-0002", itemName: "Pedigree Adult Chicken 3kg", batchNo: "PED-2025-07", manufacturingDate: "2025-07-01", expiryDate: "2026-07-01", supplierId: "SUP-04", supplierName: "PetNutri", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-07-15", receivedQty: 30, acceptedQty: 30, rejectedQty: 0, rejectionReason: "", qty: 30, purchasePrice: 680, purchasePricePerUnit: 680, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 20400, storageLocation: "Retail Shelf D1", qualityChecked: true, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-07-15" },
];

const SEED_LEDGER: LedgerEntry[] = [
  { id: "L-0001", medicineId: "M-0001", medicineName: "Amoxicillin 250mg", batchId: "B-0001", batchNo: "AMX-2024-01", movementType: "purchase_in", quantity: 100, sourceType: "purchase", sourceRef: "PO-2024-001", balanceAfter: 100, actorName: "Dr. Ananya Rao", createdAt: "2025-01-12 10:00" },
  { id: "L-0002", medicineId: "M-0001", medicineName: "Amoxicillin 250mg", batchId: "B-0001", batchNo: "AMX-2024-01", movementType: "sale_out", quantity: 58, sourceType: "invoice", sourceRef: "INV-20440", balanceAfter: 42, actorName: "Receptionist", createdAt: "2025-06-10 14:23" },
  { id: "L-0003", medicineId: "M-0002", medicineName: "Rabies Vaccine 1ml", batchId: "B-0003", batchNo: "RBV-2025-01", movementType: "purchase_in", quantity: 30, sourceType: "purchase", sourceRef: "PO-2025-004", balanceAfter: 30, actorName: "Dr. Ananya Rao", createdAt: "2025-04-02 09:00" },
  { id: "L-0004", medicineId: "M-0002", medicineName: "Rabies Vaccine 1ml", batchId: "B-0003", batchNo: "RBV-2025-01", movementType: "sale_out", quantity: 18, sourceType: "manual_bill", sourceRef: "MB-2025-112", balanceAfter: 12, actorName: "Receptionist", createdAt: "2026-07-15 11:30" },
  { id: "L-0005", medicineId: "M-0003", medicineName: "IV Fluid RL 500ml", batchId: "B-0004", batchNo: "IVF-2025-03", movementType: "purchase_in", quantity: 48, sourceType: "purchase", sourceRef: "PO-2025-009", balanceAfter: 48, actorName: "Dr. Ananya Rao", createdAt: "2025-05-20 09:00" },
  { id: "L-0006", medicineId: "M-0003", medicineName: "IV Fluid RL 500ml", batchId: "B-0004", batchNo: "IVF-2025-03", movementType: "adjustment_out", quantity: 42, sourceType: "manual_adjustment", sourceRef: "ADJ-001", balanceAfter: 6, actorName: "Dr. Ananya Rao", createdAt: "2026-08-01 16:00", reason: "Wastage — broken during handling" },
  { id: "L-0007", medicineId: "M-0008", medicineName: "IV Catheter 20G", batchId: "B-0009", batchNo: "IVC-2025-02", movementType: "purchase_in", quantity: 50, sourceType: "purchase", sourceRef: "PO-2025-011", balanceAfter: 50, actorName: "Dr. Ananya Rao", createdAt: "2025-06-01 10:00" },
  { id: "L-0008", medicineId: "M-0008", medicineName: "IV Catheter 20G", batchId: "B-0009", batchNo: "IVC-2025-02", movementType: "sale_out", quantity: 50, sourceType: "invoice", sourceRef: "INV-20460", balanceAfter: 0, actorName: "Receptionist", createdAt: "2026-08-14 13:45" },
];

// ─── Fallback Medicines (All 52 seed items mapped) ───────────────────────────

const FALLBACK_MEDICINES: Medicine[] = ALL_SEED_ITEMS.map((item) => ({
  id: item.itemCode,
  itemCode: item.itemCode,
  sku: item.sku,
  name: item.name,
  genericName: item.genericName,
  brand: item.brand,
  manufacturer: item.manufacturer,
  description: item.description,
  category: (item.productType === "MEDICINE" ? "Medicine" : item.productType === "FOOD" ? "Food" : "Accessory") as MedicineCategory,
  productType: item.productType,
  subGroup: item.subGroup,
  hasVariants: item.hasVariants,
  unit: item.unit as UnitOfMeasure,
  purchaseUom: item.purchaseUom,
  salesUom: item.salesUom,
  uomConversions: (item.uomConversions || []) as UomConversion[],
  maintainStock: item.maintainStock,
  valuationMethod: item.valuationMethod as ValuationMethod,
  reorderLevel: item.reorderLevel,
  reorderQty: item.reorderQty,
  safetyStock: item.safetyStock,
  currentStock: item.currentStock,
  minStockLevel: item.minStockLevel,
  storageLocation: item.storageLocation,
  batchTracking: item.batchTracking,
  serialTracking: item.serialTracking,
  allowNegativeStock: item.allowNegativeStock,
  defaultSalePrice: item.defaultSalePrice,
  defaultPurchasePrice: item.defaultPurchasePrice,
  minSalePrice: item.minSalePrice,
  maxDiscountPct: item.maxDiscountPct,
  valuationRate: item.valuationRate,
  lastPurchaseRate: item.lastPurchaseRate,
  mrp: item.mrp,
  samplePriceNote: item.samplePriceNote,
  gstRate: item.gstRate,
  hsnCode: item.hsnCode,
  taxCategory: item.taxCategory,
  isZeroRated: item.isZeroRated,
  isExempt: item.isExempt,
  isImport: item.isImport,
  defaultSupplierId: item.defaultSupplierId,
  defaultSupplierName: item.defaultSupplierName,
  leadTimeDays: item.leadTimeDays,
  minOrderQty: item.minOrderQty,
  purchaseAccount: item.purchaseAccount,
  expenseAccount: item.expenseAccount,
  incomeAccount: item.incomeAccount,
  costCenter: item.costCenter,
  isSalesItem: item.isSalesItem,
  allowAlternativeItem: item.allowAlternativeItem,
  medicineDetails: item.medicineDetails,
  foodDetails: item.foodDetails,
  accessoryDetails: item.accessoryDetails,
  status: item.status as MedicineStatus,
  createdAt: "2026-08-23",
}));

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>(FALLBACK_MEDICINES);
  const [batches, setBatches] = useState<Batch[]>(SEED_BATCHES);
  const [ledger, setLedger] = useState<LedgerEntry[]>(SEED_LEDGER);
  const [loadingItems, setLoadingItems] = useState(true);

  // ── Load items from MongoDB on mount ────────────────────────────────────────
  const refetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const raw = await getItemsFn();
      if (raw && raw.length > 0) {
        setMedicines(raw.map(mapToMedicine));
      }
    } catch (err) {
      console.warn("[InventoryProvider] Falling back to local data due to network:", err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    void refetchItems();
  }, [refetchItems]);

  // ── Refetch batches for a specific item from MongoDB ─────────────────────────
  const refetchBatches = useCallback(async (itemCode: string) => {
    try {
      const raw = await getBatchesFn({ data: { itemCode } });
      const mapped = raw.map(mapToBatch);
      setBatches((prev) => {
        const others = prev.filter((b) => b.itemCode !== itemCode);
        return [...others, ...mapped];
      });
    } catch (err) {
      console.error("[InventoryProvider] Failed to load batches:", err);
    }
  }, []);

  // ── Computed helpers ──────────────────────────────────────────────────────
  const getTotalQty = useCallback(
    (itemCode: string) => {
      const activeBatches = batches.filter((b) => b.itemCode === itemCode && b.status === "Active");
      if (activeBatches.length > 0) {
        return activeBatches.reduce((s, b) => s + b.qty, 0);
      }
      const med = medicines.find((m) => m.itemCode === itemCode);
      return med?.currentStock ?? 0;
    },
    [batches, medicines]
  );

  const getBatchesForItem = useCallback(
    (itemCode: string) =>
      batches
        .filter((b) => b.itemCode === itemCode)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [batches]
  );

  const getStockStatus = useCallback(
    (itemCode: string): "OK" | "Low" | "Out of Stock" => {
      const med = medicines.find((m) => m.itemCode === itemCode);
      const qty = getTotalQty(itemCode);
      if (qty === 0) return "Out of Stock";
      if (med && qty <= med.reorderLevel) return "Low";
      return "OK";
    },
    [medicines, getTotalQty]
  );

  const getExpiryStatus = useCallback(
    (expiryDate: string): "safe" | "expiring-soon" | "critical" | "expired" => {
      const today = new Date();
      const expiry = new Date(expiryDate);
      const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
      if (diffDays < 0) return "expired";
      if (diffDays <= 7) return "critical";
      if (diffDays <= 30) return "expiring-soon";
      return "safe";
    },
    []
  );

  // ── Category Lists ────────────────────────────────────────────────────────
  const medicinesList = useMemo(
    () => medicines.filter((m) => m.productType === "MEDICINE" || (!m.productType && m.category === "Medicine")),
    [medicines]
  );
  const foodList = useMemo(
    () => medicines.filter((m) => m.productType === "FOOD" || m.category === "Food" || m.category === "Animal Food"),
    [medicines]
  );
  const accessoriesList = useMemo(
    () => medicines.filter((m) => m.productType === "ACCESSORY" || m.category === "Accessory" || m.category === "Animal Accessories"),
    [medicines]
  );

  // ── CRUD — Items ─────────────────────────────────────────────────────────
  const addMedicine = useCallback(
    async (m: Omit<Medicine, "id" | "itemCode" | "createdAt" | "status">) => {
      const tempId = `TEMP-${Date.now()}`;
      const tempItem: Medicine = {
        ...m,
        id: tempId,
        itemCode: tempId,
        status: "Active",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setMedicines((prev) => [tempItem, ...prev]);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await addItemFn({ data: m as any });
        const newItem = mapToMedicine(raw);
        setMedicines((prev) => prev.map((x) => (x.id === tempId ? newItem : x)));

        // If initial stock > 0, generate opening ledger
        if ((m.currentStock ?? 0) > 0) {
          const openEntry: LedgerEntry = {
            id: `L-OPEN-${Date.now()}`,
            medicineId: newItem.itemCode,
            medicineName: newItem.name,
            batchId: "OPENING",
            batchNo: "OPENING-STOCK",
            movementType: "purchase_in",
            quantity: m.currentStock!,
            sourceType: "manual_adjustment",
            sourceRef: "OPENING-BAL",
            balanceAfter: m.currentStock!,
            actorName: "System",
            createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
            reason: "Initial opening stock recorded on item creation",
          };
          setLedger((prev) => [openEntry, ...prev]);
        }
      } catch (err) {
        setMedicines((prev) => prev.filter((x) => x.id !== tempId));
        throw err;
      }
    },
    []
  );

  const updateMedicine = useCallback(
    async (itemCode: string, patch: Partial<Medicine>) => {
      setMedicines((prev) =>
        prev.map((m) => (m.itemCode === itemCode ? { ...m, ...patch } : m))
      );
      try {
        await updateItemFn({ data: { itemCode, patch: patch as Record<string, unknown> } });
      } catch (err) {
        void refetchItems();
        throw err;
      }
    },
    [refetchItems]
  );

  const deactivateMedicine = useCallback(
    async (itemCode: string) => {
      setMedicines((prev) =>
        prev.map((m) => (m.itemCode === itemCode ? { ...m, status: "Inactive" } : m))
      );
      try {
        await deactivateItemFn({ data: { itemCode } });
      } catch (err) {
        void refetchItems();
        throw err;
      }
    },
    [refetchItems]
  );

  const toggleStatus = useCallback(
    async (itemCode: string) => {
      const item = medicines.find((m) => m.itemCode === itemCode);
      if (!item) return;
      const newStatus = item.status === "Active" ? "Inactive" : "Active";
      setMedicines((prev) =>
        prev.map((m) => (m.itemCode === itemCode ? { ...m, status: newStatus } : m))
      );
      try {
        await toggleItemStatusFn({ data: { itemCode } });
      } catch (err) {
        void refetchItems();
        throw err;
      }
    },
    [medicines, refetchItems]
  );

  // ── CRUD — Stock ─────────────────────────────────────────────────────────
  const addStock = useCallback(
    async (batchData: Parameters<InventoryContextValue["addStock"]>[0]) => {
      try {
        const raw = await addStockFn({
          data: {
            itemId: batchData.itemCode,
            itemCode: batchData.itemCode,
            itemName: batchData.itemName,
            batchNo: batchData.batchNo,
            manufacturingDate: batchData.manufacturingDate ?? "",
            expiryDate: batchData.expiryDate,
            supplierId: batchData.supplierId ?? "",
            supplierName: batchData.supplierName ?? "",
            purchaseOrderRef: batchData.purchaseOrderRef ?? "",
            invoiceBillNo: batchData.invoiceBillNo ?? "",
            receivedDate: batchData.receivedDate,
            receivedQty: batchData.receivedQty,
            acceptedQty: batchData.acceptedQty,
            rejectedQty: batchData.rejectedQty ?? 0,
            rejectionReason: batchData.rejectionReason ?? "",
            purchasePricePerUnit: batchData.purchasePricePerUnit,
            landingCost: batchData.landingCost ?? 0,
            gstOnPurchase: batchData.gstOnPurchase ?? 0,
            storageLocation: batchData.storageLocation ?? "",
            qualityChecked: batchData.qualityChecked ?? false,
            qcInspectorName: batchData.qcInspectorName ?? "",
            remarks: batchData.remarks ?? "",
            actor: batchData.actor,
          },
        });
        const newBatch = mapToBatch(raw);
        setBatches((prev) => [...prev, newBatch]);

        // Update medicine currentStock
        setMedicines((prev) =>
          prev.map((m) =>
            m.itemCode === batchData.itemCode
              ? { ...m, currentStock: (m.currentStock ?? 0) + batchData.acceptedQty }
              : m
          )
        );

        // Add ledger entry locally
        const prevBal = medicines.find((m) => m.itemCode === batchData.itemCode)?.currentStock ?? 0;
        const entry: LedgerEntry = {
          id: `L-${Date.now()}`,
          medicineId: batchData.itemCode,
          medicineName: batchData.itemName,
          batchId: newBatch.id,
          batchNo: batchData.batchNo,
          movementType: "purchase_in",
          quantity: batchData.acceptedQty,
          sourceType: "purchase",
          sourceRef: batchData.purchaseOrderRef || `GRN-${Date.now()}`,
          balanceAfter: prevBal + batchData.acceptedQty,
          actorName: batchData.actor,
          createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
        };
        setLedger((prev) => [entry, ...prev]);
      } catch (err) {
        console.error("[addStock] Failed:", err);
        throw err;
      }
    },
    [medicines]
  );

  const adjustStock = useCallback(
    async (data: Parameters<InventoryContextValue["adjustStock"]>[0]) => {
      const result = await adjustStockFn({ data });
      // Update batch qty locally
      setBatches((prev) =>
        prev.map((b) =>
          b.id === data.batchId || b.batchCode === data.batchId
            ? { ...b, qty: result.newQty }
            : b
        )
      );
      const isPositive = data.movementType === "adjustment_in" || data.movementType === "transfer";
      const delta = isPositive ? data.adjustedQty : -data.adjustedQty;
      setMedicines((prev) =>
        prev.map((m) =>
          m.itemCode === data.itemCode
            ? { ...m, currentStock: Math.max(0, (m.currentStock ?? 0) + delta) }
            : m
        )
      );

      // Add ledger entry
      const entry: LedgerEntry = {
        id: `L-${Date.now()}`,
        medicineId: data.itemCode,
        medicineName: data.itemName,
        batchId: data.batchId,
        batchNo: data.batchNo,
        movementType: data.movementType,
        quantity: data.adjustedQty,
        sourceType: "manual_adjustment",
        sourceRef: result.referenceNo,
        balanceAfter: result.newQty,
        actorName: data.actor,
        createdAt: data.dateTime,
        reason: `${data.reasonCode}: ${data.remarks}`,
      };
      setLedger((prev) => [entry, ...prev]);
      return result;
    },
    []
  );

  // ── Legacy shims (used by existing child components) ─────────────────────
  const removeStock = useCallback(
    (data: { medicineId: string; batchId: string; qty: number; reason: string; actor: string }) => {
      void adjustStock({
        itemCode: data.medicineId,
        itemName: medicines.find((m) => m.id === data.medicineId)?.name ?? "Unknown",
        batchId: data.batchId,
        batchCode: data.batchId,
        batchNo: batches.find((b) => b.id === data.batchId)?.batchNo ?? "",
        movementType: "adjustment_out",
        adjustedQty: data.qty,
        reasonCode: "Other",
        remarks: data.reason,
        dateTime: new Date().toISOString().replace("T", " ").slice(0, 16),
        actor: data.actor,
      });
    },
    [adjustStock, medicines, batches]
  );

  const recordSale = useCallback(
    (data: { medicineId: string; qty: number; sourceRef: string; actor: string }): { ok: boolean; error?: string } => {
      const availableBatches = batches
        .filter((b) => b.itemCode === data.medicineId && b.qty > 0 && b.status === "Active")
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const batchAvail = availableBatches.reduce((s, b) => s + b.qty, 0);
      const med = medicines.find((m) => m.itemCode === data.medicineId);
      const totalAvail = batchAvail > 0 ? batchAvail : (med?.currentStock ?? 0);

      if (totalAvail < data.qty && !med?.allowNegativeStock) {
        return { ok: false, error: `Only ${totalAvail} units available` };
      }

      // Optimistic local update (real sale goes through billing module)
      if (availableBatches.length > 0) {
        let remaining = data.qty;
        const updated = batches.map((b) => {
          if (remaining <= 0 || b.itemCode !== data.medicineId || b.qty === 0 || b.status !== "Active") return b;
          const take = Math.min(b.qty, remaining);
          remaining -= take;
          return { ...b, qty: b.qty - take };
        });
        setBatches(updated);
      }

      const newStock = Math.max(0, (med?.currentStock ?? totalAvail) - data.qty);
      setMedicines((prev) =>
        prev.map((m) =>
          m.itemCode === data.medicineId
            ? { ...m, currentStock: newStock }
            : m
        )
      );

      const entry: LedgerEntry = {
        id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        medicineId: data.medicineId,
        medicineName: med?.name || "Item",
        batchId: availableBatches[0]?.id || "DIRECT",
        batchNo: availableBatches[0]?.batchNo || "DIRECT",
        movementType: "sale_out",
        quantity: data.qty,
        sourceType: "invoice",
        sourceRef: data.sourceRef,
        balanceAfter: newStock,
        actorName: data.actor || "System",
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      };
      setLedger((prev) => [entry, ...prev]);

      return { ok: true };
    },
    [batches, medicines]
  );

  const value = useMemo<InventoryContextValue>(
    () => ({
      medicines,
      medicinesList,
      foodList,
      accessoriesList,
      batches,
      ledger,
      loadingItems,
      addMedicine,
      updateMedicine,
      deactivateMedicine,
      toggleStatus,
      addStock,
      adjustStock,
      removeStock,
      recordSale,
      getTotalQty,
      getBatches: getBatchesForItem,
      getStockStatus,
      getExpiryStatus,
      refetchItems,
      refetchBatches,
    }),
    [
      medicines, medicinesList, foodList, accessoriesList, batches, ledger, loadingItems,
      addMedicine, updateMedicine, deactivateMedicine, toggleStatus,
      addStock, adjustStock, removeStock, recordSale,
      getTotalQty, getBatchesForItem, getStockStatus, getExpiryStatus,
      refetchItems, refetchBatches,
    ]
  );

  return React.createElement(InventoryContext.Provider, { value }, children);
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    return {
      medicines: [],
      medicinesList: [],
      foodList: [],
      accessoriesList: [],
      batches: [],
      ledger: [],
      loadingItems: false,
      addMedicine: async () => {},
      updateMedicine: async () => {},
      deactivateMedicine: async () => {},
      toggleStatus: async () => {},
      addStock: async () => {},
      adjustStock: async (data: any) => ({ newQty: 0, referenceNo: "" }),
      removeStock: () => {},
      recordSale: () => ({ ok: false, error: "Not inside InventoryProvider" }),
      getTotalQty: () => 0,
      getBatches: () => [],
      getStockStatus: () => "OK",
      getExpiryStatus: () => "safe",
      refetchItems: async () => {},
      refetchBatches: async () => {},
    };
  }
  return ctx;
}

