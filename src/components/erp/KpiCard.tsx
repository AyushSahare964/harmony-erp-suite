import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarClock,
  FlaskConical,
  Minus,
  PawPrint,
  Receipt,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/erp/config";

/** Icon chosen from the card label when a page passes none (first match wins). */
const LABEL_ICONS: [RegExp, LucideIcon][] = [
  [/alert|low|expir/i, AlertTriangle],
  [/\bdue\b|outstanding/i, Wallet],
  [/pet|patient/i, PawPrint],
  [/owner|client/i, Users],
  [/appointment|queue/i, CalendarClock],
  [/billed|revenue|sale|invoice|collected/i, Receipt],
  [/stock|inventory|units/i, Boxes],
  [/lab/i, FlaskConical],
];
export const kpiIconFor = (label: string): LucideIcon =>
  LABEL_ICONS.find(([re]) => re.test(label))?.[1] ?? BarChart3;

export function KpiCard({ kpi, index = 0, icon }: { kpi: Kpi; index?: number; icon?: LucideIcon }) {
  const Icon = icon ?? kpiIconFor(kpi.label);
  // Big number: full size by default; steps down only if a long value would be cut off in a narrow card.
  const valueRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      el.removeAttribute("data-fitted");
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && size > 28) {
        size -= 2;
        el.style.fontSize = `${size}px`;
        el.setAttribute("data-fitted", "true");
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [kpi.value]);
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
      className="erp-kpi erp-kpi-row cursor-pointer"
    >
      <span className="erp-kpi-icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="erp-kpi-body">
      <p className="erp-kpi-label">{kpi.label}</p>
      <motion.p
        key={kpi.value}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        ref={valueRef}
        className="erp-kpi-value"
      >
        {kpi.value}
      </motion.p>
      {kpi.trend && (
        <p
          className={cn(
            "erp-kpi-note flex items-center gap-1",
            tone === "up" && "text-success",
            tone === "down" && "text-destructive",
            tone === "flat" && "text-muted-foreground",
          )}
        >
          <TrendIcon className="size-3.5" />
          {kpi.trend}
        </p>
      )}
      </div>
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
