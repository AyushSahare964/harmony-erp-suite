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
  addStockFn,
  adjustStockFn,
  getBatchesFn,
  type InventoryItemRow,
  type StockBatchRow,
} from "@/lib/mongodb/serverFns/inventory";

// ─── Data Types ───────────────────────────────────────────────────────────────

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
  id: string;             // itemCode (M-0001)
  itemCode: string;
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  category: MedicineCategory;
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
  return {
    id: raw.itemCode,
    itemCode: raw.itemCode,
    name: raw.name,
    genericName: raw.genericName,
    brand: raw.brand,
    manufacturer: raw.manufacturer,
    description: raw.description,
    category: raw.category as MedicineCategory,
    subGroup: raw.subGroup,
    hasVariants: raw.hasVariants,
    unit: raw.unit as UnitOfMeasure,
    purchaseUom: raw.purchaseUom,
    salesUom: raw.salesUom,
    uomConversions: raw.uomConversions as UomConversion[],
    maintainStock: raw.maintainStock,
    valuationMethod: raw.valuationMethod as ValuationMethod,
    reorderLevel: raw.reorderLevel,
    reorderQty: raw.reorderQty,
    safetyStock: raw.safetyStock,
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
  batches: Batch[];
  ledger: LedgerEntry[];
  loadingItems: boolean;

  addMedicine: (m: Omit<Medicine, "id" | "itemCode" | "createdAt" | "status">) => Promise<void>;
  updateMedicine: (itemCode: string, patch: Partial<Medicine>) => Promise<void>;
  deactivateMedicine: (itemCode: string) => Promise<void>;

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

  // Legacy aliases (used by existing components)
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
// These are the legacy batch records for the seeded items. When users add real
// batches via the GRN form they are stored in MongoDB.
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
  // ── Animal Food ────────────────────────────────────────────────────────────
  { id: "B-0012", batchCode: "B-0012", medicineId: "M-0016", itemCode: "M-0016", itemName: "Royal Canin Maxi Adult 4kg", batchNo: "RC-M-2025-01", manufacturingDate: "2025-01-01", expiryDate: "2027-01-01", supplierId: "SUP-04", supplierName: "PetNutri", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-08-01", receivedQty: 24, acceptedQty: 24, rejectedQty: 0, rejectionReason: "", qty: 24, purchasePrice: 1400, purchasePricePerUnit: 1400, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 33600, storageLocation: "Retail Shelf D1", qualityChecked: true, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-08-01" },
  { id: "B-0013", batchCode: "B-0013", medicineId: "M-0017", itemCode: "M-0017", itemName: "Pedigree Adult Chicken 3kg", batchNo: "PED-2025-07", manufacturingDate: "2025-07-01", expiryDate: "2026-07-01", supplierId: "SUP-04", supplierName: "PetNutri", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-07-15", receivedQty: 30, acceptedQty: 30, rejectedQty: 0, rejectionReason: "", qty: 30, purchasePrice: 680, purchasePricePerUnit: 680, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 20400, storageLocation: "Retail Shelf D1", qualityChecked: true, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-07-15" },
  { id: "B-0014", batchCode: "B-0014", medicineId: "M-0018", itemCode: "M-0018", itemName: "Hills Science Diet Kitten 1.58kg", batchNo: "HSD-2025-08", manufacturingDate: "2025-06-01", expiryDate: "2027-06-01", supplierId: "SUP-04", supplierName: "PetNutri", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-08-10", receivedQty: 20, acceptedQty: 20, rejectedQty: 0, rejectionReason: "", qty: 20, purchasePrice: 1850, purchasePricePerUnit: 1850, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 37000, storageLocation: "Retail Shelf D2", qualityChecked: true, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-08-10" },
  { id: "B-0015", batchCode: "B-0015", medicineId: "M-0019", itemCode: "M-0019", itemName: "Whiskas Ocean Fish 1.2kg", batchNo: "WHK-2025-07", manufacturingDate: "2025-07-01", expiryDate: "2026-07-01", supplierId: "SUP-04", supplierName: "PetNutri", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-07-20", receivedQty: 36, acceptedQty: 36, rejectedQty: 0, rejectionReason: "", qty: 36, purchasePrice: 480, purchasePricePerUnit: 480, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 5, totalValue: 17280, storageLocation: "Retail Shelf D2", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-07-20" },
  // ── Animal Accessories ──────────────────────────────────────────────────────
  { id: "B-0016", batchCode: "B-0016", medicineId: "M-0020", itemCode: "M-0020", itemName: "Ergonomic Padded Dog Harness (L)", batchNo: "EPH-2025-05", manufacturingDate: "", expiryDate: "2030-01-01", supplierId: "SUP-05", supplierName: "PetCare Gear India", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-05-01", receivedQty: 15, acceptedQty: 15, rejectedQty: 0, rejectionReason: "", qty: 15, purchasePrice: 750, purchasePricePerUnit: 750, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 18, totalValue: 11250, storageLocation: "Retail Shelf A3", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-05-01" },
  { id: "B-0017", batchCode: "B-0017", medicineId: "M-0021", itemCode: "M-0021", itemName: "Nylon Training Leash 6ft (Reflective)", batchNo: "NTL-2025-06", manufacturingDate: "", expiryDate: "2030-01-01", supplierId: "SUP-05", supplierName: "PetCare Gear India", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-06-01", receivedQty: 25, acceptedQty: 25, rejectedQty: 0, rejectionReason: "", qty: 25, purchasePrice: 220, purchasePricePerUnit: 220, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 18, totalValue: 5500, storageLocation: "Retail Shelf A3", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-06-01" },
  { id: "B-0018", batchCode: "B-0018", medicineId: "M-0022", itemCode: "M-0022", itemName: "Orthopedic Memory Foam Pet Bed (XL)", batchNo: "OPB-2025-04", manufacturingDate: "", expiryDate: "2030-01-01", supplierId: "SUP-05", supplierName: "SleepWell Pets", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-04-15", receivedQty: 8, acceptedQty: 8, rejectedQty: 0, rejectionReason: "", qty: 8, purchasePrice: 1900, purchasePricePerUnit: 1900, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 18, totalValue: 15200, storageLocation: "Retail Display Front", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-04-15" },
  { id: "B-0019", batchCode: "B-0019", medicineId: "M-0023", itemCode: "M-0023", itemName: "Stainless Steel Anti-Skid Feeding Bowl", batchNo: "SSB-2025-06", manufacturingDate: "", expiryDate: "2030-01-01", supplierId: "SUP-05", supplierName: "PetKitchen Supplies", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-06-10", receivedQty: 20, acceptedQty: 20, rejectedQty: 0, rejectionReason: "", qty: 20, purchasePrice: 350, purchasePricePerUnit: 350, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 18, totalValue: 7000, storageLocation: "Retail Shelf B2", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-06-10" },
  { id: "B-0020", batchCode: "B-0020", medicineId: "M-0024", itemCode: "M-0024", itemName: "Hooded Feline Litter Box (Anti-Odour)", batchNo: "HLB-2025-05", manufacturingDate: "", expiryDate: "2030-01-01", supplierId: "SUP-05", supplierName: "CleanPet Tech", purchaseOrderRef: "", invoiceBillNo: "", receivedDate: "2025-05-20", receivedQty: 10, acceptedQty: 10, rejectedQty: 0, rejectionReason: "", qty: 10, purchasePrice: 1100, purchasePricePerUnit: 1100, landingCost: 0, landingCostPerUnit: 0, gstOnPurchase: 18, totalValue: 11000, storageLocation: "Retail Shelf C1", qualityChecked: false, qcInspectorName: "", remarks: "", status: "Active", createdAt: "2025-05-20" },
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

// ─── Provider ─────────────────────────────────────────────────────────────────

const FALLBACK_MEDICINES: Medicine[] = [
  { id: "M-0001", itemCode: "M-0001", name: "Amoxicillin 250mg", genericName: "Amoxicillin", brand: "", manufacturer: "", description: "", category: "Medicine", subGroup: "", hasVariants: false, unit: "Tablet", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 50, reorderQty: 100, safetyStock: 20, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 24, defaultPurchasePrice: 16, minSalePrice: 18, maxDiscountPct: 10, valuationRate: 16, lastPurchaseRate: 16, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-01", defaultSupplierName: "MedVet Distributors", leadTimeDays: 7, minOrderQty: 50, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0002", itemCode: "M-0002", name: "Rabies Vaccine 1ml", genericName: "Rabies glycoprotein vaccine", brand: "", manufacturer: "", description: "", category: "Medicine", subGroup: "", hasVariants: false, unit: "Vial", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 20, reorderQty: 30, safetyStock: 5, storageLocation: "Cold Storage", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 480, defaultPurchasePrice: 340, minSalePrice: 380, maxDiscountPct: 5, valuationRate: 340, lastPurchaseRate: 340, gstRate: 5, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-02", defaultSupplierName: "BioPharm", leadTimeDays: 14, minOrderQty: 10, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0003", itemCode: "M-0003", name: "IV Fluid RL 500ml", genericName: "Ringer's Lactate", brand: "", manufacturer: "", description: "", category: "Medicine", subGroup: "", hasVariants: false, unit: "Bottle", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 30, reorderQty: 60, safetyStock: 10, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 65, defaultPurchasePrice: 42, minSalePrice: 50, maxDiscountPct: 10, valuationRate: 42, lastPurchaseRate: 42, gstRate: 5, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-03", defaultSupplierName: "CareSupplies", leadTimeDays: 3, minOrderQty: 24, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0004", itemCode: "M-0004", name: "Dexamethasone 4mg", genericName: "Dexamethasone", brand: "", manufacturer: "", description: "", category: "Medicine", subGroup: "", hasVariants: false, unit: "Vial", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 15, reorderQty: 30, safetyStock: 5, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 95, defaultPurchasePrice: 68, minSalePrice: 75, maxDiscountPct: 10, valuationRate: 68, lastPurchaseRate: 68, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-02", defaultSupplierName: "BioPharm", leadTimeDays: 7, minOrderQty: 10, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0005", itemCode: "M-0005", name: "Royal Canin Maxi 4kg", genericName: "Canine adult maintenance diet", brand: "Royal Canin", manufacturer: "Royal Canin", description: "", category: "Food", subGroup: "", hasVariants: false, unit: "Box", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 10, reorderQty: 20, safetyStock: 3, storageLocation: "", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 1850, defaultPurchasePrice: 1400, minSalePrice: 1600, maxDiscountPct: 5, valuationRate: 1400, lastPurchaseRate: 1400, gstRate: 5, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-04", defaultSupplierName: "PetNutri", leadTimeDays: 7, minOrderQty: 5, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0006", itemCode: "M-0006", name: "Tick & Flea Collar (L)", genericName: "Permethrin collar", brand: "", manufacturer: "", description: "", category: "Accessory", subGroup: "", hasVariants: false, unit: "Box", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 10, reorderQty: 20, safetyStock: 3, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 320, defaultPurchasePrice: 220, minSalePrice: 260, maxDiscountPct: 10, valuationRate: 220, lastPurchaseRate: 220, gstRate: 18, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "Supplier 05", leadTimeDays: 10, minOrderQty: 5, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0007", itemCode: "M-0007", name: "Deworming Syrup 30ml", genericName: "Pyrantel pamoate", brand: "", manufacturer: "", description: "", category: "Medicine", subGroup: "", hasVariants: false, unit: "Bottle", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 20, reorderQty: 40, safetyStock: 5, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 95, defaultPurchasePrice: 62, minSalePrice: 75, maxDiscountPct: 10, valuationRate: 62, lastPurchaseRate: 62, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-02", defaultSupplierName: "BioPharm", leadTimeDays: 7, minOrderQty: 12, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0008", itemCode: "M-0008", name: "IV Catheter 20G", genericName: "Peripheral IV catheter", brand: "", manufacturer: "", description: "", category: "Consumable", subGroup: "", hasVariants: false, unit: "Box", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 40, reorderQty: 100, safetyStock: 10, storageLocation: "", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 45, defaultPurchasePrice: 30, minSalePrice: 35, maxDiscountPct: 10, valuationRate: 30, lastPurchaseRate: 30, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-03", defaultSupplierName: "CareSupplies", leadTimeDays: 5, minOrderQty: 20, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0009", itemCode: "M-0009", name: "Metronidazole 200mg", genericName: "Metronidazole", brand: "", manufacturer: "", description: "", category: "Medicine", subGroup: "", hasVariants: false, unit: "Tablet", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 100, reorderQty: 200, safetyStock: 30, storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 8, defaultPurchasePrice: 5, minSalePrice: 6, maxDiscountPct: 10, valuationRate: 5, lastPurchaseRate: 5, gstRate: 12, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-01", defaultSupplierName: "MedVet Distributors", leadTimeDays: 7, minOrderQty: 100, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2026-08-23" },
  { id: "M-0010", itemCode: "M-0010", name: "Grooming Shampoo 500ml", genericName: "Medicated pet shampoo", brand: "", manufacturer: "", description: "", category: "Accessory", subGroup: "", hasVariants: false, unit: "Bottle", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 8, reorderQty: 15, safetyStock: 2, storageLocation: "", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 390, defaultPurchasePrice: 260, minSalePrice: 320, maxDiscountPct: 10, valuationRate: 260, lastPurchaseRate: 260, gstRate: 18, hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "Supplier 05", leadTimeDays: 7, minOrderQty: 6, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false, status: "Inactive", createdAt: "2026-08-23" },
  // ── Animal Food ────────────────────────────────────────────────────────────
  { id: "M-0016", itemCode: "M-0016", name: "Royal Canin Maxi Adult 4kg", genericName: "Canine adult maintenance diet", brand: "Royal Canin", manufacturer: "Royal Canin SAS", description: "Complete dry dog food for large breed adult dogs", category: "Animal Food", subGroup: "Dog Food", hasVariants: false, unit: "Box", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 8, reorderQty: 20, safetyStock: 3, storageLocation: "Retail Shelf D1", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 1850, defaultPurchasePrice: 1400, minSalePrice: 1600, maxDiscountPct: 5, valuationRate: 1400, lastPurchaseRate: 1400, gstRate: 5, hsnCode: "23091000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-04", defaultSupplierName: "PetNutri", leadTimeDays: 7, minOrderQty: 5, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-08-01" },
  { id: "M-0017", itemCode: "M-0017", name: "Pedigree Adult Chicken 3kg", genericName: "Canine adult chicken recipe", brand: "Pedigree", manufacturer: "Mars Petcare", description: "Complete nutrition dog food with real chicken", category: "Animal Food", subGroup: "Dog Food", hasVariants: false, unit: "Box", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 10, reorderQty: 25, safetyStock: 4, storageLocation: "Retail Shelf D1", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 890, defaultPurchasePrice: 680, minSalePrice: 750, maxDiscountPct: 5, valuationRate: 680, lastPurchaseRate: 680, gstRate: 5, hsnCode: "23091000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-04", defaultSupplierName: "PetNutri", leadTimeDays: 5, minOrderQty: 10, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-07-15" },
  { id: "M-0018", itemCode: "M-0018", name: "Hills Science Diet Kitten 1.58kg", genericName: "Feline kitten development diet", brand: "Hill's", manufacturer: "Hill's Pet Nutrition", description: "Precise nutrition scientifically formulated for kittens", category: "Animal Food", subGroup: "Cat Food", hasVariants: false, unit: "Box", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 6, reorderQty: 15, safetyStock: 2, storageLocation: "Retail Shelf D2", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 2400, defaultPurchasePrice: 1850, minSalePrice: 2100, maxDiscountPct: 5, valuationRate: 1850, lastPurchaseRate: 1850, gstRate: 5, hsnCode: "23091000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-04", defaultSupplierName: "PetNutri", leadTimeDays: 10, minOrderQty: 3, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-08-10" },
  { id: "M-0019", itemCode: "M-0019", name: "Whiskas Ocean Fish 1.2kg", genericName: "Feline adult ocean fish recipe", brand: "Whiskas", manufacturer: "Mars Petcare", description: "Complete dry cat food with ocean fish", category: "Animal Food", subGroup: "Cat Food", hasVariants: false, unit: "Box", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FEFO", reorderLevel: 12, reorderQty: 30, safetyStock: 5, storageLocation: "Retail Shelf D2", batchTracking: true, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 650, defaultPurchasePrice: 480, minSalePrice: 550, maxDiscountPct: 5, valuationRate: 480, lastPurchaseRate: 480, gstRate: 5, hsnCode: "23091000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-04", defaultSupplierName: "PetNutri", leadTimeDays: 5, minOrderQty: 12, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-07-20" },
  // ── Animal Accessories ──────────────────────────────────────────────────────
  { id: "M-0020", itemCode: "M-0020", name: "Ergonomic Padded Dog Harness (L)", genericName: "No-pull canine chest harness", brand: "PawShield", manufacturer: "PetCare Gear", description: "Reflective breathable padded harness for medium-large breeds", category: "Animal Accessories", subGroup: "Gear", hasVariants: true, unit: "Piece", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO", reorderLevel: 5, reorderQty: 15, safetyStock: 2, storageLocation: "Retail Shelf A3", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 1250, defaultPurchasePrice: 750, minSalePrice: 1050, maxDiscountPct: 10, valuationRate: 750, lastPurchaseRate: 750, gstRate: 18, hsnCode: "42010000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "PetCare Gear India", leadTimeDays: 5, minOrderQty: 5, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-05-01" },
  { id: "M-0021", itemCode: "M-0021", name: "Nylon Training Leash 6ft (Reflective)", genericName: "Heavy-duty dog walking leash", brand: "PawShield", manufacturer: "PetCare Gear", description: "Shock absorbing padded handle with metal carabiner", category: "Animal Accessories", subGroup: "Gear", hasVariants: false, unit: "Piece", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO", reorderLevel: 8, reorderQty: 20, safetyStock: 3, storageLocation: "Retail Shelf A3", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 450, defaultPurchasePrice: 220, minSalePrice: 380, maxDiscountPct: 10, valuationRate: 220, lastPurchaseRate: 220, gstRate: 18, hsnCode: "42010000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "PetCare Gear India", leadTimeDays: 5, minOrderQty: 10, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-06-01" },
  { id: "M-0022", itemCode: "M-0022", name: "Orthopedic Memory Foam Pet Bed (XL)", genericName: "Joint support orthopedic pet mattress", brand: "ComfyPaws", manufacturer: "SleepWell Pets", description: "Waterproof lining with washable plush cover for arthritic pets", category: "Animal Accessories", subGroup: "Comfort", hasVariants: true, unit: "Piece", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO", reorderLevel: 3, reorderQty: 8, safetyStock: 1, storageLocation: "Retail Display Front", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 3200, defaultPurchasePrice: 1900, minSalePrice: 2800, maxDiscountPct: 5, valuationRate: 1900, lastPurchaseRate: 1900, gstRate: 18, hsnCode: "94049000", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "SleepWell Pets", leadTimeDays: 7, minOrderQty: 2, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-04-15" },
  { id: "M-0023", itemCode: "M-0023", name: "Stainless Steel Anti-Skid Feeding Bowl", genericName: "Heavy duty non-tip pet bowl", brand: "DinePaws", manufacturer: "PetKitchen", description: "Rust-proof hygienic feeding bowl with rubber ring", category: "Animal Accessories", subGroup: "Feeding", hasVariants: false, unit: "Unit", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO", reorderLevel: 8, reorderQty: 20, safetyStock: 2, storageLocation: "Retail Shelf B2", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 650, defaultPurchasePrice: 350, minSalePrice: 520, maxDiscountPct: 10, valuationRate: 350, lastPurchaseRate: 350, gstRate: 18, hsnCode: "73239390", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "PetKitchen Supplies", leadTimeDays: 5, minOrderQty: 6, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-06-10" },
  { id: "M-0024", itemCode: "M-0024", name: "Hooded Feline Litter Box (Anti-Odour)", genericName: "Cat litter box with carbon filter", brand: "PurrClean", manufacturer: "CleanPet Tech", description: "Enclosed privacy litter box with door flap and scoop", category: "Animal Accessories", subGroup: "Hygiene", hasVariants: false, unit: "Unit", purchaseUom: "", salesUom: "", uomConversions: [], maintainStock: true, valuationMethod: "FIFO", reorderLevel: 4, reorderQty: 10, safetyStock: 1, storageLocation: "Retail Shelf C1", batchTracking: false, serialTracking: false, allowNegativeStock: false, defaultSalePrice: 1850, defaultPurchasePrice: 1100, minSalePrice: 1550, maxDiscountPct: 5, valuationRate: 1100, lastPurchaseRate: 1100, gstRate: 18, hsnCode: "39249090", taxCategory: "Standard", isZeroRated: false, isExempt: false, isImport: false, defaultSupplierId: "SUP-05", defaultSupplierName: "CleanPet Tech", leadTimeDays: 7, minOrderQty: 3, purchaseAccount: "", expenseAccount: "", incomeAccount: "", costCenter: "Retail", isSalesItem: true, allowAlternativeItem: false, status: "Active", createdAt: "2025-05-20" },
];

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
    (itemCode: string) =>
      batches
        .filter((b) => b.itemCode === itemCode && b.status === "Active")
        .reduce((s, b) => s + b.qty, 0),
    [batches]
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

  // ── CRUD — Items ─────────────────────────────────────────────────────────
  const addMedicine = useCallback(
    async (m: Omit<Medicine, "id" | "itemCode" | "createdAt" | "status">) => {
      // Optimistic: add placeholder with temp id
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
        // Replace temp with real
        setMedicines((prev) => prev.map((x) => (x.id === tempId ? newItem : x)));
      } catch (err) {
        // Rollback
        setMedicines((prev) => prev.filter((x) => x.id !== tempId));
        throw err;
      }
    },
    []
  );

  const updateMedicine = useCallback(
    async (itemCode: string, patch: Partial<Medicine>) => {
      // Optimistic update
      setMedicines((prev) =>
        prev.map((m) => (m.itemCode === itemCode ? { ...m, ...patch } : m))
      );
      try {
        await updateItemFn({ data: { itemCode, patch: patch as Record<string, unknown> } });
      } catch (err) {
        // Re-fetch to restore
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

        // Add ledger entry locally
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
          balanceAfter: batchData.acceptedQty,
          actorName: batchData.actor,
          createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
        };
        setLedger((prev) => [entry, ...prev]);
      } catch (err) {
        console.error("[addStock] Failed:", err);
        throw err;
      }
    },
    []
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
      // Add ledger entry
      const isIn = data.movementType === "adjustment_in" || data.movementType === "transfer";
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
      void isIn;
      setLedger((prev) => [entry, ...prev]);
      return result;
    },
    []
  );

  // ── Legacy shims (used by existing child components) ─────────────────────
  const removeStock = useCallback(
    (data: { medicineId: string; batchId: string; qty: number; reason: string; actor: string }) => {
      // Fire-and-forget adjustment for legacy callers
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
      const available = batches
        .filter((b) => b.itemCode === data.medicineId && b.qty > 0 && b.status === "Active")
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const totalAvail = available.reduce((s, b) => s + b.qty, 0);
      if (totalAvail < data.qty) {
        return { ok: false, error: `Only ${totalAvail} units available` };
      }
      // Optimistic local update (real sale goes through billing module)
      let remaining = data.qty;
      const updated = batches.map((b) => {
        if (remaining <= 0 || b.itemCode !== data.medicineId || b.qty === 0 || b.status !== "Active") return b;
        const take = Math.min(b.qty, remaining);
        remaining -= take;
        return { ...b, qty: b.qty - take };
      });
      setBatches(updated);
      return { ok: true };
    },
    [batches]
  );

  const value = useMemo<InventoryContextValue>(
    () => ({
      medicines,
      batches,
      ledger,
      loadingItems,
      addMedicine,
      updateMedicine,
      deactivateMedicine,
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
      medicines, batches, ledger, loadingItems,
      addMedicine, updateMedicine, deactivateMedicine,
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
      batches: [],
      ledger: [],
      loadingItems: false,
      addMedicine: async () => {},
      updateMedicine: async () => {},
      deactivateMedicine: async () => {},
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

