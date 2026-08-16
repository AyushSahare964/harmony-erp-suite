import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, Search, Activity, AlertTriangle, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/erp/KpiCard";
import { useInventory, type Batch } from "./useInventoryStore";

function money(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

// ─── Stock Status Badge ───────────────────────────────────────────────────────
function StockBadge({ status }: { status: "OK" | "Low" | "Out of Stock" }) {
  const cfg = {
    OK: { cls: "bg-success-soft text-success", label: "OK" },
    Low: { cls: "bg-warning-soft text-warning", label: "Low" },
    "Out of Stock": { cls: "bg-danger-soft text-destructive", label: "Out of Stock" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

// ─── Expiry Chip ──────────────────────────────────────────────────────────────
function ExpiryChip({ date, status }: { date: string; status: "safe" | "expiring-soon" | "critical" | "expired" }) {
  const cfg = {
    safe: { cls: "text-muted-foreground", icon: null },
    "expiring-soon": { cls: "text-warning font-semibold", icon: <Clock className="size-3" /> },
    critical: { cls: "text-destructive font-semibold", icon: <AlertTriangle className="size-3" /> },
    expired: { cls: "text-destructive font-bold", icon: <AlertTriangle className="size-3" /> },
  }[status];

  const today = new Date();
  const expiry = new Date(date);
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
  const label =
    status === "expired"
      ? `Expired ${Math.abs(diffDays)}d ago`
      : status === "critical"
      ? `Exp in ${diffDays}d`
      : status === "expiring-soon"
      ? `Exp in ${diffDays}d`
      : date;

  return (
    <span className={`inline-flex items-center gap-1 ${cfg.cls}`}>
      {cfg.icon}
      {label}
    </span>
  );
}

// ─── Batch Row (expandable) ───────────────────────────────────────────────────
function BatchRows({ batches }: { batches: Batch[] }) {
  const { getExpiryStatus, ledger } = useInventory();
  return (
    <AnimatePresence>
      {batches.map((b) => {
        const exStatus = getExpiryStatus(b.expiryDate);
        const lastMove = ledger.find((l) => l.batchId === b.id);
        const rowBg =
          exStatus === "expired" || exStatus === "critical"
            ? "bg-danger-soft/40"
            : exStatus === "expiring-soon"
            ? "bg-warning-soft/40"
            : "bg-accent/20";
        return (
          <motion.tr
            key={b.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`${rowBg} border-b border-dashed border-border`}
          >
            <td className="pl-10 pr-4 py-2 text-xs text-muted-foreground" />
            <td className="px-4 py-2 text-xs font-mono font-semibold text-muted-foreground">
              {b.batchNo}
            </td>
            <td className="px-4 py-2 text-xs">
              <ExpiryChip date={b.expiryDate} status={exStatus} />
            </td>
            <td className="px-4 py-2 text-xs text-right tabular-nums font-semibold">
              {b.qty}
            </td>
            <td className="px-4 py-2 text-xs text-right text-muted-foreground tabular-nums">
              {money(b.purchasePrice)}
            </td>
            <td className="px-4 py-2 text-xs text-muted-foreground">
              {lastMove ? lastMove.createdAt.slice(0, 10) : "—"}
            </td>
            <td />
          </motion.tr>
        );
      })}
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StockView() {
  const { medicines, getBatches, getTotalQty, getStockStatus, getExpiryStatus, ledger } = useInventory();
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const activeMeds = useMemo(() => medicines.filter((m) => m.status === "Active"), [medicines]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return activeMeds.filter((m) => {
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      const status = getStockStatus(m.id);
      const matchStatus = filterStatus === "all" || status === filterStatus;
      const matchCat = filterCat === "all" || m.category === filterCat;
      return matchQ && matchStatus && matchCat;
    });
  }, [activeMeds, query, filterStatus, filterCat, getStockStatus]);

  const kpis = useMemo(() => {
    const low = activeMeds.filter((m) => getStockStatus(m.id) === "Low").length;
    const oos = activeMeds.filter((m) => getStockStatus(m.id) === "Out of Stock").length;

    // Count batches expiring within 30 days
    const allBatches = activeMeds.flatMap((m) => getBatches(m.id));
    const expiring = allBatches.filter((b) => {
      const s = getExpiryStatus(b.expiryDate);
      return s === "expiring-soon" || s === "critical";
    }).length;
    const expired = allBatches.filter((b) => getExpiryStatus(b.expiryDate) === "expired").length;

    const totalValue = allBatches.reduce((s, b) => s + b.qty * b.purchasePrice, 0);
    return [
      { label: "Total active medicines", value: String(activeMeds.length), trend: "in catalogue", trendTone: "flat" as const },
      { label: "Low-stock items", value: String(low), trend: `${oos} out of stock`, trendTone: low > 0 ? "down" as const : "flat" as const },
      { label: "Expiring batches", value: String(expiring + expired), trend: `${expired} already expired`, trendTone: expiring + expired > 0 ? "down" as const : "flat" as const },
      { label: "Total stock value", value: `₹${(totalValue / 1000).toFixed(1)}K`, trend: "at cost price", trendTone: "up" as const },
    ];
  }, [activeMeds, getBatches, getStockStatus, getExpiryStatus]);

  const lastUpdated = useMemo(() => {
    if (ledger.length === 0) return "—";
    return ledger[0].createdAt;
  }, [ledger]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.label} kpi={k} index={i} />)}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="size-3.5 text-success animate-pulse" />
          <span className="font-semibold text-success">Live</span>
        </span>
        <span>·</span>
        <span>Last movement: {lastUpdated}</span>
        <span>·</span>
        <span>Click any row to see batch breakdown</span>
      </div>

      {/* Table */}
      <div className="erp-card overflow-hidden shadow-xs">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="stock-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search medicines, categories…"
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Out of Stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {["Medicine", "Food", "Accessory", "Consumable"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground font-medium">{visible.length} medicines</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                <th className="w-8 px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Medicine</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Batch / Expiry</th>
                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Total Qty</th>
                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Purchase Price</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Last Movement</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {visible.map((med) => {
                  const batches = getBatches(med.id);
                  const totalQty = getTotalQty(med.id);
                  const status = getStockStatus(med.id);
                  const isExpanded = expanded.has(med.id);
                  const lastMove = ledger.find((l) => l.medicineId === med.id);

                  // Find worst-case expiry among batches
                  const worstBatch = batches.find((b) => {
                    const s = getExpiryStatus(b.expiryDate);
                    return s === "expired" || s === "critical";
                  }) ?? batches.find((b) => getExpiryStatus(b.expiryDate) === "expiring-soon");

                  return (
                    <>
                      <motion.tr
                        key={med.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="transition-colors hover:bg-primary-soft/30 cursor-pointer"
                        onClick={() => toggleExpand(med.id)}
                      >
                        <td className="px-4 py-3">
                          <motion.span
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.18 }}
                            className="inline-flex"
                          >
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </motion.span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold">{med.name}</p>
                            <p className="text-xs text-muted-foreground">{med.category} · {med.unit}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {worstBatch ? (
                            <ExpiryChip
                              date={worstBatch.expiryDate}
                              status={getExpiryStatus(worstBatch.expiryDate)}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">{batches.length} batch{batches.length !== 1 ? "es" : ""}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-lg">
                          {totalQty}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums text-xs">
                          {batches.length > 0 ? money(batches[0].purchasePrice) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {lastMove ? lastMove.createdAt.slice(0, 10) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StockBadge status={status} />
                        </td>
                      </motion.tr>
                      {isExpanded && <BatchRows key={`${med.id}-batches`} batches={batches} />}
                    </>
                  );
                })}
              </AnimatePresence>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No medicines match your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger drill-down */}
      <div className="erp-card p-5 space-y-3">
        <p className="section-label">Recent Stock Movements</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                {["Time", "Medicine", "Batch", "Type", "Qty", "Balance After", "Source", "Actor"].map((h) => (
                  <th key={h} className={`pb-2 font-bold uppercase tracking-wide ${h === "Qty" || h === "Balance After" ? "text-right" : "text-left"} px-2`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ledger.slice(0, 10).map((l) => (
                <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{l.createdAt}</td>
                  <td className="px-2 py-2 font-medium">{l.medicineName}</td>
                  <td className="px-2 py-2 font-mono text-muted-foreground">{l.batchNo}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                      l.movementType.includes("in") ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"
                    }`}>
                      {l.movementType.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums font-semibold ${l.movementType.includes("in") ? "text-success" : "text-destructive"}`}>
                    {l.movementType.includes("in") ? "+" : "−"}{l.quantity}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{l.balanceAfter}</td>
                  <td className="px-2 py-2 font-mono text-muted-foreground">{l.sourceRef}</td>
                  <td className="px-2 py-2 text-muted-foreground">{l.actorName}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No movements yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
