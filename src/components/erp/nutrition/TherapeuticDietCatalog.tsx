import { useState, useMemo } from "react";
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
import { cn } from "@/lib/utils";

const DIET_STOCK_ITEMS = [
  { sku: "DIET-101", name: "Royal Canin Renal Support 4kg", category: "Renal Care", currentStock: "8 Bags", reorderLevel: "10 Bags", price: "₹2,450", status: "Low Stock" },
  { sku: "DIET-102", name: "Farmina Vet Life Gastrointestinal 2kg", category: "Digestive Care", currentStock: "18 Bags", reorderLevel: "8 Bags", price: "₹1,850", status: "In Stock" },
  { sku: "DIET-103", name: "Hill's Prescription Diet Hypoallergenic z/d 3.5kg", category: "Dermatology", currentStock: "4 Bags", reorderLevel: "6 Bags", price: "₹3,100", status: "Reorder Due" },
  { sku: "DIET-104", name: "Royal Canin Satiety Weight Management 6kg", category: "Weight Loss", currentStock: "12 Bags", reorderLevel: "5 Bags", price: "₹3,400", status: "In Stock" },
  { sku: "DIET-105", name: "Royal Canin Puppy Maxi Growth 15kg", category: "Puppy Care", currentStock: "15 Bags", reorderLevel: "8 Bags", price: "₹6,200", status: "In Stock" },
  { sku: "DIET-106", name: "Royal Canin Hairball Care Feline 2kg", category: "Feline Care", currentStock: "2 Bags", reorderLevel: "5 Bags", price: "₹1,650", status: "Critical Low" },
  { sku: "DIET-107", name: "Farmina Vet Life Diabetic Management 2kg", category: "Endocrine", currentStock: "6 Bags", reorderLevel: "4 Bags", price: "₹1,950", status: "In Stock" },
];

export function TherapeuticDietCatalog() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return DIET_STOCK_ITEMS.filter(
      (d) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.sku.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [query]);

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
            {filtered.map((d) => (
              <tr key={d.sku} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-mono font-bold text-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                    {d.sku}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-foreground">{d.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                    {d.category}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-foreground">{d.currentStock}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{d.reorderLevel}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{d.price}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded",
                    d.status === "In Stock" ? "bg-emerald-500/10 text-emerald-600" :
                    d.status === "Critical Low" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"
                  )}>
                    {d.status}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
