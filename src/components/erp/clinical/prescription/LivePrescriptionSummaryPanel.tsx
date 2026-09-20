import React, { useMemo } from "react";
import {
  Receipt,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Save,
  Pill,
  Syringe,
  Utensils,
  ShoppingBag,
  IndianRupee,
  Clock,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { roundMoney, calcLineItem } from "@/lib/utils/moneyUtils";
import { cn } from "@/lib/utils";
import type { InventoryItemLine } from "./InventoryItemSection";

export interface LiveSummaryPanelProps {
  consultationFee: number | null;
  immediateMedicines: InventoryItemLine[];
  prescribedMedicines: InventoryItemLine[];
  injectables: InventoryItemLine[];
  animalFood: InventoryItemLine[];
  prescribedFood: InventoryItemLine[];
  accessories: InventoryItemLine[];
  hasUnsavedChanges: boolean;
  isSavingAll?: boolean | undefined;
  isProceeding?: boolean | undefined;
  onSaveAllDraft: () => Promise<void>;
  onProceedToBilling: () => void;
  onClonePrevious?: (() => void) | undefined;
  onViewHistory?: (() => void) | undefined;
  isSettled?: boolean | undefined;
  settledDate?: string | undefined;
  className?: string | undefined;
}

export function LivePrescriptionSummaryPanel({
  consultationFee,
  immediateMedicines,
  prescribedMedicines,
  injectables,
  animalFood,
  prescribedFood,
  accessories,
  hasUnsavedChanges,
  isSavingAll = false,
  isProceeding = false,
  onSaveAllDraft,
  onProceedToBilling,
  onClonePrevious,
  onViewHistory,
  isSettled = false,
  settledDate,
  className,
}: LiveSummaryPanelProps) {
  // Helper to sum a section
  const sumSection = (lines: InventoryItemLine[]) => {
    return lines.reduce((acc, line) => {
      const disc = Number(line.discountPercent) || 0;
      const calc = calcLineItem({
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unitPrice) || 0,
        discountType: disc > 0 ? "percentage" : undefined,
        discountValue: disc,
        gstRate: 0,
        applyGst: false,
      });
      return acc + calc.lineTotal;
    }, 0);
  };

  const consultTotal = consultationFee !== null && consultationFee !== undefined ? consultationFee : 0;
  const immediateTotal = useMemo(() => sumSection(immediateMedicines), [immediateMedicines]);
  const prescribedTotal = useMemo(() => sumSection(prescribedMedicines), [prescribedMedicines]);
  const injectableTotal = useMemo(() => sumSection(injectables), [injectables]);
  const animalFoodTotal = useMemo(() => sumSection(animalFood), [animalFood]);
  const prescribedFoodTotal = useMemo(() => sumSection(prescribedFood), [prescribedFood]);
  const accessoryTotal = useMemo(() => sumSection(accessories), [accessories]);

  const totalLinesCount =
    (consultTotal > 0 ? 1 : 0) +
    immediateMedicines.length +
    prescribedMedicines.length +
    injectables.length +
    animalFood.length +
    prescribedFood.length +
    accessories.length;

  const grandTotal =
    consultTotal +
    immediateTotal +
    prescribedTotal +
    injectableTotal +
    animalFoodTotal +
    prescribedFoodTotal +
    accessoryTotal;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm p-4 space-y-4 sticky top-0",
        hasUnsavedChanges && "border-amber-300/80 dark:border-amber-700/60 shadow-xs",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-border pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Receipt className="size-4 text-primary" />
            <h4 className="font-bold text-sm text-foreground">
              Prescribed Items ({totalLinesCount})
            </h4>
          </div>
          <span className="font-extrabold text-primary text-base font-mono">
            ₹{grandTotal.toFixed(2)}
          </span>
        </div>

        {/* Action Pills */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {onClonePrevious && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6.5 text-[10px] px-2 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 flex-1 justify-center"
              onClick={onClonePrevious}
            >
              <CheckCircle2 className="size-3 mr-1" /> Clone Previous
            </Button>
          )}
          {onViewHistory && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6.5 text-[10px] px-2 text-muted-foreground hover:text-foreground border border-border/60 flex-1 justify-center"
              onClick={onViewHistory}
            >
              <Clock className="size-3 mr-1" /> History
            </Button>
          )}
        </div>

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-700 dark:text-amber-300 animate-pulse">
            <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>Includes unsaved changes (Calculated live from prescription)</span>
          </div>
        )}
      </div>

      {/* Item Group List */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 text-xs">
        {/* 1. Consultation Fee */}
        {consultTotal > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1 text-foreground">
                <IndianRupee className="size-3 text-primary" /> Doctor Consultation
              </span>
              <span className="font-mono font-bold">₹{consultTotal.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Standard fee</span>
              <span>1 × ₹{consultTotal}</span>
            </div>
          </div>
        )}

        {/* 2. Immediate Medication */}
        {immediateMedicines.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Pill className="size-3 text-emerald-600" /> Immediate Meds ({immediateMedicines.length})
              </span>
              <span className="font-mono font-bold text-foreground">
                ₹{immediateTotal.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              {immediateMedicines.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs pl-2">
                  <span className="truncate max-w-[160px] text-foreground">{m.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.quantity} {m.unit} · ₹{(m.quantity * m.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Prescribed Medicine */}
        {prescribedMedicines.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Pill className="size-3 text-blue-600" /> Prescribed Meds ({prescribedMedicines.length})
              </span>
              <span className="font-mono font-bold text-foreground">
                ₹{prescribedTotal.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              {prescribedMedicines.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs pl-2">
                  <span className="truncate max-w-[160px] text-foreground">{m.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.quantity} {m.unit} · ₹{(m.quantity * m.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Injectables */}
        {injectables.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Syringe className="size-3 text-purple-600" /> Injectables ({injectables.length})
              </span>
              <span className="font-mono font-bold text-foreground">
                ₹{injectableTotal.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              {injectables.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs pl-2">
                  <span className="truncate max-w-[160px] text-foreground">{m.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.quantity} {m.unit} · ₹{(m.quantity * m.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Animal Food */}
        {animalFood.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Utensils className="size-3 text-amber-600" /> Animal Food ({animalFood.length})
              </span>
              <span className="font-mono font-bold text-foreground">
                ₹{animalFoodTotal.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              {animalFood.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs pl-2">
                  <span className="truncate max-w-[160px] text-foreground">{m.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.quantity} {m.unit} · ₹{(m.quantity * m.unitPrice * (1 - (m.discountPercent || 0) / 100)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Prescribed Food */}
        {prescribedFood.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Utensils className="size-3 text-orange-600" /> Prescribed Diet ({prescribedFood.length})
              </span>
              <span className="font-mono font-bold text-foreground">
                ₹{prescribedFoodTotal.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              {prescribedFood.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs pl-2">
                  <span className="truncate max-w-[160px] text-foreground">{m.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.quantity} {m.unit} · ₹{(m.quantity * m.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Accessories */}
        {accessories.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <ShoppingBag className="size-3 text-pink-600" /> Accessories ({accessories.length})
              </span>
              <span className="font-mono font-bold text-foreground">
                ₹{accessoryTotal.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              {accessories.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs pl-2">
                  <span className="truncate max-w-[160px] text-foreground">{m.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.quantity} · ₹{(m.quantity * m.unitPrice * (1 - (m.discountPercent || 0) / 100)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalLinesCount === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <span>No prescribed items or consultation fee added yet.</span>
          </div>
        )}
      </div>

      {/* Settled Lock Notice */}
      {isSettled && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 font-semibold space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>Bill Settled &amp; Paid</span>
          </div>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-normal">
            Billable items are locked to maintain financial integrity.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between font-extrabold text-sm text-foreground">
          <span>Estimated Total</span>
          <span className="font-mono text-primary text-base">₹{grandTotal.toFixed(2)}</span>
        </div>

        {!isSettled && (
          <Button
            type="button"
            variant="outline"
            disabled={!hasUnsavedChanges || isSavingAll || isProceeding}
            onClick={() => onSaveAllDraft()}
            className="w-full h-8 text-xs font-bold gap-1.5"
          >
            {isSavingAll ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving All Draft...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Save All Draft</span>
              </>
            )}
          </Button>
        )}

        <Button
          type="button"
          disabled={isProceeding}
          onClick={() => onProceedToBilling()}
          className="w-full h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
        >
          {isProceeding ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Proceeding to Billing...</span>
            </>
          ) : (
            <>
              <span>Proceed to Billing &amp; Settlement</span>
              <ArrowRight className="size-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
