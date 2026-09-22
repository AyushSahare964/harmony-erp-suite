import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Bell,
  ChevronDown,
  Building2,
  Receipt,
  FileSpreadsheet,
  Clock,
  Package,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSuppliersFn, type SupplierMasterRow } from "@/lib/mongodb/serverFns/masters";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { BillingReminderModal } from "@/components/erp/billing/BillingReminderModal";
import { NewSupplierModal } from "@/components/erp/accounting/NewSupplierModal";
import { toast } from "sonner";

export interface PurchaseLine {
  id: string;
  sNo: number;
  serialNo?: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  amount: number;
}

export interface PurchaseBillWizardState {
  enabled: boolean;
  purchaseType: "GST" | "Non-GST" | "Bill of Supply";
  billDate: string;
  dueDate?: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  paymentMode: "CASH" | "BANK_TRANSFER" | "UPI" | "CARD" | "CHEQUE";
  paidAmount?: number;
  supplierId: string;
  supplierName: string;
  placeOfSupply: string;
  poNumber: string;
  purchaseBillNo: string;
  lines: PurchaseLine[];
  addShipping: boolean;
  shippingCost: number;
  remarks: string;
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

export interface PurchaseBillWizardSectionProps {
  currentProductName: string;
  currentProductUnit: string;
  currentOpeningStock: string | number;
  currentPurchasePrice: string | number;
  leadTimeDays: string;
  onLeadTimeDaysChange: (val: string) => void;
  minOrderQty: string;
  onMinOrderQtyChange: (val: string) => void;
  state: PurchaseBillWizardState;
  onChange: (patch: Partial<PurchaseBillWizardState>) => void;
  onSupplierSelected?: (supplier: { id: string; name: string }) => void;
}

export function PurchaseBillWizardSection({
  currentProductName,
  currentProductUnit,
  currentOpeningStock,
  currentPurchasePrice,
  leadTimeDays,
  onLeadTimeDaysChange,
  minOrderQty,
  onMinOrderQtyChange,
  state,
  onChange,
  onSupplierSelected,
}: PurchaseBillWizardSectionProps) {
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  const [particularsMode, setParticularsMode] = useState<"Tagging" | "ItemCode">("Tagging");

  // Particulars row input state
  const [rowProductName, setRowProductName] = useState("");
  const [rowUom, setRowUom] = useState(currentProductUnit || "PCS");
  const [rowQuantity, setRowQuantity] = useState<number>(1);
  const [rowPurchasePrice, setRowPurchasePrice] = useState<number>(0);

  // Dropdown combobox state
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Load suppliers and inventory catalog items
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listSuppliersFn().catch(() => [] as SupplierMasterRow[]),
      getItemsFn({ data: { status: "Active" } }).catch(() => [] as InventoryItemRow[]),
    ]).then(([sups, items]) => {
      if (cancelled) return;
      setSuppliers(sups || []);
      setInventoryItems(items || []);

      // If supplier is not set yet, pick first supplier or set defaults
      if (sups && sups.length > 0 && !state.supplierId) {
        const first = sups[0];
        if (first) {
          onChange({
            supplierId: first._id,
            supplierName: first.name,
          });
          onSupplierSelected?.({ id: first._id, name: first.name });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync current product info into row particulars inputs whenever current product props update
  useEffect(() => {
    if (!rowProductName && currentProductName) {
      setRowProductName(currentProductName);
    }
    if (currentProductUnit) {
      setRowUom(currentProductUnit);
    }
    const initialQty = Number(currentOpeningStock);
    if (!isNaN(initialQty) && initialQty > 0) {
      setRowQuantity(initialQty);
    }
    const initialPrice = Number(currentPurchasePrice);
    if (!isNaN(initialPrice) && initialPrice > 0) {
      setRowPurchasePrice(initialPrice);
    }
  }, [currentProductName, currentProductUnit, currentOpeningStock, currentPurchasePrice]);

  // Auto-seed initial line item if lines are empty and wizard has current product name
  useEffect(() => {
    if (state.lines.length === 0 && currentProductName.trim().length > 0) {
      const qty = Math.max(1, Number(currentOpeningStock) || 1);
      const price = Math.max(0, Number(currentPurchasePrice) || 0);
      const initialLine: PurchaseLine = {
        id: "line_init_" + Date.now(),
        sNo: 1,
        serialNo: "SR-001",
        productName: currentProductName.trim(),
        quantity: qty,
        unit: currentProductUnit || "PCS",
        purchasePrice: price,
        amount: Math.round(qty * price * 100) / 100,
      };
      onChange({ lines: [initialLine] });
    }
  }, [currentProductName, currentProductUnit, currentOpeningStock, currentPurchasePrice, state.lines.length]);

  // Click outside listener for product search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter products for combobox
  const searchedProducts = useMemo(() => {
    const q = rowProductName.trim().toLowerCase();
    if (!q) return inventoryItems;
    return inventoryItems.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.category && it.category.toLowerCase().includes(q)) ||
        (it.itemCode && it.itemCode.toLowerCase().includes(q))
    );
  }, [rowProductName, inventoryItems]);

  const nextSerialNo = useMemo(() => {
    return `SR-${String(state.lines.length + 1).padStart(3, "0")}`;
  }, [state.lines.length]);

  const calculatedRowAmount = useMemo(() => {
    const q = rowQuantity || 0;
    const p = rowPurchasePrice || 0;
    return Math.max(0, Math.round(q * p * 100) / 100);
  }, [rowQuantity, rowPurchasePrice]);

  const subTotal = useMemo(() => {
    return state.lines.reduce((acc, l) => acc + (l.amount || 0), 0);
  }, [state.lines]);

  const shipping = state.addShipping ? Math.max(0, state.shippingCost || 0) : 0;
  const totalAmount = Math.round((subTotal + shipping) * 100) / 100;

  const handleSelectProduct = (item: InventoryItemRow) => {
    setRowProductName(item.name);
    setRowUom(item.purchaseUom || item.salesUom || item.unit || "PCS");
    setRowPurchasePrice(item.defaultPurchasePrice || 0);
    setIsProductDropdownOpen(false);
  };

  const handleAddLine = () => {
    if (!rowProductName.trim()) {
      toast.error("Please enter a Product Name.");
      return;
    }
    if ((rowQuantity || 0) <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    const newLine: PurchaseLine = {
      id: "line_" + Date.now(),
      sNo: state.lines.length + 1,
      serialNo: nextSerialNo,
      productName: rowProductName.trim(),
      quantity: rowQuantity || 1,
      unit: rowUom || "PCS",
      purchasePrice: rowPurchasePrice || 0,
      amount: calculatedRowAmount,
    };

    const updated = [...state.lines, newLine];
    onChange({ lines: updated });
    toast.success(`Added ${newLine.productName} to Purchase Bill`);

    // Reset input fields
    setRowProductName("");
    setRowQuantity(1);
    setRowPurchasePrice(0);
  };

  const handleRemoveLine = (idx: number) => {
    const filtered = state.lines.filter((_, i) => i !== idx);
    const renumbered = filtered.map((l, i) => ({ ...l, sNo: i + 1 }));
    onChange({ lines: renumbered });
  };

  const handleSupplierCreated = (created: { _id: string; name: string }) => {
    listSuppliersFn().then((sups) => {
      setSuppliers(sups || []);
      onChange({
        supplierId: created._id,
        supplierName: created.name,
      });
      onSupplierSelected?.({ id: created._id, name: created.name });
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in-50">
      {/* Top Activation Banner */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
            <Receipt className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Auto-generate Inward Purchase Bill
              <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Billing Integrated
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              When saving this medicine, an official purchase bill will automatically be booked in the Billing &amp; Payments register.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="enable-pb" className="text-xs font-semibold cursor-pointer">
            {state.enabled ? "Enabled" : "Skip Bill"}
          </Label>
          <Switch
            id="enable-pb"
            checked={state.enabled}
            onCheckedChange={(checked) => onChange({ enabled: checked })}
          />
        </div>
      </div>

      {state.enabled && (
        <div className="space-y-4">
          {/* 1. Purchase Bill Information Box matching Screenshot 2 */}
          <div className="relative rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
            <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Purchase bill information
            </span>

            <div className="space-y-3">
              {/* Row 1: Purchase Type, Date, Supplier Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[90px]">
                    Purchase Type <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={state.purchaseType}
                    onValueChange={(v: any) => onChange({ purchaseType: v })}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
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
                  <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[40px]">
                    Date
                  </Label>
                  <Input
                    type="date"
                    value={state.billDate}
                    onChange={(e) => onChange({ billDate: e.target.value })}
                    className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[90px]">
                    Supplier Name <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Select
                      value={state.supplierId}
                      onValueChange={(val) => {
                        if (val === "ADD_NEW") {
                          setShowNewSupplierModal(true);
                        } else {
                          const found = suppliers.find((s) => s._id === val);
                          const name = found?.name || "";
                          onChange({ supplierId: val, supplierName: name });
                          onSupplierSelected?.({ id: val, name });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium flex-1 truncate">
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
                      className="h-8 w-8 flex items-center justify-center rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors shrink-0"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Place of Supply, P. O. No., Purchase Bill No. */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[90px]">
                    Place of Supply <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={state.placeOfSupply}
                    onValueChange={(val) => onChange({ placeOfSupply: val })}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
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
                  <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[40px]">
                    P. O. No.
                  </Label>
                  <Input
                    value={state.poNumber}
                    onChange={(e) => onChange({ poNumber: e.target.value })}
                    placeholder="e.g. PO-8821"
                    className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[90px]">
                    Purchase Bill No.
                  </Label>
                  <Input
                    value={state.purchaseBillNo}
                    onChange={(e) => onChange({ purchaseBillNo: e.target.value })}
                    placeholder="e.g. PB-2026-4843"
                    className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono font-bold text-blue-700 dark:text-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Particulars Groupbox matching Screenshot 2 */}
          <div className="relative rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
            <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Particulars
            </span>

            <div className="space-y-3">
              {/* Mode Toggle */}
              <div className="flex items-center gap-4 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="pbParticularsMode"
                    checked={particularsMode === "Tagging"}
                    onChange={() => setParticularsMode("Tagging")}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Tagging</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="pbParticularsMode"
                    checked={particularsMode === "ItemCode"}
                    onChange={() => setParticularsMode("ItemCode")}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Item Code</span>
                </label>
              </div>

              {/* Particulars Input Row */}
              <div className="grid grid-cols-12 gap-2 items-end">
                {/* Product Name with search combobox */}
                <div className="col-span-12 md:col-span-4 space-y-1 relative" ref={productDropdownRef}>
                  <Label className="text-xs text-slate-700 dark:text-slate-300">
                    Product Name <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative flex items-center">
                    <Input
                      value={rowProductName}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      onChange={(e) => {
                        setRowProductName(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
                      placeholder="e.g. Amoxicillin 250mg"
                      className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium pr-7"
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

                  {isProductDropdownOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[300px] max-w-[400px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                      <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Catalogue Items ({searchedProducts.length})</span>
                        <span className="text-[10px] text-slate-400">Click to select</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {searchedProducts.length === 0 ? (
                          <div className="p-2.5 text-xs text-center text-slate-400">
                            Custom item: "{rowProductName}"
                          </div>
                        ) : (
                          searchedProducts.slice(0, 30).map((it) => (
                            <div
                              key={it.itemCode}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectProduct(it);
                              }}
                              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors"
                            >
                              <div className="truncate">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                  {it.name}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                                  ({it.unit})
                                </span>
                              </div>
                              <span className="font-mono text-emerald-600 font-bold shrink-0">
                                ₹{it.defaultPurchasePrice || 0}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* UoM */}
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">UoM</Label>
                  <Select value={rowUom} onValueChange={setRowUom}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
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

                {/* Quantity */}
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">
                    Quantity <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={rowQuantity || ""}
                    onChange={(e) => setRowQuantity(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs text-center font-mono font-bold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                  />
                </div>

                {/* Purchase Price with Blue ₹ Box */}
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">
                    Purchase Price <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex items-center">
                    <div className="flex h-8 items-center justify-center px-2.5 bg-[#1976d2] text-white text-xs font-bold rounded-l">
                      ₹
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={rowPurchasePrice || ""}
                      onChange={(e) => setRowPurchasePrice(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="h-8 rounded-l-none text-xs font-mono font-semibold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Amount with Blue ₹ Box + Green [+] button */}
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">
                    Amount <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center flex-1">
                      <div className="flex h-8 items-center justify-center px-2 bg-[#1976d2] text-white text-xs font-bold rounded-l">
                        ₹
                      </div>
                      <Input
                        readOnly
                        value={calculatedRowAmount.toFixed(2)}
                        className="h-8 rounded-l-none text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="h-8 w-8 flex shrink-0 items-center justify-center rounded bg-[#2e7d32] hover:bg-[#1b5e20] text-white font-bold shadow-sm transition-transform active:scale-95"
                      title="Add line item to bill"
                    >
                      <Plus className="size-4 stroke-[3]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Serial No. Yellow Box */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Serial No.</span>
                <div className="h-7 px-3.5 min-w-[100px] flex items-center justify-center rounded bg-[#fff9c4] dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-mono text-xs font-bold shadow-xs">
                  {nextSerialNo}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Table / Data Grid with Signature HiTech Solid Blue Header */}
          <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1976d2] text-white font-bold text-xs select-none">
                    <th className="py-2 px-3 w-14 text-center border-r border-blue-500/30">S. No.</th>
                    <th className="py-2 px-4 border-r border-blue-500/30">Product Name</th>
                    <th className="py-2 px-3 w-24 text-center border-r border-blue-500/30">Quantity</th>
                    <th className="py-2 px-3 w-20 text-center border-r border-blue-500/30">Unit</th>
                    <th className="py-2 px-3 w-28 text-right border-r border-blue-500/30">Purchase Price</th>
                    <th className="py-2 px-3 w-28 text-right border-r border-blue-500/30">Amount</th>
                    <th className="py-2 px-2 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {state.lines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                        No particulars added. Enter product details above and click the green [+] button.
                      </td>
                    </tr>
                  ) : (
                    state.lines.map((line, idx) => (
                      <tr
                        key={line.id}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-center font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-4 font-medium text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                          {line.productName}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          {line.quantity}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {line.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          ₹{line.purchasePrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                          ₹{line.amount.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Remove row"
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

          {/* 4. Bottom Section: Bell, Shipping, Remarks & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-1">
            {/* Left Side: Reminder Bell, Shipping Checkbox, Remarks (col-span-7) */}
            <div className="md:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(true)}
                  className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs transition-transform active:scale-95"
                  title="Set Payment Due Reminder"
                >
                  <Bell className="size-5 fill-blue-600 text-blue-600" />
                </button>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={state.addShipping}
                    onChange={(e) => onChange({ addShipping: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Add Shipping and Packaging Costs</span>
                </label>

                {state.addShipping && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">Shipping (₹):</span>
                    <Input
                      type="number"
                      min="0"
                      value={state.shippingCost || ""}
                      onChange={(e) => onChange({ shippingCost: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-24 text-xs font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Remarks Box */}
              <div className="relative rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 pt-3">
                <span className="absolute -top-2 left-2 bg-white dark:bg-slate-900 px-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                  Remarks
                </span>
                <textarea
                  rows={2}
                  value={state.remarks}
                  onChange={(e) => onChange({ remarks: e.target.value })}
                  placeholder="e.g. Standard supplier inward batch on item creation"
                  className="w-full text-xs bg-transparent border-0 outline-none resize-none text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Right Side: Totals Summary & Payment Settlement (col-span-5) */}
            <div className="md:col-span-5">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Sub Total</span>
                  <span className="font-mono text-xs">₹ {subTotal.toFixed(2)}</span>
                </div>

                {state.addShipping && shipping > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Shipping &amp; Packaging</span>
                    <span className="font-mono text-xs">₹ {shipping.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex items-center justify-between text-slate-900 dark:text-white">
                  <span className="text-xs font-black uppercase tracking-wider">TOTAL AMOUNT</span>
                  <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400">
                    ₹ {totalAmount.toFixed(2)}
                  </span>
                </div>

                {/* Payment Settlement Options: Paid | Partial Paid | Unpaid */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Payment Settlement Status
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => onChange({ paymentStatus: "PAID", paidAmount: totalAmount })}
                      className={`py-1 px-1.5 rounded text-[11px] font-bold border transition-all text-center ${
                        state.paymentStatus === "PAID"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      ● Paid
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          paymentStatus: "PARTIAL",
                          paidAmount:
                            state.paidAmount && state.paidAmount > 0 && state.paidAmount < totalAmount
                              ? state.paidAmount
                              : Math.round((totalAmount / 2) * 100) / 100,
                        })
                      }
                      className={`py-1 px-1.5 rounded text-[11px] font-bold border transition-all text-center ${
                        state.paymentStatus === "PARTIAL"
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      ◐ Partial Paid
                    </button>

                    <button
                      type="button"
                      onClick={() => onChange({ paymentStatus: "UNPAID", paidAmount: 0 })}
                      className={`py-1 px-1.5 rounded text-[11px] font-bold border transition-all text-center ${
                        state.paymentStatus === "UNPAID"
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      ○ Unpaid
                    </button>
                  </div>

                  {/* Partial Payment Amount Input */}
                  {state.paymentStatus === "PARTIAL" && (
                    <div className="p-2 rounded bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-1.5 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                          Paid Amount (₹):
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max={totalAmount}
                          step="any"
                          value={state.paidAmount !== undefined ? state.paidAmount : ""}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(totalAmount, parseFloat(e.target.value) || 0));
                            onChange({ paidAmount: val });
                          }}
                          className="h-7 w-28 text-right font-mono font-bold text-xs bg-white dark:bg-slate-900 border-amber-300"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        <span>Balance Due:</span>
                        <span className="font-mono font-bold">
                          ₹ {Math.max(0, totalAmount - (state.paidAmount || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Payment Mode Selector (for Paid or Partial) */}
                  {state.paymentStatus !== "UNPAID" && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Mode:</span>
                      <Select
                        value={state.paymentMode || "CASH"}
                        onValueChange={(val: any) => onChange({ paymentMode: val })}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer / NEFT</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="CARD">Card</SelectItem>
                          <SelectItem value="CHEQUE">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Due Date if Unpaid or Partial */}
                  {state.paymentStatus !== "PAID" && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Due Date:</span>
                      <Input
                        type="date"
                        value={state.dueDate || ""}
                        onChange={(e) => onChange({ dueDate: e.target.value })}
                        className="h-7 text-xs flex-1 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Master Supplier Policy Parameters */}
      <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
        <div className="flex items-center gap-2 border-b pb-1.5">
          <Building2 className="size-4 text-primary" />
          <span className="text-xs font-bold text-foreground">
            Supplier Lead Time &amp; Ordering Policies
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Supplier Lead Time (Days)</Label>
            <Input
              type="number"
              min="1"
              placeholder="7"
              value={leadTimeDays}
              onChange={(e) => onLeadTimeDaysChange(e.target.value)}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Average delivery time expected from this supplier for PO replenishment.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Minimum Order Quantity (MOQ)</Label>
            <Input
              type="number"
              min="1"
              placeholder="1"
              value={minOrderQty}
              onChange={(e) => onMinOrderQtyChange(e.target.value)}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Lowest package / unit quantity the supplier accepts per purchase order.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNewSupplierModal && (
        <NewSupplierModal
          open={showNewSupplierModal}
          onClose={() => setShowNewSupplierModal(false)}
          onSuccess={handleSupplierCreated}
        />
      )}

      {showReminderModal && (
        <BillingReminderModal
          open={showReminderModal}
          onClose={() => setShowReminderModal(false)}
        />
      )}
    </div>
  );
}
