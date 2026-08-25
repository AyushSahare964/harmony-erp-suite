import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, Check, TrendingDown, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useInventory } from "./useInventoryStore";

const REMOVAL_REASONS = ["Wastage", "Damage", "Internal Use", "Theft", "Expiry Write-off", "Other"];

// ─── Add Stock Panel ──────────────────────────────────────────────────────────
function AddStockPanel() {
  const { medicines, getBatches, addStock } = useInventory();
  const activeMeds = medicines.filter((m) => m.status === "Active");

  const [medicineId, setMedicineId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [qty, setQty] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const existingBatches = useMemo(
    () => (medicineId ? getBatches(medicineId) : []),
    [medicineId, getBatches]
  );

  const selectedMed = activeMeds.find((m) => m.id === medicineId);

  // Auto-fill existing batch data if batch number matches
  const matchingBatch = useMemo(
    () => existingBatches.find((b) => b.batchNo === batchNo),
    [existingBatches, batchNo]
  );

  const reset = () => {
    setMedicineId("");
    setBatchNo("");
    setExpiryDate("");
    setPurchasePrice("");
    setQty("");
    setSupplierId("");
  };

  const submit = () => {
    if (!medicineId || !batchNo.trim() || !expiryDate || !qty) {
      toast.error("Please fill all required fields");
      return;
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) { toast.error("Quantity must be greater than 0"); return; }

    const selected = activeMeds.find((m) => m.id === medicineId);
    void addStock({
      itemCode: medicineId,
      itemName: selected?.name ?? "",
      batchNo: batchNo.trim(),
      manufacturingDate: "",
      expiryDate,
      purchasePricePerUnit: Number(purchasePrice) || 0,
      receivedDate: new Date().toISOString().slice(0, 10),
      receivedQty: numQty,
      acceptedQty: numQty,
      ...(supplierId.trim() ? { supplierId: supplierId.trim() } : {}),
      actor: "Dr. Ananya Rao",
    });
    toast.success(`+${numQty} units added to stock`);
    reset();
  };

  return (
    <div className="erp-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="size-5 text-success" />
        <p className="font-semibold text-foreground">Add Stock (Purchase / Adjustment In)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Medicine */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs font-semibold">
            Medicine <span className="text-destructive">*</span>
          </Label>
          <Select value={medicineId} onValueChange={setMedicineId}>
            <SelectTrigger id="add-medicine"><SelectValue placeholder="Select medicine…" /></SelectTrigger>
            <SelectContent>
              {activeMeds.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Batch No */}
        <div className="space-y-1.5">
          <Label htmlFor="add-batch" className="text-xs font-semibold">
            Batch No. <span className="text-destructive">*</span>
          </Label>
          <Input
            id="add-batch"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            placeholder="e.g. AMX-2026-01"
            list="existing-batches"
          />
          {existingBatches.length > 0 && (
            <datalist id="existing-batches">
              {existingBatches.map((b) => <option key={b.id} value={b.batchNo} />)}
            </datalist>
          )}
          {matchingBatch && (
            <p className="text-xs text-warning">
              Existing batch — current qty: {matchingBatch.qty} {selectedMed?.unit ?? ""}
            </p>
          )}
        </div>

        {/* Expiry Date */}
        <div className="space-y-1.5">
          <Label htmlFor="add-expiry" className="text-xs font-semibold">
            Expiry Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="add-expiry"
            type="date"
            value={matchingBatch?.expiryDate ?? expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={!!matchingBatch}
          />
        </div>

        {/* Quantity */}
        <div className="space-y-1.5">
          <Label htmlFor="add-qty" className="text-xs font-semibold">
            Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            id="add-qty"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Purchase Price */}
        <div className="space-y-1.5">
          <Label htmlFor="add-price" className="text-xs font-semibold">Purchase Price (₹)</Label>
          <Input
            id="add-price"
            type="number"
            min={0}
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Supplier */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="add-supplier" className="text-xs font-semibold">Supplier (optional)</Label>
          <Input
            id="add-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="e.g. SUP-01 or supplier name"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={reset}>Clear</Button>
        <Button onClick={submit} className="bg-success text-success-foreground hover:bg-success/90">
          <ArrowUpCircle className="size-4 mr-1" /> Add Stock
        </Button>
      </div>
    </div>
  );
}

// ─── Remove Stock Panel ───────────────────────────────────────────────────────
function RemoveStockPanel() {
  const { medicines, getBatches, getTotalQty, removeStock } = useInventory();
  const activeMeds = medicines.filter((m) => m.status === "Active");

  const [medicineId, setMedicineId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  const batches = useMemo(
    () => (medicineId ? getBatches(medicineId).filter((b) => b.qty > 0) : []),
    [medicineId, getBatches]
  );

  const selectedBatch = batches.find((b) => b.id === batchId);
  const totalQty = medicineId ? getTotalQty(medicineId) : 0;

  const reset = () => {
    setMedicineId("");
    setBatchId("");
    setQty("");
    setReason("");
  };

  const submit = () => {
    if (!medicineId || !batchId || !qty || !reason) {
      toast.error("All fields are required for stock removal");
      return;
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) { toast.error("Quantity must be greater than 0"); return; }
    if (selectedBatch && numQty > selectedBatch.qty) {
      toast.error(`Cannot remove more than available batch quantity (${selectedBatch.qty})`);
      return;
    }

    removeStock({
      medicineId,
      batchId,
      qty: numQty,
      reason,
      actor: "Dr. Ananya Rao",
    });
    toast.success(`−${numQty} units removed from stock`);
    reset();
  };

  return (
    <div className="erp-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowDownCircle className="size-5 text-destructive" />
        <p className="font-semibold text-foreground">Remove Stock (Adjustment Out)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Medicine */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs font-semibold">
            Medicine <span className="text-destructive">*</span>
          </Label>
          <Select value={medicineId} onValueChange={(v) => { setMedicineId(v); setBatchId(""); }}>
            <SelectTrigger id="remove-medicine"><SelectValue placeholder="Select medicine…" /></SelectTrigger>
            <SelectContent>
              {activeMeds.map((m) => {
                const qty = getTotalQty(m.id);
                return (
                  <SelectItem key={m.id} value={m.id} disabled={qty === 0}>
                    {m.name} — {qty} available
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {medicineId && (
            <p className="text-xs text-muted-foreground">Total available: {totalQty} units across {batches.length} batch(es)</p>
          )}
        </div>

        {/* Batch */}
        {batches.length > 0 && (
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">
              Batch <span className="text-destructive">*</span>
            </Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger id="remove-batch"><SelectValue placeholder="Select batch…" /></SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batchNo} — Exp: {b.expiryDate} — Qty: {b.qty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Quantity */}
        <div className="space-y-1.5">
          <Label htmlFor="remove-qty" className="text-xs font-semibold">
            Quantity to Remove <span className="text-destructive">*</span>
          </Label>
          <Input
            id="remove-qty"
            type="number"
            min={1}
            max={selectedBatch?.qty}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
          {selectedBatch && (
            <p className="text-xs text-muted-foreground">Max: {selectedBatch.qty} units in this batch</p>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="remove-reason"><SelectValue placeholder="Select reason…" /></SelectTrigger>
            <SelectContent>
              {REMOVAL_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={reset}>Clear</Button>
        <Button
          onClick={submit}
          variant="destructive"
          className="active:scale-95"
        >
          <ArrowDownCircle className="size-4 mr-1" /> Remove Stock
        </Button>
      </div>
    </div>
  );
}

// ─── Recent Movements Table ───────────────────────────────────────────────────
function MovementsLog() {
  const { ledger } = useInventory();
  const manualMoves = ledger.filter(
    (l) =>
      l.movementType === "purchase_in" ||
      l.movementType === "adjustment_in" ||
      l.movementType === "adjustment_out" ||
      l.movementType === "expiry_writeoff"
  );

  return (
    <div className="erp-card p-5 space-y-3">
      <p className="section-label">Manual Movement History</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              {["Time", "Medicine", "Batch", "Type", "Qty", "Reason", "Actor", "Ref"].map((h) => (
                <th key={h} className={`pb-2 font-bold uppercase tracking-wide text-left px-2`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {manualMoves.slice(0, 12).map((l) => (
              <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{l.createdAt}</td>
                <td className="px-2 py-2 font-medium">{l.medicineName}</td>
                <td className="px-2 py-2 font-mono text-muted-foreground">{l.batchNo}</td>
                <td className="px-2 py-2">
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    l.movementType.includes("in") ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"
                  }`}>
                    {l.movementType.includes("in") ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                    {l.movementType.replace(/_/g, " ").toUpperCase()}
                  </span>
                </td>
                <td className={`px-2 py-2 tabular-nums font-semibold ${l.movementType.includes("in") ? "text-success" : "text-destructive"}`}>
                  {l.movementType.includes("in") ? "+" : "−"}{l.quantity}
                </td>
                <td className="px-2 py-2 text-muted-foreground">{l.reason ?? "—"}</td>
                <td className="px-2 py-2 text-muted-foreground">{l.actorName}</td>
                <td className="px-2 py-2 font-mono text-muted-foreground">{l.sourceRef}</td>
              </tr>
            ))}
            {manualMoves.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No manual movements yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StockMovements() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <AddStockPanel />
        <RemoveStockPanel />
      </div>
      <MovementsLog />
    </motion.div>
  );
}
