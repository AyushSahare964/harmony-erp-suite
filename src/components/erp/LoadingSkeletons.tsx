import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A row of KPI-card-shaped placeholders, matching KpiCard's own layout. */
export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="erp-card space-y-2.5 px-4 py-3.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A card-shaped table placeholder: toolbar row + N body rows. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="erp-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Skeleton className="h-9 max-w-xs flex-1" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "flex-1")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A card-shaped chart placeholder. */
export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="erp-card p-5">
      <Skeleton className="mb-4 h-3 w-32" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

/**
 * Full hub-page loading state: title + KPI row + (optional chart) + table.
 * Render this as the whole page while the Shell around it mounts instantly —
 * so the sidebar/topbar never disappear, only this content area does.
 */
export function HubSkeleton({ withChart = false }: { withChart?: boolean }) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="space-y-2 pt-0.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>
      <KpiRowSkeleton />
      {withChart && <ChartSkeleton />}
      <TableSkeleton />
    </div>
  );
}

/** Lighter loader for content mounting inside an already-visible hub (a tab pane). */
export function SectionSkeleton({ rows = 4, withChart = false }: { rows?: number; withChart?: boolean }) {
  return (
    <div className="space-y-4">
      <KpiRowSkeleton count={3} />
      {withChart && <ChartSkeleton />}
      <TableSkeleton rows={rows} />
    </div>
  );
}

/** Small inline spinner for tight spaces (modals, widgets) where a skeleton would be oversized. */
export function InlineSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}
