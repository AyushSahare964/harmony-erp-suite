import { useState, useEffect, useMemo } from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Pill,
  Search,
  Plus,
  RotateCcw,
  Download,
  ShoppingBag,
  Bone,
  Tag,
  Receipt,
  Sparkles,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { NewRetailSaleModal } from "./NewRetailSaleModal";
import { RetailReceiptModal } from "./RetailReceiptModal";
import { listRetailSalesFn, createRetailSaleFn } from "@/lib/mongodb/serverFns/pharmacy";
import { cn } from "@/lib/utils";

const RETAIL_SALES_SERIES = [
  { name: "Mar", value: 980 },
  { name: "Apr", value: 1040 },
  { name: "May", value: 1120 },
  { name: "Jun", value: 1080 },
  { name: "Jul", value: 1190 },
  { name: "Aug", value: 1260 },
];

export function PharmacyRetailHub() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals state
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  useEffect(() => {
    void loadBills();
  }, []);

  const loadBills = async () => {
    setLoading(true);
    try {
      const data = await listRetailSalesFn();
      setBills(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load retail sales");
    } finally {
      setLoading(false);
    }
  };


  const filteredBills = useMemo(() => {
    const q = query.toLowerCase().trim();
    return bills.filter((b) => {
      const matchQ =
        !q ||
        b.bill.toLowerCase().includes(q) ||
        b.item.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.customer?.toLowerCase().includes(q);

      const matchS =
        statusFilter === "all" ||
        b.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchC =
        categoryFilter === "all" ||
        b.category?.toLowerCase() === categoryFilter.toLowerCase();

      return matchQ && matchS && matchC;
    });
  }, [bills, query, statusFilter, categoryFilter]);

  const handleReset = () => {
    void loadBills();
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    toast.success("Pharmacy & retail sales reloaded from MongoDB");
  };


  const handleOpenReceipt = (sale: any) => {
    setSelectedSale(sale);
    setShowReceiptModal(true);
  };

  const exportCsv = () => {
    const header = "Bill No,Items,Category,Quantity,Amount,Payment Mode,Customer,Date,Status";
    const body = filteredBills
      .map((b) => `"${b.bill}","${b.item}","${b.category}","${b.qty}","${b.amount}","${b.payment}","${b.customer}","${b.date}","${b.status}"`)
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy_retail_sales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Retail sales CSV exported");
  };

  return (
    <Shell title="Pharmacy &amp; Retail">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Header Bar matching Screenshot */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-xs">
              <Pill className="size-6" />
            </span>
            <div>
              <h1 className="page-title text-xl font-bold text-foreground">Pharmacy &amp; Retail</h1>
              <p className="text-xs text-muted-foreground">Medicine, food and accessory sales</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs font-semibold h-9">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs font-semibold h-9">
              <Download className="size-3.5" /> Export
            </Button>
            <Button
              size="sm"
              onClick={() => setShowNewSaleModal(true)}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> + New Sale
            </Button>
          </div>
        </div>

        {/* Top 4 KPI Cards (Exact Screenshot Match) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={{ label: "SALES TODAY", value: "₹46,200", trend: "+8.1%", trendTone: "up" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "BILLS TODAY", value: "37", trend: "+4", trendTone: "up" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "AVG. BILL VALUE", value: "₹1,249", trend: "+3%", trendTone: "up" }}
            index={2}
          />
          <KpiCard
            kpi={{ label: "OUT OF STOCK", value: "6", trend: "reorder now", trendTone: "down" }}
            index={3}
          />
        </div>

        {/* RETAIL SALES (₹ THOUSAND) Chart (Exact Screenshot Match) */}
        <div className="erp-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RETAIL SALES (₹ THOUSAND)</p>
              <p className="text-[11px] text-muted-foreground">Monthly pharmacy prescription &amp; pet accessory revenue</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-primary bg-primary/10">
              Peak: ₹1,260K (Aug)
            </Badge>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RETAIL_SALES_SERIES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  }}
                  formatter={(val: any) => [`₹${val}K`, "Revenue"]}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table & Filters (Exact Columns: BILL, ITEM, CATEGORY, QTY, AMOUNT, PAYMENT, STATUS) */}
        <div className="erp-card overflow-hidden shadow-xs space-y-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records by bill #, item name, accessory, or customer..."
                className="pl-9 text-xs h-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] text-xs h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="medicine">Medicine</SelectItem>
                <SelectItem value="accessory">Pet Accessories</SelectItem>
                <SelectItem value="food">Clinical Food</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] text-xs h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground font-medium">
              {filteredBills.length} of {bills.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3">BILL</th>
                  <th className="px-4 py-3">ITEM</th>
                  <th className="px-4 py-3">CATEGORY</th>
                  <th className="px-4 py-3 text-center">QTY</th>
                  <th className="px-4 py-3 text-right">AMOUNT</th>
                  <th className="px-4 py-3">PAYMENT</th>
                  <th className="px-4 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBills.map((row) => (
                  <tr key={row.bill} className="hover:bg-primary-soft/30 transition-colors">
                    {/* Bill */}
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                        {row.bill}
                      </span>
                    </td>

                    {/* Item */}
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{row.item}</p>
                      {row.customer && (
                        <p className="text-[10px] text-muted-foreground">Customer: {row.customer}</p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit",
                        row.category === "Accessory" ? "bg-purple-500/10 text-purple-600 border border-purple-500/30" :
                        row.category === "Food" ? "bg-amber-500/10 text-amber-600 border border-amber-500/30" :
                        "bg-primary/10 text-primary border border-primary/30"
                      )}>
                        {row.category === "Accessory" ? "🎀 Accessory" : row.category === "Food" ? "🥣 Food" : "💊 Medicine"}
                      </span>
                    </td>

                    {/* Qty */}
                    <td className="px-4 py-3 text-center font-mono font-bold">{row.qty}</td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                      ₹{Number(row.amount).toLocaleString("en-IN")}
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-3">
                      <span className="bg-muted px-2 py-0.5 rounded font-mono text-[11px] font-semibold text-foreground border border-border">
                        {row.payment}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReceipt(row)}
                          className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                        >
                          <Receipt className="size-3" /> Receipt
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      No retail sales records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        <NewRetailSaleModal
          open={showNewSaleModal}
          onClose={() => setShowNewSaleModal(false)}
          onSaleCompleted={(newSale) => setBills((prev) => [newSale, ...prev])}
        />

        <RetailReceiptModal
          open={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedSale(null);
          }}
          sale={selectedSale}
        />
      </div>
    </Shell>
  );
}
