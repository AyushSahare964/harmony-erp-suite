import { useState } from "react";
import { AlertTriangle, Plus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/erp/StatusPill";
import { useInventory, type Medicine, type Batch } from "../../useInventoryStore";
import { toast } from "sonner";

interface Props {
  medicine: Medicine;
  batches: Batch[];
  stockQty: number;
}

// ─── Warehouse storage locations ─────────────────────────────────────────────
const WAREHOUSES = [
  { name: "Main Central Pharmacy", reserved: 5 },
  { name: "OPD Dispense Counter", reserved: 2 },
  { name: "Emergency Crash Cart", reserved: 0 },
];

function money(v: number) { return `₹${v.toLocaleString("en-IN")}`; }

function getExpiryClass(expiryDate: string) {
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return "text-destructive font-bold";
  if (days < 30) return "text-destructive font-semibold";
  if (days < 90) return "text-warning font-semibold";
  return "text-muted-foreground";
}

function getExpiryLabel(expiryDate: string) {
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${expiryDate} (Expired ${Math.abs(days)}d ago)`;
  if (days < 90) return `${expiryDate} (${days}d left)`;
  return expiryDate;
}

export function ItemInventory({ medicine, batches, stockQty }: Props) {
  const { addStock } = useInventory();
  const [reorderLevel, setReorderLevel] = useState(String(medicine.reorderLevel));
  const [reorderQty, setReorderQty] = useState(String(medicine.reorderQty));
  const [trackBatch, setTrackBatch] = useState(medicine.batchTracking);
  const [trackSerial, setTrackSerial] = useState(medicine.serialTracking);
  const [allowNegative, setAllowNegative] = useState(medicine.allowNegativeStock);

  // New batch inline form
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [batchNo, setBatchNo] = useState("");
  const [batchQty, setBatchQty] = useState("50");
  const [expiryDate, setExpiryDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(String(medicine.defaultPurchasePrice || 10));
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  const handleCreateBatch = async () => {
    if (!batchNo.trim()) {
      toast.error("Please enter a Batch Number");
      return;
    }
    if (!expiryDate) {
      toast.error("Please select an Expiry Date");
      return;
    }
    const numQty = parseInt(batchQty, 10);
    if (!numQty || numQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setIsSubmittingBatch(true);
    try {
      await addStock({
        itemCode: medicine.itemCode,
        itemName: medicine.name,
        batchNo: batchNo.trim(),
        expiryDate,
        receivedQty: numQty,
        acceptedQty: numQty,
        purchasePricePerUnit: parseFloat(purchasePrice) || medicine.defaultPurchasePrice || 10,
        receivedDate: new Date().toISOString().slice(0, 10),
        actor: "Admin Operator",
      });
      toast.success(`Batch ${batchNo} added successfully (${numQty} units).`);
      setBatchNo("");
      setExpiryDate("");
      setShowAddBatch(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record batch");
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Distribute qty across warehouses proportionally
  const warehouseStock = WAREHOUSES.map((w, i) => {
    const share = i === 0 ? 0.7 : i === 1 ? 0.2 : 0.1;
    const actual = Math.floor(stockQty * share);
    const available = Math.max(0, actual - w.reserved);
    return { ...w, actual, available };
  });

  return (
    <div className="space-y-6">
      {/* ── Reorder Settings ─────────────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Reorder & Stock Thresholds</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Reorder Level ({medicine.unit})</Label>
            <Input
              type="number"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              min={0}
            />
            <p className="text-[11px] text-muted-foreground">Auto-generate purchase requisition when below this level.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Reorder Quantity ({medicine.unit})</Label>
            <Input
              type="number"
              value={reorderQty}
              onChange={(e) => setReorderQty(e.target.value)}
              min={0}
            />
            <p className="text-[11px] text-muted-foreground">Default purchase order quantity.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Safety Stock ({medicine.unit})</Label>
            <Input
              type="number"
              defaultValue={medicine.safetyStock}
              min={0}
            />
            <p className="text-[11px] text-muted-foreground">Emergency buffer to prevent stockouts.</p>
          </div>
        </div>
      </div>

      {/* ── Tracking Settings ────────────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Stock Tracking & Controls</p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={trackBatch}
              onChange={(e) => setTrackBatch(e.target.checked)}
              className="size-4 rounded accent-primary"
            />
            <span className="font-medium">Has Batch / Lot Tracking</span>
            <span className="text-xs text-muted-foreground">— Required for medicines with expiry dates</span>
          </label>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={trackSerial}
              onChange={(e) => setTrackSerial(e.target.checked)}
              className="size-4 rounded accent-primary"
            />
            <span>Has Serial Number Tracking</span>
            <span className="text-xs text-muted-foreground">— For equipment and high-value surgical items</span>
          </label>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={allowNegative}
              onChange={(e) => setAllowNegative(e.target.checked)}
              className="size-4 rounded accent-primary"
            />
            <span className="flex items-center gap-1.5 text-warning">
              <AlertTriangle className="size-3.5" />
              Allow Negative Stock
            </span>
            <span className="text-xs text-muted-foreground">— Not recommended for pharmaceuticals</span>
          </label>
        </div>
      </div>

      {/* ── Warehouse Stock ──────────────────────────────────────────────── */}
      <div>
        <p className="section-label mb-3">Warehouse Stock Distribution</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Location", "Physical Stock", "Reserved", "Available for Sale", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {warehouseStock.map((w) => (
                <tr key={w.name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{w.actual}</td>
                  <td className="px-4 py-3 tabular-nums text-warning">{w.reserved}</td>
                  <td className="px-4 py-3 tabular-nums text-success font-semibold">{w.available}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toast.info(`Transfer dialog for ${w.name}`)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Transfer
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 tabular-nums">{stockQty}</td>
                <td className="px-4 py-3 tabular-nums text-warning">{warehouseStock.reduce((s, w) => s + w.reserved, 0)}</td>
                <td className="px-4 py-3 tabular-nums text-success">{warehouseStock.reduce((s, w) => s + w.available, 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Batch / Lot List ─────────────────────────────────────────────── */}
      {trackBatch && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="section-label">Batch & Expiry Records</p>
            <Button size="sm" onClick={() => setShowAddBatch((v) => !v)}>
              <Plus className="mr-1.5 size-3.5" />{showAddBatch ? "Cancel" : "Add Batch"}
            </Button>
          </div>

          {showAddBatch && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <PackagePlus className="size-4 text-primary" />
                <p className="text-xs font-semibold text-primary">Add New Batch / GRN Entry</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Batch Number *</Label>
                  <Input
                    placeholder="e.g. BAT-2026-001"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity ({medicine.unit}) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiry Date *</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Purchase Price (₹)</Label>
                  <Input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setShowAddBatch(false)}>Cancel</Button>
                <Button size="sm" disabled={isSubmittingBatch} onClick={handleCreateBatch}>
                  {isSubmittingBatch ? "Recording..." : "Save Batch"}
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  {["Batch No.", "Qty", "Purchase Price", "Expiry Date", "Supplier", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{b.batchNo}</td>
                    <td className="px-4 py-2.5 font-medium">{b.qty}</td>
                    <td className="px-4 py-2.5">{money(b.purchasePrice)}</td>
                    <td className={`px-4 py-2.5 text-xs ${getExpiryClass(b.expiryDate)}`}>
                      {getExpiryLabel(b.expiryDate)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{b.supplierName || b.supplierId || "—"}</td>
                    <td className="px-4 py-2.5"><StatusPill value={b.qty > 0 ? "active" : "out of stock"} /></td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      No active batches recorded. Click &quot;Add Batch&quot; above to log stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
