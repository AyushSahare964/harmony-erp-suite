/**
 * AddStockDialog — Full Goods Receipt Note (GRN) / Add Stock form.
 * Records: batch details, QC, pricing, landing costs, supplier info.
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
import { useInventory, type Medicine } from "./useInventoryStore";

// ─── Field wrapper ────────────────────────────────────────────────────────────
function F({ label, required, children, hint }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FCheck({ label, id, checked, onChange }: {
  label: string; id: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} className="rounded" />
      <Label htmlFor={id} className="text-xs cursor-pointer">{label}</Label>
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────
interface GRNForm {
  // Item
  itemCode: string;
  itemName: string;
  // Batch
  batchNo: string;
  manufacturingDate: string;
  expiryDate: string;
  // Supplier
  supplierId: string;
  supplierName: string;
  purchaseOrderRef: string;
  invoiceBillNo: string;
  receivedDate: string;
  // Quantities
  receivedQty: string;
  rejectedQty: string;
  rejectionReason: string;
  // Pricing
  purchasePricePerUnit: string;
  landingCost: string;
  gstOnPurchase: string;
  // Storage / QC
  storageLocation: string;
  qualityChecked: boolean;
  qcInspectorName: string;
  remarks: string;
}

const EMPTY_GRN: GRNForm = {
  itemCode: "", itemName: "",
  batchNo: "", manufacturingDate: "", expiryDate: "",
  supplierId: "", supplierName: "",
  purchaseOrderRef: "", invoiceBillNo: "",
  receivedDate: new Date().toISOString().slice(0, 10),
  receivedQty: "", rejectedQty: "0", rejectionReason: "",
  purchasePricePerUnit: "", landingCost: "0", gstOnPurchase: "",
  storageLocation: "", qualityChecked: false, qcInspectorName: "", remarks: "",
};

// ─── Computed summary ─────────────────────────────────────────────────────────
function computeSummary(form: GRNForm) {
  const received = Number(form.receivedQty) || 0;
  const rejected = Number(form.rejectedQty) || 0;
  const accepted = Math.max(0, received - rejected);
  const ppu = Number(form.purchasePricePerUnit) || 0;
  const landing = Number(form.landingCost) || 0;
  const gstPct = Number(form.gstOnPurchase) || 0;
  const landingPerUnit = accepted > 0 ? landing / accepted : 0;
  const baseValue = accepted * ppu;
  const gstAmt = baseValue * gstPct / 100;
  const totalValue = baseValue + landing + gstAmt;
  return { accepted, landingPerUnit, baseValue, gstAmt, totalValue };
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────
export function AddStockDialog({
  open, onClose, preselectedItem,
}: {
  open: boolean;
  onClose: () => void;
  preselectedItem?: Medicine;
}) {
  const { medicines, addStock } = useInventory();
  const [form, setForm] = useState<GRNForm>(() => ({
    ...EMPTY_GRN,
    itemCode: preselectedItem?.itemCode ?? "",
    itemName: preselectedItem?.name ?? "",
    gstOnPurchase: preselectedItem ? String(preselectedItem.gstRate) : "",
    storageLocation: preselectedItem?.storageLocation ?? "",
    supplierName: preselectedItem?.defaultSupplierName ?? "",
    supplierId: preselectedItem?.defaultSupplierId ?? "",
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        ...EMPTY_GRN,
        itemCode: preselectedItem?.itemCode ?? "",
        itemName: preselectedItem?.name ?? "",
        gstOnPurchase: preselectedItem ? String(preselectedItem.gstRate) : "",
        storageLocation: preselectedItem?.storageLocation ?? "",
        supplierName: preselectedItem?.defaultSupplierName ?? "",
        supplierId: preselectedItem?.defaultSupplierId ?? "",
        receivedDate: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, preselectedItem]);

  const set = <K extends keyof GRNForm>(key: K, value: GRNForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Auto-fill item details when item changes
  const onItemChange = (code: string) => {
    const item = medicines.find((m) => m.itemCode === code);
    setForm((f) => ({
      ...f,
      itemCode: code,
      itemName: item?.name ?? "",
      gstOnPurchase: item ? String(item.gstRate) : f.gstOnPurchase,
      storageLocation: item?.storageLocation ?? f.storageLocation,
      supplierName: item?.defaultSupplierName ?? f.supplierName,
      supplierId: item?.defaultSupplierId ?? f.supplierId,
    }));
  };

  const summary = computeSummary(form);

  const submit = async () => {
    if (!form.itemCode) { toast.error("Select an item"); return; }
    if (!form.batchNo.trim()) { toast.error("Batch number is required"); return; }
    if (!form.expiryDate) { toast.error("Expiry date is required"); return; }
    if (!form.receivedQty || Number(form.receivedQty) <= 0) { toast.error("Received quantity must be > 0"); return; }
    if (!form.purchasePricePerUnit || Number(form.purchasePricePerUnit) <= 0) { toast.error("Purchase price is required"); return; }
    if (!form.receivedDate) { toast.error("Received date is required"); return; }

    setSaving(true);
    try {
      await addStock({
        itemCode: form.itemCode,
        itemName: form.itemName,
        batchNo: form.batchNo.trim(),
        manufacturingDate: form.manufacturingDate,
        expiryDate: form.expiryDate,
        supplierId: form.supplierId.trim(),
        supplierName: form.supplierName.trim(),
        purchaseOrderRef: form.purchaseOrderRef.trim(),
        invoiceBillNo: form.invoiceBillNo.trim(),
        receivedDate: form.receivedDate,
        receivedQty: Number(form.receivedQty),
        acceptedQty: summary.accepted,
        rejectedQty: Number(form.rejectedQty) || 0,
        rejectionReason: form.rejectionReason.trim(),
        purchasePricePerUnit: Number(form.purchasePricePerUnit),
        landingCost: Number(form.landingCost) || 0,
        gstOnPurchase: Number(form.gstOnPurchase) || 0,
        storageLocation: form.storageLocation.trim(),
        qualityChecked: form.qualityChecked,
        qcInspectorName: form.qcInspectorName.trim(),
        remarks: form.remarks.trim(),
        actor: "System",
      });
      toast.success(`Stock added — ${summary.accepted} units of ${form.itemName}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">Goods Receipt Note (GRN) — Add Stock</DialogTitle>
          <DialogDescription className="text-xs">
            Record an incoming batch. All fields are persisted to MongoDB. Accepted = Received − Rejected.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* Section: Item */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Item Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <F label="Item" required>
                <Select value={form.itemCode} onValueChange={onItemChange} disabled={!!preselectedItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item…" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines.filter((m) => m.status === "Active").map((m) => (
                      <SelectItem key={m.itemCode} value={m.itemCode}>
                        {m.itemCode} — {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Item Name">
                <Input value={form.itemName} readOnly className="bg-muted/40 cursor-not-allowed" />
              </F>
            </div>
          </section>

          {/* Section: Batch */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Batch Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <F label="Batch / Lot Number" required>
                <Input value={form.batchNo} onChange={(e) => set("batchNo", e.target.value)} placeholder="e.g. AMX-2025-01" />
              </F>
              <F label="Manufacturing Date">
                <Input type="date" value={form.manufacturingDate} onChange={(e) => set("manufacturingDate", e.target.value)} />
              </F>
              <F label="Expiry Date" required>
                <Input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
              </F>
            </div>
          </section>

          {/* Section: Supplier & Reference */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Supplier & Reference</h3>
            <div className="grid grid-cols-2 gap-4">
              <F label="Supplier Name">
                <Input value={form.supplierName} onChange={(e) => set("supplierName", e.target.value)} placeholder="e.g. MedVet Distributors" />
              </F>
              <F label="Supplier ID">
                <Input value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)} placeholder="e.g. SUP-001" />
              </F>
              <F label="Purchase Order Ref.">
                <Input value={form.purchaseOrderRef} onChange={(e) => set("purchaseOrderRef", e.target.value)} placeholder="e.g. PO-2025-012" />
              </F>
              <F label="Invoice / Bill No.">
                <Input value={form.invoiceBillNo} onChange={(e) => set("invoiceBillNo", e.target.value)} placeholder="e.g. INV-20055" />
              </F>
              <F label="Received Date" required>
                <Input type="date" value={form.receivedDate} onChange={(e) => set("receivedDate", e.target.value)} />
              </F>
            </div>
          </section>

          {/* Section: Quantities */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quantities</h3>
            <div className="grid grid-cols-3 gap-4">
              <F label="Received Qty" required>
                <Input type="number" min={1} value={form.receivedQty} onChange={(e) => set("receivedQty", e.target.value)} placeholder="0" />
              </F>
              <F label="Rejected Qty">
                <Input type="number" min={0} value={form.rejectedQty} onChange={(e) => set("rejectedQty", e.target.value)} placeholder="0" />
              </F>
              <div className="flex flex-col justify-end">
                <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Accepted Qty: </span>
                  <span className="font-bold text-sm">{summary.accepted}</span>
                </div>
              </div>
              {Number(form.rejectedQty) > 0 && (
                <div className="col-span-3">
                  <F label="Rejection Reason">
                    <Input value={form.rejectionReason} onChange={(e) => set("rejectionReason", e.target.value)} placeholder="e.g. Damaged packaging, short expiry" />
                  </F>
                </div>
              )}
            </div>
          </section>

          {/* Section: Pricing */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Pricing & Costing</h3>
            <div className="grid grid-cols-3 gap-4">
              <F label="Purchase Price / Unit (₹)" required>
                <Input type="number" min={0} step={0.01} value={form.purchasePricePerUnit} onChange={(e) => set("purchasePricePerUnit", e.target.value)} placeholder="0.00" />
              </F>
              <F label="Landing Cost (₹ total)" hint="Freight, duties, insurance">
                <Input type="number" min={0} step={0.01} value={form.landingCost} onChange={(e) => set("landingCost", e.target.value)} placeholder="0.00" />
              </F>
              <F label="GST on Purchase (%)">
                <Input type="number" min={0} max={28} value={form.gstOnPurchase} onChange={(e) => set("gstOnPurchase", e.target.value)} placeholder="12" />
              </F>
            </div>
          </section>

          {/* Section: Storage & QC */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Storage & Quality</h3>
            <div className="grid grid-cols-2 gap-4">
              <F label="Storage Location">
                <Input value={form.storageLocation} onChange={(e) => set("storageLocation", e.target.value)} placeholder="e.g. Cold Storage, Shelf B2" />
              </F>
              <F label="QC Inspector Name">
                <Input value={form.qcInspectorName} onChange={(e) => set("qcInspectorName", e.target.value)} placeholder="e.g. Dr. Ananya Rao" disabled={!form.qualityChecked} />
              </F>
              <div className="col-span-2">
                <FCheck label="Quality Check Performed" id="qc-check" checked={form.qualityChecked} onChange={(v) => set("qualityChecked", v)} />
              </div>
              <div className="col-span-2">
                <F label="Remarks / Notes">
                  <Input value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Any special notes about this shipment" />
                </F>
              </div>
            </div>
          </section>

          {/* Summary card */}
          {form.itemCode && Number(form.receivedQty) > 0 && Number(form.purchasePricePerUnit) > 0 && (
            <section className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <h3 className="text-xs font-semibold text-primary mb-2">Receipt Summary</h3>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-muted-foreground">Accepted</p><p className="font-semibold">{summary.accepted} units</p></div>
                <div><p className="text-muted-foreground">Base Value</p><p className="font-semibold">₹{summary.baseValue.toFixed(2)}</p></div>
                <div><p className="text-muted-foreground">GST Amount</p><p className="font-semibold">₹{summary.gstAmt.toFixed(2)}</p></div>
                <div><p className="text-muted-foreground text-xs font-bold">Total Value</p><p className="font-bold text-base text-primary">₹{summary.totalValue.toFixed(2)}</p></div>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t border-border shrink-0 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Record GRN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
