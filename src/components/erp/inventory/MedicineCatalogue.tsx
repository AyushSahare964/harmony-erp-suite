/**
 * MedicineCatalogue — Dedicated Clinical & Pharmaceutical Medicines Catalogue
 * Backed by authoritative unified Inventory Product Master & Ledger
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pill,
  Package,
  List,
  LayoutGrid,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Edit,
  ShieldCheck,
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

export function MedicineCatalogue() {
  const {
    medicinesList,
    getTotalQty,
    getStockStatus,
    batches,
    refetchItems,
    loadingItems,
    toggleStatus,
  } = useInventory();

  const [query, setQuery] = useState("");
  const [dosageFilter, setDosageFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Medicine | undefined>(undefined);
  const [detailItem, setDetailItem] = useState<Medicine | null>(null);

  // Filtered medicines
  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return medicinesList.filter((med) => {
      const matchQ =
        !q ||
        med.name.toLowerCase().includes(q) ||
        med.genericName?.toLowerCase().includes(q) ||
        med.itemCode.toLowerCase().includes(q) ||
        med.medicineDetails?.composition?.toLowerCase().includes(q) ||
        med.subGroup?.toLowerCase().includes(q);

      const dosage = med.medicineDetails?.dosageForm?.toLowerCase() || med.unit?.toLowerCase() || "";
      const matchDosage =
        dosageFilter === "all" ||
        (dosageFilter === "tablet" && (dosage.includes("tablet") || dosage.includes("tab") || dosage.includes("capsule"))) ||
        (dosageFilter === "injection" && (dosage.includes("inject") || dosage.includes("vial"))) ||
        (dosageFilter === "liquid" && (dosage.includes("syrup") || dosage.includes("drop") || dosage.includes("bottle") || dosage.includes("ml")));

      const schedule = med.medicineDetails?.schedule?.toLowerCase() || "";
      const matchSchedule =
        scheduleFilter === "all" ||
        (scheduleFilter === "schedule_h" && schedule.includes("h")) ||
        (scheduleFilter === "otc" && schedule.includes("otc"));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "Active" ? med.status === "Active" : med.status === "Inactive");

      return matchQ && matchDosage && matchSchedule && matchStatus;
    });
  }, [medicinesList, query, dosageFilter, scheduleFilter, statusFilter]);

  // Clinical KPIs
  const kpis = useMemo(() => {
    const active = medicinesList.filter((m) => m.status === "Active").length;
    const lowStock = medicinesList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Low").length;
    const oos = medicinesList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Out of Stock").length;
    const totalUnits = medicinesList.reduce((acc, m) => acc + getTotalQty(m.itemCode), 0);

    return [
      {
        label: "Active Pharmaceuticals",
        value: String(active),
        trend: `${medicinesList.length} total drug formulations`,
        trendTone: "flat" as const,
      },
      {
        label: "Total Units in Dispensary",
        value: String(totalUnits),
        trend: "tablets, vials, syrups & drops",
        trendTone: "up" as const,
      },
      {
        label: "Low Stock Formulations",
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
  }, [medicinesList, getStockStatus, getTotalQty]);

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
      {/* Pharmaceutical KPIs */}
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
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Pill className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Medicine & Pharmaceutical Master</h3>
                <p className="text-xs text-muted-foreground">
                  Prescription drugs, vaccines, injectables, and antibiotics with batch & expiry tracking
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
                  refetchItems().then(() => toast.success("Medicine catalogue synced"));
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
                <Plus className="size-3.5 mr-1" /> Add Medicine
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search medicine by name, active salt, code..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={dosageFilter} onValueChange={setDosageFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Dosage Form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                <SelectItem value="tablet">Tablets & Caps</SelectItem>
                <SelectItem value="injection">Vials & Injections</SelectItem>
                <SelectItem value="liquid">Syrups & Liquids</SelectItem>
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
              Showing {visible.length} of {medicinesList.length} medicines
            </span>
          </div>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Medicine & Salt</th>
                  <th className="px-3 py-3">Item Code</th>
                  <th className="px-3 py-3">Strength / Form</th>
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
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {med.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{med.genericName || "—"}</span>
                            {med.subGroup && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
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
                            {med.medicineDetails?.strength || med.unit}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {med.medicineDetails?.dosageForm || med.unit}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {med.medicineDetails?.schedule || "Schedule H"}
                          </Badge>
                        </td>

                        <td className="px-3 py-3">
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
                              title="Edit Medicine Master"
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
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>

                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <Pill className="size-8 mx-auto mb-2 opacity-30 text-emerald-500" />
                      No medicines match the selected filters.
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
                    className="p-4 rounded-xl border border-border bg-card hover:border-emerald-500/40 hover:shadow-md transition-all cursor-pointer space-y-3"
                    onClick={() => setDetailItem(med)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <Pill className="size-5" />
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
                        {med.genericName || "Pharmaceutical"} • {med.unit}
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

      {/* Product Master Wizard Dialog for Medicine */}
      <ProductMasterWizardDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditingItem(undefined);
        }}
        editing={editingItem}
        defaultProductType="MEDICINE"
      />
    </motion.div>
  );
}
