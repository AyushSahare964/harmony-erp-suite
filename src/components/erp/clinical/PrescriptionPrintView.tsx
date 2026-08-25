import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Stethoscope, Heart, Calendar } from "lucide-react";
import { toast } from "sonner";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";

interface Props {
  visit: any;
  open: boolean;
  onClose: () => void;
}

export function PrescriptionPrintView({ visit, open, onClose }: Props) {
  const handlePrint = () => {
    printOrSaveDocumentAsPdf("prescription-printable-area", `Prescription_${visit?.prescriptionNo || "Rx"}`);
  };

  const handleDownload = () => {
    printOrSaveDocumentAsPdf("prescription-printable-area", `Prescription_${visit?.prescriptionNo || "Rx"}`);
  };

  const medicines = (visit?.items || []).filter(
    (i: any) => i.lineType === "Pharmacy" || i.lineType === "Vaccine"
  );

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Top Control Header */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-4 text-primary" />
            <span className="text-sm font-bold text-navy">Medical Prescription (Rx) — {visit?.prescriptionNo}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs gap-1">
              <Download className="size-3.5" /> Download PDF
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs">
              <Printer className="mr-1.5 size-3.5" /> Print Rx Sheet
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Area */}
        <div id="prescription-printable-area" className="flex-1 overflow-y-auto p-8 bg-white text-black space-y-6 print:p-0">
          {/* Clinic Header */}
          <div className="border-b-2 border-black pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-blue-900">VETCARE SPECIALTY PET HOSPITAL</h1>
              <p className="text-xs text-gray-600 mt-0.5">Plot 42, Central Avenue, Near Medical Square, Nagpur - 440009</p>
              <p className="text-xs text-gray-600">Phone: +91 712 2548899 · Reg No: MH/VET/2019/8821</p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <p className="font-bold text-sm text-blue-900">{visit?.doctorName || "Dr. Rohit Sharma, B.V.Sc & A.H."}</p>
              <p className="text-gray-500">Chief Veterinary Physician &amp; Surgeon</p>
              <p className="text-gray-500 font-mono">Date: {visit?.date}</p>
            </div>
          </div>

          {/* Patient Details Snapshot Box */}
          <div className="rounded-lg border border-gray-300 p-3.5 text-xs grid grid-cols-3 gap-3 bg-gray-50">
            <div>
              <p><span className="text-gray-500">Pet Name:</span> <strong className="text-sm text-blue-900">{visit?.petName}</strong></p>
              <p><span className="text-gray-500">Species/Breed:</span> {visit?.species} · {visit?.breed}</p>
              <p><span className="text-gray-500">Patient UID:</span> <strong className="font-mono">{visit?.petId}</strong></p>
            </div>
            <div>
              <p><span className="text-gray-500">Parent/Owner:</span> <strong>{visit?.ownerName}</strong></p>
              <p><span className="text-gray-500">Contact:</span> {visit?.ownerPhone}</p>
              <p><span className="text-gray-500">Weight &amp; Temp:</span> {visit?.vitals?.weightKg ? `${visit.vitals.weightKg} kg` : "—"} · {visit?.vitals?.tempC ? `${visit.vitals.tempC} °C` : "—"}</p>
            </div>
            <div>
              <p><span className="text-gray-500">Rx No:</span> <strong className="font-mono">{visit?.prescriptionNo}</strong></p>
              <p><span className="text-gray-500">Visit No:</span> <span className="font-mono">{visit?.visitId}</span></p>
            </div>
          </div>

          {/* Clinical Findings & Diagnosis */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Clinical Diagnosis</h3>
            <p className="text-sm font-semibold text-gray-900 border-l-2 border-blue-600 pl-2.5 py-0.5">
              {visit?.diagnosis || "General Clinical Health Review"}
            </p>
            {visit?.clinicalNotes && (
              <p className="text-xs text-gray-600 italic pl-2.5 mt-1">
                Notes: {visit.clinicalNotes}
              </p>
            )}
          </div>

          {/* Rx Medications Table */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-base font-bold text-blue-900">
              <span className="text-lg">℞</span> Prescribed Medications
            </div>

            <table className="w-full text-xs border border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-left">
                  <th className="p-2 w-8">#</th>
                  <th className="p-2">Medicine / Formulation</th>
                  <th className="p-2 text-center">Quantity</th>
                  <th className="p-2">Dosage Instructions / Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {medicines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      No prescription medicines required. Symptomatic monitoring advised.
                    </td>
                  </tr>
                ) : (
                  medicines.map((m: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2 text-gray-500">{idx + 1}</td>
                      <td className="p-2 font-bold text-gray-900">{m.name}</td>
                      <td className="p-2 text-center font-medium">{m.quantity}</td>
                      <td className="p-2 text-gray-700 font-medium">{m.dosageInstructions || "As directed by physician"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Follow-up Reminders */}
          <div className="rounded-lg border border-dashed border-gray-300 p-3 text-xs grid grid-cols-3 gap-2 bg-blue-50/50">
            <div>
              <span className="text-gray-500">Next Follow-up Visit:</span>
              <p className="font-bold text-gray-900">{visit?.nextVisitDate || "On distress / As needed"}</p>
            </div>
            <div>
              <span className="text-gray-500">Next Vaccination Due:</span>
              <p className="font-bold text-gray-900">{visit?.nextVaccineDate || "Per annual schedule"}</p>
            </div>
            <div>
              <span className="text-gray-500">Next Deworming Due:</span>
              <p className="font-bold text-gray-900">{visit?.nextDewormingDate || "Quarterly"}</p>
            </div>
          </div>

          {/* Signature & Disclaimer Footer */}
          <div className="pt-8 flex items-end justify-between text-xs border-t border-gray-200">
            <div className="space-y-0.5 text-gray-500 text-[10px]">
              <p>• Administer all medicines strictly as prescribed.</p>
              <p>• In case of severe vomiting, diarrhea or lethargy, report immediately.</p>
            </div>
            <div className="text-center space-y-1">
              <div className="w-40 border-b border-gray-400 pb-8 text-center text-gray-400 font-serif italic">
                Digitally Signed
              </div>
              <p className="font-bold text-gray-800">{visit?.doctorName || "Dr. Rohit Sharma"}</p>
              <p className="text-[10px] text-gray-500">Registered Veterinary Practitioner</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
