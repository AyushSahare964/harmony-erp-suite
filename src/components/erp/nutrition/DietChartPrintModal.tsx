import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Bone, CheckCircle2, ShieldCheck, Scale } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: any;
}

export function DietChartPrintModal({ open, onClose, plan }: Props) {
  if (!plan) return null;

  const handlePrint = () => {
    toast.info("Opening feeding chart print dialog...");
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl border-border bg-card shadow-2xl p-0 gap-0">
        {/* Top Controls */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bone className="size-4 text-primary" />
            <span className="text-sm font-bold text-navy">
              Clinical Feeding Plan &amp; Diet Prescription — {plan.plan}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Printer className="mr-1.5 size-3.5" /> Print Feeding Chart
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Canvas */}
        <div className="p-8 bg-white text-slate-900 font-sans space-y-6 text-xs">
          {/* Header */}
          <div className="border-b-2 border-primary pb-3 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-primary flex items-center gap-2">
                <span>🐾</span> Harmony Pet Super-Specialty Hospital
              </h2>
              <p className="text-xs text-slate-500">Clinical Nutrition &amp; Therapeutic Dietary Care</p>
            </div>
            <div className="text-right">
              <span className="bg-primary/10 text-primary border border-primary/20 font-mono text-xs font-bold px-2 py-1 rounded">
                PLAN: {plan.plan}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Prescribed: {plan.createdAt || "2026-08-22"}</p>
            </div>
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="space-y-1">
              <p><span className="text-slate-500 font-semibold">Patient:</span> <strong className="text-slate-900">{plan.pet}</strong> ({plan.petId || "PET-0001"})</p>
              <p><span className="text-slate-500 font-semibold">Species / Breed:</span> {plan.species || "Canine"} · {plan.breed || "Mix"}</p>
              <p><span className="text-slate-500 font-semibold">Pet Parent:</span> {plan.owner} ({plan.ownerPhone || "N/A"})</p>
            </div>
            <div className="space-y-1">
              <p><span className="text-slate-500 font-semibold">Current Weight:</span> {plan.currentWeight || "24.5"} kg</p>
              <p><span className="text-slate-500 font-semibold">Target Weight:</span> <strong>{plan.targetWeight || "23.0"} kg</strong></p>
              <p><span className="text-slate-500 font-semibold">Body Condition:</span> {plan.bcs || "5/9 Ideal"}</p>
            </div>
          </div>

          {/* Prescribed Diet Breakdown */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
            <h4 className="font-bold text-sm text-blue-900 flex items-center gap-1.5">
              <Bone className="size-4 text-blue-600" /> Prescribed Therapeutic Diet
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <p><span className="text-slate-600">Prescription Diet:</span> <strong className="text-slate-900">{plan.diet}</strong></p>
              <p><span className="text-slate-600">Total Daily Quantity:</span> <strong className="text-blue-700 text-sm font-mono">{plan.qtyPerDay || 320} Grams / Day</strong></p>
              <p><span className="text-slate-600">Feeding Frequency:</span> {plan.mealsPerDay || "2 Meals (Morning & Evening)"}</p>
              <p><span className="text-slate-600">Hydration Goal:</span> {plan.hydrationGoal || "1.2 Litres fresh water daily"}</p>
            </div>
          </div>

          {/* Restrictions */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
            <p className="font-bold text-amber-900">⚠️ Strict Dietary Restrictions &amp; Treat Rules:</p>
            <p className="text-amber-800 leading-relaxed">
              {plan.restrictions || "Strictly no table scraps, fatty human foods, or unauthorized commercial treats during this dietary trial."}
            </p>
          </div>

          {/* Review Date & Sign-off */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-slate-500">Scheduled Weight &amp; Diet Review:</p>
              <p className="font-bold text-sm text-primary font-mono">{plan.nextReview || "2026-09-15"}</p>
            </div>
            <div className="text-right">
              <span className="font-serif italic text-sm text-slate-700 font-bold underline">Dr. Rohit Sharma</span>
              <p className="font-bold text-slate-900 mt-1">{plan.doctor || "Dr. Rohit Sharma (Chief Clinician)"}</p>
              <p className="text-[10px] text-slate-400">Clinical Nutrition Specialist · Reg. No: KVC-7712</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
