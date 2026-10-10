import { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  Save,
  Download,
  ChevronDown,
  Building2,
  Pill,
  Syringe,
  ThermometerSnowflake,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayIST } from "@/lib/utils/dateUtils";
import { listSuppliersFn, type SupplierMasterRow } from "@/lib/mongodb/serverFns/masters";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { NewSupplierModal } from "../accounting/NewSupplierModal";
import { NewItemModal } from "../accounting/NewItemModal";
import { toast } from "sonner";

interface PurchaseOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSupplierId?: string;
}

export interface PurchaseOrderItemLine {
  id: string;
  sNo: number;
  productName: string;
  genericName?: string | undefined;
  category: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  taxableAmount: number;
  gstPct: number;
  taxAmount: number;
  lineTotal: number;
  packSpecs?: string | undefined;
  brand?: string | undefined;
  storageCondition?: string | undefined;
  targetSpecies?: string | undefined;
  itemCode?: string | undefined;
  hsnCode?: string | undefined;
}

export interface ClinicPurchaseOrderRecord {
  id: string;
  poNumber: string;
  orderType: "GST" | "Non-GST" | "Tax Exempt";
  poDate: string;
  deliveryDate: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string | undefined;
  supplierPhone?: string | undefined;
  supplierAddress?: string | undefined;
  placeOfSupply: string;
  transportMode: string;
  deliveryLocation: string;
  items: PurchaseOrderItemLine[];
  subTotal: number;
  gstTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  shippingCost: number;
  totalAmount: number;
  remarks: string;
  status: "DRAFT" | "ISSUED" | "PENDING_DELIVERY" | "RECEIVED" | "CANCELLED";
  createdAt: string;
}

const GST_RATES = [0, 5, 12, 18, 28];
const CLINIC_STATE = "Maharashtra";
const r2 = (n: number) => Math.round(n * 100) / 100;

const COMMON_UOMS = [
  "BOX",
  "STRIP",
  "VIAL",
  "BOTTLE",
  "PCS",
  "DOSE",
  "PACK",
  "AMP",
  "KG",
  "GM",
  "ML",
];

const CLINIC_CATEGORIES = [
  "Medicine / Drug",
  "Vaccine / Biological",
  "Injection / IV",
  "Surgical & Disposables",
  "Diagnostic & Lab",
  "Clinical Nutrition & Food",
  "Antiseptic / Disinfectant",
  "General Veterinary Consumables",
];

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
  "Other State / UT",
];

export function PurchaseOrderModal({
  open,
  onClose,
  onSuccess,
  initialSupplierId,
}: PurchaseOrderModalProps) {
  // Master lists
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Groupbox 1: Purchase Order Information
  const [orderType, setOrderType] = useState<"GST" | "Non-GST" | "Tax Exempt">("GST");
  const [poDate, setPoDate] = useState(todayIST());
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0] ?? todayIST();
  });
  const [supplierId, setSupplierId] = useState(initialSupplierId || "");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
  const [poNumber, setPoNumber] = useState("");
  const [transportMode, setTransportMode] = useState("Cold Chain Medical Express");
  const [deliveryLocation, setDeliveryLocation] = useState("Harmony Vet Hospital - Main Pharmacy & Cold Storage");

  // Groupbox 2: Particulars entry state
  const [particularsMode, setParticularsMode] = useState<"Tagging" | "ItemCode">("Tagging");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Medicine / Drug");
  const [uom, setUom] = useState("BOX");
  const [quantity, setQuantity] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [gstPct, setGstPct] = useState<number>(12);
  const [genericName, setGenericName] = useState("");
  const [packSpecs, setPackSpecs] = useState("");
  const [brand, setBrand] = useState("");
  const [storageCondition, setStorageCondition] = useState("Normal Store");
  const [targetSpecies, setTargetSpecies] = useState("Canine / Feline");
  const [hsnCode, setHsnCode] = useState("3004");
  const [selectedItemCode, setSelectedItemCode] = useState("");

  // Product Autocomplete State
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Grid Lines
  const [lines, setLines] = useState<PurchaseOrderItemLine[]>([]);

  // Bottom section
  const [addShipping, setAddShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [remarks, setRemarks] = useState(
    "All biologicals and vaccines must be dispatched with certified cold chain ice-packs (2-8°C). Minimum 18 months expiry required upon delivery."
  );

  // Modals
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Load masters
  useEffect(() => {
    if (!open) return;
    setLoadingMasters(true);
    Promise.all([
      listSuppliersFn().catch(() => []),
      getItemsFn().catch(() => []),
    ])
      .then(([supList, itList]) => {
        setSuppliers(supList as SupplierMasterRow[]);
        setInventoryItems(itList as InventoryItemRow[]);
        if (initialSupplierId && supList.some((s) => s._id === initialSupplierId)) {
          setSupplierId(initialSupplierId);
        }
      })
      .finally(() => setLoadingMasters(false));
  }, [open, initialSupplierId]);

  // Generate clean PO Number on open
  useEffect(() => {
    if (open && !poNumber) {
      const year = new Date().getFullYear();
      let seq = 1;
      try {
        const stored = localStorage.getItem("clinic_po_last_seq");
        if (stored) seq = parseInt(stored, 10) + 1;
      } catch {}
      setPoNumber(`PO-${year}-${String(seq).padStart(4, "0")}`);
    }
  }, [open, poNumber]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProductDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedSupplier = suppliers.find((s) => s._id === supplierId);
  const isGst = orderType === "GST";
  const isInterState = placeOfSupply !== CLINIC_STATE;
  const effectiveGstPct = isGst ? gstPct : 0;

  // Filter products for autocomplete
  const searchedProducts = inventoryItems.filter((it) => {
    if (!productName.trim()) return true;
    const q = productName.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      (it.genericName && it.genericName.toLowerCase().includes(q)) ||
      it.itemCode.toLowerCase().includes(q)
    );
  });

  const handleSelectProduct = (it: InventoryItemRow) => {
    setProductName(it.name);
    setSelectedItemCode(it.itemCode);
    setGenericName(it.genericName || "");
    setHsnCode(it.hsnCode || "3004");
    setUnitPrice(it.defaultPurchasePrice || 0);
    setGstPct(it.gstRate ?? 12);
    setBrand(it.brand || it.manufacturer || "");
    if (it.unit || it.purchaseUom) {
      setUom(it.purchaseUom || it.unit);
    }
    if (it.category) {
      setCategory(it.category);
    } else if (it.productType === "MEDICINE") {
      setCategory("Medicine / Drug");
    } else if (it.productType === "INJECTION") {
      setCategory("Injection / IV");
    } else if (it.productType === "FOOD") {
      setCategory("Clinical Nutrition & Food");
    }

    if (it.medicineDetails?.storageCondition || it.injectionDetails?.storageCondition) {
      const cond = it.medicineDetails?.storageCondition || it.injectionDetails?.storageCondition;
      if (cond?.toLowerCase().includes("cold") || cond?.toLowerCase().includes("2-8")) {
        setStorageCondition("Cold Chain 2-8°C");
      }
    }

    setIsProductDropdownOpen(false);
  };

  // Calculations for Particulars Entry Row
  const rawParticularsTaxable = r2(quantity * unitPrice);
  const rawParticularsTax = isGst ? r2((rawParticularsTaxable * effectiveGstPct) / 100) : 0;
  const rawParticularsTotal = r2(rawParticularsTaxable + rawParticularsTax);

  // Add line
  const handleAddLine = () => {
    if (!productName.trim()) {
      toast.error("Please enter or select a product name.");
      return;
    }
    if (quantity <= 0) {
      toast.error("Please specify a valid quantity greater than 0.");
      return;
    }
    if (unitPrice < 0) {
      toast.error("Unit price cannot be negative.");
      return;
    }

    const newLine: PurchaseOrderItemLine = {
      id: "pol-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      sNo: lines.length + 1,
      productName: productName.trim(),
      genericName: genericName.trim() || undefined,
      category,
      uom: uom.toUpperCase(),
      quantity,
      unitPrice,
      taxableAmount: rawParticularsTaxable,
      gstPct: effectiveGstPct,
      taxAmount: rawParticularsTax,
      lineTotal: rawParticularsTotal,
      packSpecs: packSpecs.trim() || undefined,
      brand: brand.trim() || undefined,
      storageCondition,
      targetSpecies,
      itemCode: selectedItemCode || undefined,
      hsnCode: hsnCode.trim() || undefined,
    };

    setLines((prev) => [...prev, newLine]);

    // Reset entry inputs for next item
    setProductName("");
    setSelectedItemCode("");
    setGenericName("");
    setPackSpecs("");
    setBrand("");
    setQuantity(0);
    setUnitPrice(0);
    toast.success(`Added "${newLine.productName}" to purchase order.`);
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((l, i) => ({ ...l, sNo: i + 1 }));
    });
  };

  // Summary calculations
  const subTotal = r2(lines.reduce((acc, l) => acc + l.taxableAmount, 0));
  const gstTotal = r2(lines.reduce((acc, l) => acc + l.taxAmount, 0));
  const cgstTotal = isInterState ? 0 : r2(gstTotal / 2);
  const sgstTotal = isInterState ? 0 : r2(gstTotal / 2);
  const igstTotal = isInterState ? gstTotal : 0;
  const shipping = addShipping ? Number(shippingCost) || 0 : 0;
  const totalAmount = r2(subTotal + gstTotal + shipping);

  // Quick preset packs for veterinary clinic bulk ordering
  const applyPresetPack = (packType: "VACCINES" | "ANTIBIOTICS" | "SURGERY" | "IV_FLUIDS") => {
    let presetItems: Array<{
      name: string;
      generic: string;
      cat: string;
      uom: string;
      qty: number;
      price: number;
      gst: number;
      pack: string;
      storage: string;
      brand: string;
    }> = [];

    if (packType === "VACCINES") {
      presetItems = [
        {
          name: "Nobivac DHPPi + L4 Vaccine",
          generic: "Canine Distemper, Parvo, Adenovirus, Lepto Vaccine",
          cat: "Vaccine / Biological",
          uom: "DOSE",
          qty: 25,
          price: 520,
          gst: 12,
          pack: "Vial with Diluent",
          storage: "Cold Chain 2-8°C",
          brand: "MSD Animal Health",
        },
        {
          name: "Raksharab Anti-Rabies Vaccine 10ml",
          generic: "Inactivated Rabies Veterinary Vaccine (10 Doses)",
          cat: "Vaccine / Biological",
          uom: "VIAL",
          qty: 10,
          price: 380,
          gst: 12,
          pack: "10ml Multi-Dose Vial",
          storage: "Cold Chain 2-8°C",
          brand: "Indian Immunologicals",
        },
        {
          name: "Feligen CRP Feline Core Vaccine",
          generic: "Feline Panleukopenia, Calicivirus, Herpesvirus",
          cat: "Vaccine / Biological",
          uom: "DOSE",
          qty: 15,
          price: 680,
          gst: 12,
          pack: "Single Dose Vial",
          storage: "Cold Chain 2-8°C",
          brand: "Virbac Animal Health",
        },
      ];
    } else if (packType === "ANTIBIOTICS") {
      presetItems = [
        {
          name: "Amoxyclav 625mg Veterinary Tabs",
          generic: "Amoxicillin + Potassium Clavulanate",
          cat: "Medicine / Drug",
          uom: "BOX",
          qty: 20,
          price: 240,
          gst: 12,
          pack: "10 x 10 Tablets",
          storage: "Normal Store",
          brand: "Intas Animal Health",
        },
        {
          name: "Enrofloxacin 10% Injectable 50ml",
          generic: "Enrofloxacin Veterinary Solution",
          cat: "Injection / IV",
          uom: "VIAL",
          qty: 12,
          price: 195,
          gst: 12,
          pack: "50ml Amber Glass Vial",
          storage: "Normal Store",
          brand: "Cadila Zydus AHL",
        },
        {
          name: "Ceftriaxone + Sulbactam 3.75g Inj",
          generic: "Ceftriaxone Sodium + Sulbactam Sodium Vet",
          cat: "Injection / IV",
          uom: "VIAL",
          qty: 30,
          price: 145,
          gst: 12,
          pack: "Dry Vial with WFI",
          storage: "Normal Store",
          brand: "Alivira Animal Health",
        },
      ];
    } else if (packType === "SURGERY") {
      presetItems = [
        {
          name: "Chromic Catgut 2-0 with Needle",
          generic: "Absorbable Surgical Suture",
          cat: "Surgical & Disposables",
          uom: "BOX",
          qty: 10,
          price: 750,
          gst: 12,
          pack: "12 Foils / Box",
          storage: "Normal Store",
          brand: "Lotus Surgicals",
        },
        {
          name: "IV Cannula 22G Blue",
          generic: "Sterile Intravenous Cannula with Port",
          cat: "Surgical & Disposables",
          uom: "BOX",
          qty: 5,
          price: 650,
          gst: 12,
          pack: "50 Pcs / Box",
          storage: "Normal Store",
          brand: "BD Vet",
        },
        {
          name: "Sterile Disposable Syringes 3ml",
          generic: "3ml Syringe with 23G Needle",
          cat: "Surgical & Disposables",
          uom: "BOX",
          qty: 8,
          price: 320,
          gst: 12,
          pack: "100 Pcs / Box",
          storage: "Normal Store",
          brand: "Dispovan",
        },
      ];
    } else if (packType === "IV_FLUIDS") {
      presetItems = [
        {
          name: "Ringer Lactate (RL) 500ml Vet Infusion",
          generic: "Compound Sodium Lactate IV",
          cat: "Injection / IV",
          uom: "BOTTLE",
          qty: 50,
          price: 48,
          gst: 12,
          pack: "500ml BFS Plastic Bottle",
          storage: "Normal Store",
          brand: "Otsuka / Parenteral",
        },
        {
          name: "Normal Saline (0.9% NaCl) 500ml",
          generic: "Sodium Chloride 0.9% w/v",
          cat: "Injection / IV",
          uom: "BOTTLE",
          qty: 40,
          price: 42,
          gst: 12,
          pack: "500ml BFS Plastic Bottle",
          storage: "Normal Store",
          brand: "Fresenius Kabi",
        },
      ];
    }

    const currentLen = lines.length;
    const newLines: PurchaseOrderItemLine[] = presetItems.map((item, idx) => {
      const taxable = r2(item.qty * item.price);
      const tax = r2((taxable * (isGst ? item.gst : 0)) / 100);
      return {
        id: "pol-preset-" + Date.now() + "-" + idx,
        sNo: currentLen + idx + 1,
        productName: item.name,
        genericName: item.generic,
        category: item.cat,
        uom: item.uom,
        quantity: item.qty,
        unitPrice: item.price,
        taxableAmount: taxable,
        gstPct: isGst ? item.gst : 0,
        taxAmount: tax,
        lineTotal: r2(taxable + tax),
        packSpecs: item.pack,
        brand: item.brand,
        storageCondition: item.storage,
        targetSpecies: "Canine / Feline",
        hsnCode: "3004",
      };
    });

    setLines((prev) => [...prev, ...newLines]);
    toast.success(`Added ${newLines.length} items from clinic preset!`);
  };

  // Save Purchase Order
  const handleSaveOrder = () => {
    if (!supplierId) {
      toast.error("Please select a Supplier Name.");
      return;
    }
    if (!poNumber.trim()) {
      toast.error("Please enter a Purchase Order Number.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Please add at least one medicine or stock item to the purchase order.");
      return;
    }

    setSubmitting(true);
    try {
      const record: ClinicPurchaseOrderRecord = {
        id: "PO_REC_" + Date.now(),
        poNumber: poNumber.trim(),
        orderType,
        poDate,
        deliveryDate,
        supplierId,
        supplierName: selectedSupplier?.name || "Supplier",
        supplierGstin: selectedSupplier?.gstin,
        supplierPhone: selectedSupplier?.phone || selectedSupplier?.mobileNo,
        supplierAddress: selectedSupplier?.address,
        placeOfSupply,
        transportMode,
        deliveryLocation,
        items: lines,
        subTotal,
        gstTotal,
        cgstTotal,
        sgstTotal,
        igstTotal,
        shippingCost: shipping,
        totalAmount,
        remarks: remarks.trim(),
        status: "ISSUED",
        createdAt: new Date().toISOString(),
      };

      // Persist in localStorage
      let existingList: ClinicPurchaseOrderRecord[] = [];
      try {
        const raw = localStorage.getItem("clinic_purchase_orders");
        if (raw) existingList = JSON.parse(raw);
      } catch {}
      existingList.unshift(record);
      localStorage.setItem("clinic_purchase_orders", JSON.stringify(existingList.slice(0, 100)));

      // Update sequence
      const numMatch = poNumber.match(/\d+$/);
      if (numMatch) {
        localStorage.setItem("clinic_po_last_seq", String(parseInt(numMatch[0], 10)));
      }

      toast.success(`Purchase Order ${record.poNumber} created & issued successfully!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("[PurchaseOrderModal] Save error:", err);
      toast.error("Failed to save purchase order: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 gap-0 border border-slate-300 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-lg"
          aria-describedby="purchase-order-desc"
        >
          {/* Top Window Header matching HiTech Desktop Frame */}
          <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                <FileSpreadsheet className="size-3.5" />
              </div>
              <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>Purchase Order (Bulk Clinic Stock Order)</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Clinic Procurement
                </span>
              </DialogTitle>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <p id="purchase-order-desc" className="sr-only">
            Generate and issue bulk veterinary pharmaceutical and supply purchase orders for clinic procurement.
          </p>

          {/* Active Tab Strip */}
          <div className="px-4 pt-2 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-white dark:bg-slate-900 rounded-t border-t border-x border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs -mb-px">
                Purchase Order
              </div>
            </div>
            <div className="text-[11px] font-medium text-slate-500 pb-1 flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Consignee: Harmony Veterinary Hospital &amp; Animal Care</span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* 1. Purchase Order Information Card (Groupbox 1) */}
            <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3 pt-4 shadow-xs">
              <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Purchase order information
              </span>

              <div className="space-y-3">
                {/* Row 1: Order Type, Date, Supplier Name */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[90px]">
                      Order Type <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={orderType} onValueChange={(v: any) => setOrderType(v)}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GST">GST Order</SelectItem>
                        <SelectItem value="Non-GST">Non-GST Order</SelectItem>
                        <SelectItem value="Tax Exempt">Tax Exempt / Bulk Tender</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[60px]">
                      P.O. Date
                    </Label>
                    <Input
                      type="date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[100px]">
                      Supplier / Vendor <span className="text-rose-500">*</span>
                    </Label>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Select
                        value={supplierId}
                        onValueChange={(v) => {
                          if (v === "ADD_NEW") {
                            setShowNewSupplierModal(true);
                          } else {
                            setSupplierId(v);
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium flex-1 truncate">
                          <SelectValue placeholder="Select Veterinary Supplier" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setShowNewSupplierModal(true);
                            }}
                            className="p-1.5 mb-1 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded text-blue-700 dark:text-blue-300 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors select-none"
                          >
                            <Plus className="size-3.5" />
                            <span>+ Add New Supplier</span>
                          </div>
                          {suppliers.map((s) => (
                            <SelectItem key={s._id} value={s._id} className="text-xs">
                              {s.name} {s.city ? `(${s.city})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <button
                        type="button"
                        onClick={() => setShowNewSupplierModal(true)}
                        title="Add New Supplier"
                        className="h-7 w-7 flex items-center justify-center rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors shrink-0"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Place of Supply, P. O. No., Expected Delivery Date */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[90px]">
                      Place of Supply <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={placeOfSupply} onValueChange={setPlaceOfSupply}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {INDIAN_STATES.map((st) => (
                          <SelectItem key={st} value={st} className="text-xs">
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[60px]">
                      P. O. No.
                    </Label>
                    <Input
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-0001"
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[100px]">
                      Expected Delivery
                    </Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>

                {/* Row 3: Ship Via / Transport Mode & Delivery Point */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[90px]">
                      Ship Via
                    </Label>
                    <Select value={transportMode} onValueChange={setTransportMode}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cold Chain Medical Express">Cold Chain Express (2-8°C)</SelectItem>
                        <SelectItem value="Direct Supplier Delivery">Direct Supplier Delivery</SelectItem>
                        <SelectItem value="Express Medical Cargo">Express Medical Cargo</SelectItem>
                        <SelectItem value="Self Clinic Pickup">Self Clinic Pickup</SelectItem>
                        <SelectItem value="Standard Courier">Standard Courier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 md:col-span-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[80px]">
                      Deliver To
                    </Label>
                    <Input
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="Clinic store delivery location"
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Vendor Details Strip if selected */}
                {selectedSupplier && (
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedSupplier.name}
                    </span>
                    {selectedSupplier.gstin && (
                      <span>GSTIN: <strong className="font-mono">{selectedSupplier.gstin}</strong></span>
                    )}
                    {(selectedSupplier.phone || selectedSupplier.mobileNo) && (
                      <span>Phone: <strong className="font-mono">{selectedSupplier.phone || selectedSupplier.mobileNo}</strong></span>
                    )}
                    {selectedSupplier.address && (
                      <span className="truncate max-w-sm">Addr: {selectedSupplier.address}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Particulars Group (Add Clinical Stock / Medicine) */}
            <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3 pt-4 shadow-xs">
              <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Particulars (Bulk Order Items)
              </span>

              <div className="space-y-2.5">
                {/* Mode toggle */}
                <div className="flex items-center gap-4 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="poParticularsMode"
                      checked={particularsMode === "Tagging"}
                      onChange={() => setParticularsMode("Tagging")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Tagging</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="poParticularsMode"
                      checked={particularsMode === "ItemCode"}
                      onChange={() => setParticularsMode("ItemCode")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Item Code</span>
                  </label>
                  <span className="text-[11px] text-slate-400 ml-auto">
                    Preserves full medicine details in a streamlined single-entry row
                  </span>
                </div>

                {/* Main Particulars Inputs Grid matching Add Purchase */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Product Name * with Combobox Dropdown */}
                  <div className="col-span-12 md:col-span-3 space-y-1 relative" ref={productDropdownRef}>
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Product Name <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center gap-1.5">
                      <Input
                        value={productName}
                        onFocus={() => setIsProductDropdownOpen(true)}
                        onChange={(e) => {
                          setProductName(e.target.value);
                          setIsProductDropdownOpen(true);
                        }}
                        placeholder="Search medicine or type name..."
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium pr-7"
                      />
                      <button
                        type="button"
                        onClick={() => setIsProductDropdownOpen((prev) => !prev)}
                        className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        tabIndex={-1}
                      >
                        <ChevronDown
                          className={`size-3.5 transition-transform duration-150 ${
                            isProductDropdownOpen ? "rotate-180 text-blue-600" : ""
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewItemModal(true)}
                        title="Add New Medicine / Inventory Item"
                        className="h-7 w-7 flex items-center justify-center rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors shrink-0"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    {/* Floating Dropdown Menu */}
                    {isProductDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[340px] max-w-[440px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Clinic Products ({searchedProducts.length})</span>
                          <span className="text-[10px] text-slate-400">Click to select</span>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {searchedProducts.length === 0 ? (
                            <div className="p-3 text-xs text-center text-slate-400">
                              No catalog item for "{productName}". You can enter custom medicine name.
                            </div>
                          ) : (
                            searchedProducts.slice(0, 35).map((it) => (
                              <div
                                key={it.itemCode}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectProduct(it);
                                }}
                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between gap-2 transition-colors group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 group-hover:text-blue-600 truncate">
                                    {it.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                      {it.category || it.productType}
                                    </span>
                                    {it.genericName && (
                                      <span className="truncate italic text-[10px] text-slate-400 max-w-[150px]">
                                        {it.genericName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                    ₹{it.defaultPurchasePrice || 0}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 truncate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLINIC_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* UoM (col-span-1) */}
                  <div className="col-span-6 md:col-span-1 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">UoM</Label>
                    <Select value={uom} onValueChange={setUom}>
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

                  {/* Quantity * (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Quantity <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      value={quantity || ""}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      placeholder="Order Qty"
                      className="h-7 text-xs text-center font-mono font-bold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  {/* Expected Purchase Price with Blue ₹ Box (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Rate / Unit <span className="text-rose-500">*</span>
                    </Label>
                    <div className="flex items-center">
                      <div className="flex h-7 items-center justify-center px-2 bg-[#1976d2] text-white text-xs font-bold rounded-l">
                        ₹
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={unitPrice || ""}
                        onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-7 rounded-l-none text-xs font-mono font-semibold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  {/* GST % (col-span-1) */}
                  <div className="col-span-6 md:col-span-1 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">GST %</Label>
                    <Select
                      value={String(effectiveGstPct)}
                      onValueChange={(v) => setGstPct(Number(v))}
                      disabled={!isGst}
                    >
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((r) => (
                          <SelectItem key={r} value={String(r)} className="text-xs">
                            {r}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount with Green [+] Button */}
                  <div className="col-span-6 md:col-span-1 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Total <span className="text-rose-500">*</span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAddLine}
                        className="h-7 w-full flex items-center justify-center rounded bg-[#2e7d32] hover:bg-[#1b5e20] text-white font-bold shadow-sm transition-transform active:scale-95"
                        title="Add item to purchase order"
                      >
                        <Plus className="size-4 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Secondary Specifications Row (Compact & Non-intrusive) */}
                <div className="grid grid-cols-12 gap-2 items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="col-span-12 md:col-span-3">
                    <Input
                      value={genericName}
                      onChange={(e) => setGenericName(e.target.value)}
                      placeholder="Generic / Composition (e.g. Amoxyclav 625mg)"
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Input
                      value={packSpecs}
                      onChange={(e) => setPackSpecs(e.target.value)}
                      placeholder="Pack specs (e.g. 10x10 Strips)"
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Brand / Mfr (e.g. Zoetis / Intas)"
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Select value={storageCondition} onValueChange={setStorageCondition}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal Store">Normal Store</SelectItem>
                        <SelectItem value="Cold Chain 2-8°C">Cold Chain 2-8°C</SelectItem>
                        <SelectItem value="Deep Freeze -20°C">Deep Freeze -20°C</SelectItem>
                        <SelectItem value="Controlled Lock">Controlled / Schedule H</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Select value={targetSpecies} onValueChange={setTargetSpecies}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Canine / Feline">Small Animal (Dog/Cat)</SelectItem>
                        <SelectItem value="Equine / Large Animal">Large Animal / Equine</SelectItem>
                        <SelectItem value="Avian / Exotic">Avian &amp; Exotic</SelectItem>
                        <SelectItem value="All Species">Multi-Species Vet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-12 md:col-span-1 flex items-center justify-end">
                    <div className="h-7 px-2 flex items-center justify-center rounded bg-[#fff9c4] dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-mono text-xs font-bold shadow-xs whitespace-nowrap">
                      Line #{lines.length + 1}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Table / Data Grid with Signature HiTech Solid Blue Header */}
            <div className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1976d2] text-white font-bold text-xs select-none">
                      <th className="py-2 px-3 w-12 text-center border-r border-blue-500/30">S. No.</th>
                      <th className="py-2 px-3 border-r border-blue-500/30">Product / Medicine Name</th>
                      <th className="py-2 px-3 w-28 text-center border-r border-blue-500/30">Category</th>
                      <th className="py-2 px-3 w-32 border-r border-blue-500/30">Specs / Storage</th>
                      <th className="py-2 px-3 w-20 text-center border-r border-blue-500/30">Quantity</th>
                      <th className="py-2 px-3 w-16 text-center border-r border-blue-500/30">Unit</th>
                      <th className="py-2 px-3 w-24 text-right border-r border-blue-500/30">Rate (₹)</th>
                      <th className="py-2 px-3 w-24 text-right border-r border-blue-500/30">Taxable</th>
                      <th className="py-2 px-3 w-20 text-right border-r border-blue-500/30">GST</th>
                      <th className="py-2 px-3 w-28 text-right border-r border-blue-500/30">Amount (₹)</th>
                      <th className="py-2 px-2 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">
                          No particulars added. Enter product details above and click the green [+] button.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, idx) => (
                        <tr
                          key={line.id}
                          className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2 px-3 text-center font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                            <div className="font-semibold">{line.productName}</div>
                            {line.genericName && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                {line.genericName}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                              {line.category}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            <div className="truncate max-w-[140px] text-[11px] font-medium">
                              {line.packSpecs || line.brand || "-"}
                            </div>
                            {line.storageCondition && line.storageCondition.includes("Cold") && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-sky-600 font-semibold">
                                <ThermometerSnowflake className="size-2.5" /> 2-8°C Cold Chain
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                            {line.quantity}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {line.uom}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {line.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {line.taxableAmount.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {line.taxAmount.toFixed(2)}
                            <span className="ml-0.5 text-[10px] text-slate-400">({line.gstPct}%)</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                            {line.lineTotal.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
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

            {/* 4. Bottom Section: Quick Presets, Shipping, Remarks & Calculations */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2">
              {/* Left Side: Clinic Presets, Remarks, Shipping (col-span-7) */}
              <div className="md:col-span-7 space-y-3">
                {/* Fast Clinic Bulk Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" />
                    Quick Clinic Bulk Restock Packs:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPresetPack("VACCINES")}
                      className="px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                    >
                      <ThermometerSnowflake className="size-3" />
                      + Core Vaccines (Cold Chain)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetPack("ANTIBIOTICS")}
                      className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                    >
                      <Pill className="size-3" />
                      + Antibiotics Bulk
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetPack("SURGERY")}
                      className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                    >
                      <Syringe className="size-3" />
                      + Surgery &amp; Consumables
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetPack("IV_FLUIDS")}
                      className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>💧</span>
                      + IV Infusions (RL/NS)
                    </button>
                  </div>
                </div>

                {/* Shipping & Packaging Costs */}
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={addShipping}
                      onChange={(e) => setAddShipping(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Add Shipping / Cold Chain Handling Charges</span>
                  </label>

                  {addShipping && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Freight (₹):</span>
                      <Input
                        type="number"
                        min="0"
                        value={shippingCost || ""}
                        onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                        className="h-6 w-24 text-xs font-mono font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* Remarks & Instructions */}
                <div className="relative rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 pt-3">
                  <span className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Special Clinic Delivery Instructions &amp; Cold Chain Mandates
                  </span>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter storage requirements, delivery hours, or special handling notes..."
                    className="w-full text-xs bg-transparent border-0 outline-none resize-none text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Right Side: Totals Summary & Action Buttons (col-span-5) */}
              <div className="md:col-span-5 space-y-4">
                <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span>Sub Total ({lines.length} items)</span>
                    <span className="font-mono text-sm">₹ {subTotal.toFixed(2)}</span>
                  </div>

                  {gstTotal > 0 &&
                    (isInterState ? (
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>IGST</span>
                        <span className="font-mono">₹ {igstTotal.toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span>CGST</span>
                          <span className="font-mono">₹ {cgstTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span>SGST</span>
                          <span className="font-mono">₹ {sgstTotal.toFixed(2)}</span>
                        </div>
                      </>
                    ))}

                  {addShipping && shipping > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Shipping &amp; Handling</span>
                      <span className="font-mono">₹ {shipping.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex items-center justify-between text-slate-900 dark:text-white">
                    <span className="text-xs font-black uppercase tracking-wider">TOTAL PO VALUE</span>
                    <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400">
                      ₹ {totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Footer Action Buttons matching reference */}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPrintPreview(true)}
                    disabled={lines.length === 0}
                    className="h-9 px-3 gap-1.5 text-xs font-semibold border-slate-300 dark:border-slate-700"
                  >
                    <Printer className="size-3.5" />
                    <span>Print PO</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPrintPreview(true);
                      setTimeout(() => window.print(), 300);
                    }}
                    disabled={lines.length === 0}
                    className="h-9 px-3 gap-1.5 text-xs font-semibold border-slate-300 dark:border-slate-700"
                  >
                    <Download className="size-3.5" />
                    <span>PDF</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSaveOrder}
                    disabled={submitting}
                    className="h-9 px-5 gap-2 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs shadow-sm"
                  >
                    <Save className="size-3.5" />
                    <span>{submitting ? "Saving..." : "Save PO"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable Purchase Order Modal (Matching Image 2 Reference Document) */}
      {showPrintPreview && (
        <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6 bg-white text-slate-900 shadow-2xl rounded-lg print:p-0 print:shadow-none">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 select-none print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="size-4 text-blue-600" />
                <DialogTitle className="text-sm font-bold text-slate-800">
                  Print Preview — Purchase Order #{poNumber}
                </DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="h-7 px-3 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs gap-1.5"
                >
                  <Printer className="size-3.5" />
                  Print Now
                </Button>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Document Body matching Image 2 */}
            <div className="space-y-6 pt-4 font-sans text-xs">
              {/* Header Banner */}
              <div className="border-b-4 border-[#1976d2] pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-black text-[#1976d2] tracking-tight">
                      PURCHASE ORDER
                    </h1>
                    <p className="text-xs font-semibold text-slate-700 mt-1">
                      HARMONY VETERINARY HOSPITAL &amp; ANIMAL HEALTHCARE
                    </p>
                    <p className="text-[11px] text-slate-500">
                      89 Animal Care Boulevard, Clinic Road, Pune, Maharashtra 411001
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Phone: +91 98765 43210 • Email: purchase@harmonyvet.org
                    </p>
                    <p className="text-[11px] text-slate-500">
                      GSTIN: 27AABCV1234F1Z8 • Drug License: MH-PUN-VET-2024-0982
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm font-bold text-slate-800 font-mono">
                      PO No: {poNumber}
                    </div>
                    <div className="text-xs text-slate-600">
                      Date: <span className="font-mono font-semibold">{poDate}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Due Date: <span className="font-mono font-semibold">{deliveryDate}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Ship Via: <span className="font-semibold">{transportMode}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vendor & Ship To Row */}
              <div className="grid grid-cols-2 gap-8 py-2">
                <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-slate-700 mb-1">
                    Vendor / Supplier
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    {selectedSupplier?.name || "Selected Supplier"}
                  </div>
                  {selectedSupplier?.address && (
                    <div className="text-slate-600 mt-0.5">{selectedSupplier.address}</div>
                  )}
                  {selectedSupplier?.city && (
                    <div className="text-slate-600">{selectedSupplier.city}, {selectedSupplier.state || placeOfSupply}</div>
                  )}
                  {(selectedSupplier?.phone || selectedSupplier?.mobileNo) && (
                    <div className="text-slate-600">Tel: {selectedSupplier.phone || selectedSupplier.mobileNo}</div>
                  )}
                  {selectedSupplier?.gstin && (
                    <div className="text-slate-700 font-mono text-[11px] font-semibold mt-1">
                      GSTIN: {selectedSupplier.gstin}
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-slate-700 mb-1">
                    Ship To / Delivery Point
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    Harmony Veterinary Hospital
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {deliveryLocation}
                  </div>
                  <div className="text-slate-600">
                    89 Animal Care Boulevard, Pune, Maharashtra 411001
                  </div>
                  <div className="text-slate-600">
                    Contact: Chief Veterinary Pharmacist (+91 98765 43211)
                  </div>
                </div>
              </div>

              {/* Items Table matching Image 2 */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1976d2] text-white font-bold">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Item Details &amp; Description</th>
                      <th className="py-2 px-3 w-20 text-center">Unit</th>
                      <th className="py-2 px-3 w-20 text-center">Qty</th>
                      <th className="py-2 px-3 w-24 text-right">Unit Price</th>
                      <th className="py-2 px-3 w-24 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {lines.map((l, i) => (
                      <tr key={l.id}>
                        <td className="py-2 px-3 text-center font-semibold text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{l.productName}</div>
                          <div className="text-[11px] text-slate-500">
                            {l.genericName || l.category} {l.packSpecs ? `• ${l.packSpecs}` : ""} {l.brand ? `• Brand: ${l.brand}` : ""}
                          </div>
                          {l.storageCondition && l.storageCondition.includes("Cold") && (
                            <div className="text-[10px] text-sky-700 font-semibold mt-0.5">
                              Requirement: 2-8°C Active Cold Chain Transport
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-700 font-semibold">{l.uom}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">{l.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">₹{l.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">₹{l.taxableAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subtotals & Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-2">
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="font-bold text-[11px] text-slate-700 uppercase mb-1">
                      Purchase Order Terms &amp; Conditions
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                      <li>Please supply strictly per quality standards &amp; valid batch certificates.</li>
                      <li>Cold chain biologicals must be packed in thermocol with ice-gel packs.</li>
                      <li>Goods delivered with less than 18 months expiry will be returned.</li>
                      <li>Payment terms: As per agreement after physical receipt &amp; inspection.</li>
                    </ul>
                  </div>

                  {remarks && (
                    <div className="text-[11px] text-slate-600">
                      <strong>Special Note:</strong> {remarks}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="border border-slate-200 rounded p-3 bg-slate-50 space-y-1.5 font-medium">
                    <div className="flex justify-between text-slate-700">
                      <span>Sub Total:</span>
                      <span className="font-mono">₹{subTotal.toFixed(2)}</span>
                    </div>
                    {gstTotal > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>GST ({isInterState ? "IGST" : "CGST+SGST"}):</span>
                        <span className="font-mono">₹{gstTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {shipping > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>Shipping / Handling Fee:</span>
                        <span className="font-mono">₹{shipping.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-300 pt-1.5 flex justify-between font-black text-sm text-[#1976d2]">
                      <span>TOTAL:</span>
                      <span className="font-mono text-base">₹{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-8 text-center border-t border-slate-300 mt-8">
                    <div className="font-bold text-xs text-slate-900">
                      For Harmony Veterinary Hospital &amp; Animal Healthcare
                    </div>
                    <div className="text-[11px] text-slate-500 mt-6">
                      Authorized Signatory / Medical Superintendent
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* New Item Modal */}
      {showNewItemModal && (
        <NewItemModal
          open={showNewItemModal}
          onClose={() => setShowNewItemModal(false)}
          onSuccess={(created) => {
            setInventoryItems((prev) => [created, ...prev]);
            handleSelectProduct(created);
            setShowNewItemModal(false);
          }}
          initialName={productName.trim()}
          supplierId={supplierId}
          supplierName={selectedSupplier?.name}
        />
      )}

      {/* New Supplier Modal */}
      {showNewSupplierModal && (
        <NewSupplierModal
          open={showNewSupplierModal}
          onClose={() => setShowNewSupplierModal(false)}
          onSuccess={async (newSup) => {
            const updated = await listSuppliersFn().catch(() => []);
            setSuppliers(updated as SupplierMasterRow[]);
            setSupplierId(newSup._id);
            setShowNewSupplierModal(false);
          }}
        />
      )}
    </>
  );
}
