import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, CheckCircle2, Search,
  ShoppingCart, Package, User, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import { todayIST } from "@/lib/utils/dateUtils";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { finalizeVisitAndBillFn } from "@/lib/mongodb/serverFns/clinical";
import { listInvoicesFn, deleteInvoiceFn } from "@/lib/mongodb/serverFns/billing";

interface PetOption { id: string; name: string; owner: string; ownerId?: string; ownerPhone?: string; species?: string; breed?: string; }

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

function money(v: number) {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── New Bill Form ──────────────────────────────────────────────── */
function NewBillDialog({
  open,
  onClose,
  onSaved,
  products,
  pets,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  products: InventoryItemRow[];
  pets: PetOption[];
}) {
  const [petId, setPetId] = useState("walkin");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const pet = pets.find((p) => p.id === petId);

  const filteredProds = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(prodSearch.toLowerCase())
      ),
    [prodSearch, products]
  );

  const addLine = (prod: InventoryItemRow) => {
    const price = prod.defaultSalePrice ?? 0;
    const gst = (prod as any).gstRate ?? 0;
    const existing = lines.find((l) => l.productId === prod.itemCode);
    if (existing) {
      setLines((prev) =>
        prev.map((l) =>
          l.productId === prod.itemCode
            ? recalcLine({ ...l, qty: l.qty + 1 })
            : l
        )
      );
    } else {
      setLines((prev) => [
        ...prev,
        recalcLine({
          id: crypto.randomUUID(),
          productId: prod.itemCode,
          productName: prod.name,
          qty: 1,
          unitPrice: price,
          taxRate: gst,
          lineTotal: 0,
        }),
      ]);
    }
  };

  function recalcLine(l: LineItem): LineItem {
    const base = l.qty * l.unitPrice;
    const tax = base * (l.taxRate / 100);
    return { ...l, lineTotal: base + tax };
  }

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return;
    setLines((prev) =>
      prev.map((l) => (l.id === id ? recalcLine({ ...l, qty }) : l))
    );
  };

  const updatePrice = (id: string, price: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? recalcLine({ ...l, unitPrice: price }) : l))
    );
  };

  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const taxTotal = lines.reduce(
    (s, l) => s + l.qty * l.unitPrice * (l.taxRate / 100),
    0
  );
  const grandTotal = Math.max(0, subtotal + taxTotal - discount);

  const handleSave = async () => {
    if (lines.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    setSaving(true);
    try {
      const visitId = `V-MB-${Date.now().toString(36).toUpperCase()}`;
      const res = await finalizeVisitAndBillFn({
        data: {
          visitId,
          petId: pet?.id || "OTC-WALKIN",
          petName: pet?.name || "General OTC Walk-in",
          species: pet?.species || "General",
          breed: pet?.breed || "General",
          ownerId: pet?.ownerId || "WALKIN",
          ownerName: pet?.owner || "CASH",
          ownerPhone: pet?.ownerPhone,
          branch: "Main Clinic",
          billType: "GST" as const,
          doctorName: "Manual Billing",
          diagnosis: "Manual Product Bill",
          clinicalNotes: notes || undefined,
          items: lines.map((l) => ({
            lineType: "Pharmacy" as const,
            name: l.productName,
            quantity: l.qty,
            unitPrice: l.unitPrice,
            discountPercent: 0,
            discountType: "percentage" as const,
            discountValue: 0,
            gstRate: l.taxRate,
            lineTotal: l.lineTotal,
          })),
          subtotal,
          billDiscount: discount,
          taxableAmount: subtotal - discount,
          gstAmount: taxTotal,
          roundOff: 0,
          totalAmount: grandTotal,
          amountPaid: grandTotal,
          pendingAmount: 0,
          paymentStatus: "Full" as const,
          paymentMode: "Cash" as const,
        },
      });

      toast.success(`Bill ${res.invoiceNo || visitId} finalized — stock decremented`);
      onSaved();
      onClose();
      setLines([]);
      setPetId("walkin");
      setDiscount(0);
      setNotes("");
      setProdSearch("");
    } catch (err) {
      console.error("[ManualBilling] Save failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            New Manual Bill
          </DialogTitle>
          <DialogDescription>
            Raise a bill for retail products or ad-hoc services — no prior encounter needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Pet / Owner */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <User className="size-3.5" /> Pet / Owner (optional)
            </Label>
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger>
                <SelectValue placeholder="Walk-in / no record" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walkin">Walk-in / No pet record</SelectItem>
                {pets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Picker */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Package className="size-3.5" /> Add Products
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 text-sm"
                placeholder="Search catalogue…"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
              />
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-muted/30 divide-y divide-border">
              {filteredProds.length === 0 ? (
                <p className="px-3 py-4 text-xs text-center text-muted-foreground">
                  No inventory items match. Add items from Inventory & Procurement first.
                </p>
              ) : (
                filteredProds.map((p) => (
                  <button
                    key={p.itemCode}
                    onClick={() => addLine(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-primary-soft/40 transition-colors text-left"
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      {(p.currentStock ?? 0) < 20 && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="size-3" /> {p.currentStock ?? 0} left
                        </span>
                      )}
                      <span className="font-semibold text-primary">{money(p.defaultSalePrice ?? 0)}</span>
                      <Plus className="size-3.5 text-muted-foreground" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Line Items */}
          {lines.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit price</th>
                    <th className="px-3 py-2 text-right">GST %</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence>
                    {lines.map((l) => (
                      <motion.tr
                        key={l.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className="bg-card"
                      >
                        <td className="px-3 py-2 font-medium">{l.productName}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) => updateQty(l.id, Number(e.target.value))}
                            className="w-16 h-7 text-right text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={l.unitPrice}
                            onChange={(e) => updatePrice(l.id, Number(e.target.value))}
                            className="w-24 h-7 text-right text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {l.taxRate}%
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {money(l.lineTotal)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeLine(l.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {/* Totals */}
              <div className="bg-muted/40 border-t border-border px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST</span><span>{money(taxTotal)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Discount</span>
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-28 h-6 text-xs text-right ml-auto"
                  />
                </div>
                <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                  <span>Grand Total</span><span className="text-primary">{money(grandTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={handleSave} className="bg-primary">
            <CheckCircle2 className="size-4" /> {saving ? "Saving..." : "Finalize & Bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export function ManualBilling() {
  const [bills, setBills] = useState<any[]>([]);
  const [products, setProducts] = useState<InventoryItemRow[]>([]);
  const [pets, setPets] = useState<PetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const loadBills = useCallback(async () => {
    try {
      const rows = await listInvoicesFn({ data: {} });
      // "Manual" bills are ones created here — recognizable by the doctorName tag this
      // component always sets, distinguishing them from clinical-visit invoices.
      setBills(rows.filter((r: any) => r.doctorName === "Manual Billing"));
    } catch (err) {
      console.error("[ManualBilling] Failed to load bills:", err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItemsFn({ data: { status: "Active" } }).catch(() => []),
      listPetsWithOwnersFn().catch(() => []),
      loadBills(),
    ])
      .then(([items, petRows]) => {
        setProducts(items as InventoryItemRow[]);
        setPets(
          (petRows as any[]).map((p) => ({
            id: p.petId,
            name: p.name,
            owner: p.owner?.name || "—",
            ownerId: p.owner?.ownerId || p.ownerId,
            ownerPhone: p.owner?.phone,
            species: p.species,
            breed: p.breed,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [loadBills]);

  const visible = bills.filter((b) =>
    [b.invoiceNo, b.petName, b.ownerName].some((v) => (v || "").toLowerCase().includes(query.toLowerCase()))
  );

  const voidBill = async (invoiceNo: string) => {
    if (!window.confirm(`Void bill ${invoiceNo}? This permanently removes it.`)) return;
    try {
      await deleteInvoiceFn({ data: { invoiceNo } });
      toast.success("Bill voided");
      await loadBills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void bill");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Manual Product Billing</h2>
          <p className="text-sm text-muted-foreground">
            Bill a product or ad-hoc service without a prior encounter
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="shadow-xs active:scale-95 transition-all">
          <Plus className="size-4" /> New Manual Bill
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Bills today", value: String(bills.filter(b => (b.date || "").slice(0, 10) === todayIST()).length) },
          { label: "Finalized", value: String(bills.filter(b => b.status === "Paid" || b.status === "Billed").length) },
          { label: "Total bills", value: String(bills.length) },
          { label: "Total collected", value: `₹${bills.reduce((s, b) => s + (b.amountPaid || 0), 0).toLocaleString("en-IN")}` },
        ].map((k) => (
          <div key={k.label} className="erp-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold mt-0.5 text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="erp-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bills…"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">{visible.length} bills</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                {["Bill Ref", "Pet", "Owner", "Lines", "Grand Total", "Date", "Status", ""].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-bold uppercase tracking-wide ${h === "Grand Total" ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-xs text-muted-foreground">Loading bills…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-xs text-muted-foreground">No manual bills yet. Click "New Manual Bill" to create one.</td></tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {visible.map((b) => (
                    <motion.tr
                      key={b.invoiceNo || b._id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="hover:bg-primary-soft/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{b.invoiceNo}</td>
                      <td className="px-4 py-3">{b.petName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.ownerName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(b.items || []).length} item{(b.items || []).length !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(b.totalAmount || 0)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.date}</td>
                      <td className="px-4 py-3"><StatusPill value={b.status || "Paid"} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => voidBill(b.invoiceNo)}
                          className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium transition-colors"
                        >
                          Void
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewBillDialog open={open} onClose={() => setOpen(false)} onSaved={loadBills} products={products} pets={pets} />
    </motion.div>
  );
}
