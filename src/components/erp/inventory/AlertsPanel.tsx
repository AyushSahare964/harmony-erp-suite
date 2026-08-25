import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Clock, ShoppingBag, Skull,
} from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { useInventory, type Medicine, type Batch } from "./useInventoryStore";

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

// ─── Low Stock Card ───────────────────────────────────────────────────────────
function LowStockCard({ med, qty }: { med: Medicine; qty: number }) {
  const pct = Math.round((qty / med.reorderLevel) * 100);
  const isOos = qty === 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`erp-card p-4 border-l-4 ${isOos ? "border-destructive" : "border-warning"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${isOos ? "bg-danger-soft text-destructive" : "bg-warning-soft text-warning"}`}>
            {isOos ? <Skull className="size-4" /> : <AlertTriangle className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{med.name}</p>
            <p className="text-xs text-muted-foreground">{med.category} · {med.unit}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${isOos ? "text-destructive" : "text-warning"}`}>{qty}</p>
          <p className="text-xs text-muted-foreground">reorder at {med.reorderLevel}</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${isOos ? "bg-destructive" : pct < 50 ? "bg-warning" : "bg-success"}`}
        />
      </div>
      <p className="mt-1 text-right text-[10px] text-muted-foreground">{pct}% of reorder level</p>
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
    ? "border-destructive bg-danger-soft/30"
    : isCritical
    ? "border-destructive bg-danger-soft/20"
    : "border-warning bg-warning-soft/20";

  const labelColor = isExpired || isCritical ? "text-destructive" : "text-warning";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`erp-card p-4 border-l-4 ${accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${isExpired || isCritical ? "bg-danger-soft text-destructive" : "bg-warning-soft text-warning"}`}>
            <Clock className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{med.name}</p>
            <p className="text-xs font-mono text-muted-foreground">{batch.batchNo}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold text-sm ${labelColor}`}>
            {isExpired
              ? `Expired ${Math.abs(diff)}d ago`
              : diff === 0
              ? "Expires TODAY"
              : `${diff}d left`}
          </p>
          <p className="text-xs text-muted-foreground">{batch.qty} {med.unit} in stock</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Expiry: {batch.expiryDate}</span>
        <span>{med.category}</span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AlertsPanel() {
  const { medicines, getBatches, getTotalQty, getStockStatus, getExpiryStatus } = useInventory();
  const activeMeds = useMemo(() => medicines.filter((m) => m.status === "Active"), [medicines]);

  const lowStockItems = useMemo(
    () =>
      activeMeds
        .filter((m) => {
          const s = getStockStatus(m.id);
          return s === "Low" || s === "Out of Stock";
        })
        .sort((a, b) => getTotalQty(a.id) - getTotalQty(b.id)),
    [activeMeds, getStockStatus, getTotalQty]
  );

  const expiringBatches = useMemo<{ batch: Batch; med: Medicine }[]>(
    () => {
      const items: { batch: Batch; med: Medicine }[] = [];
      for (const med of activeMeds) {
        for (const batch of getBatches(med.id)) {
          const s = getExpiryStatus(batch.expiryDate);
          if (s === "expired" || s === "critical" || s === "expiring-soon") {
            items.push({ batch, med });
          }
        }
      }
      return items.sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate));
    },
    [activeMeds, getBatches, getExpiryStatus]
  );

  const outOfStock = lowStockItems.filter((m) => getStockStatus(m.id) === "Out of Stock").length;
  const low = lowStockItems.filter((m) => getStockStatus(m.id) === "Low").length;
  const criticalExp = expiringBatches.filter((x) => getExpiryStatus(x.batch.expiryDate) === "critical" || getExpiryStatus(x.batch.expiryDate) === "expired").length;

  const kpis = [
    { label: "Out of stock", value: String(outOfStock), trend: "immediate action needed", trendTone: outOfStock > 0 ? "down" as const : "flat" as const },
    { label: "Low stock items", value: String(low), trend: "below reorder level", trendTone: low > 0 ? "down" as const : "flat" as const },
    { label: "Critical expiry", value: String(criticalExp), trend: "≤7 days or expired", trendTone: criticalExp > 0 ? "down" as const : "flat" as const },
    { label: "Expiring in 30d", value: String(expiringBatches.length), trend: "plan write-offs", trendTone: expiringBatches.length > 0 ? "down" as const : "flat" as const },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.label} kpi={k} index={i} />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low stock section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            <p className="section-label text-warning">Low Stock & Out of Stock</p>
            {lowStockItems.length > 0 && (
              <span className="ml-auto rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">
                {lowStockItems.length} items
              </span>
            )}
          </div>
          {lowStockItems.length === 0 ? (
            <div className="erp-card p-8 text-center">
              <ShoppingBag className="mx-auto size-10 text-success opacity-50" />
              <p className="mt-3 text-sm font-medium text-success">All stock levels are healthy</p>
              <p className="text-xs text-muted-foreground">No medicines below reorder level</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {lowStockItems.map((med) => (
                <LowStockCard key={med.id} med={med} qty={getTotalQty(med.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Expiry section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-destructive" />
            <p className="section-label text-destructive">Expiry Alerts (≤30 days)</p>
            {expiringBatches.length > 0 && (
              <span className="ml-auto rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-destructive">
                {expiringBatches.length} batches
              </span>
            )}
          </div>
          {expiringBatches.length === 0 ? (
            <div className="erp-card p-8 text-center">
              <Clock className="mx-auto size-10 text-success opacity-50" />
              <p className="mt-3 text-sm font-medium text-success">No batches expiring soon</p>
              <p className="text-xs text-muted-foreground">All batches have &gt;30 days to expiry</p>
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
