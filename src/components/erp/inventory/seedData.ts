/**
 * Authoritative Seed Data for VetOS Inventory & Product Catalogue Redesign
 * Defaults to empty arrays; items are created dynamically via UI or database.
 */

export interface SeedMedicineDetail {
  medicineType: string;
  genericComposition: string;
  strength: string;
  dosageForm: string;
  packSize: string;
  batchNumber: string;
  expiryDate: string;
}

export interface SeedFoodDetail {
  foodType: string;
  species: string;
  variantFlavour: string;
  packSize: string;
}

export interface SeedAccessoryDetail {
  accessoryType: string;
  sizeVariant: string;
}

export interface SeedItem {
  itemCode: string;
  productType: "MEDICINE" | "FOOD" | "ACCESSORY";
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  category: "Medicine" | "Food" | "Accessory" | "Consumable" | "Animal Food" | "Animal Accessories";
  subGroup: string;
  hasVariants: boolean;
  sku: string;
  unit: "Tablet" | "ml" | "Vial" | "Box" | "Strip" | "Kg" | "Bottle" | "Unit" | "Piece" | "Gm" | "Litre";
  purchaseUom: string;
  salesUom: string;
  uomConversions: { uom: string; conversionFactor: number }[];
  maintainStock: boolean;
  valuationMethod: "FEFO" | "FIFO" | "Moving Average";
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
  status: "Active" | "Inactive";
  createdAt: string;
  samplePriceNote?: string;
  medicineDetails?: SeedMedicineDetail;
  foodDetails?: SeedFoodDetail;
  accessoryDetails?: SeedAccessoryDetail;
}

export type MedicineDetails = SeedMedicineDetail & {
  composition?: string;
  route?: string;
  storageCondition?: string;
  schedule?: string;
  controlledSubstance?: boolean;
};

export type FoodDetails = SeedFoodDetail & {
  targetSpecies?: string;
  lifeStage?: string;
  flavour?: string;
  dietaryIndication?: string;
};

export type AccessoryDetails = SeedAccessoryDetail & {
  petSize?: string;
  material?: string;
  color?: string;
};

// ─── Seed Items (Empty by default) ───────────────────────────────────────────
export const SEED_MEDICINES: SeedItem[] = [];
export const SEED_FOOD: SeedItem[] = [];
export const SEED_ACCESSORIES: SeedItem[] = [];
export const ALL_SEED_ITEMS: SeedItem[] = [];
