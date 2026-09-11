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
} from "lucide-react";
import {
  useInventory,
  type Medicine,
  type ProductType,
  type UnitOfMeasure,
  type ValuationMethod,
} from "./useInventoryStore";
import { peekItemCodeFn } from "@/lib/mongodb/serverFns/inventory";

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

const STEPS = [
  { id: 1, title: "Identity & Specs", desc: "Core details & category profile" },
  { id: 2, title: "Stock & Inventory", desc: "UoM, levels & tracking" },
  { id: 3, title: "Pricing & Tax", desc: "MRP, sales price & GST" },
  { id: 4, title: "Purchasing", desc: "Suppliers & lead times" },
  { id: 5, title: "Sales & Accounts", desc: "Revenue accounts & finish" },
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

  // Stock
  unit: UnitOfMeasure;
  purchaseUom: string;
  salesUom: string;
  maintainStock: boolean;
  valuationMethod: ValuationMethod;
  openingStock: string; // Used when creating
  currentStock: number; // Read-only authoritative in edit mode
  reorderLevel: string;
  reorderQty: string;
  safetyStock: string;
  storageLocation: string;
  batchTracking: boolean;
  serialTracking: boolean;
  allowNegativeStock: boolean;

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
    const pType: ProductType =
      editing.productType ||
      (editing.category === "Food" || editing.category === "Animal Food"
        ? "FOOD"
        : editing.category === "Accessory" || editing.category === "Animal Accessories"
        ? "ACCESSORY"
        : "MEDICINE");

    return {
      productType: pType,
      itemCode: editing.itemCode,
      sku: editing.sku || "",
      name: editing.name,
      genericName: editing.genericName,
      brand: editing.brand,
      manufacturer: editing.manufacturer,
      description: editing.description,
      subGroup: editing.subGroup,
      hasVariants: editing.hasVariants,

      // Medicine details
      composition: editing.medicineDetails?.composition || "",
      strength: editing.medicineDetails?.strength || "",
      dosageForm: editing.medicineDetails?.dosageForm || "",
      route: editing.medicineDetails?.route || "",
      storageCondition: editing.medicineDetails?.storageCondition || "",
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

      // Stock
      unit: editing.unit,
      purchaseUom: editing.purchaseUom,
      salesUom: editing.salesUom,
      maintainStock: editing.maintainStock,
      valuationMethod: editing.valuationMethod,
      openingStock: "0",
      currentStock: editing.currentStock ?? 0,
      reorderLevel: String(editing.reorderLevel),
      reorderQty: String(editing.reorderQty),
      safetyStock: String(editing.safetyStock),
      storageLocation: editing.storageLocation,
      batchTracking: editing.batchTracking,
      serialTracking: editing.serialTracking,
      allowNegativeStock: editing.allowNegativeStock,

      // Pricing
      defaultPurchasePrice: String(editing.defaultPurchasePrice || ""),
      defaultSalePrice: String(editing.defaultSalePrice || ""),
      mrp: String(editing.mrp || editing.defaultSalePrice || ""),
      minSalePrice: String(editing.minSalePrice || ""),
      maxDiscountPct: String(editing.maxDiscountPct || "10"),
      valuationRate: String(editing.valuationRate || ""),
      gstRate: String(editing.gstRate || "12"),
      hsnCode: editing.hsnCode,
      taxCategory: editing.taxCategory || "Standard",
      samplePriceNote: editing.samplePriceNote || "",

      // Purchasing
      defaultSupplierId: editing.defaultSupplierId,
      defaultSupplierName: editing.defaultSupplierName,
      leadTimeDays: String(editing.leadTimeDays || "7"),
      minOrderQty: String(editing.minOrderQty || "1"),
      purchaseAccount: editing.purchaseAccount || "5010 - Cost of Goods Sold",
      expenseAccount: editing.expenseAccount || "5020 - Operating Supplies",

      // Sales & Meta
      incomeAccount: editing.incomeAccount || "4010 - Sales Revenue",
      costCenter: editing.costCenter || (pType === "MEDICINE" ? "Pharmacy" : "Retail Store"),
      isSalesItem: editing.isSalesItem,
      allowAlternativeItem: editing.allowAlternativeItem,
      status: editing.status,
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
    storageCondition: "Room Temperature (15-25°C)",
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

    unit: defaultProductType === "MEDICINE" ? "Tablet" : defaultProductType === "FOOD" ? "Box" : "Piece",
    purchaseUom: "",
    salesUom: "",
    maintainStock: true,
    valuationMethod: defaultProductType === "MEDICINE" ? "FEFO" : "FIFO",
    openingStock: "0",
    currentStock: 0,
    reorderLevel: defaultProductType === "MEDICINE" ? "20" : defaultProductType === "FOOD" ? "10" : "5",
    reorderQty: defaultProductType === "MEDICINE" ? "50" : defaultProductType === "FOOD" ? "20" : "15",
    safetyStock: "5",
    storageLocation: defaultProductType === "MEDICINE" ? "Pharmacy Shelf A1" : "Retail Floor",
    batchTracking: defaultProductType === "MEDICINE",
    serialTracking: false,
    allowNegativeStock: false,

    defaultPurchasePrice: "",
    defaultSalePrice: "",
    mrp: "",
    minSalePrice: "",
    maxDiscountPct: "10",
    valuationRate: "",
    gstRate: defaultProductType === "MEDICINE" ? "12" : defaultProductType === "FOOD" ? "5" : "18",
    hsnCode: defaultProductType === "MEDICINE" ? "3004" : defaultProductType === "FOOD" ? "2309" : "4201",
    taxCategory: "Standard",
    samplePriceNote: "",

    defaultSupplierId: "",
    defaultSupplierName: "",
    leadTimeDays: "7",
    minOrderQty: "1",
    purchaseAccount: "5010 - Cost of Goods Sold",
    expenseAccount: "5020 - Operating Supplies",

    incomeAccount: "4010 - Sales Revenue",
    costCenter: defaultProductType === "MEDICINE" ? "Pharmacy" : "Retail Store",
    isSalesItem: true,
    allowAlternativeItem: false,
    status: "Active",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductMasterWizardDialog({
  open,
  onClose,
  editing,
  defaultProductType = "MEDICINE",
}: {
  open: boolean;
  onClose: () => void;
  editing?: Medicine | undefined;
  defaultProductType?: ProductType;
}) {
  const { addMedicine, updateMedicine, getTotalQty } = useInventory();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(() =>
    getDefaultFormState(editing, defaultProductType)
  );
  const [saving, setSaving] = useState(false);
  const [nextCode, setNextCode] = useState("");
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);

  const draftKey = `vetos_draft_${form.productType}`;

  // Reset or load initial data when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      const initial = getDefaultFormState(editing, defaultProductType);
      setForm(initial);

      // Check draft only when adding
      if (!editing) {
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
  }, [open, editing, defaultProductType]);

  // Peek next code for category
  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    const prefix =
      form.productType === "MEDICINE" ? "M" : form.productType === "FOOD" ? "F" : "A";
    peekItemCodeFn({ data: { prefix } })
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
          setForm(parsed.data);
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
      return true;
    }
    if (step === 2) {
      if (!form.reorderLevel || isNaN(Number(form.reorderLevel))) {
        toast.error("Valid Minimum / Reorder level is required for alerts");
        return false;
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

        unit: form.unit,
        purchaseUom: form.purchaseUom || form.unit,
        salesUom: form.salesUom || form.unit,
        maintainStock: form.maintainStock,
        valuationMethod: form.valuationMethod,
        reorderLevel: Number(form.reorderLevel) || 10,
        reorderQty: Number(form.reorderQty) || 20,
        safetyStock: Number(form.safetyStock) || 5,
        currentStock: editing ? editing.currentStock : Number(form.openingStock) || 0,
        minStockLevel: Number(form.reorderLevel) || 10,
        storageLocation: form.storageLocation.trim(),
        batchTracking: form.batchTracking,
        serialTracking: form.serialTracking,
        allowNegativeStock: form.allowNegativeStock,

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
      };

      if (editing) {
        await updateMedicine(editing.itemCode, {
          ...payload,
          status: form.status,
        } as any);
        toast.success(`Updated ${form.name} successfully`);
      } else {
        await addMedicine(payload as any);
        localStorage.removeItem(draftKey);
        toast.success(`Created ${form.name} (${nextCode || "New"}) successfully`);
      }

      onClose();
    } catch (err: any) {
      console.error("[ProductMasterWizard] Save error:", err);
      toast.error(err.message || "Failed to save product master record");
    } finally {
      setSaving(false);
    }
  };

  const getCategoryBadge = (type: ProductType) => {
    switch (type) {
      case "MEDICINE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Pill className="h-3.5 w-3.5" /> Medicine Master
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

        {/* Draft Recovery Alert */}
        {hasSavedDraft && !editing && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Found an autosaved draft for <strong>{form.productType}</strong> from{" "}
                <strong>{draftTimestamp || "earlier"}</strong>. Would you like to resume?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/30 text-amber-800 dark:text-amber-200"
                onClick={handleRestoreDraft}
              >
                Restore Draft
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleDiscardDraft}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

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

                <div className="grid grid-cols-3 gap-3 pt-1">
                  {(["MEDICINE", "FOOD", "ACCESSORY"] as ProductType[]).map((type) => {
                    const isSelected = form.productType === type;
                    const isDisabled = !!editing;
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (!isDisabled) {
                            setForm((prev) => getDefaultFormState(undefined, type));
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-card border-primary ring-1 ring-primary shadow-sm"
                            : "bg-muted/30 border-border hover:bg-muted/50"
                        } ${isDisabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      >
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            type === "MEDICINE"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : type === "FOOD"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}
                        >
                          {type === "MEDICINE" && <Pill className="h-4 w-4" />}
                          {type === "FOOD" && <Bone className="h-4 w-4" />}
                          {type === "ACCESSORY" && <Tag className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-foreground">
                            {type === "MEDICINE"
                              ? "Medicine"
                              : type === "FOOD"
                              ? "Animal Food"
                              : "Pet Accessory"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {type === "MEDICINE"
                              ? "Batch, expiry, Rx"
                              : type === "FOOD"
                              ? "Species, kibble, diet"
                              : "Gear, bowl, comfort"}
                          </div>
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
                    placeholder={
                      form.productType === "MEDICINE"
                        ? "e.g. Amoxicillin 250mg"
                        : form.productType === "FOOD"
                        ? "e.g. Royal Canin Maxi Adult 4kg"
                        : "e.g. Ergonomic Padded Dog Harness (L)"
                    }
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Generic / Scientific Name</Label>
                  <Input
                    placeholder={
                      form.productType === "MEDICINE"
                        ? "e.g. Amoxicillin Trihydrate"
                        : form.productType === "FOOD"
                        ? "e.g. Canine adult large breed diet"
                        : "e.g. Nylon Chest Harness"
                    }
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
                    placeholder={
                      form.productType === "MEDICINE"
                        ? "e.g. Antibiotics, NSAIDs"
                        : form.productType === "FOOD"
                        ? "e.g. Dog Food, Feline Diet"
                        : "e.g. Gear, Feeding, Comfort"
                    }
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
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 2: STOCK & INVENTORY CONFIGURATION
          ────────────────────────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Base Unit of Measure</Label>
                  <Select
                    value={form.unit}
                    onValueChange={(v) => updateField("unit", v as UnitOfMeasure)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select UoM" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Inventory Valuation Method</Label>
                  <Select
                    value={form.valuationMethod}
                    onValueChange={(v) => updateField("valuationMethod", v as ValuationMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valuation" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALUATION_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Storage Location / Rack</Label>
                  <Input
                    placeholder="e.g. Shelf B2, Cold Room, Display A"
                    value={form.storageLocation}
                    onChange={(e) => updateField("storageLocation", e.target.value)}
                  />
                </div>
              </div>

              {/* Stock Levels Card */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">
                      Authoritative Stock Levels & Reorder Triggers
                    </span>
                  </div>
                  {editing && (
                    <Badge variant="outline" className="text-xs">
                      Live Qty: {getTotalQty(editing.itemCode)} {form.unit}s
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {!editing ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Initial Opening Stock ({form.unit})
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={form.openingStock}
                        onChange={(e) => updateField("openingStock", e.target.value)}
                      />
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
                        {getTotalQty(editing.itemCode)} {form.unit}
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
              STEP 4: PURCHASING & SUPPLIERS
          ────────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Supplier Name</Label>
                  <Input
                    placeholder="e.g. MedVet Distributors / PetNutri / BioPharm"
                    value={form.defaultSupplierName}
                    onChange={(e) => updateField("defaultSupplierName", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Supplier ID / Code</Label>
                  <Input
                    placeholder="e.g. SUP-01"
                    value={form.defaultSupplierId}
                    onChange={(e) => updateField("defaultSupplierId", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Supplier Lead Time (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="7"
                    value={form.leadTimeDays}
                    onChange={(e) => updateField("leadTimeDays", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Minimum Order Quantity (MOQ)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={form.minOrderQty}
                    onChange={(e) => updateField("minOrderQty", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">General Ledger Purchase Account</Label>
                  <Input
                    value={form.purchaseAccount}
                    onChange={(e) => updateField("purchaseAccount", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expense Account</Label>
                  <Input
                    value={form.expenseAccount}
                    onChange={(e) => updateField("expenseAccount", e.target.value)}
                  />
                </div>
              </div>
            </div>
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
