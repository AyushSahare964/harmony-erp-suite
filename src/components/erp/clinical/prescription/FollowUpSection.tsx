import React, { useState } from "react";
import {
  CalendarClock,
  Calendar,
  Syringe,
  Pill,
  FlaskConical,
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
    BLOOD_TEST: FollowUpEntry;
  };
  bloodTests: FollowUpBloodTestItem[];
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

const COMMON_LAB_TESTS = [
  "Complete Blood Count (CBC)",
  "Kidney Function Profile (BUN / Creatinine)",
  "Liver Function Biochemistry (ALT / ALP)",
  "Electrolytes Panel (Na / K / Cl)",
  "Blood Glucose STAT",
  "Pre-Operative Coagulation Panel",
  "Urinalysis & Sediment Microscopic",
  "Skin Scraping Cytology & Fungal DTM",
];

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
  const [testSearch, setTestSearch] = useState("");
  const [testDropdownOpen, setTestDropdownOpen] = useState(false);

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

  const handleAddBloodTest = (testName: string) => {
    if (isLocked) return;
    const alreadyExists = followUp.bloodTests.some((t) => t.testName === testName);
    if (alreadyExists) return;

    const newTest: FollowUpBloodTestItem = {
      id: `rx-lab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      testName,
      status: "Ordered",
    };

    onChange({
      ...followUp,
      entries: {
        ...followUp.entries,
        BLOOD_TEST: {
          ...followUp.entries.BLOOD_TEST,
          enabled: true,
          dueDate: followUp.entries.BLOOD_TEST.dueDate || baseDate,
        },
      },
      bloodTests: [...followUp.bloodTests, newTest],
    });
    setTestSearch("");
    setTestDropdownOpen(false);
  };

  const handleRemoveBloodTest = (testId: string) => {
    if (isLocked) return;
    const test = followUp.bloodTests.find((t) => t.id === testId);
    if (test?.status && test.status !== "Ordered") {
      alert(`Cannot remove test "${test.testName}": sample is already collected in the Laboratory.`);
      return;
    }
    onChange({
      ...followUp,
      bloodTests: followUp.bloodTests.filter((t) => t.id !== testId),
    });
  };

  const filteredTests = COMMON_LAB_TESTS.filter(
    (t) =>
      !followUp.bloodTests.some((existing) => existing.testName === t) &&
      t.toLowerCase().includes(testSearch.toLowerCase())
  );

  return (
    <SectionCard
      id={id}
      icon={<CalendarClock className="size-4" />}
      title="Clinical Follow-up & Reminders"
      subtitle="Schedule follow-up treatment, vaccine boosters, deworming, and laboratory tests"
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
              Enable to schedule post-treatment review, vaccinations, deworming, or lab tests
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

            {/* 5. Blood Test Follow-up & Lab Order Sync */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    disabled={isLocked}
                    checked={followUp.entries.BLOOD_TEST.enabled}
                    onCheckedChange={(checked) =>
                      handleUpdateEntry("BLOOD_TEST", { enabled: checked })
                    }
                  />
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FlaskConical className="size-3.5 text-primary" />
                    <span>5. Follow-up Blood Tests (Synced to Laboratory)</span>
                  </Label>
                </div>
                {followUp.entries.BLOOD_TEST.enabled && (
                  <span className="font-mono text-xs font-bold text-primary">
                    Scheduled: {formatDisplayDate(followUp.entries.BLOOD_TEST.dueDate) || "Not selected"}
                  </span>
                )}
              </div>

              {followUp.entries.BLOOD_TEST.enabled && (
                <div className="space-y-3 pl-7 pt-1">
                  {/* Quick date row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                      Schedule date:
                    </span>
                    {["TODAY", "7D", "1M"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleSelectQuickDate("BLOOD_TEST", code)}
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold border transition-all",
                          followUp.entries.BLOOD_TEST.quickOption === code
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-foreground border-border hover:bg-muted/80"
                        )}
                      >
                        {code === "TODAY" ? "Today" : code === "7D" ? "7 days" : "1 month"}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <Input
                        type="date"
                        disabled={isLocked}
                        value={followUp.entries.BLOOD_TEST.dueDate || ""}
                        onChange={(e) =>
                          handleUpdateEntry("BLOOD_TEST", {
                            dueDate: e.target.value,
                            quickOption: "CUSTOM",
                          })
                        }
                        className="h-7 text-xs font-mono w-34 bg-background"
                      />
                    </div>
                  </div>

                  {/* Active Blood Tests Chips */}
                  {followUp.bloodTests.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Selected Laboratory Orders ({followUp.bloodTests.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {followUp.bloodTests.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20"
                          >
                            <span>{t.testName}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] py-0 px-1 font-mono font-bold",
                                t.status === "Sample Collected"
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                  : t.status === "Completed"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              )}
                            >
                              Lab: {t.status || "Ordered"}
                            </Badge>
                            {!isLocked && t.status === "Ordered" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBloodTest(t.id)}
                                className="hover:text-destructive hover:bg-destructive/10 rounded p-0.5 transition-colors"
                                title="Remove test"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Test Search Dropdown */}
                  {!isLocked && (
                    <div className="relative">
                      <Input
                        type="text"
                        value={testSearch}
                        onChange={(e) => {
                          setTestSearch(e.target.value);
                          setTestDropdownOpen(true);
                        }}
                        onFocus={() => setTestDropdownOpen(true)}
                        placeholder="Search or pick laboratory blood test to order..."
                        className="h-8 text-xs bg-background"
                      />

                      {testDropdownOpen && (
                        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                          {filteredTests.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground text-center">
                              No matching tests found.
                            </div>
                          ) : (
                            filteredTests.map((testName) => (
                              <button
                                key={testName}
                                type="button"
                                onClick={() => handleAddBloodTest(testName)}
                                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs hover:bg-muted text-foreground flex items-center justify-between transition-colors"
                              >
                                <span>{testName}</span>
                                <Plus className="size-3 text-primary" />
                              </button>
                            ))
                          )}
                          <div className="p-1 border-t border-border/40 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTestDropdownOpen(false)}
                              className="h-6 text-[11px] px-2"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
