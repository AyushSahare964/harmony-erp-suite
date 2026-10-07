/**
 * ProductMasterWizardDialog
 * Guided 5-Step Product Master Wizard for Veterinary ERP
 * Steps: 1. Identity & Specs | 2. Stock & Inventory | 3. Pricing & Tax | 4. Purchasing | 5. Sales & Accounts
 * Supports Category-Specific Profiles: Medicine, Food, Accessory
 * Draft Autosave/Recovery in localStorage
 * Category Immutability in Edit Mode
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pill,
  Syringe,
  Bone,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RotateCcw,
  Save,
  ArrowRight,
  ArrowLeft,
  Info,
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  useInventory,
  resolveProductType,
  type Medicine,
  type ProductType,
  type UnitOfMeasure,
  type ValuationMethod,
} from "./useInventoryStore";
import {
  getDefaultHierarchy,
  deriveBaseUnitsPerPurchase,
  stockDisplayLabel,
  getAvailableUnits,
  convertToBase,
  resolveUnitPrice,
  type PackagingHierarchy,
} from "@/lib/inventory/packagingUtils";
import { peekItemCodeFn } from "@/lib/mongodb/serverFns/inventory";
import { createPurchaseBillFn } from "@/lib/mongodb/serverFns/purchaseBills";
import { todayIST } from "@/lib/utils/dateUtils";
import { NewItemModal } from "@/components/erp/accounting/NewItemModal";
import { SupplierBillFormModal } from "@/components/erp/accounting/SupplierBillFormModal";
import type { InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import {
  PurchaseBillWizardSection,
  type PurchaseBillWizardState,
} from "./PurchaseBillWizardSection";

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS: UnitOfMeasure[] = [
  "Tablet",
  "ml",
  "Vial",
  "Box",
  "Strip",
  "Kg",
  "Bottle",
  "Unit",
  "Piece",
  "Gm",
  "Litre",
];

const VALUATION_METHODS: ValuationMethod[] = ["FEFO", "FIFO", "Moving Average"];
const GST_RATES = [0, 5, 12, 18, 28];

export function getFutureDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function getExpiryDiffDays(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STEPS = [
  { id: 1, title: "Identity & Specs", desc: "Core details & category profile" },
  { id: 2, title: "Stock & Inventory", desc: "UoM, levels & tracking" },
  { id: 3, title: "Pricing & Tax", desc: "MRP, sales price & GST" },
  { id: 4, title: "Purchasing", desc: "Suppliers & lead times" },
  { id: 5, title: "Sales & Accounts", desc: "Revenue accounts & finish" },
];

// Data-driven category registry — add a new entry here to add a new Product Master
// category tile; nothing else in the picker UI needs to change.
interface CategoryDef {
  type: ProductType;
  label: string;
  blurb: string;
  Icon: LucideIcon;
  namePlaceholder: string;
  genericPlaceholder: string;
  subGroupPlaceholder: string;
  swatch: string; // icon tile bg/text
  accent: string; // selected badge/section accent
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    type: "MEDICINE",
    label: "Medicine",
    blurb: "Batch, expiry, Rx",
    Icon: Pill,
    namePlaceholder: "e.g. Amoxicillin 250mg",
    genericPlaceholder: "e.g. Amoxicillin Trihydrate",
    subGroupPlaceholder: "e.g. Antibiotics, NSAIDs",
    swatch: "bg-emerald-500/10 text-emerald-600",
    accent: "emerald",
  },
  {
    type: "INJECTION",
    label: "Injection",
    blurb: "Vials, route, cold chain",
    Icon: Syringe,
    namePlaceholder: "e.g. Meloxicam 20mg/ml Injection",
    genericPlaceholder: "e.g. Meloxicam Injectable Solution",
    subGroupPlaceholder: "e.g. Analgesics, Vaccines, Antibiotics",
    swatch: "bg-rose-500/10 text-rose-600",
    accent: "rose",
  },
  {
    type: "FOOD",
    label: "Animal Food",
    blurb: "Species, kibble, diet",
    Icon: Bone,
    namePlaceholder: "e.g. Royal Canin Maxi Adult 4kg",
    genericPlaceholder: "e.g. Canine adult large breed diet",
    subGroupPlaceholder: "e.g. Dog Food, Feline Diet",
    swatch: "bg-amber-500/10 text-amber-600",
    accent: "amber",
  },
  {
    type: "ACCESSORY",
    label: "Pet Accessory",
    blurb: "Gear, bowl, comfort",
    Icon: Tag,
    namePlaceholder: "e.g. Ergonomic Padded Dog Harness (L)",
    genericPlaceholder: "e.g. Nylon Chest Harness",
    subGroupPlaceholder: "e.g. Gear, Feeding, Comfort",
    swatch: "bg-blue-500/10 text-blue-600",
    accent: "blue",
  },
];

export interface WizardFormState {
  // Category & Identity
  productType: ProductType;
  itemCode: string;
  sku: string;
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  subGroup: string;
  hasVariants: boolean;

  // Medicine Specific
  composition: string;
  strength: string;
  dosageForm: string;
  route: string;
  storageCondition: string;
  schedule: string;
  controlledSubstance: boolean;

  // Food Specific
  targetSpecies: string;
  foodType: string;
  lifeStage: string;
  flavour: string;
  packSize: string;
  dietaryIndication: string;

  // Accessory Specific
  accessoryType: string;
  petSize: string;
  material: string;
  color: string;

  // Injection Specific
  injComposition: string;
  injStrength: string;
  injRoute: string;
  injectionSite: string;
  vialSize: string;
  withdrawalPeriod: string;
  coldChainRequired: boolean;
  injSchedule: string;
  injControlledSubstance: boolean;

  // Stock
  unit: UnitOfMeasure;
  purchaseUom: string;
  salesUom: string;
  maintainStock: boolean;
  valuationMethod: ValuationMethod;
  openingStock: string; // Used when creating
  openingStockUnit: string; // Unit used when entering opening stock (purchase unit or base)
  currentStock: number; // Read-only authoritative in edit mode
  reorderLevel: string;
  reorderQty: string;
  safetyStock: string;
  storageLocation: string;
  batchTracking: boolean;
  serialTracking: boolean;
  allowNegativeStock: boolean;
  batchNo: string;
  expiryDate: string;
  manufacturingDate: string;

  // Packaging Hierarchy
  pkgBaseUnit: string;
  pkgPurchaseUnit: string;
  pkgBaseUnitsPerPurchase: string;
  pkgHasIntermediate: boolean;
  pkgIntermediateUnit: string;
  pkgIntermediateUnitsPerPurchase: string;
  pkgBaseUnitsPerIntermediate: string;

  // Pricing
  defaultPurchasePrice: string;
  defaultSalePrice: string;
  mrp: string;
  minSalePrice: string;
  maxDiscountPct: string;
  valuationRate: string;
  gstRate: string;
  hsnCode: string;
  taxCategory: string;
  samplePriceNote: string;

  // Purchasing
  defaultSupplierId: string;
  defaultSupplierName: string;
  leadTimeDays: string;
  minOrderQty: string;
  purchaseAccount: string;
  expenseAccount: string;

  // Sales & Meta
  incomeAccount: string;
  costCenter: string;
  isSalesItem: boolean;
  allowAlternativeItem: boolean;
  status: "Active" | "Inactive";
}

function getDefaultFormState(
  editing?: Medicine,
  defaultProductType: ProductType = "MEDICINE"
): WizardFormState {
  if (editing) {
    const pType = resolveProductType(editing.category, editing.productType);

    return {
      productType: pType,
      itemCode: editing.itemCode || "",
      sku: editing.sku || "",
      name: editing.name || "",
      genericName: editing.genericName || "",
      brand: editing.brand || "",
      manufacturer: editing.manufacturer || "",
      description: editing.description || "",
      subGroup: editing.subGroup || "",
      hasVariants: editing.hasVariants || false,

      // Medicine details
      composition: editing.medicineDetails?.composition || "",
      strength: editing.medicineDetails?.strength || "",
      dosageForm: editing.medicineDetails?.dosageForm || "",
      route: editing.medicineDetails?.route || "",
      storageCondition:
        editing.medicineDetails?.storageCondition || editing.injectionDetails?.storageCondition || "",
      schedule: editing.medicineDetails?.schedule || "",
      controlledSubstance: editing.medicineDetails?.controlledSubstance || false,

      // Food details
      targetSpecies: editing.foodDetails?.targetSpecies || "",
      foodType: editing.foodDetails?.foodType || "",
      lifeStage: editing.foodDetails?.lifeStage || "",
      flavour: editing.foodDetails?.flavour || "",
      packSize: editing.foodDetails?.packSize || "",
      dietaryIndication: editing.foodDetails?.dietaryIndication || "",

      // Accessory details
      accessoryType: editing.accessoryDetails?.accessoryType || "",
      petSize: editing.accessoryDetails?.petSize || "",
      material: editing.accessoryDetails?.material || "",
      color: editing.accessoryDetails?.color || "",

      // Injection details
      injComposition: editing.injectionDetails?.composition || "",
      injStrength: editing.injectionDetails?.strength || "",
      injRoute: editing.injectionDetails?.route || "",
      injectionSite: editing.injectionDetails?.injectionSite || "",
      vialSize: editing.injectionDetails?.vialSize || "",
      withdrawalPeriod: editing.injectionDetails?.withdrawalPeriod || "",
      coldChainRequired: editing.injectionDetails?.coldChainRequired || false,
      injSchedule: editing.injectionDetails?.schedule || "",
      injControlledSubstance: editing.injectionDetails?.controlledSubstance || false,

      // Stock
      unit: (editing.unit as UnitOfMeasure) || "Tablet",
      purchaseUom: editing.purchaseUom || "Box",
      salesUom: editing.salesUom || "Tablet",
      maintainStock: editing.maintainStock ?? true,
      valuationMethod: editing.valuationMethod || "FEFO",
      openingStock: "0",
      openingStockUnit: editing.packagingHierarchy?.purchaseUnit ?? editing.unit ?? "Box",
      currentStock: editing.currentStock ?? 0,
      reorderLevel: String(editing.reorderLevel ?? 10),
      reorderQty: String(editing.reorderQty ?? 20),
      safetyStock: String(editing.safetyStock ?? 5),
      storageLocation: editing.storageLocation || "",
      batchTracking: editing.batchTracking ?? false,
      serialTracking: editing.serialTracking ?? false,
      allowNegativeStock: editing.allowNegativeStock ?? false,
      batchNo: editing.batchNo || editing.medicineDetails?.batchNo || editing.injectionDetails?.batchNo || "",
      expiryDate: editing.expiryDate || editing.medicineDetails?.expiryDate || editing.injectionDetails?.expiryDate || "",
      manufacturingDate: editing.manufacturingDate || editing.medicineDetails?.manufacturingDate || editing.injectionDetails?.manufacturingDate || "",

      // Packaging Hierarchy — loaded from existing item or inferred
      pkgBaseUnit: editing.packagingHierarchy?.baseUnit ?? editing.unit ?? "Tablet",
      pkgPurchaseUnit: editing.packagingHierarchy?.purchaseUnit ?? "Box",
      pkgBaseUnitsPerPurchase: String(editing.packagingHierarchy?.baseUnitsPerPurchase ?? 100),
      pkgHasIntermediate: editing.packagingHierarchy?.hasIntermediateUnit ?? false,
      pkgIntermediateUnit: editing.packagingHierarchy?.intermediateUnit ?? "",
      pkgIntermediateUnitsPerPurchase: String(editing.packagingHierarchy?.intermediateUnitsPerPurchase ?? ""),
      pkgBaseUnitsPerIntermediate: String(editing.packagingHierarchy?.baseUnitsPerIntermediate ?? ""),

      // Pricing
      defaultPurchasePrice: String(editing.defaultPurchasePrice || ""),
      defaultSalePrice: String(editing.defaultSalePrice || ""),
      mrp: String(editing.mrp || editing.defaultSalePrice || ""),
      minSalePrice: String(editing.minSalePrice || ""),
      maxDiscountPct: String(editing.maxDiscountPct || "10"),
      valuationRate: String(editing.valuationRate || ""),
      gstRate: String(editing.gstRate || "12"),
      hsnCode: editing.hsnCode || "",
      taxCategory: editing.taxCategory || "Standard",
      samplePriceNote: editing.samplePriceNote || "",

      // Purchasing
      defaultSupplierId: editing.defaultSupplierId || "",
      defaultSupplierName: editing.defaultSupplierName || "",
      leadTimeDays: String(editing.leadTimeDays || "7"),
      minOrderQty: String(editing.minOrderQty || "1"),
      purchaseAccount: editing.purchaseAccount || "5010 - Cost of Goods Sold",
      expenseAccount: editing.expenseAccount || "5020 - Operating Supplies",

      // Sales & Meta
      incomeAccount: editing.incomeAccount || "4010 - Sales Revenue",
      costCenter: editing.costCenter || (pType === "MEDICINE" || pType === "INJECTION" ? "Pharmacy" : "Retail Store"),
      isSalesItem: editing.isSalesItem ?? true,
      allowAlternativeItem: editing.allowAlternativeItem ?? false,
      status: editing.status || "Active",
    };
  }

  // New item defaults based on category
  return {
    productType: defaultProductType,
    itemCode: "",
    sku: "",
    name: "",
    genericName: "",
    brand: "",
    manufacturer: "",
    description: "",
    subGroup: "",
    hasVariants: false,

    composition: "",
    strength: "",
    dosageForm: defaultProductType === "MEDICINE" ? "Tablet" : "",
    route: defaultProductType === "MEDICINE" ? "Oral" : "",
    storageCondition:
      defaultProductType === "INJECTION" ? "Cold Chain (2-8°C)" : "Room Temperature (15-25°C)",
    schedule: "Schedule H",
    controlledSubstance: false,

    targetSpecies: defaultProductType === "FOOD" ? "Dog" : "",
    foodType: defaultProductType === "FOOD" ? "Dry Kibble" : "",
    lifeStage: "Adult",
    flavour: "",
    packSize: "",
    dietaryIndication: "Maintenance",

    accessoryType: defaultProductType === "ACCESSORY" ? "Collar / Leash / Harness" : "",
    petSize: "Medium",
    material: "Nylon",
    color: "Black",

    injComposition: "",
    injStrength: "",
    injRoute: defaultProductType === "INJECTION" ? "IM" : "",
    injectionSite: "",
    vialSize: "",
    withdrawalPeriod: "0 days",
    coldChainRequired: defaultProductType === "INJECTION",
    injSchedule: "Schedule H",
    injControlledSubstance: false,

    unit: defaultProductType === "MEDICINE" ? "Tablet"
      : defaultProductType === "INJECTION" ? "Vial"
      : defaultProductType === "FOOD" ? "Kg" : "Piece",
    purchaseUom: "",
    salesUom: "",
    maintainStock: true,
    valuationMethod: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "FEFO" : "FIFO",
    openingStock: "0",
    openingStockUnit: defaultProductType === "MEDICINE" ? "Box"
      : defaultProductType === "INJECTION" ? "Box"
      : defaultProductType === "FOOD" ? "Bag" : "Piece",
    currentStock: 0,
    reorderLevel: defaultProductType === "MEDICINE" ? "200"
      : defaultProductType === "INJECTION" ? "10"
      : defaultProductType === "FOOD" ? "10" : "5",
    reorderQty: defaultProductType === "MEDICINE" ? "500"
      : defaultProductType === "INJECTION" ? "20"
      : defaultProductType === "FOOD" ? "20" : "15",
    safetyStock: "50",
    storageLocation: defaultProductType === "MEDICINE" ? "Pharmacy Shelf A1"
      : defaultProductType === "INJECTION" ? "Pharmacy Cold Chain Fridge"
      : "Retail Floor",
    batchTracking: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION",
    serialTracking: false,
    allowNegativeStock: false,
    batchNo: "",
    expiryDate: "",
    manufacturingDate: "",

    // Packaging Hierarchy defaults by product type
    pkgBaseUnit: defaultProductType === "MEDICINE" ? "Tablet"
      : defaultProductType === "INJECTION" ? "Vial"
      : defaultProductType === "FOOD" ? "Kg" : "Piece",
    pkgPurchaseUnit: defaultProductType === "FOOD" ? "Bag" : "Box",
    pkgBaseUnitsPerPurchase: defaultProductType === "MEDICINE" ? "100"
      : defaultProductType === "INJECTION" ? "5"
      : defaultProductType === "FOOD" ? "4" : "1",
    pkgHasIntermediate: defaultProductType === "MEDICINE",
    pkgIntermediateUnit: defaultProductType === "MEDICINE" ? "Strip" : "",
    pkgIntermediateUnitsPerPurchase: defaultProductType === "MEDICINE" ? "10" : "",
    pkgBaseUnitsPerIntermediate: defaultProductType === "MEDICINE" ? "10" : "",

    defaultPurchasePrice: "",
    defaultSalePrice: "",
    mrp: "",
    minSalePrice: "",
    maxDiscountPct: "10",
    valuationRate: "",
    gstRate: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "12"
      : defaultProductType === "FOOD" ? "5" : "18",
    hsnCode: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "3004"
      : defaultProductType === "FOOD" ? "2309" : "4201",
    taxCategory: "Standard",
    samplePriceNote: "",

    defaultSupplierId: "",
    defaultSupplierName: "",
    leadTimeDays: "7",
    minOrderQty: "1",
    purchaseAccount: "5010 - Cost of Goods Sold",
    expenseAccount: "5020 - Operating Supplies",

    incomeAccount: "4010 - Sales Revenue",
    costCenter: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "Pharmacy" : "Retail Store",
    isSalesItem: true,
    allowAlternativeItem: false,
    status: "Active",
  };
}

// ─── Add flow: New Item → Purchase Bill → back to inventory ──────────────────

function AddItemFlow({
  open,
  onClose,
  defaultType,
  initialName,
  onItemCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultType: ProductType;
  initialName?: string | undefined;
  onItemCreated?: ((item: Medicine) => void) | undefined;
}) {
  const { refetchItems } = useInventory();
  const [created, setCreated] = useState<InventoryItemRow | null>(null);

  useEffect(() => {
    if (!open) setCreated(null);
  }, [open]);

  const finish = () => {
    setCreated(null);
    void refetchItems(); // inventory list shows the new item (and any stock change)
    onClose();
  };

  return (
    <>
      <NewItemModal
        open={open && !created}
        onClose={onClose}
        defaultType={defaultType}
        initialName={initialName}
        onSuccess={(item) => {
          setCreated(item);
          void refetchItems();
          onItemCreated?.(item as unknown as Medicine);
        }}
      />
      {created && (
        <SupplierBillFormModal open onClose={finish} onSuccess={finish} initialItem={created} />
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ProductMasterWizardDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: Medicine | undefined;
  defaultProductType?: ProductType;
  initialName?: string;
  onItemCreated?: (item: Medicine) => void;
}

export function ProductMasterWizardDialog({
  open,
  onClose,
  editing,
  defaultProductType = "MEDICINE",
  initialName,
  onItemCreated,
}: ProductMasterWizardDialogProps) {
  const { addMedicine, updateMedicine, getTotalQty } = useInventory();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(() => {
    const s = getDefaultFormState(editing, defaultProductType);
    if (initialName && !editing) s.name = initialName;
    return s;
  });
  const [saving, setSaving] = useState(false);
  const [nextCode, setNextCode] = useState("");
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);

  const draftKey = `vetos_draft_${form.productType}`;
  const activeDef = CATEGORY_DEFS.find((d) => d.type === form.productType) ?? CATEGORY_DEFS[0]!;

  const [purchaseBillState, setPurchaseBillState] = useState<PurchaseBillWizardState>(() => ({
    enabled: !editing,
    purchaseType: "GST",
    billDate: todayIST(),
    paymentStatus: "PAID",
    paymentMode: "CASH",
    supplierId: editing?.defaultSupplierId || "",
    supplierName: editing?.defaultSupplierName || "",
    placeOfSupply: "Maharashtra",
    poNumber: "",
    purchaseBillNo: `PB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    lines: [],
    addShipping: false,
    shippingCost: 0,
    remarks: "",
  }));

  // Reset or load initial data when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      const initial = getDefaultFormState(editing, defaultProductType);
      if (initialName && !editing) {
        initial.name = initialName;
      }
      setForm(initial);

      setPurchaseBillState({
        enabled: !editing,
        purchaseType: "GST",
        billDate: todayIST(),
        paymentStatus: "PAID",
        paymentMode: "CASH",
        supplierId: editing?.defaultSupplierId || "",
        supplierName: editing?.defaultSupplierName || "",
        placeOfSupply: "Maharashtra",
        poNumber: "",
        purchaseBillNo: `PB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        lines: [],
        addShipping: false,
        shippingCost: 0,
        remarks: "",
      });

      // Check draft only when adding and no explicit initialName
      if (!editing && !initialName) {
        try {
          const raw = localStorage.getItem(`vetos_draft_${defaultProductType}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.data && parsed.updatedAt) {
              setHasSavedDraft(true);
              setDraftTimestamp(new Date(parsed.updatedAt).toLocaleTimeString());
            }
          }
        } catch (e) {
          console.warn("Could not check localStorage draft:", e);
        }
      } else {
        setHasSavedDraft(false);
      }
    }
  }, [open, editing, defaultProductType, initialName]);

  // Peek next code for category
  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    peekItemCodeFn({ data: { type: form.productType } })
      .then((code) => {
        if (!cancelled && code) {
          setNextCode(code);
          setForm((prev) => ({
            ...prev,
            itemCode: code,
            sku: prev.sku || `${code}-STD`,
          }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, editing, form.productType]);

  // Autosave draft (debounced) when adding
  useEffect(() => {
    if (!open || editing) return;
    const timer = setTimeout(() => {
      if (form.name.trim().length > 0) {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ data: form, updatedAt: new Date().toISOString() })
        );
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, open, editing, draftKey]);

  // Draft recovery actions
  const handleRestoreDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.data) {
          const defaults = getDefaultFormState(undefined, parsed.data.productType || form.productType);
          setForm({ ...defaults, ...parsed.data });
          toast.success("Draft recovered successfully");
        }
      }
    } catch {
      toast.error("Failed to restore draft");
    } finally {
      setHasSavedDraft(false);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftKey);
    setHasSavedDraft(false);
    toast.info("Draft discarded");
  };

  const updateField = <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Step Validation
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!form.name.trim()) {
        toast.error("Item Name is required");
        return false;
      }
      if (form.productType === "MEDICINE" && !form.strength.trim()) {
        toast.warning("Tip: Medicine strength (e.g. 250mg) is recommended for clarity.");
      }
      if (form.expiryDate) {
        const days = getExpiryDiffDays(form.expiryDate);
        if (days !== null && days < 0) {
          toast.warning("Selected expiry date is in the past. Ensure this is intentional.");
        }
      }
      return true;
    }
    if (step === 2) {
      if (!form.reorderLevel || isNaN(Number(form.reorderLevel))) {
        toast.error("Valid Minimum / Reorder level is required for alerts");
        return false;
      }
      if (Number(form.openingStock) > 0 && form.batchTracking && !form.expiryDate) {
        const nextYear = getFutureDate(12);
        updateField("expiryDate", nextYear);
        toast.info("Opening stock tracked: Expiry Date automatically defaulted to 1 year ahead.");
      }
      return true;
    }
    if (step === 3) {
      if (!form.defaultSalePrice || Number(form.defaultSalePrice) <= 0) {
        toast.error("A valid Default Selling Price is required");
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep((s) => s + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  // Final Save Handler
  const handleSaveProduct = async () => {
    if (!validateStep(currentStep)) return;
    setSaving(true);

    try {
      const categoryName =
        form.productType === "MEDICINE"
          ? "Medicine"
          : form.productType === "INJECTION"
          ? "Injection"
          : form.productType === "FOOD"
          ? "Animal Food"
          : "Animal Accessories";

      const payload = {
        name: form.name.trim(),
        genericName: form.genericName.trim(),
        brand: form.brand.trim(),
        manufacturer: form.manufacturer.trim(),
        description: form.description.trim(),
        category: categoryName as any,
        productType: form.productType,
        sku: form.sku.trim() || undefined,
        subGroup: form.subGroup.trim(),
        hasVariants: form.hasVariants,

        unit: form.pkgBaseUnit || form.unit,
        purchaseUom: form.pkgPurchaseUnit || form.purchaseUom || form.unit,
        salesUom: form.pkgBaseUnit || form.salesUom || form.unit,
        maintainStock: form.maintainStock,
        valuationMethod: form.valuationMethod,
        reorderLevel: Number(form.reorderLevel) || 10,
        reorderQty: Number(form.reorderQty) || 20,
        safetyStock: Number(form.safetyStock) || 5,

        // Build packaging hierarchy from form fields
        packagingHierarchy: (() => {
          const baseUnitsPerPurchase = form.pkgHasIntermediate
            ? (Number(form.pkgIntermediateUnitsPerPurchase) || 1) * (Number(form.pkgBaseUnitsPerIntermediate) || 1)
            : Number(form.pkgBaseUnitsPerPurchase) || 1;
          const h: PackagingHierarchy = {
            baseUnit: form.pkgBaseUnit || form.unit,
            purchaseUnit: form.pkgPurchaseUnit || "Box",
            baseUnitsPerPurchase,
            hasIntermediateUnit: form.pkgHasIntermediate,
            intermediateUnit: form.pkgHasIntermediate ? form.pkgIntermediateUnit : undefined,
            intermediateUnitsPerPurchase: form.pkgHasIntermediate ? Number(form.pkgIntermediateUnitsPerPurchase) || undefined : undefined,
            baseUnitsPerIntermediate: form.pkgHasIntermediate ? Number(form.pkgBaseUnitsPerIntermediate) || undefined : undefined,
          };
          return h;
        })(),

        // Opening stock: entered in openingStockUnit → convert to base units
        currentStock: editing ? editing.currentStock : (() => {
          const openingQty = Number(form.openingStock) || 0;
          if (openingQty <= 0) return 0;
          const baseUnitsPerPurchase = form.pkgHasIntermediate
            ? (Number(form.pkgIntermediateUnitsPerPurchase) || 1) * (Number(form.pkgBaseUnitsPerIntermediate) || 1)
            : Number(form.pkgBaseUnitsPerPurchase) || 1;
          const openingUnit = form.openingStockUnit;
          const pkgPurchaseUnit = form.pkgPurchaseUnit || "Box";
          const pkgBaseUnit = form.pkgBaseUnit || form.unit;
          if (openingUnit === pkgPurchaseUnit) return openingQty * baseUnitsPerPurchase;
          if (openingUnit === form.pkgIntermediateUnit && form.pkgHasIntermediate)
            return openingQty * (Number(form.pkgBaseUnitsPerIntermediate) || 1);
          if (openingUnit === pkgBaseUnit) return openingQty;
          return openingQty; // fallback
        })(),
        minStockLevel: Number(form.reorderLevel) || 10,
        storageLocation: form.storageLocation.trim(),
        batchTracking: form.batchTracking,
        serialTracking: form.serialTracking,
        allowNegativeStock: form.allowNegativeStock,
        batchNo: form.batchNo.trim(),
        expiryDate: form.expiryDate.trim(),
        manufacturingDate: form.manufacturingDate.trim(),

        defaultPurchasePrice: Number(form.defaultPurchasePrice) || 0,
        defaultSalePrice: Number(form.defaultSalePrice) || 0,
        mrp: Number(form.mrp) || Number(form.defaultSalePrice) || 0,
        minSalePrice: Number(form.minSalePrice) || 0,
        maxDiscountPct: Number(form.maxDiscountPct) || 0,
        valuationRate: Number(form.valuationRate) || Number(form.defaultPurchasePrice) || 0,
        lastPurchaseRate: Number(form.defaultPurchasePrice) || 0,
        samplePriceNote: form.samplePriceNote.trim() || undefined,

        gstRate: Number(form.gstRate) || 0,
        hsnCode: form.hsnCode.trim(),
        taxCategory: form.taxCategory || "Standard",
        isZeroRated: false,
        isExempt: false,
        isImport: false,

        defaultSupplierId: form.defaultSupplierId.trim(),
        defaultSupplierName: form.defaultSupplierName.trim(),
        leadTimeDays: Number(form.leadTimeDays) || 7,
        minOrderQty: Number(form.minOrderQty) || 1,
        purchaseAccount: form.purchaseAccount || "5010 - Cost of Goods Sold",
        expenseAccount: form.expenseAccount || "5020 - Operating Supplies",

        incomeAccount: form.incomeAccount || "4010 - Sales Revenue",
        costCenter: form.costCenter || "Retail Store",
        isSalesItem: form.isSalesItem,
        allowAlternativeItem: form.allowAlternativeItem,

        // Profile details
        medicineDetails:
          form.productType === "MEDICINE"
            ? {
                composition: form.composition,
                strength: form.strength,
                dosageForm: form.dosageForm,
                route: form.route,
                storageCondition: form.storageCondition,
                schedule: form.schedule,
                controlledSubstance: form.controlledSubstance,
                batchNo: form.batchNo.trim(),
                expiryDate: form.expiryDate.trim(),
                manufacturingDate: form.manufacturingDate.trim(),
              }
            : undefined,

        foodDetails:
          form.productType === "FOOD"
            ? {
                targetSpecies: form.targetSpecies,
                foodType: form.foodType,
                lifeStage: form.lifeStage,
                flavour: form.flavour,
                packSize: form.packSize,
                dietaryIndication: form.dietaryIndication,
              }
            : undefined,

        accessoryDetails:
          form.productType === "ACCESSORY"
            ? {
                accessoryType: form.accessoryType,
                petSize: form.petSize,
                material: form.material,
                color: form.color,
              }
            : undefined,

        injectionDetails:
          form.productType === "INJECTION"
            ? {
                composition: form.injComposition,
                strength: form.injStrength,
                route: form.injRoute,
                injectionSite: form.injectionSite,
                vialSize: form.vialSize,
                withdrawalPeriod: form.withdrawalPeriod,
                coldChainRequired: form.coldChainRequired,
                storageCondition: form.storageCondition,
                schedule: form.injSchedule,
                controlledSubstance: form.injControlledSubstance,
                batchNo: form.batchNo.trim(),
                expiryDate: form.expiryDate.trim(),
                manufacturingDate: form.manufacturingDate.trim(),
              }
            : undefined,
      };

      if (editing) {
        await updateMedicine(editing.itemCode, {
          ...payload,
          status: form.status,
        } as any);
        toast.success(`Updated ${form.name} successfully`);
      } else {
        const created = await addMedicine(payload as any);
        localStorage.removeItem(draftKey);

        // Auto-generate Purchase Bill in Billing & Payments if enabled
        if (purchaseBillState.enabled && purchaseBillState.lines.length > 0) {
          try {
            const subTotal = purchaseBillState.lines.reduce((s, l) => s + (l.amount || 0), 0);
            const shipping = purchaseBillState.addShipping ? Math.max(0, purchaseBillState.shippingCost || 0) : 0;
            const grandTotal = Math.round((subTotal + shipping) * 100) / 100;
            const invItemId = created ? (created as any)._id || created.itemCode : undefined;

            const paymentStatus = purchaseBillState.paymentStatus || "PAID";
            const finalTotal = grandTotal > 0 ? grandTotal : 1;
            const actualPaidAmount =
              paymentStatus === "PAID"
                ? finalTotal
                : paymentStatus === "PARTIAL"
                ? Math.min(finalTotal, Math.max(0, purchaseBillState.paidAmount ?? Math.round(finalTotal / 2)))
                : 0;
            const hasPayment = actualPaidAmount > 0;

            await createPurchaseBillFn({
              data: {
                supplierId: purchaseBillState.supplierId || "GENERIC_SUPPLIER",
                supplierName: purchaseBillState.supplierName || form.defaultSupplierName || "Supplier",
                billNumber: purchaseBillState.purchaseBillNo.trim() || `PB-${Date.now()}`,
                billDate: purchaseBillState.billDate,
                dueDate: purchaseBillState.dueDate || undefined,
                taxType: "INTRA",
                subtotal: subTotal,
                discountTotal: 0,
                taxableTotal: subTotal,
                cgstTotal: 0,
                sgstTotal: 0,
                igstTotal: 0,
                otherCharges: shipping,
                roundOff: 0,
                grandTotal: finalTotal,
                remarks: purchaseBillState.remarks.trim() || undefined,
                paymentNow: hasPayment,
                paymentLines: hasPayment
                  ? [
                      {
                        mode: purchaseBillState.paymentMode || "CASH",
                        accountId: "DEFAULT_ACCOUNT",
                        accountName:
                          purchaseBillState.paymentMode === "CASH"
                            ? "Cash Register"
                            : "Main Bank Account",
                        amount: actualPaidAmount,
                      },
                    ]
                  : undefined,
                items: purchaseBillState.lines.map((l, idx) => ({
                  lineNo: idx + 1,
                  itemType: "INVENTORY",
                  inventoryItemId: invItemId,
                  description: l.productName,
                  hsnCode: form.hsnCode || "3004",
                  qty: l.quantity,
                  freeQty: 0,
                  unit: l.unit,
                  purchaseRate: l.purchasePrice,
                  mrp: l.mrp || Number(form.mrp) || undefined,
                  discountPct: 0,
                  gstPct: Number(form.gstRate) || 0,
                  taxableAmount: l.amount,
                  taxAmount: 0,
                  lineTotal: l.amount,
                  batchNo: (l as any).batchNo || form.batchNo || undefined,
                  expiryDate: (l as any).expiryDate || form.expiryDate || undefined,
                })),
              },
            });

            toast.success(
              `Created ${form.name} and generated Purchase Bill (${purchaseBillState.purchaseBillNo}) in Billing!`
            );
          } catch (pbErr: any) {
            console.error("[ProductMasterWizard] Auto-generate purchase bill failed:", pbErr);
            toast.warning(`Item created, but failed to generate purchase bill: ${pbErr.message || "Unknown error"}`);
          }
        } else {
          toast.success(`Created ${form.name} (${nextCode || "New"}) successfully`);
        }

        if (created) {
          onItemCreated?.(created);
        }
      }

      onClose();
    } catch (err: any) {
      console.error("[ProductMasterWizard] Save error:", err);
      toast.error(err.message || "Failed to save product master record");
    } finally {
      setSaving(false);
    }
  };

  const handleCategorySwitch = (newType: ProductType) => {
    if (editing || form.productType === newType) return;
    const defaults = getDefaultFormState(undefined, newType);
    setForm((prev) => ({
      ...prev,
      productType: newType,
      unit: prev.unit || defaults.unit,
      storageLocation: defaults.storageLocation,
      gstRate: defaults.gstRate,
      hsnCode: defaults.hsnCode,
      reorderLevel: defaults.reorderLevel,
      reorderQty: defaults.reorderQty,
      costCenter: defaults.costCenter,
      batchTracking: defaults.batchTracking,
    }));
  };

  const handleQuickSave = async () => {
    if (!form.name.trim()) {
      toast.error("Item Name is required");
      return;
    }
    if (!form.defaultSalePrice) {
      setForm((prev) => ({ ...prev, defaultSalePrice: "0" }));
    }
    if (form.batchTracking && !form.expiryDate) {
      setForm((prev) => ({ ...prev, expiryDate: getFutureDate(12) }));
    }
    await handleSaveProduct();
  };

  const getCategoryBadge = (type: ProductType) => {
    switch (type) {
      case "MEDICINE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Pill className="h-3.5 w-3.5" /> Medicine Master
          </span>
        );
      case "INJECTION":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Syringe className="h-3.5 w-3.5" /> Injection Master
          </span>
        );
      case "FOOD":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Bone className="h-3.5 w-3.5" /> Food Item Master
          </span>
        );
      case "ACCESSORY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Tag className="h-3.5 w-3.5" /> Accessory Master
          </span>
        );
      default:
        return null;
    }
  };

  // Add mode → New Item modal, then straight into a purchase bill for that item.
  if (!editing) {
    return (
      <AddItemFlow
        open={open}
        onClose={onClose}
        defaultType={defaultProductType}
        initialName={initialName}
        onItemCreated={onItemCreated}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-border/80">
        {/* Header with Title & Stepper */}
        <div className="px-6 pt-5 pb-4 border-b bg-card/60">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                {editing ? <ShieldCheck className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  {editing ? `Edit ${editing.name}` : "New Product Master Wizard"}
                  {editing && (
                    <Badge variant={form.status === "Active" ? "default" : "secondary"}>
                      {form.status}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {editing
                    ? `Item Code: ${editing.itemCode} • Category locked for ledger consistency`
                    : `Guided 5-step master configuration • Pre-assigned ID: ${nextCode || "Auto"}`}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getCategoryBadge(form.productType)}
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {STEPS.map((step) => {
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (step.id < currentStep || validateStep(currentStep)) {
                      setCurrentStep(step.id);
                    }
                  }}
                  className={`text-left transition-all p-2 rounded-lg border text-xs flex flex-col gap-0.5 ${
                    isCurrent
                      ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs"
                      : isDone
                      ? "bg-muted/40 border-muted text-muted-foreground hover:bg-muted/70"
                      : "opacity-60 border-transparent text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <span
                        className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.id}
                      </span>
                    )}
                    <span className="truncate">{step.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                    {step.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content Panels */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* ─────────────────────────────────────────────────────────────
              STEP 1: IDENTITY & CATEGORY SPECIFICATIONS
          ────────────────────────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in-50">
              {/* Product Type Picker (Disabled if editing) */}
              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Product Master Catalogue
                  </Label>
                  {editing && (
                    <span className="text-xs flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" /> Category locked to preserve ledger auditability
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {CATEGORY_DEFS.map((def) => {
                    const isSelected = form.productType === def.type;
                    const isDisabled = !!editing;
                    return (
                      <button
                        key={def.type}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (!isDisabled) {
                            handleCategorySwitch(def.type);
                          }
                        }}
                        className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 ${
                          isSelected
                            ? "bg-card border-primary ring-2 ring-primary/30 shadow-md"
                            : "bg-muted/30 border-border hover:bg-muted/60 hover:border-border/80"
                        } ${isDisabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${def.swatch}`}>
                          <def.Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-foreground flex items-center justify-between">
                            <span className="truncate">{def.label}</span>
                            {isSelected && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{def.blurb}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Core Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Product / Brand Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder={activeDef.namePlaceholder}
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Generic / Scientific Name</Label>
                  <Input
                    placeholder={activeDef.genericPlaceholder}
                    value={form.genericName}
                    onChange={(e) => updateField("genericName", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Brand</Label>
                  <Input
                    placeholder="e.g. PawShield / Royal Canin / Zoetis"
                    value={form.brand}
                    onChange={(e) => updateField("brand", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Manufacturer</Label>
                  <Input
                    placeholder="e.g. PetCare Gear / Mars Petcare / Pfizer"
                    value={form.manufacturer}
                    onChange={(e) => updateField("manufacturer", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">SKU / Barcode</Label>
                  <Input
                    placeholder="e.g. AMX-250-TAB or barcode"
                    value={form.sku}
                    onChange={(e) => updateField("sku", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sub-Category / Group</Label>
                  <Input
                    placeholder={activeDef.subGroupPlaceholder}
                    value={form.subGroup}
                    onChange={(e) => updateField("subGroup", e.target.value)}
                  />
                </div>
              </div>

              {/* Category-Specific Detailed Specification Section */}
              <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    {form.productType === "MEDICINE" && "Clinical & Pharmaceutical Specifications"}
                    {form.productType === "INJECTION" && "Injectable Clinical & Cold Chain Specifications"}
                    {form.productType === "FOOD" && "Dietary & Nutritional Profile"}
                    {form.productType === "ACCESSORY" && "Physical Variant & Material Specifications"}
                  </span>
                </div>

                {/* MEDICINE SPECIFIC FIELDS */}
                {form.productType === "MEDICINE" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Composition / Active Substance</Label>
                      <Input
                        placeholder="e.g. Amoxicillin 250mg + Clavulanic 50mg"
                        value={form.composition}
                        onChange={(e) => updateField("composition", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Strength / Concentration</Label>
                      <Input
                        placeholder="e.g. 250mg, 10mg/ml, 5%"
                        value={form.strength}
                        onChange={(e) => updateField("strength", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Dosage Form</Label>
                      <Select
                        value={form.dosageForm || "Tablet"}
                        onValueChange={(v) => updateField("dosageForm", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select form" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Tablet", "Capsule", "Syrup", "Injection", "Vial", "Suspension", "Ointment", "Drops", "Powder", "Spray"].map(
                            (f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Administration Route</Label>
                      <Select
                        value={form.route || "Oral"}
                        onValueChange={(v) => updateField("route", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select route" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Oral", "IV", "IM", "SC", "Topical", "Ophthalmic", "Otic", "Inhalation"].map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Storage Temperature / Condition</Label>
                      <Select
                        value={form.storageCondition || "Room Temperature (15-25°C)"}
                        onValueChange={(v) => updateField("storageCondition", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Storage" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Room Temperature (15-25°C)",
                            "Cold Chain (2-8°C)",
                            "Deep Freeze (< -18°C)",
                            "Cool & Dry (10-20°C)",
                            "Protect from Light",
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Drug Schedule / Classification</Label>
                      <Select
                        value={form.schedule || "Schedule H"}
                        onValueChange={(v) => updateField("schedule", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Schedule H", "Schedule H1", "Schedule X", "OTC", "Prescription Only", "General Sale"].map(
                            (sc) => (
                              <SelectItem key={sc} value={sc}>
                                {sc}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2 pt-3 col-span-full">
                      <Checkbox
                        id="controlledSub"
                        checked={form.controlledSubstance}
                        onCheckedChange={(c) => updateField("controlledSubstance", !!c)}
                      />
                      <Label htmlFor="controlledSub" className="text-xs cursor-pointer font-medium">
                        Controlled Substance / Narcotic Register entry mandatory
                      </Label>
                    </div>

                    {/* Batch & Expiry Date Configuration for Medicine */}
                    <div className="col-span-full p-3.5 rounded-lg border bg-background/80 shadow-xs space-y-3 border-emerald-500/30">
                      <div className="flex items-center justify-between pb-1.5 border-b">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-semibold text-foreground">
                            Batch & Expiry Date Configuration
                          </span>
                          <Badge variant="outline" className="text-[10px] font-normal border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20">
                            Required for Clinical FEFO & Near-Expiry Alerts
                          </Badge>
                        </div>
                        {form.expiryDate && (
                          (() => {
                            const days = getExpiryDiffDays(form.expiryDate);
                            if (days === null) return null;
                            if (days < 0) {
                              return (
                                <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Expired {Math.abs(days)}d ago
                                </Badge>
                              );
                            }
                            if (days <= 60) {
                              return (
                                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-500/10 flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Expiring soon ({days}d left)
                                </Badge>
                              );
                            }
                            return (
                              <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-500/10 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Safe ({days}d / ~{Math.round(days / 30)}m left)
                              </Badge>
                            );
                          })()
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Batch / Lot Number</Label>
                          <Input
                            placeholder="e.g. B-2026-001"
                            value={form.batchNo}
                            onChange={(e) => updateField("batchNo", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">
                              Expiry Date <span className="text-destructive">*</span>
                            </Label>
                            <span className="text-[10px] text-muted-foreground">YYYY-MM-DD</span>
                          </div>
                          <Input
                            type="date"
                            value={form.expiryDate}
                            onChange={(e) => updateField("expiryDate", e.target.value)}
                            className="text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Manufacturing Date (Optional)</Label>
                          <Input
                            type="date"
                            value={form.manufacturingDate}
                            onChange={(e) => updateField("manufacturingDate", e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      {/* Quick Duration Buttons */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] text-muted-foreground mr-1">Quick Expiry Preset:</span>
                        {[
                          { label: "+6 Months", months: 6 },
                          { label: "+1 Year", months: 12 },
                          { label: "+2 Years", months: 24 },
                          { label: "+3 Years", months: 36 },
                        ].map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2 py-0 border-dashed hover:bg-emerald-500/10 hover:border-emerald-500 hover:text-emerald-600"
                            onClick={() => updateField("expiryDate", getFutureDate(preset.months))}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* FOOD SPECIFIC FIELDS */}
                {form.productType === "FOOD" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Target Species</Label>
                      <Select
                        value={form.targetSpecies || "Dog"}
                        onValueChange={(v) => updateField("targetSpecies", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Species" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Dog", "Cat", "Puppy", "Kitten", "Bird", "Small Animal", "All Pets"].map((sp) => (
                            <SelectItem key={sp} value={sp}>
                              {sp}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Food Type</Label>
                      <Select
                        value={form.foodType || "Dry Kibble"}
                        onValueChange={(v) => updateField("foodType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Dry Kibble",
                            "Wet / Gravy Pouch",
                            "Wet / Canned",
                            "Treats & Biscuits",
                            "Prescription / Veterinary Diet",
                            "Milk Replacer",
                            "Nutritional Supplement",
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Life Stage</Label>
                      <Select
                        value={form.lifeStage || "Adult"}
                        onValueChange={(v) => updateField("lifeStage", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Life stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Puppy / Kitten", "Adult", "Senior", "All Life Stages", "Gestating / Lactating"].map((ls) => (
                            <SelectItem key={ls} value={ls}>
                              {ls}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Flavour / Primary Protein</Label>
                      <Input
                        placeholder="e.g. Chicken & Vegetables, Ocean Fish, Lamb"
                        value={form.flavour}
                        onChange={(e) => updateField("flavour", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Net Weight / Pack Size</Label>
                      <Input
                        placeholder="e.g. 400g, 1.2kg, 3kg, 10kg, 15kg"
                        value={form.packSize}
                        onChange={(e) => updateField("packSize", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Dietary Indication</Label>
                      <Input
                        placeholder="e.g. Maintenance, Renal, Gastrointestinal, Hypoallergenic"
                        value={form.dietaryIndication}
                        onChange={(e) => updateField("dietaryIndication", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* ACCESSORY SPECIFIC FIELDS */}
                {form.productType === "ACCESSORY" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Accessory Category</Label>
                      <Select
                        value={form.accessoryType || "Collar / Leash / Harness"}
                        onValueChange={(v) => updateField("accessoryType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Collar / Leash / Harness",
                            "Bed / Mattress / Comfort",
                            "Bowl / Feeding / Waterer",
                            "Toy / Chew / Interactive",
                            "Grooming & Hygiene",
                            "Carrier / Crate / Travel",
                            "Clothing / Apparel",
                            "Litter & Odour Control",
                            "Training Aid",
                          ].map((ac) => (
                            <SelectItem key={ac} value={ac}>
                              {ac}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Pet Size / Breed Fit</Label>
                      <Select
                        value={form.petSize || "Medium"}
                        onValueChange={(v) => updateField("petSize", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Size" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Extra Small (XS)", "Small (S)", "Medium (M)", "Large (L)", "Extra Large (XL)", "Adjustable", "Universal / One Size"].map(
                            (sz) => (
                              <SelectItem key={sz} value={sz}>
                                {sz}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Material Composition</Label>
                      <Input
                        placeholder="e.g. Heavy Duty Nylon, Stainless Steel, Memory Foam, Rubber"
                        value={form.material}
                        onChange={(e) => updateField("material", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Color / Pattern Variant</Label>
                      <Input
                        placeholder="e.g. Reflective Red, Matte Black, Blue Geometric"
                        value={form.color}
                        onChange={(e) => updateField("color", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* INJECTION SPECIFIC FIELDS */}
                {form.productType === "INJECTION" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Composition / Active Substance</Label>
                      <Input
                        placeholder="e.g. Meloxicam 20mg/ml"
                        value={form.injComposition}
                        onChange={(e) => updateField("injComposition", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Strength / Concentration</Label>
                      <Input
                        placeholder="e.g. 20mg/ml, 100 IU/ml"
                        value={form.injStrength}
                        onChange={(e) => updateField("injStrength", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Vial / Ampoule Size</Label>
                      <Input
                        placeholder="e.g. 10ml vial, 1ml ampoule"
                        value={form.vialSize}
                        onChange={(e) => updateField("vialSize", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Administration Route</Label>
                      <Select
                        value={form.injRoute || "IM"}
                        onValueChange={(v) => updateField("injRoute", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select route" />
                        </SelectTrigger>
                        <SelectContent>
                          {["IV", "IM", "SC", "Intradermal", "Intramammary", "Epidural"].map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Injection Site</Label>
                      <Input
                        placeholder="e.g. Gluteal, Cervical, Hind limb"
                        value={form.injectionSite}
                        onChange={(e) => updateField("injectionSite", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Withdrawal Period</Label>
                      <Input
                        placeholder="e.g. 0 days, 7 days meat/milk"
                        value={form.withdrawalPeriod}
                        onChange={(e) => updateField("withdrawalPeriod", e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        For food-producing animals — time before meat/milk is safe for consumption.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Storage / Cold Chain Condition</Label>
                      <Select
                        value={form.storageCondition || "Cold Chain (2-8°C)"}
                        onValueChange={(v) => updateField("storageCondition", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Storage" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Cold Chain (2-8°C)",
                            "Room Temperature (15-25°C)",
                            "Deep Freeze (< -18°C)",
                            "Protect from Light",
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Drug Schedule / Classification</Label>
                      <Select
                        value={form.injSchedule || "Schedule H"}
                        onValueChange={(v) => updateField("injSchedule", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Schedule H", "Schedule H1", "Schedule X", "OTC", "Prescription Only", "General Sale"].map(
                            (sc) => (
                              <SelectItem key={sc} value={sc}>
                                {sc}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                      <Label htmlFor="coldChainReq" className="text-xs font-medium cursor-pointer">
                        Cold Chain Required
                      </Label>
                      <Switch
                        id="coldChainReq"
                        checked={form.coldChainRequired}
                        onCheckedChange={(c) => updateField("coldChainRequired", c)}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-3 col-span-full">
                      <Checkbox
                        id="injControlledSub"
                        checked={form.injControlledSubstance}
                        onCheckedChange={(c) => updateField("injControlledSubstance", !!c)}
                      />
                      <Label htmlFor="injControlledSub" className="text-xs cursor-pointer font-medium">
                        Controlled Substance / Narcotic Register entry mandatory
                      </Label>
                    </div>

                    {/* Batch & Expiry Date Configuration for Injection */}
                    <div className="col-span-full p-3.5 rounded-lg border bg-background/80 shadow-xs space-y-3 border-rose-500/30">
                      <div className="flex items-center justify-between pb-1.5 border-b">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                          <span className="text-xs font-semibold text-foreground">
                            Vial Batch & Expiry Date Configuration
                          </span>
                          <Badge variant="outline" className="text-[10px] font-normal border-rose-500/30 text-rose-600 bg-rose-50/50 dark:bg-rose-950/20">
                            Required for Cold Chain & Injectable FEFO
                          </Badge>
                        </div>
                        {form.expiryDate && (
                          (() => {
                            const days = getExpiryDiffDays(form.expiryDate);
                            if (days === null) return null;
                            if (days < 0) {
                              return (
                                <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Expired {Math.abs(days)}d ago
                                </Badge>
                              );
                            }
                            if (days <= 60) {
                              return (
                                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-500/10 flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Expiring soon ({days}d left)
                                </Badge>
                              );
                            }
                            return (
                              <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-500/10 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Safe ({days}d / ~{Math.round(days / 30)}m left)
                              </Badge>
                            );
                          })()
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Batch / Lot Number</Label>
                          <Input
                            placeholder="e.g. INJ-2026-001"
                            value={form.batchNo}
                            onChange={(e) => updateField("batchNo", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">
                              Expiry Date <span className="text-destructive">*</span>
                            </Label>
                            <span className="text-[10px] text-muted-foreground">YYYY-MM-DD</span>
                          </div>
                          <Input
                            type="date"
                            value={form.expiryDate}
                            onChange={(e) => updateField("expiryDate", e.target.value)}
                            className="text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Manufacturing Date (Optional)</Label>
                          <Input
                            type="date"
                            value={form.manufacturingDate}
                            onChange={(e) => updateField("manufacturingDate", e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      {/* Quick Duration Buttons */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] text-muted-foreground mr-1">Quick Expiry Preset:</span>
                        {[
                          { label: "+6 Months", months: 6 },
                          { label: "+1 Year", months: 12 },
                          { label: "+2 Years", months: 24 },
                          { label: "+3 Years", months: 36 },
                        ].map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2 py-0 border-dashed hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-600"
                            onClick={() => updateField("expiryDate", getFutureDate(preset.months))}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 2: STOCK & INVENTORY CONFIGURATION
          ────────────────────────────────────────────────────────────── */}

          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in-50">

              {/* ── Packaging Hierarchy Card ────────────────────────────────── */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-foreground">📦 Packaging Hierarchy</span>
                    <p className="text-[10px] text-muted-foreground">
                      Define how the clinic buys vs. how it dispenses (e.g. Box → Strip → Tablet).
                      Stock is always tracked in the <strong>Base (dispensing) unit</strong>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Base Unit */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Dispensing / Base Unit <span className="text-destructive">*</span></Label>
                    <Select
                      value={form.pkgBaseUnit || form.unit}
                      onValueChange={(v) => {
                        updateField("pkgBaseUnit", v);
                        updateField("unit", v as UnitOfMeasure);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Base unit" /></SelectTrigger>
                      <SelectContent>
                        {["Tablet", "Capsule", "ml", "Vial", "Ampoule", "Kg", "Gm", "Litre", "Piece", "Strip", "Sachet", "Bottle", "Drops"].map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Stock ledger unit</p>
                  </div>

                  {/* Purchase / Box unit */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Purchase / Outer Packaging Unit <span className="text-destructive">*</span></Label>
                    <Select
                      value={form.pkgPurchaseUnit}
                      onValueChange={(v) => {
                        updateField("pkgPurchaseUnit", v);
                        updateField("openingStockUnit", v);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Purchase unit" /></SelectTrigger>
                      <SelectContent>
                        {["Box", "Bottle", "Bag", "Pack", "Carton", "Vial", "Tray", "Drum", "Piece"].map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">What the clinic orders from supplier</p>
                  </div>

                  {/* Enable/disable middle layer */}
                  <div className="space-y-1.5 flex flex-col justify-center">
                    <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                      <div>
                        <Label className="text-xs font-medium cursor-pointer">Intermediate Layer?</Label>
                        <p className="text-[10px] text-muted-foreground">e.g. Strip between Box & Tablet</p>
                      </div>
                      <Switch
                        checked={form.pkgHasIntermediate}
                        onCheckedChange={(c) => {
                          updateField("pkgHasIntermediate", c);
                          if (!c) {
                            updateField("pkgIntermediateUnit", "");
                            updateField("pkgIntermediateUnitsPerPurchase", "");
                            updateField("pkgBaseUnitsPerIntermediate", "");
                          } else {
                            updateField("pkgIntermediateUnit", form.pkgIntermediateUnit || "Strip");
                            updateField("pkgIntermediateUnitsPerPurchase", form.pkgIntermediateUnitsPerPurchase || "10");
                            updateField("pkgBaseUnitsPerIntermediate", form.pkgBaseUnitsPerIntermediate || "10");
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Intermediate Layer Row */}
                {form.pkgHasIntermediate && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 border-t border-dashed border-border/60">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Intermediate Unit Label</Label>
                      <Select
                        value={form.pkgIntermediateUnit || "Strip"}
                        onValueChange={(v) => updateField("pkgIntermediateUnit", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="e.g. Strip" /></SelectTrigger>
                        <SelectContent>
                          {["Strip", "Sachet", "Ampoule", "Blister", "Tube", "Pouch", "Vial"].map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{form.pkgIntermediateUnit || "Strip"}s per {form.pkgPurchaseUnit || "Box"}</Label>
                      <Input
                        type="number" min={1} placeholder="e.g. 10"
                        value={form.pkgIntermediateUnitsPerPurchase}
                        onChange={(e) => {
                          updateField("pkgIntermediateUnitsPerPurchase", e.target.value);
                          const total = (Number(e.target.value) || 1) * (Number(form.pkgBaseUnitsPerIntermediate) || 1);
                          updateField("pkgBaseUnitsPerPurchase", String(total));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{form.pkgBaseUnit || "Tablet"}s per {form.pkgIntermediateUnit || "Strip"}</Label>
                      <Input
                        type="number" min={1} placeholder="e.g. 10"
                        value={form.pkgBaseUnitsPerIntermediate}
                        onChange={(e) => {
                          updateField("pkgBaseUnitsPerIntermediate", e.target.value);
                          const total = (Number(form.pkgIntermediateUnitsPerPurchase) || 1) * (Number(e.target.value) || 1);
                          updateField("pkgBaseUnitsPerPurchase", String(total));
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Without intermediate layer */}
                {!form.pkgHasIntermediate && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-dashed border-border/60">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{form.pkgBaseUnit || "Base unit"}s per {form.pkgPurchaseUnit || "Box"}</Label>
                      <Input
                        type="number" min={1} placeholder="e.g. 200"
                        value={form.pkgBaseUnitsPerPurchase}
                        onChange={(e) => updateField("pkgBaseUnitsPerPurchase", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[11px] text-muted-foreground">
                        e.g. 200 ml per Bottle, 5 Vials per Box
                      </p>
                    </div>
                  </div>
                )}

                {/* Live preview of hierarchy */}
                {form.pkgBaseUnit && form.pkgPurchaseUnit && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-xs flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-primary">✓ Hierarchy:</span>
                    <span className="font-mono bg-card px-2 py-0.5 rounded border text-foreground">{form.pkgPurchaseUnit}</span>
                    {form.pkgHasIntermediate && form.pkgIntermediateUnit && (
                      <>
                        <span className="text-muted-foreground">→ {form.pkgIntermediateUnitsPerPurchase || "?"} ×</span>
                        <span className="font-mono bg-card px-2 py-0.5 rounded border text-foreground">{form.pkgIntermediateUnit}</span>
                        <span className="text-muted-foreground">→ {form.pkgBaseUnitsPerIntermediate || "?"} ×</span>
                      </>
                    )}
                    {!form.pkgHasIntermediate && (
                      <span className="text-muted-foreground">→ {form.pkgBaseUnitsPerPurchase || "?"} ×</span>
                    )}
                    <span className="font-mono bg-card px-2 py-0.5 rounded border text-foreground">{form.pkgBaseUnit}</span>
                    <span className="text-muted-foreground ml-1">
                      = <strong className="text-foreground">
                        {form.pkgHasIntermediate
                          ? (Number(form.pkgIntermediateUnitsPerPurchase) || 0) * (Number(form.pkgBaseUnitsPerIntermediate) || 0)
                          : Number(form.pkgBaseUnitsPerPurchase) || 0
                        } {form.pkgBaseUnit}(s) per {form.pkgPurchaseUnit}
                      </strong>
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">Stock tracked in {form.pkgBaseUnit}s</span>
                  </div>
                )}
              </div>

              {/* Stock Levels Card */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">
                      Authoritative Stock Levels &amp; Reorder Triggers
                    </span>
                  </div>
                  {editing && (
                    <Badge variant="outline" className="text-xs">
                      Live: {stockDisplayLabel(getTotalQty(editing.itemCode), editing.packagingHierarchy)}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {!editing ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Opening Stock ({form.openingStockUnit || form.pkgPurchaseUnit || form.unit})
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={form.openingStock}
                          onChange={(e) => updateField("openingStock", e.target.value)}
                          className="flex-1"
                        />
                        <Select
                          value={form.openingStockUnit || form.pkgPurchaseUnit || form.unit}
                          onValueChange={(v) => updateField("openingStockUnit", v)}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              form.pkgBaseUnit || form.unit,
                              ...(form.pkgHasIntermediate && form.pkgIntermediateUnit ? [form.pkgIntermediateUnit] : []),
                              ...(form.pkgPurchaseUnit && form.pkgPurchaseUnit !== (form.pkgBaseUnit || form.unit) ? [form.pkgPurchaseUnit] : []),
                            ].filter(Boolean).map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {Number(form.openingStock) > 0 && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          = {(() => {
                            const qty = Number(form.openingStock) || 0;
                            const unit = form.openingStockUnit || form.pkgPurchaseUnit || form.unit;
                            const bpp = form.pkgHasIntermediate
                              ? (Number(form.pkgIntermediateUnitsPerPurchase) || 1) * (Number(form.pkgBaseUnitsPerIntermediate) || 1)
                              : Number(form.pkgBaseUnitsPerPurchase) || 1;
                            const baseUnit = form.pkgBaseUnit || form.unit;
                            if (unit === (form.pkgPurchaseUnit || "Box")) return `${qty * bpp} ${baseUnit}s to stock`;
                            if (unit === form.pkgIntermediateUnit) return `${qty * (Number(form.pkgBaseUnitsPerIntermediate) || 1)} ${baseUnit}s to stock`;
                            return `${qty} ${baseUnit}s to stock`;
                          })()}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Automatically posts an Opening Balance to the Inventory Ledger.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 p-3 rounded-lg bg-card border">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Authoritative Live Stock
                      </Label>
                      <div className="text-lg font-bold text-foreground">
                        {stockDisplayLabel(getTotalQty(editing.itemCode), editing.packagingHierarchy)}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Mutated exclusively via auditable purchases, sales, or adjustments.
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Minimum Stock Level / Reorder Point <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="10"
                      value={form.reorderLevel}
                      onChange={(e) => updateField("reorderLevel", e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Alerts fire when current stock falls to or below this threshold.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Reorder Quantity (PO Target)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="25"
                      value={form.reorderQty}
                      onChange={(e) => updateField("reorderQty", e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Standard batch size suggested when creating Purchase Orders.
                    </p>
                  </div>
                </div>

                {/* Opening Batch & Expiry Card when initial stock > 0 or batch tracking active */}
                {(!editing && (Number(form.openingStock) > 0 || form.batchTracking)) && (
                  <div className="p-3.5 rounded-lg border bg-card/60 space-y-3 border-primary/20">
                    <div className="flex items-center justify-between pb-1.5 border-b">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          Initial Stock Batch & Expiry Allocation
                        </span>
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                          FEFO Allocation & Alerts
                        </Badge>
                      </div>
                      {form.expiryDate && (
                        (() => {
                          const days = getExpiryDiffDays(form.expiryDate);
                          if (days === null) return null;
                          if (days < 0) {
                            return (
                              <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Expired {Math.abs(days)}d ago
                              </Badge>
                            );
                          }
                          if (days <= 60) {
                            return (
                              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-500/10 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Expiring soon ({days}d left)
                              </Badge>
                            );
                          }
                          return (
                            <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-500/10 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Safe ({days}d / ~{Math.round(days / 30)}m left)
                            </Badge>
                          );
                        })()
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Batch / Lot Number</Label>
                        <Input
                          placeholder="e.g. OPN-2026-001"
                          value={form.batchNo}
                          onChange={(e) => updateField("batchNo", e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">
                            Expiry Date <span className="text-destructive">*</span>
                          </Label>
                          <span className="text-[10px] text-muted-foreground">YYYY-MM-DD</span>
                        </div>
                        <Input
                          type="date"
                          value={form.expiryDate}
                          onChange={(e) => updateField("expiryDate", e.target.value)}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Manufacturing Date (Optional)</Label>
                        <Input
                          type="date"
                          value={form.manufacturingDate}
                          onChange={(e) => updateField("manufacturingDate", e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    {/* Quick Expiry Presets */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-muted-foreground mr-1">Quick Expiry Preset:</span>
                      {[
                        { label: "+6 Months", months: 6 },
                        { label: "+1 Year", months: 12 },
                        { label: "+2 Years", months: 24 },
                        { label: "+3 Years", months: 36 },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2 py-0 border-dashed hover:bg-primary/10 hover:border-primary hover:text-primary"
                          onClick={() => updateField("expiryDate", getFutureDate(preset.months))}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Policy Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer">Batch / Lot Tracking</Label>
                    <div className="text-[11px] text-muted-foreground">
                      Track expiry & GRN batches
                    </div>
                  </div>
                  <Switch
                    checked={form.batchTracking}
                    onCheckedChange={(c) => updateField("batchTracking", c)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer">Maintain Stock</Label>
                    <div className="text-[11px] text-muted-foreground">
                      Enforce inventory balance
                    </div>
                  </div>
                  <Switch
                    checked={form.maintainStock}
                    onCheckedChange={(c) => updateField("maintainStock", c)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer">Allow Negative Stock</Label>
                    <div className="text-[11px] text-muted-foreground">
                      Bill even if physical qty is 0
                    </div>
                  </div>
                  <Switch
                    checked={form.allowNegativeStock}
                    onCheckedChange={(c) => updateField("allowNegativeStock", c)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 3: PRICING & TAX
          ────────────────────────────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Default Purchase Cost (₹) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={form.defaultPurchasePrice}
                    onChange={(e) => updateField("defaultPurchasePrice", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Selling Price / Retail Price (₹) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={form.defaultSalePrice}
                    onChange={(e) => updateField("defaultSalePrice", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Maximum Retail Price (MRP ₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={form.mrp}
                    onChange={(e) => updateField("mrp", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Minimum Allowed Sale Price (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={form.minSalePrice}
                    onChange={(e) => updateField("minSalePrice", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Max Discount Allowed (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="10"
                    value={form.maxDiscountPct}
                    onChange={(e) => updateField("maxDiscountPct", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">GST Rate (%)</Label>
                  <Select
                    value={form.gstRate}
                    onValueChange={(v) => updateField("gstRate", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="GST %" />
                    </SelectTrigger>
                    <SelectContent>
                      {GST_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}% GST
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">HSN / SAC Code</Label>
                  <Input
                    placeholder="e.g. 30049099"
                    value={form.hsnCode}
                    onChange={(e) => updateField("hsnCode", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tax Category</Label>
                  <Select
                    value={form.taxCategory}
                    onValueChange={(v) => updateField("taxCategory", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Standard", "Nil-Rated", "Exempt", "Zero-Rated"].map((tc) => (
                        <SelectItem key={tc} value={tc}>
                          {tc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Pricing Audit Verification Note</Label>
                  <Input
                    placeholder="e.g. Verified with supplier catalogue Q3"
                    value={form.samplePriceNote}
                    onChange={(e) => updateField("samplePriceNote", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 4: PURCHASING & INWARD PURCHASE BILL
          ────────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <PurchaseBillWizardSection
              currentProductName={form.name}
              currentProductUnit={form.purchaseUom || form.unit}
              currentOpeningStock={form.openingStock}
              currentPurchasePrice={form.defaultPurchasePrice}
              currentMrp={form.mrp}
              leadTimeDays={form.leadTimeDays}
              onLeadTimeDaysChange={(v) => updateField("leadTimeDays", v)}
              minOrderQty={form.minOrderQty}
              onMinOrderQtyChange={(v) => updateField("minOrderQty", v)}
              state={purchaseBillState}
              onChange={(patch) => setPurchaseBillState((prev) => ({ ...prev, ...patch }))}
              onSupplierSelected={(sup) => {
                updateField("defaultSupplierId", sup.id);
                updateField("defaultSupplierName", sup.name);
              }}
            />
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 5: SALES, ACCOUNTS & STATUS
          ────────────────────────────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">GL Income / Sales Account</Label>
                  <Input
                    value={form.incomeAccount}
                    onChange={(e) => updateField("incomeAccount", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cost Center</Label>
                  <Input
                    value={form.costCenter}
                    onChange={(e) => updateField("costCenter", e.target.value)}
                  />
                </div>
              </div>

              {/* Edit Mode Status Toggle */}
              {editing && (
                <div className="p-4 rounded-xl border bg-muted/20 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Catalogue Visibility Status</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive items remain in past invoices and historical ledger but are hidden from active billing.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={form.status === "Active" ? "default" : "secondary"}>
                      {form.status}
                    </Badge>
                    <Switch
                      checked={form.status === "Active"}
                      onCheckedChange={(c) => updateField("status", c ? "Active" : "Inactive")}
                    />
                  </div>
                </div>
              )}

              {/* Policy Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer">Available for Retail Sale</Label>
                    <div className="text-[11px] text-muted-foreground">
                      Visible in Billing & Prescription module
                    </div>
                  </div>
                  <Switch
                    checked={form.isSalesItem}
                    onCheckedChange={(c) => updateField("isSalesItem", c)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer">Allow Substitution</Label>
                    <div className="text-[11px] text-muted-foreground">
                      Permit generic substitution at checkout
                    </div>
                  </div>
                  <Switch
                    checked={form.allowAlternativeItem}
                    onCheckedChange={(c) => updateField("allowAlternativeItem", c)}
                  />
                </div>
              </div>

              {/* Summary Preview Card */}
              <div className="p-4 rounded-xl border bg-primary/5 space-y-2">
                <div className="font-semibold text-xs text-primary flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Ready to Save to Product Master
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div><strong>Item:</strong> {form.name || "—"}</div>
                  <div><strong>Type:</strong> {form.productType}</div>
                  <div><strong>Selling Price:</strong> ₹{form.defaultSalePrice || "0"}</div>
                  <div><strong>Reorder Level:</strong> {form.reorderLevel} {form.unit}s</div>
                  <div><strong>Batch No:</strong> {form.batchNo || "Auto-assigned"}</div>
                  <div><strong>Expiry Date:</strong> {form.expiryDate || "Not tracked"}</div>
                  <div><strong>Opening Stock:</strong> {form.openingStock} {form.unit}s</div>
                  <div><strong>GST Rate:</strong> {form.gstRate}%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 border-t bg-card/60 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 1 || saving}
            className="text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>

            {currentStep < 5 && !editing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleQuickSave}
                disabled={saving || !form.name.trim()}
                className="text-xs border-dashed text-primary hover:bg-primary/5 font-medium"
                title="Save immediately with standard defaults"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                Quick Save
              </Button>
            )}

            {currentStep < 5 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                className="text-xs bg-primary text-primary-foreground font-semibold"
              >
                Save & Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveProduct}
                disabled={saving}
                className="text-xs bg-primary text-primary-foreground font-semibold shadow-sm"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Saving..." : editing ? "Update Product Master" : "Save Product Master"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
