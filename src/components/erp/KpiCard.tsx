import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/erp/config";

export function KpiCard({ kpi, index = 0 }: { kpi: Kpi; index?: number }) {
  const tone = kpi.trendTone ?? "flat";
  const TrendIcon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;
  const [open, setOpen] = useState(false);
  const rows = kpi.detail?.rows ?? [];

  return (
    <>
    <motion.div
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="erp-card cursor-pointer px-4 py-3.5 transition-shadow hover:shadow-md"
    >
      <p className="section-label">{kpi.label}</p>
      <motion.p
        key={kpi.value}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mt-1.5 text-[1.55rem] font-bold leading-none tracking-tight text-primary"
      >
        {kpi.value}
      </motion.p>
      {kpi.trend && (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-medium",
            tone === "up" && "text-success",
            tone === "down" && "text-destructive",
            tone === "flat" && "text-muted-foreground",
          )}
        >
          <TrendIcon className="size-3.5" />
          {kpi.trend}
        </p>
      )}
    </motion.div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{kpi.label}: {kpi.value}</DialogTitle>
          <DialogDescription>{kpi.trend}</DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No records behind this figure right now.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                {kpi.detail!.columns.map((c) => <th key={c} className="px-2 py-2">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i}>{r.map((cell, j) => <td key={j} className="px-2 py-2">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
