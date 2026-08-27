import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ShoppingBag, List, LayoutGrid,
  RefreshCw, MoreHorizontal, X, Beef, Tag,
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

const FOOD_ACC_CATEGORIES: MedicineCategory[] = ["Animal Food", "Animal Accessories"];

// Status badge
function ItemStatusBadge({ status }: { status: Medicine["status"] }) {
  return status === "Active"
    ? <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-success-soft text-success">Enabled</span>
    : <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-warning-soft text-warning">Inactive</span>;
}

// Stock badge
function StockBadge({ status }: { status: "OK" | "Low" | "Out of Stock" }) {
  const cfg = {
    OK: { cls: "bg-success-soft text-success", label: "In Stock" },
    Low: { cls: "bg-warning-soft text-warning", label: "Low Stock" },
    "Out of Stock": { cls: "bg-danger-soft text-destructive", label: "Out of Stock" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

// Category icon
function CategoryIcon({ category }: { category: MedicineCategory }) {
  if (category === "Animal Food") return <Beef className="size-3.5 text-amber-500" />;
  return <Tag className="size-3.5 text-violet-500" />;
}

interface FilterState {
  assignedTo: string;
  createdBy: string;
  tags: string;
  itemGroup: string;
}

function FilterSidebar({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const set = (k: keyof FilterState, v: string) => onChange({ ...filters, [k]: v });
  const [showTags, setShowTags] = useState(false);
  return (
    <aside className="w-44 shrink-0 space-y-5 text-xs">
      <div>
        <p className="mb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Filter By</p>
        <div className="space-y-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Assigned To</Label>
            <select className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs" value={filters.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}>
              <option value="">All</option>
              <option value="me">Me</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Created By</Label>
            <select className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs" value={filters.createdBy} onChange={(e) => set("createdBy", e.target.value)}>
              <option value="">All</option>
              <option value="admin">Admin</option>
              <option value="retail">Retail Staff</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Edit Filters</p>
        <div className="space-y-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Item Group</Label>
            <select className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs" value={filters.itemGroup} onChange={(e) => set("itemGroup", e.target.value)}>
              <option value="">All Groups</option>
              {FOOD_ACC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Tags</Label>
            <input type="text" className="mt-1 flex h-8 w-full rounded border border-border bg-background px-2 text-xs" placeholder="Filter by tag..." value={filters.tags} onChange={(e) => set("tags", e.target.value)} />
          </div>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-border pt-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} className="size-3.5 rounded accent-primary" />
          <span className="text-[11px] text-muted-foreground">Show Tags</span>
        </label>
      </div>
      <div className="border-t border-border pt-3">
        <p className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Save Filter</p>
        <input type="text" className="flex h-8 w-full rounded border border-border bg-background px-2 text-xs" placeholder="Filter name..." />
        <button className="mt-1.5 w-full rounded bg-muted py-1 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors" onClick={() => toast.success("Filter saved")}>Save</button>
      </div>
      <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors" onClick={() => onChange({ assignedTo: "", createdBy: "", tags: "", itemGroup: "" })}>
        <X className="size-3" /> Clear all filters
      </button>
    </aside>
  );
}

export function FoodAccessoriesCatalogue() {
  const { medicines, getTotalQty, getStockStatus, batches, refetchItems, loadingItems } = useInventory();

  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({ assignedTo: "", createdBy: "", tags: "", itemGroup: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Medicine | undefined>(undefined);
  const [detailItem, setDetailItem] = useState<Medicine | undefined>(undefined);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const foodAccItems = useMemo(
    () => medicines.filter((m) => m.category === "Animal Food" || m.category === "Animal Accessories"),
    [medicines]
  );

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return foodAccItems.filter((m) => {
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
      const matchStatus = m.status === "Active";
      const matchGroup = !filters.itemGroup || m.category === filters.itemGroup;
      return matchQ && matchStatus && matchGroup;
    });
  }, [foodAccItems, query, filters]);

  const kpis = useMemo(() => {
    const active = foodAccItems.filter((m) => m.status === "Active");
    const food = active.filter((m) => m.category === "Animal Food");
    const acc = active.filter((m) => m.category === "Animal Accessories");
    const lowStock = active.filter((m) => getStockStatus(m.id) !== "OK").length;
    const allBatches = active.flatMap((m) => batches.filter((b) => b.itemCode === m.id));
    const totalValue = allBatches.reduce((s, b) => s + b.qty * b.purchasePrice, 0);
    return [
      { label: "Animal Food SKUs", value: String(food.length), trend: "active items", trendTone: "up" as const },
      { label: "Animal Accessories", value: String(acc.length), trend: "active items", trendTone: "up" as const },
      { label: "Low / Out of Stock", value: String(lowStock), trend: "need reorder", trendTone: lowStock > 0 ? "down" as const : "flat" as const },
      { label: "Total Stock Value", value: `Rs.${(totalValue / 1000).toFixed(1)}K`, trend: "at cost price", trendTone: "up" as const },
    ];
  }, [foodAccItems, batches, getStockStatus]);

  const detailIndex = detailItem ? visible.findIndex((m) => m.id === detailItem.id) : -1;
  const detailBatches = detailItem ? batches.filter((b) => b.medicineId === detailItem.id || b.itemCode === detailItem.id) : [];
  const detailStock = detailItem ? getTotalQty(detailItem.id) : 0;

  if (detailItem) {
    return (
      <ItemDetailView
        medicine={detailItem}
        batches={detailBatches}
        stockQty={detailStock}
        onBack={() => setDetailItem(undefined)}
        onPrev={detailIndex > 0 ? () => { const m = visible[detailIndex - 1]; if (m) setDetailItem(m); } : undefined}
        onNext={detailIndex < visible.length - 1 ? () => { const m = visible[detailIndex + 1]; if (m) setDetailItem(m); } : undefined}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.label} kpi={k} index={i} />)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <ShoppingBag className="size-4" />
          </span>
          <div>
            <p className="font-bold text-sm text-foreground">Food & Accessories Catalogue</p>
            <p className="text-xs text-muted-foreground">{visible.length} active items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetchItems()} disabled={loadingItems} className="gap-1.5 text-xs h-8">
            <RefreshCw className={`size-3.5 ${loadingItems ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setEditingItem(undefined); setShowAddDialog(true); }} className="gap-1.5 text-xs h-8">
            <Plus className="size-3.5" /> Add Item
          </Button>
        </div>
      </div>

      <div className="flex gap-5">
        {showFilters && <FilterSidebar filters={filters} onChange={setFilters} />}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input id="food-acc-search" placeholder="Search items, brands, sub-groups..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 min-w-[200px] h-8 text-xs" />
            <Select value={filters.itemGroup} onValueChange={(v) => setFilters((f) => ({ ...f, itemGroup: v }))}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {FOOD_ACC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)} className="gap-1.5 text-xs h-8">
              {showFilters ? "Hide Filters" : "Filters"}
            </Button>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button onClick={() => setView("list")} className={`p-1.5 ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}><List className="size-3.5" /></button>
              <button onClick={() => setView("grid")} className={`p-1.5 ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}><LayoutGrid className="size-3.5" /></button>
            </div>
          </div>

          {view === "list" && (
            <div className="erp-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left text-[11px] font-bold uppercase tracking-wide">
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Brand</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Sale Price</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((m) => {
                      const qty = getTotalQty(m.id);
                      const stockStatus = getStockStatus(m.id);
                      return (
                        <tr key={m.id} className="hover:bg-primary-soft/20 transition-colors cursor-pointer" onClick={() => setDetailItem(m)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CategoryIcon category={m.category} />
                              <div>
                                <p className="font-semibold text-foreground">{m.name}</p>
                                <p className="text-xs text-muted-foreground">{m.genericName || m.subGroup || m.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${m.category === "Animal Food" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"}`}>
                              {m.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{m.brand || "—"}</td>
                          <td className="px-4 py-3 text-xs">{m.unit}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">Rs.{m.defaultSalePrice.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-bold tabular-nums">{qty}</span>
                              <StockBadge status={stockStatus} />
                            </div>
                          </td>
                          <td className="px-4 py-3"><ItemStatusBadge status={m.status} /></td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="relative">
                              <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" onClick={() => setActionMenu(actionMenu === m.id ? null : m.id)}>
                                <MoreHorizontal className="size-4" />
                              </button>
                              <AnimatePresence>
                                {actionMenu === m.id && (
                                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.12 }} className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-border bg-card shadow-lg py-1">
                                    <button className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors" onClick={() => { setDetailItem(m); setActionMenu(null); }}>View Details</button>
                                    <button className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors" onClick={() => { setEditingItem(m); setShowAddDialog(true); setActionMenu(null); }}>Edit Item</button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {visible.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No items found. Add Animal Food or Animal Accessories items to get started.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "grid" && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((m) => {
                const qty = getTotalQty(m.id);
                const stockStatus = getStockStatus(m.id);
                return (
                  <motion.div key={m.id} whileHover={{ y: -2 }} className="erp-card p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setDetailItem(m)}>
                    <div className="flex items-start justify-between">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted"><CategoryIcon category={m.category} /></div>
                      <ItemStatusBadge status={m.status} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground leading-tight">{m.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.brand || m.subGroup || "—"}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Sale Price</p>
                        <p className="font-bold font-mono text-primary">Rs.{m.defaultSalePrice.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Stock</p>
                        <p className="font-bold tabular-nums">{qty} {m.unit}</p>
                        <StockBadge status={stockStatus} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {visible.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">No items found.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <ItemMasterDialog
        open={showAddDialog}
        onClose={() => { setShowAddDialog(false); setEditingItem(undefined); }}
        editing={editingItem}
        defaultCategory="Animal Food"
      />
    </motion.div>
  );
}
