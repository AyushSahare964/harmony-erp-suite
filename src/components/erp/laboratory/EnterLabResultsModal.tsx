import { useState, useEffect, useRef } from "react";
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateLabResultsFn } from "@/lib/mongodb/serverFns/laboratory";

export interface ParameterResult {
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag?: "Normal" | "High" | "Low" | "Critical";
  isCustom?: boolean;
}

// Clean reference templates — all observed values start empty (no default dummy entries)
const DEFAULT_CBC_PARAMS: ParameterResult[] = [
  { name: "Hemoglobin (Hb)", value: "", unit: "g/dL", refRange: "12.0 - 18.0" },
  { name: "Total RBC Count", value: "", unit: "x10^6/uL", refRange: "5.5 - 8.5" },
  { name: "Packed Cell Volume (PCV / HCT)", value: "", unit: "%", refRange: "37.0 - 55.0" },
  { name: "Total Leucocyte Count (TLC / WBC)", value: "", unit: "x10^3/uL", refRange: "6.0 - 17.0" },
  { name: "Platelet Count", value: "", unit: "x10^3/uL", refRange: "200 - 500" },
  { name: "Neutrophils (%)", value: "", unit: "%", refRange: "60 - 77" },
  { name: "Lymphocytes (%)", value: "", unit: "%", refRange: "12 - 30" },
  { name: "Monocytes (%)", value: "", unit: "%", refRange: "3 - 10" },
  { name: "Eosinophils (%)", value: "", unit: "%", refRange: "2 - 10" },
];

const DEFAULT_BIOCHEM_PARAMS: ParameterResult[] = [
  { name: "Serum Creatinine", value: "", unit: "mg/dL", refRange: "0.5 - 1.5" },
  { name: "Blood Urea Nitrogen (BUN)", value: "", unit: "mg/dL", refRange: "7.0 - 27.0" },
  { name: "ALT (SGPT)", value: "", unit: "U/L", refRange: "10 - 100" },
  { name: "ALP (Alkaline Phosphatase)", value: "", unit: "U/L", refRange: "23 - 212" },
  { name: "Total Serum Bilirubin", value: "", unit: "mg/dL", refRange: "0.1 - 0.5" },
  { name: "Total Protein", value: "", unit: "g/dL", refRange: "5.2 - 8.2" },
  { name: "Serum Albumin", value: "", unit: "g/dL", refRange: "2.5 - 4.0" },
];

/**
 * Automatically evaluates the status / flag (Normal, Low, High, Critical)
 * based on the observed result and the biological reference interval.
 */
export function calculateParamFlag(
  valueStr: string,
  refRangeStr: string
): "Normal" | "High" | "Low" | "Critical" | "" {
  if (valueStr === undefined || valueStr === null) return "";
  const trimmedVal = String(valueStr).trim();
  if (!trimmedVal) return "";

  // Qualitative checks (e.g. Urinalysis, rapid antigen kits, etc.)
  const lowerVal = trimmedVal.toLowerCase();
  if (["negative", "nil", "absent", "normal", "non-reactive", "clear"].includes(lowerVal)) {
    return "Normal";
  }
  if (["positive", "present", "reactive", "abnormal"].includes(lowerVal)) {
    return "High";
  }

  // Parse numeric value
  const num = parseFloat(trimmedVal.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "";

  if (!refRangeStr || !refRangeStr.trim()) return "Normal";
  const range = refRangeStr.trim();

  // Pattern 1: "< 200" or "<= 200"
  const lessMatch = range.match(/^<(=)?\s*([0-9.]+)/);
  if (lessMatch) {
    const max = parseFloat(lessMatch[2]);
    if (num > max * 1.8) return "Critical";
    if (num > max) return "High";
    return "Normal";
  }

  // Pattern 2: "> 50" or ">= 50"
  const greaterMatch = range.match(/^>(=)?\s*([0-9.]+)/);
  if (greaterMatch) {
    const min = parseFloat(greaterMatch[2]);
    if (num < min * 0.5) return "Critical";
    if (num < min) return "Low";
    return "Normal";
  }

  // Pattern 3: "12.0 - 18.0", "12 - 18", "12 to 18", "12.0 – 18.0"
  const rangeMatch = range.match(/([0-9.]+)\s*(?:-|–|—|to)\s*([0-9.]+)/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (num < min) {
      if (min > 0 && num < min * 0.5) return "Critical";
      return "Low";
    }
    if (num > max) {
      if (num > max * 1.8) return "Critical";
      return "High";
    }
    return "Normal";
  }

  return "Normal";
}

interface Props {
  open: boolean;
  onClose: () => void;
  order: any;
  onResultsSaved?: (updatedOrder: any) => void;
}

export function EnterLabResultsModal({ open, onClose, order, onResultsSaved }: Props) {
  const [params, setParams] = useState<ParameterResult[]>([]);
  const [impression, setImpression] = useState("");
  const [pathologist, setPathologist] = useState("");
  const [saving, setSaving] = useState(false);

  // References for keyboard navigation across parameter input boxes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const impressionRef = useRef<HTMLTextAreaElement | null>(null);

  // Automatically resolve the referring doctor name from all potential order properties
  const referringDoctor =
    order?.doctor ||
    order?.doctorName ||
    order?.orderingDoctor ||
    order?.referringDoctor ||
    order?.prescribedBy ||
    order?.consultant ||
    "";

  // Auto-focus the first observed result input box when the modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
          inputRefs.current[0]?.select();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Keyboard navigation: Enter or ArrowDown jumps to next parameter box, ArrowUp to previous
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextIndex = idx + 1;
      if (nextIndex < params.length) {
        inputRefs.current[nextIndex]?.focus();
        inputRefs.current[nextIndex]?.select();
      } else {
        // If last row, advance to the diagnostic impression textarea
        impressionRef.current?.focus();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = idx + 1;
      if (nextIndex < params.length) {
        inputRefs.current[nextIndex]?.focus();
        inputRefs.current[nextIndex]?.select();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = idx - 1;
      if (prevIndex >= 0) {
        inputRefs.current[prevIndex]?.focus();
        inputRefs.current[prevIndex]?.select();
      }
    }
  };

  useEffect(() => {
    if (order) {
      // 1. If previously entered results exist, restore them
      if (order.parameters && Array.isArray(order.parameters) && order.parameters.length > 0) {
        setParams(order.parameters);
      } else if (
        order.test?.toLowerCase().includes("biochem") ||
        order.test?.toLowerCase().includes("liver") ||
        order.test?.toLowerCase().includes("kidney") ||
        order.test?.toLowerCase().includes("lft") ||
        order.test?.toLowerCase().includes("kft")
      ) {
        // 2. Otherwise initialize clean templates without any hardcoded default values
        setParams(DEFAULT_BIOCHEM_PARAMS.map((p) => ({ ...p, value: "", flag: undefined })));
      } else {
        setParams(DEFAULT_CBC_PARAMS.map((p) => ({ ...p, value: "", flag: undefined })));
      }

      // No canned dummy impression text — start blank or with saved impression
      setImpression(order.impression || "");

      // Automatically default pathologist / sign-off to the referring doctor or saved pathologist
      setPathologist(order.pathologist || referringDoctor || "");
    }
  }, [order, referringDoctor]);

  // Handle typing observed result -> automatically computes status / flag based on biological ref interval
  const handleValueChange = (idx: number, newVal: string) => {
    setParams((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const autoFlag = calculateParamFlag(newVal, p.refRange);
        return {
          ...p,
          value: newVal,
          flag: autoFlag || undefined,
        };
      })
    );
  };

  // Allow manual override of the flag dropdown if desired
  const handleFlagChange = (idx: number, newFlag: any) => {
    setParams((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, flag: newFlag || undefined } : p))
    );
  };

  const updateParamField = (idx: number, field: keyof ParameterResult, val: any) => {
    setParams((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const updated = { ...p, [field]: val };
        if (field === "refRange" && updated.value) {
          updated.flag = calculateParamFlag(updated.value, val) || undefined;
        }
        return updated;
      })
    );
  };

  const handleAddParam = () => {
    setParams((prev) => [
      ...prev,
      {
        name: "Custom Parameter",
        value: "",
        unit: "",
        refRange: "0.0 - 0.0",
        flag: undefined,
        isCustom: true,
      },
    ]);
  };

  const handleDeleteParam = (idx: number) => {
    setParams((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearAll = () => {
    setParams((prev) => prev.map((p) => ({ ...p, value: "", flag: undefined })));
    setImpression("");
    toast.info("Cleared all entered results.");
  };

  // Auto-generate professional clinical impression from the entered results and calculated flags
  const handleAutoSuggestImpression = () => {
    const withValue = params.filter((p) => p.value && p.value.trim() !== "");
    if (withValue.length === 0) {
      toast.info("Please enter at least one observed result to auto-suggest an impression.");
      return;
    }

    const abnormal = withValue.filter((p) => p.flag && p.flag !== "Normal");
    if (abnormal.length === 0) {
      setImpression("All quantitative diagnostic parameters analyzed are within biological reference intervals. No significant hematological or biochemical abnormalities detected.");
      toast.success("Auto-suggested impression for normal test results.");
    } else {
      const summary = abnormal.map((p) => `${p.name}: ${p.value} ${p.unit} (${p.flag})`).join("; ");
      setImpression(`Abnormal diagnostic parameters noted: ${summary}. Clinical correlation and follow-up recommended.`);
      toast.success(`Auto-suggested impression highlighting ${abnormal.length} abnormal parameter(s).`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const reportedAt = new Date().toISOString();
    const patch = {
      status: "Reported",
      parameters: params,
      impression,
      pathologist,
      doctor: referringDoctor,
      reportedAt,
    };

    try {
      await updateLabResultsFn({ data: { orderId: order.orderId ?? order.order, patch } });
      toast.success(`Diagnostic results published for Order ${order?.order}! Report is ready for download & print.`);
      onResultsSaved?.({ ...order, ...patch });
      onClose();
    } catch (err) {
      console.error("[EnterLabResultsModal] Failed to save results:", err);
      toast.error("Could not save diagnostic results — please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0">
        <div className="border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
                  <FileCheck className="size-5" />
                </span>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Enter Diagnostic Test Results — {order.order}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Patient: <strong className="text-foreground">{order.pet}</strong> ({order.petId || "N/A"})</span>
                    <span>·</span>
                    <span>Owner: <strong className="text-foreground">{order.owner}</strong></span>
                    <span>·</span>
                    <span>Test: <strong className="text-foreground">{order.test}</strong></span>
                    {referringDoctor && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-[11px]">
                          <Stethoscope className="size-3" />
                          <span>Referred by: {referringDoctor}</span>
                        </span>
                      </>
                    )}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs text-primary bg-primary/10">
                {order.species || "Canine"} Reference Set
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Parameters Table with Automatic Status/Flagging */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-foreground">Quantitative Test Parameters</Label>
                <span className="text-[11px] text-muted-foreground">
                  (Status automatically flags as Normal, Low, High, or Critical based on reference range)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                >
                  <RotateCcw className="size-3" /> Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddParam}
                  className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                >
                  <Plus className="size-3" /> Add Parameter
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-2.5">Parameter Name</th>
                    <th className="px-4 py-2.5 w-36">Observed Result</th>
                    <th className="px-4 py-2.5 w-24">Unit</th>
                    <th className="px-4 py-2.5 w-40">Biological Ref Interval</th>
                    <th className="px-4 py-2.5 w-32">Status / Flag</th>
                    <th className="px-2 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {params.map((p, idx) => (
                    <tr key={`${p.name}-${idx}`} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-semibold text-foreground">
                        {p.isCustom ? (
                          <Input
                            value={p.name}
                            onChange={(e) => updateParamField(idx, "name", e.target.value)}
                            className="h-7 text-xs font-semibold bg-background"
                            placeholder="Parameter name..."
                          />
                        ) : (
                          <span>{p.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          ref={(el) => {
                            inputRefs.current[idx] = el;
                          }}
                          value={p.value}
                          placeholder="Enter result..."
                          onChange={(e) => handleValueChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx)}
                          onFocus={(e) => e.target.select()}
                          className={cn(
                            "h-7 text-xs font-mono font-bold transition-all",
                            p.flag === "High" && "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                            p.flag === "Low" && "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                            p.flag === "Critical" && "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300",
                            p.flag === "Normal" && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          )}
                        />
                      </td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">
                        {p.isCustom ? (
                          <Input
                            value={p.unit}
                            onChange={(e) => updateParamField(idx, "unit", e.target.value)}
                            className="h-7 text-xs font-mono bg-background"
                            placeholder="Unit"
                          />
                        ) : (
                          <span>{p.unit}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">
                        {p.isCustom ? (
                          <Input
                            value={p.refRange}
                            onChange={(e) => updateParamField(idx, "refRange", e.target.value)}
                            className="h-7 text-xs font-mono bg-background"
                            placeholder="e.g. 10.0 - 50.0"
                          />
                        ) : (
                          <span>{p.refRange}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={p.flag || ""}
                          onChange={(e) => handleFlagChange(idx, e.target.value)}
                          className={cn(
                            "h-7 rounded-md px-2 text-xs font-bold border transition-colors",
                            p.flag === "High"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                              : p.flag === "Low"
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40"
                              : p.flag === "Critical"
                              ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40"
                              : p.flag === "Normal"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                              : "bg-muted/30 text-muted-foreground border-border"
                          )}
                        >
                          <option value="">⚪ Pending</option>
                          <option value="Normal">🟢 Normal</option>
                          <option value="High">🟡 High</option>
                          <option value="Low">🔵 Low</option>
                          <option value="Critical">🔴 Critical</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteParam(idx)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="Remove parameter"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pathologist Impression & Doctor Sign-off */}
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Diagnostic Impression / Pathologist Interpretation
                </Label>
                <button
                  type="button"
                  onClick={handleAutoSuggestImpression}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="size-3" /> Auto-suggest from flags
                </button>
              </div>
              <Textarea
                ref={impressionRef}
                rows={2}
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
                placeholder="Enter diagnostic impression / clinical interpretation, or click Auto-suggest above..."
                className="text-xs resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Stethoscope className="size-3.5 text-primary" />
                  <span>Referring / Prescribing Doctor</span>
                </Label>
                <Input
                  value={referringDoctor || "Not Specified"}
                  readOnly
                  className="text-xs h-9 bg-muted/40 font-semibold text-foreground cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileCheck className="size-3.5 text-emerald-600" />
                  <span>Verified By (Clinical Pathologist / Doctor)</span>
                </Label>
                <Input
                  value={pathologist}
                  onChange={(e) => setPathologist(e.target.value)}
                  placeholder="e.g. Dr. Name (MVSc Clin Path)"
                  className="text-xs h-9"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5 px-5"
            >
              <CheckCircle2 className="size-4" /> Save &amp; Publish Official Lab Report ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
