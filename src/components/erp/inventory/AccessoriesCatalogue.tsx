/**
 * AccessoriesCatalogue — Dedicated Pet Gear, Accessories & Supplies Catalogue
 * Backed by authoritative unified Inventory Product Master & Ledger
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Tag,
  Package,
  List,
  LayoutGrid,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit,
  Sparkles,
  Info,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/erp/KpiCard";
import { toast } from "sonner";
import { useInventory, type Medicine } from "./useInventoryStore";
import { ProductMasterWizardDialog } from "./ProductMasterWizardDialog";
import { ItemDetailView } from "./item-detail/ItemDetailView";

export function AccessoriesCatalogue() {
  const {
    accessoriesList,
    getTotalQty,
    getStockStatus,
    batches,
    refetchItems,
    loadingItems,
    toggleStatus,
    deleteItem,
    setStock,
  } = useInventory();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Medicine | undefined>(undefined);
  const [detailItem, setDetailItem] = useState<Medicine | null>(null);

  // Manual stock quantity override (inline in the table row)
  const [editingStockCode, setEditingStockCode] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState("");

  const handleSaveStock = async (itemCode: string) => {
    const value = Math.max(0, Number(stockDraft) || 0);
    try {
      await setStock(itemCode, value);
      toast.success(`Stock updated to ${value}`);
    } catch (e) {
      toast.error("Could not update stock. Please try again.");
    } finally {
      setEditingStockCode(null);
    }
  };

  const handleDeleteAccessory = async (item: Medicine) => {
    if (!window.confirm(`Delete "${item.name}" (${item.itemCode}) from the catalogue? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteItem(item.itemCode);
      toast.success(`${item.name} deleted from catalogue`);
    } catch (e) {
      toast.error("Could not delete this item. Please try again.");
    }
  };

  // Filtered Accessory items
  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return accessoriesList.filter((item) => {
      const matchQ =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.accessoryDetails?.material?.toLowerCase().includes(q) ||
        item.accessoryDetails?.accessoryType?.toLowerCase().includes(q);

      const accType =
        item.accessoryDetails?.accessoryType?.toLowerCase() ||
        item.subGroup?.toLowerCase() ||
        "";
      const matchCat =
        categoryFilter === "all" ||
        (categoryFilter === "collar" && (accType.includes("collar") || accType.includes("leash") || accType.includes("harness"))) ||
        (categoryFilter === "bed" && (accType.includes("bed") || accType.includes("comfort") || accType.includes("cushion"))) ||
        (categoryFilter === "bowl" && (accType.includes("bowl") || accType.includes("feed") || accType.includes("water"))) ||
        (categoryFilter === "grooming" && (accType.includes("groom") || accType.includes("hygiene") || accType.includes("brush") || accType.includes("shampoo"))) ||
        (categoryFilter === "toy" && accType.includes("toy"));

      const size = item.accessoryDetails?.petSize?.toLowerCase() || "";
      const matchSize =
        sizeFilter === "all" ||
        (sizeFilter === "small" && (size.includes("small") || size.includes("s"))) ||
        (sizeFilter === "medium" && (size.includes("medium") || size.includes("m"))) ||
        (sizeFilter === "large" && (size.includes("large") || size.includes("l") || size.includes("xl")));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "Active" ? item.status === "Active" : item.status === "Inactive");

      return matchQ && matchCat && matchSize && matchStatus;
    });
  }, [accessoriesList, query, categoryFilter, sizeFilter, statusFilter]);

  // Accessories KPIs
  const kpis = useMemo(() => {
    const active = accessoriesList.filter((m) => m.status === "Active").length;
    const lowStock = accessoriesList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Low").length;
    const oos = accessoriesList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Out of Stock").length;
    const totalUnits = accessoriesList.reduce((acc, m) => acc + getTotalQty(m.itemCode), 0);

    return [
      {
        label: "Active Accessories",
        value: String(active),
        trend: `${accessoriesList.length} items registered`,
        trendTone: "flat" as const,
      },
      {
        label: "Total Units in Stock",
        value: String(totalUnits),
        trend: "across collars, beds, bowls & gear",
        trendTone: totalUnits > 0 ? ("up" as const) : ("flat" as const),
      },
      {
        label: "Low Stock Items",
        value: String(lowStock),
        trend: "need replenishment",
        trendTone: lowStock > 0 ? ("down" as const) : ("flat" as const),
      },
      {
        label: "Out of Stock",
        value: String(oos),
        trend: "0 stock on floor",
        trendTone: oos > 0 ? ("down" as const) : ("flat" as const),
      },
    ];
  }, [accessoriesList, getStockStatus, getTotalQty]);

  if (detailItem) {
    const detailBatches = batches.filter((b) => b.medicineId === detailItem.itemCode || b.itemCode === detailItem.itemCode);
    const detailStock = getTotalQty(detailItem.itemCode);
    return (
      <ItemDetailView
        medicine={detailItem}
        batches={detailBatches}
        stockQty={detailStock}
        onBack={() => setDetailItem(null)}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} kpi={k} index={i} />
        ))}
      </div>

      {/* Main Container */}
      <div className="erp-card overflow-hidden border border-border shadow-xs">
        {/* Header Toolbar */}
        <div className="border-b border-border bg-card px-4 py-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Tag className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Pet Accessories & Gear Catalogue</h3>
                <p className="text-xs text-muted-foreground">
                  35 Classified items: Collars, leashes, memory foam beds, feeding bowls & grooming supplies
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "list" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <List className="size-3.5" /> List
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-l border-border transition-colors ${
                    viewMode === "grid" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <LayoutGrid className="size-3.5" /> Grid
                </button>
              </div>

              <button
                onClick={() => {
                  refetchItems().then(() => toast.success("Accessories catalogue synced"));
                }}
                title="Reload from database"
                className="rounded-lg border border-border p-2 hover:bg-muted/40 transition-colors"
              >
                <RefreshCw className={`size-3.5 text-muted-foreground ${loadingItems ? "animate-spin text-primary" : ""}`} />
              </button>

              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(undefined);
                  setAddOpen(true);
                }}
                className="bg-primary text-primary-foreground font-semibold shadow-xs"
              >
                <Plus className="size-3.5 mr-1" /> Add Accessory
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search accessories by name, type, material..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="collar">Collars & Leashes</SelectItem>
                <SelectItem value="bed">Beds & Comfort</SelectItem>
                <SelectItem value="bowl">Bowls & Feeders</SelectItem>
                <SelectItem value="grooming">Grooming & Hygiene</SelectItem>
                <SelectItem value="toy">Toys & Chews</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                <SelectItem value="small">Small (S)</SelectItem>
                <SelectItem value="medium">Medium (M)</SelectItem>
                <SelectItem value="large">Large / XL</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground ml-auto">
              Showing {visible.length} of {accessoriesList.length} items
            </span>
          </div>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Accessory Item</th>
                  <th className="px-3 py-3">Code / SKU</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Size / Variant</th>
                  <th className="px-3 py-3">Material</th>
                  <th className="px-3 py-3">Stock Units</th>
                  <th className="px-3 py-3">Sale Price</th>
                  <th className="px-3 py-3">Pricing Audit</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <AnimatePresence mode="popLayout">
                  {visible.map((item) => {
                    const currentQty = getTotalQty(item.itemCode);
                    const stockStatus = getStockStatus(item.itemCode);
                    const isLow = stockStatus === "Low";
                    const isOOS = stockStatus === "Out of Stock";

                    return (
                      <motion.tr
                        key={item.itemCode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={() => setDetailItem(item)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{item.brand || "Standard Gear"}</span>
                            {item.accessoryDetails?.color && (
                              <>
                                <span>•</span>
                                <span>{item.accessoryDetails.color}</span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 font-mono font-medium text-foreground">
                          {item.itemCode}
                        </td>

                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {item.accessoryDetails?.accessoryType || item.subGroup || "Accessory"}
                          </Badge>
                        </td>

                        <td className="px-3 py-3 font-medium text-foreground">
                          {item.accessoryDetails?.petSize || "Universal"}
                        </td>

                        <td className="px-3 py-3 text-muted-foreground">
                          {item.accessoryDetails?.material || "Standard"}
                        </td>

                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          {editingStockCode === item.itemCode ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                autoFocus
                                value={stockDraft}
                                onChange={(e) => setStockDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleSaveStock(item.itemCode);
                                  if (e.key === "Escape") setEditingStockCode(null);
                                }}
                                className="h-7 w-20 text-xs font-mono"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => void handleSaveStock(item.itemCode)}
                                title="Save stock quantity"
                              >
                                <Check className="size-3.5 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingStockCode(null)}
                                title="Cancel"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="group/stock flex items-center gap-1.5">
                              <div>
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span
                                    className={`text-sm ${
                                      isOOS
                                        ? "text-destructive"
                                        : isLow
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {currentQty} {item.unit}s
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Min level: {item.reorderLevel}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStockCode(item.itemCode);
                                  setStockDraft(String(currentQty));
                                }}
                                className="opacity-0 group-hover/stock:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                title="Manually set stock quantity"
                              >
                                <Edit className="size-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-semibold text-foreground">₹{item.defaultSalePrice}</div>
                          {item.mrp && item.mrp > item.defaultSalePrice && (
                            <div className="text-[10px] text-muted-foreground line-through">
                              ₹{item.mrp}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <span
                            title="Sample baseline pricing tagged for clinic review"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                          >
                            <Sparkles className="size-3 text-blue-500" /> Clinic Audit
                          </span>
                        </td>

                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              void toggleStatus(item.itemCode).then(() =>
                                toast.success(`Item status toggled to ${item.status === "Active" ? "Inactive" : "Active"}`)
                              );
                            }}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                              item.status === "Active"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            }`}
                          >
                            {item.status}
                          </button>
                        </td>

                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingItem(item);
                                setAddOpen(true);
                              }}
                              title="Edit Accessory Master"
                            >
                              <Edit className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDetailItem(item)}
                              title="View Ledger & Batches"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteAccessory(item)}
                              title="Delete Accessory"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>

                {visible.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      <Tag className="size-8 mx-auto mb-2 opacity-30 text-blue-500" />
                      No accessories match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {visible.map((item) => {
                const currentQty = getTotalQty(item.itemCode);
                const stockStatus = getStockStatus(item.itemCode);

                return (
                  <motion.div
                    key={item.itemCode}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="p-4 rounded-xl border border-border bg-card hover:border-blue-500/40 hover:shadow-md transition-all cursor-pointer space-y-3"
                    onClick={() => setDetailItem(item)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <Tag className="size-5" />
                      </div>
                      <Badge variant={item.status === "Active" ? "default" : "secondary"} className="text-[10px]">
                        {item.status}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground leading-tight line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.accessoryDetails?.accessoryType || "Gear"} • {item.accessoryDetails?.petSize || "Universal"}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-muted/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-muted-foreground text-[10px] block">Live Stock</span>
                        <span
                          className={`font-bold ${
                            stockStatus === "Out of Stock"
                              ? "text-destructive"
                              : stockStatus === "Low"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {currentQty} {item.unit}s
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-[10px] block">Price</span>
                        <span className="font-bold text-foreground">₹{item.defaultSalePrice}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Product Master Wizard Dialog for Accessory */}
      <ProductMasterWizardDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditingItem(undefined);
        }}
        editing={editingItem}
        defaultProductType="ACCESSORY"
      />
    </motion.div>
  );
}
