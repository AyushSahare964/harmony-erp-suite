import React, { useState, useMemo, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useErp } from "@/lib/erp/store";
import { getItemsFn } from "@/lib/mongodb/serverFns/inventory";
import { finalizeVisitAndBillFn, getLatestVisitFn, getPatientHistoryFn } from "@/lib/mongodb/serverFns/clinical";
import { PrescriptionPrintView } from "./PrescriptionPrintView";
import { InvoicePrintView } from "./InvoicePrintView";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { getPetFn } from "@/lib/mongodb/serverFns/crm";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { calcLineItem, calcBillSummary, validateDiscount } from "@/lib/utils/moneyUtils";

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
}

const FALLBACK_CATALOG = [
  { itemCode: "M-0001", name: "Amoxicillin 250mg", defaultSalePrice: 24, gstRate: 12, lineType: "Pharmacy", category: "Medicine" },
  { itemCode: "M-0002", name: "Rabies Vaccine 1ml", defaultSalePrice: 480, gstRate: 5, lineType: "Vaccine", category: "Medicine" },
  { itemCode: "M-0003", name: "IV Fluid RL 500ml", defaultSalePrice: 65, gstRate: 12, lineType: "Pharmacy", category: "Medicine" },
  { itemCode: "M-0004", name: "Dexamethasone 4mg", defaultSalePrice: 95, gstRate: 12, lineType: "Pharmacy", category: "Medicine" },
  { itemCode: "M-0005", name: "Royal Canin Maxi 4kg", brand: "Royal Canin", defaultSalePrice: 1850, gstRate: 18, lineType: "Pharmacy", category: "Animal Food", unit: "Box" },
  { itemCode: "M-0006", name: "Tick & Flea Collar (L)", brand: "PawShield", defaultSalePrice: 320, gstRate: 18, lineType: "Pharmacy", category: "Animal Accessories", subGroup: "Collars & Leashes", unit: "Piece" },
  { itemCode: "M-0007", name: "Meloxicam Injection 10ml", defaultSalePrice: 150, gstRate: 12, lineType: "Pharmacy", category: "Medicine" },
  { itemCode: "M-0008", name: "Cefpet Dry Syrup 30ml", defaultSalePrice: 220, gstRate: 12, lineType: "Pharmacy", category: "Medicine" },
  { itemCode: "M-0010", name: "Grooming Shampoo 500ml", defaultSalePrice: 390, gstRate: 18, lineType: "Pharmacy", category: "Animal Accessories", subGroup: "Grooming", unit: "Bottle" },
  { itemCode: "M-0011", name: "Ergonomic Padded Dog Harness (L)", brand: "PawShield", defaultSalePrice: 1250, gstRate: 18, lineType: "Pharmacy", category: "Animal Accessories", subGroup: "Collars & Leashes", unit: "Piece" },
  { itemCode: "M-0012", name: "Nylon Training Leash 6ft (Reflective)", brand: "PawShield", defaultSalePrice: 450, gstRate: 18, lineType: "Pharmacy", category: "Animal Accessories", subGroup: "Collars & Leashes", unit: "Piece" },
  { itemCode: "M-0013", name: "Hooded Feline Litter Box (Anti-Odour)", brand: "PurrClean", defaultSalePrice: 1850, gstRate: 18, lineType: "Pharmacy", category: "Animal Accessories", subGroup: "Housing/Cages", unit: "Unit" },
  { itemCode: "M-0014", name: "Orthopedic Memory Foam Pet Bed (XL)", brand: "ComfyPaws", defaultSalePrice: 3200, gstRate: 18, lineType: "Pharmacy", category: "Animal Accessories", subGroup: "Other", unit: "Piece" },
  { itemCode: "M-0015", name: "Stainless Steel Anti-Skid Feeding Bowl", brand: "DinePaws", defaultSalePrice: 650, gstRate: 18, lineType: "Pharmacy", category: "Animal Accessories", subGroup: "Other", unit: "Unit" },
  { itemCode: "M-0016", name: "Pedigree Adult Chicken & Vegetables 3kg", brand: "Pedigree", defaultSalePrice: 750, gstRate: 18, lineType: "Pharmacy", category: "Animal Food", unit: "Bag" },
  { itemCode: "M-0017", name: "Farmina N&D Grain-Free Pumpkin Puppy 2.5kg", brand: "Farmina", defaultSalePrice: 2400, gstRate: 18, lineType: "Pharmacy", category: "Animal Food", unit: "Bag" },
  { itemCode: "M-0018", name: "Whiskas Ocean Fish Adult Cat Food 1.2kg", brand: "Whiskas", defaultSalePrice: 480, gstRate: 18, lineType: "Pharmacy", category: "Animal Food", unit: "Bag" },
];

export function VisitWorkspaceModal({ open, onClose, visit, onVisitFinalized }: VisitWorkspaceProps) {
  const { currentUser, role } = useErp();
  const activeDoctorName = visit?.doctorName || currentUser?.fullName || role?.person || "Dr. Rohit Sharma";

  const [catalogItems, setCatalogItems] = useState<any[]>(FALLBACK_CATALOG);
  const [petDetails, setPetDetails] = useState<any>(null);

  const [tab, setTab] = useState<"consultation" | "billing" | "completed">("consultation");
  
  // Vitals & Clinical Form
  const [weightKg, setWeightKg] = useState(visit?.vitals?.weightKg ? String(visit.vitals.weightKg) : "24.5");
  const [tempC, setTempC] = useState(visit?.vitals?.tempC ? String(visit.vitals.tempC) : "38.5");
  const [complaint, setComplaint] = useState(visit?.vitals?.complaint || "Routine consultation and health review");
  const [diagnosis, setDiagnosis] = useState(visit?.diagnosis || "");
  const [clinicalNotes, setClinicalNotes] = useState(visit?.clinicalNotes || "");
  
  // Reminders
  const [nextVisitDate, setNextVisitDate] = useState(visit?.nextVisitDate || "");
  const [nextDewormingDate, setNextDewormingDate] = useState(visit?.nextDewormingDate || "");

  // Extended Records
  const [vaccineRecords, setVaccineRecords] = useState<{ id: string; type: string; dateGiven: string; nextDueDate: string; price?: number }[]>([]);
  const [bloodTests, setBloodTests] = useState<{ id: string, testType: string, status: string }[]>([]);
  const [foodPurchases, setFoodPurchases] = useState<{ id: string, name: string, quantity: number }[]>([]);

  // Previous History Panel
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyVisits, setHistoryVisits] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
      if (visit?.petId) void loadPetDetails(visit.petId);
      if (visit?.petId || visit?.petName) void loadPatientHistory();
    }
  }, [open, visit?.petId, visit?.petName]);

  const loadCatalog = async () => {
    try {
      const items = await getItemsFn();
      if (items && items.length > 0) {
        setCatalogItems(items);
      }
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
      setComplaint(visit?.vitals?.complaint || "Routine consultation and health review");
      setDiagnosis(visit?.diagnosis || "");
      setClinicalNotes(visit?.clinicalNotes || "");
      setNextVisitDate(visit?.nextVisitDate || "");
      setNextDewormingDate(visit?.nextDewormingDate || "");
      if (visit.items && visit.items.length > 0) {
        setLines(visit.items.map((it: any, idx: number) => ({ ...it, id: String(idx + 1) })));
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
      if (!latestVisit || !latestVisit.items || latestVisit.items.length === 0) {
        toast.info("No previous treatments found to clone.");
        return;
      }
      const existingLineIds = new Set(lines.map(l => l.itemCode));
      const clonedItems = latestVisit.items
        .filter((it: any) => it.lineType === "Medicine" && !existingLineIds.has(it.itemCode))
        .map((it: any) => ({
          ...it,
          id: Math.random().toString(),
        }));
      
      if (clonedItems.length === 0) {
        toast.info("Previous medicines are already added.");
        return;
      }
      setLines(prev => [...prev, ...clonedItems]);
      toast.success(`Cloned ${clonedItems.length} previous medicine(s).`);
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

  // Dynamic Financial Computations — decimal-safe (REQ-DISC-04, moneyUtils)
  const billSummary = useMemo(() => {
    const applyGst = billType === "GST";
    const result = calcBillSummary(
      lines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: l.discountType || "percentage",
        discountValue: l.discountValue ?? l.discountPercent ?? 0,
        gstRate: l.gstRate,
      })),
      applyGst
    );
    return {
      subtotal: result.subtotal,
      taxableAmount: result.subtotal,
      gstAmount: result.totalGst,
      roundOff: result.roundOff,
      totalAmount: result.roundedTotal,
    };
  }, [lines, billType]);

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
        gstRate: selectedMedicine.gstRate || 5,
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
        nextDewormingDate: nextDewormingDate || undefined,
        items: lines.map((l) => {
          const applyGst = billType === "GST";
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
            lineTotal: calc.lineTotal,
          };
        }),
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

        {/* ── Main Scrollable Body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === "consultation" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Vitals, Diagnosis & Medicine Picker */}
              <div className="lg:col-span-2 space-y-5">
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
                        * Avoid prescribing contra-indicated drugs or administering allergen vaccines to this patient.
                      </p>
                    </div>
                  </div>
                )}

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
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <p className="section-label mb-0">Prescribe Medicines &amp; Vaccines (Live Inventory)</p>
                    <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {filteredCatalog.length} items available
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 relative">
                      <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>Search Product Catalog</span>
                        <span className="text-[10px] text-primary font-semibold">Dynamic Auto-search</span>
                      </Label>
                      <div className="relative">
                        <Input
                          placeholder="🔍 Start typing medicine name (e.g. Amox, Rabies)..."
                          value={medSearchQuery}
                          onChange={(e) => setMedSearchQuery(e.target.value)}
                          className="h-9 text-xs bg-background pr-8 font-medium"
                        />
                        {medSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setMedSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            ✕
                          </button>
                        )}
                        {/* Dynamic Instant Search Results Floating Dropdown */}
                        {medSearchQuery.trim().length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto rounded-xl border border-primary/40 bg-card p-1 shadow-xl">
                            {filteredCatalog.length === 0 ? (
                              <p className="p-2 text-[11px] text-muted-foreground italic text-center">No matching medicines found.</p>
                            ) : (
                              filteredCatalog.map((m: any) => (
                                <button
                                  key={m.itemCode}
                                  type="button"
                                  onClick={() => {
                                    setSelectedMedicine(m);
                                    setMedSearchQuery(m.name);
                                  }}
                                  className="w-full text-left p-2 hover:bg-primary/10 rounded-lg flex items-center justify-between text-xs transition-colors border-b border-border/30 last:border-0"
                                >
                                  <div>
                                    <p className="font-bold text-foreground">{m.name}</p>
                                    <span className="text-[10px] font-mono text-muted-foreground">{m.itemCode}</span>
                                  </div>
                                  <span className="font-mono font-bold text-primary text-xs">₹{m.defaultSalePrice || 250}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <Select
                        value={selectedMedicine?.itemCode || ""}
                        onValueChange={(code) => {
                          const m = catalogItems.find((x: any) => x.itemCode === code);
                          setSelectedMedicine(m || null);
                          if (m) setMedSearchQuery(m.name);
                        }}
                      >
                        <SelectTrigger className="text-xs h-9 bg-card">
                          <SelectValue placeholder="Or choose from medicine catalog dropdown..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {filteredCatalog.map((m: any) => (
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

                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Quantity &amp; Dosage Instructions</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={itemQty}
                          onChange={(e) => setItemQty(Number(e.target.value))}
                          className="w-16 h-9 text-xs font-mono text-center"
                        />
                        <Input
                          placeholder="e.g. 1 tab BID x 5 days"
                          value={dosageText}
                          onChange={(e) => setDosageText(e.target.value)}
                          className="flex-1 h-9 text-xs"
                        />
                        <Button size="sm" onClick={handleAddMedicineFromCatalog} className="h-9 px-3.5 font-bold">
                          <Plus className="size-4" /> Add
                        </Button>
                      </div>
                      {selectedMedicine && (
                        <div className="text-[11px] text-primary bg-primary/10 px-2.5 py-1 rounded-md font-medium flex items-center justify-between border border-primary/20">
                          <span>Selected: <strong className="font-bold">{selectedMedicine.name}</strong></span>
                          <span className="font-mono font-bold">₹{selectedMedicine.defaultSalePrice || 250}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Added Prescribed Medicines List (Immediately Below Entry Field) */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <span>💊 Prescribed Medicines List</span>
                        <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary">
                          {lines.filter((l) => l.lineType === "Pharmacy").length} prescribed
                        </Badge>
                      </p>
                      <span className="text-[10px] text-muted-foreground">Displayed directly below entry field</span>
                    </div>

                    {lines.filter((l) => l.lineType === "Pharmacy").length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic text-center py-2 bg-muted/20 rounded-lg">No medicines added to prescription yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {lines
                          .filter((l) => l.lineType === "Pharmacy")
                          .map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/80 text-xs shadow-2xs">
                              <div>
                                <p className="font-bold text-foreground">{m.name}</p>
                                {m.dosageInstructions && (
                                  <p className="text-[10px] text-primary font-medium mt-0.5">Dosage: {m.dosageInstructions}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-muted-foreground font-mono">Qty: {m.quantity} × ₹{m.unitPrice}</span>
                                <span className="font-mono font-bold text-foreground">₹{m.quantity * m.unitPrice}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(m.id)}
                                  className="text-muted-foreground hover:text-destructive p-1"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Add Clinical Procedures */}
                  <div className="pt-2 flex flex-wrap gap-2 items-center border-t border-border/40">
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex justify-between">
                        <span>Next Visit Date</span>
                        <Select onValueChange={(val) => {
                          const date = new Date();
                          if (val === "1") date.setDate(date.getDate() + 1);
                          else if (val === "2") date.setDate(date.getDate() + 2);
                          else if (val === "5") date.setDate(date.getDate() + 5);
                          else if (val === "7") date.setDate(date.getDate() + 7);
                          else if (val === "30") date.setMonth(date.getMonth() + 1);
                          setNextVisitDate(date.toISOString().slice(0, 10));
                        }}>
                          <SelectTrigger className="h-4 w-20 text-[9px] border-none bg-muted/40 p-0 px-1 shadow-none focus:ring-0">
                            <SelectValue placeholder="Quick Date" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Tomorrow</SelectItem>
                            <SelectItem value="2">Day After</SelectItem>
                            <SelectItem value="5">After 5 Days</SelectItem>
                            <SelectItem value="7">After 7 Days</SelectItem>
                            <SelectItem value="30">After 1 Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </Label>
                      <Input type="date" value={nextVisitDate} onChange={(e) => setNextVisitDate(e.target.value)} className="h-8 text-xs font-semibold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex justify-between">
                        <span>Next Deworming Due</span>
                        <Select onValueChange={(val) => {
                          const date = new Date();
                          if (val === "15") date.setDate(date.getDate() + 15);
                          else if (val === "30") date.setMonth(date.getMonth() + 1);
                          else if (val === "90") date.setMonth(date.getMonth() + 3);
                          setNextDewormingDate(date.toISOString().slice(0, 10));
                        }}>
                          <SelectTrigger className="h-4 w-20 text-[9px] border-none bg-muted/40 p-0 px-1 shadow-none focus:ring-0">
                            <SelectValue placeholder="Quick Date" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">After 15 Days</SelectItem>
                            <SelectItem value="30">After 30 Days</SelectItem>
                            <SelectItem value="90">After 3 Months</SelectItem>
                          </SelectContent>
                        </Select>
                      </Label>
                      <Input type="date" value={nextDewormingDate} onChange={(e) => setNextDewormingDate(e.target.value)} className="h-8 text-xs font-semibold" />
                    </div>
                  </div>
                </div>

                {/* Vaccines Records Section */}
                <div className="erp-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <p className="section-label mb-0">Vaccine Records Entry</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] font-bold border-blue-500/40 text-blue-700 hover:bg-blue-50 dark:text-blue-300 shadow-2xs gap-1"
                      onClick={handleAddVaccineRecord}
                    >
                      <Plus className="size-3.5 text-blue-600" /> Add Vaccine
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {vaccineRecords.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-2 bg-muted/20 rounded-lg">
                        Click "+ Add Vaccine" to record a vaccination &amp; automatically add to billing.
                      </p>
                    )}
                    {vaccineRecords.map((vr) => (
                      <div key={vr.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border border-border/60 bg-muted/10 p-2.5 rounded-lg text-xs">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-semibold">Vaccine Type</Label>
                          <Select value={vr.type} onValueChange={(v) => handleUpdateVaccineType(vr.id, v)}>
                            <SelectTrigger className="h-7 text-[11px] bg-card"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Anti-rabies">Anti-rabies (Rabisin) — ₹350</SelectItem>
                              <SelectItem value="All-in-1">All-in-1 (DHPPi/L 9-in-1) — ₹450</SelectItem>
                              <SelectItem value="Kennel Cough">Kennel Cough (KC) — ₹400</SelectItem>
                              <SelectItem value="Feline Tri-cat">Feline Tri-cat — ₹550</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-semibold">Date Given</Label>
                          <Input type="date" value={vr.dateGiven} onChange={(e) => setVaccineRecords(vaccineRecords.map(r => r.id === vr.id ? { ...r, dateGiven: e.target.value } : r))} className="h-7 text-[11px] bg-card font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground flex justify-between font-semibold">
                            <span>Next Due</span>
                            <Select onValueChange={(val) => {
                              const date = new Date(vr.dateGiven || new Date());
                              if (val === "30") date.setMonth(date.getMonth() + 1);
                              else if (val === "365") date.setFullYear(date.getFullYear() + 1);
                              setVaccineRecords(vaccineRecords.map(r => r.id === vr.id ? { ...r, nextDueDate: date.toISOString().slice(0, 10) } : r));
                            }}>
                              <SelectTrigger className="h-4 w-12 text-[8px] border-none bg-muted/40 p-0 px-1 shadow-none focus:ring-0"><SelectValue placeholder="Quick" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">1 Mo</SelectItem>
                                <SelectItem value="365">1 Yr</SelectItem>
                              </SelectContent>
                            </Select>
                          </Label>
                          <Input type="date" value={vr.nextDueDate} onChange={(e) => setVaccineRecords(vaccineRecords.map(r => r.id === vr.id ? { ...r, nextDueDate: e.target.value } : r))} className="h-7 text-[11px] bg-card font-mono" />
                        </div>
                        <div className="pb-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveVaccineRecord(vr.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Added Vaccine Records List (Immediately Below Entry Field & Synced with Billing) */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <span>💉 ADDED VACCINES LIST</span>
                        <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200 font-bold">
                          {vaccineRecords.length} RECORDED
                        </Badge>
                      </p>
                      <span className="text-[10px] text-muted-foreground">Displayed directly below entry field</span>
                    </div>

                    {vaccineRecords.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic text-center py-2.5 bg-muted/20 rounded-lg">No vaccines recorded yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {vaccineRecords.map((vr) => (
                          <div key={vr.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs shadow-2xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-extrabold text-blue-700 dark:text-blue-300 text-xs flex items-center gap-1.5">
                                  <CheckCircle2 className="size-4 text-blue-600" /> {vr.type}
                                </p>
                                <Badge variant="outline" className="text-[9px] font-mono bg-emerald-50 text-emerald-700 border-emerald-300 font-extrabold">
                                  ₹{vr.price || DEFAULT_VACCINE_PRICES[vr.type] || 350} (Added to Billing)
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground font-mono">
                                Date Given: <strong className="text-foreground">{vr.dateGiven}</strong>
                                {vr.nextDueDate ? <> · Next Due: <strong className="text-blue-600 font-bold">{vr.nextDueDate}</strong></> : ""}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveVaccineRecord(vr.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Blood Tests Redesigned Card */}
                <div className="erp-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <p className="section-label mb-0">Blood Tests &amp; Diagnostics</p>
                    <span className="text-[10px] font-mono font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                      {bloodTests.length} ordered
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={newBloodTestType} onValueChange={setNewBloodTestType}>
                      <SelectTrigger className="h-8 text-xs flex-1 bg-card">
                        <SelectValue placeholder="Select diagnostic test..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CBC (Complete Blood Count)">CBC (Complete Blood Count)</SelectItem>
                        <SelectItem value="LFT / KFT (Liver & Kidney Panel)">LFT / KFT (Liver &amp; Kidney Panel)</SelectItem>
                        <SelectItem value="Electrolytes & Blood Gas">Electrolytes &amp; Blood Gas</SelectItem>
                        <SelectItem value="Thyroid T4 / TSH Panel">Thyroid T4 / TSH Panel</SelectItem>
                        <SelectItem value="TGH / Blood Smear Examination">TGH / Blood Smear Examination</SelectItem>
                        <SelectItem value="Parvovirus / Distemper Rapid Snap">Parvovirus / Distemper Rapid Snap</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddBloodTest}
                      className="h-8 text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
                    >
                      <Plus className="size-3.5 mr-1" /> Order Test
                    </Button>
                  </div>

                  <div className="space-y-2 pt-1 max-h-40 overflow-y-auto">
                    {bloodTests.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic text-center py-2">No diagnostic tests ordered for this visit.</p>
                    )}
                    {bloodTests.map((bt) => (
                      <div key={bt.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/20 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">{bt.testType}</p>
                          <span className="text-[10px] font-mono text-muted-foreground">REF: {bt.id.slice(-6).toUpperCase()}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select value={bt.status} onValueChange={(v) => setBloodTests(bloodTests.map(t => t.id === bt.id ? { ...t, status: v } : t))}>
                            <SelectTrigger className="h-7 w-28 text-[10px] font-semibold bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Ordered">⌛ Ordered</SelectItem>
                              <SelectItem value="Sample Collected">🧪 Sample Collected</SelectItem>
                              <SelectItem value="Processing">🔬 Processing</SelectItem>
                              <SelectItem value="Completed">✓ Completed</SelectItem>
                            </SelectContent>
                          </Select>

                          <button
                            type="button"
                            onClick={() => setBloodTests(bloodTests.filter(t => t.id !== bt.id))}
                            className="text-muted-foreground hover:text-destructive p-1"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Main Category Card: Animal Food & Accessories (Live Inventory Linked) ── */}
                <div className="erp-card p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📦</span>
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">Animal Food &amp; Accessories</h3>
                        <p className="text-[10px] text-muted-foreground">Select pet nutrition supplies, dietary food, or accessories from Live Inventory</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary shrink-0">
                      {foodItems.length + accessoryItems.length} Total Items
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Subsection 1: Animal Food */}
                    <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🥣</span>
                          <div>
                            <p className="font-bold text-xs text-foreground uppercase tracking-wide">1. Animal Food</p>
                            <p className="text-[9px] text-muted-foreground">Directly linked to Live Food Inventory</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomFood(!isCustomFood);
                              setSelectedFood(null);
                            }}
                            className="text-[10px] text-primary hover:underline font-semibold"
                          >
                            {isCustomFood ? "← From Inventory" : "+ Custom Food"}
                          </button>
                          <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {foodItems.length} items
                          </span>
                        </div>
                      </div>

                      {!isCustomFood ? (
                        <div className="space-y-2">
                          {/* Live Food Catalog Search Input with Auto-search Floating Dropdown */}
                          <div className="relative">
                            <div className="relative">
                              <Input
                                placeholder="🔍 Start typing pet food / diet (e.g. Royal Canin)..."
                                value={foodSearchQuery}
                                onChange={(e) => {
                                  setFoodSearchQuery(e.target.value);
                                  setSelectedFood(null);
                                }}
                                className="h-8 text-xs bg-card pr-7"
                              />
                              {foodSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFoodSearchQuery("");
                                    setSelectedFood(null);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            {/* Floating Dropdown */}
                            {foodSearchQuery.trim().length > 0 && !selectedFood && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-primary/40 bg-card p-1 shadow-xl">
                                {filteredFoodCatalog.length === 0 ? (
                                  <p className="p-2 text-[11px] text-muted-foreground italic text-center">
                                    No food found in inventory. Click "+ Custom Food" to enter custom item.
                                  </p>
                                ) : (
                                  filteredFoodCatalog.map((m: any) => (
                                    <button
                                      key={m.itemCode}
                                      type="button"
                                      onClick={() => {
                                        setSelectedFood(m);
                                        setFoodSearchQuery(m.name);
                                        setNewFoodPrice(m.defaultSalePrice || 1850);
                                      }}
                                      className="w-full text-left p-1.5 hover:bg-primary/10 rounded-lg flex items-center justify-between text-xs transition-colors border-b border-border/30 last:border-0"
                                    >
                                      <div className="min-w-0 pr-2">
                                        <p className="font-bold text-foreground truncate">{m.name}</p>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          {m.brand || m.unit || "Pack"} · {m.itemCode}
                                        </span>
                                      </div>
                                      <span className="font-mono font-bold text-primary text-xs shrink-0">
                                        ₹{m.defaultSalePrice || 1850}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          {/* Secondary Select Dropdown */}
                          <Select
                            value={selectedFood?.itemCode || ""}
                            onValueChange={(code) => {
                              const found = catalogItems.find((x: any) => x.itemCode === code);
                              if (found) {
                                setSelectedFood(found);
                                setFoodSearchQuery(found.name);
                                setNewFoodPrice(found.defaultSalePrice || 1850);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-card">
                              <SelectValue placeholder="Or select food from catalog dropdown..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-48">
                              {foodCatalog.map((f: any) => (
                                <SelectItem key={f.itemCode} value={f.itemCode}>
                                  <div className="flex items-center justify-between w-full gap-2">
                                    <span>{f.name}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      ₹{f.defaultSalePrice || 1850}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        /* Custom Free Entry */
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Input
                            placeholder="Custom Food Name (e.g. Hill's Science)"
                            value={customFoodName}
                            onChange={(e) => setCustomFoodName(e.target.value)}
                            className="sm:col-span-2 h-8 text-xs bg-card"
                          />
                          <Input
                            placeholder="Pack (e.g. 3kg)"
                            value={customFoodPack}
                            onChange={(e) => setCustomFoodPack(e.target.value)}
                            className="h-8 text-xs bg-card"
                          />
                        </div>
                      )}

                      {/* Controls Row: Qty, Price, Discount Toggle and Add Button */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Label className="text-[11px] text-muted-foreground shrink-0">Qty:</Label>
                          <Input
                            type="number"
                            min={1}
                            value={newFoodQty}
                            onChange={(e) => setNewFoodQty(Number(e.target.value))}
                            className="h-8 w-12 text-xs font-mono text-center bg-card px-1"
                          />
                          <Label className="text-[11px] text-muted-foreground ml-1 shrink-0">Price (₹):</Label>
                          <Input
                            type="number"
                            min={0}
                            value={newFoodPrice}
                            onChange={(e) => setNewFoodPrice(Number(e.target.value))}
                            className="h-8 w-20 text-xs font-mono bg-card px-2"
                          />
                          {/* Discount Toggle */}
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => setNewFoodDiscType(newFoodDiscType === "percentage" ? "fixed" : "percentage")}
                              className="h-7 px-2 text-[10px] font-bold rounded border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors shrink-0"
                              title="Toggle discount type"
                            >
                              {newFoodDiscType === "percentage" ? "Disc %" : "Disc ₹"}
                            </button>
                            <Input
                              type="number"
                              min={0}
                              max={newFoodDiscType === "percentage" ? 100 : undefined}
                              value={newFoodDiscValue}
                              onChange={(e) => setNewFoodDiscValue(Number(e.target.value))}
                              className="h-7 w-14 text-xs font-mono bg-card text-center"
                              placeholder={newFoodDiscType === "percentage" ? "0%" : "₹0"}
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddFoodItem}
                          className="h-8 text-xs font-bold border-primary/30 text-primary hover:bg-primary hover:text-white shrink-0 ml-auto"
                        >
                          <Plus className="size-3.5 mr-1" /> Add Food
                        </Button>
                      </div>

                      {/* Food Items List */}
                      <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                        {foodItems.length === 0 && (
                          <p className="text-[11px] text-muted-foreground italic text-center py-2">No food items added.</p>
                        )}
                        {foodItems.map((fi) => {
                          const base = fi.price * fi.quantity;
                          const discVal = fi.discountValue || 0;
                          const disc = fi.discountType === "percentage"
                            ? (base * discVal / 100)
                            : Math.min(discVal, base);
                          const net = base - disc;
                          return (
                            <div key={fi.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60 text-xs">
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-foreground truncate">{fi.name}</p>
                                <p className="text-[10px] text-muted-foreground">{fi.packSize} · Qty: {fi.quantity} {fi.itemCode && `· ${fi.itemCode}`}</p>
                                {discVal > 0 && (
                                  <p className="text-[10px] text-emerald-600 font-medium">
                                    Disc: {fi.discountType === "percentage" ? `${discVal}%` : `₹${discVal}`} (−₹{disc.toFixed(2)})
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  {discVal > 0 && (
                                    <p className="text-[10px] text-muted-foreground line-through">₹{base.toFixed(2)}</p>
                                  )}
                                  <span className="font-mono font-bold text-primary">₹{net.toFixed(2)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFoodItem(fi.id)}
                                  className="text-muted-foreground hover:text-destructive p-0.5"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                      </div>

                    </div>

                    {/* Subsection 2: Accessories */}
                    <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🎾</span>
                          <div>
                            <p className="font-bold text-xs text-foreground uppercase tracking-wide">2. Accessories</p>
                            <p className="text-[9px] text-muted-foreground">Directly linked to Live Accessories Inventory</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomAcc(!isCustomAcc);
                              setSelectedAcc(null);
                            }}
                            className="text-[10px] text-primary hover:underline font-semibold"
                          >
                            {isCustomAcc ? "← From Inventory" : "+ Custom Item"}
                          </button>
                          <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {accessoryItems.length} items
                          </span>
                        </div>
                      </div>

                      {!isCustomAcc ? (
                        <div className="space-y-2">
                          {/* Live Accessories Catalog Search Input with Auto-search Floating Dropdown */}
                          <div className="relative">
                            <div className="relative">
                              <Input
                                placeholder="🔍 Start typing accessory (e.g. Collar, Leash, Harness)..."
                                value={accSearchQuery}
                                onChange={(e) => {
                                  setAccSearchQuery(e.target.value);
                                  setSelectedAcc(null);
                                }}
                                className="h-8 text-xs bg-card pr-7"
                              />
                              {accSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAccSearchQuery("");
                                    setSelectedAcc(null);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            {/* Floating Dropdown */}
                            {accSearchQuery.trim().length > 0 && !selectedAcc && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-primary/40 bg-card p-1 shadow-xl">
                                {filteredAccessoryCatalog.length === 0 ? (
                                  <p className="p-2 text-[11px] text-muted-foreground italic text-center">
                                    No accessory found. Click "+ Custom Item" to enter custom accessory.
                                  </p>
                                ) : (
                                  filteredAccessoryCatalog.map((m: any) => (
                                    <button
                                      key={m.itemCode}
                                      type="button"
                                      onClick={() => {
                                        setSelectedAcc(m);
                                        setAccSearchQuery(m.name);
                                        setNewAccPrice(m.defaultSalePrice || 320);
                                      }}
                                      className="w-full text-left p-1.5 hover:bg-primary/10 rounded-lg flex items-center justify-between text-xs transition-colors border-b border-border/30 last:border-0"
                                    >
                                      <div className="min-w-0 pr-2">
                                        <p className="font-bold text-foreground truncate">{m.name}</p>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          {m.subGroup || m.category || "Accessory"} · {m.itemCode}
                                        </span>
                                      </div>
                                      <span className="font-mono font-bold text-primary text-xs shrink-0">
                                        ₹{m.defaultSalePrice || 320}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          {/* Secondary Select Dropdown */}
                          <Select
                            value={selectedAcc?.itemCode || ""}
                            onValueChange={(code) => {
                              const found = catalogItems.find((x: any) => x.itemCode === code);
                              if (found) {
                                setSelectedAcc(found);
                                setAccSearchQuery(found.name);
                                setNewAccPrice(found.defaultSalePrice || 320);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-card">
                              <SelectValue placeholder="Or select accessory from catalog dropdown..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-48">
                              {accessoryCatalog.map((a: any) => (
                                <SelectItem key={a.itemCode} value={a.itemCode}>
                                  <div className="flex items-center justify-between w-full gap-2">
                                    <span>{a.name}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      ₹{a.defaultSalePrice || 320}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        /* Custom Free Entry */
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                          <Input
                            placeholder="Custom Accessory Name (e.g. Velvet Collar)"
                            value={customAccName}
                            onChange={(e) => setCustomAccName(e.target.value)}
                            className="sm:col-span-3 h-8 text-xs bg-card"
                          />
                          <Select value={customAccCat} onValueChange={setCustomAccCat}>
                            <SelectTrigger className="sm:col-span-2 h-8 text-xs bg-card">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Collars & Leashes">Collars &amp; Leashes</SelectItem>
                              <SelectItem value="Grooming">Grooming Tools</SelectItem>
                              <SelectItem value="Toys">Toys &amp; Chews</SelectItem>
                              <SelectItem value="Housing/Cages">Housing / Cages</SelectItem>
                              <SelectItem value="Other">Other Supplies</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Controls Row: Qty, Price, Discount Toggle and Add Button */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Label className="text-[11px] text-muted-foreground shrink-0">Qty:</Label>
                          <Input
                            type="number"
                            min={1}
                            value={newAccQty}
                            onChange={(e) => setNewAccQty(Number(e.target.value))}
                            className="h-8 w-12 text-xs font-mono text-center bg-card px-1"
                          />
                          <Label className="text-[11px] text-muted-foreground ml-1 shrink-0">Price (₹):</Label>
                          <Input
                            type="number"
                            min={0}
                            value={newAccPrice}
                            onChange={(e) => setNewAccPrice(Number(e.target.value))}
                            className="h-8 w-20 text-xs font-mono bg-card px-2"
                          />
                          {/* Discount Toggle */}
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => setNewAccDiscType(newAccDiscType === "percentage" ? "fixed" : "percentage")}
                              className="h-7 px-2 text-[10px] font-bold rounded border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors shrink-0"
                              title="Toggle discount type"
                            >
                              {newAccDiscType === "percentage" ? "Disc %" : "Disc ₹"}
                            </button>
                            <Input
                              type="number"
                              min={0}
                              max={newAccDiscType === "percentage" ? 100 : undefined}
                              value={newAccDiscValue}
                              onChange={(e) => setNewAccDiscValue(Number(e.target.value))}
                              className="h-7 w-14 text-xs font-mono bg-card text-center"
                              placeholder={newAccDiscType === "percentage" ? "0%" : "₹0"}
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddAccessoryItem}
                          className="h-8 text-xs font-bold border-primary/30 text-primary hover:bg-primary hover:text-white shrink-0 ml-auto"
                        >
                          <Plus className="size-3.5 mr-1" /> Add Accessory
                        </Button>
                      </div>

                      {/* Accessories List */}
                      <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                        {accessoryItems.length === 0 && (
                          <p className="text-[11px] text-muted-foreground italic text-center py-2">No accessories added.</p>
                        )}
                        {accessoryItems.map((acc) => {
                          const base = acc.price * acc.quantity;
                          const discVal = acc.discountValue || 0;
                          const disc = acc.discountType === "percentage"
                            ? (base * discVal / 100)
                            : Math.min(discVal, base);
                          const net = base - disc;
                          return (
                            <div key={acc.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60 text-xs">
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-foreground truncate">{acc.name}</p>
                                <p className="text-[10px] text-muted-foreground">{acc.category} · Qty: {acc.quantity} {acc.itemCode && `· ${acc.itemCode}`}</p>
                                {discVal > 0 && (
                                  <p className="text-[10px] text-emerald-600 font-medium">
                                    Disc: {acc.discountType === "percentage" ? `${discVal}%` : `₹${discVal}`} (−₹{disc.toFixed(2)})
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  {discVal > 0 && (
                                    <p className="text-[10px] text-muted-foreground line-through">₹{base.toFixed(2)}</p>
                                  )}
                                  <span className="font-mono font-bold text-primary">₹{net.toFixed(2)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAccessoryItem(acc.id)}
                                  className="text-muted-foreground hover:text-destructive p-0.5"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: Live Prescription / Items Summary */}
              <div className="space-y-4">
                <div className="erp-card p-4 space-y-3">
                  <div className="border-b border-border pb-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-foreground">Prescribed Items ({lines.length})</p>
                      <span className="font-extrabold text-primary text-base font-mono">₹{billSummary.totalAmount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 flex-1 justify-center" onClick={handleCloneTreatment}>
                        <CheckCircle2 className="size-3 mr-1" /> Clone Previous
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground border border-border/40 flex-1 justify-center" onClick={handleViewHistory}>
                        <FileText className="size-3 mr-1" /> History
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {lines.map((l) => (
                      <div key={l.id} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-foreground block truncate">{l.name}</span>
                            <span className="inline-block mt-0.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {l.lineType}
                            </span>
                          </div>
                          <button onClick={() => handleRemoveLine(l.id)} className="text-muted-foreground hover:text-destructive shrink-0 p-1">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        {l.dosageInstructions && (
                          <p className="text-[11px] text-muted-foreground italic">
                            Dosage: {l.dosageInstructions}
                          </p>
                        )}

                        {/* Editable Fee & Quantity Controls */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/30 gap-2 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground shrink-0">Fee/Price:</span>
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
                          <span className="font-bold text-foreground font-mono text-xs ml-auto">₹{l.quantity * l.unitPrice}</span>
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

                      {hv.items && hv.items.length > 0 && (
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
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          🩺 {hv.doctorName || "Attending Vet"}
                        </span>
                        {hv.totalAmount > 0 && (
                          <span className="text-xs font-mono font-extrabold text-emerald-600">₹{hv.totalAmount}</span>
                        )}
                      </div>

                      {/* Re-order / Copy Previous Prescription Button */}
                      {hv.items && hv.items.length > 0 && (
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
