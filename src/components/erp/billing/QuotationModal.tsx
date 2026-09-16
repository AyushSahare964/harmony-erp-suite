import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  FileText,
  Plus,
  Trash2,
  Printer,
  Save,
  Calculator,
  Bell,
  Sparkles,
  Dog,
  Calendar,
  CheckCircle2,
  Search,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { createQuotationFn } from "@/lib/mongodb/serverFns/quotations";
import { BillingReminderModal } from "./BillingReminderModal";
import { todayIST } from "@/lib/utils/dateUtils";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";

export interface QuotationItem {
  id: string;
  serialNo: string;
  name: string;
  category: string;
  uom: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
  description?: string | undefined;
  lineTotal: number;
}

const INDIAN_STATES = [
  "Maharashtra",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Puducherry",
  "Other State / UT",
];

const COMMON_UOMS = [
  "SET",
  "NOS",
  "PCS",
  "BOTTLE",
  "STRIP",
  "VIAL",
  "TAB",
  "KG",
  "BOX",
  "GM",
  "ML",
  "PACK",
];

const ITEM_CATEGORIES = [
  { id: "ALL", label: "All Categories" },
  { id: "FOOD", label: "Pet Food & Diets" },
  { id: "MEDICINE", label: "Medicines & Rx" },
  { id: "ACCESSORY", label: "Accessories & Care" },
  { id: "SURGERY", label: "Surgery & Packages" },
  { id: "SERVICE", label: "Clinical Services" },
  { id: "DIAGNOSTIC", label: "Diagnostic Labs" },
];

const PRESET_QUOTATION_ITEMS = [
  { name: "Marvel Animal Food", rate: 400, category: "FOOD", uom: "SET", gst: 0, discount: 5, description: "Nutritional pet diet package" },
  { name: "Orthopedic Fracture Plating & GA Package", rate: 28000, category: "SURGERY", uom: "SET", gst: 18, discount: 0, description: "Complete plating with post-op recovery pack" },
  { name: "Canine Spay / Ovariohysterectomy (Complete)", rate: 7500, category: "SURGERY", uom: "SET", gst: 18, discount: 0, description: "Complete elective spay procedure" },
  { name: "Dental Scaling, Polishing & Extractions under GA", rate: 6500, category: "SERVICE", uom: "SET", gst: 18, discount: 0, description: "Ultrasonic scaling & polish" },
  { name: "Comprehensive Pre-Op Panel (CBC + LFT + KFT)", rate: 3200, category: "DIAGNOSTIC", uom: "SET", gst: 18, discount: 0, description: "Full bio-chemical blood workup" },
  { name: "Ultrasound Abdomen (Color Doppler Full Scan)", rate: 2500, category: "DIAGNOSTIC", uom: "SET", gst: 18, discount: 0, description: "High-resolution organ Doppler" },
  { name: "Specialist Senior Vet Consultation & Case Review", rate: 1000, category: "SERVICE", uom: "SET", gst: 18, discount: 0, description: "Comprehensive case evaluation" },
  { name: "ICU Oxygen & Critical Care Day Hospitalization", rate: 3500, category: "SERVICE", uom: "SET", gst: 18, discount: 0, description: "Continuous vital monitoring & oxygen" },
  { name: "Post-Op Injectable Antibiotics & Analgesic Pack", rate: 1850, category: "MEDICINE", uom: "SET", gst: 12, discount: 0, description: "Antibiotic & analgesic support" },
];

interface QuotationModalProps {
  open: boolean;
  onClose: () => void;
  onConvertToInvoice?: (quotationData: any) => void;
}

export function QuotationModal({ open, onClose, onConvertToInvoice }: QuotationModalProps) {
  // Quotation Information
  const [quotationNo, setQuotationNo] = useState("");
  const [quotationType, setQuotationType] = useState<"GST" | "Non-GST" | "Bill of Supply">("GST");
  const [date, setDate] = useState(todayIST());
  const [validUntil, setValidUntil] = useState("");
  const [linkTo, setLinkTo] = useState<"Counter Sale" | "Client Account" | "Patient CRM">("Counter Sale");
  const [mobileNo, setMobileNo] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
  const [clientGstin, setClientGstin] = useState("");

  // Patient / Pet link details
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("Canine");
  const [doctorName, setDoctorName] = useState("Dr. Rohit Sharma");
  const [showRegisterPetModal, setShowRegisterPetModal] = useState(false);

  // Particulars Active Entry State
  const [entryMode, setEntryMode] = useState<"tagging" | "itemCode">("tagging");
  const [itemCategory, setItemCategory] = useState("ALL");
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemUom, setItemUom] = useState("SET");
  const [quantity, setQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState<number>(400);
  const [discountPercent, setDiscountPercent] = useState<number>(5);
  const [itemGstRate, setItemGstRate] = useState<number>(0);
  const [itemDescription, setItemDescription] = useState("");

  // Custom Combobox Dropdown State
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const itemDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target as Node)) {
        setIsItemDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Particulars Table Items (Initialized matching reference screenshot)
  const [items, setItems] = useState<QuotationItem[]>([
    {
      id: "item_init_1",
      serialNo: "SR-001",
      name: "Marvel Animal Food",
      category: "FOOD",
      uom: "SET",
      quantity: 1,
      rate: 400,
      discountPercent: 5,
      gstRate: 0,
      description: "Nutritional pet diet package",
      lineTotal: 380,
    },
  ]);

  // Bottom Settings & Terms
  const [showShipping, setShowShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [showQuotationRef, setShowQuotationRef] = useState(false);
  const [quotationReference, setQuotationReference] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("Immediate delivery upon confirmation.");
  const [remarks, setRemarks] = useState("Prices are inclusive of standard handling.");

  // Reminder Modal
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize on modal open
  useEffect(() => {
    if (open) {
      const rnd = Math.floor(1000 + Math.random() * 9000);
      setQuotationNo(`QTN-2026-${rnd}`);
      const t = todayIST();
      setDate(t);

      // Default valid for 15 days
      const d = new Date();
      d.setDate(d.getDate() + 15);
      setValidUntil(d.toISOString().slice(0, 10));

      // Fetch registered pets
      listPetsWithOwnersFn()
        .then((data) => setPets(data || []))
        .catch((err) => console.error("Failed to load pets:", err));

      // Fetch inventory items
      getItemsFn({ data: { status: "Active" } })
        .then((data) => {
          if (data && data.length > 0) {
            setInventoryItems(data);
          }
        })
        .catch((err) => console.error("Failed to load inventory:", err));
    }
  }, [open]);

  // Auto-calculated current line amount
  const currentLineAmount = useMemo(() => {
    const gross = (quantity || 0) * (salePrice || 0);
    const disc = gross * ((discountPercent || 0) / 100);
    return Math.max(0, Math.round((gross - disc) * 100) / 100);
  }, [quantity, salePrice, discountPercent]);

  // Auto-generated next serial number
  const nextSerialNo = useMemo(() => {
    return `SR-${String(items.length + 1).padStart(3, "0")}`;
  }, [items.length]);

  // Combined inventory list + preset surgical & medical packages
  const filteredAvailableItems = useMemo(() => {
    const list: Array<{ name: string; rate: number; category: string; uom: string; gst: number; description?: string }> = [];

    // Add preset items
    PRESET_QUOTATION_ITEMS.forEach((p) => {
      if (itemCategory === "ALL" || p.category === itemCategory) {
        list.push({
          name: p.name,
          rate: p.rate,
          category: p.category,
          uom: p.uom,
          gst: p.gst,
          description: p.description,
        });
      }
    });

    // Add live inventory items
    inventoryItems.forEach((inv) => {
      let cat = "FOOD";
      if (inv.productType === "MEDICINE" || inv.category?.toLowerCase().includes("med")) cat = "MEDICINE";
      else if (inv.productType === "FOOD" || inv.category?.toLowerCase().includes("food")) cat = "FOOD";
      else if (inv.productType === "ACCESSORY") cat = "ACCESSORY";
      else if (inv.category?.toLowerCase().includes("serv")) cat = "SERVICE";
      else if (inv.category?.toLowerCase().includes("diag")) cat = "DIAGNOSTIC";
      else if (inv.category?.toLowerCase().includes("surg")) cat = "SURGERY";

      if (itemCategory === "ALL" || cat === itemCategory) {
        // avoid duplicating presets
        if (!list.some((existing) => existing.name.toLowerCase() === inv.name.toLowerCase())) {
          list.push({
            name: inv.name,
            rate: inv.defaultSalePrice || inv.mrp || 0,
            category: cat,
            uom: inv.salesUom || "PCS",
            gst: inv.isExempt ? 0 : 18,
            description: inv.description || "",
          });
        }
      }
    });

    return list;
  }, [itemCategory, inventoryItems]);

  const searchedItems = useMemo(() => {
    const q = itemName.trim().toLowerCase();
    if (!q) return filteredAvailableItems;
    return filteredAvailableItems.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        (it.description && it.description.toLowerCase().includes(q))
    );
  }, [itemName, filteredAvailableItems]);

  // When user selects an item from autocomplete or preset
  const handleSelectItem = (itemObj: { name: string; rate: number; category: string; uom: string; gst: number; description?: string }) => {
    setItemName(itemObj.name);
    setSalePrice(itemObj.rate || 0);
    setItemUom(itemObj.uom || "SET");
    setItemGstRate(quotationType === "Non-GST" ? 0 : itemObj.gst || 0);
    if (itemObj.description) {
      setItemDescription(itemObj.description);
    }
  };

  // Add line to table
  const handleAddLine = () => {
    if (!itemName.trim()) {
      toast.error("Please enter or select an Item Name first.");
      return;
    }
    if ((quantity || 0) <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    const gross = (quantity || 0) * (salePrice || 0);
    const disc = gross * ((discountPercent || 0) / 100);
    const net = gross - disc;

    const newItem: QuotationItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      serialNo: nextSerialNo,
      name: itemName.trim(),
      category: itemCategory === "ALL" ? "General" : itemCategory,
      uom: itemUom || "SET",
      quantity: quantity || 1,
      rate: salePrice || 0,
      discountPercent: discountPercent || 0,
      gstRate: quotationType === "Non-GST" ? 0 : itemGstRate,
      description: itemDescription.trim() || undefined,
      lineTotal: Math.round(net * 100) / 100,
    };

    setItems((prev) => [...prev, newItem]);
    toast.success(`Added ${newItem.name} to Quotation`);

    // Reset input row for fast entry of next item
    setItemName("");
    setQuantity(1);
    setSalePrice(0);
    setDiscountPercent(0);
    setItemDescription("");
  };

  // Quick Preset Add
  const handleAddPresetPackage = (preset: (typeof PRESET_QUOTATION_ITEMS)[0]) => {
    const gross = 1 * preset.rate;
    const disc = gross * (preset.discount / 100);
    const net = gross - disc;

    const newItem: QuotationItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      serialNo: nextSerialNo,
      name: preset.name,
      category: preset.category,
      uom: preset.uom,
      quantity: 1,
      rate: preset.rate,
      discountPercent: preset.discount,
      gstRate: quotationType === "Non-GST" ? 0 : preset.gst,
      description: preset.description,
      lineTotal: Math.round(net * 100) / 100,
    };

    setItems((prev) => [...prev, newItem]);
    toast.success(`Added ${preset.name}`);
  };

  // Remove line item
  const handleRemoveLine = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Select patient from CRM
  const handleSelectPet = (pet: any) => {
    setPetName(pet.name || "");
    setSpecies(pet.species || "Canine");
    setClientName(pet.ownerName || "");
    setMobileNo(pet.ownerPhone || "");
    setAddress(pet.address || pet.city || "Clinic Registered Client");
    setSearchPetQuery("");
    toast.success(`Loaded patient: ${pet.name} (${pet.ownerName})`);
  };

  // Totals calculations
  const subTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
  }, [items]);

  const totalGst = useMemo(() => {
    if (quotationType === "Non-GST") return 0;
    return items.reduce((sum, it) => {
      const taxable = it.lineTotal || 0;
      return sum + taxable * ((it.gstRate || 0) / 100);
    }, 0);
  }, [items, quotationType]);

  const cgstAmount = useMemo(() => {
    return Math.round((totalGst / 2) * 100) / 100;
  }, [totalGst]);

  const sgstAmount = useMemo(() => {
    return Math.round((totalGst / 2) * 100) / 100;
  }, [totalGst]);

  const grandTotal = useMemo(() => {
    const shipping = showShipping ? shippingCost || 0 : 0;
    return Math.round((subTotal + totalGst + shipping) * 100) / 100;
  }, [subTotal, totalGst, showShipping, shippingCost]);

  // Save Quotation
  const handleSave = async (printAfter = false) => {
    const resolvedClientName = clientName.trim() || (linkTo === "Counter Sale" ? "Counter Cash Client" : "Walk-in Client");

    if (items.length === 0) {
      toast.error("Please add at least one line item to the quotation.");
      return;
    }

    setSaving(true);
    const quotationPayload = {
      quotationNo,
      quotationType,
      date,
      validUntil,
      linkTo,
      petName: petName.trim() || (linkTo === "Patient CRM" ? "General Patient" : "Counter Sale"),
      species,
      ownerName: resolvedClientName,
      ownerPhone: mobileNo.trim() || undefined,
      doctorName,
      address: address.trim() || undefined,
      placeOfSupply,
      clientGstin: clientGstin.trim() || undefined,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        rate: it.rate,
        discountPercent: it.discountPercent,
        gstRate: it.gstRate,
        lineTotal: it.lineTotal,
        uom: it.uom,
        serialNo: it.serialNo,
        description: it.description,
      })),
      subtotal: subTotal,
      totalDiscount: items.reduce((sum, it) => sum + (it.quantity * it.rate * (it.discountPercent / 100)), 0),
      totalGst,
      shippingCosts: showShipping ? shippingCost || 0 : 0,
      grandTotal,
      quotationReference: showQuotationRef ? quotationReference : undefined,
      deliveryTerms,
      remarks,
      notes: `${deliveryTerms}\n${remarks}`,
      status: "Sent" as any,
      createdAt: new Date().toISOString(),
    };

    try {
      await createQuotationFn({ data: quotationPayload as any });
    } catch (err) {
      console.error("Server save fallback:", err);
    }

    // Local storage fallback for offline resilience
    try {
      const existing = JSON.parse(localStorage.getItem("vetos_quotations") || "[]");
      existing.unshift(quotationPayload);
      localStorage.setItem("vetos_quotations", JSON.stringify(existing.slice(0, 50)));
      window.dispatchEvent(new CustomEvent("vetos:quotation-created", { detail: quotationPayload }));
    } catch (e) {
      console.error(e);
    }

    setSaving(false);
    toast.success(`Quotation ${quotationNo} successfully saved!`);

    if (printAfter) {
      setTimeout(() => window.print(), 200);
    }

    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 gap-0 border border-slate-300 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-lg"
          aria-describedby="quotation-dialog-desc"
        >
          {/* Top Window Header matching HiTech Desktop Frame */}
          <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                <FileText className="size-3.5" />
              </div>
              <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Unsaved Quotation
              </DialogTitle>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {quotationNo}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <p id="quotation-dialog-desc" className="sr-only">
            Generate formal proforma estimates, surgery packages, and procedure cost breakdowns.
          </p>

          <div className="p-4 space-y-4">
            {/* 1. Quotation Information Group */}
            <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3 pt-4 shadow-xs">
              <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Quotation information
              </span>

              <div className="space-y-3">
                {/* Row 1: Quotation Type, Date, Valid Until */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[110px]">
                      Quotation Type <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={quotationType} onValueChange={(v: any) => setQuotationType(v)}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GST">GST</SelectItem>
                        <SelectItem value="Non-GST">Non-GST</SelectItem>
                        <SelectItem value="Bill of Supply">Bill of Supply</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[65px]">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[65px]">
                      Valid Until
                    </Label>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Row 2: Link To, Mobile No, Client Name */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[50px]">
                      Link To
                    </Label>
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="quotation_link_to"
                          checked={linkTo === "Counter Sale"}
                          onChange={() => {
                            setLinkTo("Counter Sale");
                            if (!clientName) setClientName("Counter Cash Client");
                          }}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Counter Sale</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="quotation_link_to"
                          checked={linkTo === "Client Account"}
                          onChange={() => {
                            setLinkTo("Client Account");
                            if (clientName === "Counter Cash Client") setClientName("");
                          }}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Client Account</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="quotation_link_to"
                          checked={linkTo === "Patient CRM"}
                          onChange={() => setLinkTo("Patient CRM")}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Patient CRM</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[65px]">
                      Mobile No.
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. 9823011223"
                      value={mobileNo}
                      onChange={(e) => setMobileNo(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[75px]">
                      Client Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. Ramesh Kulkarni"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium"
                    />
                  </div>
                </div>

                {/* Patient CRM Quick Lookup dropdown when Link To === 'Patient CRM' */}
                {linkTo === "Patient CRM" && (
                  <div className="p-2 rounded bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex flex-wrap items-center gap-2 text-xs">
                    <Dog className="size-3.5 text-blue-600" />
                    <span className="font-semibold text-blue-800 dark:text-blue-300">Pick Clinic Patient:</span>
                    <div className="relative flex-1 min-w-[200px] flex items-center gap-1.5">
                      <Input
                        placeholder="Search pet by name or owner..."
                        value={searchPetQuery}
                        onChange={(e) => setSearchPetQuery(e.target.value)}
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-blue-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowRegisterPetModal(true)}
                        title="Register New Pet & Owner (Direct Intake)"
                        className="size-7 shrink-0 border-blue-300 text-blue-600 dark:text-blue-400 hover:bg-blue-50"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      {searchPetQuery && (
                        <div className="absolute z-30 top-8 left-0 w-full max-h-36 overflow-y-auto rounded border border-slate-300 bg-white dark:bg-slate-900 shadow-lg divide-y divide-slate-100 dark:divide-slate-800">
                          {pets
                            .filter(
                              (p) =>
                                p.name?.toLowerCase().includes(searchPetQuery.toLowerCase()) ||
                                p.ownerName?.toLowerCase().includes(searchPetQuery.toLowerCase())
                            )
                            .slice(0, 5)
                            .map((p) => (
                              <div
                                key={p._id || p.id}
                                onClick={() => handleSelectPet(p)}
                                className="p-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                                  <span className="text-slate-500 ml-1">({p.species || "Dog"})</span>
                                </div>
                                <span className="text-blue-600 font-medium">{p.ownerName}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    {petName && (
                      <span className="text-slate-600 dark:text-slate-300">
                        Selected: <strong className="text-blue-700 dark:text-blue-300">{petName}</strong> ({species})
                      </span>
                    )}
                  </div>
                )}

                {/* Row 3: Address, Place of Supply, Client GSTIN */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[50px]">
                      Address
                    </Label>
                    <Input
                      type="text"
                      placeholder="Street, City"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[100px]">
                      Place of Supply <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={placeOfSupply} onValueChange={setPlaceOfSupply}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {INDIAN_STATES.map((st) => (
                          <SelectItem key={st} value={st}>
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[75px]">
                      Client GSTIN
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. 27AABCU9603R1ZM"
                      value={clientGstin}
                      onChange={(e) => setClientGstin(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Particulars Group */}
            <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3 pt-4 shadow-xs">
              <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Particulars
              </span>

              <div className="space-y-2.5">
                {/* Mode toggle and category dropdown */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="entry_mode"
                        checked={entryMode === "tagging"}
                        onChange={() => setEntryMode("tagging")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Tagging</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="entry_mode"
                        checked={entryMode === "itemCode"}
                        onChange={() => setEntryMode("itemCode")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Item Code</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Category:</span>
                    <Select value={itemCategory} onValueChange={setItemCategory}>
                      <SelectTrigger className="h-6 text-[11px] w-40 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_CATEGORIES.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Main Inputs Grid */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Item Name (col-span-4) with Decent Custom Combobox Dropdown */}
                  <div className="col-span-12 md:col-span-4 space-y-1 relative" ref={itemDropdownRef}>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-700 dark:text-slate-300">
                        Item Name <span className="text-rose-500">*</span>
                      </Label>
                    </div>
                    <div className="relative flex items-center">
                      <Input
                        value={itemName}
                        onFocus={() => setIsItemDropdownOpen(true)}
                        onChange={(e) => {
                          setItemName(e.target.value);
                          setIsItemDropdownOpen(true);
                        }}
                        placeholder="Select or type item name..."
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium pr-7"
                      />
                      <button
                        type="button"
                        onClick={() => setIsItemDropdownOpen((prev) => !prev)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        tabIndex={-1}
                      >
                        <ChevronDown className={`size-3.5 transition-transform duration-150 ${isItemDropdownOpen ? "rotate-180 text-blue-600" : ""}`} />
                      </button>
                    </div>

                    {/* Decent Floating Dropdown Menu */}
                    {isItemDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[320px] max-w-[420px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Available Items ({searchedItems.length})</span>
                          <span className="text-[10px] text-slate-400">Click to auto-fill</span>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {searchedItems.length === 0 ? (
                            <div className="p-3 text-xs text-center text-slate-400">
                              No items matching "{itemName}". You can enter custom particulars.
                            </div>
                          ) : (
                            searchedItems.slice(0, 40).map((it, idx) => (
                              <div
                                key={`${it.name}_${idx}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectItem(it);
                                  setIsItemDropdownOpen(false);
                                }}
                                className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between gap-2 transition-colors group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 group-hover:text-blue-600 truncate">
                                    {it.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium uppercase text-slate-600 dark:text-slate-300">
                                      {it.category}
                                    </span>
                                    <span>•</span>
                                    <span>{it.uom}</span>
                                    {it.description && (
                                      <span className="truncate max-w-[140px] text-slate-400">• {it.description}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                    ₹{it.rate.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* UoM (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">UoM</Label>
                    <Select value={itemUom} onValueChange={setItemUom}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_UOMS.map((u) => (
                          <SelectItem key={u} value={u} className="text-xs">
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity (col-span-1) */}
                  <div className="col-span-6 md:col-span-1 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Quantity <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      value={quantity || ""}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs text-center font-mono font-bold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  {/* Sale Price with Calc Icon (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Sale Price <span className="text-rose-500">*</span>
                    </Label>
                    <div className="flex items-center">
                      <div className="flex h-7 items-center justify-center px-2 bg-blue-600 text-white text-xs font-bold rounded-l border border-blue-600">
                        ₹
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={salePrice || ""}
                        onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-7 rounded-none text-xs font-mono font-semibold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 border-x-0"
                      />
                      <div className="flex h-7 items-center justify-center px-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-r border border-slate-300 dark:border-slate-700">
                        <Calculator className="size-3 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  {/* Discount (%) (col-span-1) */}
                  <div className="col-span-6 md:col-span-1 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">Discount</Label>
                    <div className="flex items-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent || ""}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-7 rounded-r-none text-xs font-mono text-center bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 border-r-0"
                      />
                      <div className="flex h-7 items-center justify-center px-1 bg-blue-600 text-white text-xs font-bold rounded-r border border-blue-600">
                        %
                      </div>
                    </div>
                  </div>

                  {/* Amount (col-span-2) */}
                  <div className="col-span-12 md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">Amount</Label>
                    <div className="flex items-center">
                      <div className="flex h-7 items-center justify-center px-2 bg-blue-600 text-white text-xs font-bold rounded-l border border-blue-600">
                        ₹
                      </div>
                      <Input
                        readOnly
                        value={currentLineAmount || 0}
                        className="h-7 rounded-l-none text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Second Row of Particulars: Serial No, Description & Green [+] Button */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Distinct Amber/Yellow Serial No Box */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Serial No.</span>
                    <div className="h-7 px-3 flex items-center justify-center rounded bg-[#fff9c4] dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-mono text-xs font-bold shadow-xs">
                      {nextSerialNo}
                    </div>
                  </div>

                  {/* Description / Particulars note */}
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Item notes, specifications, package inclusions..."
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  {/* Green [+] Button matching reference screenshot */}
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="h-7 w-8 flex items-center justify-center rounded bg-[#2e7d32] hover:bg-[#1b5e20] text-white font-bold shadow-sm transition-transform active:scale-95"
                    title="Add line item to quotation"
                  >
                    <Plus className="size-4 stroke-[3]" />
                  </button>
                </div>

                {/* Quick Add Preset Procedure / Surgery Packages */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    <Sparkles className="size-3 text-amber-500" />
                    <span>Quick Add Procedure &amp; Surgery Packages:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_QUOTATION_ITEMS.slice(0, 6).map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleAddPresetPackage(preset)}
                        className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 transition-colors flex items-center gap-1"
                      >
                        <span>+ {preset.name}</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{preset.rate.toLocaleString("en-IN")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Items Data Grid / Table with HiTech Solid Blue Header */}
            <div className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1976d2] text-white font-bold text-xs select-none">
                      <th className="py-2 px-3 w-16 text-center border-r border-blue-500/30">S. No.</th>
                      <th className="py-2 px-3 border-r border-blue-500/30">Item Name</th>
                      <th className="py-2 px-3 w-20 text-center border-r border-blue-500/30">Quantity</th>
                      <th className="py-2 px-3 w-20 text-center border-r border-blue-500/30">UoM</th>
                      <th className="py-2 px-3 w-28 text-right border-r border-blue-500/30">Sale Price</th>
                      <th className="py-2 px-3 w-20 text-right border-r border-blue-500/30">Disc.(%)</th>
                      <th className="py-2 px-3 w-28 text-right border-r border-blue-500/30">Amount</th>
                      <th className="py-2 px-2 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No items added to quotation yet. Select item above and click [+] to add.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr
                          key={it.id}
                          className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2 px-3 text-center font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                            <div>{it.name}</div>
                            {it.description && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                                {it.description}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {it.quantity}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {it.uom}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {it.rate.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {it.discountPercent || 0}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                            {it.lineTotal.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(it.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete row"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Bottom Section: Controls, Delivery Terms, Remarks & Total Calculations */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Left Side: Bell Reminder, Checkboxes & Textareas (col-span-7) */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Blue Bell Icon button */}
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(true)}
                    className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs transition-transform active:scale-95"
                    title="Set Follow-Up Reminder for this quotation"
                  >
                    <Bell className="size-6 fill-blue-600 text-blue-600" />
                  </button>

                  <div className="space-y-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={showShipping}
                        onChange={(e) => setShowShipping(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Add Shipping and Packaging Costs</span>
                    </label>

                    {showShipping && (
                      <div className="pl-6 flex items-center gap-2 pt-0.5">
                        <span className="text-[11px] text-slate-500">Shipping Cost (₹):</span>
                        <Input
                          type="number"
                          min="0"
                          value={shippingCost || ""}
                          onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                          className="h-6 w-24 text-xs font-mono"
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={showQuotationRef}
                        onChange={(e) => setShowQuotationRef(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Quotation Reference</span>
                    </label>

                    {showQuotationRef && (
                      <div className="pl-6 flex items-center gap-2 pt-0.5">
                        <span className="text-[11px] text-slate-500">Ref / Enquiry No:</span>
                        <Input
                          type="text"
                          placeholder="e.g. ENQ-9902"
                          value={quotationReference}
                          onChange={(e) => setQuotationReference(e.target.value)}
                          className="h-6 w-36 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Terms & Remarks Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="relative rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 pt-3">
                    <span className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Delivery Terms
                    </span>
                    <textarea
                      value={deliveryTerms}
                      onChange={(e) => setDeliveryTerms(e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-transparent border-0 outline-none resize-none text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="relative rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 pt-3">
                    <span className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Remarks
                    </span>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-transparent border-0 outline-none resize-none text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side: Calculation Summary & Action Buttons (col-span-5) */}
              <div className="md:col-span-5 space-y-4">
                <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span>Sub Total</span>
                    <span className="font-mono text-sm">₹ {subTotal.toFixed(2)}</span>
                  </div>

                  {quotationType === "GST" && (
                    <>
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>Add CGST ({totalGst > 0 ? "dynamic" : "0%"})</span>
                        <span className="font-mono">₹ {cgstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>Add SGST ({totalGst > 0 ? "dynamic" : "0%"})</span>
                        <span className="font-mono">₹ {sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {showShipping && (shippingCost || 0) > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Shipping &amp; Packaging</span>
                      <span className="font-mono">₹ {(shippingCost || 0).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex items-center justify-between text-slate-900 dark:text-white">
                    <span className="text-xs font-black uppercase tracking-wider">TOTAL AMOUNT</span>
                    <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400">
                      ₹ {grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Blue Action Buttons matching HiTech Screenshot 2 */}
                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="h-9 px-4 gap-2 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs shadow-sm"
                  >
                    <Printer className="size-3.5" />
                    <span>Save and Print</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="h-9 px-5 gap-2 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs shadow-sm"
                  >
                    <Save className="size-3.5" />
                    <span>Save</span>
                  </Button>

                  {onConvertToInvoice && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onConvertToInvoice({
                          ownerName: clientName || "Counter Client",
                          ownerPhone: mobileNo,
                          petName: petName || "General Patient",
                          doctorName,
                          items,
                          totalAmount: grandTotal,
                        });
                        onClose();
                      }}
                      className="h-9 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      Convert to Invoice
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Follow-up Reminder Modal */}
      {showReminderModal && (
        <BillingReminderModal
          open={showReminderModal}
          onClose={() => setShowReminderModal(false)}
        />
      )}

      {/* Direct Client & Pet Registration Modal */}
      {showRegisterPetModal && (
        <OwnerPetRegistrationModal
          open={showRegisterPetModal}
          onClose={() => setShowRegisterPetModal(false)}
          onRegistered={async ({ owner, pets: newPets }) => {
            setShowRegisterPetModal(false);
            try {
              const refreshed = await listPetsWithOwnersFn();
              setPets(refreshed || []);
              if (newPets && newPets.length > 0) {
                const firstPet = newPets[0];
                setPetName(firstPet.name);
                setSpecies(firstPet.species || "Canine");
                setClientName(owner.name || "");
                setMobileNo(owner.phone || "");
                if (owner.address) setAddress(owner.address);
                setLinkTo("Client Account");
              }
              toast.success(`Client "${owner.name}" registered and selected!`);
            } catch (err) {
              console.error(err);
            }
          }}
        />
      )}
    </>
  );
}
