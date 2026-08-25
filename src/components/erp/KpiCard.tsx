import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/erp/config";

export function KpiCard({ kpi, index = 0 }: { kpi: Kpi; index?: number }) {
  const tone = kpi.trendTone ?? "flat";
  const TrendIcon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="erp-card px-4 py-3.5 transition-shadow hover:shadow-md"
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
  );
}
