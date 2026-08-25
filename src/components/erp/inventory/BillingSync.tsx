import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Link2, Play, Check, ShoppingCart, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/erp/KpiCard";
import { toast } from "sonner";
import { useInventory } from "./useInventoryStore";

function money(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

// ─── Simulate Sale Panel ──────────────────────────────────────────────────────
function SimulateSalePanel() {
  const { medicines, getTotalQty, recordSale } = useInventory();
  const activeMeds = medicines.filter((m) => m.status === "Active" && getTotalQty(m.id) > 0);

  const [medicineId, setMedicineId] = useState("");
  const [qty, setQty] = useState("");
  const [billRef, setBillRef] = useState(`MB-${Date.now().toString().slice(-6)}`);
  const [lastResult, setLastResult] = useState<null | { ok: boolean; msg: string }>(null);

  const selectedMed = activeMeds.find((m) => m.id === medicineId);
  const availQty = medicineId ? getTotalQty(medicineId) : 0;

  const simulate = () => {
    if (!medicineId || !qty || !billRef) {
      toast.error("Fill all fields before simulating");
      return;
    }
    const numQty = Number(qty);
    if (numQty <= 0) { toast.error("Quantity must be > 0"); return; }

    const result = recordSale({
      medicineId,
      qty: numQty,
      sourceRef: billRef,
      actor: "Receptionist",
    });

    if (result.ok) {
      toast.success(`Sale recorded — ${numQty} units of ${selectedMed?.name} decremented via FEFO`);
      setLastResult({ ok: true, msg: `✓ ${numQty} units sold — stock updated` });
      setMedicineId("");
      setQty("");
      setBillRef(`MB-${Date.now().toString().slice(-6)}`);
    } else {
      toast.error(result.error ?? "Sale failed");
      setLastResult({ ok: false, msg: result.error ?? "Failed" });
    }
  };

  return (
    <div className="erp-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Play className="size-4 text-primary" />
        <p className="font-semibold">Counter Billing & FEFO Stock Dispatch</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Real-Time Billing Integration: Finalizing an invoice or counter prescription automatically decrements stock from the earliest-expiring batch (FEFO) and logs the entry in the stock ledger.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            Medicine <span className="text-destructive">*</span>
          </Label>
          <Select value={medicineId} onValueChange={(v) => { setMedicineId(v); setQty(""); }}>
            <SelectTrigger id="sale-medicine"><SelectValue placeholder="Select medicine…" /></SelectTrigger>
            <SelectContent>
              {activeMeds.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} ({getTotalQty(m.id)} avail)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sale-qty" className="text-xs font-semibold">
            Qty <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sale-qty"
            type="number"
            min={1}
            max={availQty}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
          {medicineId && (
            <p className="text-xs text-muted-foreground">Available: {availQty}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sale-ref" className="text-xs font-semibold">
            Bill Ref <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sale-ref"
            value={billRef}
            onChange={(e) => setBillRef(e.target.value)}
            placeholder="MB-XXXXXX"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {lastResult && (
          <span className={`text-sm font-medium ${lastResult.ok ? "text-success" : "text-destructive"}`}>
            {lastResult.ok ? <Check className="inline size-4 mr-1" /> : <AlertTriangle className="inline size-4 mr-1" />}
            {lastResult.msg}
          </span>
        )}
        <Button onClick={simulate} className="ml-auto shadow-xs active:scale-95">
          <Play className="size-4 mr-1" /> Record Sale
        </Button>
      </div>
    </div>
  );
}

// ─── Billing Sync Log ─────────────────────────────────────────────────────────
function BillingSyncLog() {
  const { ledger } = useInventory();
  const [query, setQuery] = useState("");

  const saleLedger = useMemo(
    () =>
      ledger.filter(
        (l) => l.movementType === "sale_out" || l.movementType === "return_in"
      ),
    [ledger]
  );

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return saleLedger.filter(
      (l) =>
        !q ||
        l.medicineName.toLowerCase().includes(q) ||
        l.sourceRef.toLowerCase().includes(q) ||
        l.batchNo.toLowerCase().includes(q)
    );
  }, [saleLedger, query]);

  const totalSold = saleLedger.reduce((s, l) => s + l.quantity, 0);
  const uniqueBills = new Set(saleLedger.map((l) => l.sourceRef)).size;
  const medicines = new Set(saleLedger.map((l) => l.medicineId)).size;

  const kpis = [
    { label: "Sale-driven decrements", value: String(saleLedger.length), trend: "all sources", trendTone: "up" as const },
    { label: "Total units sold", value: String(totalSold), trend: "via billing", trendTone: "up" as const },
    { label: "Linked bill refs", value: String(uniqueBills), trend: "invoices & manual bills", trendTone: "flat" as const },
    { label: "Medicines moved", value: String(medicines), trend: "distinct items", trendTone: "flat" as const },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.label} kpi={k} index={i} />)}
      </div>

      <SimulateSalePanel />

      <div className="erp-card overflow-hidden shadow-xs">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
          <div className="relative min-w-[220px] flex-1">
            <ShoppingCart className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="billing-sync-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by medicine, batch, bill ref…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
            <Link2 className="size-3.5" />
            In-transaction sync — bills and stock always agree
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                {["Time", "Bill Ref", "Source", "Medicine", "Batch (FEFO)", "Qty Sold", "Bal After", "Actor"].map((h) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide ${h === "Qty Sold" || h === "Bal After" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((l) => (
                <tr key={l.id} className="hover:bg-primary-soft/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.createdAt}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{l.sourceRef}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {l.sourceType.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{l.medicineName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.batchNo}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-destructive">−{l.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.balanceAfter}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.actorName}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No sale-driven stock movements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

export function BillingSync() {
  return <BillingSyncLog />;
}
