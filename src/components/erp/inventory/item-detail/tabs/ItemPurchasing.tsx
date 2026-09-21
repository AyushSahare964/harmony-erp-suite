import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { listSuppliersFn, type SupplierMasterRow } from "@/lib/mongodb/serverFns/masters";
import { useInventory, type Medicine } from "../../useInventoryStore";

interface Props { medicine: Medicine; }

export function ItemPurchasing({ medicine }: Props) {
  const { addStock } = useInventory();
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState("");

  useEffect(() => {
    listSuppliersFn()
      .then((rows) => {
        setSuppliers(rows);
        if (rows.length > 0) setSelectedSupplier(rows[0]!.name);
      })
      .catch((err) => {
        console.error("[ItemPurchasing] Failed to load suppliers:", err);
        toast.error("Could not load suppliers from Accounting.");
      })
      .finally(() => setLoadingSuppliers(false));
  }, []);

  // Inline "Record Purchase" form — reuses the same GRN flow ItemInventory.tsx's
  // "Add Batch" uses, pre-filled with the supplier picked above.
  const [showRecordPurchase, setShowRecordPurchase] = useState(false);
  const [batchNo, setBatchNo] = useState("");
  const [purchaseQty, setPurchaseQty] = useState("1");
  const [purchasePrice, setPurchasePrice] = useState(String(medicine.defaultPurchasePrice || medicine.lastPurchaseRate || 0));
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRecordPurchase = async () => {
    if (!batchNo.trim()) {
      toast.error("Please enter a Batch Number");
      return;
    }
    if (!expiryDate) {
      toast.error("Please select an Expiry Date");
      return;
    }
    const qty = parseInt(purchaseQty, 10);
    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      await addStock({
        itemCode: medicine.itemCode,
        itemName: medicine.name,
        batchNo: batchNo.trim(),
        expiryDate,
        receivedQty: qty,
        acceptedQty: qty,
        purchasePricePerUnit: parseFloat(purchasePrice) || 0,
        receivedDate: new Date().toISOString().slice(0, 10),
        supplierName: selectedSupplier || "",
        actor: "Admin Operator",
      });
      toast.success(`Purchase recorded — batch ${batchNo} from ${selectedSupplier || "supplier"} (${qty} units).`);
      setBatchNo("");
      setExpiryDate("");
      setShowRecordPurchase(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record purchase");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Primary purchasing fields ──────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Purchasing Settings</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Default Supplier</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier} disabled={loadingSuppliers || suppliers.length === 0}>
              <SelectTrigger><SelectValue placeholder={loadingSuppliers ? "Loading…" : "No suppliers found"} /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s._id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Minimum Order Qty</Label>
            <Input type="number" defaultValue={medicine.reorderLevel} min={1} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Last Purchase Price (₹)</Label>
            <Input type="number" value={medicine.lastPurchaseRate || 0} readOnly className="bg-muted/20" />
            <p className="text-[11px] text-muted-foreground">Set automatically from the most recent recorded purchase.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Purchase UOM</Label>
            <Select defaultValue={medicine.unit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Tablet", "ml", "Vial", "Box", "Strip", "Kg", "Bottle"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Suppliers (from Accounting → Suppliers) ──────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Suppliers</p>
          <Button size="sm" onClick={() => setShowRecordPurchase((v) => !v)}>
            <Plus className="mr-1.5 size-3.5" />{showRecordPurchase ? "Cancel" : "Record Purchase"}
          </Button>
        </div>

        {showRecordPurchase && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">
              Record Purchase (GRN) from {selectedSupplier || "selected supplier"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Batch Number *</Label>
                <Input placeholder="e.g. BAT-2026-001" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantity ({medicine.unit}) *</Label>
                <Input type="number" min={1} value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiry Date *</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Purchase Price (₹)</Label>
                <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setShowRecordPurchase(false)}>Cancel</Button>
              <Button size="sm" disabled={submitting} onClick={handleRecordPurchase}>
                {submitting ? "Recording..." : "Save Purchase"}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Supplier", "Contact Person", "Phone", "Credit Days"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingSuppliers ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">Loading suppliers…</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">No suppliers found. Add one from Accounting → Supplier Bills.</td></tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s._id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.contactPerson || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.phone || "—"}</td>
                    <td className="px-4 py-2.5">{s.creditDays}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
