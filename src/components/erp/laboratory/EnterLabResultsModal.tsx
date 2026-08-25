import { useState, useEffect } from "react";
import {
  FileCheck,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Stethoscope,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParameterResult {
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag?: "Normal" | "High" | "Low" | "Critical";
}

const DEFAULT_CBC_PARAMS: ParameterResult[] = [
  { name: "Hemoglobin (Hb)", value: "14.2", unit: "g/dL", refRange: "12.0 - 18.0", flag: "Normal" },
  { name: "Total RBC Count", value: "6.8", unit: "x10^6/uL", refRange: "5.5 - 8.5", flag: "Normal" },
  { name: "Packed Cell Volume (PCV / HCT)", value: "42.0", unit: "%", refRange: "37.0 - 55.0", flag: "Normal" },
  { name: "Total Leucocyte Count (TLC / WBC)", value: "16.4", unit: "x10^3/uL", refRange: "6.0 - 17.0", flag: "Normal" },
  { name: "Platelet Count", value: "245", unit: "x10^3/uL", refRange: "200 - 500", flag: "Normal" },
  { name: "Neutrophils (%)", value: "78", unit: "%", refRange: "60 - 77", flag: "High" },
  { name: "Lymphocytes (%)", value: "16", unit: "%", refRange: "12 - 30", flag: "Normal" },
  { name: "Monocytes (%)", value: "4", unit: "%", refRange: "3 - 10", flag: "Normal" },
  { name: "Eosinophils (%)", value: "2", unit: "%", refRange: "2 - 10", flag: "Normal" },
];

const DEFAULT_BIOCHEM_PARAMS: ParameterResult[] = [
  { name: "Serum Creatinine", value: "1.1", unit: "mg/dL", refRange: "0.5 - 1.5", flag: "Normal" },
  { name: "Blood Urea Nitrogen (BUN)", value: "22.0", unit: "mg/dL", refRange: "7.0 - 27.0", flag: "Normal" },
  { name: "ALT (SGPT)", value: "64", unit: "U/L", refRange: "10 - 100", flag: "Normal" },
  { name: "ALP (Alkaline Phosphatase)", value: "112", unit: "U/L", refRange: "23 - 212", flag: "Normal" },
  { name: "Total Serum Bilirubin", value: "0.3", unit: "mg/dL", refRange: "0.1 - 0.5", flag: "Normal" },
  { name: "Total Protein", value: "6.5", unit: "g/dL", refRange: "5.2 - 8.2", flag: "Normal" },
  { name: "Serum Albumin", value: "3.2", unit: "g/dL", refRange: "2.5 - 4.0", flag: "Normal" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  order: any;
  onResultsSaved?: (updatedOrder: any) => void;
}

export function EnterLabResultsModal({ open, onClose, order, onResultsSaved }: Props) {
  const [params, setParams] = useState<ParameterResult[]>([]);
  const [impression, setImpression] = useState("Hematological parameters within clinically normal limits. Mild relative neutrophilia noted.");
  const [pathologist, setPathologist] = useState("Dr. Aisha Nair (MVSc Clin Path)");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      if (order.test?.toLowerCase().includes("biochem") || order.test?.toLowerCase().includes("liver") || order.test?.toLowerCase().includes("kidney")) {
        setParams(DEFAULT_BIOCHEM_PARAMS);
      } else {
        setParams(DEFAULT_CBC_PARAMS);
      }
    }
  }, [order]);

  const updateParam = (idx: number, field: keyof ParameterResult, val: any) => {
    setParams((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p))
    );
  };

  const handleSave = () => {
    setSaving(true);
    const updated = {
      ...order,
      status: "Reported",
      parameters: params,
      impression,
      pathologist,
      reportedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setTimeout(() => {
      setSaving(false);
      toast.success(`Diagnostic results published for Order ${order?.order}! Report is ready for download & print.`);
      onResultsSaved?.(updated);
      onClose();
    }, 200);
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
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Patient: <strong className="text-foreground">{order.pet}</strong> ({order.petId}) · Owner: {order.owner} · Test: {order.test}
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
          {/* Parameters Table with Automatic Flagging */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Quantitative Test Parameters</Label>
              <span className="text-[11px] text-muted-foreground">Values with abnormal flags</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-2.5">Parameter Name</th>
                    <th className="px-4 py-2.5 w-32">Observed Result</th>
                    <th className="px-4 py-2.5 w-24">Unit</th>
                    <th className="px-4 py-2.5 w-36">Biological Ref Interval</th>
                    <th className="px-4 py-2.5 w-28">Status / Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {params.map((p, idx) => (
                    <tr key={p.name} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-semibold text-foreground">{p.name}</td>
                      <td className="px-4 py-2">
                        <Input
                          value={p.value}
                          onChange={(e) => updateParam(idx, "value", e.target.value)}
                          className="h-7 text-xs font-mono font-bold"
                        />
                      </td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{p.unit}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{p.refRange}</td>
                      <td className="px-4 py-2">
                        <select
                          value={p.flag || "Normal"}
                          onChange={(e) => updateParam(idx, "flag", e.target.value)}
                          className={cn(
                            "h-7 rounded-md px-2 text-xs font-bold border",
                            p.flag === "High"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              : p.flag === "Low"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : p.flag === "Critical"
                              ? "bg-red-500/10 text-red-600 border-red-500/30"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          )}
                        >
                          <option value="Normal">🟢 Normal</option>
                          <option value="High">🟡 High</option>
                          <option value="Low">🔵 Low</option>
                          <option value="Critical">🔴 Critical</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pathologist Impression & Doctor Sign-off */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Diagnostic Impression / Pathologist Interpretation</Label>
              <Input
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Verified By (Clinical Pathologist)</Label>
              <Input
                value={pathologist}
                onChange={(e) => setPathologist(e.target.value)}
                className="text-xs h-9 bg-muted/20"
              />
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
