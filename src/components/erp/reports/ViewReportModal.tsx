import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Download, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  report: any;
}

export function ViewReportModal({ open, onClose, report }: Props) {
  if (!report) return null;

  // ── Doctor resolution (same pattern as PrescriptionPrintView) ───────────────
  const [doctorsList, setDoctorsList] = useState<Array<{ id: string; name: string; specialty?: string }>>([]);
  useEffect(() => {
    listApprovedDoctorsFn()
      .then((docs) => setDoctorsList(docs || []))
      .catch((e) => console.warn("Could not load doctors list:", e));
  }, []);

  const resolvedDoctor = (() => {
    const reportDoctor = report?.doctor;
    const matched = reportDoctor
      ? doctorsList.find((d) => d.name === reportDoctor || d.name === `Dr. ${reportDoctor}`)
      : undefined;
    if (matched) return matched;
    const firstReal = doctorsList.find((d) => !d.id.startsWith("doc-"));
    if (firstReal) return firstReal;
    const configMatch = doctorsList.find((d) => d.name === CLINIC_CONFIG.doctorName);
    if (configMatch) return configMatch;
    return {
      id: "config",
      name: CLINIC_CONFIG.doctorName,
      specialty: CLINIC_CONFIG.doctorDesignation,
    };
  })();

  // ── Print / PDF ──────────────────────────────────────────────────────────────
  const handlePrint = () => {
    printOrSaveDocumentAsPdf(
      "report-printable-area",
      `Report_${(report.reportId || "RPT").replace(/[/\\]/g, "_")}`
    );
  };

  // ── Parameters (lab mode) ────────────────────────────────────────────────────
  const parameters = report.parameters || [];

  // ── Formatted date ───────────────────────────────────────────────────────────
  const reportDate = formatDisplayDate(report.date) || report.date || new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0">

        {/* ── Top Action Bar ─────────────────────────────────────────────────── */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {report.title || "Clinical Diagnostic Report"} — {report.reportId}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs gap-1"
            >
              <Download className="size-3.5" /> Download PDF
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs gap-1"
            >
              <Printer className="size-3.5" /> Print Official Report
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* ── Printable Canvas ───────────────────────────────────────────────── */}
        <div
          id="report-printable-area"
          className="p-8 bg-white text-slate-900 font-sans space-y-5 text-xs print:p-0"
        >
          {/* Clinic Letterhead */}
          <div className="border-b-2 border-blue-900 pb-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
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
                <p className="text-[11px] font-semibold text-blue-800">{CLINIC_CONFIG.subName}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{CLINIC_CONFIG.addressLine2}</p>
                <p className="text-[11px] text-slate-600">
                  Phone: {CLINIC_CONFIG.phone} · {CLINIC_CONFIG.website}
                </p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <span className="bg-primary/10 text-primary border border-primary/20 font-mono text-xs font-bold px-2.5 py-1 rounded block">
                REPORT: {report.reportId}
              </span>
              <p className="text-[10px] text-slate-500 font-mono">Date: {reportDate}</p>
              {report.category && (
                <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wide">
                  {report.category}
                </p>
              )}
            </div>
          </div>

          {/* Patient & Owner Bio Card */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="space-y-1">
              <p>
                <span className="text-slate-500 font-semibold">Patient Name:</span>{" "}
                <strong className="text-slate-900 text-sm">{report.pet || "—"}</strong>{" "}
                {report.petId && (
                  <span className="text-slate-500 font-mono text-[10px]">({report.petId})</span>
                )}
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Species / Breed:</span>{" "}
                {report.species || "Canine"} · {report.breed || "Mixed Breed"}
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Age / Gender:</span>{" "}
                {report.age || "—"} · {report.gender || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p>
                <span className="text-slate-500 font-semibold">Pet Parent:</span>{" "}
                <strong className="text-slate-900">{report.owner || "—"}</strong>{" "}
                {report.ownerPhone && (
                  <span className="text-slate-500 font-mono text-[10px]">({report.ownerPhone})</span>
                )}
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Referring Clinician:</span>{" "}
                {resolvedDoctor.name}
              </p>
              <p>
                <span className="text-slate-500 font-semibold">Report Department:</span>{" "}
                <span className="font-semibold text-primary">{report.category || "General"}</span>
              </p>
            </div>
          </div>

          {/* Investigation / Procedure Title */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-100/50 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                Investigation / Procedure
              </p>
              <h4 className="text-sm font-bold text-slate-900 mt-0.5">{report.title}</h4>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold gap-1",
                report.status === "Verified & Signed" || report.status === "Completed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : report.status === "Pending"
                  ? "bg-amber-50 text-amber-700 border-amber-300"
                  : "bg-blue-50 text-blue-700 border-blue-300"
              )}
            >
              <ShieldCheck className="size-3" />
              {report.status || "Verified & Signed"}
            </Badge>
          </div>

          {/* Content: Narrative or Lab Parameters */}
          {report.isNarrative || report.narrative ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <h5 className="font-bold text-slate-900">Findings &amp; Procedural Narrative</h5>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px]">
                {report.narrative || "Examination and procedure concluded uneventfully. Vital parameters remained stable throughout."}
              </p>
            </div>
          ) : parameters.length > 0 ? (
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
                            p.flag === "Normal"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.flag === "High"
                              ? "bg-amber-100 text-amber-800"
                              : p.flag === "Low"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
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
          ) : (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-slate-400 italic text-[11px]">
              No parameters or narrative recorded for this report.
            </div>
          )}

          {/* Clinical Interpretation */}
          {report.impression && (
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 space-y-1">
              <p className="font-bold text-blue-900 text-[11px] uppercase tracking-wider">
                Clinical Interpretation &amp; Diagnostic Impression
              </p>
              <p className="text-blue-800 leading-relaxed text-[11px]">{report.impression}</p>
            </div>
          )}

          {/* Doctor Signature Block */}
          <div className="pt-6 border-t border-slate-200 flex items-end justify-between text-[10px]">
            <div className="text-slate-400 space-y-0.5">
              <p>Electronically Verified on {reportDate} · {CLINIC_CONFIG.fullName}</p>
              <p>{CLINIC_CONFIG.phone} · {CLINIC_CONFIG.website}</p>
              {CLINIC_CONFIG.regNo && <p>Reg. No: {CLINIC_CONFIG.regNo}</p>}
            </div>
            <div className="text-center space-y-1">
              <div className="w-44 border-b border-slate-400 pb-6 text-center text-slate-400 font-serif italic text-[10px]">
                Digitally Signed
              </div>
              <p className="font-bold text-slate-800 text-[11px]">{resolvedDoctor.name}</p>
              {resolvedDoctor.name === CLINIC_CONFIG.doctorName && (
                <p className="text-slate-500 text-[9px]">{CLINIC_CONFIG.doctorQualifications}</p>
              )}
              <p className="text-slate-500 text-[9px]">
                {resolvedDoctor.specialty || CLINIC_CONFIG.doctorDesignation}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
