import { useState, useEffect, useMemo } from "react";
import {
  Bone,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Package,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getItemsFn } from "@/lib/mongodb/serverFns/inventory";
import { cn } from "@/lib/utils";

interface Props {
  items?: any[];
}

export function TherapeuticDietCatalog({ items }: Props) {
  const [internalItems, setInternalItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!items) {
      setLoading(true);
      getItemsFn({ data: { type: "FOOD" } })
        .then((res) => setInternalItems(res || []))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [items]);

  const sourceItems = items ?? internalItems;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return sourceItems.filter(
      (d) =>
        !q ||
        d.name?.toLowerCase().includes(q) ||
        d.itemCode?.toLowerCase().includes(q) ||
        d.sku?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q) ||
        d.brand?.toLowerCase().includes(q)
    );
  }, [sourceItems, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search therapeutic diets by brand, health indication, or SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {filtered.length} clinical diet lines tracked
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">THERAPEUTIC DIET PRODUCT</th>
              <th className="px-4 py-3">CLINICAL CATEGORY</th>
              <th className="px-4 py-3">CURRENT STOCK</th>
              <th className="px-4 py-3">REORDER TRIGGER</th>
              <th className="px-4 py-3 text-right">MRP (₹)</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((d) => {
              const currentStock = d.currentStock ?? 0;
              const reorderLevel = d.reorderLevel ?? 0;
              const uom = d.salesUom || d.unit || "Units";
              const isOos = currentStock <= 0;
              const isLow = currentStock <= reorderLevel;
              const statusText = isOos ? "Critical Low" : isLow ? "Low Stock" : "In Stock";

              return (
                <tr key={d.itemCode || d.sku} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono font-bold text-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                      {d.itemCode || d.sku}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-foreground">{d.name}</p>
                    {d.brand && <p className="text-[10px] text-muted-foreground">{d.brand}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                      {d.category || d.foodDetails?.species || "Clinical Nutrition"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-foreground">
                    {currentStock} {uom}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {reorderLevel} {uom}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                    ₹{Number(d.sellingPrice || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      !isLow ? "bg-emerald-500/10 text-emerald-600" :
                      isOos ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {statusText}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.info(`Purchase Order draft created for ${d.name}`)}
                      className="h-7 text-[11px] font-semibold text-primary"
                    >
                      Reorder Stock
                    </Button>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  {loading ? "Loading prescription diet stock..." : "No prescription diet products found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
