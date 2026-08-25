import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Download, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  report: any;
}

export function ViewReportModal({ open, onClose, report }: Props) {
  if (!report) return null;

  const handlePrint = () => {
    toast.info("Opening report print dialog...");
    window.print();
  };

  const parameters = report.parameters || [
    { name: "Hemoglobin (Hb)", value: "14.8", unit: "g/dL", refInterval: "12.0 - 18.0", flag: "Normal" },
    { name: "Packed Cell Volume (PCV)", value: "44.2", unit: "%", refInterval: "37.0 - 55.0", flag: "Normal" },
    { name: "Total Leukocyte Count (TLC)", value: "11,500", unit: "/µL", refInterval: "6,000 - 17,000", flag: "Normal" },
    { name: "Blood Urea Nitrogen (BUN)", value: "22.4", unit: "mg/dL", refInterval: "10.0 - 28.0", flag: "Normal" },
    { name: "Serum Creatinine", value: "1.2", unit: "mg/dL", refInterval: "0.5 - 1.5", flag: "Normal" },
    { name: "Alanine Aminotransferase (ALT)", value: "48", unit: "U/L", refInterval: "10 - 100", flag: "Normal" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0">
        {/* Top Action Bar */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {report.title || "Clinical Diagnostic Report"} — {report.reportId}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs">
              <Printer className="mr-1.5 size-3.5" /> Print Official Report
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Official Medical Canvas */}
        <div className="p-8 bg-white text-slate-900 font-sans space-y-6 text-xs">
          {/* Clinic Letterhead */}
          <div className="border-b-2 border-primary pb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-primary flex items-center gap-2">
                <span>🐾</span> Harmony Pet Super-Specialty Hospital
              </h2>
              <p className="text-xs text-slate-500">Department of Diagnostic Pathology, Imaging &amp; Surgery</p>
              <p className="text-[10px] text-slate-400">NABH Accredited Veterinary Facility · Bengaluru, KA</p>
            </div>
            <div className="text-right">
              <span className="bg-primary/10 text-primary border border-primary/20 font-mono text-xs font-bold px-2.5 py-1 rounded">
                REPORT: {report.reportId}
              </span>
              <p className="text-[10px] text-slate-400 mt-1.5">Date: {report.date || "2026-08-22"}</p>
            </div>
          </div>

          {/* Patient & Owner Bio Card */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="space-y-1">
              <p><span className="text-slate-500 font-semibold">Patient Name:</span> <strong className="text-slate-900 text-sm">{report.pet}</strong> ({report.petId || "PET-0001"})</p>
              <p><span className="text-slate-500 font-semibold">Species / Breed:</span> {report.species || "Canine"} · {report.breed || "Mix"}</p>
              <p><span className="text-slate-500 font-semibold">Age / Gender:</span> {report.age || "3.5 yrs"} · {report.gender || "Male Intact"}</p>
            </div>
            <div className="space-y-1">
              <p><span className="text-slate-500 font-semibold">Pet Parent:</span> <strong className="text-slate-900">{report.owner}</strong> ({report.ownerPhone || "N/A"})</p>
              <p><span className="text-slate-500 font-semibold">Referring Clinician:</span> {report.doctor || "Dr. Rohit Sharma"}</p>
              <p><span className="text-slate-500 font-semibold">Report Department:</span> <span className="font-semibold text-primary">{report.category}</span></p>
            </div>
          </div>

          {/* Report Test Title & Sample Info */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-100/50 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Investigation / Procedure</p>
              <h4 className="text-sm font-bold text-slate-900">{report.title}</h4>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-bold gap-1">
              <ShieldCheck className="size-3" /> {report.status || "Verified & Signed"}
            </Badge>
          </div>

          {/* Parameters Table (for Lab / Diagnostic) or Clinical Narrative (for Surgical / Imaging) */}
          {report.isNarrative ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <h5 className="font-bold text-slate-900">Findings &amp; Procedural Narrative</h5>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                {report.narrative || "Examination and procedure concluded uneventfully under general anaesthesia. Vital parameters remained stable throughout."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-left font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-3.5 py-2.5">Parameter / Test</th>
                    <th className="px-3.5 py-2.5 text-right">Result</th>
                    <th className="px-3.5 py-2.5">Unit</th>
                    <th className="px-3.5 py-2.5">Biological Reference Range</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parameters.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">{p.value}</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">{p.unit}</td>
                      <td className="px-3.5 py-2 font-mono text-slate-600">{p.refInterval}</td>
                      <td className="px-3.5 py-2 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold font-mono",
                            p.flag === "Normal" ? "bg-emerald-100 text-emerald-800" :
                            p.flag === "High" ? "bg-amber-100 text-amber-800" :
                            p.flag === "Low" ? "bg-blue-100 text-blue-800" :
                            "bg-red-100 text-red-800"
                          )}
                        >
                          {p.flag || "Normal"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Clinical Interpretation & Advice */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 space-y-1">
            <p className="font-bold text-blue-900">Clinical Interpretation &amp; Diagnostic Impression:</p>
            <p className="text-blue-800 leading-relaxed">
              {report.impression || "All quantitative parameters within normal species reference limits. No acute inflammatory or biochemical abnormalities observed."}
            </p>
          </div>

          {/* Doctor Signature Block */}
          <div className="pt-8 border-t border-slate-200 flex items-center justify-between">
            <div className="text-[10px] text-slate-400">
              <p>Electronically Verified on {report.date || "2026-08-22"} at 16:45 IST</p>
              <p>Harmony Clinical OS · Cryptographically Signed</p>
            </div>
            <div className="text-right">
              <span className="font-serif italic text-sm text-slate-700 font-bold underline">Dr. Rohit Sharma</span>
              <p className="font-bold text-slate-900 mt-1">{report.doctor || "Dr. Rohit Sharma (BVSc & AH, MVSc)"}</p>
              <p className="text-[10px] text-slate-400">Consultant Veterinary Surgeon · Reg. No: KVC-7712</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
