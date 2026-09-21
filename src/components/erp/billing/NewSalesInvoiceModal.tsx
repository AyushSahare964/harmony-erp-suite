import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Receipt,
  Calculator,
  Bell,
  Printer,
  Save,
  AlertCircle,
  Building2,
  Dog,
  User,
  Check,
  Package,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATE_CODES } from "@/lib/finance/stateCodes";
import { todayIST } from "@/lib/utils/dateUtils";
import { roundMoney } from "@/lib/utils/moneyUtils";
import { computeDocument, type TaxDocInput } from "@/lib/finance/taxEngine";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { finalizeVisitAndBillFn } from "@/lib/mongodb/serverFns/clinical";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { useErp } from "@/lib/erp/store";
import { useInventory } from "@/components/erp/inventory/useInventoryStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { InvoicePrintView } from "@/components/erp/clinical/InvoicePrintView";

interface InvoiceGridLine {
  id: string;
  sNo: number;
  itemName: string;
  itemDescription?: string | undefined;
  tag: string;
  quantity: number;
  uom: string;
  salePrice: number;
  discountPct: number;
  gstRate: number;
  amount: number;
  serialNo?: string | undefined;
}

const COMMON_UOMS = ["PCS", "STRIP", "TAB", "BOTTLE", "VIAL", "ML", "GM", "KG", "BOX", "DOSE", "SESSION"];

const CLINIC_STAFF_OPTIONS = [
  "Dr. Rohit Sharma",
  "Dr. Aisha Nair",
  "Dr. Vikram Rao",
  "Sneha Kulkarni (Pharmacy)",
  "Jyoti Sahare (Front Desk)",
  "Cashier / Front Desk",
  "Other",
];

const ITEM_CATEGORIES = [
  { id: "ALL", label: "All Categories" },
  { id: "MEDICINE", label: "Medicines & Rx" },
  { id: "FOOD", label: "Pet Food & Diets" },
  { id: "ACCESSORY", label: "Accessories & Care" },
  { id: "CONSUMABLE", label: "Consumables & Surgery" },
  { id: "SERVICE", label: "Clinical Services" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onInvoiceCreated?: (newInvoice: any) => void;
  initialPet?: any;
}

export function NewSalesInvoiceModal({ open, onClose, onInvoiceCreated, initialPet }: Props) {
  const { currentUser, role } = useErp();
  const activeDoctorName =
    currentUser?.fullName || (currentUser?.roleId === "doctor" ? currentUser.fullName : role?.person || "Dr. Rohit Sharma");

  const { medicines } = useInventory();

  // Set once "Save and Print" finishes — swaps this modal over to the real formatted
  // InvoicePrintView instead of the previous raw window.print() of the unstyled form.
  const [printableInvoice, setPrintableInvoice] = useState<any | null>(null);

  // ── 1. Invoice Header Information State ──
  const [invoiceType, setInvoiceType] = useState<"GST" | "NON_GST" | "BILL_OF_SUPPLY">("GST");
  const [docDate, setDocDate] = useState(todayIST());
  const [soldBy, setSoldBy] = useState(activeDoctorName || "Dr. Rohit Sharma");
  const [customSoldBy, setCustomSoldBy] = useState("");
  const [linkTo, setLinkTo] = useState<"COUNTER_SALE" | "CLIENT_ACCOUNT">("COUNTER_SALE");
  const [mobileNo, setMobileNo] = useState("");
  const [clientName, setClientName] = useState("CASH");
  const [address, setAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("27"); // Maharashtra
  const [clientGstin, setClientGstin] = useState("");

  // Customer Type: Patient vs Other / General Client
  const [customerType, setCustomerType] = useState<"PATIENT" | "OTHER">("PATIENT");
  const [otherClientType, setOtherClientType] = useState("Walk-in Retail / OTC");
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [showRegisterPetModal, setShowRegisterPetModal] = useState(false);

  // ── 2. Inventory Items & Category Selection ──
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  const [itemCategory, setItemCategory] = useState<string>("ALL");

  // ── 3. Particulars Line Entry State ──
  const [particularsMode, setParticularsMode] = useState<"Tagging" | "ItemCode">("Tagging");
  const [serialCode, setSerialCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [uom, setUom] = useState("PCS");
  const [quantity, setQuantity] = useState<number>(1);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [lineSerialNo, setLineSerialNo] = useState("");

  // Grid Lines
  const [lines, setLines] = useState<InvoiceGridLine[]>([]);

  // ── 4. Footer, Shipping & Partial Payment Details ──
  const [addShipping, setAddShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [hasInvoiceRef, setHasInvoiceRef] = useState(false);
  const [invoiceRefNo, setInvoiceRefNo] = useState("");

  const [paymentMode, setPaymentMode] = useState<"Cash" | "Cheque" | "Card" | "Mobile Wallet" | "Demand Draft" | "Bank Transfer">("Cash");
  const [paymentType, setPaymentType] = useState<"FULL" | "PARTIAL" | "UNPAID">("FULL");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [remarksPrivate, setRemarksPrivate] = useState("");

  const [saving, setSaving] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // Auto-calculated next serial number with respect to existing lines count
  const autoGeneratedSerialNo = useMemo(() => {
    return `SR-${String(lines.length + 1).padStart(3, "0")}`;
  }, [lines.length]);

  // Keep serialCode in sync with line count unless user specifically typed a custom code
  useEffect(() => {
    setSerialCode(autoGeneratedSerialNo);
  }, [autoGeneratedSerialNo]);

  // Load pets and inventory items on open
  useEffect(() => {
    if (open) {
      listPetsWithOwnersFn()
        .then((data) => {
          setPets(data || []);
          if (initialPet) {
            setSelectedPetId(initialPet.petId || initialPet._id);
            setClientName(initialPet.owner?.name || initialPet.ownerName || "CASH");
            setMobileNo(initialPet.owner?.phone || initialPet.ownerPhone || "");
            setLinkTo("CLIENT_ACCOUNT");
            setCustomerType("PATIENT");
          }
        })
        .catch(console.error);

      getItemsFn({ data: { status: "Active" } })
        .then((items) => {
          if (items && items.length > 0) {
            setInventoryItems(items);
          }
        })
        .catch(console.error);
    }
  }, [open, initialPet]);

  // Filter inventory items based on selected category
  const filteredInventoryItems = useMemo(() => {
    let list: any[] = inventoryItems;
    if (list.length === 0 && medicines && medicines.length > 0) {
      // Fallback to cache medicines
      list = medicines.map((m: any) => ({
        itemCode: m.itemCode || m.id || "M-001",
        name: m.name,
        productType: (m.type || "MEDICINE") as any,
        genericName: m.genericName || "",
        brand: m.brand || "",
        manufacturer: m.manufacturer || "",
        description: m.description || "",
        category: m.category || "Medicine",
        subGroup: "",
        hasVariants: false,
        sku: m.sku || "",
        unit: m.unit || "PCS",
        purchaseUom: m.purchaseUom || "PCS",
        salesUom: m.salesUom || "PCS",
        uomConversions: [],
        maintainStock: true,
        valuationMethod: "FEFO",
        currentStock: m.currentStock || 10,
        minStockLevel: 5,
        reorderLevel: 10,
        defaultSalePrice: m.defaultSalePrice || m.mrp || 0,
        defaultPurchasePrice: m.purchaseRate || 0,
        mrp: m.mrp || 0,
        minSalePrice: 0,
        isTaxExempt: false,
        status: "Active",
      }));
    }

    if (itemCategory !== "ALL") {
      list = list.filter((i) => {
        if (itemCategory === "MEDICINE") {
          return i.productType === "MEDICINE" || i.category?.toLowerCase().includes("med");
        }
        if (itemCategory === "FOOD") {
          return i.productType === "FOOD" || i.category?.toLowerCase().includes("food");
        }
        if (itemCategory === "ACCESSORY") {
          return i.productType === "ACCESSORY" || i.category?.toLowerCase().includes("access");
        }
        if (itemCategory === "CONSUMABLE") {
          return i.category?.toLowerCase().includes("consum") || i.category?.toLowerCase().includes("surg");
        }
        if (itemCategory === "SERVICE") {
          return i.category?.toLowerCase().includes("serv") || i.category?.toLowerCase().includes("proc");
        }
        return true;
      });
    }
    return list;
  }, [inventoryItems, medicines, itemCategory]);

  const [isInvoiceItemDropdownOpen, setIsInvoiceItemDropdownOpen] = useState(false);
  const invoiceItemDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (invoiceItemDropdownRef.current && !invoiceItemDropdownRef.current.contains(e.target as Node)) {
        setIsInvoiceItemDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchedInvoiceItems = useMemo(() => {
    const q = itemName.trim().toLowerCase();
    if (!q) return filteredInventoryItems;
    return filteredInventoryItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.genericName && m.genericName.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
    );
  }, [itemName, filteredInventoryItems]);

  // When Link To changes
  useEffect(() => {
    if (linkTo === "COUNTER_SALE" && !clientName) {
      setClientName("CASH");
    } else if (linkTo === "CLIENT_ACCOUNT" && clientName === "CASH") {
      setClientName("");
    }
  }, [linkTo]);

  // When pet is selected in dropdown
  const handlePetSelect = (petId: string) => {
    if (!petId || petId === "WALKIN") {
      setSelectedPetId("");
      return;
    }
    setSelectedPetId(petId);
    const pet = pets.find((p) => p.petId === petId || p._id === petId);
    if (pet) {
      setClientName(pet.owner?.name || pet.ownerName || "CASH");
      setMobileNo(pet.owner?.phone || pet.ownerPhone || "");
      if (pet.owner?.address) setAddress(pet.owner.address);
      setLinkTo("CLIENT_ACCOUNT");
      setCustomerType("PATIENT");
    }
  };

  // Quick select an item from the category / inventory browse
  const handleSelectInventoryItem = (item: InventoryItemRow) => {
    setItemName(item.name);
    setUom(item.salesUom || item.unit || "PCS");
    setSalePrice(item.defaultSalePrice || item.mrp || 0);
    const gst =
      (item as any).gstRate !== undefined
        ? (item as any).gstRate
        : item.productType === "MEDICINE"
        ? 12
        : item.productType === "FOOD"
        ? 18
        : 18;
    setGstRate(gst);
    setItemDescription(item.genericName || item.brand || item.description || "");
    if ((item as any).batchNumber || (item as any).medicineDetails?.batchNumber) {
      setLineSerialNo((item as any).batchNumber || (item as any).medicineDetails?.batchNumber);
    }
    setQuantity(1);
    itemInputRef.current?.focus();
  };

  // Particulars Amount calculation
  const calculatedParticularsAmount = useMemo(() => {
    const gross = (quantity || 0) * (salePrice || 0);
    const disc = (gross * (discountPct || 0)) / 100;
    return Math.max(0, gross - disc);
  }, [quantity, salePrice, discountPct]);

  // Document Totals using pure Tax Engine
  const totals = useMemo(() => {
    if (lines.length === 0) {
      const ship = addShipping ? Math.max(0, shippingCost || 0) : 0;
      return {
        subTotal: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        taxTotal: 0,
        shipping: ship,
        roundOff: 0,
        grandTotal: ship,
      };
    }

    // Bill of Supply is a real, distinct invoice type (GST-exempt / composition
    // scheme) that must charge zero tax — collapsing it into "GST" here would
    // silently charge tax on a document type the law says is untaxed.
    const taxInvoiceType = invoiceType === "GST" ? "GST" : invoiceType;
    const docInput: TaxDocInput = {
      lines: lines.map((l) => ({
        quantity: l.quantity,
        rate: l.salePrice,
        discountType: "percentage",
        discountValue: l.discountPct,
        gstRate: taxInvoiceType === "GST" ? l.gstRate : 0,
      })),
      invoiceType: taxInvoiceType,
      branchStateCode: "27",
      placeOfSupply,
      shippingAmount: addShipping ? Math.max(0, shippingCost || 0) : 0,
    };

    const res = computeDocument(docInput);

    return {
      subTotal: res.subTotal,
      taxable: res.taxableValue,
      cgst: res.cgst,
      sgst: res.sgst,
      igst: res.igst,
      taxTotal: res.taxTotal,
      shipping: addShipping ? Math.max(0, shippingCost || 0) : 0,
      roundOff: res.roundOff,
      grandTotal: res.grandTotal,
    };
  }, [lines, invoiceType, placeOfSupply, addShipping, shippingCost]);

  // Sync paidAmount when grandTotal changes based on paymentType
  useEffect(() => {
    if (paymentType === "FULL") {
      setPaidAmount(totals.grandTotal);
    } else if (paymentType === "UNPAID") {
      setPaidAmount(0);
    }
  }, [totals.grandTotal, paymentType]);

  // Derived effective payment figures
  const effectivePaidAmount = useMemo(() => {
    if (paymentType === "FULL") return totals.grandTotal;
    if (paymentType === "UNPAID") return 0;
    return Math.max(0, Math.min(totals.grandTotal, paidAmount || 0));
  }, [paymentType, totals.grandTotal, paidAmount]);

  const balanceDue = useMemo(() => {
    return Math.max(0, totals.grandTotal - effectivePaidAmount);
  }, [totals.grandTotal, effectivePaidAmount]);

  // Push line to grid (Green [+] button)
  const handleAddLine = () => {
    if (!itemName.trim()) {
      toast.error("Please enter an Item Name");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (salePrice < 0) {
      toast.error("Sale price cannot be negative");
      return;
    }

    const assignedTag = serialCode.trim() || autoGeneratedSerialNo;

    const newLine: InvoiceGridLine = {
      id: "line_" + Date.now(),
      sNo: lines.length + 1,
      itemName: itemName.trim(),
      itemDescription: itemDescription.trim() || undefined,
      tag: assignedTag,
      quantity,
      uom,
      salePrice,
      discountPct: discountPct || 0,
      gstRate: invoiceType === "NON_GST" ? 0 : gstRate,
      amount: calculatedParticularsAmount,
      serialNo: lineSerialNo || undefined,
    };

    setLines((prev) => [...prev, newLine]);

    // Reset particulars entry fields
    setItemName("");
    setItemDescription("");
    setQuantity(1);
    setSalePrice(0);
    setDiscountPct(0);
    setLineSerialNo("");
    itemInputRef.current?.focus();
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.map((l, i) => ({
        ...l,
        sNo: i + 1,
        tag: `SR-${String(i + 1).padStart(3, "0")}`,
      }));
    });
  };

  // Keyboard shortcuts (F9 Save, F10 Save & Print, Esc)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        void handleSave(false);
      } else if (e.key === "F10") {
        e.preventDefault();
        void handleSave(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, lines, totals, clientName, mobileNo, paymentMode, paidAmount, paymentType]);

  const handleSave = async (andPrint = false) => {
    if (lines.length === 0) {
      toast.error("Please add at least one line item to the invoice");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Client Name is required");
      return;
    }

    setSaving(true);
    try {
      const isPatient = customerType === "PATIENT" && Boolean(selectedPetId && selectedPetId !== "WALKIN");
      const selectedPet = isPatient ? pets.find((p) => p.petId === selectedPetId || p._id === selectedPetId) : null;

      const generatedVisitId =
        initialPet?.visitId ||
        `V-POS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const mappedPaymentMode: "UPI" | "Cash" | "Card" | "NetBanking" | "Cheque" | "Account Due" =
        paymentType === "UNPAID"
          ? "Account Due"
          : paymentMode === "Mobile Wallet"
          ? "UPI"
          : paymentMode === "Demand Draft"
          ? "Cheque"
          : paymentMode === "Bank Transfer"
          ? "NetBanking"
          : paymentMode === "Card"
          ? "Card"
          : paymentMode === "Cheque"
          ? "Cheque"
          : "Cash";

      const effectiveDoctorName = soldBy === "Other" ? customSoldBy.trim() || "Staff" : soldBy;

      const paymentStatus: "Full" | "Partial" | "Unpaid" =
        balanceDue === 0 ? "Full" : effectivePaidAmount > 0 ? "Partial" : "Unpaid";

      const payload = {
        visitId: generatedVisitId,
        petId: selectedPet?.petId || (customerType === "OTHER" ? "RETAIL-CLIENT" : "OTC-WALKIN"),
        petName:
          selectedPet?.name ||
          (customerType === "OTHER"
            ? `${clientName.trim() || "Retail"} (${otherClientType})`
            : clientName.trim() && clientName.trim() !== "CASH"
            ? `${clientName.trim()}'s Pet`
            : "General OTC Walk-in"),
        species: selectedPet?.species || (customerType === "OTHER" ? "General Client" : "Canine"),
        breed: selectedPet?.breed || (customerType === "OTHER" ? otherClientType : "General"),
        ownerId: selectedPet?.ownerId || "WALKIN",
        ownerName: clientName.trim() || "CASH",
        ownerPhone: mobileNo.trim() || undefined,
        branch: "Main Clinic",
        billType: invoiceType === "NON_GST" ? ("Non-GST" as const) : ("GST" as const),
        doctorName: effectiveDoctorName,
        diagnosis: deliveryTerms
          ? `Terms: ${deliveryTerms}`
          : customerType === "OTHER"
          ? `Retail Sale: ${otherClientType}`
          : "Counter Sale & Services",
        clinicalNotes: remarksPrivate.trim() || undefined,
        items: lines.map((l, idx) => {
          const discPct = Math.min(100, Math.max(0, l.discountPct || 0));
          const gross = (l.quantity || 1) * (l.salePrice || 0);
          const discAmt = (gross * discPct) / 100;
          const taxable = Math.max(0, gross - discAmt);
          return {
            lineType: "Pharmacy" as const,
            name: l.itemName + (l.itemDescription ? ` (${l.itemDescription})` : ""),
            quantity: Math.max(1, l.quantity || 1),
            unitPrice: Math.max(0, l.salePrice || 0),
            discountPercent: discPct,
            discountType: "percentage" as const,
            discountValue: discPct,
            discountAmount: discAmt,
            taxableAmount: taxable,
            gstRate: invoiceType === "GST" ? Math.max(0, l.gstRate || 0) : 0,
            lineTotal: l.amount,
          };
        }),
        subtotal: totals.subTotal,
        billDiscount: 0,
        taxableAmount: totals.taxable,
        gstAmount: totals.taxTotal,
        roundOff: totals.roundOff,
        totalAmount: totals.grandTotal,
        amountPaid: effectivePaidAmount,
        pendingAmount: balanceDue,
        paymentStatus,
        paymentMode: mappedPaymentMode,
        trxRef: hasInvoiceRef ? invoiceRefNo : undefined,
      };

      const res = await finalizeVisitAndBillFn({ data: payload });
      const invoiceLabel = res.invoiceNo || "Generated";

      if (paymentStatus === "Partial") {
        toast.success(
          `Invoice ${invoiceLabel} saved! Paid: ₹${effectivePaidAmount.toFixed(2)}, Balance Due: ₹${balanceDue.toFixed(2)}`
        );
      } else if (paymentStatus === "Unpaid") {
        toast.info(`Credit Invoice ${invoiceLabel} saved! Balance Due: ₹${balanceDue.toFixed(2)}`);
      } else {
        toast.success(`Invoice ${invoiceLabel} saved fully paid!`);
      }

      onInvoiceCreated?.(res);

      if (andPrint) {
        // Show the real formatted invoice (same component finalized clinical visits use)
        // instead of window.print()-ing the raw, unstyled entry form.
        setPrintableInvoice(res);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error("[NewSalesInvoiceModal] Save failed:", err);
      toast.error(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  if (printableInvoice) {
    return (
      <InvoicePrintView
        visit={printableInvoice}
        open={true}
        onClose={() => {
          setPrintableInvoice(null);
          onClose();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden border-border bg-card shadow-2xl rounded-2xl">
        {/* Window Title Bar */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Receipt className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">Unsaved Invoice</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              F9: Save • F10: Save &amp; Print
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* ── 1. GROUPBOX: Invoice Information (Matching Image 4) ── */}
          <fieldset className="rounded-xl border border-border bg-card/60 p-3.5 space-y-3 relative">
            <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Invoice information
            </legend>

            {/* Row 1: Invoice Type, Date, Sold By Dropdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">
                  Invoice Type <span className="text-rose-500">*</span>
                </Label>
                <Select value={invoiceType} onValueChange={(v: any) => setInvoiceType(v)}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST">GST</SelectItem>
                    <SelectItem value="NON_GST">Non-GST</SelectItem>
                    <SelectItem value="BILL_OF_SUPPLY">Bill of Supply</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Date</Label>
                <Input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="h-8 text-xs bg-background font-mono"
                />
              </div>

              {/* Sold By: Interactive Dropdown with clinic staff & custom entry */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Sold By</Label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={CLINIC_STAFF_OPTIONS.includes(soldBy) ? soldBy : "Other"}
                    onValueChange={(val) => {
                      if (val === "Other") {
                        setSoldBy("Other");
                      } else {
                        setSoldBy(val);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background flex-1">
                      <SelectValue placeholder="Select Staff / Doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINIC_STAFF_OPTIONS.map((staff) => (
                        <SelectItem key={staff} value={staff}>
                          {staff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {soldBy === "Other" && (
                    <Input
                      value={customSoldBy}
                      onChange={(e) => setCustomSoldBy(e.target.value)}
                      placeholder="Staff name..."
                      className="h-8 text-xs bg-background w-36"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Link To (Counter Sale / Client Account), Mobile No., Client Name */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Link To</Label>
                <div className="flex items-center gap-4 h-8">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="linkTo"
                      checked={linkTo === "COUNTER_SALE"}
                      onChange={() => setLinkTo("COUNTER_SALE")}
                      className="size-3.5 text-primary"
                    />
                    <span>Counter Sale</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="linkTo"
                      checked={linkTo === "CLIENT_ACCOUNT"}
                      onChange={() => setLinkTo("CLIENT_ACCOUNT")}
                      className="size-3.5 text-primary"
                    />
                    <span>Client Account</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Mobile No.</Label>
                <Input
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="e.g. +91 83438 43834"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">
                  Client Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="CASH"
                  className="h-8 text-xs font-semibold bg-background"
                />
              </div>
            </div>

            {/* Row 3: Address, Place of Supply, Client GSTIN & Customer Type (Patient vs Other) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs font-medium text-foreground">Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Nagpur / Local Address..."
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs font-medium text-foreground">
                  Place of Supply <span className="text-rose-500">*</span>
                </Label>
                <Select value={placeOfSupply} onValueChange={setPlaceOfSupply}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {STATE_CODES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-medium text-foreground">Client GSTIN</Label>
                <Input
                  value={clientGstin}
                  onChange={(e) => setClientGstin(e.target.value.toUpperCase())}
                  placeholder="27AAAAA0000A1Z5"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              {/* Customer Selector: Patient / Pet vs Other */}
              <div className="space-y-1 md:col-span-4">
                <div className="flex items-center justify-between pb-0.5">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                    {customerType === "PATIENT" ? (
                      <Dog className="size-3 text-primary" />
                    ) : (
                      <Building2 className="size-3 text-primary" />
                    )}
                    <span>{customerType === "PATIENT" ? "Patient / Pet" : "Customer / Client Type"}</span>
                  </Label>
                  <div className="inline-flex rounded-md bg-muted p-0.5 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setCustomerType("PATIENT")}
                      className={cn(
                        "px-2 py-0.5 rounded transition-all",
                        customerType === "PATIENT"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerType("OTHER");
                        setSelectedPetId("");
                        if (!clientName) setClientName("CASH");
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded transition-all",
                        customerType === "OTHER"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Other
                    </button>
                  </div>
                </div>

                {customerType === "PATIENT" ? (
                  <div className="flex gap-1.5 items-center">
                    <Select value={selectedPetId} onValueChange={handlePetSelect}>
                      <SelectTrigger className="h-8 text-xs bg-background flex-1">
                        <SelectValue placeholder="Walk-in / Select Pet" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="WALKIN">-- Walk-in General Patient --</SelectItem>
                        {pets.map((p) => (
                          <SelectItem key={p.petId || p._id} value={p.petId || p._id}>
                            {p.name} ({p.breed || p.species}) - {p.owner?.name || "Owner"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowRegisterPetModal(true)}
                      title="Register New Pet & Owner (Client Intake)"
                      className="size-8 shrink-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Select value={otherClientType} onValueChange={setOtherClientType}>
                    <SelectTrigger className="h-8 text-xs bg-background font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Walk-in Retail / OTC">Walk-in Retail / OTC Customer</SelectItem>
                      <SelectItem value="External Client / Pet Parent">External Client / Non-Patient</SelectItem>
                      <SelectItem value="Breeder / Kennel / Farm">Breeder / Kennel / Farm</SelectItem>
                      <SelectItem value="Rescue / NGO / Shelter">Rescue / NGO / Shelter</SelectItem>
                      <SelectItem value="Corporate / Institution">Corporate / Institutional Partner</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </fieldset>

          {/* ── 2. GROUPBOX: Particulars Line Entry (Matching Image 4) ── */}
          <fieldset className="rounded-xl border border-border bg-card/60 p-3.5 space-y-3 relative">
            <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Particulars
            </legend>

            {/* Mode & Category Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="particularsMode"
                    checked={particularsMode === "Tagging"}
                    onChange={() => setParticularsMode("Tagging")}
                    className="size-3.5 text-primary"
                  />
                  <span>Tagging</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="particularsMode"
                    checked={particularsMode === "ItemCode"}
                    onChange={() => setParticularsMode("ItemCode")}
                    className="size-3.5 text-primary"
                  />
                  <span>Item Code</span>
                </label>
              </div>

              {/* Category Filter for Inventory Items */}
              <div className="flex items-center gap-2">
                <Label className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                  Inventory Category:
                </Label>
                <div className="flex items-center gap-1.5">
                  <Select value={itemCategory} onValueChange={setItemCategory}>
                    <SelectTrigger className="h-7 text-xs bg-background w-44 font-medium">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Inventory Quick Pick Dropdown */}
                  <Select
                    value=""
                    onValueChange={(selectedCode) => {
                      const item = filteredInventoryItems.find((it) => it.itemCode === selectedCode);
                      if (item) {
                        handleSelectInventoryItem(item);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-primary/10 border-primary/20 text-primary font-semibold w-48">
                      <SelectValue placeholder={`Browse Items (${filteredInventoryItems.length})`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 w-80">
                      {filteredInventoryItems.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No items found in this category
                        </div>
                      ) : (
                        filteredInventoryItems.slice(0, 50).map((it) => (
                          <SelectItem key={it.itemCode} value={it.itemCode}>
                            <div className="flex flex-col text-left py-0.5">
                              <span className="font-semibold text-foreground">{it.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {it.itemCode} • ₹{it.defaultSalePrice || it.mrp || 0} • {it.salesUom || it.unit || "PCS"}{" "}
                                {it.currentStock !== undefined ? `(Stock: ${it.currentStock})` : ""}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Input Row: Serial No (yellow auto-generated), Item Name with [+] button, UoM, Qty, Sale Price, Discount, Amount, Add [+] */}
            <div className="grid grid-cols-12 gap-2 items-end">
              {/* Serial No. (yellow highlight input from screenshot, automatically generated based on line existence) */}
              <div className="col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">Serial No.</Label>
                  <span className="text-[9px] text-amber-700 dark:text-amber-400 font-mono font-bold">Auto</span>
                </div>
                <Input
                  value={serialCode || autoGeneratedSerialNo}
                  onChange={(e) => setSerialCode(e.target.value)}
                  placeholder={autoGeneratedSerialNo}
                  className="h-8 text-xs font-mono bg-amber-100/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 font-bold"
                />
              </div>

              {/* Item Name with datalist search */}
              <div className="col-span-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">
                    Item Name <span className="text-rose-500">*</span>
                  </Label>
                  {filteredInventoryItems.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({filteredInventoryItems.length} available)
                    </span>
                  )}
                </div>
                <div className="relative" ref={invoiceItemDropdownRef}>
                  <div className="relative flex items-center">
                    <Input
                      ref={itemInputRef}
                      value={itemName}
                      onFocus={() => setIsInvoiceItemDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItemName(val);
                        setIsInvoiceItemDropdownOpen(true);
                      }}
                      placeholder="Type or select item name..."
                      className="h-8 text-xs bg-background flex-1 font-semibold pr-7"
                    />
                    <button
                      type="button"
                      onClick={() => setIsInvoiceItemDropdownOpen((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      tabIndex={-1}
                    >
                      <ChevronDown className={`size-3.5 transition-transform duration-150 ${isInvoiceItemDropdownOpen ? "rotate-180 text-primary" : ""}`} />
                    </button>
                  </div>

                  {/* Decent Floating Dropdown Menu */}
                  {isInvoiceItemDropdownOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[340px] max-w-[440px] rounded-lg border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                      <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Available Items ({searchedInvoiceItems.length})</span>
                        <span className="text-[10px]">Click to select</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-border">
                        {searchedInvoiceItems.length === 0 ? (
                          <div className="p-3 text-xs text-center text-muted-foreground">
                            No items matching "{itemName}".
                          </div>
                        ) : (
                          searchedInvoiceItems.slice(0, 40).map((m) => (
                            <div
                              key={m.itemCode}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectInventoryItem(m);
                                setIsInvoiceItemDropdownOpen(false);
                              }}
                              className="p-2.5 hover:bg-muted/60 cursor-pointer flex items-center justify-between gap-2 transition-colors group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs text-foreground group-hover:text-primary truncate">
                                  {m.name}
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                  <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-medium uppercase">
                                    {m.category || m.productType}
                                  </span>
                                  <span>•</span>
                                  <span>{m.salesUom || m.unit || "PCS"}</span>
                                  {m.genericName && (
                                    <span className="truncate max-w-[130px]">• {m.genericName}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                  ₹{m.defaultSalePrice || m.mrp || 0}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* UoM */}
              <div className="col-span-1 space-y-1">
                <Label className="text-[11px] font-medium text-foreground">UoM</Label>
                <Select value={uom} onValueChange={setUom}>
                  <SelectTrigger className="h-8 text-xs bg-background px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UOMS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="col-span-1 space-y-1">
                <Label className="text-[11px] font-medium text-foreground">
                  Quantity <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  value={quantity || ""}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs bg-background text-center font-mono font-bold"
                />
              </div>

              {/* Sale Price with Calculator Icon & ₹ prefix */}
              <div className="col-span-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">
                    Sale Price <span className="text-rose-500">*</span>
                  </Label>
                  <Calculator className="size-2.5 text-primary" />
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={salePrice || ""}
                    onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="h-8 pl-5 text-xs bg-background font-mono font-bold"
                  />
                </div>
              </div>

              {/* Discount (%) with % icon */}
              <div className="col-span-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">Discount</Label>
                  <span className="text-[10px] font-bold text-muted-foreground">%</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPct || ""}
                  onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="h-8 text-xs bg-background text-center font-mono"
                />
              </div>

              {/* Amount (₹) */}
              <div className="col-span-1 space-y-1">
                <Label className="text-[11px] font-medium text-foreground">Amount</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    readOnly
                    value={calculatedParticularsAmount.toFixed(2)}
                    className="h-8 pl-5 text-xs bg-muted font-mono font-bold text-foreground"
                  />
                </div>
              </div>

              {/* Green [+] Button */}
              <div className="col-span-1">
                <Button
                  type="button"
                  onClick={handleAddLine}
                  title="Add Line (Enter)"
                  className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black p-0 shadow-sm rounded-lg"
                >
                  <Plus className="size-4 stroke-[3]" />
                </Button>
              </div>
            </div>

            {/* Description Row below Item Name */}
            <div className="grid grid-cols-12 gap-2 pt-1">
              <div className="col-span-8">
                <Input
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Item Description (printed on invoice)..."
                  className="h-7 text-[11px] bg-background text-muted-foreground"
                />
              </div>
              <div className="col-span-4">
                <Input
                  value={lineSerialNo}
                  onChange={(e) => setLineSerialNo(e.target.value)}
                  placeholder="Batch / Serial No. / Expiry..."
                  className="h-7 text-[11px] font-mono bg-background text-muted-foreground"
                />
              </div>
            </div>
          </fieldset>

          {/* ── 3. TABLE GRID: Blue Header (Matching Image 4) ── */}
          <div className="rounded-xl border border-border overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1976d2] dark:bg-primary text-white font-bold">
                  <th className="px-3 py-2.5 text-center w-12">S. No.</th>
                  <th className="px-3 py-2.5">Item Name</th>
                  <th className="px-3 py-2.5 text-center w-24">Serial / Tag</th>
                  <th className="px-3 py-2.5 text-center w-16">Quantity</th>
                  <th className="px-3 py-2.5 text-center w-16">UoM</th>
                  <th className="px-3 py-2.5 text-right w-24">Sale Price (₹)</th>
                  <th className="px-3 py-2.5 text-center w-20">Disc. (%)</th>
                  <th className="px-3 py-2.5 text-right w-28">Amount (₹)</th>
                  <th className="px-3 py-2.5 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-xs">
                      No particulars added yet. Select a category, browse an item, or enter details above and click [ + ].
                    </td>
                  </tr>
                ) : (
                  lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-mono text-muted-foreground">{line.sNo}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{line.itemName}</div>
                        {line.itemDescription && (
                          <div className="text-[11px] text-muted-foreground">{line.itemDescription}</div>
                        )}
                        {line.serialNo && (
                          <div className="text-[10px] font-mono text-primary/80">Batch/SN: {line.serialNo}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          {line.tag || `SR-${String(line.sNo).padStart(3, "0")}`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-bold tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground text-[11px]">{line.uom}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">₹{line.salePrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {line.discountPct ? `${line.discountPct}%` : "-"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold font-mono tabular-nums text-foreground">
                        ₹{line.amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-muted-foreground hover:text-rose-600 transition-colors p-1"
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

          {/* ── 4. BOTTOM ROW: Options, Payment Details & Totals (Matching Image 4) ── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-1">
            {/* Left Column (5 cols): Bell, Checkboxes & Payment Details Groupbox */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 cursor-pointer hover:bg-blue-500/20">
                  <Bell className="size-4" />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addShipping}
                    onChange={(e) => setAddShipping(e.target.checked)}
                    className="size-3.5 rounded text-primary"
                  />
                  <span>Add Shipping and Packaging Costs</span>
                </label>

                {addShipping && (
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={shippingCost || ""}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="h-7 pl-5 text-xs font-mono bg-background"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer ml-9">
                  <input
                    type="checkbox"
                    checked={hasInvoiceRef}
                    onChange={(e) => setHasInvoiceRef(e.target.checked)}
                    className="size-3.5 rounded text-primary"
                  />
                  <span>Invoice Reference</span>
                </label>
                {hasInvoiceRef && (
                  <Input
                    value={invoiceRefNo}
                    onChange={(e) => setInvoiceRefNo(e.target.value)}
                    placeholder="PO / Ref Number..."
                    className="h-7 text-xs bg-background flex-1"
                  />
                )}
              </div>

              {/* Groupbox: Payment Details with Partial Payment Capabilities */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Payment Details
                  </legend>

                  {/* Payment Type Selection: Full Payment / Partial Payment / Credit Unpaid */}
                  <div className="inline-flex rounded-lg bg-muted p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("FULL");
                        setPaidAmount(totals.grandTotal);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        paymentType === "FULL"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Full Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("PARTIAL");
                        setPaidAmount(roundMoney(totals.grandTotal * 0.5));
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        paymentType === "PARTIAL"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Partial Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("UNPAID");
                        setPaidAmount(0);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        paymentType === "UNPAID"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Credit / Unpaid
                    </button>
                  </div>
                </div>

                {/* Radio Payment Mode */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs pt-1">
                  {(["Cash", "Cheque", "Card", "Mobile Wallet", "Demand Draft", "Bank Transfer"] as const).map(
                    (m) => (
                      <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMode"
                          checked={paymentMode === m}
                          onChange={() => setPaymentMode(m)}
                          className="size-3.5 text-primary"
                        />
                        <span>{m}</span>
                      </label>
                    )
                  )}
                </div>

                {/* Amount Paid Now Input & Partial Payment Information */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-foreground whitespace-nowrap">
                      {paymentType === "PARTIAL" ? "Paid Now" : "Amount Received"}{" "}
                      <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max={totals.grandTotal}
                        step="any"
                        value={paymentType === "UNPAID" ? 0 : paidAmount || ""}
                        disabled={paymentType === "UNPAID"}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPaidAmount(val);
                          if (val < totals.grandTotal && val > 0) {
                            setPaymentType("PARTIAL");
                          } else if (val >= totals.grandTotal) {
                            setPaymentType("FULL");
                          }
                        }}
                        placeholder="0.00"
                        className="h-8 pl-6 text-xs font-mono font-bold bg-background"
                      />
                    </div>
                    {paymentType === "PARTIAL" && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPaidAmount(roundMoney(totals.grandTotal * 0.25))}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaidAmount(roundMoney(totals.grandTotal * 0.5))}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaidAmount(roundMoney(totals.grandTotal * 0.75))}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          75%
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Partial Payment Notice / Breakdown */}
                  {paymentType === "PARTIAL" && balanceDue > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                        <AlertCircle className="size-3.5" />
                        <span>Partial Payment:</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          Paid: ₹{effectivePaidAmount.toFixed(2)}
                        </span>
                        <span className="text-amber-800 dark:text-amber-300 font-black">
                          Balance Due: ₹{balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {paymentType === "UNPAID" && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs flex items-center justify-between">
                      <span className="text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="size-3.5" /> Credit Invoice (Full Balance Due)
                      </span>
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                        ₹{totals.grandTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </fieldset>
            </div>

            {/* Middle Column (3 cols): Delivery Terms & Remarks (Private Use) */}
            <div className="md:col-span-3 space-y-2.5">
              <fieldset className="rounded-xl border border-border bg-card/60 p-2.5 space-y-1">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Delivery Terms
                </legend>
                <Textarea
                  rows={2}
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  placeholder="Immediate counter delivery..."
                  className="text-xs bg-background min-h-[44px]"
                />
              </fieldset>

              <fieldset className="rounded-xl border border-border bg-card/60 p-2.5 space-y-1">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Remarks (Private Use)
                </legend>
                <Textarea
                  rows={2}
                  value={remarksPrivate}
                  onChange={(e) => setRemarksPrivate(e.target.value)}
                  placeholder="Internal clinic note (never printed)..."
                  className="text-xs bg-background min-h-[44px]"
                />
              </fieldset>
            </div>

            {/* Right Column (4 cols): Sub Total, Shipping, Total Amount & Action Buttons */}
            <div className="md:col-span-4 flex flex-col justify-between space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Sub Total:</span>
                  <span className="font-semibold text-foreground">₹{totals.subTotal.toFixed(2)}</span>
                </div>

                {totals.taxTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>GST:</span>
                    <span>₹{totals.taxTotal.toFixed(2)}</span>
                  </div>
                )}

                {totals.shipping > 0 && (
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Shipping (+):</span>
                    <span>₹{totals.shipping.toFixed(2)}</span>
                  </div>
                )}

                {totals.roundOff !== 0 && (
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Round Off:</span>
                    <span>{totals.roundOff > 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}</span>
                  </div>
                )}

                <div className="border-t border-border pt-2 flex justify-between items-center text-sm font-black text-foreground">
                  <span className="uppercase tracking-wide">TOTAL AMOUNT:</span>
                  <span className="text-xl font-black text-primary">
                    ₹{totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Partial Payment / Balance Breakdown */}
                {balanceDue > 0 ? (
                  <div className="border-t border-dashed border-border/80 pt-2 space-y-1">
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      <span>Amount Received:</span>
                      <span>₹{effectivePaidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400 font-black text-sm">
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-rose-500 animate-pulse inline-block" />
                        Balance Due:
                      </span>
                      <span>₹{balanceDue.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-0.5 text-center font-bold">
                      PARTIAL PAYMENT (Due Balance Tracked)
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-dashed border-border/80 pt-1.5 flex justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <span>Payment Status:</span>
                    <span className="flex items-center gap-1">
                      <Check className="size-3" /> Fully Paid
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons: [ 🖨️ Save and Print ] and [ 💾 Save ] */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSave(true)}
                  disabled={saving}
                  className="flex-1 h-9 bg-[#1976d2] dark:bg-primary hover:bg-[#1565c0] text-white text-xs font-bold gap-1.5 shadow-md"
                >
                  <Printer className="size-4" />
                  <span>Save and Print</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => void handleSave(false)}
                  disabled={saving}
                  className="flex-1 h-9 bg-[#1976d2] dark:bg-primary hover:bg-[#1565c0] text-white text-xs font-bold gap-1.5 shadow-md"
                >
                  <Save className="size-4" />
                  <span>Save</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

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
                  const pId = firstPet.petId || firstPet._id;
                  setSelectedPetId(pId);
                  setClientName(owner.name || "CASH");
                  setMobileNo(owner.phone || "");
                  if (owner.address) setAddress(owner.address);
                  setLinkTo("CLIENT_ACCOUNT");
                  setCustomerType("PATIENT");
                }
                toast.success(`Client "${owner.name}" registered and selected!`);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
