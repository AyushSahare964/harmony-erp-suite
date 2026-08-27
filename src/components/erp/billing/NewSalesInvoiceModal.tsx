import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  User,
  Dog,
  Receipt,
  Sparkles,
  Stethoscope,
  DollarSign,
  Package,
  Calendar,
  Building,
  CreditCard,
  Percent,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { finalizeVisitAndBillFn } from "@/lib/mongodb/serverFns/clinical";
import { cn } from "@/lib/utils";
import { useErp } from "@/lib/erp/store";
import { useInventory } from "@/components/erp/inventory/useInventoryStore";

interface LineItem {
  id: string;
  lineType: "Vaccine" | "Consultation" | "Pharmacy" | "Procedure" | "Diagnostic" | "Service";
  itemCode?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstRate: number;
}

const COMMON_SERVICES: Array<{ name: string; price: number; type: LineItem["lineType"]; gst: number }> = [
  { name: "General Physical Examination & OPD", price: 500, type: "Consultation" as const, gst: 18 },
  { name: "Deworming Dose (Oral / Spot-on)", price: 350, type: "Procedure" as const, gst: 5 },
  { name: "DHPPiL / 9-in-1 Annual Booster Vaccine", price: 1200, type: "Vaccine" as const, gst: 5 },
  { name: "Anti-Rabies (ARV) Vaccination", price: 450, type: "Vaccine" as const, gst: 5 },
  { name: "Nail Clipping & Paw Pad Care", price: 300, type: "Procedure" as const, gst: 18 },
  { name: "Wound Dressing & Antiseptic Flush", price: 800, type: "Procedure" as const, gst: 18 },
  { name: "Ear Cleaning & Otoscopy", price: 650, type: "Procedure" as const, gst: 18 },
  { name: "Full Hygienic Grooming & Bath", price: 1500, type: "Service" as const, gst: 18 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onInvoiceCreated?: (newInvoice: any) => void;
}

export function NewSalesInvoiceModal({ open, onClose, onInvoiceCreated }: Props) {
  const { currentUser, role } = useErp();
  const activeDoctorName =
    currentUser?.fullName || (currentUser?.roleId === "doctor" ? currentUser.fullName : role?.person || "Dr. Rohit Sharma");

  // Live inventory from store
  const { medicines, getTotalQty, getStockStatus, recordSale } = useInventory();
  const inventoryItems = useMemo(
    () => medicines.filter((m) => m.status === "Active" && m.maintainStock),
    [medicines]
  );

  // Step in modal: 'select-patient' | 'add-items'
  const [step, setStep] = useState<"patient" | "items">("patient");

  // Patients list for dynamic picker
  const [pets, setPets] = useState<any[]>([]);
  const [searchPatientQuery, setSearchPatientQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Selected Inventory Item for quick add
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any | null>(null);
  const [inventoryQty, setInventoryQty] = useState(1);

  // Invoice Details
  const [branch, setBranch] = useState("Main Clinic");
  const [billType, setBillType] = useState<"GST" | "Non-GST">("Non-GST");
  const [doctorName, setDoctorName] = useState(activeDoctorName);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Card" | "NetBanking" | "Cheque">("UPI");
  const [trxRef, setTrxRef] = useState("");

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    {
      id: "1",
      lineType: "Consultation",
      name: "Veterinary Consultation & Physical Examination",
      quantity: 1,
      unitPrice: 500,
      discountPercent: 0,
      gstRate: 0,
    },
  ]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPatients();
    }
  }, [open]);

  const loadPatients = async () => {
    try {
      const petsData = await listPetsWithOwnersFn();
      setPets(petsData || []);
      if (petsData && petsData.length > 0 && !selectedPet) {
        setSelectedPet(petsData[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredPets = useMemo(() => {
    const q = searchPatientQuery.toLowerCase().trim();
    if (!q) return pets.slice(0, 8);
    return pets.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.petId?.toLowerCase().includes(q) ||
        p.breed?.toLowerCase().includes(q) ||
        p.owner?.name?.toLowerCase().includes(q) ||
        p.owner?.phone?.includes(q)
    );
  }, [pets, searchPatientQuery]);

  // Financial summary
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxable = 0;
    let gst = 0;

    for (const item of items) {
      const gross = item.quantity * item.unitPrice;
      const disc = (gross * item.discountPercent) / 100;
      const net = gross - disc;
      subtotal += net;

      if (billType === "GST" && item.gstRate > 0) {
        const itemGst = (net * item.gstRate) / 100;
        gst += itemGst;
        taxable += net;
      } else {
        taxable += net;
      }
    }

    const exactTotal = subtotal + (billType === "GST" ? gst : 0);
    const rounded = Math.round(exactTotal);
    const roundOff = rounded - exactTotal;

    return {
      subtotal,
      taxable,
      gst,
      roundOff,
      grandTotal: rounded,
    };
  }, [items, billType]);

  const handleAddService = (svc: typeof COMMON_SERVICES[0]) => {
    const newItem: LineItem = {
      id: String(Date.now()),
      lineType: svc.type,
      name: svc.name,
      quantity: 1,
      unitPrice: svc.price,
      discountPercent: 0,
      gstRate: billType === "GST" ? svc.gst : 0,
    };
    setItems((prev) => [...prev, newItem]);
    toast.success(`Added ${svc.name}`);
  };

  const handleAddInventoryMedicine = () => {
    if (!selectedInventoryItem) {
      toast.error("Please select an item from inventory");
      return;
    }
    // Validate stock
    const avail = getTotalQty(selectedInventoryItem.id);
    const qty = Number(inventoryQty) || 1;
    if (qty > avail) {
      toast.error(`Only ${avail} units in stock for "${selectedInventoryItem.name}"`);
      return;
    }
    const isVaccine = selectedInventoryItem.category === "Vaccine" || selectedInventoryItem.name.toLowerCase().includes("vaccine");
    const newItem: LineItem = {
      id: String(Date.now()),
      lineType: isVaccine ? "Vaccine" : "Pharmacy",
      itemCode: selectedInventoryItem.id,
      name: selectedInventoryItem.name,
      quantity: qty,
      unitPrice: selectedInventoryItem.defaultSalePrice || 250,
      discountPercent: 0,
      gstRate: billType === "GST" ? (selectedInventoryItem.gstRate || 5) : 0,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedInventoryItem(null);
    setInventoryQty(1);
    toast.success(`Added ${selectedInventoryItem.name}`);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.error("An invoice requires at least one line item");
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, val: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    );
  };

  const handleFinalizeAndCollect = async () => {
    if (!selectedPet) {
      toast.error("Please select a registered patient");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }
    // Validate stock for all inventory line items before finalizing
    for (const it of items) {
      if (it.itemCode) {
        const avail = getTotalQty(it.itemCode);
        if (it.quantity > avail) {
          toast.error(`Insufficient stock: only ${avail} of "${it.name}" available.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const generatedVisitId = `V-${Math.floor(1000 + Math.random() * 9000)}`;

      // Deduct stock via FEFO for all inventory line items (synchronous)
      for (const it of items) {
        if (it.itemCode) {
          const result = recordSale({ medicineId: it.itemCode, qty: it.quantity, sourceRef: generatedVisitId, actor: doctorName });
          if (!result.ok) {
            toast.error(result.error || `Stock deduction failed for ${it.name}`);
            setSaving(false);
            return;
          }
        }
      }

      const payload = {
        visitId: generatedVisitId,
        petId: selectedPet.petId,
        petName: selectedPet.name,
        species: selectedPet.species || "Canine",
        breed: selectedPet.breed || "Standard",
        ownerId: selectedPet.ownerId || selectedPet.owner?.ownerId || "OWN-0001",
        ownerName: selectedPet.owner?.name || "Client",
        ownerPhone: selectedPet.owner?.phone || "N/A",
        branch,
        billType,
        doctorName,
        diagnosis: "Sales & Clinical Billing",
        clinicalNotes: clinicalNotes.trim() || undefined,
        items: items.map((it) => ({
          lineType: it.lineType,
          itemCode: it.itemCode,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          gstRate: it.gstRate,
          lineTotal: (it.quantity * it.unitPrice) * (1 - it.discountPercent / 100),
        })),
        subtotal: totals.subtotal,
        billDiscount: 0,
        taxableAmount: totals.taxable,
        gstAmount: totals.gst,
        roundOff: totals.roundOff,
        totalAmount: totals.grandTotal,
        amountPaid: totals.grandTotal,
        paymentMode,
        trxRef: trxRef || undefined,
      };

      const result = await finalizeVisitAndBillFn({ data: payload });
      toast.success(`Invoice ${result.invoiceNo || "INV"} generated & payment of ₹${totals.grandTotal} collected!`);
      onInvoiceCreated?.(result);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to generate invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl border-border bg-card shadow-2xl p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
                <Receipt className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  New Sales Invoice &amp; Patient Bill
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Dynamic patient billing, counter pharmacy sales &amp; instant payment collection
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Selector Banner (Dynamic Pick) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Dog className="size-4 text-primary" /> Select Registered Patient &amp; Owner
              </Label>
              {selectedPet && (
                <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30">
                  {selectedPet.petId} · {selectedPet.name} ({selectedPet.owner?.name})
                </Badge>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patient by name, UID (e.g. PET-0001), breed, or owner..."
                value={searchPatientQuery}
                onChange={(e) => setSearchPatientQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            {/* Quick Patient Select Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border">
              {filteredPets.map((p) => {
                const isSelected = selectedPet?.petId === p.petId;
                return (
                  <div
                    key={p.petId}
                    onClick={() => setSelectedPet(p)}
                    className={cn(
                      "p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between shadow-2xs",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <div>
                      <p className="font-bold flex items-center gap-1">
                        <span>{p.species === "Feline" ? "🐱" : "🐶"}</span>
                        <span>{p.name}</span>
                      </p>
                      <p className={cn("text-[10px]", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {p.owner?.name} ({p.owner?.phone})
                      </p>
                    </div>
                    <span className={cn("font-mono text-[10px] px-1 py-0.5 rounded", isSelected ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground")}>
                      {p.petId}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration Row: Branch, Bill Type, Doctor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Branch</Label>
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="text-xs h-8 bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Bill Type</Label>
              <Select value={billType} onValueChange={(v) => setBillType(v as any)}>
                <SelectTrigger className="text-xs h-8 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non-GST">Non-GST Bill</SelectItem>
                  <SelectItem value="GST">GST Tax Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Attending Doctor</Label>
              <Input
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="text-xs h-8 bg-card"
              />
            </div>
          </div>

          {/* Quick Add Services & Live Pharmacy Catalogue */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Quick Add Clinical Services &amp; Vaccines</Label>
              <span className="text-[11px] text-muted-foreground">1-click item insertion</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SERVICES.slice(0, 6).map((svc) => (
                <button
                  key={svc.name}
                  type="button"
                  onClick={() => handleAddService(svc)}
                  className="px-2.5 py-1 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary-soft/30 text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs text-foreground"
                >
                  <Plus className="size-3 text-primary" />
                  <span>{svc.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">₹{svc.price}</span>
                </button>
              ))}
            </div>

            {/* Inventory Item Quick Adder - all categories */}
            {inventoryItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Package className="size-3.5" /> From Inventory (All Categories):
                </span>
                <div className="w-64">
                  <Select
                    value={selectedInventoryItem?.id || ""}
                    onValueChange={(val) => {
                      const found = inventoryItems.find((it) => it.id === val);
                      setSelectedInventoryItem(found || null);
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 bg-card"><SelectValue placeholder="Select item..." /></SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((it) => {
                        const avail = getTotalQty(it.id);
                        return (
                          <SelectItem key={it.id} value={it.id} disabled={avail === 0}>
                            {it.name} — ₹{it.defaultSalePrice} ({avail} in stock)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  min="1"
                  value={inventoryQty}
                  onChange={(e) => setInventoryQty(Math.max(1, Number(e.target.value)))}
                  className="w-16 text-xs h-8 font-mono bg-card"
                  placeholder="Qty"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddInventoryMedicine}
                  className="h-8 text-xs font-bold text-primary gap-1"
                >
                  <Plus className="size-3" /> Add Med
                </Button>
              </div>
            )}
          </div>

          {/* Line Items Table (Screenshot 2 Structure) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Invoice Line Items ({items.length})</Label>
              <span className="text-xs font-bold font-mono text-primary">
                Subtotal: ₹{totals.subtotal.toFixed(2)}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-3 py-2.5">Category &amp; Item Name</th>
                    <th className="px-3 py-2.5 w-20 text-center">Qty</th>
                    <th className="px-3 py-2.5 w-24 text-right">Price (₹)</th>
                    <th className="px-3 py-2.5 w-20 text-right">Disc (%)</th>
                    {billType === "GST" && <th className="px-3 py-2.5 w-20 text-right">GST (%)</th>}
                    <th className="px-3 py-2.5 w-24 text-right">Total (₹)</th>
                    <th className="px-3 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it) => {
                    const lineGross = it.quantity * it.unitPrice;
                    const lineNet = lineGross * (1 - it.discountPercent / 100);
                    return (
                      <tr key={it.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <Input
                            value={it.name}
                            onChange={(e) => updateItem(it.id, "name", e.target.value)}
                            className="h-7 text-xs font-semibold"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => updateItem(it.id, "quantity", Math.max(1, Number(e.target.value)))}
                            className="h-7 text-xs text-center font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={it.unitPrice}
                            onChange={(e) => updateItem(it.id, "unitPrice", Number(e.target.value))}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={it.discountPercent}
                            onChange={(e) => updateItem(it.id, "discountPercent", Number(e.target.value))}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        {billType === "GST" && (
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={it.gstRate}
                              onChange={(e) => updateItem(it.id, "gstRate", Number(e.target.value))}
                              className="h-7 text-xs text-right font-mono"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                          ₹{lineNet.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Breakdown & Settlement Row (Screenshot 2/3) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Payment Mode Selection */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
              <h4 className="text-xs font-bold text-foreground">Payment Settlement</h4>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Mode</Label>
                <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI (Google Pay / PhonePe / QR)</SelectItem>
                    <SelectItem value="Cash">Cash on Counter</SelectItem>
                    <SelectItem value="Card">Credit / Debit Card (POS)</SelectItem>
                    <SelectItem value="NetBanking">NetBanking / Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Transaction / UPI Ref No. (Optional)</Label>
                <Input
                  placeholder="e.g. UPI-9812401928"
                  value={trxRef}
                  onChange={(e) => setTrxRef(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* Payment Summary Box */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-2xs">
              <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5">PAYMENT BREAKDOWN</h4>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono font-semibold">₹{totals.subtotal.toFixed(2)}</span>
                </div>

                {billType === "GST" && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">GST (CGST + SGST):</span>
                    <span className="font-mono font-semibold text-primary">+₹{totals.gst.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Round-off Adjustment:</span>
                  <span className="font-mono text-muted-foreground">₹{totals.roundOff.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm font-bold text-foreground">Grand Total:</span>
                  <span className="text-lg font-bold font-mono text-primary">₹{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={handleFinalizeAndCollect}
                  disabled={saving || !selectedPet}
                  className="w-full font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs h-10"
                >
                  {saving ? "Generating Bill..." : `Finalize & Collect ₹${totals.grandTotal} ✓`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
