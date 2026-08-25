import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Receipt,
  User,
  Heart,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  FileText,
  Clock,
  Sparkles,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Download,
  Edit,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useErp } from "@/lib/erp/store";
import { getItemsFn } from "@/lib/mongodb/serverFns/inventory";
import { finalizeVisitAndBillFn } from "@/lib/mongodb/serverFns/clinical";
import { PrescriptionPrintView } from "./PrescriptionPrintView";
import { InvoicePrintView } from "./InvoicePrintView";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";

interface VisitWorkspaceProps {
  open: boolean;
  onClose: () => void;
  visit: any;
  onVisitFinalized?: (updatedVisit: any) => void;
}

interface BillLine {
  id: string;
  lineType: "Vaccine" | "Consultation" | "Pharmacy" | "Procedure" | "Diagnostic" | "Service";
  itemCode?: string | undefined;
  batchNo?: string | undefined;
  name: string;
  dosageInstructions?: string | undefined;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstRate: number;
}

export function VisitWorkspaceModal({ open, onClose, visit, onVisitFinalized }: VisitWorkspaceProps) {
  const { currentUser, role } = useErp();
  const activeDoctorName = visit?.doctorName || currentUser?.fullName || role?.person || "Dr. Rohit Sharma";

  const [catalogItems, setCatalogItems] = useState<any[]>([]);

  const [tab, setTab] = useState<"consultation" | "billing" | "completed">("consultation");
  
  // Vitals & Clinical Form
  const [weightKg, setWeightKg] = useState(visit?.vitals?.weightKg ? String(visit.vitals.weightKg) : "24.5");
  const [tempC, setTempC] = useState(visit?.vitals?.tempC ? String(visit.vitals.tempC) : "38.5");
  const [complaint, setComplaint] = useState(visit?.vitals?.complaint || "Routine consultation and health review");
  const [diagnosis, setDiagnosis] = useState(visit?.diagnosis || "");
  const [clinicalNotes, setClinicalNotes] = useState(visit?.clinicalNotes || "");
  
  // Reminders
  const [nextVisitDate, setNextVisitDate] = useState(visit?.nextVisitDate || "");
  const [nextVaccineDate, setNextVaccineDate] = useState(visit?.nextVaccineDate || "");
  const [nextDewormingDate, setNextDewormingDate] = useState(visit?.nextDewormingDate || "");

  // Line items state
  const [lines, setLines] = useState<BillLine[]>([
    {
      id: "1",
      lineType: "Consultation",
      name: "Veterinary Consultation & Physical Examination",
      quantity: 1,
      unitPrice: 500,
      discountPercent: 0,
      gstRate: 18,
    },
  ]);

  // Quick Medicine Search
  const [selectedMedicine, setSelectedMedicine] = useState<any | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [dosageText, setDosageText] = useState("");

  // Payment
  const [billType, setBillType] = useState<"GST" | "Non-GST">(visit?.billType || "GST");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Card" | "NetBanking" | "Cheque" | "Account Due">("UPI");
  const [trxRef, setTrxRef] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Print Dialog States
  const [showRxPrint, setShowRxPrint] = useState(false);
  const [showInvoicePrint, setShowInvoicePrint] = useState(false);
  const [finalizedVisit, setFinalizedVisit] = useState<any | null>(null);

  useEffect(() => {
    if (open) {
      void loadCatalog();
    }
  }, [open]);

  const loadCatalog = async () => {
    try {
      const items = await getItemsFn();
      setCatalogItems(items);
    } catch (e) {
      console.warn("Could not load catalog items:", e);
    }
  };

  useEffect(() => {
    if (visit && open) {
      setWeightKg(visit?.vitals?.weightKg ? String(visit.vitals.weightKg) : "24.5");
      setTempC(visit?.vitals?.tempC ? String(visit.vitals.tempC) : "38.5");
      setComplaint(visit?.vitals?.complaint || "Routine consultation and health review");
      setDiagnosis(visit?.diagnosis || "");
      setClinicalNotes(visit?.clinicalNotes || "");
      setNextVisitDate(visit?.nextVisitDate || "");
      setNextVaccineDate(visit?.nextVaccineDate || "");
      setNextDewormingDate(visit?.nextDewormingDate || "");
      if (visit.items && visit.items.length > 0) {
        setLines(visit.items.map((it: any, idx: number) => ({ ...it, id: String(idx + 1) })));
      }

      // If visit is already settled / completed / paid, jump directly to final preview screen!
      const isAlreadyCompleted =
        visit.status === "PAID" ||
        visit.status === "Settled" ||
        visit.status === "Paid" ||
        visit.status === "Completed" ||
        visit.status === "Partially Paid" ||
        (Number(visit.totalAmount || 0) > 0 && Number(visit.amountPaid || 0) >= Number(visit.totalAmount || 0)) ||
        Boolean(visit.diagnosis && Number(visit.totalAmount || 0) > 0);

      if (isAlreadyCompleted) {
        setFinalizedVisit(visit);
        setTab("completed");
      } else {
        setFinalizedVisit(null);
        setTab("consultation");
      }
    }
  }, [visit, open]);

  // Consultation Line Helper & Handlers
  const consultationLine = lines.find((l) => l.lineType === "Consultation");

  const handleSetConsultationFee = (amount: number) => {
    const validAmount = isNaN(amount) ? 0 : Math.max(0, amount);
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.lineType === "Consultation");
      if (idx >= 0) {
        return prev.map((l, i) => (i === idx ? { ...l, unitPrice: validAmount } : l));
      }
      return [
        {
          id: String(Date.now()),
          lineType: "Consultation",
          name: "Veterinary Consultation & Physical Examination",
          quantity: 1,
          unitPrice: validAmount,
          discountPercent: 0,
          gstRate: billType === "GST" ? 18 : 0,
        },
        ...prev,
      ];
    });
  };

  const updateLine = (id: string, field: keyof BillLine, value: any) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  // Dynamic Financial Computations
  const billSummary = useMemo(() => {
    let subtotal = 0;
    let totalTaxable = 0;
    let totalGst = 0;

    for (const l of lines) {
      const lineGross = l.quantity * l.unitPrice;
      const lineDisc = (lineGross * l.discountPercent) / 100;
      const lineNet = lineGross - lineDisc;
      subtotal += lineNet;

      if (billType === "GST" && l.gstRate > 0) {
        const gstPart = (lineNet * l.gstRate) / 100;
        totalGst += gstPart;
        totalTaxable += lineNet;
      } else {
        totalTaxable += lineNet;
      }
    }

    const exactTotal = subtotal + (billType === "GST" ? totalGst : 0);
    const roundedTotal = Math.round(exactTotal);
    const roundOff = roundedTotal - exactTotal;

    return {
      subtotal,
      taxableAmount: totalTaxable,
      gstAmount: totalGst,
      roundOff,
      totalAmount: roundedTotal,
    };
  }, [lines, billType]);

  const handleAddMedicineFromCatalog = () => {
    if (!selectedMedicine) {
      toast.error("Please select a medicine or service from catalog");
      return;
    }

    const isVaccine = selectedMedicine.category === "Vaccine" || selectedMedicine.name.toLowerCase().includes("vaccine");

    const newLine: BillLine = {
      id: String(Date.now()),
      lineType: isVaccine ? "Vaccine" : "Pharmacy",
      itemCode: selectedMedicine.itemCode,
      name: selectedMedicine.name,
      dosageInstructions: dosageText.trim() || undefined,
      quantity: Number(itemQty) || 1,
      unitPrice: selectedMedicine.defaultSalePrice || 250,
      discountPercent: 0,
      gstRate: selectedMedicine.gstRate || 5,
    };

    setLines((prev) => [...prev, newLine]);
    setSelectedMedicine(null);
    setItemQty(1);
    setDosageText("");
    toast.success(`Added ${selectedMedicine.name} to prescription & bill.`);
  };

  const handleAddServiceLine = (name: string, price: number, cat: BillLine["lineType"]) => {
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        lineType: cat,
        name,
        quantity: 1,
        unitPrice: price,
        discountPercent: 0,
        gstRate: cat === "Pharmacy" || cat === "Vaccine" ? 5 : 18,
      },
    ]);
    toast.success(`Added ${name}`);
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleFinalize = async () => {
    if (!diagnosis.trim() && lines.length === 0) {
      toast.error("Please record a diagnosis or at least one bill item");
      return;
    }

    setIsFinalizing(true);
    try {
      const payload = {
        visitId: visit.visitId || `V-${Math.floor(1000 + Math.random() * 9000)}`,
        petId: visit.petId || "PET-0001",
        petName: visit.petName || "Patient",
        species: visit.species || "Canine",
        breed: visit.breed || "Standard",
        ownerId: visit.ownerId || "OWN-0001",
        ownerName: visit.ownerName || "Client",
        ownerPhone: visit.ownerPhone || "N/A",
        branch: visit.branch || "Main Clinic",
        billType: (visit.billType as "GST" | "Non-GST") || billType,
        doctorName: visit.doctorName || activeDoctorName,
        diagnosis: diagnosis.trim() || "Clinical Examination Completed",
        clinicalNotes: clinicalNotes.trim(),
        nextVisitDate: nextVisitDate || undefined,
        nextVaccineDate: nextVaccineDate || undefined,
        nextDewormingDate: nextDewormingDate || undefined,
        items: lines.map((l) => ({
          lineType: l.lineType,
          itemCode: l.itemCode,
          batchNo: l.batchNo,
          name: l.name,
          dosageInstructions: l.dosageInstructions,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
          gstRate: l.gstRate,
          lineTotal: (l.quantity * l.unitPrice) * (1 - l.discountPercent / 100),
        })),
        subtotal: billSummary.subtotal,
        billDiscount: 0,
        taxableAmount: billSummary.taxableAmount,
        gstAmount: billSummary.gstAmount,
        roundOff: billSummary.roundOff,
        totalAmount: billSummary.totalAmount,
        amountPaid: billSummary.totalAmount,
        paymentMode,
        trxRef: trxRef || undefined,
      };


      const updated = await finalizeVisitAndBillFn({ data: payload });
      setFinalizedVisit(updated);
      setTab("completed");
      toast.success(`Visit finalized! Stock batches updated and accounting journal posted.`);
      onVisitFinalized?.(updated);
    } catch (err: any) {
      toast.error(err?.message || "Failed to finalize visit");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handlePrintDocument = (elementId: string, title: string) => {
    printOrSaveDocumentAsPdf(elementId, title);
  };

  const handleDownloadPdf = (elementId: string, docTitle: string) => {
    printOrSaveDocumentAsPdf(elementId, docTitle);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className={cn("max-h-[94vh] flex flex-col p-0 overflow-hidden transition-all duration-300", tab === "completed" ? "max-w-6xl w-[96vw]" : "max-w-5xl")}>
        {/* ── Top Bar Header ────────────────────────────────────────────── */}
        <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
              <Stethoscope className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy">
                  Clinical Consultation — {visit?.petName || "Patient"}
                </h2>
                <span className="font-mono text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {visit?.petId || "PET-0001"}
                </span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                  {visit?.species} · {visit?.breed}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Owner: <span className="font-semibold text-foreground">{visit?.ownerName}</span> ({visit?.ownerPhone}) · Visit ID: <span className="font-mono">{visit?.visitId}</span>
              </p>
            </div>
          </div>

          {/* Workflow Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setTab("consultation")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tab === "consultation" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Stethoscope className="size-3.5" /> 1. Doctor Rx &amp; Diagnosis
            </button>
            <button
              onClick={() => setTab("billing")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tab === "billing" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="size-3.5" /> 2. Billing &amp; Settlement (₹{billSummary.totalAmount})
            </button>
          </div>
        </div>

        {/* ── Main Scrollable Body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === "consultation" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Vitals, Diagnosis & Medicine Picker */}
              <div className="lg:col-span-2 space-y-5">
                {/* Vitals Strip */}
                <div className="erp-card p-4 bg-muted/20">
                  <p className="section-label mb-2.5">Patient Intake Vitals</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Weight (kg)</Label>
                      <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="h-8 text-xs font-semibold" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Body Temp (°C)</Label>
                      <Input value={tempC} onChange={(e) => setTempC(e.target.value)} className="h-8 text-xs font-semibold" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Presenting Complaint</Label>
                      <Input value={complaint} onChange={(e) => setComplaint(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                </div>

                {/* Doctor's Diagnosis & Findings */}
                <div className="erp-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="section-label">Clinical Diagnosis &amp; Findings</p>
                    <span className="text-[11px] text-primary font-semibold">Doctor: {activeDoctorName}</span>
                  </div>
                  <Input
                    placeholder="Primary Diagnosis (e.g. Acute Gastritis, Routine 9-in-1 Vaccination, Otitis Externa)"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="font-medium text-sm"
                  />
                  <textarea
                    rows={3}
                    placeholder="Detailed clinical notes, examination observations, diet advice, or care guidelines..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {/* Doctor Consultation Fee Manual Control */}
                <div className="erp-card p-4 bg-primary-soft/10 border border-primary/20 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <p className="text-xs font-bold text-navy flex items-center gap-1.5">
                        <Stethoscope className="size-3.5 text-primary" /> Doctor Consultation Fee (Manual)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Set custom consultation fee for this doctor visit or pick from quick presets
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          value={consultationLine ? consultationLine.unitPrice : 0}
                          onChange={(e) => handleSetConsultationFee(Number(e.target.value))}
                          className="h-8 text-xs font-bold pl-6 text-foreground bg-card border-primary/40 font-mono"
                          placeholder="Fee (₹)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Fee Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-primary/10">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mr-1">Presets:</span>
                    {[
                      { label: "₹0 (Free / Follow-up)", val: 0 },
                      { label: "₹300 (Re-check)", val: 300 },
                      { label: "₹500 (Standard)", val: 500 },
                      { label: "₹800 (Specialist)", val: 800 },
                      { label: "₹1200 (Emergency / Surgery)", val: 1200 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => handleSetConsultationFee(preset.val)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-semibold border transition-all shadow-2xs",
                          consultationLine && consultationLine.unitPrice === preset.val
                            ? "bg-primary text-primary-foreground border-primary font-bold"
                            : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Inventory Medicine & Vaccine Picker */}
                <div className="erp-card p-4 space-y-3">
                  <p className="section-label">Prescribe Medicines &amp; Vaccines (Live Inventory)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Search Product Catalog</Label>
                      <Select
                        value={selectedMedicine?.itemCode || ""}
                        onValueChange={(code) => {
                          const m = catalogItems.find((x: any) => x.itemCode === code);
                          setSelectedMedicine(m || null);
                        }}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Select medicine / vaccine..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {catalogItems.map((m: any) => (
                            <SelectItem key={m.itemCode} value={m.itemCode}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="font-medium">{m.name}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  ₹{m.defaultSalePrice || 250} · {m.itemCode}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">Quantity &amp; Dosage Instructions</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={itemQty}
                          onChange={(e) => setItemQty(Number(e.target.value))}
                          className="w-16 h-9 text-xs"
                        />
                        <Input
                          placeholder="e.g. 1 tab BID x 5 days"
                          value={dosageText}
                          onChange={(e) => setDosageText(e.target.value)}
                          className="flex-1 h-9 text-xs"
                        />
                        <Button size="sm" onClick={handleAddMedicineFromCatalog} className="h-9 px-3">
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Add Clinical Procedures */}
                  <div className="pt-2 flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] text-muted-foreground font-semibold">Quick Procedures:</span>
                    {[
                      { name: "Deworming Dose", price: 200, cat: "Procedure" as const },
                      { name: "Ear Cleaning / Flush", price: 350, cat: "Procedure" as const },
                      { name: "Nail Clipping", price: 150, cat: "Procedure" as const },
                      { name: "CBC Blood Test", price: 750, cat: "Diagnostic" as const },
                    ].map((svc) => (
                      <button
                        key={svc.name}
                        onClick={() => handleAddServiceLine(svc.name, svc.price, svc.cat)}
                        className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium hover:border-primary/40 hover:bg-primary-soft/30 transition-all"
                      >
                        + {svc.name} (₹{svc.price})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Follow-up Scheduling */}
                <div className="erp-card p-4">
                  <p className="section-label mb-2.5">Clinical Follow-up &amp; Reminder Schedule</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Next Visit Date</Label>
                      <Input type="date" value={nextVisitDate} onChange={(e) => setNextVisitDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Next Vaccine Due</Label>
                      <Input type="date" value={nextVaccineDate} onChange={(e) => setNextVaccineDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Next Deworming Due</Label>
                      <Input type="date" value={nextDewormingDate} onChange={(e) => setNextDewormingDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: Live Prescription / Items Summary */}
              <div className="space-y-4">
                <div className="erp-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <p className="font-bold text-sm text-foreground">Prescribed Items ({lines.length})</p>
                    <span className="font-bold text-primary text-sm font-mono">₹{billSummary.totalAmount}</span>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {lines.map((l) => (
                      <div key={l.id} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1">
                            <span className="font-semibold text-foreground">{l.name}</span>
                            <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {l.lineType}
                            </span>
                          </div>
                          <button onClick={() => handleRemoveLine(l.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        {l.dosageInstructions && (
                          <p className="text-[11px] text-muted-foreground italic">
                            Dosage: {l.dosageInstructions}
                          </p>
                        )}

                        {/* Editable Fee & Quantity Controls */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/30 gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">Fee/Price:</span>
                            <div className="relative w-20">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">₹</span>
                              <Input
                                type="number"
                                min={0}
                                value={l.unitPrice}
                                onChange={(e) => updateLine(l.id, "unitPrice", Number(e.target.value))}
                                className="h-6 text-xs font-mono font-bold pl-4 text-right pr-1 bg-card border-border"
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground">×</span>
                            <Input
                              type="number"
                              min={1}
                              value={l.quantity}
                              onChange={(e) => updateLine(l.id, "quantity", Math.max(1, Number(e.target.value)))}
                              className="h-6 w-12 text-xs font-mono text-center px-1 bg-card border-border"
                            />
                          </div>
                          <span className="font-bold text-foreground font-mono text-xs">₹{l.quantity * l.unitPrice}</span>
                        </div>
                      </div>
                    ))}

                    {!consultationLine && (
                      <button
                        type="button"
                        onClick={() => handleSetConsultationFee(500)}
                        className="w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="size-3.5" /> Add Doctor Consultation Fee (₹500)
                      </button>
                    )}
                  </div>

                  <Button onClick={() => setTab("billing")} className="w-full text-xs font-bold mt-2">
                    Proceed to Billing &amp; Settlement →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "billing" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Categorized Bill Items & Bill Type */}
              <div className="lg:col-span-2 space-y-4">
                <div className="erp-card p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Invoice Itemization</h3>
                    <p className="text-xs text-muted-foreground">Review and adjust unit prices, quantities or discounts for each clinical service</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold">Bill Type:</Label>
                    <Select value={billType} onValueChange={(v) => setBillType(v as any)}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GST">GST Tax Invoice</SelectItem>
                        <SelectItem value="Non-GST">Non-GST Receipt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="erp-card overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left font-semibold text-muted-foreground">
                        <th className="px-4 py-2.5">Category &amp; Item</th>
                        <th className="px-3 py-2.5 text-center w-20">Qty</th>
                        <th className="px-3 py-2.5 text-right w-28">Price (₹)</th>
                        <th className="px-3 py-2.5 text-center w-20">Disc (%)</th>
                        {billType === "GST" && <th className="px-3 py-2.5 text-center w-20">GST %</th>}
                        <th className="px-4 py-2.5 text-right w-28">Total (₹)</th>
                        <th className="px-2 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {lines.map((l) => (
                        <tr key={l.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-foreground">{l.name}</p>
                            <span className="text-[10px] text-muted-foreground">{l.lineType} {l.batchNo && `· Batch: ${l.batchNo}`}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="number"
                              min={1}
                              value={l.quantity}
                              onChange={(e) => updateLine(l.id, "quantity", Math.max(1, Number(e.target.value)))}
                              className="h-7 w-16 text-center text-xs font-mono mx-auto bg-card"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="relative inline-block w-24">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-[10px]">₹</span>
                              <Input
                                type="number"
                                min={0}
                                value={l.unitPrice}
                                onChange={(e) => updateLine(l.id, "unitPrice", Number(e.target.value))}
                                className="h-7 pl-5 pr-1 text-right text-xs font-mono font-semibold bg-card"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={l.discountPercent}
                              onChange={(e) => updateLine(l.id, "discountPercent", Number(e.target.value))}
                              className="h-7 w-16 text-center text-xs font-mono mx-auto bg-card"
                            />
                          </td>
                          {billType === "GST" && <td className="px-3 py-2.5 text-center text-muted-foreground font-mono">{l.gstRate}%</td>}
                          <td className="px-4 py-2.5 text-right font-bold text-foreground font-mono">
                            ₹{((l.quantity * l.unitPrice) * (1 - l.discountPercent / 100)).toFixed(2)}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <button onClick={() => handleRemoveLine(l.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Col: Summary & Payment Modes */}
              <div className="space-y-4">
                <div className="erp-card p-5 space-y-4">
                  <p className="section-label">Payment Breakdown</p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>₹{billSummary.subtotal.toFixed(2)}</span>
                    </div>
                    {billType === "GST" && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST (CGST + SGST)</span>
                        <span>+₹{billSummary.gstAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Round-off Adjustment</span>
                      <span>{billSummary.roundOff >= 0 ? `+₹${billSummary.roundOff.toFixed(2)}` : `-₹${Math.abs(billSummary.roundOff).toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-base pt-2 border-t border-border text-foreground">
                      <span>Grand Total</span>
                      <span className="text-primary">₹{billSummary.totalAmount}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="text-xs font-semibold">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI (Google Pay / PhonePe)</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Debit / Credit Card</SelectItem>
                        <SelectItem value="NetBanking">NetBanking / NEFT</SelectItem>
                        <SelectItem value="Account Due">Post to Client Due A/C</SelectItem>
                      </SelectContent>
                    </Select>

                    {paymentMode !== "Cash" && paymentMode !== "Account Due" && (
                      <Input
                        placeholder="Transaction / UPI Ref No. (Optional)"
                        value={trxRef}
                        onChange={(e) => setTrxRef(e.target.value)}
                        className="text-xs h-8"
                      />
                    )}
                  </div>

                  <Button
                    onClick={handleFinalize}
                    disabled={isFinalizing}
                    className="w-full font-bold bg-success hover:bg-success/90 text-success-foreground"
                  >
                    {isFinalizing ? "Processing & Syncing..." : `Finalize & Collect ₹${billSummary.totalAmount} ✓`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "completed" && finalizedVisit && (
            <div className="space-y-6">
              {/* Top Success & Quick Actions Banner */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 dark:bg-emerald-950/20 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/30 shrink-0">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">Visit Finalized &amp; Settled!</h3>
                      <span className="text-[11px] font-bold bg-white dark:bg-slate-900 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                        Rx: {finalizedVisit.prescriptionNo}
                      </span>
                      <span className="text-[11px] font-bold bg-white dark:bg-slate-900 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                        Inv: {finalizedVisit.invoiceNo}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
                      Batch stock decremented in live inventory, sales journal posted, and documents generated below.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTab("consultation")}
                    className="h-8 text-xs font-semibold bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs gap-1.5"
                  >
                    <Edit className="size-3.5" /> Edit Consultation
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintDocument("prescription-preview-card", `Prescription_${finalizedVisit.prescriptionNo}`)}
                    className="h-8 text-xs font-semibold bg-white hover:bg-slate-50 border-emerald-200 text-emerald-900 shadow-2xs gap-1.5"
                  >
                    <Printer className="size-3.5" /> Print Rx
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintDocument("invoice-preview-card", `Invoice_${finalizedVisit.invoiceNo}`)}
                    className="h-8 text-xs font-semibold bg-white hover:bg-slate-50 border-emerald-200 text-emerald-900 shadow-2xs gap-1.5"
                  >
                    <Printer className="size-3.5" /> Print Invoice
                  </Button>

                  <Button
                    size="sm"
                    onClick={onClose}
                    className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
                  >
                    <CheckCircle2 className="size-3.5" /> Done &amp; Return to Dashboard
                  </Button>
                </div>
              </div>

              {/* Side-by-Side Dual Pane Document Previews */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* ── LEFT PANE: MEDICAL PRESCRIPTION (RX) ────────────────────────── */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                        <Stethoscope className="size-3.5" />
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">1. Medical Prescription (Rx) Preview</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPdf("prescription-preview-card", `Prescription_${finalizedVisit.prescriptionNo}.pdf`)}
                        className="h-7 px-2.5 text-[11px] font-semibold gap-1"
                      >
                        <Download className="size-3" /> Download PDF
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handlePrintDocument("prescription-preview-card", `Prescription_${finalizedVisit.prescriptionNo}`)}
                        className="h-7 px-2.5 text-[11px] font-bold bg-primary text-primary-foreground gap-1"
                      >
                        <Printer className="size-3" /> Print Rx Sheet
                      </Button>
                    </div>
                  </div>

                  {/* Prescription Paper Container */}
                  <div
                    id="prescription-preview-card"
                    className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-6 shadow-md space-y-5 text-xs font-sans"
                  >
                    {/* Clinic Header */}
                    <div className="border-b-2 border-slate-900 pb-3.5 flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-black tracking-tight text-blue-900 uppercase">VETCARE SPECIALTY PET HOSPITAL</h2>
                        <p className="text-[11px] text-slate-600 mt-0.5">Plot 42, Central Avenue, Near Medical Square, Nagpur - 440009</p>
                        <p className="text-[11px] text-slate-600">Phone: +91 712 2548899 · Reg: MH/VET/2019/8821</p>
                      </div>
                      <div className="text-right text-[11px] space-y-0.5">
                        <p className="font-bold text-xs text-blue-900">{finalizedVisit.doctorName || activeDoctorName}</p>
                        <p className="text-slate-500 text-[10px]">Chief Veterinary Physician &amp; Surgeon</p>
                        <p className="text-slate-500 font-mono text-[10px]">Date: {finalizedVisit.date || new Date().toISOString().slice(0, 10)}</p>
                      </div>
                    </div>

                    {/* Patient Details Snapshot */}
                    <div className="rounded-xl border border-slate-200 p-3 text-[11px] grid grid-cols-3 gap-2 bg-slate-50">
                      <div>
                        <p><span className="text-slate-500">Pet:</span> <strong className="text-blue-900 text-xs">{finalizedVisit.petName}</strong></p>
                        <p><span className="text-slate-500">Breed:</span> {finalizedVisit.species} · {finalizedVisit.breed}</p>
                        <p><span className="text-slate-500">UID:</span> <strong className="font-mono">{finalizedVisit.petId}</strong></p>
                      </div>
                      <div>
                        <p><span className="text-slate-500">Owner:</span> <strong>{finalizedVisit.ownerName}</strong></p>
                        <p><span className="text-slate-500">Phone:</span> {finalizedVisit.ownerPhone}</p>
                        <p><span className="text-slate-500">Weight:</span> {finalizedVisit.vitals?.weightKg ? `${finalizedVisit.vitals.weightKg} kg` : "—"}</p>
                      </div>
                      <div>
                        <p><span className="text-slate-500">Rx No:</span> <strong className="font-mono text-blue-900">{finalizedVisit.prescriptionNo}</strong></p>
                        <p><span className="text-slate-500">Visit No:</span> <span className="font-mono">{finalizedVisit.visitId}</span></p>
                        <p><span className="text-slate-500">Temp:</span> {finalizedVisit.vitals?.tempC ? `${finalizedVisit.vitals.tempC} °C` : "—"}</p>
                      </div>
                    </div>

                    {/* Diagnosis & Findings */}
                    <div className="space-y-1">
                      <h5 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Clinical Diagnosis</h5>
                      <p className="text-xs font-semibold text-slate-900 border-l-2 border-blue-600 pl-2 py-0.5">
                        {finalizedVisit.diagnosis || "General Clinical Health Review"}
                      </p>
                      {finalizedVisit.clinicalNotes && (
                        <p className="text-[11px] text-slate-600 italic pl-2 mt-0.5">
                          Notes: {finalizedVisit.clinicalNotes}
                        </p>
                      )}
                    </div>

                    {/* Prescribed Medications Table */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 font-bold text-blue-900 text-xs">
                        <span className="text-sm font-serif">℞</span> Prescribed Medications
                      </div>

                      <table className="w-full text-[11px] border border-slate-200">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-left font-semibold text-slate-700">
                            <th className="p-1.5 w-6">#</th>
                            <th className="p-1.5">Medicine / Formulation</th>
                            <th className="p-1.5 text-center w-12">Qty</th>
                            <th className="p-1.5">Dosage / Instructions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(finalizedVisit.items || []).filter((i: any) => i.lineType === "Pharmacy" || i.lineType === "Vaccine").length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-3 text-center text-slate-400 italic">
                                No pharmacy medications required. Symptomatic monitoring advised.
                              </td>
                            </tr>
                          ) : (
                            (finalizedVisit.items || [])
                              .filter((i: any) => i.lineType === "Pharmacy" || i.lineType === "Vaccine")
                              .map((m: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="p-1.5 text-slate-400">{idx + 1}</td>
                                  <td className="p-1.5 font-bold text-slate-900">{m.name}</td>
                                  <td className="p-1.5 text-center font-medium">{m.quantity}</td>
                                  <td className="p-1.5 text-slate-700">{m.dosageInstructions || "As directed by physician"}</td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Follow-up Reminders */}
                    <div className="rounded-xl border border-dashed border-blue-200 p-2.5 text-[11px] grid grid-cols-3 gap-1.5 bg-blue-50/40">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Follow-up Visit:</span>
                        <p className="font-bold text-slate-900">{finalizedVisit.nextVisitDate || "On distress / As needed"}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Vaccination Due:</span>
                        <p className="font-bold text-slate-900">{finalizedVisit.nextVaccineDate || "Per annual schedule"}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Deworming Due:</span>
                        <p className="font-bold text-slate-900">{finalizedVisit.nextDewormingDate || "Quarterly"}</p>
                      </div>
                    </div>

                    {/* Footer Signature */}
                    <div className="pt-4 flex items-end justify-between text-[10px] border-t border-slate-100">
                      <p className="text-slate-400 italic">Administer medicines strictly as prescribed.</p>
                      <div className="text-center">
                        <span className="font-serif italic text-slate-400 block pb-1">Digitally Signed</span>
                        <strong className="text-slate-800 text-[11px] block">{finalizedVisit.doctorName || activeDoctorName}</strong>
                        <span className="text-slate-500 text-[9px] block">Registered Veterinary Practitioner</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT PANE: TAX INVOICE & SETTLEMENT RECEIPT ────────────────── */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-xs">
                        <Receipt className="size-3.5" />
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">2. Tax Invoice &amp; Settlement Receipt</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPdf("invoice-preview-card", `Invoice_${finalizedVisit.invoiceNo?.replace(/[\/\\]/g, "_")}.pdf`)}
                        className="h-7 px-2.5 text-[11px] font-semibold gap-1"
                      >
                        <Download className="size-3" /> Download PDF
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handlePrintDocument("invoice-preview-card", `Invoice_${finalizedVisit.invoiceNo}`)}
                        className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        <Printer className="size-3" /> Print Invoice
                      </Button>
                    </div>
                  </div>

                  {/* Invoice Paper Container */}
                  <div
                    id="invoice-preview-card"
                    className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-6 shadow-md space-y-5 text-xs font-sans"
                  >
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-3.5 flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-black tracking-tight text-slate-900 uppercase">VETCARE SPECIALTY PET HOSPITAL</h2>
                        <p className="text-[11px] text-slate-600">Plot 42, Central Avenue, Near Medical Square, Nagpur - 440009</p>
                        <p className="text-[11px] text-slate-600">Phone: +91 712 2548899 · Reg: MH/VET/2019/8821</p>
                        {finalizedVisit.billType === "GST" && (
                          <p className="text-[11px] font-mono font-bold text-slate-800">GSTIN: 27AABCV1234F1Z5</p>
                        )}
                        <p className="text-[11px] text-slate-600">Branch: {finalizedVisit.branch || "Central Avenue, Nagpur"}</p>
                      </div>
                      <div className="text-right text-[11px] space-y-1">
                        <span className="inline-block bg-slate-900 text-white font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                          {finalizedVisit.billType === "GST" ? "TAX INVOICE" : "BILL OF SUPPLY"}
                        </span>
                        <p className="font-mono font-bold text-xs text-slate-900">{finalizedVisit.invoiceNo}</p>
                        <p className="text-slate-500 font-mono text-[10px]">Date: {finalizedVisit.date || new Date().toISOString().slice(0, 10)}</p>
                      </div>
                    </div>

                    {/* Billed To / Patient Info */}
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 text-[11px] bg-slate-50">
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-[9px]">Billed To (Client)</p>
                        <p className="font-bold text-xs text-slate-900">{finalizedVisit.ownerName}</p>
                        <p className="text-slate-600">Phone: {finalizedVisit.ownerPhone}</p>
                        <p className="text-slate-600">Owner ID: <span className="font-mono">{finalizedVisit.ownerId}</span></p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-[9px]">Patient Details</p>
                        <p className="font-bold text-xs text-slate-900">{finalizedVisit.petName}</p>
                        <p className="text-slate-600">{finalizedVisit.species} · {finalizedVisit.breed}</p>
                        <p className="text-slate-600">Patient UID: <span className="font-mono">{finalizedVisit.petId}</span></p>
                      </div>
                    </div>

                    {/* Itemized Table */}
                    <table className="w-full text-[11px] border border-slate-200">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-left font-semibold text-slate-700">
                          <th className="p-1.5 w-6">#</th>
                          <th className="p-1.5">Description / Category</th>
                          <th className="p-1.5 text-center w-10">Qty</th>
                          <th className="p-1.5 text-right w-16">Rate (₹)</th>
                          <th className="p-1.5 text-center w-12">Disc (%)</th>
                          {finalizedVisit.billType === "GST" && <th className="p-1.5 text-center w-12">GST</th>}
                          <th className="p-1.5 text-right w-16">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(finalizedVisit.items || []).map((item: any, idx: number) => {
                          const gross = item.quantity * item.unitPrice;
                          const disc = (gross * (item.discountPercent || 0)) / 100;
                          const lineNet = gross - disc;
                          return (
                            <tr key={idx}>
                              <td className="p-1.5 text-slate-400">{idx + 1}</td>
                              <td className="p-1.5">
                                <p className="font-semibold text-slate-900">{item.name}</p>
                                <span className="text-[9px] text-slate-500">{item.lineType}</span>
                              </td>
                              <td className="p-1.5 text-center font-medium">{item.quantity}</td>
                              <td className="p-1.5 text-right font-mono">{item.unitPrice.toFixed(2)}</td>
                              <td className="p-1.5 text-center font-mono">{item.discountPercent || 0}%</td>
                              {finalizedVisit.billType === "GST" && <td className="p-1.5 text-center font-mono">{item.gstRate || 0}%</td>}
                              <td className="p-1.5 text-right font-bold font-mono">{lineNet.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Financial Summary & Split Settlement */}
                    <div className="flex justify-between items-start pt-1 gap-3">
                      {/* Left: Payment Mode Details */}
                      <div className="rounded-xl border border-slate-200 p-2.5 text-[11px] flex-1 space-y-1 bg-slate-50">
                        <p className="font-bold text-slate-700 uppercase text-[9px]">Payment Summary</p>
                        <div className="flex justify-between text-slate-800">
                          <span>Paid via {finalizedVisit.paymentMode || "UPI"}:</span>
                          <span className="font-bold font-mono">₹{(finalizedVisit.totalAmount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                          <span>Payment Status:</span>
                          <span>PAID IN FULL ✓</span>
                        </div>
                      </div>

                      {/* Right: Calculations */}
                      <div className="w-52 space-y-1 text-[11px] text-right">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal:</span>
                          <span className="font-mono">₹{(finalizedVisit.subtotal || 0).toFixed(2)}</span>
                        </div>
                        {finalizedVisit.billType === "GST" && (
                          <div className="flex justify-between text-slate-600">
                            <span>GST Amount:</span>
                            <span className="font-mono">+₹{(finalizedVisit.gstAmount || 0).toFixed(2)}</span>
                          </div>
                        )}
                        {finalizedVisit.roundOff !== 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Round-off:</span>
                            <span className="font-mono">{finalizedVisit.roundOff >= 0 ? `+₹${finalizedVisit.roundOff.toFixed(2)}` : `-₹${Math.abs(finalizedVisit.roundOff).toFixed(2)}`}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-sm pt-1.5 border-t-2 border-slate-900 text-slate-900">
                          <span>Total Amount:</span>
                          <span className="font-mono text-base text-primary">₹{(finalizedVisit.totalAmount || 0).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                          <span>Amount Received:</span>
                          <span className="font-mono">₹{(finalizedVisit.totalAmount || 0).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Terms */}
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-end text-[9px] text-slate-400">
                      <div>
                        <p>• Goods once sold are not returnable after cold chain break.</p>
                        <p>• Computer-generated sales invoice and receipt.</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-700">For Vetcare Specialty Pet Hospital</p>
                        <p className="pt-4 text-slate-400">Authorized Signatory</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prescription Print Modal */}
        {showRxPrint && finalizedVisit && (
          <PrescriptionPrintView
            visit={finalizedVisit}
            open={showRxPrint}
            onClose={() => setShowRxPrint(false)}
          />
        )}

        {/* Invoice Print Modal */}
        {showInvoicePrint && finalizedVisit && (
          <InvoicePrintView
            visit={finalizedVisit}
            open={showInvoicePrint}
            onClose={() => setShowInvoicePrint(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
