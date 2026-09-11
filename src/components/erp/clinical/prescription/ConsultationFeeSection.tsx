import React from "react";
import { IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard, type SaveStatus } from "./SectionCard";
import { cn } from "@/lib/utils";

export interface ConsultationFeeSectionProps {
  id?: string | undefined;
  amount: number | null;
  preset: string | null;
  onChangeAmount: (amt: number | null, preset: string | null) => void;
  onSave: () => Promise<void>;
  status?: SaveStatus | undefined;
  lastSavedAt?: string | undefined;
  isDirty?: boolean | undefined;
  isLocked?: boolean | undefined;
}

const PRESETS = [
  { label: "Free / Follow-up", amount: 0, code: "FREE" },
  { label: "Re-check", amount: 300, code: "RECHECK" },
  { label: "Standard", amount: 500, code: "STANDARD" },
  { label: "Specialist", amount: 800, code: "SPECIALIST" },
  { label: "Emergency / Surgery", amount: 1200, code: "EMERGENCY" },
];

export function ConsultationFeeSection({
  id = "sec-fee",
  amount,
  preset,
  onChangeAmount,
  onSave,
  status = "idle",
  lastSavedAt,
  isDirty = false,
  isLocked = false,
}: ConsultationFeeSectionProps) {
  const currentAmount = amount ?? 0;

  const handleSelectPreset = (pAmount: number, pCode: string) => {
    if (isLocked) return;
    onChangeAmount(pAmount, pCode);
  };

  const handleCustomInputChange = (valStr: string) => {
    if (isLocked) return;
    if (!valStr.trim()) {
      onChangeAmount(null, null);
      return;
    }
    const num = Math.max(0, Number(valStr) || 0);
    const matchedPreset = PRESETS.find((p) => p.amount === num);
    onChangeAmount(num, matchedPreset ? matchedPreset.code : null);
  };

  return (
    <SectionCard
      id={id}
      icon={<IndianRupee className="size-4" />}
      title="Consultation Fee"
      subtitle="Doctor consultation charges applied directly to patient billing"
      status={status}
      lastSavedAt={lastSavedAt}
      isDirty={isDirty}
      onSave={onSave}
      saveLabel="Save Fee ✓"
      isLocked={isLocked}
    >
      <div className="space-y-3">
        {/* Preset Chips */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
            Select Consultation Preset
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const isSelected =
                (preset && preset === p.code) || (!preset && amount === p.amount);

              return (
                <button
                  key={p.code}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleSelectPreset(p.amount, p.code)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 text-foreground border-border hover:bg-muted"
                  )}
                >
                  <span>{p.label}</span>
                  <span className="font-mono opacity-90">(₹{p.amount})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Input */}
        <div className="max-w-xs space-y-1 pt-1">
          <Label htmlFor="custom-consultation-fee" className="text-[11px] font-semibold text-muted-foreground">
            Custom Consultation Amount (₹)
          </Label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-bold text-muted-foreground pointer-events-none">
              ₹
            </span>
            <Input
              id="custom-consultation-fee"
              type="number"
              min={0}
              max={100000}
              disabled={isLocked}
              value={amount !== null && amount !== undefined ? amount : ""}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              placeholder="0"
              className="pl-7 font-mono font-bold text-sm h-9 bg-background"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {amount === 0 ? "₹0 fee recorded (Fee waived / Follow-up check)" : "Amount will be synced to Billing as Doctor Consultation line"}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
