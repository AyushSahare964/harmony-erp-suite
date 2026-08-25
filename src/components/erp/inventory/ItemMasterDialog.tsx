/**
 * ItemMasterDialog — Full 40+ field tabbed form for adding/editing an inventory item.
 * Tabs: Identity | Stock & Storage | Pricing & Tax | Purchasing | Sales & Accounts
 */
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useInventory,
  type Medicine,
  type MedicineCategory,
  type UnitOfMeasure,
  type ValuationMethod,
} from "./useInventoryStore";
import { peekItemCodeFn } from "@/lib/mongodb/serverFns/inventory";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: MedicineCategory[] = ["Medicine", "Food", "Accessory", "Consumable"];
const UNITS: UnitOfMeasure[] = ["Tablet", "ml", "Vial", "Box", "Strip", "Kg", "Bottle", "Unit", "Piece", "Gm", "Litre"];
const VALUATION_METHODS: ValuationMethod[] = ["FEFO", "FIFO", "Moving Average"];
const GST_RATES = [0, 5, 12, 18, 28];

// ─── Form state defaults ──────────────────────────────────────────────────────

function defaultForm(editing?: Medicine) {
  if (editing) return {
    // Identity
    name: editing.name,
    genericName: editing.genericName,
    brand: editing.brand,
    manufacturer: editing.manufacturer,
    description: editing.description,
    category: editing.category,
    subGroup: editing.subGroup,
    hasVariants: editing.hasVariants,
    // Stock
    unit: editing.unit,
    purchaseUom: editing.purchaseUom,
    salesUom: editing.salesUom,
    maintainStock: editing.maintainStock,
    valuationMethod: editing.valuationMethod,
    reorderLevel: String(editing.reorderLevel),
    reorderQty: String(editing.reorderQty),
    safetyStock: String(editing.safetyStock),
    storageLocation: editing.storageLocation,
    batchTracking: editing.batchTracking,
    serialTracking: editing.serialTracking,
    allowNegativeStock: editing.allowNegativeStock,
    // Pricing
    defaultSalePrice: String(editing.defaultSalePrice),
    defaultPurchasePrice: String(editing.defaultPurchasePrice),
    minSalePrice: String(editing.minSalePrice),
    maxDiscountPct: String(editing.maxDiscountPct),
    valuationRate: String(editing.valuationRate),
    gstRate: String(editing.gstRate),
    hsnCode: editing.hsnCode,
    taxCategory: editing.taxCategory,
    isZeroRated: editing.isZeroRated,
    isExempt: editing.isExempt,
    isImport: editing.isImport,
    // Purchasing
    defaultSupplierId: editing.defaultSupplierId,
    defaultSupplierName: editing.defaultSupplierName,
    leadTimeDays: String(editing.leadTimeDays),
    minOrderQty: String(editing.minOrderQty),
    purchaseAccount: editing.purchaseAccount,
    expenseAccount: editing.expenseAccount,
    // Sales & Accounts
    incomeAccount: editing.incomeAccount,
    costCenter: editing.costCenter,
    isSalesItem: editing.isSalesItem,
    allowAlternativeItem: editing.allowAlternativeItem,
  };
  return {
    name: "", genericName: "", brand: "", manufacturer: "",
    description: "", category: "Medicine" as MedicineCategory,
    subGroup: "", hasVariants: false,
    unit: "Tablet" as UnitOfMeasure, purchaseUom: "", salesUom: "",
    maintainStock: true, valuationMethod: "FEFO" as ValuationMethod,
    reorderLevel: "10", reorderQty: "20", safetyStock: "5",
    storageLocation: "", batchTracking: true, serialTracking: false, allowNegativeStock: false,
    defaultSalePrice: "", defaultPurchasePrice: "", minSalePrice: "",
    maxDiscountPct: "10", valuationRate: "", gstRate: "12",
    hsnCode: "", taxCategory: "", isZeroRated: false, isExempt: false, isImport: false,
    defaultSupplierId: "", defaultSupplierName: "", leadTimeDays: "7",
    minOrderQty: "1", purchaseAccount: "", expenseAccount: "",
    incomeAccount: "", costCenter: "", isSalesItem: true, allowAlternativeItem: false,
  };
}
type FormState = ReturnType<typeof defaultForm>;

// ─── Field helpers ────────────────────────────────────────────────────────────

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function FCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Checkbox
        id={`chk-${label}`}
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="rounded"
      />
      <Label htmlFor={`chk-${label}`} className="text-xs cursor-pointer">{label}</Label>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function ItemMasterDialog({
  open, onClose, editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Medicine;
}) {
  const { addMedicine, updateMedicine } = useInventory();
  const [form, setForm] = useState<FormState>(defaultForm(editing));
  const [saving, setSaving] = useState(false);
  const [nextCode, setNextCode] = useState<string>("");
  const [activeTab, setActiveTab] = useState("identity");

  // Peek next item code when adding
  useEffect(() => {
    if (open && !editing) {
      peekItemCodeFn().then(setNextCode).catch(() => setNextCode("M-XXXX"));
    }
    setForm(defaultForm(editing));
    setActiveTab("identity");
  }, [open, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const numStr = (v: string) => Number(v) || 0;

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Item name is required"); setActiveTab("identity"); return; }
    if (!form.category) { toast.error("Category is required"); setActiveTab("identity"); return; }
    if (!form.unit) { toast.error("Unit of Measure is required"); setActiveTab("identity"); return; }
    if (!form.defaultSalePrice) { toast.error("Default sale price is required"); setActiveTab("pricing"); return; }

    setSaving(true);
    try {
      const payload: Omit<Medicine, "id" | "itemCode" | "createdAt" | "status"> = {
        name: form.name.trim(),
        genericName: form.genericName.trim(),
        brand: form.brand.trim(),
        manufacturer: form.manufacturer.trim(),
        description: form.description.trim(),
        category: form.category as MedicineCategory,
        subGroup: form.subGroup.trim(),
        hasVariants: form.hasVariants,
        unit: form.unit as UnitOfMeasure,
        purchaseUom: form.purchaseUom.trim(),
        salesUom: form.salesUom.trim(),
        uomConversions: [],
        maintainStock: form.maintainStock,
        valuationMethod: form.valuationMethod as ValuationMethod,
        reorderLevel: numStr(form.reorderLevel),
        reorderQty: numStr(form.reorderQty),
        safetyStock: numStr(form.safetyStock),
        storageLocation: form.storageLocation.trim(),
        batchTracking: form.batchTracking,
        serialTracking: form.serialTracking,
        allowNegativeStock: form.allowNegativeStock,
        defaultSalePrice: numStr(form.defaultSalePrice),
        defaultPurchasePrice: numStr(form.defaultPurchasePrice),
        minSalePrice: numStr(form.minSalePrice),
        maxDiscountPct: numStr(form.maxDiscountPct),
        valuationRate: numStr(form.valuationRate || form.defaultPurchasePrice),
        lastPurchaseRate: numStr(form.defaultPurchasePrice),
        gstRate: numStr(form.gstRate),
        hsnCode: form.hsnCode.trim(),
        taxCategory: form.taxCategory.trim(),
        isZeroRated: form.isZeroRated,
        isExempt: form.isExempt,
        isImport: form.isImport,
        defaultSupplierId: form.defaultSupplierId.trim(),
        defaultSupplierName: form.defaultSupplierName.trim(),
        leadTimeDays: numStr(form.leadTimeDays),
        minOrderQty: numStr(form.minOrderQty),
        purchaseAccount: form.purchaseAccount.trim(),
        expenseAccount: form.expenseAccount.trim(),
        incomeAccount: form.incomeAccount.trim(),
        costCenter: form.costCenter.trim(),
        isSalesItem: form.isSalesItem,
        allowAlternativeItem: form.allowAlternativeItem,
      };

      if (editing) {
        await updateMedicine(editing.id, payload);
        toast.success("Item updated successfully");
      } else {
        await addMedicine(payload);
        toast.success(`Item added — ${nextCode}`);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-semibold">
                {editing ? `Edit Item — ${editing.itemCode}` : "New Item Master"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {editing
                  ? "Update item details. Changes are saved to MongoDB."
                  : `Auto ID: ${nextCode || "loading…"} — Fill required fields across tabs.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 mt-3 shrink-0 h-8 justify-start gap-0.5 bg-muted/40 rounded-lg p-0.5">
            {[
              { id: "identity",   label: "Identity" },
              { id: "stock",      label: "Stock & Storage" },
              { id: "pricing",    label: "Pricing & Tax" },
              { id: "purchasing", label: "Purchasing" },
              { id: "sales",      label: "Sales & Accounts" },
            ].map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-7 rounded-md">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* ── Tab 1: Identity ─────────────────────────────────── */}
            <TabsContent value="identity" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Item Name" required>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Amoxicillin 250mg" />
                </F>
                <F label="Generic / Scientific Name">
                  <Input value={form.genericName} onChange={(e) => set("genericName", e.target.value)} placeholder="e.g. Amoxicillin Trihydrate" />
                </F>
                <F label="Brand Name">
                  <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Mox" />
                </F>
                <F label="Manufacturer">
                  <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="e.g. Cipla Ltd." />
                </F>
                <F label="Item Category" required>
                  <Select value={form.category} onValueChange={(v) => set("category", v as MedicineCategory)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Sub-Group">
                  <Input value={form.subGroup} onChange={(e) => set("subGroup", e.target.value)} placeholder="e.g. Antibiotic, Vaccine" />
                </F>
                <div className="col-span-2">
                  <F label="Description">
                    <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description or notes" />
                  </F>
                </div>
                <div className="col-span-2">
                  <FCheck label="Has Variants (size, strength, etc.)" checked={form.hasVariants} onChange={(v) => set("hasVariants", v)} />
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 2: Stock & Storage ──────────────────────────── */}
            <TabsContent value="stock" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Default Unit of Measure" required>
                  <Select value={form.unit} onValueChange={(v) => set("unit", v as UnitOfMeasure)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Valuation Method">
                  <Select value={form.valuationMethod} onValueChange={(v) => set("valuationMethod", v as ValuationMethod)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{VALUATION_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Purchase UOM">
                  <Input value={form.purchaseUom} onChange={(e) => set("purchaseUom", e.target.value)} placeholder="e.g. Box of 10" />
                </F>
                <F label="Sales UOM">
                  <Input value={form.salesUom} onChange={(e) => set("salesUom", e.target.value)} placeholder="e.g. Strip of 10" />
                </F>
                <F label="Reorder Level (qty)">
                  <Input type="number" min={0} value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} placeholder="10" />
                </F>
                <F label="Reorder Quantity">
                  <Input type="number" min={0} value={form.reorderQty} onChange={(e) => set("reorderQty", e.target.value)} placeholder="20" />
                </F>
                <F label="Safety Stock">
                  <Input type="number" min={0} value={form.safetyStock} onChange={(e) => set("safetyStock", e.target.value)} placeholder="5" />
                </F>
                <F label="Storage Location">
                  <Input value={form.storageLocation} onChange={(e) => set("storageLocation", e.target.value)} placeholder="e.g. Cold Storage, Shelf A3" />
                </F>
                <div className="col-span-2 grid grid-cols-3 gap-x-6">
                  <FCheck label="Maintain Stock" checked={form.maintainStock} onChange={(v) => set("maintainStock", v)} />
                  <FCheck label="Batch / Lot Tracking" checked={form.batchTracking} onChange={(v) => set("batchTracking", v)} />
                  <FCheck label="Serial Number Tracking" checked={form.serialTracking} onChange={(v) => set("serialTracking", v)} />
                  <FCheck label="Allow Negative Stock" checked={form.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)} />
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 3: Pricing & Tax ────────────────────────────── */}
            <TabsContent value="pricing" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Default Sale Price (₹)" required>
                  <Input type="number" min={0} step={0.01} value={form.defaultSalePrice} onChange={(e) => set("defaultSalePrice", e.target.value)} placeholder="0.00" />
                </F>
                <F label="Default Purchase Price (₹)">
                  <Input type="number" min={0} step={0.01} value={form.defaultPurchasePrice} onChange={(e) => set("defaultPurchasePrice", e.target.value)} placeholder="0.00" />
                </F>
                <F label="Minimum Sale Price (₹)">
                  <Input type="number" min={0} step={0.01} value={form.minSalePrice} onChange={(e) => set("minSalePrice", e.target.value)} placeholder="0.00" />
                </F>
                <F label="Max Discount (%)">
                  <Input type="number" min={0} max={100} value={form.maxDiscountPct} onChange={(e) => set("maxDiscountPct", e.target.value)} placeholder="10" />
                </F>
                <F label="Valuation Rate (₹)">
                  <Input type="number" min={0} step={0.01} value={form.valuationRate} onChange={(e) => set("valuationRate", e.target.value)} placeholder="0.00" />
                </F>
                <F label="GST Rate (%)">
                  <Select value={String(form.gstRate)} onValueChange={(v) => set("gstRate", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="HSN / SAC Code">
                  <Input value={form.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} placeholder="e.g. 30049099" />
                </F>
                <F label="Tax Category">
                  <Input value={form.taxCategory} onChange={(e) => set("taxCategory", e.target.value)} placeholder="e.g. GST 12%, Exempt" />
                </F>
                <div className="col-span-2 grid grid-cols-3 gap-x-6">
                  <FCheck label="Zero-Rated Supply" checked={form.isZeroRated} onChange={(v) => set("isZeroRated", v)} />
                  <FCheck label="Exempt from Tax" checked={form.isExempt} onChange={(v) => set("isExempt", v)} />
                  <FCheck label="Import / Foreign" checked={form.isImport} onChange={(v) => set("isImport", v)} />
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 4: Purchasing ───────────────────────────────── */}
            <TabsContent value="purchasing" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Default Supplier Name">
                  <Input value={form.defaultSupplierName} onChange={(e) => set("defaultSupplierName", e.target.value)} placeholder="e.g. MedVet Distributors" />
                </F>
                <F label="Supplier ID">
                  <Input value={form.defaultSupplierId} onChange={(e) => set("defaultSupplierId", e.target.value)} placeholder="e.g. SUP-001" />
                </F>
                <F label="Lead Time (days)">
                  <Input type="number" min={0} value={form.leadTimeDays} onChange={(e) => set("leadTimeDays", e.target.value)} placeholder="7" />
                </F>
                <F label="Min Order Quantity">
                  <Input type="number" min={1} value={form.minOrderQty} onChange={(e) => set("minOrderQty", e.target.value)} placeholder="1" />
                </F>
                <F label="Purchase Account">
                  <Input value={form.purchaseAccount} onChange={(e) => set("purchaseAccount", e.target.value)} placeholder="e.g. 5000 — Inventory" />
                </F>
                <F label="Expense Account">
                  <Input value={form.expenseAccount} onChange={(e) => set("expenseAccount", e.target.value)} placeholder="e.g. 5200 — Supplier Payments" />
                </F>
              </div>
            </TabsContent>

            {/* ── Tab 5: Sales & Accounts ─────────────────────────── */}
            <TabsContent value="sales" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Income Account">
                  <Input value={form.incomeAccount} onChange={(e) => set("incomeAccount", e.target.value)} placeholder="e.g. 4200 — Pharmacy Income" />
                </F>
                <F label="Cost Centre">
                  <Input value={form.costCenter} onChange={(e) => set("costCenter", e.target.value)} placeholder="e.g. Pharmacy, Lab" />
                </F>
                <div className="col-span-2 grid grid-cols-2 gap-x-6">
                  <FCheck label="Is Sales Item" checked={form.isSalesItem} onChange={(v) => set("isSalesItem", v)} />
                  <FCheck label="Allow Alternative Item" checked={form.allowAlternativeItem} onChange={(v) => set("allowAlternativeItem", v)} />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {activeTab !== "sales" && (
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  const tabs = ["identity", "stock", "pricing", "purchasing", "sales"];
                  const idx = tabs.indexOf(activeTab);
                  if (idx < tabs.length - 1 && tabs[idx + 1]) {
                    setActiveTab(tabs[idx + 1]!);
                  }
                }}
              >
                Next tab →
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Item"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
