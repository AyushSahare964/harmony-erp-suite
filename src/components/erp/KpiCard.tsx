import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/erp/config";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const tone = kpi.trendTone ?? "flat";
  const TrendIcon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;

  return (
    <div className="erp-card px-4 py-3.5">
      <p className="section-label">{kpi.label}</p>
      <p className="mt-1.5 text-[1.55rem] font-bold leading-none tracking-tight text-primary">
        {kpi.value}
      </p>
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
    </div>
  );
}
