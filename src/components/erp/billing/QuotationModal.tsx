import { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  Plus,
  Trash2,
  Printer,
  Sparkles,
  User,
  Dog,
  Calendar,
  CheckCircle2,
  DollarSign,
  Share2,
  Download,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";

export interface QuotationItem {
  id: string;
  name: string;
  category: "Procedure" | "Consultation" | "Pharmacy" | "Diagnostic" | "Surgery" | "Boarding";
  quantity: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
}

const COMMON_ESTIMATES: Array<{ name: string; rate: number; category: QuotationItem["category"]; gst: number }> = [
  { name: "Orthopedic Fracture Plating & GA Package", rate: 28000, category: "Surgery", gst: 18 },
  { name: "Canine Spay / Ovariohysterectomy (Complete)", rate: 7500, category: "Surgery", gst: 18 },
  { name: "Dental Scaling, Polishing & Extractions under GA", rate: 6500, category: "Procedure", gst: 18 },
  { name: "Comprehensive Pre-Op Panel (CBC + LFT + KFT + Electrolytes)", rate: 3200, category: "Diagnostic", gst: 18 },
  { name: "Ultrasound Abdomen (Color Doppler Full Scan)", rate: 2500, category: "Diagnostic", gst: 18 },
  { name: "Specialist Senior Vet Consultation & Case Review", rate: 1000, category: "Consultation", gst: 18 },
  { name: "ICU Oxygen & Critical Care Day Hospitalization", rate: 3500, category: "Boarding", gst: 18 },
  { name: "Post-Op Injectable Antibiotics & Analgesic Pack", rate: 1850, category: "Pharmacy", gst: 12 },
];

interface QuotationModalProps {
  open: boolean;
  onClose: () => void;
  onConvertToInvoice?: (quotationData: any) => void;
}

export function QuotationModal({ open, onClose, onConvertToInvoice }: QuotationModalProps) {
  const [quotationNo, setQuotationNo] = useState("");
  const [date, setDate] = useState(todayIST());
  const [validUntil, setValidUntil] = useState("");

  // Customer & Pet details
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("Canine");
  const [doctorName, setDoctorName] = useState("Dr. Rohit Sharma");

  // Items
  const [items, setItems] = useState<QuotationItem[]>([
    {
      id: "item_1",
      name: "Veterinary Consultation & Preliminary Evaluation",
      category: "Consultation",
      quantity: 1,
      rate: 500,
      discountPercent: 0,
      gstRate: 18,
    },
  ]);

  const [notes, setNotes] = useState(
    "1. This estimate is valid for 15 days from issue.\n2. Medications outside the standard package will be billed as per consumption.\n3. Post-surgical ICU monitoring beyond 24 hours will be billed separately."
  );

  // Initialize fresh quotation details on open
  useEffect(() => {
    if (open) {
      const rnd = Math.floor(1000 + Math.random() * 9000);
      setQuotationNo(`EST-2026-${rnd}`);
      const t = todayIST();
      setDate(t);

      // Default valid 15 days
      const d = new Date();
      d.setDate(d.getDate() + 15);
      setValidUntil(d.toISOString().slice(0, 10));

      // Fetch pets list for quick auto-complete
      listPetsWithOwnersFn()
        .then((data) => setPets(data || []))
        .catch((err) => console.error("Failed to load pets:", err));
    }
  }, [open]);

  // Totals calculation
  const subtotal = items.reduce((sum, it) => {
    const gross = (it.quantity || 0) * (it.rate || 0);
    const disc = gross * ((it.discountPercent || 0) / 100);
    return sum + (gross - disc);
  }, 0);

  const totalGst = items.reduce((sum, it) => {
    const gross = (it.quantity || 0) * (it.rate || 0);
    const disc = gross * ((it.discountPercent || 0) / 100);
    const taxable = gross - disc;
    return sum + taxable * ((it.gstRate || 0) / 100);
  }, 0);

  const grandTotal = Math.round(subtotal + totalGst);

  // Add Item
  const handleAddItem = (preset?: (typeof COMMON_ESTIMATES)[0]) => {
    if (preset) {
      setItems((prev) => [
        ...prev,
        {
          id: `item_${Date.now()}_${Math.random()}`,
          name: preset.name,
          category: preset.category,
          quantity: 1,
          rate: preset.rate,
          discountPercent: 0,
          gstRate: preset.gst,
        },
      ]);
      toast.success(`Added ${preset.name}`);
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: `item_${Date.now()}_${Math.random()}`,
          name: "",
          category: "Procedure",
          quantity: 1,
          rate: 0,
          discountPercent: 0,
          gstRate: 18,
        },
      ]);
    }
  };

  const handleUpdateItem = (id: string, field: keyof QuotationItem, val: any) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSelectPet = (pet: any) => {
    setPetName(pet.name || "");
    setSpecies(pet.species || "Canine");
    setOwnerName(pet.ownerName || "");
    setOwnerPhone(pet.ownerPhone || "");
    setSearchPetQuery("");
    toast.success(`Selected patient: ${pet.name} (${pet.ownerName})`);
  };

  const [saving, setSaving] = useState(false);

  const handleSaveQuotation = async () => {
    if (!ownerName && !petName) {
      toast.error("Please enter at least Pet Name or Owner Name for the quotation.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one line item to the quotation.");
      return;
    }

    setSaving(true);
    const quotationData = {
      quotationNo,
      date,
      validUntil,
      ownerName,
      ownerPhone,
      petName,
      species,
      doctorName,
      items: items.map((it) => {
        const gross = (it.quantity || 0) * (it.rate || 0);
        const disc = gross * ((it.discountPercent || 0) / 100);
        const gst = (gross - disc) * ((it.gstRate || 0) / 100);
        return {
          ...it,
          lineTotal: Math.round(gross - disc + gst),
        };
      }),
      subtotal,
      totalDiscount: items.reduce((sum, it) => sum + (it.quantity || 0) * (it.rate || 0) * ((it.discountPercent || 0) / 100), 0),
      totalGst,
      grandTotal,
      notes,
      status: "Sent" as const,
      createdAt: new Date().toISOString(),
    };

    try {
      const { createQuotationFn } = await import("@/lib/mongodb/serverFns/quotations");
      await createQuotationFn({ data: quotationData });
    } catch (err) {
      console.error("Failed to save quotation to server:", err);
    }

    // Also store in localStorage for offline persistence
    try {
      const existing = JSON.parse(localStorage.getItem("vetos_quotations") || "[]");
      existing.unshift(quotationData);
      localStorage.setItem("vetos_quotations", JSON.stringify(existing.slice(0, 50)));
      window.dispatchEvent(new CustomEvent("vetos:quotation-created", { detail: quotationData }));
    } catch (e) {
      console.error(e);
    }

    toast.success(`Quotation ${quotationNo} generated & saved to Quotations Register in Reports!`);
    setSaving(false);
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleConvert = () => {
    if (onConvertToInvoice) {
      onConvertToInvoice({
        ownerName,
        ownerPhone,
        petName,
        doctorName,
        items,
        totalAmount: grandTotal,
      });
    } else {
      toast.info(`Converting ${quotationNo} to Live Sales Invoice...`);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card">
        {/* Header with Glass Gradient */}
        <div className="relative p-6 border-b border-border bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 p-1.5">
                  <FileText className="size-5" />
                </span>
                <DialogTitle className="text-lg font-black tracking-tight text-white">
                  New Medical Quotation &amp; Cost Estimate
                </DialogTitle>
                <span className="rounded bg-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-200 border border-white/15">
                  {quotationNo}
                </span>
              </div>
              <DialogDescription className="mt-1 text-xs text-slate-300">
                Generate formal proforma estimates, surgery packages, and procedure cost breakdowns for pet parents.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Printer className="size-3.5" />
                <span>Print Estimate</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient & Estimate Metadata */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-xl border border-border bg-muted/20 p-4">
            <div>
              <Label className="text-xs font-semibold text-foreground">Estimate Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-foreground">Valid Until (Expiry)</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-foreground">Attending Veterinarian</Label>
              <Select value={doctorName} onValueChange={setDoctorName}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dr. Rohit Sharma">Dr. Rohit Sharma (Senior Vet)</SelectItem>
                  <SelectItem value="Dr. Ananya Iyer">Dr. Ananya Iyer (Soft Tissue Surgeon)</SelectItem>
                  <SelectItem value="Dr. Vikram Deshmukh">Dr. Vikram Deshmukh (Orthopedic Vet)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Patient & Owner Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Dog className="size-3.5 text-primary" /> Patient &amp; Pet Parent Details
              </h4>
              {pets.length > 0 && (
                <span className="text-[11px] text-muted-foreground">Pick from registered clinic patients below</span>
              )}
            </div>

            {/* Quick pet search picker */}
            {pets.length > 0 && (
              <div className="relative">
                <Input
                  placeholder="Type to search patient by pet name or owner..."
                  value={searchPetQuery}
                  onChange={(e) => setSearchPetQuery(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
                {searchPetQuery && (
                  <div className="absolute z-20 top-9 left-0 w-full max-h-44 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg divide-y divide-border">
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
                          className="p-2.5 text-xs hover:bg-muted/40 cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-foreground">{p.name}</span>
                            <span className="text-muted-foreground ml-2">
                              ({p.species || "Dog"} · {p.breed || "Mix"})
                            </span>
                          </div>
                          <span className="text-[11px] text-primary font-medium">{p.ownerName}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-xs text-muted-foreground">Pet / Patient Name *</Label>
                <Input
                  placeholder="e.g. Bruno"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Species</Label>
                <Input
                  placeholder="Canine / Feline"
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Client / Owner Name *</Label>
                <Input
                  placeholder="e.g. Ramesh Kulkarni"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contact Phone</Label>
                <Input
                  placeholder="e.g. 9823011223"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Quick Preset Estimate Packages */}
          <div>
            <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" /> Quick Add Procedure / Surgery Packages:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ESTIMATES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleAddItem(preset)}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all flex items-center gap-1.5"
                >
                  <span>+ {preset.name}</span>
                  <span className="font-mono font-bold text-emerald-600">₹{preset.rate.toLocaleString("en-IN")}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Item / Service Description</th>
                    <th className="px-3 py-2.5 w-28">Category</th>
                    <th className="px-3 py-2.5 w-16 text-center">Qty</th>
                    <th className="px-3 py-2.5 w-24 text-right">Unit Rate (₹)</th>
                    <th className="px-3 py-2.5 w-20 text-right">Disc (%)</th>
                    <th className="px-3 py-2.5 w-24 text-right">Total (₹)</th>
                    <th className="px-3 py-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it) => {
                    const gross = (it.quantity || 0) * (it.rate || 0);
                    const disc = gross * ((it.discountPercent || 0) / 100);
                    const lineTotal = gross - disc;

                    return (
                      <tr key={it.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <Input
                            placeholder="Service / Medicine name..."
                            value={it.name}
                            onChange={(e) => handleUpdateItem(it.id, "name", e.target.value)}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={it.category}
                            onChange={(e) => handleUpdateItem(it.id, "category", e.target.value)}
                            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="Procedure">Procedure</option>
                            <option value="Surgery">Surgery</option>
                            <option value="Consultation">Consultation</option>
                            <option value="Diagnostic">Diagnostic</option>
                            <option value="Pharmacy">Pharmacy</option>
                            <option value="Boarding">Boarding</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => handleUpdateItem(it.id, "quantity", Number(e.target.value) || 1)}
                            className="h-7 text-xs text-center"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={it.rate}
                            onChange={(e) => handleUpdateItem(it.id, "rate", Number(e.target.value) || 0)}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={it.discountPercent}
                            onChange={(e) =>
                              handleUpdateItem(it.id, "discountPercent", Number(e.target.value) || 0)
                            }
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                          ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="text-muted-foreground hover:text-rose-600 transition-colors p-1"
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

            <div className="p-2 border-t border-border bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAddItem()}
                className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
              >
                <Plus className="size-3.5" />
                <span>Add Custom Line Item</span>
              </Button>
            </div>
          </div>

          {/* Notes & Summary Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-semibold text-foreground">Estimate Notes &amp; Validity Terms</Label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full mt-1 rounded-lg border border-input bg-card p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Items Subtotal:</span>
                <span className="font-mono text-foreground">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Estimated Taxes (GST):</span>
                <span className="font-mono text-foreground">₹{totalGst.toLocaleString("en-IN")}</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-bold text-foreground">
                <span>Estimated Grand Total:</span>
                <span className="font-mono text-base font-black text-primary">
                  ₹{grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleConvert}
              className="text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Convert to Live Invoice</span>
            </Button>
            <Button size="sm" onClick={handleSaveQuotation} className="text-xs gap-1.5 shadow-xs">
              <FileText className="size-3.5" />
              <span>Save &amp; Generate Quotation</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
