/**
 * InjectionCatalogue — Dedicated Injectable & Vaccine Master Catalogue
 * Backed by authoritative unified Inventory Product Master & Ledger
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Syringe,
  Snowflake,
  List,
  LayoutGrid,
  RefreshCw,
  Search,
  Eye,
  Edit,
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

export function InjectionCatalogue() {
  const {
    injectionList,
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
  const [routeFilter, setRouteFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
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

  const handleDeleteInjection = async (med: Medicine) => {
    if (!window.confirm(`Delete "${med.name}" (${med.itemCode}) from the catalogue? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteItem(med.itemCode);
      toast.success(`${med.name} deleted from catalogue`);
    } catch (e) {
      toast.error("Could not delete this item. Please try again.");
    }
  };

  // Filtered injections
  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return injectionList.filter((med) => {
      const matchQ =
        !q ||
        med.name.toLowerCase().includes(q) ||
        med.genericName?.toLowerCase().includes(q) ||
        med.itemCode.toLowerCase().includes(q) ||
        med.injectionDetails?.composition?.toLowerCase().includes(q) ||
        med.subGroup?.toLowerCase().includes(q);

      const route = med.injectionDetails?.route?.toLowerCase() || "";
      const matchRoute = routeFilter === "all" || route === routeFilter.toLowerCase();

      const schedule = med.injectionDetails?.schedule?.toLowerCase() || "";
      const matchSchedule =
        scheduleFilter === "all" ||
        (scheduleFilter === "schedule_h" && schedule.includes("h")) ||
        (scheduleFilter === "otc" && schedule.includes("otc"));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "Active" ? med.status === "Active" : med.status === "Inactive");

      return matchQ && matchRoute && matchSchedule && matchStatus;
    });
  }, [injectionList, query, routeFilter, scheduleFilter, statusFilter]);

  // Clinical KPIs
  const kpis = useMemo(() => {
    const active = injectionList.filter((m) => m.status === "Active").length;
    const coldChain = injectionList.filter((m) => m.status === "Active" && m.injectionDetails?.coldChainRequired).length;
    const lowStock = injectionList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Low").length;
    const oos = injectionList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Out of Stock").length;

    return [
      {
        label: "Active Injectables",
        value: String(active),
        trend: `${injectionList.length} total formulations`,
        trendTone: "flat" as const,
      },
      {
        label: "Cold Chain Items",
        value: String(coldChain),
        trend: "require 2-8°C storage",
        trendTone: "flat" as const,
      },
      {
        label: "Low Stock Injectables",
        value: String(lowStock),
        trend: "below reorder threshold",
        trendTone: lowStock > 0 ? ("down" as const) : ("flat" as const),
      },
      {
        label: "Critical Out of Stock",
        value: String(oos),
        trend: "immediate clinic PO required",
        trendTone: oos > 0 ? ("down" as const) : ("flat" as const),
      },
    ];
  }, [injectionList, getStockStatus]);

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
      {/* Injectable KPIs */}
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
              <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Syringe className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Injection & Vaccine Master</h3>
                <p className="text-xs text-muted-foreground">
                  Injectables, vaccines, and biologics with route, cold chain & withdrawal tracking
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
                  refetchItems().then(() => toast.success("Injection catalogue synced"));
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
                <Plus className="size-3.5 mr-1" /> Add Injection
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search injection by name, composition, code..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={routeFilter} onValueChange={setRouteFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Route" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routes</SelectItem>
                <SelectItem value="IV">IV</SelectItem>
                <SelectItem value="IM">IM</SelectItem>
                <SelectItem value="SC">SC</SelectItem>
                <SelectItem value="Intradermal">Intradermal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Legal Schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schedules</SelectItem>
                <SelectItem value="schedule_h">Schedule H / Rx</SelectItem>
                <SelectItem value="otc">OTC / General</SelectItem>
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
              Showing {visible.length} of {injectionList.length} injections
            </span>
          </div>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Injection & Composition</th>
                  <th className="px-3 py-3">Item Code</th>
                  <th className="px-3 py-3">Route / Vial Size</th>
                  <th className="px-3 py-3">Legal Class</th>
                  <th className="px-3 py-3">Authoritative Stock</th>
                  <th className="px-3 py-3">Reorder Point</th>
                  <th className="px-3 py-3">Retail Price</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <AnimatePresence mode="popLayout">
                  {visible.map((med) => {
                    const currentQty = getTotalQty(med.itemCode);
                    const stockStatus = getStockStatus(med.itemCode);
                    const isLow = stockStatus === "Low";
                    const isOOS = stockStatus === "Out of Stock";

                    return (
                      <motion.tr
                        key={med.itemCode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={() => setDetailItem(med)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {med.name}
                            {med.injectionDetails?.coldChainRequired && (
                              <Snowflake className="size-3 text-sky-500" aria-label="Cold chain required" />
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{med.injectionDetails?.composition || med.genericName || "—"}</span>
                            {med.subGroup && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-rose-600 dark:text-rose-400">
                                  {med.subGroup}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 font-mono font-medium text-foreground">
                          {med.itemCode}
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium text-foreground">
                            {med.injectionDetails?.route || "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {med.injectionDetails?.vialSize || med.unit}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {med.injectionDetails?.schedule || "Schedule H"}
                          </Badge>
                        </td>

                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          {editingStockCode === med.itemCode ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                autoFocus
                                value={stockDraft}
                                onChange={(e) => setStockDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleSaveStock(med.itemCode);
                                  if (e.key === "Escape") setEditingStockCode(null);
                                }}
                                className="h-7 w-20 text-xs font-mono"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => void handleSaveStock(med.itemCode)}
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
                                    {currentQty} {med.unit}s
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {stockStatus === "OK" ? "Healthy Balance" : stockStatus}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStockCode(med.itemCode);
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

                        <td className="px-3 py-3 font-medium text-foreground">
                          {med.reorderLevel} {med.unit}s
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-semibold text-foreground">₹{med.defaultSalePrice}</div>
                          {med.mrp && med.mrp > med.defaultSalePrice && (
                            <div className="text-[10px] text-muted-foreground line-through">
                              ₹{med.mrp}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              void toggleStatus(med.itemCode).then(() =>
                                toast.success(`Item status toggled to ${med.status === "Active" ? "Inactive" : "Active"}`)
                              );
                            }}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                              med.status === "Active"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            }`}
                          >
                            {med.status}
                          </button>
                        </td>

                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingItem(med);
                                setAddOpen(true);
                              }}
                              title="Edit Injection Master"
                            >
                              <Edit className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDetailItem(med)}
                              title="View Batches & Expiries"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteInjection(med)}
                              title="Delete Injection"
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
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <Syringe className="size-8 mx-auto mb-2 opacity-30 text-rose-500" />
                      No injections match the selected filters.
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
              {visible.map((med) => {
                const currentQty = getTotalQty(med.itemCode);
                const stockStatus = getStockStatus(med.itemCode);

                return (
                  <motion.div
                    key={med.itemCode}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="p-4 rounded-xl border border-border bg-card hover:border-rose-500/40 hover:shadow-md transition-all cursor-pointer space-y-3"
                    onClick={() => setDetailItem(med)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <Syringe className="size-5" />
                      </div>
                      <Badge variant={med.status === "Active" ? "default" : "secondary"} className="text-[10px]">
                        {med.status}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground leading-tight line-clamp-1">
                        {med.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {med.injectionDetails?.route || "Injectable"} • {med.unit}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-muted/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-muted-foreground text-[10px] block">Dispensary Qty</span>
                        <span
                          className={`font-bold ${
                            stockStatus === "Out of Stock"
                              ? "text-destructive"
                              : stockStatus === "Low"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {currentQty} {med.unit}s
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-[10px] block">Price</span>
                        <span className="font-bold text-foreground">₹{med.defaultSalePrice}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Product Master Wizard Dialog for Injection */}
      <ProductMasterWizardDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditingItem(undefined);
        }}
        editing={editingItem}
        defaultProductType="INJECTION"
      />
    </motion.div>
  );
}
