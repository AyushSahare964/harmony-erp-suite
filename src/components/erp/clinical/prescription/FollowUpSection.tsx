import React from "react";
import {
  CalendarClock,
  Calendar,
  Syringe,
  Pill,
  Clock,
  Check,
  Plus,
  X,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard, type SaveStatus } from "./SectionCard";
import { calculateQuickDate, formatDisplayDate } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";

export interface FollowUpEntry {
  enabled: boolean;
  dueDate: string; // YYYY-MM-DD
  quickOption?: string;
  notes?: string;
}

export interface FollowUpBloodTestItem {
  id: string; // stable client UUID
  labTestId?: string;
  testName: string;
  category?: string;
  status?: string; // "Ordered" | "Sample Collected" | "Processing" | "Completed" | "Cancelled"
}

export interface FollowUpState {
  required: boolean | null;
  entries: {
    TREATMENT: FollowUpEntry;
    CONSULTATION: FollowUpEntry;
    VACCINE: FollowUpEntry;
    DEWORMING: FollowUpEntry;
    BLOOD_TEST?: FollowUpEntry;
  };
  bloodTests?: FollowUpBloodTestItem[];
}

export interface FollowUpSectionProps {
  id?: string | undefined;
  visitDate: string; // YYYY-MM-DD
  followUp: FollowUpState;
  onChange: (updated: FollowUpState) => void;
  onSave: () => Promise<void>;
  status?: SaveStatus | undefined;
  lastSavedAt?: string | undefined;
  isDirty?: boolean | undefined;
  isLocked?: boolean | undefined;
}

export function FollowUpSection({
  id = "sec-followup",
  visitDate,
  followUp,
  onChange,
  onSave,
  status = "idle",
  lastSavedAt,
  isDirty = false,
  isLocked = false,
}: FollowUpSectionProps) {
  const baseDate = visitDate || new Date().toISOString().slice(0, 10);

  const handleToggleRequired = (req: boolean) => {
    if (isLocked) return;
    onChange({
      ...followUp,
      required: req,
    });
  };

  const handleUpdateEntry = (
    type: keyof FollowUpState["entries"],
    patch: Partial<FollowUpEntry>
  ) => {
    if (isLocked) return;
    const current = followUp.entries[type] || { enabled: false, dueDate: "" };
    onChange({
      ...followUp,
      entries: {
        ...followUp.entries,
        [type]: { ...current, ...patch },
      },
    });
  };

  const handleSelectQuickDate = (
    type: keyof FollowUpState["entries"],
    quickCode: string
  ) => {
    if (isLocked) return;
    if (quickCode === "CUSTOM") {
      handleUpdateEntry(type, { quickOption: "CUSTOM" });
      return;
    }
    const computed = calculateQuickDate(baseDate, quickCode);
    handleUpdateEntry(type, {
      dueDate: computed,
      quickOption: quickCode,
      enabled: true,
    });
  };

  return (
    <SectionCard
      id={id}
      icon={<CalendarClock className="size-4" />}
      title="6. Clinical Follow-up & Reminders"
      subtitle="Schedule follow-up treatment, consultation review, vaccine boosters, and deworming"
      status={status}
      lastSavedAt={lastSavedAt}
      isDirty={isDirty}
      onSave={onSave}
      saveLabel="Save Follow-up ✓"
      isLocked={isLocked}
    >
      <div className="space-y-4">
        {/* Required Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
          <div className="space-y-0.5">
            <Label className="text-xs font-bold text-foreground">Follow-up Required?</Label>
            <p className="text-[11px] text-muted-foreground">
              Enable to schedule post-treatment review, vaccinations, or deworming
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              {followUp.required ? "Yes" : "No"}
            </span>
            <Switch
              disabled={isLocked}
              checked={Boolean(followUp.required)}
              onCheckedChange={handleToggleRequired}
            />
          </div>
        </div>

        {followUp.required && (
          <div className="space-y-3 pt-1">
            {/* 1. Treatment Follow-up */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    disabled={isLocked}
                    checked={followUp.entries.TREATMENT.enabled}
                    onCheckedChange={(checked) =>
                      handleUpdateEntry("TREATMENT", { enabled: checked })
                    }
                  />
                  <Label className="text-xs font-bold text-foreground">
                    1. Treatment Follow-up
                  </Label>
                </div>
                {followUp.entries.TREATMENT.enabled && (
                  <span className="font-mono text-xs font-bold text-primary">
                    Due: {formatDisplayDate(followUp.entries.TREATMENT.dueDate) || "Not selected"}
                  </span>
                )}
              </div>

              {followUp.entries.TREATMENT.enabled && (
                <div className="space-y-2 pl-7 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                      Quick date:
                    </span>
                    {["3D", "5D", "7D", "14D"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleSelectQuickDate("TREATMENT", code)}
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold border transition-all",
                          followUp.entries.TREATMENT.quickOption === code
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-foreground border-border hover:bg-muted/80"
                        )}
                      >
                        {code === "3D"
                          ? "3 days"
                          : code === "5D"
                          ? "5 days"
                          : code === "7D"
                          ? "7 days"
                          : "14 days"}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <Input
                        type="date"
                        disabled={isLocked}
                        value={followUp.entries.TREATMENT.dueDate || ""}
                        onChange={(e) =>
                          handleUpdateEntry("TREATMENT", {
                            dueDate: e.target.value,
                            quickOption: "CUSTOM",
                          })
                        }
                        className="h-7 text-xs font-mono w-34 bg-background"
                      />
                    </div>
                  </div>
                  <Input
                    type="text"
                    disabled={isLocked}
                    value={followUp.entries.TREATMENT.notes || ""}
                    onChange={(e) =>
                      handleUpdateEntry("TREATMENT", { notes: e.target.value })
                    }
                    placeholder="Treatment follow-up clinical instructions / checkup notes"
                    className="h-7 text-xs bg-background"
                  />
                </div>
              )}
            </div>

            {/* 2. Consultation Follow-up */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    disabled={isLocked}
                    checked={followUp.entries.CONSULTATION.enabled}
                    onCheckedChange={(checked) =>
                      handleUpdateEntry("CONSULTATION", { enabled: checked })
                    }
                  />
                  <Label className="text-xs font-bold text-foreground">
                    2. Consultation Follow-up
                  </Label>
                </div>
                {followUp.entries.CONSULTATION.enabled && (
                  <span className="font-mono text-xs font-bold text-primary">
                    Due: {formatDisplayDate(followUp.entries.CONSULTATION.dueDate) || "Not selected"}
                  </span>
                )}
              </div>

              {followUp.entries.CONSULTATION.enabled && (
                <div className="space-y-2 pl-7 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                      Quick date:
                    </span>
                    {["7D", "15D", "1M"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleSelectQuickDate("CONSULTATION", code)}
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold border transition-all",
                          followUp.entries.CONSULTATION.quickOption === code
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-foreground border-border hover:bg-muted/80"
                        )}
                      >
                        {code === "7D" ? "7 days" : code === "15D" ? "15 days" : "1 month"}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <Input
                        type="date"
                        disabled={isLocked}
                        value={followUp.entries.CONSULTATION.dueDate || ""}
                        onChange={(e) =>
                          handleUpdateEntry("CONSULTATION", {
                            dueDate: e.target.value,
                            quickOption: "CUSTOM",
                          })
                        }
                        className="h-7 text-xs font-mono w-34 bg-background"
                      />
                    </div>
                  </div>
                  <Input
                    type="text"
                    disabled={isLocked}
                    value={followUp.entries.CONSULTATION.notes || ""}
                    onChange={(e) =>
                      handleUpdateEntry("CONSULTATION", { notes: e.target.value })
                    }
                    placeholder="Consultation notes / review instructions"
                    className="h-7 text-xs bg-background"
                  />
                </div>
              )}
            </div>

            {/* 3. Vaccine Booster Follow-up */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    disabled={isLocked}
                    checked={followUp.entries.VACCINE.enabled}
                    onCheckedChange={(checked) =>
                      handleUpdateEntry("VACCINE", { enabled: checked })
                    }
                  />
                  <Label className="text-xs font-bold text-foreground">
                    3. Vaccine Booster Follow-up
                  </Label>
                </div>
                {followUp.entries.VACCINE.enabled && (
                  <span className="font-mono text-xs font-bold text-primary">
                    Due: {formatDisplayDate(followUp.entries.VACCINE.dueDate) || "Not selected"}
                  </span>
                )}
              </div>

              {followUp.entries.VACCINE.enabled && (
                <div className="flex flex-wrap items-center gap-1.5 pl-7 pt-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                    Quick date:
                  </span>
                  {["1M", "3M", "6M", "1Y"].map((code) => (
                    <button
                      key={code}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleSelectQuickDate("VACCINE", code)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold border transition-all",
                        followUp.entries.VACCINE.quickOption === code
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      {code === "1M"
                        ? "1 month"
                        : code === "3M"
                        ? "3 months"
                        : code === "6M"
                        ? "6 months"
                        : "1 year"}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <Input
                      type="date"
                      disabled={isLocked}
                      value={followUp.entries.VACCINE.dueDate || ""}
                      onChange={(e) =>
                        handleUpdateEntry("VACCINE", {
                          dueDate: e.target.value,
                          quickOption: "CUSTOM",
                        })
                      }
                      className="h-7 text-xs font-mono w-34 bg-background"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Deworming Follow-up */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    disabled={isLocked}
                    checked={followUp.entries.DEWORMING.enabled}
                    onCheckedChange={(checked) =>
                      handleUpdateEntry("DEWORMING", { enabled: checked })
                    }
                  />
                  <Label className="text-xs font-bold text-foreground">
                    4. Deworming Booster Follow-up
                  </Label>
                </div>
                {followUp.entries.DEWORMING.enabled && (
                  <span className="font-mono text-xs font-bold text-primary">
                    Due: {formatDisplayDate(followUp.entries.DEWORMING.dueDate) || "Not selected"}
                  </span>
                )}
              </div>

              {followUp.entries.DEWORMING.enabled && (
                <div className="flex flex-wrap items-center gap-1.5 pl-7 pt-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                    Quick date:
                  </span>
                  {["1M", "3M", "6M"].map((code) => (
                    <button
                      key={code}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleSelectQuickDate("DEWORMING", code)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold border transition-all",
                        followUp.entries.DEWORMING.quickOption === code
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      {code === "1M" ? "1 month" : code === "3M" ? "3 months" : "6 months"}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <Input
                      type="date"
                      disabled={isLocked}
                      value={followUp.entries.DEWORMING.dueDate || ""}
                      onChange={(e) =>
                        handleUpdateEntry("DEWORMING", {
                          dueDate: e.target.value,
                          quickOption: "CUSTOM",
                        })
                      }
                      className="h-7 text-xs font-mono w-34 bg-background"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
