/**
 * AlertsPanel — Real-Time Computed Stock & Expiry Alerts
 * Live-computed against authoritative currentStock vs minStockLevel / reorderLevel
 * Filterable across Medicines, Animal Food, and Pet Accessories
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  ShoppingBag,
  Skull,
  Pill,
  Syringe,
  Bone,
  Tag,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/erp/KpiCard";
import { useInventory, type Medicine, type Batch, type ProductType } from "./useInventoryStore";

const CATEGORY_FILTERS: { type: ProductType; label: string; Icon: LucideIcon; activeClasses: string }[] = [
  { type: "MEDICINE", label: "Medicines", Icon: Pill, activeClasses: "bg-emerald-600 text-white border-emerald-600" },
  { type: "INJECTION", label: "Injections", Icon: Syringe, activeClasses: "bg-rose-600 text-white border-rose-600" },
  { type: "FOOD", label: "Animal Food", Icon: Bone, activeClasses: "bg-amber-600 text-white border-amber-600" },
  { type: "ACCESSORY", label: "Accessories", Icon: Tag, activeClasses: "bg-blue-600 text-white border-blue-600" },
];

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

// ─── Low Stock Card ───────────────────────────────────────────────────────────
function LowStockCard({ med, qty }: { med: Medicine; qty: number }) {
  const reorderPoint = med.minStockLevel || med.reorderLevel || 1;
  const pct = Math.round((qty / reorderPoint) * 100);
  const isOos = qty === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`erp-card p-4 border-l-4 ${isOos ? "border-rose-500 bg-rose-500/5" : "border-amber-500 bg-amber-500/5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              isOos ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {isOos ? <Skull className="size-4" /> : <AlertTriangle className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate text-foreground">{med.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="font-mono">{med.itemCode}</span>
              <span>•</span>
              <span>{med.productType || med.category}</span>
              <span>•</span>
              <span>{med.unit}</span>
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p
            className={`text-2xl font-bold tabular-nums ${
              isOos ? "text-rose-600" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {qty}
          </p>
          <p className="text-xs text-muted-foreground">threshold: {reorderPoint}</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${
            isOos ? "bg-rose-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Suggested order: {med.reorderQty} {med.unit}s</span>
        <span>{pct}% of min reorder level</span>
      </div>
    </motion.div>
  );
}

// ─── Expiry Card ─────────────────────────────────────────────────────────────
function ExpiryCard({ batch, med }: { batch: Batch; med: Medicine }) {
  const today = new Date();
  const expiry = new Date(batch.expiryDate);
  const diff = daysBetween(today, expiry);
  const isExpired = diff < 0;
  const isCritical = diff >= 0 && diff <= 7;

  const accent = isExpired
    ? "border-rose-500 bg-rose-500/10"
    : isCritical
    ? "border-rose-500 bg-rose-500/5"
    : "border-amber-500 bg-amber-500/5";

  const labelColor = isExpired || isCritical ? "text-rose-600" : "text-amber-600 dark:text-amber-400";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`erp-card p-4 border-l-4 ${accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              isExpired || isCritical
                ? "bg-rose-500/10 text-rose-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            <Clock className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate text-foreground">{med.name}</p>
            <p className="text-xs font-mono text-muted-foreground">Batch: {batch.batchNo}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold text-sm ${labelColor}`}>
            {isExpired
              ? `Expired ${Math.abs(diff)}d ago`
              : diff === 0
              ? "Expires TODAY"
              : `${diff} days left`}
          </p>
          <p className="text-xs text-muted-foreground">
            {batch.qty} {med.unit}s in lot
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Expiry: {batch.expiryDate}</span>
        <span>{med.productType || med.category}</span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AlertsPanel() {
  const { medicines, getBatches, getTotalQty, getStockStatus, getExpiryStatus } = useInventory();
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ProductType>("ALL");

  const activeMeds = useMemo(() => {
    return medicines
      .filter((m) => m.status === "Active")
      .filter((m) => {
        if (categoryFilter === "ALL") return true;
        return m.productType === categoryFilter;
      });
  }, [medicines, categoryFilter]);

  const lowStockItems = useMemo(
    () =>
      activeMeds
        .filter((m) => {
          const s = getStockStatus(m.itemCode);
          return s === "Low" || s === "Out of Stock";
        })
        .sort((a, b) => getTotalQty(a.itemCode) - getTotalQty(b.itemCode)),
    [activeMeds, getStockStatus, getTotalQty]
  );

  const expiringBatches = useMemo<{ batch: Batch; med: Medicine }[]>(() => {
    const items: { batch: Batch; med: Medicine }[] = [];
    for (const med of activeMeds) {
      for (const batch of getBatches(med.itemCode)) {
        const s = getExpiryStatus(batch.expiryDate);
        if (s === "expired" || s === "critical" || s === "expiring-soon") {
          items.push({ batch, med });
        }
      }
    }
    return items.sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate));
  }, [activeMeds, getBatches, getExpiryStatus]);

  const outOfStock = lowStockItems.filter((m) => getStockStatus(m.itemCode) === "Out of Stock").length;
  const low = lowStockItems.filter((m) => getStockStatus(m.itemCode) === "Low").length;
  const criticalExp = expiringBatches.filter(
    (x) =>
      getExpiryStatus(x.batch.expiryDate) === "critical" ||
      getExpiryStatus(x.batch.expiryDate) === "expired"
  ).length;

  const kpis = [
    {
      label: "Out of Stock",
      value: String(outOfStock),
      trend: "immediate vendor PO needed",
      trendTone: outOfStock > 0 ? ("down" as const) : ("flat" as const),
    },
    {
      label: "Low Stock Items",
      value: String(low),
      trend: "at or below minimum level",
      trendTone: low > 0 ? ("down" as const) : ("flat" as const),
    },
    {
      label: "Critical Expiry",
      value: String(criticalExp),
      trend: "≤7 days or expired lot",
      trendTone: criticalExp > 0 ? ("down" as const) : ("flat" as const),
    },
    {
      label: "Expiring in 30 Days",
      value: String(expiringBatches.length),
      trend: "plan dispensations / returns",
      trendTone: expiringBatches.length > 0 ? ("down" as const) : ("flat" as const),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Filter Alerts:</span>
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
            categoryFilter === "ALL"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
        >
          All Items ({medicines.filter((m) => m.status === "Active").length})
        </button>
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.type}
            onClick={() => setCategoryFilter(f.type)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              categoryFilter === f.type
                ? f.activeClasses
                : "bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            <f.Icon className="size-3" /> {f.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} kpi={k} index={i} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <p className="text-sm font-bold text-foreground">Low Stock & Out of Stock Alerts</p>
            {lowStockItems.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-xs font-bold">
                {lowStockItems.length} items
              </span>
            )}
          </div>
          {lowStockItems.length === 0 ? (
            <div className="erp-card p-8 text-center border border-border">
              <ShoppingBag className="mx-auto size-10 text-emerald-500 opacity-50" />
              <p className="mt-3 text-sm font-semibold text-emerald-600">All Stock Levels Healthy</p>
              <p className="text-xs text-muted-foreground">
                No items in {categoryFilter === "ALL" ? "any category" : categoryFilter.toLowerCase()} are below reorder level.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {lowStockItems.map((med) => (
                <LowStockCard key={med.itemCode} med={med} qty={getTotalQty(med.itemCode)} />
              ))}
            </div>
          )}
        </div>

        {/* Expiry Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-rose-500" />
            <p className="text-sm font-bold text-foreground">Batch Expiry Alerts (≤30 Days)</p>
            {expiringBatches.length > 0 && (
              <span className="ml-auto rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 text-xs font-bold">
                {expiringBatches.length} batches
              </span>
            )}
          </div>
          {expiringBatches.length === 0 ? (
            <div className="erp-card p-8 text-center border border-border">
              <Clock className="mx-auto size-10 text-emerald-500 opacity-50" />
              <p className="mt-3 text-sm font-semibold text-emerald-600">No Batches Expiring Soon</p>
              <p className="text-xs text-muted-foreground">All active inventory batches have &gt;30 days validity.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {expiringBatches.map(({ batch, med }) => (
                <ExpiryCard key={batch.id} batch={batch} med={med} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
