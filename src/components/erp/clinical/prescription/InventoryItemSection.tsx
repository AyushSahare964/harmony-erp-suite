import React, { useState, useMemo } from "react";
import {
  Trash2,
  AlertTriangle,
  Plus,
  Pill,
  Clock,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, type SaveStatus } from "./SectionCard";
import { CatalogueSearch } from "./CatalogueSearch";
import { roundMoney, calcLineItem } from "@/lib/utils/moneyUtils";
import { cn } from "@/lib/utils";
import {
  getDefaultHierarchy,
  getAvailableUnits,
  convertToBase,
  convertFromBase,
  resolveUnitPrice,
  stockDisplayLabel,
  type PackagingHierarchy,
} from "@/lib/inventory/packagingUtils";

export interface InventoryItemLine {
  id: string; // stable client UUID
  itemCode?: string | undefined;
  batchNo?: string | undefined;
  name: string;
  medicineName?: string | undefined;
  brand?: string | undefined;
  genericName?: string | undefined;
  strength?: string | undefined;
  category?: string | undefined;
  dose?: number | string | undefined;
  quantity: number;
  /** The unit in which quantity is expressed (dispensing unit, e.g. Strip, Tablet, Bottle). */
  unit: string;
  /**
   * The dispensing unit selected by the vet for this line.
   * If set, `quantity` is expressed in `dispensingUnit` and `quantityBase`
   * holds the equivalent count in `packagingHierarchy.baseUnit`.
   */
  dispensingUnit?: string | undefined;
  /** Stock deduction quantity — always in the base unit (hierarchy.baseUnit). */
  quantityBase?: number | undefined;
  /** Full packaging hierarchy for this catalogue item, copied from Medicine.packagingHierarchy. */
  packagingHierarchy?: PackagingHierarchy | undefined;
  /** Outer / Purchase unit price (MRP or sale price) used to dynamically derive unit price per packaging hierarchy. */
  baseSalePrice?: number | undefined;
  unitPrice: number;
  discountPercent?: number | undefined;
  dosageInstructions?: string | undefined;
  frequency?: string | undefined;
  duration?: string | undefined;
  route?: string | undefined;
  timing?: string | undefined; // When to take: After Food, Before Food, etc.
  time?: string | undefined;   // Daily schedule: Morning & Night, 8 AM, etc.
  note?: string | undefined;   // Special parent advice
  availableStock?: number | undefined;
  inactive?: boolean | undefined;
  gstRate?: number | undefined;
}

export interface InventoryItemSectionProps {
  id: string;
  section:
    | "IMMEDIATE_MED"
    | "PRESCRIBED_MED"
    | "INJECTABLE"
    | "ANIMAL_FOOD"
    | "PRESCRIBED_FOOD"
    | "ACCESSORY";
  title: string;
  subtitle?: string | undefined;
  icon?: React.ReactNode | undefined;
  catalogueType: "medicine" | "injection" | "food" | "accessory";
  items: InventoryItemLine[];
  onChange: (items: InventoryItemLine[]) => void;
  onSave: () => Promise<void>;
  status?: SaveStatus | undefined;
  lastSavedAt?: string | undefined;
  isDirty?: boolean | undefined;
  saveLabel?: string | undefined;
  isLocked?: boolean | undefined;
  catalogItems?: any[] | undefined;
  showDosage?: boolean | undefined;
  showFrequencyDuration?: boolean | undefined;
  showRoute?: boolean | undefined;
  showDiscount?: boolean | undefined;
  /** When false, hides the Net (₹) column and the section subtotal footer. Use for PRESCRIBED_MED. Default true. */
  showPrice?: boolean | undefined;
  /** When false, hides the "+ Add custom" fallback in CatalogueSearch. Use for stock-bound sections. Default true. */
  allowCustomAdd?: boolean | undefined;
}

export const STANDARD_FREQUENCIES: Array<{ label: string; value: string; timesPerDay: number }> = [
  { label: "Twice daily (BID)", value: "Twice daily (BID)", timesPerDay: 2 },
  { label: "Once daily (OD)", value: "Once daily (OD)", timesPerDay: 1 },
  { label: "Thrice daily (TID)", value: "Thrice daily (TID)", timesPerDay: 3 },
  { label: "Four times daily (QID)", value: "Four times daily (QID)", timesPerDay: 4 },
  { label: "Every 12 Hours", value: "Every 12 Hours", timesPerDay: 2 },
  { label: "Every 8 Hours", value: "Every 8 Hours", timesPerDay: 3 },
  { label: "Every 6 Hours", value: "Every 6 Hours", timesPerDay: 4 },
  { label: "Alternate Days (QOD)", value: "Alternate Days (QOD)", timesPerDay: 0.5 },
  { label: "Once Weekly", value: "Once Weekly", timesPerDay: 1 / 7 },
  { label: "As needed (SOS)", value: "As needed (SOS)", timesPerDay: 1 },
];

export const STANDARD_MEAL_TIMINGS = [
  "After Food",
  "Before Food",
  "With Food",
  "Empty Stomach",
  "Anytime",
];

export const STANDARD_DAILY_TIMES = [
  "Morning & Night",
  "Morning only",
  "Night only",
  "Morning, Afternoon & Night",
  "8:00 AM & 8:00 PM",
  "Every 8 Hours",
  "Bedtime",
];

export const STANDARD_MED_UNITS = [
  "Tablet",
  "Capsule",
  "ml",
  "Drops",
  "Sachet",
  "Strip",
  "Bottle",
  "Vial",
  "Tube",
  "Piece",
  "Teaspoon",
];

export const STANDARD_FOOD_UNITS = ["Kg", "Bag", "Pack", "Can", "Pouch", "Bowl", "Piece"];
export const STANDARD_ROUTES = ["Oral", "Topical", "Ophthalmic", "Otic", "SC", "IM", "IV", "Inhalation"];

const POPULAR_PRESCRIBED_CHIPS = [
  "Amoxicillin",
  "Meloxicam",
  "Cefpet",
  "Pantoprazole",
  "Metronidazole",
  "Prednisolone",
  "Enrofloxacin",
];

export function computePrescriptionQty(
  dose: string | number | undefined,
  frequency: string | undefined,
  duration: string | number | undefined,
  opts?: {
    dispensingUnit?: string;
    hierarchy?: PackagingHierarchy;
  }
): { baseQty: number; displayQty: number } {
  const dNum = Math.max(0.25, parseFloat(String(dose ?? 1)) || 1);
  const durMatch = String(duration ?? "5").match(/\d+(\.\d+)?/);
  const days = durMatch ? Math.max(1, parseFloat(durMatch[0])) : 5;
  const freqObj = STANDARD_FREQUENCIES.find((f) => f.value === frequency);
  const timesPerDay = freqObj ? freqObj.timesPerDay : (
    /bid|twice/i.test(String(frequency)) ? 2 :
    /tid|thrice/i.test(String(frequency)) ? 3 :
    /qid|four/i.test(String(frequency)) ? 4 :
    /od|once/i.test(String(frequency)) ? 1 : 2
  );

  // baseQty = units in the base (stock tracking) unit
  const baseQty = Math.max(1, Math.ceil(dNum * timesPerDay * days));

  if (!opts?.dispensingUnit || !opts?.hierarchy) {
    return { baseQty, displayQty: baseQty };
  }

  // displayQty = what the vet sees / writes on the prescription
  const displayQty = Math.max(
    1,
    Math.ceil(convertFromBase(baseQty, opts.dispensingUnit, opts.hierarchy))
  );
  return { baseQty, displayQty };
}

export function buildPrescriptionDirection(it: Partial<InventoryItemLine>): string {
  const dose = `${it.dose !== undefined && it.dose !== null ? it.dose : 1} ${it.unit || "Tablet"}`;
  const freq = it.frequency || "Twice daily (BID)";
  const dur = it.duration ? (String(it.duration).toLowerCase().includes("day") ? String(it.duration) : `${it.duration} days`) : "5 days";
  
  const whenParts: string[] = [];
  if (it.timing) whenParts.push(it.timing);
  if (it.time) whenParts.push(it.time);
  const whenStr = whenParts.length > 0 ? whenParts.join(" (") + (whenParts.length > 1 ? ")" : "") : "After Food";

  const parts = [dose, freq, whenStr, `for ${dur}`];
  if (it.route && it.route !== "Oral") {
    parts.unshift(it.route);
  }
  if (it.note && it.note.trim()) {
    parts.push(`Note: ${it.note.trim()}`);
  }
  return parts.join(" · ");
}

function generateStableId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function InventoryItemSection({
  id,
  section,
  title,
  subtitle,
  icon,
  catalogueType,
  items,
  onChange,
  onSave,
  status = "idle",
  lastSavedAt,
  isDirty = false,
  saveLabel,
  isLocked = false,
  catalogItems = [],
  showDosage = false,
  showFrequencyDuration = false,
  showRoute = false,
  showDiscount = false,
  showPrice = true,
  allowCustomAdd = true,
}: InventoryItemSectionProps) {
  // Inline add state for Prescribed Medicine (free-text or click from popular)
  const [prescribedAddName, setPrescribedAddName] = useState("");

  const excludeCodes = useMemo(
    () => items.map((it) => it.itemCode).filter(Boolean) as string[],
    [items]
  );

  const handleSelectItem = (rawItem: any) => {
    const fullPrice =
      rawItem.defaultSalePrice ??
      rawItem.mrp ??
      (catalogueType === "food" ? 850 : catalogueType === "accessory" ? 320 : catalogueType === "injection" ? 200 : 150);

    const defaultUnit =
      rawItem.unit ||
      (catalogueType === "food" ? "Kg" : catalogueType === "accessory" ? "Piece" : catalogueType === "injection" ? "Vial" : "Tablet");

    const hierarchy: PackagingHierarchy = rawItem.packagingHierarchy ?? getDefaultHierarchy(rawItem.unit || defaultUnit);
    const dispensingUnit = hierarchy.baseUnit || defaultUnit;

    if (section === "PRESCRIBED_MED") {
      const defaultDose = 1;
      const defaultFreq = "Twice daily (BID)";
      const defaultDur = "5 days";
      const defaultTiming = "After Food";
      const defaultTime = "Morning & Night";
      const defaultRoute = "Oral";
      const { baseQty, displayQty } = computePrescriptionQty(defaultDose, defaultFreq, defaultDur, { dispensingUnit, hierarchy });

      const newLine: InventoryItemLine = {
        id: generateStableId("prx"),
        itemCode: rawItem.itemCode,
        name: rawItem.name,
        medicineName: rawItem.name,
        brand: rawItem.brand,
        genericName: rawItem.genericName,
        strength: rawItem.medicineDetails?.strength,
        category: rawItem.category || rawItem.subGroup,
        dose: defaultDose,
        quantity: displayQty,
        quantityBase: baseQty,
        unit: dispensingUnit,
        dispensingUnit,
        packagingHierarchy: hierarchy,
        baseSalePrice: fullPrice,
        unitPrice: 0,
        discountPercent: 0,
        frequency: defaultFreq,
        duration: defaultDur,
        timing: defaultTiming,
        time: defaultTime,
        route: defaultRoute,
        note: "",
        availableStock: rawItem.currentStock,
      };
      newLine.dosageInstructions = buildPrescriptionDirection(newLine);
      onChange([...items, newLine]);
      return;
    }

    const initialUnitPrice = hierarchy ? resolveUnitPrice(fullPrice, dispensingUnit, hierarchy) : fullPrice;

    const newLine: InventoryItemLine = {
      id: generateStableId(section.toLowerCase().substring(0, 4)),
      itemCode: rawItem.itemCode,
      name: rawItem.name,
      medicineName: rawItem.name,
      brand: rawItem.brand,
      genericName: rawItem.genericName,
      strength: rawItem.medicineDetails?.strength,
      category: rawItem.category || rawItem.subGroup,
      dose: 1,
      quantity: 1,
      quantityBase: hierarchy ? convertToBase(1, dispensingUnit, hierarchy) : 1,
      unit: dispensingUnit,
      dispensingUnit,
      packagingHierarchy: hierarchy,
      baseSalePrice: fullPrice,
      unitPrice: initialUnitPrice,
      discountPercent: 0,
      dosageInstructions:
        section === "INJECTABLE"
          ? "Administered in clinic"
          : section === "IMMEDIATE_MED"
          ? "Administered at clinic"
          : showDosage
          ? "1 tab twice daily after food"
          : undefined,
      frequency: showFrequencyDuration ? "Twice daily (BID)" : undefined,
      duration: showFrequencyDuration ? "5 days" : undefined,
      route: showRoute ? (section === "INJECTABLE" ? "SC" : "Oral") : "Oral",
      time: section === "IMMEDIATE_MED" ? "Immediate" : undefined,
      timing: section === "IMMEDIATE_MED" ? "Immediate" : undefined,
      availableStock: rawItem.currentStock,
      inactive: rawItem.status === "Inactive",
      gstRate: rawItem.gstRate ?? (catalogueType === "medicine" || catalogueType === "injection" ? 12 : 18),
    };

    onChange([...items, newLine]);
  };

  const handleUpdateLine = (lineId: string, field: keyof InventoryItemLine, value: any) => {
    onChange(
      items.map((line) => {
        if (line.id !== lineId) return line;
        const updated = { ...line, [field]: value };

        // Synchronize unit & dispensingUnit
        if (field === "unit") {
          updated.dispensingUnit = value;
        } else if (field === "dispensingUnit") {
          updated.unit = value;
        }

        // Auto-recalculate quantity for PRESCRIBED_MED if dose, frequency, duration, or unit changed
        if (section === "PRESCRIBED_MED") {
          if (field === "dose" || field === "frequency" || field === "duration" || field === "dispensingUnit" || field === "unit") {
            const hierarchy = updated.packagingHierarchy;
            const dUnit = updated.dispensingUnit || updated.unit;
            const { baseQty, displayQty } = computePrescriptionQty(
              updated.dose,
              updated.frequency,
              updated.duration,
              hierarchy ? { dispensingUnit: dUnit, hierarchy } : undefined
            );
            updated.quantity = displayQty;
            updated.quantityBase = baseQty;
            if ((field === "dispensingUnit" || field === "unit") && hierarchy && updated.baseSalePrice) {
              updated.unitPrice = resolveUnitPrice(updated.baseSalePrice, dUnit, hierarchy);
            }
          }
          updated.dosageInstructions = buildPrescriptionDirection(updated);
        } else if (section === "IMMEDIATE_MED") {
          if (field === "dose" || field === "dispensingUnit" || field === "unit") {
            const hierarchy = updated.packagingHierarchy;
            const dUnit = updated.dispensingUnit || updated.unit;
            const doseNum = Number(updated.dose);
            const doseVal = isNaN(doseNum) || doseNum <= 0 ? 1 : doseNum;
            const baseQty = hierarchy ? convertToBase(doseVal, dUnit, hierarchy) : doseVal;
            updated.quantity = doseVal;
            updated.quantityBase = baseQty;

            if ((field === "dispensingUnit" || field === "unit") && hierarchy) {
              const basePrice = updated.baseSalePrice ?? (hierarchy.baseUnitsPerPurchase ? updated.unitPrice * hierarchy.baseUnitsPerPurchase : updated.unitPrice);
              if (basePrice > 0) {
                updated.unitPrice = resolveUnitPrice(basePrice, dUnit, hierarchy);
              }
            }
          }
        } else {
          if (field === "quantity" || field === "dispensingUnit" || field === "unit") {
            const hierarchy = updated.packagingHierarchy;
            const dUnit = updated.dispensingUnit || updated.unit;
            const qtyNum = Number(updated.quantity);
            const qtyVal = isNaN(qtyNum) || qtyNum <= 0 ? 1 : qtyNum;
            const baseQty = hierarchy ? convertToBase(qtyVal, dUnit, hierarchy) : qtyVal;
            updated.quantity = qtyVal;
            updated.quantityBase = baseQty;

            if ((field === "dispensingUnit" || field === "unit") && hierarchy) {
              const basePrice = updated.baseSalePrice ?? (hierarchy.baseUnitsPerPurchase ? updated.unitPrice * hierarchy.baseUnitsPerPurchase : updated.unitPrice);
              if (basePrice > 0) {
                updated.unitPrice = resolveUnitPrice(basePrice, dUnit, hierarchy);
              }
            }
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveLine = (lineId: string) => {
    onChange(items.filter((line) => line.id !== lineId));
  };

  // Inline add handler for Prescribed Medicine — free-text or chosen name
  const handleAddPrescribedWithName = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;

    const defaultDose = 1;
    const defaultUnit = "Tablet";
    const defaultFreq = "Twice daily (BID)";
    const defaultDur = "5 days";
    const defaultTiming = "After Food";
    const defaultTime = "Morning & Night";
    const defaultRoute = "Oral";
    const defaultQty = computePrescriptionQty(defaultDose, defaultFreq, defaultDur).displayQty;

    const newLine: InventoryItemLine = {
      id: generateStableId("prx"),
      name: trimmed,
      medicineName: trimmed,
      dose: defaultDose,
      quantity: defaultQty,
      unit: defaultUnit,
      unitPrice: 0, // prescribed (take-home) — clinic is not charging for this
      discountPercent: 0,
      frequency: defaultFreq,
      duration: defaultDur,
      timing: defaultTiming,
      time: defaultTime,
      route: defaultRoute,
      note: "",
    };
    newLine.dosageInstructions = buildPrescriptionDirection(newLine);
    onChange([...items, newLine]);
    setPrescribedAddName("");
  };

  const sectionSubtotal = useMemo(() => {
    return items.reduce((sum, line) => {
      const disc = Number(line.discountPercent) || 0;
      const calc = calcLineItem({
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unitPrice) || 0,
        discountType: disc > 0 ? "percentage" : undefined,
        discountValue: disc,
        gstRate: 0,
        applyGst: false,
      });
      return sum + calc.lineTotal;
    }, 0);
  }, [items]);

  return (
    <SectionCard
      id={id}
      icon={icon}
      title={title}
      subtitle={subtitle}
      status={status}
      lastSavedAt={lastSavedAt}
      isDirty={isDirty}
      onSave={onSave}
      saveLabel={saveLabel || `Save ${title}`}
      isLocked={isLocked}
    >
      {/* Search / Add Bar Container */}
      {!isLocked && (
        <div className="space-y-2">
          {section === "PRESCRIBED_MED" ? (
            <div className="space-y-2">
              {/* Free-text input with button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    value={prescribedAddName}
                    onChange={(e) => setPrescribedAddName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && prescribedAddName.trim()) {
                        handleAddPrescribedWithName(prescribedAddName);
                      }
                    }}
                    placeholder="Type medicine name (e.g. Amoxicillin, Meloxicam, Cefpet) and press Add..."
                    className="h-9 text-xs bg-background pl-8"
                  />
                  <Pill className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!prescribedAddName.trim()}
                  onClick={() => handleAddPrescribedWithName(prescribedAddName)}
                  className="h-9 text-xs font-bold px-3 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground shrink-0"
                >
                  <Plus className="size-3.5 mr-1" /> Add Medicine
                </Button>
              </div>

              {/* Popular Medicine Quick Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mr-0.5">
                  <Sparkles className="size-3 text-amber-500" /> Quick add:
                </span>
                {POPULAR_PRESCRIBED_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddPrescribedWithName(chip)}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {section === "INJECTABLE" && (
                <div className="flex items-center pb-1 text-xs">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Filtered to injectable / vaccine dosage forms.
                  </span>
                </div>
              )}
              <CatalogueSearch
                type={catalogueType}
                placeholder={
                  catalogueType === "food"
                    ? "Search food items by name, brand, formula, or bag size..."
                    : catalogueType === "accessory"
                    ? "Search accessories by name, category, or type..."
                    : section === "INJECTABLE"
                    ? "Search injectable medicines, vaccines, or vials..."
                    : "Search medicines by brand, generic name, or composition..."
                }
                onSelect={handleSelectItem}
                excludeCodes={excludeCodes}
                catalogItems={catalogItems}
                autoClearOnSelect={true}
                allowCustomAdd={allowCustomAdd}
              />
            </>
          )}
        </div>
      )}

      {/* Items Display Area */}
      {items.length === 0 ? (
        <div className="py-5 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border/80 bg-muted/20">
          <span>
            {section === "PRESCRIBED_MED"
              ? "No prescribed medicines added yet. Type a medicine name above or pick a quick chip."
              : "No items added in this section yet. Search above to add."}
          </span>
        </div>
      ) : section === "PRESCRIBED_MED" ? (
        /* ══════════════════════════════════════════════════════════════════════════
           PRESCRIBED MEDICINE: Structured Dynamic Cards with Time, Timing, Dose
           ══════════════════════════════════════════════════════════════════════════ */
        <div className="space-y-3">
          {items.map((it, idx) => {
            const freqObj = STANDARD_FREQUENCIES.find((f) => f.value === it.frequency);
            const timesPerDay = freqObj ? freqObj.timesPerDay : 2;
            const daysNum = it.duration ? (parseFloat(String(it.duration).match(/\d+/)?.[0] || "5") || 5) : 5;

            return (
              <div
                key={it.id}
                className="rounded-lg border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-b from-blue-50/20 to-card p-3 shadow-xs transition-all hover:border-blue-300 dark:hover:border-blue-800"
              >
                {/* Header: Medicine Title + Badges + Actions */}
                <div className="flex items-center justify-between pb-2 border-b border-border/60 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          disabled={isLocked}
                          value={it.name}
                          onChange={(e) => {
                            handleUpdateLine(it.id, "name", e.target.value);
                            handleUpdateLine(it.id, "medicineName", e.target.value);
                          }}
                          className="h-7 text-xs font-bold w-48 sm:w-64 bg-background border-border"
                          placeholder="Medicine name"
                        />
                        <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50/50 dark:bg-blue-950/40">
                          {it.route || "Oral"} · {it.unit || "Tablet"}
                        </Badge>
                      </div>
                      {(it.brand || it.genericName || it.strength) && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          {it.brand && <span>Brand: {it.brand}</span>}
                          {it.strength && <span>· {it.strength}</span>}
                          {it.genericName && <span>· ({it.genericName})</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] bg-blue-100/70 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded font-mono font-semibold">
                      <span>Total: {it.quantity} {it.unit}</span>
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(it.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove medicine"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Parameters Grid */}
                <div className="pt-2.5 space-y-2.5">
                  {/* Row 1: Dose, Unit, Route, Frequency, Duration */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {/* Dose */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Dose Amount
                      </label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        disabled={isLocked}
                        value={it.dose !== undefined && it.dose !== null ? it.dose : 1}
                        onChange={(e) => handleUpdateLine(it.id, "dose", e.target.value)}
                        className="h-8 text-xs font-mono font-bold bg-background text-center"
                        placeholder="1"
                      />
                    </div>

                    {/* Unit / Form — hierarchy-aware */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Form / Unit
                      </label>
                      <Select
                        disabled={isLocked}
                        value={it.dispensingUnit || it.unit || "Tablet"}
                        onValueChange={(val) => handleUpdateLine(it.id, "dispensingUnit", val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Show hierarchy-aware units first if available */}
                          {it.packagingHierarchy
                            ? getAvailableUnits(it.packagingHierarchy).map((u) => (
                                <SelectItem key={u} value={u} className="text-xs">
                                  {u}
                                </SelectItem>
                              ))
                            : STANDARD_MED_UNITS.map((u) => (
                                <SelectItem key={u} value={u} className="text-xs">
                                  {u}
                                </SelectItem>
                              ))
                          }
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Route */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Route
                      </label>
                      <Select
                        disabled={isLocked}
                        value={it.route || "Oral"}
                        onValueChange={(val) => handleUpdateLine(it.id, "route", val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STANDARD_ROUTES.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Frequency
                      </label>
                      <Select
                        disabled={isLocked}
                        value={it.frequency || "Twice daily (BID)"}
                        onValueChange={(val) => handleUpdateLine(it.id, "frequency", val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STANDARD_FREQUENCIES.map((f) => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Duration (Days) */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Duration</span>
                        <span className="text-[9px] text-muted-foreground font-normal">days</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          disabled={isLocked}
                          value={it.duration || "5 days"}
                          onChange={(e) => handleUpdateLine(it.id, "duration", e.target.value)}
                          className="h-8 text-xs font-mono bg-background text-center"
                          placeholder="e.g. 5 days"
                        />
                      </div>
                      {/* Quick chips for duration */}
                      {!isLocked && (
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          {["3", "5", "7", "10", "14"].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => handleUpdateLine(it.id, "duration", `${d} days`)}
                              className={cn(
                                "text-[9px] px-1 py-0.2 rounded border transition-colors",
                                it.duration?.toString().startsWith(d)
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {d}d
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: When to take (Meal), Time Schedule, Total Qty, Special Advice */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40">
                    {/* Meal Timing (When to take) */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Clock className="size-3 text-blue-600" /> When to Take
                      </label>
                      <Select
                        disabled={isLocked}
                        value={it.timing || "After Food"}
                        onValueChange={(val) => handleUpdateLine(it.id, "timing", val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STANDARD_MEAL_TIMINGS.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Specific Time Schedule */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar className="size-3 text-blue-600" /> Daily Time / Schedule
                      </label>
                      <div className="space-y-1">
                        <Select
                          disabled={isLocked}
                          value={
                            STANDARD_DAILY_TIMES.includes(it.time || "")
                              ? it.time
                              : "custom"
                          }
                          onValueChange={(val) => {
                            if (val !== "custom") {
                              handleUpdateLine(it.id, "time", val);
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background font-medium">
                            <SelectValue placeholder="Select or type schedule..." />
                          </SelectTrigger>
                          <SelectContent>
                            {STANDARD_DAILY_TIMES.map((dt) => (
                              <SelectItem key={dt} value={dt} className="text-xs">
                                {dt}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom" className="text-xs italic text-muted-foreground">
                              Custom time...
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {(!STANDARD_DAILY_TIMES.includes(it.time || "") || it.time === "") && (
                          <Input
                            type="text"
                            disabled={isLocked}
                            value={it.time || ""}
                            onChange={(e) => handleUpdateLine(it.id, "time", e.target.value)}
                            placeholder="e.g. 8:00 AM & 8:00 PM"
                            className="h-7 text-xs bg-background font-mono"
                          />
                        )}
                      </div>
                    </div>

                    {/* Total Quantity (Calculated with manual override) */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Total Quantity</span>
                        <span className="text-[9px] text-muted-foreground font-normal">
                          ({it.dose || 1} × {timesPerDay} × {daysNum}d)
                        </span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          disabled={isLocked}
                          value={it.quantity}
                          onChange={(e) =>
                            handleUpdateLine(
                              it.id,
                              "quantity",
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                          className="h-8 text-xs font-mono font-bold text-center bg-background"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isLocked}
                          onClick={() => {
                            const recomputed = computePrescriptionQty(it.dose, it.frequency, it.duration).displayQty;
                            handleUpdateLine(it.id, "quantity", recomputed);
                          }}
                          title="Recalculate total quantity from dose × frequency × duration"
                          className="h-8 px-2 text-[10px] text-blue-600 hover:text-blue-800 shrink-0"
                        >
                          Auto
                        </Button>
                      </div>
                    </div>

                    {/* Special Advice / Parent Notes */}
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Info className="size-3 text-blue-600" /> Parent Advice / Notes
                      </label>
                      <Input
                        type="text"
                        disabled={isLocked}
                        value={it.note || ""}
                        onChange={(e) => handleUpdateLine(it.id, "note", e.target.value)}
                        placeholder="e.g. Give with curd/treat; finish course"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  {/* Row 3: Live Formatted Prescription Instruction Strip */}
                  <div className="mt-2 px-3 py-1.5 rounded-md bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold shrink-0">📋 Rx Direction:</span>
                      <span className="truncate font-medium">
                        {it.dosageInstructions || buildPrescriptionDirection(it)}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0 bg-white/60 dark:bg-slate-900/60 border-blue-300 text-blue-800 dark:text-blue-200">
                      Dispense: {it.quantity} {it.unit}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════════
           STANDARD TABLE: Immediate Med, Injectables, Food, Accessories
           ══════════════════════════════════════════════════════════════════════════ */
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left font-semibold text-muted-foreground">
                <th className="px-3 py-2">Item Name</th>
                {section === "IMMEDIATE_MED" ? (
                  <>
                    <th className="px-2 py-2 text-center w-20">Dose</th>
                    <th className="px-2 py-2 text-center w-24">Unit</th>
                    <th className="px-2 py-2 text-center w-24">Route</th>
                    <th className="px-2 py-2 text-center w-28">Timing</th>
                  </>
                ) : (
                  <>
                    {showDosage && <th className="px-3 py-2 w-48 sm:w-60">Dosage / Advice</th>}
                    {showFrequencyDuration && (
                      <th className="px-2 py-2 w-32 hidden sm:table-cell">Freq / Duration</th>
                    )}
                    {showRoute && <th className="px-2 py-2 w-20">Route</th>}
                    <th className="px-2 py-2 text-center w-20">Qty</th>
                    <th className="px-2 py-2 text-center w-24">Unit</th>
                  </>
                )}
                {showDiscount && <th className="px-2 py-2 text-center w-16">Disc %</th>}
                {showPrice && <th className="px-3 py-2 text-right w-24">Net (₹)</th>}
                {!isLocked && <th className="px-2 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((it) => {
                const disc = Number(it.discountPercent) || 0;
                const lineNet = roundMoney(
                  it.quantity * it.unitPrice * (1 - disc / 100)
                );
                const isStockLow =
                  typeof it.availableStock === "number" &&
                  it.quantity > it.availableStock;

                return (
                  <tr key={it.id} className="hover:bg-muted/20 transition-colors">
                    {/* Item details */}
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground">{it.name}</span>
                        {it.inactive && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1">
                            Inactive
                          </Badge>
                        )}
                        {isStockLow && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium"
                            title={`Available in stock: ${it.availableStock}`}
                          >
                            <AlertTriangle className="size-3" />
                            <span>Stock low ({it.availableStock})</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {it.itemCode && <span className="font-mono">{it.itemCode}</span>}
                        {it.brand && <span>· {it.brand}</span>}
                        {it.strength && <span>· {it.strength}</span>}
                        <span>· ₹{Number(it.unitPrice).toFixed(2)}/{it.unit}</span>
                        {it.packagingHierarchy && it.baseSalePrice && it.packagingHierarchy.baseUnitsPerPurchase > 1 && it.unit !== it.packagingHierarchy.purchaseUnit && (
                          <span className="text-[9px] text-muted-foreground/80 font-normal">
                            (₹{Number(it.baseSalePrice).toFixed(0)}/{it.packagingHierarchy.purchaseUnit})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Dedicated columns for IMMEDIATE_MED */}
                    {section === "IMMEDIATE_MED" ? (
                      <>
                        {/* Dose */}
                        <td className="px-2 py-2 align-top text-center">
                          <Input
                            type="number"
                            step="any"
                            min="0.1"
                            disabled={isLocked}
                            value={it.dose !== undefined && it.dose !== null ? it.dose : 1}
                            onChange={(e) => handleUpdateLine(it.id, "dose", e.target.value)}
                            className="h-7 w-16 text-center text-xs font-mono mx-auto bg-background"
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-2 py-2 align-top text-center">
                          <Select
                            disabled={isLocked}
                            value={it.dispensingUnit || it.unit || "Tablet"}
                            onValueChange={(val) => handleUpdateLine(it.id, "unit", val)}
                          >
                            <SelectTrigger className="h-7 text-xs w-22 mx-auto bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {it.packagingHierarchy ? (
                                getAvailableUnits(it.packagingHierarchy).map((u) => (
                                  <SelectItem key={u} value={u} className="text-xs">
                                    {u}
                                  </SelectItem>
                                ))
                              ) : (
                                STANDARD_MED_UNITS.map((u) => (
                                  <SelectItem key={u} value={u} className="text-xs">
                                    {u}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Route */}
                        <td className="px-2 py-2 align-top text-center">
                          <Select
                            disabled={isLocked}
                            value={it.route || "Oral"}
                            onValueChange={(val) => handleUpdateLine(it.id, "route", val)}
                          >
                            <SelectTrigger className="h-7 text-xs w-20 mx-auto bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STANDARD_ROUTES.map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Timing */}
                        <td className="px-2 py-2 align-top text-center">
                          <Input
                            type="text"
                            disabled={isLocked}
                            value={it.time || "Immediate"}
                            onChange={(e) => {
                              handleUpdateLine(it.id, "time", e.target.value);
                              handleUpdateLine(it.id, "timing", e.target.value);
                            }}
                            placeholder="Immediate"
                            className="h-7 text-xs text-center bg-background"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Dosage Instructions */}
                        {showDosage && (
                          <td className="px-3 py-2 align-top">
                            <Input
                              type="text"
                              disabled={isLocked}
                              value={it.dosageInstructions || ""}
                              onChange={(e) =>
                                handleUpdateLine(it.id, "dosageInstructions", e.target.value)
                              }
                              placeholder="e.g. 1 tab twice daily"
                              className="h-7 text-xs bg-background"
                            />
                          </td>
                        )}

                        {/* Frequency / Duration */}
                        {showFrequencyDuration && (
                          <td className="px-2 py-2 align-top hidden sm:table-cell">
                            <div className="space-y-1">
                              <Input
                                type="text"
                                disabled={isLocked}
                                value={it.frequency || ""}
                                onChange={(e) =>
                                  handleUpdateLine(it.id, "frequency", e.target.value)
                                }
                                placeholder="e.g. BID"
                                className="h-6 text-[11px] bg-background"
                              />
                              <Input
                                type="text"
                                disabled={isLocked}
                                value={it.duration || ""}
                                onChange={(e) =>
                                  handleUpdateLine(it.id, "duration", e.target.value)
                                }
                                placeholder="e.g. 5 days"
                                className="h-6 text-[11px] bg-background"
                              />
                            </div>
                          </td>
                        )}

                        {/* Route (Injectables) */}
                        {showRoute && (
                          <td className="px-2 py-2 align-top">
                            <Select
                              disabled={isLocked}
                              value={it.route || "SC"}
                              onValueChange={(val) => handleUpdateLine(it.id, "route", val)}
                            >
                              <SelectTrigger className="h-7 text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STANDARD_ROUTES.map((r) => (
                                  <SelectItem key={r} value={r} className="text-xs">
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}

                        {/* Quantity */}
                        <td className="px-2 py-2 align-top text-center">
                          <Input
                            type="number"
                            min={1}
                            disabled={isLocked}
                            value={it.quantity}
                            onChange={(e) =>
                              handleUpdateLine(
                                it.id,
                                "quantity",
                                Math.max(1, Number(e.target.value) || 1)
                              )
                            }
                            className="h-7 w-16 text-center text-xs font-mono mx-auto bg-background"
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-2 py-2 align-top text-center">
                          <Select
                            disabled={isLocked}
                            value={it.dispensingUnit || it.unit}
                            onValueChange={(val) => handleUpdateLine(it.id, "unit", val)}
                          >
                            <SelectTrigger className="h-7 text-xs w-22 mx-auto bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {it.packagingHierarchy ? (
                                getAvailableUnits(it.packagingHierarchy).map((u) => (
                                  <SelectItem key={u} value={u} className="text-xs">
                                    {u}
                                  </SelectItem>
                                ))
                              ) : (
                                (catalogueType === "food"
                                  ? STANDARD_FOOD_UNITS
                                  : STANDARD_MED_UNITS
                                ).map((u) => (
                                  <SelectItem key={u} value={u} className="text-xs">
                                    {u}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                      </>
                    )}

                    {/* Discount */}
                    {showDiscount && (
                      <td className="px-2 py-2 align-top text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          disabled={isLocked}
                          value={it.discountPercent ?? 0}
                          onChange={(e) =>
                            handleUpdateLine(
                              it.id,
                              "discountPercent",
                              Math.min(100, Math.max(0, Number(e.target.value) || 0))
                            )
                          }
                          className="h-7 w-14 text-center text-xs font-mono mx-auto bg-background"
                        />
                      </td>
                    )}

                    {/* Net Total */}
                    {showPrice && (
                      <td className="px-3 py-2 align-top text-right font-mono font-bold text-foreground">
                        ₹{lineNet.toFixed(2)}
                      </td>
                    )}

                    {/* Remove Action */}
                    {!isLocked && (
                      <td className="px-2 py-2 align-top text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(it.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Section Footer Subtotal — hidden when showPrice=false (e.g. Prescribed Medicine) */}
          {showPrice && (
            <div className="px-4 py-2 bg-muted/20 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {items.length} item(s) in {title}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-semibold">Subtotal:</span>
                <span className="font-mono font-extrabold text-foreground">
                  ₹{sectionSubtotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
