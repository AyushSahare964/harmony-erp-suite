import { useState, useEffect } from "react";
import {
  X,
  Printer,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";

interface StockSummaryModalProps {
  open: boolean;
  onClose: () => void;
}

export function StockSummaryModal({ open, onClose }: StockSummaryModalProps) {
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getItemsFn({ data: { status: "Active" } })
      .then((data) => setItems(data || []))
      .catch((err) => console.error("Failed to load inventory for stock summary:", err))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  let totalCostValuation = 0;
  let totalMrpValuation = 0;
  const lowStockItems: InventoryItemRow[] = [];
  const outOfStockItems: InventoryItemRow[] = [];

  for (const item of items) {
    const qty = (item as any).currentStock ?? 10;
    const rate = (item as any).purchaseRate || 0;
    const mrp = (item as any).mrp || 0;
    totalCostValuation += qty * rate;
    totalMrpValuation += qty * mrp;

    if (qty <= 0) {
      outOfStockItems.push(item);
    } else if (qty <= ((item as any).reorderLevel || 5)) {
      lowStockItems.push(item);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Boxes className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Stock Valuation &amp; Inventory Summary</h2>
              <p className="text-xs text-muted-foreground">Current clinic stock holding value, reorder alerts, and availability</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 4 Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-muted-foreground">Total Active Items</span>
              <p className="mt-1 text-xl font-bold text-foreground">{items.length}</p>
              <span className="text-[11px] text-muted-foreground">Medicines &amp; supplies</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-muted-foreground">Stock Value (Cost)</span>
              <p className="mt-1 text-xl font-bold text-blue-600">
                ₹{totalCostValuation.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[11px] text-muted-foreground">At purchase rate</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-muted-foreground">Stock Value (MRP)</span>
              <p className="mt-1 text-xl font-bold text-emerald-600">
                ₹{totalMrpValuation.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[11px] text-muted-foreground">Realizable revenue</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-muted-foreground">Low / Out of Stock</span>
              <p className="mt-1 text-xl font-bold text-rose-600">
                {lowStockItems.length + outOfStockItems.length}
              </p>
              <span className="text-[11px] text-rose-500">Requires reordering</span>
            </div>
          </div>

          {/* Attention Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Items Requiring Reorder Attention ({lowStockItems.length + outOfStockItems.length})
            </h3>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Item Name</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Available Qty</th>
                    <th className="px-4 py-2.5 text-right">Reorder Level</th>
                    <th className="px-4 py-2.5 text-right">Purchase Rate (₹)</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...outOfStockItems, ...lowStockItems].slice(0, 10).map((it) => {
                    const qty = (it as any).currentStock ?? 0;
                    const isOut = qty <= 0;
                    return (
                      <tr key={it.itemCode} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium text-foreground">{it.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{(it as any).category || "Medicine"}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                          <span className={isOut ? "text-rose-600 font-bold" : "text-amber-600 font-bold"}>
                            {qty}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {(it as any).reorderLevel || 5}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          ₹{((it as any).purchaseRate || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isOut ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {isOut ? "Out of Stock" : "Low Stock"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {outOfStockItems.length === 0 && lowStockItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        All active stock levels are healthy!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="size-4" /> Print Stock Summary
          </Button>
        </div>
      </div>
    </div>
  );
}
