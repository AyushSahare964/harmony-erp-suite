import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Package, List, LayoutGrid,
  RefreshCw, MoreHorizontal, X, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/erp/KpiCard";
import { toast } from "sonner";
import {
  useInventory,
  type Medicine,
  type MedicineCategory,
} from "./useInventoryStore";
import { ItemDetailView } from "./item-detail/ItemDetailView";
import { ItemMasterDialog } from "./ItemMasterDialog";

const CATEGORIES: MedicineCategory[] = ["Medicine", "Food", "Accessory", "Consumable"];

// ─── Status badge (matching ERPNext Enabled/Inactive) ─────────────────────────
function ItemStatusBadge({ status }: { status: Medicine["status"] }) {
  return status === "Active"
    ? <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-success-soft text-success">Enabled</span>
    : <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning">Inactive</span>;
}

// ─── Left Filter Sidebar ───────────────────────────────────────────────────────
interface FilterState {
  assignedTo: string;
  createdBy: string;
  tags: string;
  itemGroup: string;
}

function FilterSidebar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const set = (k: keyof FilterState, v: string) => onChange({ ...filters, [k]: v });
  const [showTags, setShowTags] = useState(false);

  return (
    <aside className="w-44 shrink-0 space-y-5 text-xs">
      {/* Filter By */}
      <div>
        <p className="mb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Filter By</p>
        <div className="space-y-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Assigned To</Label>
            <select
              className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs"
              value={filters.assignedTo}
              onChange={(e) => set("assignedTo", e.target.value)}
            >
              <option value="">All</option>
              <option value="me">Me</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Created By</Label>
            <select
              className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs"
              value={filters.createdBy}
              onChange={(e) => set("createdBy", e.target.value)}
            >
              <option value="">All</option>
              <option value="admin">Admin</option>
              <option value="pharmacy">Pharmacy Staff</option>
            </select>
          </div>
        </div>
      </div>

      {/* Edit Filters */}
      <div>
        <p className="mb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Edit Filters</p>
        <div className="space-y-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Item Group</Label>
            <select
              className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs"
              value={filters.itemGroup}
              onChange={(e) => set("itemGroup", e.target.value)}
            >
              <option value="">All Groups</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Tags</Label>
            <input
              type="text"
              className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs"
              placeholder="Filter by tag…"
              value={filters.tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Show Tags toggle */}
      <div className="space-y-1.5 border-t border-border pt-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTags}
            onChange={(e) => setShowTags(e.target.checked)}
            className="size-3.5 rounded accent-primary"
          />
          <span className="text-[11px] text-muted-foreground">Show Tags</span>
        </label>
      </div>

      {/* Save Filter */}
      <div className="border-t border-border pt-3">
        <p className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Save Filter</p>
        <input
          type="text"
          className="flex h-8 w-full rounded border border-border bg-background px-2 text-xs"
          placeholder="Filter name…"
        />
        <button
          className="mt-1.5 w-full rounded bg-muted py-1 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors"
          onClick={() => toast.success("Filter saved")}
        >
          Save
        </button>
      </div>

      {/* Reset */}
      <button
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
        onClick={() => onChange({ assignedTo: "", createdBy: "", tags: "", itemGroup: "" })}
      >
        <X className="size-3" /> Clear all filters
      </button>
    </aside>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function MedicineCatalogue() {
  const { medicines, getTotalQty, getStockStatus, batches, refetchItems, loadingItems } = useInventory();
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filters, setFilters] = useState<FilterState>({ assignedTo: "", createdBy: "", tags: "", itemGroup: "" });
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<Medicine | null>(null);
  const [hasVariants, setHasVariants] = useState(false);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return medicines.filter((m) => {
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q) || m.category.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || (filterStatus === "Active" ? m.status === "Active" : m.status === "Inactive");
      const matchGroup = !filters.itemGroup || m.category === filters.itemGroup;
      return matchQ && matchStatus && matchGroup;
    });
  }, [medicines, query, filterStatus, filters]);

  const kpis = useMemo(() => {
    const active = medicines.filter((m) => m.status === "Active").length;
    const inactive = medicines.filter((m) => m.status === "Inactive").length;
    const lowStock = medicines.filter((m) => m.status === "Active" && getStockStatus(m.id) === "Low").length;
    const oos = medicines.filter((m) => m.status === "Active" && getStockStatus(m.id) === "Out of Stock").length;
    return [
      { label: "Active Items", value: String(active), trend: `${inactive} inactive`, trendTone: "flat" as const },
      { label: "Low-stock Items", value: String(lowStock), trend: "below reorder level", trendTone: lowStock > 0 ? "down" as const : "flat" as const },
      { label: "Out of Stock", value: String(oos), trend: "need urgent reorder", trendTone: oos > 0 ? "down" as const : "flat" as const },
      { label: "Total Catalogue", value: String(medicines.length), trend: "all products", trendTone: "up" as const },
    ];
  }, [medicines, getStockStatus]);

  const detailIndex = detailItem ? visible.findIndex((m) => m.id === detailItem.id) : -1;
  const detailBatches = detailItem ? batches.filter((b) => b.medicineId === detailItem.id) : [];
  const detailStock = detailItem ? getTotalQty(detailItem.id) : 0;

  if (detailItem) {
    return (
      <ItemDetailView
        medicine={detailItem}
        batches={detailBatches}
        stockQty={detailStock}
        onBack={() => setDetailItem(null)}
        onPrev={detailIndex > 0 ? () => { const m = visible[detailIndex - 1]; if (m) setDetailItem(m); } : undefined}
        onNext={detailIndex < visible.length - 1 ? () => { const m = visible[detailIndex + 1]; if (m) setDetailItem(m); } : undefined}
      />
    );
  }

  const toggleSelect = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((m) => m.id)));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.label} kpi={k} index={i} />)}
      </div>

      {/* Main panel */}
      <div className="flex gap-5">
        <FilterSidebar filters={filters} onChange={setFilters} />

        <div className="min-w-0 flex-1 erp-card overflow-hidden">
          <div className="border-b border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1 text-sm font-semibold text-navy">
                <Package className="size-4 text-primary mr-1" />
                Item Catalogue
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted/30"}`}
                  >
                    <List className="size-3.5" /> List View
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-l border-border transition-colors ${viewMode === "grid" ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted/30"}`}
                  >
                    <LayoutGrid className="size-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    refetchItems().then(() => toast.success("Catalogue refreshed from MongoDB"));
                  }}
                  title="Reload from MongoDB"
                  className="rounded-lg border border-border p-1.5 hover:bg-muted/30 transition-colors"
                >
                  <RefreshCw className={`size-3.5 text-muted-foreground ${loadingItems ? "animate-spin text-primary" : ""}`} />
                </button>
                <button onClick={() => toast.info("Exporting catalogue data...")} className="rounded-lg border border-border p-1.5 hover:bg-muted/30 transition-colors">
                  <MoreHorizontal className="size-3.5 text-muted-foreground" />
                </button>
                <Button size="sm" onClick={() => setAddOpen(true)} className="shadow-xs active:scale-95">
                  <Plus className="size-3.5 mr-1" /> Add Item
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="catalogue-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, generic, code…"
                className="h-7 w-48 text-xs"
              />
              <Input placeholder="Item Group" className="h-7 w-28 text-xs" readOnly value={filters.itemGroup} onChange={(e) => setFilters((f) => ({ ...f, itemGroup: e.target.value }))} />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(e) => setHasVariants(e.target.checked)}
                  className="size-3.5 rounded accent-primary"
                />
                Has Variants
              </label>
              <div className="ml-auto flex items-center gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-7 w-28 text-xs gap-1">
                    <Filter className="size-3" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Enabled</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {visible.length} of {medicines.length}
                </span>
              </div>
            </div>
          </div>

          {viewMode === "list" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    <th className="px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={visible.length > 0 && selected.size === visible.length}
                        onChange={toggleAll}
                        className="size-4 rounded accent-primary"
                      />
                    </th>
                    {["Item Name", "Status", "Item Group", "Item Code", "Brand / Mfr", "Sale Price", "Last Updated"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <AnimatePresence mode="popLayout">
                    {visible.map((med) => (
                      <motion.tr
                        key={med.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="group cursor-pointer transition-colors hover:bg-primary-soft/20"
                        onClick={() => setDetailItem(med)}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(med.id)}
                            onChange={() => toggleSelect(med.id)}
                            className="size-4 rounded accent-primary"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-primary group-hover:underline">{med.name}</span>
                          {med.genericName && <p className="text-[11px] text-muted-foreground">{med.genericName}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <ItemStatusBadge status={med.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                            <Package className="size-3" /> {med.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">
                          {med.itemCode || med.id}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {med.brand || med.manufacturer || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                          ₹{med.defaultSalePrice}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {med.createdAt}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                        <Package className="mx-auto mb-3 size-8 opacity-30" />
                        No items match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === "grid" && (
            <div className="p-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {visible.map((med) => {
                  const qty = getTotalQty(med.id);
                  const status = getStockStatus(med.id);
                  return (
                    <motion.div
                      key={med.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="cursor-pointer rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                      onClick={() => setDetailItem(med)}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className={`flex size-10 items-center justify-center rounded-xl text-sm font-bold text-white ${
                          med.category === "Medicine" ? "bg-primary" : med.category === "Food" ? "bg-success" : med.category === "Accessory" ? "bg-warning" : "bg-destructive"
                        }`}>
                          {med.name[0]}
                        </div>
                        <ItemStatusBadge status={med.status} />
                      </div>
                      <p className="font-semibold text-sm text-foreground leading-snug">{med.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{med.genericName || med.category}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`text-sm font-bold ${status === "OK" ? "text-success" : status === "Low" ? "text-warning" : "text-destructive"}`}>
                          {qty}
                        </span>
                        <span className="text-xs text-muted-foreground">₹{med.defaultSalePrice}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {visible.length === 0 && (
                <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-3 size-8 opacity-30" />
                  No items match your filters.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ItemMasterDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </motion.div>
  );
}
