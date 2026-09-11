import React, { useState } from "react";
import {
  FlaskConical,
  Clock,
  Plus,
  X,
  AlertCircle,
  Check,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard, type SaveStatus } from "./SectionCard";
import { formatDisplayDate, calculateQuickDate } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";
import type { FollowUpBloodTestItem } from "./FollowUpSection";

export interface LaboratoryState {
  enabled: boolean;
  dueDate: string; // YYYY-MM-DD
  quickOption?: string;
  bloodTests: FollowUpBloodTestItem[];
}

export interface LaboratoryOrderSectionProps {
  id?: string | undefined;
  visitDate: string; // YYYY-MM-DD
  laboratory: LaboratoryState;
  onChange: (updated: LaboratoryState) => void;
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
  "Canine Parvovirus Antigen ELISA",
  "Feline Panleukopenia / Giardia Antigen",
  "Thyroid Panel (T4 / TSH)",
  "Lipid Profile (Cholesterol / Triglycerides)",
];

export function LaboratoryOrderSection({
  id = "sec-laboratory",
  visitDate,
  laboratory,
  onChange,
  onSave,
  status = "idle",
  lastSavedAt,
  isDirty = false,
  isLocked = false,
}: LaboratoryOrderSectionProps) {
  const [testSearch, setTestSearch] = useState("");
  const [testDropdownOpen, setTestDropdownOpen] = useState(false);

  const baseDate = visitDate || new Date().toISOString().slice(0, 10);

  const handleToggleEnabled = (enabled: boolean) => {
    if (isLocked) return;
    onChange({
      ...laboratory,
      enabled,
      dueDate: laboratory.dueDate || baseDate,
    });
  };

  const handleSelectQuickDate = (code: string) => {
    if (isLocked) return;
    const computedDate = calculateQuickDate(baseDate, code);
    onChange({
      ...laboratory,
      dueDate: computedDate,
      quickOption: code,
    });
  };

  const handleAddBloodTest = (testName: string) => {
    if (isLocked) return;
    const trimmed = testName.trim();
    if (!trimmed) return;
    if (laboratory.bloodTests.some((t) => t.testName.toLowerCase() === trimmed.toLowerCase())) {
      setTestSearch("");
      setTestDropdownOpen(false);
      return;
    }

    const newItem: FollowUpBloodTestItem = {
      id: `bt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      testName: trimmed,
      status: "Ordered",
    };

    onChange({
      ...laboratory,
      enabled: true,
      bloodTests: [...laboratory.bloodTests, newItem],
    });

    setTestSearch("");
    setTestDropdownOpen(false);
  };

  const handleRemoveBloodTest = (id: string) => {
    if (isLocked) return;
    onChange({
      ...laboratory,
      bloodTests: laboratory.bloodTests.filter((t) => t.id !== id),
    });
  };

  const filteredTests = COMMON_LAB_TESTS.filter((t) =>
    t.toLowerCase().includes(testSearch.toLowerCase().trim())
  );

  return (
    <SectionCard
      id={id}
      title="7. Laboratory & Diagnostics Orders"
      subtitle="Order blood tests, biochemistry panels & pathology investigations synced with Laboratory module"
      icon={<FlaskConical className="size-4 text-purple-600" />}
      onSave={onSave}
      status={status}
      lastSavedAt={lastSavedAt}
      isDirty={isDirty}
      saveLabel="Save Lab Tests ✓"
      isLocked={isLocked}
    >
      <div className="space-y-4 text-xs">
        {/* Step 1: Prompt First Ask Yes or No */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shrink-0">
              <FlaskConical className="size-4" />
            </span>
            <div>
              <Label className="text-xs font-bold text-foreground block">
                Order Laboratory Tests / Diagnostics for this Patient?
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Send blood tests, hematology, biochemistry, or cytology orders to the clinic laboratory
              </p>
            </div>
          </div>

          {/* YES / NO Segmented Controls */}
          <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border shadow-2xs shrink-0">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => handleToggleEnabled(true)}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                laboratory.enabled
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Check className="size-3" /> Yes
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => handleToggleEnabled(false)}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                !laboratory.enabled
                  ? "bg-muted text-foreground font-bold border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <X className="size-3" /> No
            </button>
          </div>
        </div>

        {/* Step 2: If YES -> Show Laboratory Schedule, Orders & Picker */}
        {laboratory.enabled ? (
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-4 animate-in fade-in-50 duration-200">
            {/* Header with Scheduled Date Badge */}
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                  <Clock className="size-3.5" />
                </span>
                <span className="font-bold text-foreground text-xs uppercase tracking-wider">
                  Laboratory Test Schedule
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-primary">
                Scheduled: {formatDisplayDate(laboratory.dueDate) || "Today"}
              </span>
            </div>

            {/* Quick Date Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                Schedule Date:
              </span>
              {["TODAY", "7D", "1M"].map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleSelectQuickDate(code)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold border transition-all cursor-pointer",
                    laboratory.quickOption === code
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-muted/60 text-foreground border-border hover:bg-muted"
                  )}
                >
                  {code === "TODAY" ? "Today" : code === "7D" ? "7 days" : "1 month"}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <Input
                  type="date"
                  disabled={isLocked}
                  value={laboratory.dueDate || ""}
                  onChange={(e) =>
                    onChange({
                      ...laboratory,
                      dueDate: e.target.value,
                      quickOption: "CUSTOM",
                    })
                  }
                  className="h-8 text-xs font-mono w-36 bg-background"
                />
              </div>
            </div>

            {/* Active Selected Tests Chips */}
            {laboratory.bloodTests.length > 0 ? (
              <div className="space-y-2 pt-1 border-t border-border/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  Selected Laboratory Orders ({laboratory.bloodTests.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {laboratory.bloodTests.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs"
                    >
                      <span>{t.testName}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] py-0 px-1.5 font-mono font-bold",
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
                          className="hover:text-destructive hover:bg-destructive/10 rounded p-0.5 transition-colors cursor-pointer"
                          title="Remove test"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-border/80 bg-muted/10 text-center text-muted-foreground text-xs">
                No laboratory tests added yet. Search or select from common diagnostic tests below.
              </div>
            )}

            {/* Search & Pick Laboratory Blood Test Input */}
            {!isLocked && (
              <div className="relative pt-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={testSearch}
                    onChange={(e) => {
                      setTestSearch(e.target.value);
                      setTestDropdownOpen(true);
                    }}
                    onFocus={() => setTestDropdownOpen(true)}
                    placeholder="Search or pick laboratory blood test to order..."
                    className="h-9 text-xs pl-8 bg-background"
                  />
                  {testSearch && (
                    <button
                      type="button"
                      onClick={() => setTestSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Suggestions */}
                {testDropdownOpen && (
                  <div className="absolute z-30 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                    <p className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Suggested Laboratory Diagnostic Tests:
                    </p>
                    {filteredTests.length === 0 && !testSearch.trim() ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No matching tests found.
                      </div>
                    ) : (
                      <>
                        {filteredTests.map((testName) => (
                          <button
                            key={testName}
                            type="button"
                            onClick={() => handleAddBloodTest(testName)}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-muted text-foreground flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span>{testName}</span>
                            <Plus className="size-3 text-primary" />
                          </button>
                        ))}
                        {testSearch.trim() &&
                          !COMMON_LAB_TESTS.some(
                            (t) => t.toLowerCase() === testSearch.trim().toLowerCase()
                          ) && (
                            <button
                              type="button"
                              onClick={() => handleAddBloodTest(testSearch.trim())}
                              className="w-full text-left px-3 py-2 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-between font-bold border-t border-border/40 mt-1 cursor-pointer"
                            >
                              <span>+ Add Custom Test &ldquo;{testSearch.trim()}&rdquo;</span>
                              <Plus className="size-3.5" />
                            </button>
                          )}
                      </>
                    )}
                    <div className="p-1 border-t border-border/40 text-right mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTestDropdownOpen(false)}
                        className="h-6 text-[11px] px-2.5"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* When NO is selected */
          <div className="p-4 rounded-xl border border-dashed border-border/70 bg-muted/10 text-center space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              No laboratory tests or diagnostics requested for this patient visit.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLocked}
              onClick={() => handleToggleEnabled(true)}
              className="h-7 text-xs font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
            >
              + Order Lab Tests
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
