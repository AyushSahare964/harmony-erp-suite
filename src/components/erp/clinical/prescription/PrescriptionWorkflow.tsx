import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  User,
  Calendar,
  Weight,
  Thermometer,
  Clock,
  Activity,
  Stethoscope,
  Pill,
  Syringe,
  CalendarClock,
  Utensils,
  ShoppingBag,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  Tag,
  Search,
  X,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { SectionCard, type SaveStatus } from "./SectionCard";
import { SectionJumpBar, type SectionJumpItem } from "./SectionJumpBar";
import { InventoryItemSection, type InventoryItemLine } from "./InventoryItemSection";
import { ConsultationFeeSection } from "./ConsultationFeeSection";
import { FollowUpSection, type FollowUpState } from "./FollowUpSection";
import { LaboratoryOrderSection, type LaboratoryState } from "./LaboratoryOrderSection";
import { LivePrescriptionSummaryPanel } from "./LivePrescriptionSummaryPanel";

import { savePrescriptionSectionFn } from "@/lib/mongodb/serverFns/clinical";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import type { IPrescriptionData } from "@/lib/mongodb/models/ClinicalVisit";

export interface PrescriptionWorkflowProps {
  visit: any;
  petDetails?: any;
  catalogItems?: any[];
  onSavePrescription?: (prescriptionData: IPrescriptionData, billableLines: any[]) => Promise<void>;
  onProceedToBilling: (prescriptionData: IPrescriptionData, billableLines: any[]) => void;
  onOpenPrint?: () => void;
  doctorName?: string;
  onSyncLines?: (lines: any[]) => void;
  onRefreshVisit?: () => Promise<void>;
  onClonePrevious?: () => void;
  onViewHistory?: () => void;
  pastVisits?: any[];
  onJumpSectionsChange?: (sections: SectionJumpItem[]) => void;
}

const CLINICAL_FINDINGS_OPTIONS = [
  "Hairfall",
  "Rashes on Skin",
  "Blood in Urine",
  "Lump on Body / Growth",
  "Itching",
  "Limping",
  "Constipation",
  "Urine Incontinence",
  "Vomiting",
  "Listlessness",
  "Dehydration",
  "Fever / Pyrexia",
  "Anorexia / Loss of Appetite",
  "Otitis / Ear Discharge",
  "Coughing / Sneezing",
  "Other",
];

function serializeSectionState(sectionKey: string, data: any): string {
  if (
    sectionKey === "IMMEDIATE_MED" ||
    sectionKey === "PRESCRIBED_MED" ||
    sectionKey === "INJECTABLE" ||
    sectionKey === "ANIMAL_FOOD" ||
    sectionKey === "PRESCRIBED_FOOD" ||
    sectionKey === "ACCESSORY"
  ) {
    const items = Array.isArray(data) ? data : (data?.items || []);
    return JSON.stringify(
      items.map((it: any) => ({
        id: String(it.id || ""),
        itemCode: String(it.itemCode || ""),
        name: String(it.name || it.medicineName || ""),
        quantity: Number(it.quantity) || 1,
        unit: String(it.unit || it.doseUnit || ""),
        unitPrice: Number(it.unitPrice) || 0,
        dosageInstructions: String(it.dosageInstructions || it.dosage || it.instructions || ""),
        frequency: String(it.frequency || ""),
        duration: String(it.duration || ""),
        route: String(it.route || ""),
        dose: it.dose !== undefined ? Number(it.dose) : undefined,
        category: String(it.category || ""),
      }))
    );
  }
  if (sectionKey === "FOLLOWUP") {
    const f = data?.followUp || data;
    return JSON.stringify({
      required: Boolean(f?.required),
      entries: f?.entries || {},
    });
  }
  if (sectionKey === "LABORATORY") {
    const lab = data || {};
    return JSON.stringify({
      enabled: Boolean(lab.enabled),
      dueDate: String(lab.dueDate || ""),
      quickOption: String(lab.quickOption || ""),
      bloodTests: (lab.bloodTests || []).map((b: any) => ({
        id: String(b.id || ""),
        labTestId: String(b.labTestId || ""),
        testName: String(b.testName || b.name || ""),
      })),
    });
  }
  if (sectionKey === "HISTORY" || sectionKey === "SYMPTOMS") {
    return JSON.stringify({ text: String(data?.text ?? data ?? "").trim() });
  }
  if (sectionKey === "FINDINGS") {
    return JSON.stringify({
      findings: Array.isArray(data?.findings) ? data.findings : [],
      other: String(data?.other ?? "").trim(),
    });
  }
  if (sectionKey === "FEE") {
    return JSON.stringify({
      amount: data?.amount !== undefined && data?.amount !== null ? Number(data.amount) : null,
      preset: data?.preset || "STANDARD",
    });
  }
  return JSON.stringify(data);
}

export function PrescriptionWorkflow({
  visit,
  petDetails,
  catalogItems = [],
  onSavePrescription,
  onProceedToBilling,
  onOpenPrint,
  doctorName = "Dr. Rohit Sharma",
  onSyncLines,
  onRefreshVisit,
  onClonePrevious,
  onViewHistory,
  pastVisits = [],
  onJumpSectionsChange,
}: PrescriptionWorkflowProps) {
  const initialRx: IPrescriptionData = visit?.prescriptionData || {};

  // Patient details (Read-only reception data)
  const patientName = visit?.petName || petDetails?.name || "Patient";
  const patientId = visit?.petId || petDetails?.petId || "PET-0001";
  const rawDate = visit?.date || initialRx.dateOfVisit || new Date().toISOString().slice(0, 10);
  const formattedVisitDate = formatDisplayDate(rawDate) || rawDate;

  const displayWeight =
    initialRx.weight ??
    (visit?.vitals?.weight !== undefined ? visit.vitals.weight : visit?.vitals?.weightKg ?? 25);
  const displayWeightUnit = initialRx.weightUnit || visit?.vitals?.weightUnit || "kg";

  const displayTemp =
    initialRx.bodyTemperature ??
    (visit?.vitals?.temp !== undefined ? visit.vitals.temp : visit?.vitals?.tempC ?? 38.5);
  const displayTempUnit = initialRx.temperatureUnit || visit?.vitals?.tempUnit || "°C";

  // Check if visit is settled
  const isSettled =
    visit?.status === "Paid" || visit?.status === "Settled" || visit?.status === "Closed";

  // Optimistic version & Ref for synchronous sequential saves
  const [version, setVersion] = useState<number>(initialRx.version || 1);
  const versionRef = useRef<number>(initialRx.version || 1);

  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  // Section 2: Previous History
  const [previousHistory, setPreviousHistory] = useState<string>(
    initialRx.previousHistory ?? visit?.clinicalNotes ?? ""
  );
  const [showEarlierHistory, setShowEarlierHistory] = useState<boolean>(false);

  // Section 3: Symptoms (blank default)
  const [symptomsText, setSymptomsText] = useState<string>(
    initialRx.symptomsText ?? visit?.vitals?.complaint ?? ""
  );

  // Section 4: Clinical Findings
  const [clinicalFindings, setClinicalFindings] = useState<string[]>(
    initialRx.clinicalFindings || []
  );
  const [clinicalFindingsOther, setClinicalFindingsOther] = useState<string>(
    initialRx.clinicalFindingsOther || ""
  );
  const [findingSearchQuery, setFindingSearchQuery] = useState("");
  const [findingsDropdownOpen, setFindingsDropdownOpen] = useState(false);

  // Initial values computed stably
  const initialImmediate = useMemo<InventoryItemLine[]>(() => {
    if (initialRx.immediateMedicines && initialRx.immediateMedicines.length > 0) {
      return initialRx.immediateMedicines.map((m: any, idx: number) => ({
        id: m.id || `imm-${idx}-${visit?.visitId || "rx"}`,
        itemCode: m.itemCode,
        name: m.medicineName || m.name,
        dosageInstructions: m.dosage || m.instructions || "",
        quantity: Number(m.quantity) || 1,
        unit: m.unit || "Tablet",
        unitPrice: Number(m.unitPrice) || 120,
        discountPercent: 0,
      }));
    }
    return [];
  }, [visit?.visitId, initialRx]);

  const [immediateMedicines, setImmediateMedicines] = useState<InventoryItemLine[]>(initialImmediate);

  const initialPrescribed = useMemo<InventoryItemLine[]>(() => {
    if (initialRx.prescribedMedicines && initialRx.prescribedMedicines.length > 0) {
      return initialRx.prescribedMedicines.map((m: any, idx: number) => ({
        id: m.id || `med-${idx}-${visit?.visitId || "rx"}`,
        itemCode: m.itemCode,
        name: m.medicineName || m.name,
        brand: m.brand,
        dosageInstructions: m.dosage || m.instructions || "",
        frequency: m.frequency || "As directed",
        duration: m.duration || "5 days",
        route: m.route || "Oral",
        quantity: Number(m.quantity) || 1,
        unit: m.unit || "Tablet",
        unitPrice: Number(m.unitPrice) || 150,
        discountPercent: 0,
      }));
    }
    // Migration fallback for legacy visit.items
    if (visit?.items && visit.items.length > 0) {
      const medLines = visit.items.filter(
        (i: any) =>
          (i.lineType === "Pharmacy" || i.lineType === "Vaccine") &&
          !i.name?.toLowerCase().includes("consultation") &&
          i.rxSection !== "IMMEDIATE_MED" &&
          i.rxSection !== "INJECTABLE"
      );
      if (medLines.length > 0) {
        return medLines.map((m: any, idx: number) => ({
          id: m.id || m.sourceId || `med-${idx}-${visit?.visitId || "rx"}`,
          itemCode: m.itemCode,
          name: m.name,
          dosageInstructions: m.dosageInstructions || "As directed",
          quantity: Number(m.quantity) || 1,
          unit: "Tablet",
          unitPrice: Number(m.unitPrice) || 150,
          discountPercent: Number(m.discountPercent) || 0,
        }));
      }
    }
    return [];
  }, [visit?.visitId, initialRx]);

  const [prescribedMedicines, setPrescribedMedicines] = useState<InventoryItemLine[]>(initialPrescribed);

  const initialInjectables = useMemo<InventoryItemLine[]>(() => {
    if (initialRx.injectables && initialRx.injectables.length > 0) {
      return initialRx.injectables.map((m: any, idx: number) => ({
        id: m.id || `inj-${idx}-${visit?.visitId || "rx"}`,
        itemCode: m.itemCode,
        name: m.name,
        dosageInstructions: m.instructions || "Administered in clinic",
        route: m.route || "SC",
        quantity: Number(m.quantity) || 1,
        unit: m.doseUnit || "ml",
        unitPrice: Number(m.unitPrice) || 480,
        discountPercent: 0,
      }));
    }
    return [];
  }, [visit?.visitId, initialRx]);

  const [injectables, setInjectables] = useState<InventoryItemLine[]>(initialInjectables);

  // Section 6: Consultation Fee
  const initialFee = useMemo<number>(() => {
    if (initialRx.consultationFee !== undefined && initialRx.consultationFee !== null) {
      return Number(initialRx.consultationFee);
    }
    const consultLine = (visit?.items || []).find((l: any) => l.lineType === "Consultation");
    if (consultLine) return Number(consultLine.unitPrice) || 0;
    return 500;
  }, [visit?.visitId, initialRx]);

  const [consultationFee, setConsultationFee] = useState<number | null>(initialFee);
  const [consultationFeePreset, setConsultationFeePreset] = useState<string | null>(
    initialRx.consultationFeePreset || "STANDARD"
  );

  // Section 7: Clinical Follow-up
  const initialFollowUp = useMemo<FollowUpState>(() => {
    const rawF = initialRx.followUp;
    const entries = initialRx.followUpEntries || {};
    const bloodTests = initialRx.bloodTests || [];

    const isReq =
      initialRx.followupRequired !== undefined
        ? initialRx.followupRequired
        : Boolean(rawF?.required || rawF?.nextVaccineDate || rawF?.nextTreatmentDate || rawF?.nextDewormingDate);

    return {
      required: isReq,
      entries: {
        TREATMENT: entries["TREATMENT"] || {
          enabled: Boolean(rawF?.nextTreatmentDate || visit?.nextVisitDate),
          dueDate: rawF?.nextTreatmentDate || visit?.nextVisitDate || "",
          notes: "",
        },
        CONSULTATION: entries["CONSULTATION"] || {
          enabled: false,
          dueDate: "",
          notes: "",
        },
        VACCINE: entries["VACCINE"] || {
          enabled: Boolean(rawF?.nextVaccineDate || visit?.nextVaccineDate),
          dueDate: rawF?.nextVaccineDate || visit?.nextVaccineDate || "",
        },
        DEWORMING: entries["DEWORMING"] || {
          enabled: Boolean(rawF?.nextDewormingDate || visit?.nextDewormingDate),
          dueDate: rawF?.nextDewormingDate || visit?.nextDewormingDate || "",
        },
        BLOOD_TEST: entries["BLOOD_TEST"] || {
          enabled: bloodTests.length > 0,
          dueDate: rawDate,
        },
      },
      bloodTests: bloodTests.map((b: any, i: number) => ({
        id: b.id || `bt-${i}-${visit?.visitId || "rx"}`,
        labTestId: b.labTestId,
        testName: b.testName || b.name,
        status: b.status || "Ordered",
      })),
    };
  }, [visit?.visitId, initialRx, rawDate]);

  const [followUp, setFollowUp] = useState<FollowUpState>(initialFollowUp);

  // Dedicated Laboratory Orders Section
  const initialLaboratory = useMemo<LaboratoryState>(() => {
    const rawBloodTests = initialRx.bloodTests || [];
    const entries = initialRx.followUpEntries || {};
    const bloodTestEntry = entries["BLOOD_TEST"];
    const isEnabled =
      initialRx.laboratoryRequired !== undefined
        ? Boolean(initialRx.laboratoryRequired)
        : Boolean(bloodTestEntry?.enabled || rawBloodTests.length > 0);

    return {
      enabled: isEnabled,
      dueDate: bloodTestEntry?.dueDate || rawDate,
      quickOption: bloodTestEntry?.quickOption || "TODAY",
      bloodTests: rawBloodTests.map((b: any, i: number) => ({
        id: b.id || `bt-${i}-${visit?.visitId || "rx"}`,
        labTestId: b.labTestId,
        testName: b.testName || b.name,
        status: b.status || "Ordered",
      })),
    };
  }, [visit?.visitId, initialRx, rawDate]);

  const [laboratory, setLaboratory] = useState<LaboratoryState>(initialLaboratory);

  // Section 8: Animal Food
  const initialAnimalFood = useMemo<InventoryItemLine[]>(() => {
    const raw = initialRx.animalFood || [];
    return raw.map((f: any, idx: number) => ({
      id: f.id || `food-${idx}-${visit?.visitId || "rx"}`,
      itemCode: f.itemCode,
      name: f.name,
      quantity: Number(f.quantity) || 1,
      unit: f.unit || "Kg",
      unitPrice: Number(f.unitPrice) || 1850,
      discountPercent: Number(f.discountPercent || 0),
    }));
  }, [visit?.visitId, initialRx]);

  const [animalFood, setAnimalFood] = useState<InventoryItemLine[]>(initialAnimalFood);

  // Section 9: Prescribed Food
  const initialPrescribedFood = useMemo<InventoryItemLine[]>(() => {
    const raw = initialRx.prescribedFood || [];
    return raw.map((f: any, idx: number) => ({
      id: f.id || `pfood-${idx}-${visit?.visitId || "rx"}`,
      itemCode: f.itemCode,
      name: f.name,
      quantity: Number(f.quantity) || 1,
      unit: f.unit || "Kg",
      unitPrice: Number(f.unitPrice) || 2450,
      dosageInstructions: f.instructions,
      duration: f.duration || "14 days",
      discountPercent: 0,
    }));
  }, [visit?.visitId, initialRx]);

  const [prescribedFood, setPrescribedFood] = useState<InventoryItemLine[]>(initialPrescribedFood);

  // Section 10: Accessories
  const initialAccessories = useMemo<InventoryItemLine[]>(() => {
    const raw = initialRx.accessories || [];
    return raw.map((a: any, idx: number) => ({
      id: a.id || `acc-${idx}-${visit?.visitId || "rx"}`,
      itemCode: a.itemCode,
      name: a.name,
      category: a.category,
      quantity: Number(a.quantity) || 1,
      unit: "Piece",
      unitPrice: Number(a.unitPrice) || 320,
      discountPercent: Number(a.discountPercent || 0),
    }));
  }, [visit?.visitId, initialRx]);

  const [accessories, setAccessories] = useState<InventoryItemLine[]>(initialAccessories);

  // ── Snapshots for Dirty Detection ─────────────────────────────────────────
  const [lastSaved, setLastSaved] = useState<Record<string, string>>(() => ({
    HISTORY: serializeSectionState("HISTORY", { text: initialRx.previousHistory ?? visit?.clinicalNotes ?? "" }),
    SYMPTOMS: serializeSectionState("SYMPTOMS", { text: initialRx.symptomsText ?? visit?.vitals?.complaint ?? "" }),
    FINDINGS: serializeSectionState("FINDINGS", {
      findings: initialRx.clinicalFindings || [],
      other: initialRx.clinicalFindingsOther || "",
    }),
    IMMEDIATE_MED: serializeSectionState("IMMEDIATE_MED", initialImmediate),
    PRESCRIBED_MED: serializeSectionState("PRESCRIBED_MED", initialPrescribed),
    INJECTABLE: serializeSectionState("INJECTABLE", initialInjectables),
    FEE: serializeSectionState("FEE", {
      amount: initialFee,
      preset: initialRx.consultationFeePreset || "STANDARD",
    }),
    FOLLOWUP: serializeSectionState("FOLLOWUP", initialFollowUp),
    LABORATORY: serializeSectionState("LABORATORY", initialLaboratory),
    ANIMAL_FOOD: serializeSectionState("ANIMAL_FOOD", initialAnimalFood),
    PRESCRIBED_FOOD: serializeSectionState("PRESCRIBED_FOOD", initialPrescribedFood),
    ACCESSORY: serializeSectionState("ACCESSORY", initialAccessories),
  }));

  const [sectionStatus, setSectionStatus] = useState<Record<string, SaveStatus>>({});
  const [sectionSavedAt, setSectionSavedAt] = useState<Record<string, string>>(
    initialRx.sectionSavedAt || {}
  );
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Dirty calculations
  const isHistoryDirty = useMemo(
    () => serializeSectionState("HISTORY", { text: previousHistory }) !== lastSaved["HISTORY"],
    [previousHistory, lastSaved]
  );
  const isSymptomsDirty = useMemo(
    () => serializeSectionState("SYMPTOMS", { text: symptomsText }) !== lastSaved["SYMPTOMS"],
    [symptomsText, lastSaved]
  );
  const isFindingsDirty = useMemo(
    () =>
      serializeSectionState("FINDINGS", { findings: clinicalFindings, other: clinicalFindingsOther }) !==
      lastSaved["FINDINGS"],
    [clinicalFindings, clinicalFindingsOther, lastSaved]
  );
  const isImmediateDirty = useMemo(
    () => serializeSectionState("IMMEDIATE_MED", immediateMedicines) !== lastSaved["IMMEDIATE_MED"],
    [immediateMedicines, lastSaved]
  );
  const isPrescribedDirty = useMemo(
    () => serializeSectionState("PRESCRIBED_MED", prescribedMedicines) !== lastSaved["PRESCRIBED_MED"],
    [prescribedMedicines, lastSaved]
  );
  const isInjectableDirty = useMemo(
    () => serializeSectionState("INJECTABLE", injectables) !== lastSaved["INJECTABLE"],
    [injectables, lastSaved]
  );
  const isFeeDirty = useMemo(
    () =>
      serializeSectionState("FEE", { amount: consultationFee, preset: consultationFeePreset }) !==
      lastSaved["FEE"],
    [consultationFee, consultationFeePreset, lastSaved]
  );
  const isFollowUpDirty = useMemo(
    () => serializeSectionState("FOLLOWUP", followUp) !== lastSaved["FOLLOWUP"],
    [followUp, lastSaved]
  );
  const isLaboratoryDirty = useMemo(
    () => serializeSectionState("LABORATORY", laboratory) !== lastSaved["LABORATORY"],
    [laboratory, lastSaved]
  );
  const isAnimalFoodDirty = useMemo(
    () => serializeSectionState("ANIMAL_FOOD", animalFood) !== lastSaved["ANIMAL_FOOD"],
    [animalFood, lastSaved]
  );
  const isPrescribedFoodDirty = useMemo(
    () => serializeSectionState("PRESCRIBED_FOOD", prescribedFood) !== lastSaved["PRESCRIBED_FOOD"],
    [prescribedFood, lastSaved]
  );
  const isAccessoryDirty = useMemo(
    () => serializeSectionState("ACCESSORY", accessories) !== lastSaved["ACCESSORY"],
    [accessories, lastSaved]
  );

  const hasAnyDirtySection =
    isHistoryDirty ||
    isSymptomsDirty ||
    isFindingsDirty ||
    isImmediateDirty ||
    isPrescribedDirty ||
    isInjectableDirty ||
    isFeeDirty ||
    isFollowUpDirty ||
    isLaboratoryDirty ||
    isAnimalFoodDirty ||
    isPrescribedFoodDirty ||
    isAccessoryDirty;

  // Jump Bar Section Definitions
  const jumpSections: SectionJumpItem[] = [
    { id: "sec-history", label: "1. History", isDirty: isHistoryDirty },
    { id: "sec-symptoms", label: "2. Symptoms", isDirty: isSymptomsDirty },
    { id: "sec-findings", label: "3. Findings", isDirty: isFindingsDirty },
    { id: "sec-treatment", label: "4. Treatment", isDirty: isImmediateDirty || isPrescribedDirty || isInjectableDirty },
    { id: "sec-fee", label: "5. Fee", isDirty: isFeeDirty },
    { id: "sec-followup", label: "6. Follow-up", isDirty: isFollowUpDirty },
    { id: "sec-laboratory", label: "7. Laboratory", isDirty: isLaboratoryDirty },
    { id: "sec-animal-food", label: "8. Animal Food", isDirty: isAnimalFoodDirty },
    { id: "sec-prescribed-food", label: "9. Prescribed Food", isDirty: isPrescribedFoodDirty },
    { id: "sec-accessories", label: "10. Accessories", isDirty: isAccessoryDirty },
  ];

  useEffect(() => {
    onJumpSectionsChange?.(jumpSections);
  }, [
    onJumpSectionsChange,
    isHistoryDirty,
    isSymptomsDirty,
    isFindingsDirty,
    isImmediateDirty,
    isPrescribedDirty,
    isInjectableDirty,
    isFeeDirty,
    isFollowUpDirty,
    isLaboratoryDirty,
    isAnimalFoodDirty,
    isPrescribedFoodDirty,
    isAccessoryDirty,
  ]);

  // ── Unified Section Save Handler (§1.3, §5.2) ─────────────────────────────
  const executeSaveSection = async (sectionKey: string, payload: any): Promise<void> => {
    setSectionStatus((prev) => ({ ...prev, [sectionKey]: "saving" }));
    try {
      const res = await savePrescriptionSectionFn({
        data: {
          visitId: visit.visitId,
          section: sectionKey as any,
          payload,
          version: versionRef.current,
        },
      });

      const newVersion = res.version;
      versionRef.current = newVersion;
      setVersion(newVersion);
      setSectionSavedAt(res.sectionSavedAt || {});
      setLastSaved((prev) => ({
        ...prev,
        [sectionKey]: serializeSectionState(sectionKey, payload),
      }));
      setSectionStatus((prev) => ({ ...prev, [sectionKey]: "saved" }));

      if (res.visit?.items) {
        onSyncLines?.(res.visit.items);
      }
    } catch (err: any) {
      setSectionStatus((prev) => ({ ...prev, [sectionKey]: "error" }));
      if (err.message?.includes("CONFLICT_VERSION")) {
        toast.error("Prescription was updated in another window. Reloading...");
        await onRefreshVisit?.();
      } else {
        toast.error(err.message || `Failed to save ${sectionKey}`);
      }
      throw err;
    }
  };

  // Section Save Callbacks
  const handleSaveHistory = () =>
    executeSaveSection("HISTORY", { text: previousHistory.trim() });
  const handleSaveSymptoms = () =>
    executeSaveSection("SYMPTOMS", { text: symptomsText.trim() });
  const handleSaveFindings = () =>
    executeSaveSection("FINDINGS", {
      findings: clinicalFindings,
      other: clinicalFindingsOther.trim(),
    });
  const handleSaveImmediateMed = () =>
    executeSaveSection("IMMEDIATE_MED", { items: immediateMedicines });
  const handleSavePrescribedMed = () =>
    executeSaveSection("PRESCRIBED_MED", { items: prescribedMedicines });
  const handleSaveInjectable = () =>
    executeSaveSection("INJECTABLE", { items: injectables });
  const handleSaveFee = () =>
    executeSaveSection("FEE", {
      amount: consultationFee,
      preset: consultationFeePreset,
    });
  const handleSaveFollowUp = () =>
    executeSaveSection("FOLLOWUP", {
      required: followUp.required,
      entries: followUp.entries,
    });
  const handleSaveLaboratory = () =>
    executeSaveSection("LABORATORY", {
      enabled: laboratory.enabled,
      dueDate: laboratory.dueDate,
      bloodTests: laboratory.bloodTests,
    });
  const handleSaveAnimalFood = () =>
    executeSaveSection("ANIMAL_FOOD", { items: animalFood });
  const handleSavePrescribedFood = () =>
    executeSaveSection("PRESCRIBED_FOOD", { items: prescribedFood });
  const handleSaveAccessories = () =>
    executeSaveSection("ACCESSORY", { items: accessories });

  // Save All Draft (§5.7, §13.2)
  const handleSaveAllDraft = async () => {
    setIsSavingAll(true);
    let anyFailed = false;
    try {
      if (isHistoryDirty) await handleSaveHistory();
      if (isSymptomsDirty) await handleSaveSymptoms();
      if (isFindingsDirty) await handleSaveFindings();
      if (isImmediateDirty) await handleSaveImmediateMed();
      if (isPrescribedDirty) await handleSavePrescribedMed();
      if (isInjectableDirty) await handleSaveInjectable();
      if (isFeeDirty) await handleSaveFee();
      if (isFollowUpDirty) await handleSaveFollowUp();
      if (isLaboratoryDirty) await handleSaveLaboratory();
      if (isAnimalFoodDirty) await handleSaveAnimalFood();
      if (isPrescribedFoodDirty) await handleSavePrescribedFood();
      if (isAccessoryDirty) await handleSaveAccessories();

      toast.success("All prescription sections saved successfully as draft!");
    } catch (e: any) {
      anyFailed = true;
    } finally {
      setIsSavingAll(false);
    }
  };

  // Proceed to Billing & Settlement (§13.3)
  const handleProceed = async () => {
    if (hasAnyDirtySection && !isSettled) {
      await handleSaveAllDraft();
    }
    // Build snapshot and navigate
    const rxSnapshot: IPrescriptionData = {
      prescriptionId: visit.prescriptionNo,
      dateOfVisit: rawDate,
      weight: displayWeight,
      bodyTemperature: displayTemp,
      previousHistory,
      symptomsText,
      clinicalFindings,
      clinicalFindingsOther,
      immediateMedicines: immediateMedicines as any,
      prescribedMedicines: prescribedMedicines as any,
      injectables: injectables as any,
      consultationFee: consultationFee ?? undefined,
      consultationFeePreset: consultationFeePreset || undefined,
      followupRequired: followUp.required ?? undefined,
      followUpEntries: followUp.entries,
      followUp: {
        required: Boolean(followUp.required),
        nextTreatmentDate: followUp.entries.TREATMENT?.dueDate || undefined,
        nextVaccineDate: followUp.entries.VACCINE?.dueDate || undefined,
        nextDewormingDate: followUp.entries.DEWORMING?.dueDate || undefined,
      },
      laboratoryRequired: laboratory.enabled,
      bloodTests: laboratory.bloodTests as any,
      animalFood: animalFood as any,
      prescribedFood: prescribedFood as any,
      accessories: accessories as any,
      version,
    };
    onProceedToBilling(rxSnapshot, []);
  };

  // Findings handler
  const handleToggleFinding = (finding: string) => {
    if (clinicalFindings.includes(finding)) {
      setClinicalFindings(clinicalFindings.filter((f) => f !== finding));
      if (finding === "Other") setClinicalFindingsOther("");
    } else {
      setClinicalFindings([...clinicalFindings, finding]);
    }
  };

  const filteredFindingOptions = useMemo(() => {
    if (!findingSearchQuery.trim()) return CLINICAL_FINDINGS_OPTIONS;
    const q = findingSearchQuery.toLowerCase();
    return CLINICAL_FINDINGS_OPTIONS.filter((opt) => opt.toLowerCase().includes(q));
  }, [findingSearchQuery]);

  return (
    <div className="space-y-6 pb-6">
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/80">
        <div>
          <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            <span>Doctor Rx &amp; Diagnosis</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prescription authoring &amp; clinical treatment workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-mono font-bold bg-muted/60 text-foreground border-border px-3 py-1 flex items-center gap-1.5"
          >
            <Calendar className="size-3.5 text-primary" />
            <span>Date: {formattedVisitDate}</span>
          </Badge>
          {onOpenPrint && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenPrint}
              className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
            >
              Rx Print Preview
            </Button>
          )}
        </div>
      </div>

      {/* ── 2-Column Responsive Workspace: Sections + Sticky Live Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Structured Prescription Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Patient Details (Read-only receptionist intake data) */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-primary" />
                <span>Patient Details</span>
              </h3>
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono font-medium">
                Read-only (Receptionist Intake)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5">
                <span className="text-[10px] text-muted-foreground block font-medium">Patient Name</span>
                <span className="text-xs font-bold text-foreground truncate block mt-0.5">{patientName}</span>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5">
                <span className="text-[10px] text-muted-foreground block font-medium">Patient ID</span>
                <span className="text-xs font-bold font-mono text-primary truncate block mt-0.5">{patientId}</span>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5">
                <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
                  <Weight className="size-3 text-muted-foreground" /> Weight
                </span>
                <span className="text-xs font-bold font-mono text-foreground block mt-0.5">
                  {displayWeight} {displayWeightUnit}
                </span>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5">
                <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
                  <Thermometer className="size-3 text-muted-foreground" /> Temperature
                </span>
                <span className="text-xs font-bold font-mono text-foreground block mt-0.5">
                  {displayTemp} {displayTempUnit}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Previous History (§8, Phase 5) */}
          <SectionCard
            id="sec-history"
            icon={<Clock className="size-4" />}
            title="1. Previous History"
            subtitle="Record medical history for this visit; past visit notes shown read-only"
            status={sectionStatus["HISTORY"]}
            lastSavedAt={sectionSavedAt["HISTORY"]}
            isDirty={isHistoryDirty}
            onSave={handleSaveHistory}
            saveLabel="Save History ✓"
          >
            <div className="space-y-3">
              <Textarea
                value={previousHistory}
                onChange={(e) => setPreviousHistory(e.target.value)}
                placeholder="Enter previous medical history / clinical background for this visit..."
                rows={3}
                className="text-xs resize-y bg-background"
              />

              {/* Collapsed Earlier History from prior visits (§2.1, §8) */}
              {pastVisits.length > 0 && (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowEarlierHistory(!showEarlierHistory)}
                    className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary" />
                      <span>Earlier Visits History ({pastVisits.length} previous visits)</span>
                    </span>
                    {showEarlierHistory ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>

                  {showEarlierHistory && (
                    <div className="space-y-2 pt-2 divide-y divide-border/40 max-h-48 overflow-y-auto">
                      {pastVisits.map((pv: any) => (
                        <div key={pv.visitId} className="pt-2 text-xs space-y-1">
                          <div className="flex items-center justify-between font-semibold text-muted-foreground text-[11px]">
                            <span>Visit {pv.visitId} · {pv.doctorName || "Doctor"}</span>
                            <span className="font-mono">{formatDisplayDate(pv.date)}</span>
                          </div>
                          <p className="text-foreground italic bg-card p-2 rounded border border-border/50">
                            {pv.clinicalNotes || pv.diagnosis || "No notes recorded"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* 3. Symptoms (§8, Phase 5) — Starts completely blank */}
          <SectionCard
            id="sec-symptoms"
            icon={<Activity className="size-4" />}
            title="2. Symptoms"
            subtitle="Presenting complaints reported by owner / observed during intake"
            status={sectionStatus["SYMPTOMS"]}
            lastSavedAt={sectionSavedAt["SYMPTOMS"]}
            isDirty={isSymptomsDirty}
            onSave={handleSaveSymptoms}
            saveLabel="Save Symptoms ✓"
          >
            <Textarea
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              placeholder="Enter presenting symptoms (e.g. Vomiting and loss of appetite since yesterday)..."
              rows={3}
              className="text-xs resize-y bg-background"
            />
          </SectionCard>

          {/* 4. Clinical Findings (§8, Phase 5) */}
          <SectionCard
            id="sec-findings"
            icon={<Tag className="size-4" />}
            title="3. Clinical Findings"
            subtitle="Examination findings and diagnosis tags"
            status={sectionStatus["FINDINGS"]}
            lastSavedAt={sectionSavedAt["FINDINGS"]}
            isDirty={isFindingsDirty}
            onSave={handleSaveFindings}
            saveLabel="Save Findings ✓"
          >
            <div className="space-y-3">
              {/* Selected Findings Chips */}
              {clinicalFindings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/60">
                  {clinicalFindings.map((finding) => (
                    <span
                      key={finding}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                    >
                      <span>{finding}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleFinding(finding)}
                        className="hover:text-destructive hover:bg-destructive/10 rounded p-0.5 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Searchable Dropdown */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    value={findingSearchQuery}
                    onChange={(e) => {
                      setFindingSearchQuery(e.target.value);
                      setFindingsDropdownOpen(true);
                    }}
                    onFocus={() => setFindingsDropdownOpen(true)}
                    placeholder="Search or pick clinical findings..."
                    className="pl-8 text-xs h-9 bg-background"
                  />
                </div>

                {findingsDropdownOpen && (
                  <div className="absolute z-40 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1">
                      {filteredFindingOptions.map((option) => {
                        const isSelected = clinicalFindings.includes(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleToggleFinding(option)}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left",
                              isSelected
                                ? "bg-primary text-primary-foreground font-bold"
                                : "hover:bg-muted text-foreground"
                            )}
                          >
                            <span>{option}</span>
                            {isSelected && <CheckCircle2 className="size-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-1.5 border-t border-border/40 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFindingsDropdownOpen(false)}
                        className="h-6 text-[11px] px-2"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Conditional Other Text */}
              {clinicalFindings.includes("Other") && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1.5 animate-in fade-in-50">
                  <Label className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="size-3.5" />
                    <span>Specify Other Finding (Required)</span>
                  </Label>
                  <Input
                    type="text"
                    value={clinicalFindingsOther}
                    onChange={(e) => setClinicalFindingsOther(e.target.value)}
                    placeholder="Describe clinical finding in detail..."
                    className="text-xs h-8 bg-background border-amber-500/40"
                  />
                </div>
              )}
            </div>
          </SectionCard>

          {/* 5. Clinical Treatment Card (§9, Phase 6) */}
          <div id="sec-treatment" className="space-y-4">
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Pill className="size-5 text-primary" />
              <div>
                <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                  4. Clinical Treatment
                </h3>
                <p className="text-xs text-muted-foreground">
                  Immediate administration, prescribed medicines for home, and injectables
                </p>
              </div>
            </div>

            {/* Subsection A: Immediate Medication */}
            <InventoryItemSection
              id="sec-immediate-med"
              section="IMMEDIATE_MED"
              title="Immediate Medication (Administered Now)"
              subtitle="Medicines given on-spot in the clinic during consultation"
              icon={<Pill className="size-4 text-emerald-600" />}
              catalogueType="medicine"
              items={immediateMedicines}
              onChange={setImmediateMedicines}
              onSave={handleSaveImmediateMed}
              status={sectionStatus["IMMEDIATE_MED"]}
              lastSavedAt={sectionSavedAt["IMMEDIATE_MED"]}
              isDirty={isImmediateDirty}
              saveLabel="Save Immediate Meds ✓"
              catalogItems={catalogItems}
              showDosage={true}
              isLocked={isSettled}
            />

            {/* Subsection B: Prescribed Medicine */}
            <InventoryItemSection
              id="sec-prescribed-med"
              section="PRESCRIBED_MED"
              title="Prescribed Medicine (For Home)"
              subtitle="Oral medication course prescribed for pet parent to administer"
              icon={<Pill className="size-4 text-blue-600" />}
              catalogueType="medicine"
              items={prescribedMedicines}
              onChange={setPrescribedMedicines}
              onSave={handleSavePrescribedMed}
              status={sectionStatus["PRESCRIBED_MED"]}
              lastSavedAt={sectionSavedAt["PRESCRIBED_MED"]}
              isDirty={isPrescribedDirty}
              saveLabel="Save Prescribed Meds ✓"
              catalogItems={catalogItems}
              showDosage={true}
              showFrequencyDuration={true}
              isLocked={isSettled}
            />

            {/* Subsection C: Injectables */}
            <InventoryItemSection
              id="sec-injectables"
              section="INJECTABLE"
              title="Injectable / Vaccine Administration"
              subtitle="Injections & vaccines administered by doctor or veterinary nurse"
              icon={<Syringe className="size-4 text-purple-600" />}
              catalogueType="medicine"
              items={injectables}
              onChange={setInjectables}
              onSave={handleSaveInjectable}
              status={sectionStatus["INJECTABLE"]}
              lastSavedAt={sectionSavedAt["INJECTABLE"]}
              isDirty={isInjectableDirty}
              saveLabel="Save Injectables ✓"
              catalogItems={catalogItems}
              showDosage={true}
              showRoute={true}
              isLocked={isSettled}
            />
          </div>

          {/* 6. Consultation Fee (§7, Phase 4) */}
          <ConsultationFeeSection
            id="sec-fee"
            amount={consultationFee}
            preset={consultationFeePreset}
            onChangeAmount={(amt, pr) => {
              setConsultationFee(amt);
              setConsultationFeePreset(pr);
            }}
            onSave={handleSaveFee}
            status={sectionStatus["FEE"]}
            lastSavedAt={sectionSavedAt["FEE"]}
            isDirty={isFeeDirty}
            isLocked={isSettled}
          />

          {/* 6. Clinical Follow-up & Reminders */}
          <FollowUpSection
            id="sec-followup"
            visitDate={rawDate}
            followUp={followUp}
            onChange={setFollowUp}
            onSave={handleSaveFollowUp}
            status={sectionStatus["FOLLOWUP"]}
            lastSavedAt={sectionSavedAt["FOLLOWUP"]}
            isDirty={isFollowUpDirty}
            isLocked={isSettled}
          />

          {/* 7. Dedicated Laboratory & Diagnostics Orders */}
          <LaboratoryOrderSection
            id="sec-laboratory"
            visitDate={rawDate}
            laboratory={laboratory}
            onChange={setLaboratory}
            onSave={handleSaveLaboratory}
            status={sectionStatus["LABORATORY"]}
            lastSavedAt={sectionSavedAt["LABORATORY"]}
            isDirty={isLaboratoryDirty}
            isLocked={isSettled}
          />

          {/* 8. Animal Food */}
          <InventoryItemSection
            id="sec-animal-food"
            section="ANIMAL_FOOD"
            title="Animal Food & Treats"
            subtitle="Pet retail food, kibble, treats & wet food packs from inventory"
            icon={<Utensils className="size-4 text-amber-600" />}
            catalogueType="food"
            items={animalFood}
            onChange={setAnimalFood}
            onSave={handleSaveAnimalFood}
            status={sectionStatus["ANIMAL_FOOD"]}
            lastSavedAt={sectionSavedAt["ANIMAL_FOOD"]}
            isDirty={isAnimalFoodDirty}
            saveLabel="Save Animal Food ✓"
            catalogItems={catalogItems}
            showDiscount={true}
            isLocked={isSettled}
          />

          {/* 9. Prescribed Food (§10, Phase 7) */}
          <InventoryItemSection
            id="sec-prescribed-food"
            section="PRESCRIBED_FOOD"
            title="Prescribed Veterinary Diet"
            subtitle="Therapeutic nutrition (e.g. Renal, Gastrointestinal, Hypoallergenic)"
            icon={<Utensils className="size-4 text-orange-600" />}
            catalogueType="food"
            items={prescribedFood}
            onChange={setPrescribedFood}
            onSave={handleSavePrescribedFood}
            status={sectionStatus["PRESCRIBED_FOOD"]}
            lastSavedAt={sectionSavedAt["PRESCRIBED_FOOD"]}
            isDirty={isPrescribedFoodDirty}
            saveLabel="Save Prescribed Diet ✓"
            catalogItems={catalogItems}
            showDosage={true}
            showDiscount={true}
            isLocked={isSettled}
          />

          {/* 10. Accessories (§10, Phase 7) */}
          <InventoryItemSection
            id="sec-accessories"
            section="ACCESSORY"
            title="Pet Care Accessories"
            subtitle="Collars, leashes, harnesses, bowls, hygiene items & gear"
            icon={<ShoppingBag className="size-4 text-pink-600" />}
            catalogueType="accessory"
            items={accessories}
            onChange={setAccessories}
            onSave={handleSaveAccessories}
            status={sectionStatus["ACCESSORY"]}
            lastSavedAt={sectionSavedAt["ACCESSORY"]}
            isDirty={isAccessoryDirty}
            saveLabel="Save Accessories ✓"
            catalogItems={catalogItems}
            showDiscount={true}
            isLocked={isSettled}
          />
        </div>

        {/* Right Column: Live Prescribed Items Summary (§1.7, §13.1) */}
        <div className="space-y-4">
          <LivePrescriptionSummaryPanel
            consultationFee={consultationFee}
            immediateMedicines={immediateMedicines}
            prescribedMedicines={prescribedMedicines}
            injectables={injectables}
            animalFood={animalFood}
            prescribedFood={prescribedFood}
            accessories={accessories}
            hasUnsavedChanges={hasAnyDirtySection}
            isSavingAll={isSavingAll}
            onSaveAllDraft={handleSaveAllDraft}
            onProceedToBilling={handleProceed}
            onClonePrevious={onClonePrevious}
            onViewHistory={onViewHistory}
            isSettled={isSettled}
            settledDate={visit?.date}
          />
        </div>
      </div>
    </div>
  );
}
