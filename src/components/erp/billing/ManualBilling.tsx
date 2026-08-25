import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, CheckCircle2, FileText, Search,
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

/* ─── Catalogue ─────────────────────────────────────────────────── */
const PRODUCTS = [
  { id: "P001", name: "Amoxicillin 250mg", category: "Medicine",  unitPrice: 24,   taxRate: 12, stock: 42 },
  { id: "P002", name: "Royal Canin Maxi 4kg", category: "Food",   unitPrice: 1850, taxRate: 5,  stock: 26 },
  { id: "P003", name: "Tick collar (large)", category: "Retail",  unitPrice: 320,  taxRate: 18, stock: 14 },
  { id: "P004", name: "Rabies Vaccine",     category: "Medicine", unitPrice: 480,  taxRate: 5,  stock: 118 },
  { id: "P005", name: "Dental chews (pk10)",category: "Retail",   unitPrice: 220,  taxRate: 18, stock: 31 },
  { id: "P006", name: "Grooming shampoo",  category: "Retail",   unitPrice: 390,  taxRate: 18, stock: 8  },
  { id: "P007", name: "Deworming syrup",   category: "Medicine", unitPrice: 95,   taxRate: 12, stock: 31 },
  { id: "P008", name: "IV fluid RL 500ml", category: "Medicine", unitPrice: 65,   taxRate: 5,  stock: 12 },
];

const PETS = [
  { id: "PET-001", name: "Bruno", owner: "Tariq Hussain" },
  { id: "PET-002", name: "Luna",  owner: "Vikram Shetty" },
  { id: "PET-003", name: "Simba", owner: "Nalini Prasad" },
  { id: "PET-004", name: "Coco",  owner: "Deepika Iyer"  },
  { id: "PET-005", name: "Milo",  owner: "Ananya Sharma" },
];

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

interface ManualBill {
  id: string;
  ref: string;
  petId: string;
  petName: string;
  ownerName: string;
  status: "Draft" | "Finalized" | "Void";
  createdAt: string;
  grandTotal: number;
  lines: LineItem[];
}

function money(v: number) {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── New Bill Form ──────────────────────────────────────────────── */
function NewBillDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (bill: ManualBill, asDraft: boolean) => void;
}) {
  const [petId, setPetId] = useState("walkin");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [prodSearch, setProdSearch] = useState("");

  const pet = PETS.find((p) => p.id === petId);

  const filteredProds = useMemo(
    () =>
      PRODUCTS.filter((p) =>
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(prodSearch.toLowerCase())
      ),
    [prodSearch]
  );

  const addLine = (prod: (typeof PRODUCTS)[0]) => {
    const existing = lines.find((l) => l.productId === prod.id);
    if (existing) {
      setLines((prev) =>
        prev.map((l) =>
          l.productId === prod.id
            ? recalcLine({ ...l, qty: l.qty + 1 })
            : l
        )
      );
    } else {
      setLines((prev) => [
        ...prev,
        recalcLine({
          id: crypto.randomUUID(),
          productId: prod.id,
          productName: prod.name,
          qty: 1,
          unitPrice: prod.unitPrice,
          taxRate: prod.taxRate,
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
  const grandTotal = subtotal + taxTotal - discount;

  const build = (status: "Draft" | "Finalized"): ManualBill => ({
    id: crypto.randomUUID(),
    ref: `MB-${String(Math.floor(Math.random() * 9000 + 1000))}`,
    petId,
    petName: pet?.name ?? "Walk-in",
    ownerName: pet?.owner ?? "—",
    status,
    createdAt: new Date().toLocaleDateString("en-IN"),
    grandTotal,
    lines,
  });

  const handleSave = (asDraft: boolean) => {
    if (lines.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    onSave(build(asDraft ? "Draft" : "Finalized"), asDraft);
    setLines([]);
    setPetId("walkin");
    setDiscount(0);
    setNotes("");
    setProdSearch("");
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
                {PETS.map((p) => (
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
              {filteredProds.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addLine(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-primary-soft/40 transition-colors text-left"
                >
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    {p.stock < 20 && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="size-3" /> {p.stock} left
                      </span>
                    )}
                    <span className="font-semibold text-primary">{money(p.unitPrice)}</span>
                    <Plus className="size-3.5 text-muted-foreground" />
                  </span>
                </button>
              ))}
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
          <Button variant="outline" onClick={() => handleSave(true)} className="text-amber-600 border-amber-300 hover:bg-amber-50">
            <FileText className="size-4" /> Save as Draft
          </Button>
          <Button onClick={() => handleSave(false)} className="bg-primary">
            <CheckCircle2 className="size-4" /> Finalize & Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export function ManualBilling() {
  const [bills, setBills] = useState<ManualBill[]>([
    {
      id: "1", ref: "MB-1041", petId: "PET-001", petName: "Bruno", ownerName: "Tariq Hussain",
      status: "Finalized", createdAt: "15/08/2026", grandTotal: 2428.8,
      lines: [
        { id: "l1", productId: "P001", productName: "Amoxicillin 250mg", qty: 3, unitPrice: 24, taxRate: 12, lineTotal: 80.64 },
        { id: "l2", productId: "P003", productName: "Tick collar (large)", qty: 1, unitPrice: 320, taxRate: 18, lineTotal: 377.6 },
      ],
    },
    {
      id: "2", ref: "MB-1042", petId: "walkin", petName: "Walk-in", ownerName: "—",
      status: "Draft", createdAt: "16/08/2026", grandTotal: 2183,
      lines: [
        { id: "l3", productId: "P002", productName: "Royal Canin Maxi 4kg", qty: 1, unitPrice: 1850, taxRate: 5, lineTotal: 1942.5 },
        { id: "l4", productId: "P005", productName: "Dental chews (pk10)", qty: 1, unitPrice: 220, taxRate: 18, lineTotal: 259.6 },
      ],
    },
    {
      id: "3", ref: "MB-1043", petId: "PET-004", petName: "Coco", ownerName: "Deepika Iyer",
      status: "Finalized", createdAt: "16/08/2026", grandTotal: 504,
      lines: [
        { id: "l5", productId: "P006", productName: "Grooming shampoo", qty: 1, unitPrice: 390, taxRate: 18, lineTotal: 460.2 },
      ],
    },
  ]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visible = bills.filter((b) =>
    [b.ref, b.petName, b.ownerName].some((v) => v.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSave = (bill: ManualBill, asDraft: boolean) => {
    setBills((prev) => [bill, ...prev]);
    toast.success(
      asDraft
        ? `Draft ${bill.ref} saved — you can edit it before finalizing`
        : `Bill ${bill.ref} finalized — stock decremented`
    );
    setOpen(false);
  };

  const voidBill = (id: string) => {
    setBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "Void" } : b))
    );
    toast.success("Bill voided (credit note created)");
  };

  const finalizeBill = (id: string) => {
    setBills((prev) =>
      prev.map((b) =>
        b.id === id && b.status === "Draft" ? { ...b, status: "Finalized" } : b
      )
    );
    toast.success("Bill finalized — stock decremented");
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
          { label: "Bills today", value: String(bills.filter(b => b.createdAt === new Date().toLocaleDateString("en-IN")).length || bills.length) },
          { label: "Finalized", value: String(bills.filter(b => b.status === "Finalized").length) },
          { label: "Drafts", value: String(bills.filter(b => b.status === "Draft").length), warn: true },
          { label: "Total collected", value: `₹${bills.filter(b => b.status === "Finalized").reduce((s, b) => s + b.grandTotal, 0).toLocaleString("en-IN")}` },
        ].map((k) => (
          <div key={k.label} className="erp-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.warn ? "text-amber-600" : "text-foreground"}`}>{k.value}</p>
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
              <AnimatePresence mode="popLayout">
                {visible.map((b) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="hover:bg-primary-soft/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-primary">{b.ref}</td>
                    <td className="px-4 py-3">{b.petName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.ownerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.lines.length} item{b.lines.length !== 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(b.grandTotal)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.createdAt}</td>
                    <td className="px-4 py-3"><StatusPill value={b.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {b.status === "Draft" && (
                          <button
                            onClick={() => finalizeBill(b.id)}
                            className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors"
                          >
                            Finalize
                          </button>
                        )}
                        {b.status === "Finalized" && (
                          <button
                            onClick={() => voidBill(b.id)}
                            className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium transition-colors"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <NewBillDialog open={open} onClose={() => setOpen(false)} onSave={handleSave} />
    </motion.div>
  );
}
