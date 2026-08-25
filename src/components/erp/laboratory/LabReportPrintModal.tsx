import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FlaskConical, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  order: any;
}

export function LabReportPrintModal({ open, onClose, order }: Props) {
  if (!order) return null;

  const handlePrint = () => {
    toast.info("Opening system print dialog...");
    window.print();
  };

  const parameters = order.parameters || [
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0">
        {/* Top Control Bar */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            <span className="text-sm font-bold text-navy">
              Diagnostic Laboratory Report — {order.order}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Printer className="mr-1.5 size-3.5" /> Print Official Report
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Report Canvas */}
        <div className="p-8 bg-white text-slate-900 space-y-6 font-sans">
          {/* Clinic Header */}
          <div className="border-b-2 border-primary pb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-primary flex items-center gap-2">
                <span>🐾</span> Harmony Pet Super-Specialty Hospital
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Central Clinical Pathology &amp; Diagnostic Reference Laboratory
              </p>
              <p className="text-[11px] text-slate-400">
                Koramangala 4th Block, Bengaluru · Tel: +91 80 4920 1100 · NABL Accredited Vet Lab
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-primary/10 text-primary border border-primary/20 font-mono text-xs font-bold px-2 py-1 rounded">
                REPORT: {order.order}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Date: {order.date || new Date().toISOString().slice(0, 10)}</p>
            </div>
          </div>

          {/* Patient & Sample Metadata Box */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <div className="space-y-1">
              <p><span className="text-slate-500 font-semibold">Patient Name:</span> <strong className="text-slate-900">{order.pet}</strong> ({order.petId || "PET-0001"})</p>
              <p><span className="text-slate-500 font-semibold">Species / Breed:</span> {order.species || "Canine"} · {order.breed || "Labrador"}</p>
              <p><span className="text-slate-500 font-semibold">Pet Parent:</span> {order.owner} ({order.ownerPhone || "N/A"})</p>
            </div>
            <div className="space-y-1">
              <p><span className="text-slate-500 font-semibold">Test / Investigation:</span> <strong>{order.test}</strong></p>
              <p><span className="text-slate-500 font-semibold">Sample Specimen:</span> {order.sample || "Whole Blood (EDTA)"}</p>
              <p><span className="text-slate-500 font-semibold">Referring Clinician:</span> {order.doctor || "Dr. Rohit Sharma"}</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="space-y-2">
            <table className="w-full text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
                  <th className="px-3 py-2">Test Parameter</th>
                  <th className="px-3 py-2 text-right">Result</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-left">Biological Reference Interval</th>
                  <th className="px-3 py-2 text-center">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {parameters.map((p: any) => (
                  <tr key={p.name} className={cn(p.flag === "High" ? "bg-amber-50/60 font-semibold" : p.flag === "Low" ? "bg-blue-50/60 font-semibold" : "")}>
                    <td className="px-3 py-2 text-slate-800 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{p.value}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{p.unit}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{p.refRange}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold",
                        p.flag === "High" ? "bg-amber-100 text-amber-800" : p.flag === "Low" ? "bg-blue-100 text-blue-800" : "text-emerald-700 font-medium"
                      )}>
                        {p.flag || "Normal"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Diagnostic Impression */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
            <p className="font-bold text-slate-800">Diagnostic Impression &amp; Clinical Notes:</p>
            <p className="text-slate-600 leading-relaxed">
              {order.impression || "Parameters analyzed on calibrated automated veterinary hematology analyzer. Correlate with clinical findings."}
            </p>
          </div>

          {/* Signatures */}
          <div className="pt-8 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              <p className="font-mono text-[10px] text-slate-400">Sample Analyzed by: Mindray BC-5000 Vet</p>
              <p className="text-[10px] text-slate-400">Report Generated: {new Date().toLocaleString()}</p>
            </div>
            <div className="text-right">
              <div className="h-10 flex items-center justify-end">
                <span className="font-serif italic text-sm text-slate-700 font-bold underline">Dr. Aisha Nair</span>
              </div>
              <p className="font-bold text-slate-900">{order.pathologist || "Dr. Aisha Nair (MVSc Clin Path)"}</p>
              <p className="text-[10px] text-slate-500">Senior Veterinary Pathologist · Reg. No: KVC-8492</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
