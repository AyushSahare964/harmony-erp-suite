import React, { useState, useMemo } from "react";
import {
  Trash2,
  AlertTriangle,
  Pill,
  Syringe,
  Utensils,
  ShoppingBag,
  Check,
  Plus,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, type SaveStatus } from "./SectionCard";
import { CatalogueSearch } from "./CatalogueSearch";
import { roundMoney, calcLineItem } from "@/lib/utils/moneyUtils";
import { cn } from "@/lib/utils";

export interface InventoryItemLine {
  id: string; // stable client UUID
  itemCode?: string | undefined;
  batchNo?: string | undefined;
  name: string;
  brand?: string | undefined;
  genericName?: string | undefined;
  strength?: string | undefined;
  category?: string | undefined;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent?: number | undefined;
  dosageInstructions?: string | undefined;
  frequency?: string | undefined;
  duration?: string | undefined;
  route?: string | undefined;
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
  catalogueType: "medicine" | "food" | "accessory";
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
}

const STANDARD_MED_UNITS = [
  "Tablet",
  "Capsule",
  "Strip",
  "Bottle",
  "ml",
  "Vial",
  "Drops",
  "Sachet",
  "Tube",
  "Piece",
];

const STANDARD_FOOD_UNITS = ["Kg", "Bag", "Pack", "Can", "Pouch", "Bowl", "Piece"];
const STANDARD_ROUTES = ["Oral", "SC", "IM", "IV", "Topical", "Ophthalmic", "Otic"];

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
}: InventoryItemSectionProps) {
  // Untagged medicine fallback toggle for Injectable
  const [showAllMedicines, setShowAllMedicines] = useState(false);

  const excludeCodes = useMemo(
    () => items.map((it) => it.itemCode).filter(Boolean) as string[],
    [items]
  );

  const handleSelectItem = (rawItem: any) => {
    const unitPrice =
      rawItem.defaultSalePrice ??
      rawItem.mrp ??
      (catalogueType === "food" ? 850 : catalogueType === "accessory" ? 320 : 150);

    const defaultUnit =
      rawItem.unit ||
      (catalogueType === "food" ? "Kg" : catalogueType === "accessory" ? "Piece" : "Tablet");

    const newLine: InventoryItemLine = {
      id: generateStableId(section.toLowerCase().substring(0, 4)),
      itemCode: rawItem.itemCode,
      name: rawItem.name,
      brand: rawItem.brand,
      genericName: rawItem.genericName,
      strength: rawItem.medicineDetails?.strength,
      category: rawItem.category || rawItem.subGroup,
      quantity: 1,
      unit: defaultUnit,
      unitPrice,
      discountPercent: 0,
      dosageInstructions:
        section === "INJECTABLE"
          ? "Administered in clinic"
          : showDosage
          ? "1 tab twice daily after food"
          : undefined,
      frequency: showFrequencyDuration ? "Twice daily (BID)" : undefined,
      duration: showFrequencyDuration ? "5 days" : undefined,
      route: showRoute ? "SC" : "Oral",
      availableStock: rawItem.currentStock,
      inactive: rawItem.status === "Inactive",
      gstRate: rawItem.gstRate ?? (catalogueType === "medicine" ? 12 : 18),
    };

    onChange([...items, newLine]);
  };

  const handleUpdateLine = (lineId: string, field: keyof InventoryItemLine, value: any) => {
    onChange(
      items.map((line) => (line.id === lineId ? { ...line, [field]: value } : line))
    );
  };

  const handleRemoveLine = (lineId: string) => {
    onChange(items.filter((line) => line.id !== lineId));
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
      {/* Search Bar Container */}
      {!isLocked && (
        <div className="space-y-2">
          {section === "INJECTABLE" && (
            <div className="flex items-center justify-between pb-1 text-xs">
              <span className="text-[11px] text-muted-foreground font-medium">
                Filtered to injectable / vaccine dosage forms.
              </span>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`toggle-all-${id}`}
                  className="text-[11px] font-semibold text-muted-foreground cursor-pointer"
                >
                  Show all medicines (fallback)
                </Label>
                <Switch
                  id={`toggle-all-${id}`}
                  checked={showAllMedicines}
                  onCheckedChange={setShowAllMedicines}
                />
              </div>
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
          />
        </div>
      )}

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="py-5 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border/80 bg-muted/20">
          <span>No items added in this section yet. Search above to add.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left font-semibold text-muted-foreground">
                <th className="px-3 py-2">Item Name</th>
                {showDosage && <th className="px-3 py-2 w-48 sm:w-60">Dosage / Advice</th>}
                {showFrequencyDuration && (
                  <th className="px-2 py-2 w-32 hidden sm:table-cell">Freq / Duration</th>
                )}
                {showRoute && <th className="px-2 py-2 w-20">Route</th>}
                <th className="px-2 py-2 text-center w-20">Qty</th>
                <th className="px-2 py-2 text-center w-24">Unit</th>
                {showDiscount && <th className="px-2 py-2 text-center w-16">Disc %</th>}
                <th className="px-3 py-2 text-right w-24">Net (₹)</th>
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
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        {it.itemCode && <span className="font-mono">{it.itemCode}</span>}
                        {it.brand && <span>· {it.brand}</span>}
                        {it.strength && <span>· {it.strength}</span>}
                        <span>· ₹{it.unitPrice}/{it.unit}</span>
                      </div>
                    </td>

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
                        value={it.unit}
                        onValueChange={(val) => handleUpdateLine(it.id, "unit", val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-22 mx-auto bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(catalogueType === "food"
                            ? STANDARD_FOOD_UNITS
                            : STANDARD_MED_UNITS
                          ).map((u) => (
                            <SelectItem key={u} value={u} className="text-xs">
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

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
                    <td className="px-3 py-2 align-top text-right font-mono font-bold text-foreground">
                      ₹{lineNet.toFixed(2)}
                    </td>

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

          {/* Section Footer Subtotal */}
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
        </div>
      )}
    </SectionCard>
  );
}
