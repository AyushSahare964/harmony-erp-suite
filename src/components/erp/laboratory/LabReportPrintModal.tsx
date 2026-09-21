import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, FlaskConical, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";

interface Props {
  open: boolean;
  onClose: () => void;
  order: any;
  onEditResults?: (order: any) => void;
}

export function LabReportPrintModal({ open, onClose, order, onEditResults }: Props) {
  if (!order) return null;

  const handlePrint = () => {
    printOrSaveDocumentAsPdf("lab-report-printable-area", `LabReport_${order.order || order.orderId || "LAB"}`);
  };

  // Only display parameters that have an actual entered value (no dummy mock fallbacks)
  const rawParameters: any[] = Array.isArray(order.parameters) ? order.parameters : [];
  const parameters = rawParameters.filter(
    (p: any) => p && p.value !== undefined && p.value !== null && String(p.value).trim() !== ""
  );

  const referringDoctor =
    order.doctor ||
    order.doctorName ||
    order.orderingDoctor ||
    order.referringDoctor ||
    CLINIC_CONFIG.doctorName;

  const signingDoctor =
    order.pathologist ||
    referringDoctor ||
    CLINIC_CONFIG.doctorName;

  const reportDate =
    formatDisplayDate(order.reportedAt || order.date) ||
    order.date ||
    new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0">
        {/* Top Control Bar */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            <span className="text-sm font-bold text-navy">
              Diagnostic Laboratory Report — {order.order || order.orderId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onEditResults && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEditResults(order)}
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
              >
                <FileCheck className="size-3.5" /> Edit Results
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1.5">
              <Download className="size-3.5" /> Download PDF
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Printer className="size-3.5" /> Print Official Report
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Report Canvas */}
        <div id="lab-report-printable-area" className="p-8 bg-white text-slate-900 space-y-6 font-sans print:p-0">
          {/* Clinic Header with Real Care Small Animal Clinic Branding */}
          <div className="border-b-2 border-blue-900 pb-4 flex items-start justify-between">
            <div className="flex items-start gap-3.5">
              <img
                src={CLINIC_CONFIG.logoPath}
                alt={CLINIC_CONFIG.fullName}
                className="h-16 w-auto object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div>
                <h1 className="text-xl font-black tracking-tight text-blue-900 uppercase">
                  {CLINIC_CONFIG.fullName}
                </h1>
                <p className="text-[11px] font-semibold text-blue-800">
                  {CLINIC_CONFIG.subName} · Central Diagnostic Reference Laboratory
                </p>
                <p className="text-xs text-gray-700 font-semibold mt-0.5">
                  {CLINIC_CONFIG.doctorName}
                </p>
                <p className="text-[10px] text-gray-500">
                  {CLINIC_CONFIG.doctorQualifications}
                </p>
                <p className="text-xs text-gray-600">
                  {CLINIC_CONFIG.addressLine1}, {CLINIC_CONFIG.addressLine2} · Phone: {CLINIC_CONFIG.phone}
                </p>
                <p className="text-[10px] text-gray-500">
                  Website: {CLINIC_CONFIG.website} · Email: {CLINIC_CONFIG.email}
                </p>
              </div>
            </div>
            <div className="text-right text-xs space-y-1">
              <span className="inline-block bg-blue-900 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-mono">
                DIAGNOSTIC REPORT
              </span>
              <p className="font-mono font-bold text-sm text-gray-900 mt-1">{order.order || order.orderId}</p>
              <p className="text-gray-500 text-[11px]">Date: {reportDate}</p>
              {order.priority && (
                <span
                  className={cn(
                    "inline-block text-[9px] font-bold px-2 py-0.5 rounded",
                    order.priority === "Urgent STAT"
                      ? "bg-red-100 text-red-800 border border-red-200"
                      : "bg-slate-100 text-slate-700"
                  )}
                >
                  {order.priority}
                </span>
              )}
            </div>
          </div>

          {/* Patient & Sample Metadata Box */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <div className="space-y-1.5">
              <p>
                <span className="text-slate-500 font-semibold">Patient Name:</span>{" "}
                <strong className="text-slate-900 text-sm">{order.pet}</strong>{" "}
                <span className="font-mono text-slate-500 font-bold">({order.petId || "PET-0001"})</span>
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Species / Breed:</span>{" "}
                <span className="text-slate-800 font-medium">{order.species || "Canine"} · {order.breed || "Mix"}</span>
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Pet Parent:</span>{" "}
                <span className="text-slate-800 font-medium">{order.owner} ({order.ownerPhone || "N/A"})</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <p>
                <span className="text-slate-500 font-semibold">Investigation:</span>{" "}
                <strong className="text-blue-900">{order.test || order.testName}</strong>
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Sample Specimen:</span>{" "}
                <span className="text-slate-800 font-medium">{order.sample || "Whole Blood (EDTA)"}</span>
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Referring Clinician:</span>{" "}
                <strong className="text-blue-900">{referringDoctor}</strong>
              </p>
            </div>
          </div>

          {/* Results Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Quantitative Laboratory Findings
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                Standard biological reference intervals
              </span>
            </div>

            {parameters.length > 0 ? (
              <table className="w-full text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
                    <th className="px-3 py-2">Test Parameter</th>
                    <th className="px-3 py-2 text-right">Observed Result</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                    <th className="px-3 py-2 text-left">Biological Ref Interval</th>
                    <th className="px-3 py-2 text-center">Status / Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parameters.map((p: any, idx: number) => (
                    <tr
                      key={`${p.name}-${idx}`}
                      className={cn(
                        p.flag === "Critical"
                          ? "bg-red-50/70 font-semibold"
                          : p.flag === "High"
                          ? "bg-amber-50/70 font-semibold"
                          : p.flag === "Low"
                          ? "bg-blue-50/70 font-semibold"
                          : ""
                      )}
                    >
                      <td className="px-3 py-2 text-slate-800 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{p.value}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{p.unit}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{p.refRange}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-bold inline-block",
                            p.flag === "Critical"
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : p.flag === "High"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : p.flag === "Low"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "text-emerald-700 font-medium bg-emerald-50 border border-emerald-200"
                          )}
                        >
                          {p.flag || "Normal"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 bg-slate-50/50">
                <p className="font-semibold text-slate-700">No quantitative parameter results recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click &quot;Edit Results&quot; in the top bar to enter and publish findings for this diagnostic test.
                </p>
              </div>
            )}
          </div>

          {/* Diagnostic Impression */}
          {order.impression ? (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
              <p className="font-bold text-slate-800">Diagnostic Impression &amp; Clinical Notes:</p>
              <p className="text-slate-700 leading-relaxed font-medium">
                {order.impression}
              </p>
            </div>
          ) : null}

          {/* Signatures & Accreditation Footer */}
          <div className="pt-8 border-t-2 border-slate-200 flex items-end justify-between text-xs text-slate-600">
            <div className="space-y-1">
              <p className="font-bold text-slate-800">For {CLINIC_CONFIG.fullName}</p>
              <p className="text-[10px] text-slate-400">
                Sample Specimen: {order.sample || "Whole Blood (EDTA)"} · Status: {order.status || "Reported"}
              </p>
              <p className="text-[10px] text-slate-400">
                Report Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="h-10 flex items-center justify-end">
                <span className="font-serif italic text-base text-blue-900 font-bold underline decoration-blue-300">
                  {signingDoctor}
                </span>
              </div>
              <p className="font-bold text-slate-900 text-xs">{signingDoctor}</p>
              <p className="text-[10px] text-slate-600 font-medium">
                {signingDoctor === CLINIC_CONFIG.doctorName
                  ? CLINIC_CONFIG.doctorQualifications
                  : "Authorized Veterinary Clinician / Pathologist"}
              </p>
              <p className="text-[9px] text-slate-400">
                {CLINIC_CONFIG.shortName} · Verified Diagnostic Record
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
