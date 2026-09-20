import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  Copy,
  Tag,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useErp } from "@/lib/erp/store";
import { getItemsFn } from "@/lib/mongodb/serverFns/inventory";
import { finalizeVisitAndBillFn, getLatestVisitFn, getPatientHistoryFn, savePrescriptionFn, getVisitByIdFn } from "@/lib/mongodb/serverFns/clinical";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { PrescriptionWorkflow } from "./prescription/PrescriptionWorkflow";
import { SectionJumpBar, DEFAULT_RX_JUMP_SECTIONS, type SectionJumpItem } from "./prescription/SectionJumpBar";
import type { IPrescriptionData } from "@/lib/mongodb/models/ClinicalVisit";
import { PrescriptionPrintView } from "./PrescriptionPrintView";
import { InvoicePrintView } from "./InvoicePrintView";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { getPetFn } from "@/lib/mongodb/serverFns/crm";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { calcLineItem, calcBillSummary, validateDiscount, roundMoney } from "@/lib/utils/moneyUtils";

interface VisitWorkspaceProps {
  open: boolean;
  onClose: () => void;
  visit: any;
  onVisitFinalized?: (updatedVisit: any) => void;
}

interface BillLine {
  id: string;
  lineType: "Vaccine" | "Consultation" | "Pharmacy" | "Procedure" | "Diagnostic" | "Service" | "Food" | "Accessory";
  itemCode?: string | undefined;
  batchNo?: string | undefined;
  name: string;
  dosageInstructions?: string | undefined;
  quantity: number;
  unitPrice: number;
  /** @deprecated kept for back-compat with old records; use discountType+discountValue */
  discountPercent: number;
  // Per-line discount fields (REQ-DISC)
  discountType?: "percentage" | "fixed" | "%" | "₹" | undefined;
  discountValue?: number | undefined;      // raw user input
  discountAmount?: number | undefined;    // computed
  gstRate: number;
  /** Per-line GST toggle; falls back to the bill-wide Bill Type when unset. */
  gstApplicable?: boolean | undefined;
  sourceType?: "RX_ITEM" | "RX_CONSULT" | "RX_LAB" | null | undefined;
  sourceId?: string | null | undefined;
  rxSection?: string | null | undefined;
}

// FALLBACK_CATALOG removed — real inventory is always used. Empty inventory shows "no items found" correctly.

export function VisitWorkspaceModal({ open, onClose, visit, onVisitFinalized }: VisitWorkspaceProps) {
  const { currentUser, role } = useErp();
  const [activeVisit, setActiveVisit] = useState<any>(visit);

  useEffect(() => {
    setActiveVisit(visit);
    if (visit?.prescriptionData) {
      setPrescriptionData(visit.prescriptionData);
    }
  }, [visit]);

  const activeDoctorName = activeVisit?.doctorName || visit?.doctorName || currentUser?.fullName || role?.person || "Dr. Rohit Sharma";

  // Doctor specialty/title lookup — keeps the printed Rx/invoice letterhead accurate per treating doctor
  const [doctorsList, setDoctorsList] = useState<Array<{ id: string; name: string; specialty?: string }>>([]);
  useEffect(() => {
    listApprovedDoctorsFn()
      .then((docs) => setDoctorsList(docs || []))
      .catch((e) => console.warn("Could not load doctors list:", e));
  }, []);
  const getDoctorTitle = (doctorName: string | undefined) =>
    doctorsList.find((d) => d.name === doctorName)?.specialty || "Chief Veterinary Physician & Surgeon";

  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [petDetails, setPetDetails] = useState<any>(null);

  const [tab, setTab] = useState<"consultation" | "billing" | "completed">("consultation");
  const [rxJumpSections, setRxJumpSections] = useState<SectionJumpItem[]>(DEFAULT_RX_JUMP_SECTIONS);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top whenever switching tabs (e.g. proceeding to billing)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [tab]);
  
  // Vitals & Clinical Form
  const [weightKg, setWeightKg] = useState(visit?.vitals?.weightKg ? String(visit.vitals.weightKg) : "24.5");
  const [tempC, setTempC] = useState(visit?.vitals?.tempC ? String(visit.vitals.tempC) : "38.5");
  const [complaint, setComplaint] = useState(visit?.vitals?.complaint || "");
  const [diagnosis, setDiagnosis] = useState(visit?.diagnosis || "");
  const [clinicalNotes, setClinicalNotes] = useState(visit?.clinicalNotes || "");
  
  // Reminders
  const [nextVisitDate, setNextVisitDate] = useState(visit?.nextVisitDate || "");
  const [nextDewormingDate, setNextDewormingDate] = useState(visit?.nextDewormingDate || "");

  // Structured Prescription Data (§11)
  const [prescriptionData, setPrescriptionData] = useState<IPrescriptionData | null>(
    visit?.prescriptionData || null
  );

  // Extended Records
  const [vaccineRecords, setVaccineRecords] = useState<{ id: string; type: string; dateGiven: string; nextDueDate: string; price?: number }[]>([]);
  const [bloodTests, setBloodTests] = useState<{ id: string, testType: string, status: string }[]>([]);
  const [foodPurchases, setFoodPurchases] = useState<{ id: string, name: string, quantity: number }[]>([]);

  // Previous History Panel
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyVisits, setHistoryVisits] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Line items state — starts empty; populated from DB on load or from Rx on proceed
  const [lines, setLines] = useState<BillLine[]>([]);

  // Quick Medicine Search & Filter
  const [selectedMedicine, setSelectedMedicine] = useState<any | null>(null);
  const [medSearchQuery, setMedSearchQuery] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [dosageText, setDosageText] = useState("");

  // Combined Animal Food & Accessories State — Live Inventory + Discount fields (REQ-DISC)
  const [foodItems, setFoodItems] = useState<{
    id: string; name: string; packSize: string; quantity: number; price: number;
    discountType?: "percentage" | "fixed" | undefined; discountValue?: number | undefined; itemCode?: string | undefined;
  }[]>([]);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodPack, setNewFoodPack] = useState("");
  const [newFoodQty, setNewFoodQty] = useState(1);
  const [newFoodPrice, setNewFoodPrice] = useState(1850);
  const [newFoodDiscType, setNewFoodDiscType] = useState<"percentage" | "fixed">("percentage");
  const [newFoodDiscValue, setNewFoodDiscValue] = useState(0);
  const [isCustomFood, setIsCustomFood] = useState(false);
  const [customFoodName, setCustomFoodName] = useState("");
  const [customFoodPack, setCustomFoodPack] = useState("");

  const [accessoryItems, setAccessoryItems] = useState<{
    id: string; name: string; category: string; quantity: number; price: number;
    discountType?: "percentage" | "fixed" | undefined; discountValue?: number | undefined; itemCode?: string | undefined;
  }[]>([]);
  const [selectedAcc, setSelectedAcc] = useState<any | null>(null);
  const [accSearchQuery, setAccSearchQuery] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccCat, setNewAccCat] = useState("Collars & Leashes");
  const [newAccQty, setNewAccQty] = useState(1);
  const [newAccPrice, setNewAccPrice] = useState(320);
  const [newAccDiscType, setNewAccDiscType] = useState<"percentage" | "fixed">("percentage");
  const [newAccDiscValue, setNewAccDiscValue] = useState(0);
  const [isCustomAcc, setIsCustomAcc] = useState(false);
  const [customAccName, setCustomAccName] = useState("");
  const [customAccCat, setCustomAccCat] = useState("Collars & Leashes");


  const [newBloodTestType, setNewBloodTestType] = useState("CBC (Complete Blood Count)");

  // REQ-RX-01: track medicines already in lines to exclude from catalog
  const [isAddingMed, setIsAddingMed] = useState(false);

  // Payment
  const [billType, setBillType] = useState<"GST" | "Non-GST">(visit?.billType || "GST");
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Card" | "NetBanking" | "Cheque" | "Account Due">("UPI");
  const [trxRef, setTrxRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [amountReceived, setAmountReceived] = useState<number | "">("");
  const [hasManuallyEditedAmount, setHasManuallyEditedAmount] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Print Dialog States
  const [showRxPrint, setShowRxPrint] = useState(false);
  const [showInvoicePrint, setShowInvoicePrint] = useState(false);
  const [finalizedVisit, setFinalizedVisit] = useState<any | null>(null);

  const loadFreshVisit = async (visitId: string) => {
    try {
      const fresh = await getVisitByIdFn({ data: { visitId } });
      if (fresh) {
        setActiveVisit(fresh);
        if (fresh.prescriptionData) {
          setPrescriptionData(fresh.prescriptionData);
        }
        if (fresh.clinicalNotes) setClinicalNotes(fresh.clinicalNotes);
        if (fresh.diagnosis) setDiagnosis(fresh.diagnosis);
        if (fresh.nextVisitDate) setNextVisitDate(fresh.nextVisitDate);
        if (fresh.nextDewormingDate) setNextDewormingDate(fresh.nextDewormingDate);
        if (fresh.vitals) {
          const w = fresh.vitals.weight ?? fresh.vitals.weightKg;
          if (w !== undefined) setWeightKg(String(w));
          const t = fresh.vitals.temp ?? fresh.vitals.tempC;
          if (t !== undefined) setTempC(String(t));
          if (fresh.vitals.complaint) setComplaint(fresh.vitals.complaint);
        }
        if (fresh.items && fresh.items.length > 0) {
          setLines(fresh.items.map((l: any, idx: number) => ({
            id: l.id || `line-${idx + 1}`,
            lineType: l.lineType || "Pharmacy",
            itemCode: l.itemCode,
            batchNo: l.batchNo,
            name: l.name,
            dosageInstructions: l.dosageInstructions,
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice) || 0,
            discountPercent: Number(l.discountPercent) || 0,
            discountType: l.discountType || "percentage",
            discountValue: l.discountValue ?? l.discountPercent ?? 0,
            discountAmount: l.discountAmount,
            taxableAmount: l.taxableAmount,
            gstRate: Number(l.gstRate) || 0,
            gstApplicable: l.gstApplicable,
            lineTotal: l.lineTotal,
            sourceType: l.sourceType,
            sourceId: l.sourceId,
            rxSection: l.rxSection,
          })));
        }
      }
    } catch (e) {
      console.warn("Could not load fresh visit from MongoDB:", e);
    }
  };

  useEffect(() => {
    if (open) {
      void loadCatalog();
      if (visit?.visitId) void loadFreshVisit(visit.visitId);
      if (visit?.petId) void loadPetDetails(visit.petId);
      if (visit?.petId || visit?.petName) void loadPatientHistory();
    }
  }, [open, visit?.visitId, visit?.petId, visit?.petName]);

  const loadCatalog = async () => {
    try {
      const items = await getItemsFn();
      // Always replace — even an empty inventory should show no results (not fake fallback items)
      setCatalogItems(items ?? []);
    } catch (e) {
      console.warn("Could not load catalog items:", e);
    }
  };

  const loadPetDetails = async (petId: string) => {
    try {
      const pet = await getPetFn({ data: { petId } });
      setPetDetails(pet);
    } catch (e) {
      console.warn("Could not load pet details:", e);
    }
  };

  const loadPatientHistory = async () => {
    if (!visit?.petId && !visit?.petName) return;
    setHistoryLoading(true);
    try {
      const pastVisits = await getPatientHistoryFn({
        data: {
          petId: visit?.petId || undefined,
          petName: visit?.petName || undefined,
          excludeVisitId: visit?.visitId || undefined,
        },
      });
      setHistoryVisits(pastVisits || []);
    } catch (e) {
      console.warn("Could not load patient history:", e);
      setHistoryVisits([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCopyPreviousRx = (prevVisit: any) => {
    if (!prevVisit.items || prevVisit.items.length === 0) {
      toast.error("No prescribed items found in this previous visit to copy.");
      return;
    }
    const copiedLines: BillLine[] = prevVisit.items.map((item: any, i: number) => ({
      id: String(Date.now() + i),
      lineType: item.lineType || "Pharmacy",
      itemCode: item.itemCode,
      batchNo: item.batchNo,
      name: item.name,
      dosageInstructions: item.dosageInstructions || "",
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      discountPercent: item.discountPercent || 0,
      gstRate: item.gstRate || 0,
    }));

    setLines(copiedLines);
    if (prevVisit.prescriptionData) {
      setPrescriptionData(prevVisit.prescriptionData);
      if (prevVisit.prescriptionData.weight !== undefined) setWeightKg(String(prevVisit.prescriptionData.weight));
      if (prevVisit.prescriptionData.bodyTemperature !== undefined) setTempC(String(prevVisit.prescriptionData.bodyTemperature));
      if (prevVisit.prescriptionData.symptomsText) setComplaint(prevVisit.prescriptionData.symptomsText);
    }

    if (prevVisit.diagnosis && !diagnosis) {
      setDiagnosis(prevVisit.diagnosis);
    }
    setClinicalNotes(
      (prevNotes: string) =>
        `[Repeat Prescription copied from ${prevVisit.date} (${prevVisit.visitId})]: ${prevVisit.diagnosis || "Follow-up treatment"}\n` +
        (prevNotes ? `\n${prevNotes}` : "")
    );

    toast.success(`Loaded ${copiedLines.length} item(s) from previous Rx (${prevVisit.date}) into current prescription form!`);
    setShowHistoryPanel(false);
  };

  const handleSavePrescription = async (rxData: IPrescriptionData, billableLines?: any[]) => {
    try {
      setPrescriptionData(rxData);
      if (rxData.weight !== undefined) setWeightKg(String(rxData.weight));
      if (rxData.bodyTemperature !== undefined) setTempC(String(rxData.bodyTemperature));
      if (rxData.symptomsText) setComplaint(rxData.symptomsText);
      if (rxData.followUp?.nextTreatmentDate) setNextVisitDate(rxData.followUp.nextTreatmentDate);
      if (rxData.followUp?.nextDewormingDate) setNextDewormingDate(rxData.followUp.nextDewormingDate);

      const isGst = billType === "GST";
      let updatedLines = lines;

      if (billableLines && billableLines.length > 0) {
        const mappedBillable = billableLines.map((bl, i) => {
          const qty = Number(bl.quantity) || 1;
          const price = Number(bl.unitPrice) || 0;
          const disc = Number(bl.discountPercent) || 0;
          const gst = Number(bl.gstRate) || (isGst ? (bl.lineType === "Accessory" || bl.lineType === "Food" ? 18 : 12) : 0);
          const lineCalc = calcLineItem({
            quantity: qty,
            unitPrice: price,
            discountType: bl.discountType || "percentage",
            discountValue: bl.discountValue ?? disc,
            gstRate: gst,
            applyGst: isGst,
          });
          return {
            id: bl.id || `bl-${Date.now()}-${i}`,
            lineType: bl.lineType || "Pharmacy",
            itemCode: bl.itemCode,
            batchNo: bl.batchNo,
            name: bl.name,
            dosageInstructions: bl.dosageInstructions,
            quantity: qty,
            unitPrice: price,
            discountPercent: disc,
            discountType: bl.discountType || "percentage",
            discountValue: bl.discountValue ?? disc,
            discountAmount: lineCalc.discountAmount,
            taxableAmount: lineCalc.taxableAmount,
            gstRate: gst,
            lineTotal: lineCalc.lineTotal,
            sourceType: bl.sourceType || "RX_ITEM",
            sourceId: bl.id,
            rxSection: bl.rxSection,
          };
        });
        // Full replacement — billableLines from Rx are the source of truth; never merge with stale lines
        updatedLines = mappedBillable;
        setLines(updatedLines);
      }

      // Ensure every item sent to savePrescriptionFn has valid lineTotal & calc fields for PrescriptionLineZ
      const validBillableItems = updatedLines.map((l) => {
        const qty = Number(l.quantity) || 1;
        const price = Number(l.unitPrice) || 0;
        const disc = Number(l.discountPercent) || 0;
        const gst = Number(l.gstRate) || (isGst ? 18 : 0);
        const lineCalc = calcLineItem({
          quantity: qty,
          unitPrice: price,
          discountType: l.discountType || "percentage",
          discountValue: l.discountValue ?? disc,
          gstRate: gst,
          applyGst: isGst,
        });
        return {
          id: l.id,
          lineType: l.lineType,
          itemCode: l.itemCode,
          batchNo: l.batchNo,
          name: l.name,
          dosageInstructions: l.dosageInstructions,
          quantity: qty,
          unitPrice: price,
          discountPercent: disc,
          discountType: l.discountType || "percentage",
          discountValue: l.discountValue ?? disc,
          discountAmount: lineCalc.discountAmount,
          taxableAmount: lineCalc.taxableAmount,
          gstRate: gst,
          lineTotal: lineCalc.lineTotal,
          sourceType: l.sourceType || null,
          sourceId: l.sourceId || null,
          rxSection: l.rxSection || null,
        };
      });

      const updated = await savePrescriptionFn({
        data: {
          visitId: visit.visitId || `V-${Math.floor(1000 + Math.random() * 9000)}`,
          prescriptionNo: visit.prescriptionNo,
          date: rxData.dateOfVisit || visit.date || new Date().toISOString().slice(0, 10),
          petId: visit.petId,
          petName: visit.petName,
          species: visit.species,
          breed: visit.breed,
          ownerId: visit.ownerId,
          ownerName: visit.ownerName,
          ownerPhone: visit.ownerPhone,
          doctorName: activeDoctorName,
          vitals: {
            weight: rxData.weight,
            weightUnit: rxData.weightUnit,
            temp: rxData.bodyTemperature,
            tempUnit: rxData.temperatureUnit,
            complaint: rxData.symptomsText,
          },
          diagnosis: rxData.clinicalFindings && rxData.clinicalFindings.length > 0
            ? `Findings: ${rxData.clinicalFindings.join(", ")}${rxData.clinicalFindingsOther ? ` (${rxData.clinicalFindingsOther})` : ""}`
            : diagnosis || visit.diagnosis,
          clinicalNotes: rxData.previousHistory || clinicalNotes,
          nextVisitDate: rxData.followUp?.nextTreatmentDate,
          nextVaccineDate: rxData.followUp?.nextVaccineDate,
          nextDewormingDate: rxData.followUp?.nextDewormingDate,
          prescriptionData: rxData,
          billableItems: validBillableItems,
        },
      });

      if (updated) {
        setActiveVisit(updated);
      }
    } catch (e: any) {
      console.error("Save prescription error:", e);
      throw e;
    }
  };

  const handleProceedToBilling = async (rxData: IPrescriptionData, billableLines?: any[]) => {
    // 1. Immediately switch tab so navigation is instantaneous and responsive
    setTab("billing");
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }

    // 2. Sync billable lines immediately
    if (billableLines && billableLines.length > 0) {
      const isGst = billType === "GST";
      const mappedNewLines: BillLine[] = billableLines.map((bl, i) => {
        const qty = Number(bl.quantity) || 1;
        const price = Number(bl.unitPrice) || 0;
        const disc = Number(bl.discountPercent) || 0;
        const gst = Number(bl.gstRate) || (isGst ? (bl.lineType === "Accessory" || bl.lineType === "Food" ? 18 : 12) : 0);
        const lineCalc = calcLineItem({
          quantity: qty,
          unitPrice: price,
          discountType: bl.discountType || "percentage",
          discountValue: bl.discountValue ?? disc,
          gstRate: gst,
          applyGst: isGst,
        });
        return {
          id: bl.id || `bl-${Date.now()}-${i}`,
          lineType: bl.lineType || "Pharmacy",
          itemCode: bl.itemCode,
          batchNo: bl.batchNo,
          name: bl.name,
          dosageInstructions: bl.dosageInstructions,
          quantity: qty,
          unitPrice: price,
          discountPercent: disc,
          discountType: bl.discountType || "percentage",
          discountValue: bl.discountValue ?? disc,
          discountAmount: lineCalc.discountAmount,
          taxableAmount: lineCalc.taxableAmount,
          gstRate: gst,
          lineTotal: lineCalc.lineTotal,
          sourceType: bl.sourceType || "RX_ITEM",
          sourceId: bl.id,
          rxSection: bl.rxSection,
        };
      });

      setLines(mappedNewLines);
    }

    // 3. Save in background
    try {
      await handleSavePrescription(rxData, billableLines);
    } catch (e: any) {
      console.warn("Auto-save on proceed to billing encountered an issue:", e);
      toast.error(e?.message || "Some changes could not be saved, but you can still review the bill.");
    }
  };

  // REQ-RX-01: set of already-prescribed itemCodes — excludes from catalog dropdown
  const prescribedCodes = useMemo(
    () => new Set(lines.map((l) => l.itemCode).filter(Boolean) as string[]),
    [lines]
  );

  const filteredCatalog = useMemo(() => {
    const q = medSearchQuery.toLowerCase().trim();
    return catalogItems.filter(
      (item: any) => {
        // Exclude already-prescribed medicines (REQ-RX-01)
        if (item.itemCode && prescribedCodes.has(item.itemCode)) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(q))
        );
      }
    );
  }, [catalogItems, medSearchQuery, prescribedCodes]);

  // Filtered Food Inventory Items
  const foodCatalog = useMemo(() => {
    return catalogItems.filter(
      (item: any) =>
        item.category === "Food" ||
        item.category === "Animal Food" ||
        item.name.toLowerCase().includes("food") ||
        item.name.toLowerCase().includes("canin") ||
        item.name.toLowerCase().includes("pedigree") ||
        item.name.toLowerCase().includes("farmina") ||
        item.name.toLowerCase().includes("whiskas") ||
        item.name.toLowerCase().includes("diet") ||
        item.name.toLowerCase().includes("treat") ||
        item.name.toLowerCase().includes("feed") ||
        item.unit === "Kg" ||
        item.unit === "Bag"
    );
  }, [catalogItems]);

  const filteredFoodCatalog = useMemo(() => {
    if (!foodSearchQuery.trim()) return foodCatalog;
    const q = foodSearchQuery.toLowerCase().trim();
    return foodCatalog.filter(
      (item: any) =>
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(q))
    );
  }, [foodCatalog, foodSearchQuery]);

  // Filtered Accessories Inventory Items
  const accessoryCatalog = useMemo(() => {
    return catalogItems.filter(
      (item: any) =>
        item.category === "Accessory" ||
        item.category === "Animal Accessories" ||
        item.category === "Consumable" ||
        item.unit === "Piece" ||
        item.unit === "Unit" ||
        item.name.toLowerCase().includes("collar") ||
        item.name.toLowerCase().includes("leash") ||
        item.name.toLowerCase().includes("harness") ||
        item.name.toLowerCase().includes("shampoo") ||
        item.name.toLowerCase().includes("bed") ||
        item.name.toLowerCase().includes("bowl") ||
        item.name.toLowerCase().includes("litter") ||
        item.subGroup === "Gear" ||
        item.subGroup === "Hygiene" ||
        item.subGroup === "Comfort" ||
        item.subGroup === "Feeding"
    );
  }, [catalogItems]);

  const filteredAccessoryCatalog = useMemo(() => {
    if (!accSearchQuery.trim()) return accessoryCatalog;
    const q = accSearchQuery.toLowerCase().trim();
    return accessoryCatalog.filter(
      (item: any) =>
        item.name.toLowerCase().includes(q) ||
        (item.subGroup && item.subGroup.toLowerCase().includes(q)) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(q))
    );
  }, [accessoryCatalog, accSearchQuery]);

  const handleAddFoodItem = () => {
    let name = "";
    let pack = "Standard";
    let itemCode: string | undefined = undefined;
    let price = Number(newFoodPrice) || 0;

    if (isCustomFood) {
      if (!customFoodName.trim()) {
        toast.error("Please enter custom food name");
        return;
      }
      name = customFoodName.trim();
      pack = customFoodPack.trim() || "Standard";
    } else {
      if (!selectedFood) {
        toast.error("Please select a food product from inventory or toggle custom food entry");
        return;
      }
      name = selectedFood.name;
      pack = selectedFood.unit || selectedFood.genericName || "Pack";
      itemCode = selectedFood.itemCode;
      price = Number(newFoodPrice) || selectedFood.defaultSalePrice || 0;
    }

    const qty = Number(newFoodQty) || 1;
    const baseAmt = qty * price;
    const discErr = validateDiscount(newFoodDiscType, newFoodDiscValue, baseAmt);
    if (discErr) { toast.error(discErr); return; }

    const id = `food-${Date.now()}`;
    const item = {
      id,
      name,
      packSize: pack,
      quantity: qty,
      price,
      itemCode,
      discountType: newFoodDiscType,
      discountValue: newFoodDiscValue,
    };

    setFoodItems((prev) => [...prev, item]);
    setLines((prev) => [
      ...prev,
      {
        id,
        lineType: "Food" as const,
        itemCode,
        name: `[Food] ${name}`,
        dosageInstructions: `Dietary nutrition · Pack: ${pack}`,
        quantity: qty,
        unitPrice: price,
        discountPercent: newFoodDiscType === "percentage" ? newFoodDiscValue : 0,
        discountType: newFoodDiscType,
        discountValue: newFoodDiscValue,
        gstRate: selectedFood?.gstRate || 18,
      },
    ]);

    setSelectedFood(null);
    setFoodSearchQuery("");
    setCustomFoodName("");
    setCustomFoodPack("");
    setNewFoodQty(1);
    setNewFoodPrice(1850);
    setNewFoodDiscValue(0);
    toast.success(`Added food item: ${name} (Synced to Prescription & Bill)`);
  };

  const handleRemoveFoodItem = (id: string) => {
    setFoodItems((prev) => prev.filter((f) => f.id !== id));
    setLines((prev) => prev.filter((l) => l.id !== id));
    toast.success("Food item removed from prescription & bill");
  };

  const handleAddAccessoryItem = () => {
    let name = "";
    let category = "Accessory";
    let itemCode: string | undefined = undefined;
    let price = Number(newAccPrice) || 0;

    if (isCustomAcc) {
      if (!customAccName.trim()) {
        toast.error("Please enter custom accessory name");
        return;
      }
      name = customAccName.trim();
      category = customAccCat;
    } else {
      if (!selectedAcc) {
        toast.error("Please select an accessory from inventory or toggle custom entry");
        return;
      }
      name = selectedAcc.name;
      category = selectedAcc.subGroup || selectedAcc.category || "Accessory";
      itemCode = selectedAcc.itemCode;
      price = Number(newAccPrice) || selectedAcc.defaultSalePrice || 0;
    }

    const qty = Number(newAccQty) || 1;
    const baseAmt = qty * price;
    const discErr = validateDiscount(newAccDiscType, newAccDiscValue, baseAmt);
    if (discErr) { toast.error(discErr); return; }

    const id = `acc-${Date.now()}`;
    const item = {
      id,
      name,
      category,
      quantity: qty,
      price,
      itemCode,
      discountType: newAccDiscType,
      discountValue: newAccDiscValue,
    };

    setAccessoryItems((prev) => [...prev, item]);
    setLines((prev) => [
      ...prev,
      {
        id,
        lineType: "Accessory" as const,
        itemCode,
        name: `[Accessory] ${name}`,
        dosageInstructions: `Category: ${category}`,
        quantity: qty,
        unitPrice: price,
        discountPercent: newAccDiscType === "percentage" ? newAccDiscValue : 0,
        discountType: newAccDiscType,
        discountValue: newAccDiscValue,
        gstRate: selectedAcc?.gstRate || 18,
      },
    ]);

    setSelectedAcc(null);
    setAccSearchQuery("");
    setCustomAccName("");
    setNewAccQty(1);
    setNewAccPrice(320);
    setNewAccDiscValue(0);
    toast.success(`Added accessory: ${name} (Synced to Prescription & Bill)`);
  };


  const handleRemoveAccessoryItem = (id: string) => {
    setAccessoryItems((prev) => prev.filter((a) => a.id !== id));
    setLines((prev) => prev.filter((l) => l.id !== id));
    toast.success("Accessory removed from prescription & bill");
  };

  const handleAddBloodTest = () => {
    if (!newBloodTestType) return;
    const test = {
      id: Math.random().toString(),
      testType: newBloodTestType,
      status: "Ordered",
    };
    setBloodTests((prev) => [...prev, test]);
    setLines((prev) => [
      ...prev,
      {
        id: test.id,
        lineType: "Diagnostic",
        name: `[Blood Test] ${test.testType}`,
        quantity: 1,
        unitPrice: 450,
        discountPercent: 0,
        gstRate: 18,
      },
    ]);
    toast.success(`Ordered blood test: ${test.testType}`);
  };

  const DEFAULT_VACCINE_PRICES: Record<string, number> = {
    "Anti-rabies": 350,
    "All-in-1": 450,
    "Kennel Cough": 400,
    "Feline Tri-cat": 550,
  };

  const handleAddVaccineRecord = () => {
    const id = Math.random().toString();
    const type = "Anti-rabies";
    const dateGiven = new Date().toISOString().slice(0, 10);
    const price = DEFAULT_VACCINE_PRICES[type] || 350;

    const newRecord = {
      id,
      type,
      dateGiven,
      nextDueDate: "",
      price,
    };

    setVaccineRecords((prev) => [...prev, newRecord]);

    // Automatically add vaccine line item to Billing & Settlement lines
    setLines((prev) => [
      ...prev,
      {
        id,
        lineType: "Vaccine",
        name: `Vaccine - ${type} (Rabisin)`,
        quantity: 1,
        unitPrice: price,
        discountPercent: 0,
        gstRate: 18,
      },
    ]);

    toast.success(`Recorded vaccine ${type} (₹${price} added to billing)`);
  };

  const handleUpdateVaccineType = (id: string, newType: string) => {
    const price = DEFAULT_VACCINE_PRICES[newType] || 350;
    setVaccineRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type: newType, price } : r))
    );
    // Update billing line
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              name: `Vaccine - ${newType}`,
              unitPrice: price,
            }
          : l
      )
    );
  };

  const handleRemoveVaccineRecord = (id: string) => {
    setVaccineRecords((prev) => prev.filter((r) => r.id !== id));
    setLines((prev) => prev.filter((l) => l.id !== id));
    toast.success("Vaccine removed from record & billing");
  };

  useEffect(() => {
    if (visit && open) {
      if (visit.petId) {
        void loadPetDetails(visit.petId);
      }
      setWeightKg(visit?.vitals?.weightKg ? String(visit.vitals.weightKg) : "24.5");
      setTempC(visit?.vitals?.tempC ? String(visit.vitals.tempC) : "38.5");
      setComplaint(visit?.vitals?.complaint || "");
      setDiagnosis(visit?.diagnosis || "");
      setClinicalNotes(visit?.clinicalNotes || "");
      setNextVisitDate(visit?.nextVisitDate || "");
      setNextDewormingDate(visit?.nextDewormingDate || "");
      if (visit.items && visit.items.length > 0) {
        setLines(visit.items.map((it: any, idx: number) => ({ ...it, id: it.id || String(idx + 1) })));
      } else {
        setLines([
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
      }

      // If visit is already settled / completed / paid, jump directly to final preview screen!
      const isAlreadyCompleted =
        visit.status === "PAID" ||
        visit.status === "Settled" ||
        visit.status === "Paid" ||
        visit.status === "Completed";

      if (isAlreadyCompleted) {
        setFinalizedVisit(visit);
        setTab("completed");
      } else {
        setFinalizedVisit(null);
        setTab("consultation");
      }
    }
  }, [visit, open]);

  const handleCloneTreatment = async () => {
    if (!visit?.petId) return;
    try {
      const latestVisit = await getLatestVisitFn({ data: { petId: visit.petId, excludeVisitId: visit.visitId } });
      if (!latestVisit) {
        toast.info("No previous treatments found to clone.");
        return;
      }
      if (latestVisit.prescriptionData) {
        setPrescriptionData(latestVisit.prescriptionData);
        if (latestVisit.prescriptionData.weight !== undefined) setWeightKg(String(latestVisit.prescriptionData.weight));
        if (latestVisit.prescriptionData.bodyTemperature !== undefined) setTempC(String(latestVisit.prescriptionData.bodyTemperature));
        if (latestVisit.prescriptionData.symptomsText) setComplaint(latestVisit.prescriptionData.symptomsText);
      }
      if (latestVisit.items && latestVisit.items.length > 0) {
        const existingLineIds = new Set(lines.map((l) => l.itemCode));
        const clonedItems = latestVisit.items
          .filter((it: any) => (it.lineType === "Medicine" || it.lineType === "Pharmacy" || it.lineType === "Vaccine") && (!it.itemCode || !existingLineIds.has(it.itemCode)))
          .map((it: any) => ({
            ...it,
            id: Math.random().toString(),
          }));

        if (clonedItems.length > 0) {
          setLines((prev) => [...prev, ...clonedItems]);
          toast.success(`Cloned ${clonedItems.length} previous medicine(s).`);
        } else {
          toast.info("Previous medicines are already added.");
        }
      } else {
        toast.info("No prescription items found in previous visit.");
      }
    } catch (e) {
      console.warn("Could not clone treatment:", e);
      toast.error("Failed to clone treatment.");
    }
  };

  const handleViewHistory = async () => {
    if (!visit?.petId) return;
    setShowHistoryPanel(true);
    if (historyVisits.length > 0) return; // already loaded
    setHistoryLoading(true);
    try {
      const data = await getPatientHistoryFn({ data: { petId: visit.petId } });
      setHistoryVisits(Array.isArray(data) ? data.filter((v: any) => v.visitId !== visit.visitId) : []);
    } catch (e) {
      console.warn("Could not load history:", e);
    } finally {
      setHistoryLoading(false);
    }
  };

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
          gstRate: 18,
          gstApplicable: billType === "GST",
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

  // Dynamic Financial Computations — decimal-safe (REQ-DISC-04, moneyUtils)
  // Each line's own GST toggle wins; the Bill Type dropdown is just the default for lines that haven't been overridden.
  const billSummary = useMemo(() => {
    const result = calcBillSummary(
      lines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: l.discountType || "percentage",
        discountValue: l.discountValue ?? l.discountPercent ?? 0,
        gstRate: l.gstRate,
        applyGst: l.gstApplicable,
      })),
      billType === "GST"
    );
    return {
      subtotal: result.subtotal,
      taxableAmount: result.subtotal,
      gstAmount: result.totalGst,
      roundOff: result.roundOff,
      totalAmount: result.roundedTotal,
    };
  }, [lines, billType]);

  // Partial Payment State & Derivations (§15 & §4.1)
  useEffect(() => {
    if (paymentType === "full") {
      setAmountReceived(billSummary.totalAmount);
    }
  }, [billSummary.totalAmount, paymentType]);

  const numericAmountReceived = typeof amountReceived === "number" ? amountReceived : 0;
  const pendingAmount = Math.max(0, roundMoney(billSummary.totalAmount - numericAmountReceived));

  const paymentStatus: "Full" | "Partial" | "Unpaid" = useMemo(() => {
    if (numericAmountReceived >= billSummary.totalAmount && billSummary.totalAmount > 0) return "Full";
    if (numericAmountReceived > 0) return "Partial";
    return "Unpaid";
  }, [numericAmountReceived, billSummary.totalAmount]);

  const isAmountOver = numericAmountReceived > billSummary.totalAmount;
  const isAmountNegative = typeof amountReceived === "number" && amountReceived < 0;
  const isPartialEmptyOrZero = paymentType === "partial" && (amountReceived === "" || numericAmountReceived <= 0);

  const paymentValidationError = isAmountOver
    ? "Paid amount cannot be greater than the total bill."
    : isAmountNegative
    ? "Amount received cannot be negative."
    : isPartialEmptyOrZero
    ? "Please enter a valid payment amount."
    : null;

  const handleAddMedicineFromCatalog = async () => {
    if (!selectedMedicine) {
      toast.error("Please select a medicine or service from catalog");
      return;
    }
    // REQ-RX-01: prevent duplicate medicine
    if (selectedMedicine.itemCode && prescribedCodes.has(selectedMedicine.itemCode)) {
      toast.error(`${selectedMedicine.name} is already in the prescription.`);
      return;
    }
    if (isAddingMed) return;
    setIsAddingMed(true);
    try {
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
        discountType: "percentage",
        discountValue: 0,
        gstRate: selectedMedicine.gstRate || 18,
        gstApplicable: billType === "GST",
      };

      setLines((prev) => [...prev, newLine]);
      setSelectedMedicine(null);
      setItemQty(1);
      setDosageText("");
      toast.success(`Added ${selectedMedicine.name} to prescription & bill.`);
    } finally {
      setIsAddingMed(false);
    }
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
        gstRate: 18,
        gstApplicable: billType === "GST",
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

    if (paymentValidationError) {
      toast.error(paymentValidationError);
      return;
    }

    setIsFinalizing(true);
    try {
      const effectiveRx = prescriptionData || activeVisit?.prescriptionData || visit?.prescriptionData;
      const payload = {
        visitId: activeVisit?.visitId || visit.visitId || `V-${Math.floor(1000 + Math.random() * 9000)}`,
        petId: activeVisit?.petId || visit.petId || "PET-0001",
        petName: activeVisit?.petName || visit.petName || "Patient",
        species: activeVisit?.species || visit.species || "Canine",
        breed: activeVisit?.breed || visit.breed || "Standard",
        ownerId: activeVisit?.ownerId || visit.ownerId || "OWN-0001",
        ownerName: activeVisit?.ownerName || visit.ownerName || "Client",
        ownerPhone: activeVisit?.ownerPhone || visit.ownerPhone || "N/A",
        branch: activeVisit?.branch || visit.branch || "Main Clinic",
        billType: (activeVisit?.billType as "GST" | "Non-GST") || (visit.billType as "GST" | "Non-GST") || billType,
        doctorName: activeVisit?.doctorName || visit.doctorName || activeDoctorName,
        appointmentToken: activeVisit?.appointmentToken || visit?.appointmentToken || undefined,
        diagnosis: diagnosis.trim() || (effectiveRx?.clinicalFindings && effectiveRx.clinicalFindings.length > 0 ? `Findings: ${effectiveRx.clinicalFindings.join(", ")}` : "Clinical Examination Completed"),
        clinicalNotes: clinicalNotes.trim() || (effectiveRx?.previousHistory ? `History: ${effectiveRx.previousHistory}` : ""),
        nextVisitDate: nextVisitDate || effectiveRx?.followUp?.nextTreatmentDate || undefined,
        nextVaccineDate: effectiveRx?.followUp?.nextVaccineDate || undefined,
        nextDewormingDate: nextDewormingDate || effectiveRx?.followUp?.nextDewormingDate || undefined,
        prescriptionData: effectiveRx,
        vitals: {
          weight: effectiveRx?.weight ? Number(effectiveRx.weight) : (activeVisit?.vitals?.weight ? Number(activeVisit.vitals.weight) : (visit?.vitals?.weight ? Number(visit.vitals.weight) : undefined)),
          weightUnit: (effectiveRx?.weightUnit as "kg" | "lb") || activeVisit?.vitals?.weightUnit || visit?.vitals?.weightUnit || "kg",
          temp: effectiveRx?.bodyTemperature ? Number(effectiveRx.bodyTemperature) : (activeVisit?.vitals?.temp ? Number(activeVisit.vitals.temp) : (visit?.vitals?.temp ? Number(visit.vitals.temp) : undefined)),
          tempUnit: (effectiveRx?.temperatureUnit as "°C" | "°F") || activeVisit?.vitals?.tempUnit || visit?.vitals?.tempUnit || "°C",
          complaint: effectiveRx?.symptomsText || complaint || activeVisit?.vitals?.complaint || visit?.vitals?.complaint,
        },
        items: lines.map((l) => {
          const applyGst = l.gstApplicable ?? (billType === "GST");
          const dType: "percentage" | "fixed" = (l.discountType === "fixed" || l.discountType === "₹") ? "fixed" : "percentage";
          const discVal = l.discountValue ?? l.discountPercent ?? 0;
          const calc = calcLineItem({
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountType: dType,
            discountValue: discVal,
            gstRate: l.gstRate,
            applyGst,
          });
          return {
            id: l.id,
            lineType: l.lineType,
            itemCode: l.itemCode,
            batchNo: l.batchNo,
            name: l.name,
            dosageInstructions: l.dosageInstructions,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountPercent: dType === "percentage" ? discVal : 0,
            discountType: dType,
            discountValue: discVal,
            discountAmount: calc.discountAmount,
            taxableAmount: calc.taxableAmount,
            gstRate: l.gstRate,
            gstApplicable: applyGst,
            lineTotal: calc.lineTotal,
            sourceType: l.sourceType || null,
            sourceId: l.sourceId || null,
            rxSection: l.rxSection || null,
          };
        }),
        subtotal: billSummary.subtotal,
        billDiscount: 0,
        taxableAmount: billSummary.taxableAmount,
        gstAmount: billSummary.gstAmount,
        roundOff: billSummary.roundOff,
        totalAmount: billSummary.totalAmount,
        amountPaid: numericAmountReceived,
        pendingAmount,
        paymentStatus,
        paymentMode,
        trxRef: trxRef || undefined,
        notes: paymentNotes.trim() || undefined,
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

          {/* Previous Visit History & Workflow Tabs */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowHistoryPanel(true);
                void loadPatientHistory();
              }}
              className="h-8.5 gap-1.5 text-xs font-bold border-blue-500/40 text-blue-700 bg-blue-50/60 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 shadow-2xs"
            >
              <Clock className="size-3.5 text-blue-600" />
              <span>Previous History ({historyVisits.length})</span>
            </Button>

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
            {finalizedVisit && (
              <button
                onClick={() => setTab("completed")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === "completed" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-600 hover:text-emerald-700 font-bold"
                }`}
              >
                <CheckCircle2 className="size-3.5" /> 3. Finalized Rx &amp; Bill
              </button>
            )}
          </div>
        </div>
      </div>

        {/* ── Section Jump Bar: Directly below the header with zero space between them ── */}
        {tab === "consultation" && (
          <SectionJumpBar
            sections={rxJumpSections.length > 0 ? rxJumpSections : DEFAULT_RX_JUMP_SECTIONS}
            className="border-b border-border bg-card px-6 py-2"
          />
        )}

        {/* ── Main Scrollable Body ──────────────────────────────────────── */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className={cn("space-y-5", tab !== "consultation" && "hidden")}>
            {/* Prominent Bold Highlighted Allergies Warning Banner */}
            {Boolean(
              (visit?.allergies && (Array.isArray(visit.allergies) ? visit.allergies.length > 0 : String(visit.allergies).trim().length > 0)) ||
              (petDetails?.allergies && (Array.isArray(petDetails.allergies) ? petDetails.allergies.length > 0 : String(petDetails.allergies).trim().length > 0))
            ) && (
              <div className="rounded-2xl p-4 bg-destructive text-destructive-foreground border-2 border-destructive shadow-lg flex items-start gap-3.5 animate-pulse">
                <AlertTriangle className="size-6 text-white shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>⚠ CRITICAL ALLERGY ALERT</span>
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-mono font-bold">SAFETY WARNING</span>
                  </h4>
                  <p className="text-xs font-bold text-white/95 leading-relaxed">
                    Patient has documented allergies:{" "}
                    <span className="underline decoration-wavy font-extrabold text-yellow-300 text-sm">
                      {Array.isArray(visit?.allergies) && visit.allergies.length > 0
                        ? visit.allergies.join(", ")
                        : Array.isArray(petDetails?.allergies)
                        ? petDetails.allergies.join(", ")
                        : String(visit?.allergies || petDetails?.allergies)}
                    </span>
                  </p>
                  <p className="text-[10px] font-semibold text-white/80">
                    Check contraindications before prescribing NSAIDs, specific antibiotics, or anaesthetics.
                  </p>
                </div>
              </div>
            )}

            {/* ── Prescription Workflow Module (Sections + Live Summary Panel) ── */}
            <PrescriptionWorkflow
              key={activeVisit?.visitId || visit?.visitId}
              visit={activeVisit || visit}
              prescriptionData={prescriptionData || activeVisit?.prescriptionData || visit?.prescriptionData}
              petDetails={petDetails}
              catalogItems={catalogItems}
              onSavePrescription={handleSavePrescription}
              onProceedToBilling={handleProceedToBilling}
              onOpenPrint={() => setShowRxPrint(true)}
              doctorName={activeDoctorName}
              onJumpSectionsChange={setRxJumpSections}
              onPrescriptionDataChange={(newRx) => setPrescriptionData(newRx)}
              onVisitUpdated={(updated) => {
                setActiveVisit(updated);
                if (updated.prescriptionData) {
                  setPrescriptionData(updated.prescriptionData);
                }
                if (updated.clinicalNotes) setClinicalNotes(updated.clinicalNotes);
                if (updated.diagnosis) setDiagnosis(updated.diagnosis);
              }}
              onSyncLines={(newLines) => {
                setLines(newLines.map((l: any, idx: number) => ({
                  ...l,
                  id: l.id || `rx-line-${idx}-${Date.now()}`,
                })));
              }}
              onRefreshVisit={async () => {
                const vId = activeVisit?.visitId || visit?.visitId;
                if (vId) {
                  await loadFreshVisit(vId);
                }
              }}
              onClonePrevious={handleCloneTreatment}
              onViewHistory={handleViewHistory}
              pastVisits={historyVisits}
            />
          </div>

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
                        <th className="px-3 py-2.5 text-center w-32">GST</th>
                        <th className="px-4 py-2.5 text-right w-28">Total (₹)</th>
                        <th className="px-2 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {lines.map((l) => (
                        <tr key={l.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-foreground">{l.name}</p>
                              {l.sourceType && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold bg-primary/10 text-primary border-primary/20">
                                  Rx
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">{l.lineType} {l.batchNo && `· Batch: ${l.batchNo}`}</span>
                              {l.sourceType && (
                                <button
                                  type="button"
                                  onClick={() => setTab("consultation")}
                                  className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                                >
                                  Edit in Rx
                                </button>
                              )}
                            </div>
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
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Switch
                                checked={l.gstApplicable ?? (billType === "GST")}
                                onCheckedChange={(v) => updateLine(l.id, "gstApplicable", v)}
                                className="scale-75 shrink-0"
                              />
                              <div className="relative w-14 shrink-0">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={l.gstRate}
                                  onChange={(e) =>
                                    updateLine(l.id, "gstRate", Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                                  }
                                  title="GST rate — enter manually (commonly 0, 5, 12, 18, 28)"
                                  className="h-7 w-14 pr-4 text-center text-[10px] font-mono bg-card"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground pointer-events-none">%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-foreground font-mono">
                            ₹{calcLineItem({
                              quantity: l.quantity,
                              unitPrice: l.unitPrice,
                              discountType: l.discountType || "percentage",
                              discountValue: l.discountValue ?? l.discountPercent ?? 0,
                              gstRate: l.gstRate,
                              applyGst: l.gstApplicable ?? (billType === "GST"),
                            }).lineTotal.toFixed(2)}
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

              {/* Right Col: Summary & Partial Payment Settlement Panel */}
              <div className="space-y-4">
                <div className="erp-card p-5 space-y-4 shadow-sm border border-border">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <p className="font-extrabold text-sm text-foreground">Billing &amp; Settlement</p>
                    <Badge
                      className={cn(
                        "text-xs font-bold font-mono px-2.5 py-0.5",
                        paymentStatus === "Full"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : paymentStatus === "Partial"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                      )}
                    >
                      Status: {paymentStatus}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-mono">₹{billSummary.subtotal.toFixed(2)}</span>
                    </div>
                    {billSummary.gstAmount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST (CGST + SGST)</span>
                        <span className="font-mono">+₹{billSummary.gstAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Round-off Adjustment</span>
                      <span className="font-mono">{billSummary.roundOff >= 0 ? `+₹${billSummary.roundOff.toFixed(2)}` : `-₹${Math.abs(billSummary.roundOff).toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-sm pt-2 border-t border-border text-foreground">
                      <span>Total Bill Amount</span>
                      <span className="text-primary font-mono text-base">₹{billSummary.totalAmount}</span>
                    </div>
                  </div>

                  {/* Payment Type Selection (§4.1) */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">Payment Type</Label>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                          paymentStatus === "Full"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                            : paymentStatus === "Partial"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {paymentStatus === "Full" ? "Full Payment" : paymentStatus === "Partial" ? "Partial Payment" : "Unpaid"}
                      </Badge>
                    </div>

                    {/* Radio/Segmented Toggle: Full vs Partial */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentType("full");
                          setAmountReceived(billSummary.totalAmount);
                          setHasManuallyEditedAmount(false);
                        }}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all",
                          paymentType === "full"
                            ? "bg-background text-foreground shadow-xs border border-border/80"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className={cn("size-2 rounded-full", paymentType === "full" ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                        Full Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentType("partial");
                          if (numericAmountReceived === billSummary.totalAmount) {
                            setAmountReceived("");
                          }
                        }}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all",
                          paymentType === "partial"
                            ? "bg-background text-foreground shadow-xs border border-border/80"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className={cn("size-2 rounded-full", paymentType === "partial" ? "bg-amber-500" : "bg-muted-foreground/40")} />
                        Partial Payment
                      </button>
                    </div>

                    {paymentType === "full" ? (
                      <div className="rounded-lg p-2.5 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-extrabold block">
                            Amount to Pay (Full)
                          </span>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            Pre-filled total bill · Balance: ₹0.00
                          </span>
                        </div>
                        <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ₹{billSummary.totalAmount}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-foreground">
                            Amount Paid (₹) <span className="text-destructive">*</span>
                          </Label>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentType("full");
                              setAmountReceived(billSummary.totalAmount);
                            }}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Switch to Full (₹{billSummary.totalAmount})
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground font-bold">₹</span>
                          <Input
                            type="number"
                            min={1}
                            max={billSummary.totalAmount}
                            value={amountReceived}
                            onChange={(e) => {
                              setHasManuallyEditedAmount(true);
                              const val = e.target.value === "" ? "" : Number(e.target.value);
                              setAmountReceived(val);
                              if (typeof val === "number" && val >= billSummary.totalAmount && billSummary.totalAmount > 0) {
                                setPaymentType("full");
                              }
                            }}
                            placeholder={`Enter partial amount (< ₹${billSummary.totalAmount})`}
                            className={cn(
                              "h-9 pl-7 font-mono font-bold text-sm bg-background",
                              paymentValidationError && "border-destructive focus-visible:ring-destructive/30"
                            )}
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    {/* Pending Amount (Computed, Read-Only, Dynamic) */}
                    <div className="rounded-lg p-2.5 bg-muted/40 border border-border/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-extrabold block">
                          Remaining Amount (Dynamic)
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {pendingAmount === 0 ? "Fully settled · No balance due" : "Balance to be collected later"}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-mono font-black",
                          pendingAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        ₹{pendingAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* Validation Error Banner */}
                    {paymentValidationError && (
                      <div className="rounded-lg p-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2 animate-in fade-in-50">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>{paymentValidationError}</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Mode & Details */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="text-xs font-semibold">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                      <SelectTrigger className="text-xs h-9 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI (Google Pay / PhonePe)</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Debit / Credit Card</SelectItem>
                        <SelectItem value="NetBanking">NetBanking / NEFT</SelectItem>
                        <SelectItem value="Cheque">Bank Cheque</SelectItem>
                        <SelectItem value="Account Due">Post to Client Due A/C</SelectItem>
                      </SelectContent>
                    </Select>

                    {paymentMode !== "Cash" && paymentMode !== "Account Due" && (
                      <Input
                        placeholder="Transaction / UPI Ref No. (Optional)"
                        value={trxRef}
                        onChange={(e) => setTrxRef(e.target.value)}
                        className="text-xs h-8 bg-background"
                      />
                    )}

                    <Input
                      placeholder="Payment Notes (Optional, e.g. Balance on next visit)"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="text-xs h-8 bg-background"
                    />
                  </div>

                  <Button
                    onClick={handleFinalize}
                    disabled={isFinalizing || Boolean(paymentValidationError)}
                    className={cn(
                      "w-full font-bold transition-all shadow-sm",
                      paymentStatus === "Full"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : paymentStatus === "Partial"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    )}
                  >
                    {isFinalizing ? (
                      "Processing & Syncing..."
                    ) : paymentStatus === "Full" ? (
                      `Finalize & Collect Full ₹${numericAmountReceived} ✓`
                    ) : paymentStatus === "Partial" ? (
                      `Collect Partial ₹${numericAmountReceived} (₹${pendingAmount.toFixed(2)} Pending) ✓`
                    ) : (
                      `Finalize Unpaid Bill (₹${pendingAmount.toFixed(2)} Due) ✓`
                    )}
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
                      <div className="flex items-start gap-2.5">
                        <img src="/clinic-logo.png" alt="Clinic Logo" style={{ height: 32, width: "auto" }} />
                        <div>
                          <h2 className="text-base font-black tracking-tight text-blue-900 uppercase">Real Care Small Animal Clinic</h2>
                          <p className="text-[11px] text-slate-600 mt-0.5">Plot 42, Central Avenue, Near Medical Square, Nagpur - 440009</p>
                          <p className="text-[11px] text-slate-600">Phone: +91 712 2548899 · Reg: MH/VET/2019/8821</p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] space-y-0.5">
                        <p className="font-bold text-xs text-blue-900">{finalizedVisit.doctorName || activeDoctorName}</p>
                        <p className="text-slate-500 text-[10px]">{getDoctorTitle(finalizedVisit.doctorName || activeDoctorName)}</p>
                        <p className="text-slate-500 font-mono text-[10px]">Date: {formatDisplayDate(finalizedVisit.date) || finalizedVisit.date || new Date().toISOString().slice(0, 10)}</p>
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
                        <p><span className="text-slate-500">Weight:</span> <strong className="font-mono">{finalizedVisit.prescriptionData?.weight ? `${finalizedVisit.prescriptionData.weight} ${finalizedVisit.prescriptionData.weightUnit || "kg"}` : (finalizedVisit.vitals?.weight ? `${finalizedVisit.vitals.weight} ${finalizedVisit.vitals.weightUnit || "kg"}` : (finalizedVisit.vitals?.weightKg ? `${finalizedVisit.vitals.weightKg} kg` : "—"))}</strong></p>
                      </div>
                      <div>
                        <p><span className="text-slate-500">Rx No:</span> <strong className="font-mono text-blue-900">{finalizedVisit.prescriptionNo}</strong></p>
                        <p><span className="text-slate-500">Visit No:</span> <span className="font-mono">{finalizedVisit.visitId}</span></p>
                        <p><span className="text-slate-500">Temp:</span> <strong className="font-mono">{finalizedVisit.prescriptionData?.bodyTemperature ? `${finalizedVisit.prescriptionData.bodyTemperature} ${finalizedVisit.prescriptionData.temperatureUnit || "°C"}` : (finalizedVisit.vitals?.temp ? `${finalizedVisit.vitals.temp} ${finalizedVisit.vitals.tempUnit || "°C"}` : (finalizedVisit.vitals?.tempC ? `${finalizedVisit.vitals.tempC} °C` : "—"))}</strong></p>
                      </div>
                    </div>

                    {/* Diagnosis, Symptoms & Findings */}
                    <div className="space-y-1.5">
                      {finalizedVisit.prescriptionData?.symptomsText && (
                        <p className="text-[11px] text-slate-700">
                          <strong className="text-slate-500">Symptoms:</strong> {finalizedVisit.prescriptionData.symptomsText}
                        </p>
                      )}
                      {finalizedVisit.prescriptionData?.clinicalFindings && finalizedVisit.prescriptionData.clinicalFindings.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {finalizedVisit.prescriptionData.clinicalFindings.map((cf: string, i: number) => (
                            <span key={i} className="text-[10px] bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded font-medium">✓ {cf}</span>
                          ))}
                          {finalizedVisit.prescriptionData.clinicalFindingsOther && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded font-medium italic">Other: {finalizedVisit.prescriptionData.clinicalFindingsOther}</span>
                          )}
                        </div>
                      )}
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

                    {/* Immediate Medicines (Administered in Hospital) */}
                    {finalizedVisit.prescriptionData?.immediateMedicines && finalizedVisit.prescriptionData.immediateMedicines.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Immediate Medicines (Hospital Administered)</p>
                        <table className="w-full text-[10px] border border-amber-200">
                          <thead>
                            <tr className="bg-amber-50 text-amber-950 font-bold">
                              <th className="p-1 text-left">Medicine</th>
                              <th className="p-1 text-center">Dose</th>
                              <th className="p-1 text-center">Route</th>
                              <th className="p-1 text-center">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {finalizedVisit.prescriptionData.immediateMedicines.map((im: any, idx: number) => (
                              <tr key={idx}>
                                <td className="p-1 font-semibold text-slate-900">{im.medicineName}</td>
                                <td className="p-1 text-center font-mono">{im.dose} {im.unit}</td>
                                <td className="p-1 text-center">{im.route}</td>
                                <td className="p-1 text-center">{im.time || "Immediate"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Prescribed Medications Table */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 font-bold text-blue-900 text-xs">
                        <span className="text-sm font-serif">℞</span> Prescribed Medications
                      </div>

                      {finalizedVisit.prescriptionData?.prescribedMedicines && finalizedVisit.prescriptionData.prescribedMedicines.length > 0 ? (
                        <table className="w-full text-[10px] border border-slate-200">
                          <thead>
                            <tr className="bg-blue-50/70 border-b border-slate-200 text-left font-bold text-blue-950">
                              <th className="p-1.5">Medicine</th>
                              <th className="p-1.5 text-center">Dose</th>
                              <th className="p-1.5 text-center">Frequency</th>
                              <th className="p-1.5 text-center">Duration</th>
                              <th className="p-1.5 text-center">Route</th>
                              <th className="p-1.5">Timing</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {finalizedVisit.prescriptionData.prescribedMedicines.map((m: any, idx: number) => (
                              <tr key={idx}>
                                <td className="p-1.5 font-bold text-slate-900">
                                  {m.medicineName}
                                  {m.note && <span className="block text-[9px] text-slate-500 font-normal italic">{m.note}</span>}
                                </td>
                                <td className="p-1.5 text-center font-mono font-semibold">{m.dose} {m.unit}</td>
                                <td className="p-1.5 text-center font-semibold text-blue-900">{m.frequency}</td>
                                <td className="p-1.5 text-center font-medium">{m.duration}</td>
                                <td className="p-1.5 text-center">{m.route || "Oral"}</td>
                                <td className="p-1.5 text-slate-700">{m.time || "After Food"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
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
                      )}
                    </div>

                    {/* Injectables (Hospital) */}
                    {finalizedVisit.prescriptionData?.injectables && finalizedVisit.prescriptionData.injectables.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">Injectables (Hospital Given)</p>
                        <table className="w-full text-[10px] border border-purple-200">
                          <thead>
                            <tr className="bg-purple-50 text-purple-950 font-bold">
                              <th className="p-1 text-left">Drug</th>
                              <th className="p-1 text-center">Dose</th>
                              <th className="p-1 text-center">Route</th>
                              <th className="p-1 text-center">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-100">
                            {finalizedVisit.prescriptionData.injectables.map((inj: any, idx: number) => (
                              <tr key={idx}>
                                <td className="p-1 font-semibold text-slate-900">{inj.drugName}</td>
                                <td className="p-1 text-center font-mono">{inj.dose} {inj.unit}</td>
                                <td className="p-1 text-center">{inj.route}</td>
                                <td className="p-1 text-center">{inj.time || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Diet & Care Recommendations */}
                    {(finalizedVisit.prescriptionData?.prescribedDiet?.length > 0 || finalizedVisit.prescriptionData?.foodItems?.length > 0 || finalizedVisit.prescriptionData?.accessories?.length > 0) && (
                      <div className="rounded-lg border border-slate-200 p-2 bg-amber-50/20 text-[10px] space-y-1">
                        <span className="font-bold text-amber-900 block uppercase">Dietary &amp; Care Recommendations:</span>
                        {finalizedVisit.prescriptionData?.prescribedDiet?.map((d: any, di: number) => (
                          <p key={di} className="text-slate-700">• Diet: <strong className="text-slate-900">{d.foodName}</strong> {d.specialInstructions && `(${d.specialInstructions})`}</p>
                        ))}
                        {[
                          ...(finalizedVisit.prescriptionData?.foodItems || []).map((f: any) => `${f.foodName} (Qty: ${f.quantity})`),
                          ...(finalizedVisit.prescriptionData?.accessories || []).map((a: any) => `${a.accessoryName} (Qty: ${a.quantity})`),
                        ].length > 0 && (
                          <p className="text-slate-600">• Dispensed: {[...(finalizedVisit.prescriptionData?.foodItems || []).map((f: any) => `${f.foodName} (x${f.quantity})`), ...(finalizedVisit.prescriptionData?.accessories || []).map((a: any) => `${a.accessoryName} (x${a.quantity})`)].join(", ")}</p>
                        )}
                      </div>
                    )}

                    {/* Follow-up Reminders */}
                    <div className="rounded-xl border border-dashed border-blue-200 p-2.5 text-[11px] grid grid-cols-3 gap-1.5 bg-blue-50/40">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Follow-up Visit:</span>
                        <p className="font-bold text-slate-900">
                          {formatDisplayDate(finalizedVisit.prescriptionData?.followUp?.nextTreatmentDate || finalizedVisit.nextVisitDate) ||
                            finalizedVisit.prescriptionData?.followUp?.nextTreatmentDate ||
                            finalizedVisit.nextVisitDate ||
                            "On distress / As needed"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Vaccination Due:</span>
                        <p className="font-bold text-slate-900">
                          {formatDisplayDate(finalizedVisit.prescriptionData?.followUp?.nextVaccineDate || finalizedVisit.nextVaccineDate) ||
                            finalizedVisit.prescriptionData?.followUp?.nextVaccineDate ||
                            finalizedVisit.nextVaccineDate ||
                            "Per annual schedule"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Deworming Due:</span>
                        <p className="font-bold text-slate-900">
                          {formatDisplayDate(finalizedVisit.prescriptionData?.followUp?.nextDewormingDate || finalizedVisit.nextDewormingDate) ||
                            finalizedVisit.prescriptionData?.followUp?.nextDewormingDate ||
                            finalizedVisit.nextDewormingDate ||
                            "Quarterly"}
                        </p>
                      </div>
                      {finalizedVisit.prescriptionData?.followUp?.instructions && (
                        <div className="col-span-3 pt-1 border-t border-blue-200/50 mt-1">
                          <span className="text-slate-600 font-semibold text-[10px]">Special Instructions:</span>
                          <p className="text-slate-800 italic mt-0.5">{finalizedVisit.prescriptionData.followUp.instructions}</p>
                        </div>
                      )}
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
                      <div className="flex items-start gap-2.5">
                        <img src="/clinic-logo.png" alt="Clinic Logo" style={{ height: 32, width: "auto" }} />
                        <div>
                          <h2 className="text-base font-black tracking-tight text-slate-900 uppercase">Real Care Small Animal Clinic</h2>
                          <p className="text-[11px] text-slate-600">Plot 42, Central Avenue, Near Medical Square, Nagpur - 440009</p>
                          <p className="text-[11px] text-slate-600">Phone: +91 712 2548899 · Reg: MH/VET/2019/8821</p>
                          {finalizedVisit.billType === "GST" && (
                            <p className="text-[11px] font-mono font-bold text-slate-800">GSTIN: 27AABCV1234F1Z5</p>
                          )}
                          <p className="text-[11px] text-slate-600">Branch: {finalizedVisit.branch || "Central Avenue, Nagpur"}</p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] space-y-1">
                        <span className="inline-block bg-slate-900 text-white font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                          {finalizedVisit.billType === "GST" ? "TAX INVOICE" : "BILL OF SUPPLY"}
                        </span>
                        <p className="font-mono font-bold text-xs text-slate-900">{finalizedVisit.invoiceNo}</p>
                        <p className="text-slate-500 font-mono text-[10px]">Date: {formatDisplayDate(finalizedVisit.date) || finalizedVisit.date || new Date().toISOString().slice(0, 10)}</p>
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
                          <span className="font-bold font-mono">₹{(finalizedVisit.amountPaid ?? finalizedVisit.totalAmount ?? 0).toFixed(2)}</span>
                        </div>
                        {finalizedVisit.paymentStatus === "Partial" && (finalizedVisit.pendingAmount || 0) > 0 && (
                          <div className="flex justify-between text-amber-700 font-semibold">
                            <span>Balance Due:</span>
                            <span className="font-mono">₹{finalizedVisit.pendingAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex justify-between font-bold pt-1 border-t border-slate-200",
                            finalizedVisit.paymentStatus === "Partial" ? "text-amber-700" : "text-emerald-700"
                          )}
                        >
                          <span>Payment Status:</span>
                          <span>
                            {finalizedVisit.paymentStatus === "Partial"
                              ? `PARTIAL PAYMENT ⚠`
                              : "PAID IN FULL ✓"}
                          </span>
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
                          <span className="font-mono">₹{(finalizedVisit.amountPaid ?? finalizedVisit.totalAmount ?? 0).toLocaleString("en-IN")}</span>
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
                        <p className="font-bold text-slate-700">For Real Care Small Animal Clinic</p>
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

        {/* ── Previous History Slide-In Panel ───────────────────────────── */}
        <AnimatePresence>
          {showHistoryPanel && (
            <>
              {/* Backdrop */}
              <motion.div
                key="history-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/30 z-10"
                onClick={() => setShowHistoryPanel(false)}
              />
              {/* Panel */}
              <motion.div
                key="history-panel"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-20 flex flex-col shadow-2xl"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Clock className="size-4 text-primary" /> Previous Visit History
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {visit?.petName} · {visit?.petId}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistoryPanel(false)}>
                    ✕
                  </Button>
                </div>

                {/* Panel Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {historyLoading && (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  )}
                  {!historyLoading && historyVisits.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                      <FileText className="size-10 mx-auto opacity-30 text-primary" />
                      <p className="font-bold text-foreground">No previous visits found for {visit?.petName || "patient"}.</p>
                      <p className="text-[11px] text-muted-foreground">This appears to be the initial consultation for this patient record.</p>
                    </div>
                  )}

                  {!historyLoading && historyVisits.map((hv: any) => (
                    <div key={hv.visitId || hv._id} className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5 shadow-2xs hover:border-primary/40 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20 font-bold">
                            {hv.visitId || "RECORD"}
                          </Badge>
                          {hv.prescriptionNo && (
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                              {hv.prescriptionNo}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-foreground font-mono flex items-center gap-1">
                          <Calendar className="size-3 text-muted-foreground" /> {hv.date}
                        </span>
                      </div>

                      {/* Vitals Summary */}
                      {(hv.prescriptionData?.weight || hv.vitals?.weight || hv.vitals?.weightKg || hv.prescriptionData?.bodyTemperature || hv.vitals?.temp || hv.vitals?.tempC) && (
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          {(hv.prescriptionData?.weight || hv.vitals?.weight || hv.vitals?.weightKg) && (
                            <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                              Weight: {hv.prescriptionData?.weight || hv.vitals?.weight || hv.vitals?.weightKg} {hv.prescriptionData?.weightUnit || hv.vitals?.weightUnit || "kg"}
                            </span>
                          )}
                          {(hv.prescriptionData?.bodyTemperature || hv.vitals?.temp || hv.vitals?.tempC) && (
                            <span className="bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded font-semibold">
                              Temp: {hv.prescriptionData?.bodyTemperature || hv.vitals?.temp || hv.vitals?.tempC} {hv.prescriptionData?.temperatureUnit || hv.vitals?.tempUnit || "°C"}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Clinical Findings Badges */}
                      {hv.prescriptionData?.clinicalFindings && hv.prescriptionData.clinicalFindings.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Clinical Findings</p>
                          <div className="flex flex-wrap gap-1">
                            {hv.prescriptionData.clinicalFindings.map((cf: string, cIdx: number) => (
                              <span key={cIdx} className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                                ✓ {cf}
                              </span>
                            ))}
                            {hv.prescriptionData.clinicalFindingsOther && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium italic">
                                Other: {hv.prescriptionData.clinicalFindingsOther}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {hv.diagnosis && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Diagnosis</p>
                          <p className="text-xs font-bold text-foreground bg-muted/30 p-2 rounded-lg border border-border/40">
                            {hv.diagnosis}
                          </p>
                        </div>
                      )}

                      {hv.clinicalNotes && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Clinical Notes</p>
                          <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                            "{hv.clinicalNotes}"
                          </p>
                        </div>
                      )}

                      {/* Immediate Medicines Given in Clinic */}
                      {hv.prescriptionData?.immediateMedicines && hv.prescriptionData.immediateMedicines.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-border/40">
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">Immediate Hospital Treatment</p>
                          <div className="space-y-1">
                            {hv.prescriptionData.immediateMedicines.map((im: any, imIdx: number) => (
                              <div key={imIdx} className="flex items-center justify-between text-xs p-1.5 rounded-md bg-amber-500/5 border border-amber-500/20">
                                <span className="font-semibold text-[11px] text-foreground">{im.medicineName}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">{im.dose} {im.unit} · {im.route}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Injectables Given */}
                      {hv.prescriptionData?.injectables && hv.prescriptionData.injectables.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-border/40">
                          <p className="text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider">Hospital Injectables</p>
                          <div className="space-y-1">
                            {hv.prescriptionData.injectables.map((inj: any, injIdx: number) => (
                              <div key={injIdx} className="flex items-center justify-between text-xs p-1.5 rounded-md bg-purple-500/5 border border-purple-500/20">
                                <span className="font-semibold text-[11px] text-foreground">{inj.drugName}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">{inj.dose} {inj.unit} · {inj.route}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Prescribed Items (from prescriptionData or items) */}
                      {hv.prescriptionData?.prescribedMedicines && hv.prescriptionData.prescribedMedicines.length > 0 ? (
                        <div className="space-y-1 pt-1 border-t border-border/40">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-between">
                            <span>Prescribed Rx Schedule ({hv.prescriptionData.prescribedMedicines.length})</span>
                          </p>
                          <div className="space-y-1">
                            {hv.prescriptionData.prescribedMedicines.map((m: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-md bg-muted/20 border border-border/30">
                                <div>
                                  <p className="font-semibold text-foreground text-[11px]">{m.medicineName}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {m.dose} {m.unit} · {m.frequency} · {m.duration}
                                  </p>
                                </div>
                                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  {m.route || "Oral"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : hv.items && hv.items.length > 0 ? (
                        <div className="space-y-1 pt-1 border-t border-border/40">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-between">
                            <span>Prescription Items ({hv.items.length})</span>
                          </p>
                          <div className="space-y-1">
                            {hv.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-md bg-muted/20 border border-border/30">
                                <div>
                                  <p className="font-semibold text-foreground text-[11px]">{item.name}</p>
                                  {item.dosageInstructions && (
                                    <p className="text-[10px] text-muted-foreground">{item.dosageInstructions}</p>
                                  )}
                                </div>
                                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  Qty: {item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          🩺 {hv.doctorName || "Attending Vet"}
                        </span>
                        {hv.totalAmount > 0 && (
                          <span className="text-xs font-mono font-extrabold text-emerald-600">₹{hv.totalAmount}</span>
                        )}
                      </div>

                      {/* Re-order / Copy Previous Prescription Button */}
                      {((hv.items && hv.items.length > 0) || (hv.prescriptionData?.prescribedMedicines && hv.prescriptionData.prescribedMedicines.length > 0)) && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleCopyPreviousRx(hv)}
                          className="w-full h-8 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-2xs gap-1.5 mt-1"
                        >
                          <Copy className="size-3.5" /> Repeat / Copy Previous Prescription
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>

  );
}
