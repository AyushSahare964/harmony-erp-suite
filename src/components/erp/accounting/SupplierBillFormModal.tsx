import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  FileSpreadsheet,
  Plus,
  Trash2,
  Bell,
  Save,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { createPurchaseBillFn } from "@/lib/mongodb/serverFns/purchaseBills";
import { BillingReminderModal } from "@/components/erp/billing/BillingReminderModal";
import { NewSupplierModal } from "./NewSupplierModal";
import { toast } from "sonner";

interface SupplierBillFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSupplierId?: string;
}

interface PurchaseLine {
  id: string;
  sNo: number;
  serialNo?: string | undefined;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  amount: number;
}

const COMMON_UOMS = [
  "PCS",
  "SET",
  "NOS",
  "BOTTLE",
  "STRIP",
  "VIAL",
  "TAB",
  "BOX",
  "KG",
  "GM",
  "ML",
  "DOSE",
  "PACK",
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
  "Jammu and Kashmir",
  "Ladakh",
  "Puducherry",
  "Other State / UT",
];

export function SupplierBillFormModal({
  open,
  onClose,
  onSuccess,
  initialSupplierId,
}: SupplierBillFormModalProps) {
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Groupbox 1: Purchase bill information
  const [purchaseType, setPurchaseType] = useState<"GST" | "Non-GST" | "Bill of Supply">("GST");
  const [billDate, setBillDate] = useState(todayIST());
  const [supplierId, setSupplierId] = useState(initialSupplierId || "");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
  const [poNumber, setPoNumber] = useState("");
  const [purchaseBillNo, setPurchaseBillNo] = useState("");

  // Groupbox 2: Particulars entry row
  const [particularsMode, setParticularsMode] = useState<"Tagging" | "ItemCode">("Tagging");
  const [productName, setProductName] = useState("");
  const [uom, setUom] = useState("PCS");
  const [quantity, setQuantity] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);

  // Custom Combobox Dropdown State for Product Name
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Grid Lines
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  // Bottom row: shipping, remarks, reminder
  const [addShipping, setAddShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [remarks, setRemarks] = useState("");
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);

  // Auto-refresh suppliers after adding a new supplier
  const handleSupplierCreated = (created: { _id: string; name: string }) => {
    listSuppliersFn().then((sups) => {
      setSuppliers(sups || []);
      setSupplierId(created._id);
    });
  };

  useEffect(() => {
    if (!open) return;

    // Generate suggested purchase bill number
    const rnd = Math.floor(1000 + Math.random() * 9000);
    setPurchaseBillNo(`PB-2026-${rnd}`);
    setBillDate(todayIST());

    Promise.all([listSuppliersFn(), getItemsFn({ data: { status: "Active" } })])
      .then(([sups, invItems]) => {
        setSuppliers(sups || []);
        setInventoryItems(invItems || []);
        if (sups && sups.length > 0 && !supplierId && sups[0]) {
          setSupplierId(sups[0]._id);
        }
      })
      .catch((err) => {
        console.error("Failed to load bill masters:", err);
      });
  }, [open]);

  // Click outside listener for custom dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered inventory items for combobox search
  const searchedProducts = useMemo(() => {
    const q = productName.trim().toLowerCase();
    if (!q) return inventoryItems;
    return inventoryItems.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.category && it.category.toLowerCase().includes(q)) ||
        (it.genericName && it.genericName.toLowerCase().includes(q)) ||
        (it.itemCode && it.itemCode.toLowerCase().includes(q))
    );
  }, [productName, inventoryItems]);

  // Auto-calculated sequential serial number matching reference screenshot
  const nextSerialNo = useMemo(() => {
    return `SR-${String(lines.length + 1).padStart(3, "0")}`;
  }, [lines.length]);

  // Amount calculated for current particulars input
  const calculatedParticularsAmount = useMemo(() => {
    const qty = quantity || 0;
    const price = purchasePrice || 0;
    return Math.max(0, Math.round(qty * price * 100) / 100);
  }, [quantity, purchasePrice]);

  // Totals
  const subTotal = useMemo(() => {
    return lines.reduce((sum, l) => sum + (l.amount || 0), 0);
  }, [lines]);

  const shipping = addShipping ? Math.max(0, shippingCost || 0) : 0;
  const totalAmount = Math.round((subTotal + shipping) * 100) / 100;

  // Select an item from combobox
  const handleSelectProduct = (item: InventoryItemRow) => {
    setProductName(item.name);
    setUom(item.purchaseUom || item.salesUom || item.unit || "PCS");
    setPurchasePrice(item.defaultPurchasePrice || 0);
    setIsProductDropdownOpen(false);
  };

  // Add line to table
  const handleAddLine = () => {
    if (!productName.trim()) {
      toast.error("Please enter or select a Product Name.");
      return;
    }
    if ((quantity || 0) <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    const newLine: PurchaseLine = {
      id: "line_" + Date.now(),
      sNo: lines.length + 1,
      serialNo: nextSerialNo,
      productName: productName.trim(),
      quantity: quantity || 1,
      unit: uom || "PCS",
      purchasePrice: purchasePrice || 0,
      amount: calculatedParticularsAmount,
    };

    setLines((prev) => [...prev, newLine]);
    toast.success(`Added ${newLine.productName} to Purchase Bill`);

    // Reset entry row for fast next entry
    setProductName("");
    setQuantity(1);
    setPurchasePrice(0);
  };

  // Remove line
  const handleRemoveLine = (idx: number) => {
    setLines((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.map((l, i) => ({ ...l, sNo: i + 1 }));
    });
  };

  // Save Purchase Bill
  const handleSave = async () => {
    if (!supplierId) {
      toast.error("Please select a Supplier Name.");
      return;
    }
    if (!purchaseBillNo.trim()) {
      toast.error("Please enter Purchase Bill No.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Please add at least one line item to the bill.");
      return;
    }

    const sup = suppliers.find((s) => s._id === supplierId);

    setSubmitting(true);
    try {
      await createPurchaseBillFn({
        data: {
          supplierId,
          supplierName: sup?.name || "Supplier",
          billNumber: purchaseBillNo.trim(),
          billDate,
          taxType: "INTRA",
          subtotal: subTotal,
          discountTotal: 0,
          taxableTotal: subTotal,
          cgstTotal: 0,
          sgstTotal: 0,
          igstTotal: 0,
          otherCharges: shipping,
          roundOff: 0,
          grandTotal: totalAmount > 0 ? totalAmount : 1,
          remarks: remarks.trim() || undefined,
          items: lines.map((l, idx) => ({
            lineNo: idx + 1,
            itemType: "INVENTORY",
            description: l.productName,
            hsnCode: "3004",
            qty: l.quantity,
            freeQty: 0,
            unit: l.unit,
            purchaseRate: l.purchasePrice,
            mrp: l.purchasePrice * 1.25,
            discountPct: 0,
            gstPct: 0,
            taxableAmount: l.amount,
            taxAmount: 0,
            lineTotal: l.amount,
          })),
        },
      });

      toast.success("Purchase bill saved successfully!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("[SupplierBillFormModal] Save failed:", err);
      toast.error(err.message || "Failed to save purchase bill");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 gap-0 border border-slate-300 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-lg"
          aria-describedby="purchase-bill-desc"
        >
          {/* Top Window Header matching HiTech Desktop Frame */}
          <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                <FileSpreadsheet className="size-3.5" />
              </div>
              <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Unsaved Purchase Bill
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

          <p id="purchase-bill-desc" className="sr-only">
            Create or edit purchase bills and vendor invoices.
          </p>

          {/* Active Tab Strip */}
          <div className="px-4 pt-2 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <div className="px-3 py-1 bg-white dark:bg-slate-900 rounded-t border-t border-x border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs -mb-px">
              Purchase Bill
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* 1. Purchase Bill Information Card */}
            <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3 pt-4 shadow-xs">
              <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Purchase bill information
              </span>

              <div className="space-y-3">
                {/* Row 1: Purchase Type, Date, Supplier Name */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[100px]">
                      Purchase Type <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={purchaseType} onValueChange={(v: any) => setPurchaseType(v)}>
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
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[50px]">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[100px]">
                      Supplier Name <span className="text-rose-500">*</span>
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
                          <SelectValue placeholder="Select Supplier" />
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
                              {s.name} ({(s as any).code || "SUP"})
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

                {/* Row 2: Place of Supply, P. O. No., Purchase Bill No. */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                          <SelectItem key={st} value={st} className="text-xs">
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[50px]">
                      P. O. No.
                    </Label>
                    <Input
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder=""
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[100px]">
                      Purchase Bill No.
                    </Label>
                    <Input
                      value={purchaseBillNo}
                      onChange={(e) => setPurchaseBillNo(e.target.value)}
                      placeholder="e.g. INV-8821"
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono font-medium"
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
                {/* Mode toggle */}
                <div className="flex items-center gap-4 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="purchaseParticularsMode"
                      checked={particularsMode === "Tagging"}
                      onChange={() => setParticularsMode("Tagging")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Tagging</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="purchaseParticularsMode"
                      checked={particularsMode === "ItemCode"}
                      onChange={() => setParticularsMode("ItemCode")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Item Code</span>
                  </label>
                </div>

                {/* Main Particulars Inputs Grid matching Screenshot */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Product Name * with Decent Custom Combobox Dropdown */}
                  <div className="col-span-12 md:col-span-4 space-y-1 relative" ref={productDropdownRef}>
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Product Name <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <Input
                        value={productName}
                        onFocus={() => setIsProductDropdownOpen(true)}
                        onChange={(e) => {
                          setProductName(e.target.value);
                          setIsProductDropdownOpen(true);
                        }}
                        placeholder=""
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium pr-7"
                      />
                      <button
                        type="button"
                        onClick={() => setIsProductDropdownOpen((prev) => !prev)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        tabIndex={-1}
                      >
                        <ChevronDown
                          className={`size-3.5 transition-transform duration-150 ${
                            isProductDropdownOpen ? "rotate-180 text-blue-600" : ""
                          }`}
                        />
                      </button>
                    </div>

                    {/* Decent Floating Dropdown Menu */}
                    {isProductDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[320px] max-w-[420px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Inventory Products ({searchedProducts.length})</span>
                          <span className="text-[10px] text-slate-400">Click to select</span>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {searchedProducts.length === 0 ? (
                            <div className="p-3 text-xs text-center text-slate-400">
                              No products matching "{productName}". You can enter custom product name.
                            </div>
                          ) : (
                            searchedProducts.slice(0, 40).map((it) => (
                              <div
                                key={it.itemCode}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectProduct(it);
                                }}
                                className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between gap-2 transition-colors group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 group-hover:text-blue-600 truncate">
                                    {it.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium uppercase text-slate-600 dark:text-slate-300">
                                      {it.category || it.productType}
                                    </span>
                                    <span>•</span>
                                    <span>{it.purchaseUom || it.salesUom || it.unit || "PCS"}</span>
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

                  {/* UoM (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
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
                      min="0.01"
                      step="any"
                      value={quantity || ""}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs text-center font-mono font-bold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  {/* Purchase Price * with Blue ₹ Box (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-700 dark:text-slate-300">
                      Purchase Price <span className="text-rose-500">*</span>
                    </Label>
                    <div className="flex items-center">
                      <div className="flex h-7 items-center justify-center px-2.5 bg-[#1976d2] text-white text-xs font-bold rounded-l">
                        ₹
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={purchasePrice || ""}
                        onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                        placeholder=""
                        className="h-7 rounded-l-none text-xs font-mono font-semibold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  {/* Amount * with Blue ₹ Box (col-span-2) */}
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-700 dark:text-slate-300">
                        Amount <span className="text-rose-500">*</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center flex-1">
                        <div className="flex h-7 items-center justify-center px-2.5 bg-[#1976d2] text-white text-xs font-bold rounded-l">
                          ₹
                        </div>
                        <Input
                          readOnly
                          value={calculatedParticularsAmount || ""}
                          placeholder=""
                          className="h-7 rounded-l-none text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Green [+] Button matching reference screenshot */}
                      <button
                        type="button"
                        onClick={handleAddLine}
                        className="h-7 w-8 flex shrink-0 items-center justify-center rounded bg-[#2e7d32] hover:bg-[#1b5e20] text-white font-bold shadow-sm transition-transform active:scale-95"
                        title="Add Line"
                      >
                        <Plus className="size-4 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Second Row: Serial No. (Yellow background box matching screenshot) */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Serial No.</span>
                  <div className="h-7 px-4 min-w-[120px] flex items-center justify-center rounded bg-[#fff9c4] dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-mono text-xs font-bold shadow-xs">
                    {nextSerialNo}
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
                      <th className="py-2 px-4 w-16 text-center border-r border-blue-500/30">S. No.</th>
                      <th className="py-2 px-4 border-r border-blue-500/30">Product Name</th>
                      <th className="py-2 px-4 w-28 text-center border-r border-blue-500/30">Quantity</th>
                      <th className="py-2 px-4 w-24 text-center border-r border-blue-500/30">Unit</th>
                      <th className="py-2 px-4 w-32 text-right border-r border-blue-500/30">Purchase Price</th>
                      <th className="py-2 px-4 w-32 text-right border-r border-blue-500/30">Amount</th>
                      <th className="py-2 px-2 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No particulars added. Enter product details above and click the green [+] button.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, idx) => (
                        <tr
                          key={line.id}
                          className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2 px-4 text-center font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-4 font-medium text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                            {line.productName}
                          </td>
                          <td className="py-2 px-4 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {line.quantity}
                          </td>
                          <td className="py-2 px-4 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {line.unit}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {line.purchasePrice.toFixed(2)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                            {line.amount.toFixed(2)}
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

            {/* 4. Bottom Section: Bell, Shipping, Remarks & Calculations */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2">
              {/* Left Side: Bell Reminder, Shipping Checkbox, Remarks (col-span-7) */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Blue Bell Icon button */}
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(true)}
                    className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs transition-transform active:scale-95"
                    title="Set Payment Due Reminder"
                  >
                    <Bell className="size-6 fill-blue-600 text-blue-600" />
                  </button>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={addShipping}
                      onChange={(e) => setAddShipping(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Add Shipping and Packaging Costs</span>
                  </label>

                  {addShipping && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Shipping (₹):</span>
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

                {/* Remarks Groupbox */}
                <div className="relative rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 pt-3">
                  <span className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Remarks
                  </span>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder=""
                    className="w-full text-xs bg-transparent border-0 outline-none resize-none text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Right Side: Totals Summary & Save Button (col-span-5) */}
              <div className="md:col-span-5 space-y-4">
                <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span>Sub Total</span>
                    <span className="font-mono text-sm">₹ {subTotal.toFixed(2)}</span>
                  </div>

                  {addShipping && shipping > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Shipping &amp; Packaging</span>
                      <span className="font-mono">₹ {shipping.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex items-center justify-between text-slate-900 dark:text-white">
                    <span className="text-xs font-black uppercase tracking-wider">TOTAL AMOUNT</span>
                    <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400">
                      ₹ {totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Save Button matching reference screenshot */}
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={submitting}
                    className="h-9 px-6 gap-2 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs shadow-sm"
                  >
                    <Save className="size-3.5" />
                    <span>{submitting ? "Saving..." : "Save"}</span>
                  </Button>
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

      {/* New Supplier Modal matching desktop screen */}
      {showNewSupplierModal && (
        <NewSupplierModal
          open={showNewSupplierModal}
          onClose={() => setShowNewSupplierModal(false)}
          onSuccess={handleSupplierCreated}
        />
      )}
    </>
  );
}
