import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Stethoscope, Pill, Syringe, Utensils, AlertCircle, Sparkles, Calendar, CheckSquare } from "lucide-react";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";

interface Props {
  visit: any;
  open: boolean;
  onClose: () => void;
}

export function PrescriptionPrintView({ visit, open, onClose }: Props) {
  // Doctor specialty/title lookup — keeps the letterhead accurate for whichever doctor treated this visit
  const [doctorsList, setDoctorsList] = useState<Array<{ id: string; name: string; specialty?: string }>>([]);
  useEffect(() => {
    listApprovedDoctorsFn()
      .then((docs) => setDoctorsList(docs || []))
      .catch((e) => console.warn("Could not load doctors list:", e));
  }, []);
  const getDoctorTitle = (doctorName: string | undefined) =>
    doctorsList.find((d) => d.name === doctorName)?.specialty || "Chief Veterinary Physician & Surgeon";

  const handlePrint = () => {
    printOrSaveDocumentAsPdf("prescription-printable-area", `Prescription_${visit?.prescriptionNo || "Rx"}`);
  };

  const handleDownload = () => {
    printOrSaveDocumentAsPdf("prescription-printable-area", `Prescription_${visit?.prescriptionNo || "Rx"}`);
  };

  const rx = visit?.prescriptionData;
  const weightVal = rx?.weight ?? rx?.patientDetails?.weight ?? visit?.vitals?.weightKg ?? visit?.vitals?.weight;
  const weightUnit = rx?.weightUnit ?? rx?.patientDetails?.weightUnit ?? visit?.vitals?.weightUnit ?? "kg";
  const tempVal = rx?.bodyTemperature ?? rx?.patientDetails?.temperature ?? visit?.vitals?.tempC ?? visit?.vitals?.temp;
  const tempUnit = rx?.temperatureUnit ?? rx?.patientDetails?.temperatureUnit ?? visit?.vitals?.tempUnit ?? "°C";

  const clinicalFindings: string[] = rx?.clinicalFindings || [];
  const findingsOther: string = rx?.clinicalFindingsOther || "";
  const previousHistory: string = rx?.previousHistory || "";
  const symptomsText: string = rx?.symptomsText || visit?.vitals?.complaint || "";

  const immediateMeds = rx?.immediateMedicines || [];
  const prescribedMeds = rx?.prescribedMedicines || [];
  const injectables = rx?.injectables || [];
  const dietItems = rx?.prescribedFood || rx?.prescribedDiet || [];
  const foodItems = rx?.animalFood || rx?.foodItems || [];
  const accessories = rx?.accessories || [];
  const followUp = rx?.followUp;
  const bloodTests = rx?.bloodTests || followUp?.bloodTests || [];

  // Fallback for legacy records without structured rx data
  const legacyMeds = (visit?.items || []).filter(
    (i: any) => i.lineType === "Pharmacy" || i.lineType === "Vaccine" || i.lineType === "Medicine"
  );

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Top Control Header */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-4 text-primary" />
            <span className="text-sm font-bold text-navy">
              Medical Prescription (Rx) — {visit?.prescriptionNo || "DRAFT"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs gap-1">
              <Download className="size-3.5" /> Download PDF
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs gap-1 bg-primary text-primary-foreground">
              <Printer className="size-3.5" /> Print Rx Sheet
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Area */}
        <div id="prescription-printable-area" className="flex-1 overflow-y-auto p-8 bg-white text-slate-900 space-y-5 print:p-0 print:space-y-4 font-sans text-xs">
          
          {/* Clinic Letterhead */}
          <div className="border-b-2 border-slate-900 pb-3.5 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <img src="/clinic-logo.png" alt="Clinic Logo" style={{ height: 36, width: "auto" }} />
              <div>
                <h1 className="text-xl font-black tracking-tight text-blue-900 uppercase">
                  Real Care Small Animal Clinic
                </h1>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Plot 42, Central Avenue, Near Medical Square, Nagpur - 440009
                </p>
                <p className="text-[11px] text-slate-600">
                  Phone: +91 712 2548899 · Email: care@vetcarehospital.com · Reg No: MH/VET/2019/8821
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] space-y-0.5">
              <p className="font-bold text-sm text-blue-900">
                {visit?.doctorName || "Dr. Rohit Sharma, B.V.Sc & A.H."}
              </p>
              <p className="text-slate-500 text-[10px]">{getDoctorTitle(visit?.doctorName)}</p>
              <p className="text-slate-500 font-mono text-[10px]">
                Date: {formatDisplayDate(visit?.date) || visit?.date || new Date().toISOString().slice(0, 10)}
              </p>
            </div>
          </div>

          {/* Section 1: Patient & Client Details */}
          <div className="rounded-xl border border-slate-200 p-3.5 text-[11px] grid grid-cols-3 gap-3 bg-slate-50">
            <div>
              <p className="text-slate-500">Patient / Pet Name:</p>
              <p className="text-sm font-bold text-blue-900">{visit?.petName || "Patient"}</p>
              <p className="text-slate-600 mt-0.5">
                <span className="font-semibold">{visit?.species || "Canine"}</span> · {visit?.breed || "Standard"}
              </p>
              <p className="text-slate-500 font-mono text-[10px] mt-0.5">
                UID: <span className="font-bold text-slate-800">{visit?.petId || "PET-0001"}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-500">Parent / Owner:</p>
              <p className="text-xs font-bold text-slate-900">{visit?.ownerName || "Client"}</p>
              <p className="text-slate-600 mt-0.5">Contact: {visit?.ownerPhone || "N/A"}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                  Weight: {weightVal ? `${weightVal} ${weightUnit}` : "—"}
                </span>
                <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                  Temp: {tempVal ? `${tempVal} ${tempUnit}` : "—"}
                </span>
              </div>
            </div>
            <div>
              <p className="text-slate-500">Prescription Reference:</p>
              <p className="text-xs font-mono font-extrabold text-blue-900">
                {visit?.prescriptionNo || "VET-RX-PENDING"}
              </p>
              <p className="text-slate-500 font-mono text-[10px] mt-0.5">
                Visit ID: <span className="font-semibold text-slate-700">{visit?.visitId}</span>
              </p>
              {visit?.branch && (
                <p className="text-slate-500 text-[10px] mt-0.5">Clinic Branch: {visit?.branch}</p>
              )}
            </div>
          </div>

          {/* Section 2 & 3: History & Symptoms */}
          {(previousHistory || symptomsText || visit?.clinicalNotes) && (
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 space-y-2">
              {symptomsText && (
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Presenting Symptoms / Chief Complaint
                  </h4>
                  <p className="text-xs text-slate-900 font-medium mt-0.5">{symptomsText}</p>
                </div>
              )}
              {previousHistory && (
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Previous Medical History / Past Treatments
                  </h4>
                  <p className="text-[11px] text-slate-700 italic mt-0.5 whitespace-pre-wrap">{previousHistory}</p>
                </div>
              )}
              {visit?.clinicalNotes && !previousHistory && (
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Clinical Examination Notes
                  </h4>
                  <p className="text-[11px] text-slate-700 italic mt-0.5">{visit.clinicalNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Section 4: Clinical Findings */}
          {clinicalFindings.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <CheckSquare className="size-3.5 text-blue-700" /> Clinical Findings
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {clinicalFindings.map((cf, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-900 border border-blue-200"
                  >
                    ✓ {cf}
                  </span>
                ))}
                {findingsOther && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300 italic">
                    Other: {findingsOther}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Diagnosis */}
          {visit?.diagnosis && (
            <div className="border-l-4 border-blue-600 pl-3 py-1 bg-blue-50/40 rounded-r-md">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Provisional Diagnosis</span>
              <p className="text-xs font-bold text-slate-900">{visit.diagnosis}</p>
            </div>
          )}

          {/* Section 5A (i): Immediate Medicines (Administered in Hospital) */}
          {immediateMeds.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                <Pill className="size-3.5 text-amber-700" /> Immediate Treatment (Administered At Hospital)
              </div>
              <table className="w-full text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-amber-50/80 border-b border-slate-200 text-left font-bold text-amber-950">
                    <th className="p-1.5 w-6">#</th>
                    <th className="p-1.5">Medicine Name</th>
                    <th className="p-1.5 text-center w-24">Dose &amp; Unit</th>
                    <th className="p-1.5 text-center w-20">Route</th>
                    <th className="p-1.5 text-center w-20">Time</th>
                    <th className="p-1.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {immediateMeds.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-1.5 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-1.5 font-bold text-slate-900">{m.medicineName}</td>
                      <td className="p-1.5 text-center font-mono font-semibold">
                        {m.dose} {m.unit}
                      </td>
                      <td className="p-1.5 text-center font-medium text-slate-700">{m.route || "Oral"}</td>
                      <td className="p-1.5 text-center font-medium text-slate-700">{m.time || "Immediate"}</td>
                      <td className="p-1.5 text-slate-600 italic">{m.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 5A (ii): Prescribed Medicines (Take-Home Rx) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
              <span className="text-base font-serif font-black">℞</span> Prescribed Medications (Take-Home Schedule)
            </div>

            {prescribedMeds.length > 0 ? (
              <table className="w-full text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-blue-50/80 border-b border-slate-200 text-left font-bold text-blue-950">
                    <th className="p-1.5 w-6">#</th>
                    <th className="p-1.5">Medicine / Formulation</th>
                    <th className="p-1.5 text-center w-20">Dose</th>
                    <th className="p-1.5 text-center w-28">Frequency</th>
                    <th className="p-1.5 text-center w-24">Duration</th>
                    <th className="p-1.5 text-center w-20">Route</th>
                    <th className="p-1.5">Timing &amp; Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prescribedMeds.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-1.5 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-1.5 font-bold text-slate-900">
                        {m.medicineName}
                        {m.note && <span className="block text-[10px] text-slate-500 font-normal italic">{m.note}</span>}
                      </td>
                      <td className="p-1.5 text-center font-mono font-semibold">
                        {m.dose} {m.unit}
                      </td>
                      <td className="p-1.5 text-center font-semibold text-blue-900">{m.frequency}</td>
                      <td className="p-1.5 text-center font-medium text-slate-800">{m.duration}</td>
                      <td className="p-1.5 text-center font-medium text-slate-700">{m.route || "Oral"}</td>
                      <td className="p-1.5 text-slate-700 font-medium">{m.time || "After Food"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-left font-bold text-slate-700">
                    <th className="p-1.5 w-6">#</th>
                    <th className="p-1.5">Medicine / Item</th>
                    <th className="p-1.5 text-center w-16">Qty</th>
                    <th className="p-1.5">Dosage / Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {legacyMeds.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-400 italic">
                        No take-home medications prescribed. Symptomatic monitoring advised.
                      </td>
                    </tr>
                  ) : (
                    legacyMeds.map((m: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-1.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-1.5 font-bold text-slate-900">{m.name}</td>
                        <td className="p-1.5 text-center font-mono font-semibold">{m.quantity}</td>
                        <td className="p-1.5 text-slate-700">{m.dosageInstructions || "As directed by veterinarian"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Section 5B: Injectable Administered */}
          {injectables.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                <Syringe className="size-3.5 text-purple-700" /> Injectables Administered In Hospital
              </div>
              <table className="w-full text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-purple-50/80 border-b border-slate-200 text-left font-bold text-purple-950">
                    <th className="p-1.5 w-6">#</th>
                    <th className="p-1.5">Drug / Vaccine</th>
                    <th className="p-1.5 text-center w-24">Dose &amp; Unit</th>
                    <th className="p-1.5 text-center w-20">Route</th>
                    <th className="p-1.5 text-center w-24">Time Given</th>
                    <th className="p-1.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {injectables.map((inj: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-1.5 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-1.5 font-bold text-slate-900">{inj.name || inj.drugName}</td>
                      <td className="p-1.5 text-center font-mono font-semibold">
                        {inj.quantity || inj.dose || 1} {inj.unit || ""}
                      </td>
                      <td className="p-1.5 text-center font-medium text-slate-700">{inj.route || "IM/SC/IV"}</td>
                      <td className="p-1.5 text-center font-medium text-slate-700">{inj.time || "In-Clinic"}</td>
                      <td className="p-1.5 text-slate-600 italic">{inj.dosageInstructions || inj.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 7 & 8: Dietary Plan, Food & Accessories */}
          {(dietItems.length > 0 || foodItems.length > 0 || accessories.length > 0) && (
            <div className="rounded-xl border border-slate-200 p-3 bg-amber-50/30 space-y-2">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <Utensils className="size-3.5 text-amber-700" /> Dietary Advice &amp; Care Items
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                {dietItems.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-800 block text-[10px] uppercase">Prescribed Diet Plan:</span>
                    <ul className="list-disc list-inside text-slate-700 mt-0.5 space-y-0.5">
                      {dietItems.map((d: any, di: number) => (
                        <li key={di}>
                          <strong className="text-slate-900">{d.name || d.foodName}</strong>
                          {(d.dosageInstructions || d.specialInstructions) && ` — ${d.dosageInstructions || d.specialInstructions}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(foodItems.length > 0 || accessories.length > 0) && (
                  <div>
                    <span className="font-bold text-slate-800 block text-[10px] uppercase">Dispensed Food &amp; Accessories:</span>
                    <p className="text-slate-700 mt-0.5">
                      {[
                        ...foodItems.map((f: any) => `${f.name || f.foodName || "Food"} (Qty: ${f.quantity})`),
                        ...accessories.map((a: any) => `${a.name || a.accessoryName || "Accessory"} (Qty: ${a.quantity})`),
                      ].join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 6: Follow-up & Reminders */}
          <div className="rounded-xl border border-dashed border-blue-200 p-3 text-[11px] grid grid-cols-3 gap-2 bg-blue-50/40">
            <div>
              <span className="text-slate-500 block text-[10px] font-semibold">Review / Follow-up Visit:</span>
              <p className="font-bold text-slate-900">
                {formatDisplayDate(followUp?.nextTreatmentDate || visit?.nextVisitDate) ||
                  followUp?.nextTreatmentDate ||
                  visit?.nextVisitDate ||
                  "On distress / As needed"}
              </p>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-semibold">Next Vaccination Due:</span>
              <p className="font-bold text-slate-900">
                {formatDisplayDate(followUp?.nextVaccineDate || visit?.nextVaccineDate) ||
                  followUp?.nextVaccineDate ||
                  visit?.nextVaccineDate ||
                  "Per annual schedule"}
              </p>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-semibold">Next Deworming Due:</span>
              <p className="font-bold text-slate-900">
                {formatDisplayDate(followUp?.nextDewormingDate || visit?.nextDewormingDate) ||
                  followUp?.nextDewormingDate ||
                  visit?.nextDewormingDate ||
                  "Quarterly (Every 3 months)"}
              </p>
            </div>
            {followUp?.instructions && (
              <div className="col-span-3 pt-1 border-t border-blue-200/60 mt-1">
                <span className="text-slate-600 font-semibold text-[10px]">Doctor's Special Instructions:</span>
                <p className="text-slate-800 italic mt-0.5">{followUp.instructions}</p>
              </div>
            )}
            {bloodTests && bloodTests.length > 0 && (
              <div className="col-span-3 pt-1 border-t border-blue-200/60 mt-1">
                <span className="text-slate-600 font-semibold text-[10px]">Ordered Blood / Diagnostic Tests:</span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {bloodTests.map((t: any) => t.testName || t.testType).join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Footer Sign-off & Disclaimer */}
          <div className="pt-6 flex items-end justify-between text-slate-600 border-t border-slate-200 text-[10px]">
            <div className="space-y-0.5">
              <p>• Administer all medicines strictly per prescribed dose and schedule.</p>
              <p>• Store temperature-sensitive medications in a cool and dry place.</p>
              <p>• In case of severe vomiting, diarrhea or distress, contact emergency immediately.</p>
            </div>
            <div className="text-center space-y-1">
              <div className="w-44 border-b border-slate-400 pb-6 text-center text-slate-400 font-serif italic text-[10px]">
                Digitally Signed
              </div>
              <p className="font-bold text-slate-800 text-[11px]">{visit?.doctorName || "Dr. Rohit Sharma"}</p>
              <p className="text-slate-500 text-[9px]">Registered Veterinary Practitioner</p>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
