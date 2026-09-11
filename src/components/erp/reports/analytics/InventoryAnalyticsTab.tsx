import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Package, AlertTriangle, Clock, ShoppingCart, DollarSign } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#64748b"];

export function InventoryAnalyticsTab({ data, onDrilldown }: Props) {
  const { overview, inventorySales } = data;
  const totalItemsCount = inventorySales.categorySplit.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      {/* 4 Inventory Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{
            label: "TOTAL STOCK VALUATION",
            value: `₹${overview.inventoryTotalValue.toLocaleString("en-IN")}`,
            trend: `${totalItemsCount} catalog SKUs`,
            trendTone: "up",
          }}
          index={0}
        />
        <KpiCard
          kpi={{
            label: "LOW STOCK WARNINGS",
            value: overview.lowStockCount.toString(),
            trend: overview.lowStockCount > 0 ? "Reorder recommended" : "Stock healthy",
            trendTone: overview.lowStockCount > 0 ? "down" : "up",
          }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "EXPIRY AT RISK",
            value: (
              (inventorySales.expiryRiskBuckets.find((b) => b.bucket === "Expired")?.count ?? 0) +
              (inventorySales.expiryRiskBuckets.find((b) => b.bucket === "Within 30 Days")?.count ?? 0)
            ).toString(),
            trend: "Expired or <30d shelf life",
            trendTone: "down",
          }}
          index={2}
        />
        <KpiCard
          kpi={{
            label: "FAST MOVING SKUS",
            value: inventorySales.topSellingProducts.length.toString(),
            trend: "Top demand items",
            trendTone: "up",
          }}
          index={3}
        />
      </div>

      {/* Category Breakdown & Expiry Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              STOCK VALUATION BY CATEGORY
            </p>
            <p className="text-[11px] text-muted-foreground">Capital allocation across medicines, diagnostics, surgicals</p>
          </div>

          {inventorySales.categorySplit.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              No inventory catalog items available
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventorySales.categorySplit}
                      dataKey="value"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {inventorySales.categorySplit.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Holding Value"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {inventorySales.categorySplit.map((cat, i) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() =>
                      onDrilldown({
                        title: `Inventory Category: ${cat.category}`,
                        type: "inventory-category",
                        data: cat,
                      })
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      <span className="font-medium truncate max-w-[90px]">{cat.category}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{cat.value.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-muted-foreground">{cat.count} items</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Expiry Risk Buckets */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              EXPIRY RISK DISTRIBUTION
            </p>
            <p className="text-[11px] text-muted-foreground">Batches approaching shelf-life threshold</p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventorySales.expiryRiskBuckets} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(val: any, name: any) => [
                    name === "count" ? `${val} batches` : `₹${Number(val).toLocaleString("en-IN")}`,
                    name === "count" ? "Batch Count" : "Value",
                  ]}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Low Stock Alerts & Top Selling Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low Stock Alerts */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                LOW-STOCK ALERT SKUS
              </p>
              <p className="text-[11px] text-muted-foreground">Items falling below safe minimum stock levels</p>
            </div>
            <Badge variant="destructive" className="text-[11px]">
              {inventorySales.lowStockAlerts.length} Action Needed
            </Badge>
          </div>

          {inventorySales.lowStockAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              All inventory items are currently at or above minimum threshold
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg max-h-[260px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">Item &amp; Code</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5 text-center">Current</th>
                    <th className="p-2.5 text-center">Min Level</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventorySales.lowStockAlerts.map((item) => (
                    <tr key={item.itemCode || item.name} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate max-w-[130px]">{item.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{item.itemCode || "N/A"}</span>
                      </td>
                      <td className="p-2.5 text-muted-foreground">{item.category}</td>
                      <td className="p-2.5 text-center font-bold text-rose-500">{item.currentStock}</td>
                      <td className="p-2.5 text-center text-muted-foreground">{item.minStockLevel}</td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() =>
                            onDrilldown({
                              title: `Restock: ${item.name}`,
                              type: "low-stock-item",
                              data: item,
                            })
                          }
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          Restock →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Top Selling Products */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                TOP-SELLING PRODUCTS &amp; PHARMACY
              </p>
              <p className="text-[11px] text-muted-foreground">High-turnover medications and retail items</p>
            </div>
            <ShoppingCart className="w-4 h-4 text-primary" />
          </div>

          {inventorySales.topSellingProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No product dispense records available for this period
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg max-h-[260px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5 text-center">Units Sold</th>
                    <th className="p-2.5 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventorySales.topSellingProducts.map((prod) => (
                    <tr key={prod.name} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-medium">{prod.name}</td>
                      <td className="p-2.5 text-muted-foreground">{prod.category}</td>
                      <td className="p-2.5 text-center font-bold">{prod.unitsSold}</td>
                      <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{prod.revenue.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
