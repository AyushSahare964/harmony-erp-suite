import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, PowerOff, Search, Package, Check, X,
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
import { KpiCard } from "@/components/erp/KpiCard";
import { toast } from "sonner";
import {
  useInventory,
  type Medicine,
  type MedicineCategory,
  type UnitOfMeasure,
} from "./useInventoryStore";

const CATEGORIES: MedicineCategory[] = ["Medicine", "Food", "Accessory", "Consumable"];
const UNITS: UnitOfMeasure[] = ["Tablet", "ml", "Vial", "Box", "Strip", "Kg", "Bottle"];

const EMPTY_FORM = {
  name: "",
  genericName: "",
  category: "" as MedicineCategory | "",
  unit: "" as UnitOfMeasure | "",
  gstRate: "",
  defaultSalePrice: "",
  reorderLevel: "",
};

type FormState = typeof EMPTY_FORM;

// ─── Add / Edit Dialog ────────────────────────────────────────────────────────
function MedicineDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Medicine;
}) {
  const { addMedicine, updateMedicine } = useInventory();
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          name: editing.name,
          genericName: editing.genericName,
          category: editing.category,
          unit: editing.unit,
          gstRate: String(editing.gstRate),
          defaultSalePrice: String(editing.defaultSalePrice),
          reorderLevel: String(editing.reorderLevel),
        }
      : EMPTY_FORM
  );

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim() || !form.category || !form.unit || !form.defaultSalePrice) {
      toast.error("Please fill all required fields");
      return;
    }
    const payload = {
      name: form.name.trim(),
      genericName: form.genericName.trim(),
      category: form.category as MedicineCategory,
      unit: form.unit as UnitOfMeasure,
      gstRate: Number(form.gstRate) || 12,
      defaultSalePrice: Number(form.defaultSalePrice) || 0,
      reorderLevel: Number(form.reorderLevel) || 10,
    };
    if (editing) {
      updateMedicine(editing.id, payload);
      toast.success("Medicine updated");
    } else {
      addMedicine(payload);
      toast.success("Medicine added to catalogue");
    }
    onClose();
    setForm(EMPTY_FORM);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update medicine master record" : "Add a new medicine to the catalogue"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 py-2">
          {/* Name */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="med-name" className="text-xs font-semibold">
              Medicine / Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="med-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Amoxicillin 250mg"
            />
          </div>
          {/* Generic name */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="med-generic" className="text-xs font-semibold">Generic Name</Label>
            <Input
              id="med-generic"
              value={form.genericName}
              onChange={(e) => set("genericName", e.target.value)}
              placeholder="e.g. Amoxicillin"
            />
          </div>
          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Unit */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Unit of Measure <span className="text-destructive">*</span>
            </Label>
            <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* GST */}
          <div className="space-y-1.5">
            <Label htmlFor="med-gst" className="text-xs font-semibold">GST Rate (%)</Label>
            <Input
              id="med-gst"
              type="number"
              min={0}
              max={28}
              value={form.gstRate}
              onChange={(e) => set("gstRate", e.target.value)}
              placeholder="12"
            />
          </div>
          {/* Sale price */}
          <div className="space-y-1.5">
            <Label htmlFor="med-price" className="text-xs font-semibold">
              Default Sale Price (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="med-price"
              type="number"
              min={0}
              value={form.defaultSalePrice}
              onChange={(e) => set("defaultSalePrice", e.target.value)}
              placeholder="0"
            />
          </div>
          {/* Reorder level */}
          <div className="space-y-1.5">
            <Label htmlFor="med-reorder" className="text-xs font-semibold">Reorder Level</Label>
            <Input
              id="med-reorder"
              type="number"
              min={0}
              value={form.reorderLevel}
              onChange={(e) => set("reorderLevel", e.target.value)}
              placeholder="10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>
            <Check className="size-4 mr-1" />
            {editing ? "Save Changes" : "Add Medicine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Deactivate Confirm Dialog ────────────────────────────────────────────────
function DeactivateDialog({
  medicine,
  onClose,
}: {
  medicine: Medicine;
  onClose: () => void;
}) {
  const { deactivateMedicine } = useInventory();
  const confirm = () => {
    deactivateMedicine(medicine.id);
    toast.success(`${medicine.name} deactivated`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Deactivate Medicine?</DialogTitle>
          <DialogDescription>
            <strong>{medicine.name}</strong> will be hidden from new sales and purchases. All
            stock history and billing records are retained.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={confirm}>
            <PowerOff className="size-4 mr-1" /> Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MedicineCatalogue() {
  const { medicines, getTotalQty, getStockStatus } = useInventory();
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("Active");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Medicine | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Medicine | null>(null);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return medicines.filter((m) => {
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      const matchCat = filterCat === "all" || m.category === filterCat;
      const matchStatus = filterStatus === "all" || m.status === filterStatus;
      return matchQ && matchCat && matchStatus;
    });
  }, [medicines, query, filterCat, filterStatus]);

  const kpis = useMemo(() => {
    const active = medicines.filter((m) => m.status === "Active").length;
    const inactive = medicines.filter((m) => m.status === "Inactive").length;
    const lowStock = medicines.filter((m) => m.status === "Active" && getStockStatus(m.id) === "Low").length;
    const oos = medicines.filter((m) => m.status === "Active" && getStockStatus(m.id) === "Out of Stock").length;
    return [
      { label: "Active medicines", value: String(active), trend: `${inactive} inactive`, trendTone: "flat" as const },
      { label: "Low-stock items", value: String(lowStock), trend: "below reorder level", trendTone: lowStock > 0 ? "down" as const : "flat" as const },
      { label: "Out of stock", value: String(oos), trend: "need urgent reorder", trendTone: oos > 0 ? "down" as const : "flat" as const },
      { label: "Total catalogue", value: String(medicines.length), trend: "all products", trendTone: "up" as const },
    ];
  }, [medicines, getStockStatus]);

  const statusColor = (s: "OK" | "Low" | "Out of Stock") =>
    s === "OK" ? "text-success" : s === "Low" ? "text-warning" : "text-destructive";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.label} kpi={k} index={i} />)}
      </div>

      {/* Table card */}
      <div className="erp-card overflow-hidden shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 bg-card">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="catalogue-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search medicines…"
                className="pl-9"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground font-medium">{visible.length} of {medicines.length} items</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="shadow-xs active:scale-95">
            <Plus className="size-4" /> Add Medicine
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                {["Medicine", "Category", "Unit", "Sale Price", "GST", "Stock", "Reorder Level", "Status", ""].map((h) => (
                  <th key={h} className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide ${h === "Sale Price" || h === "GST" || h === "Stock" || h === "Reorder Level" ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {visible.map((med) => {
                  const qty = getTotalQty(med.id);
                  const status = getStockStatus(med.id);
                  return (
                    <motion.tr
                      key={med.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="transition-colors hover:bg-primary-soft/30"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-foreground">{med.name}</p>
                          <p className="text-xs text-muted-foreground">{med.genericName || "—"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                          <Package className="size-3" /> {med.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{med.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{med.defaultSalePrice.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{med.gstRate}%</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${statusColor(status)}`}>
                        {qty}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{med.reorderLevel}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusPill value={med.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setEditTarget(med)}
                            className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary-soft transition-all"
                            aria-label={`Edit ${med.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          {med.status === "Active" && (
                            <button
                              onClick={() => setDeactivateTarget(med)}
                              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-danger-soft transition-all"
                              aria-label={`Deactivate ${med.name}`}
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No medicines match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && <MedicineDialog open onClose={() => setAddOpen(false)} />}
      {editTarget && (
        <MedicineDialog open onClose={() => setEditTarget(null)} editing={editTarget} />
      )}
      {deactivateTarget && (
        <DeactivateDialog medicine={deactivateTarget} onClose={() => setDeactivateTarget(null)} />
      )}
    </motion.div>
  );
}
