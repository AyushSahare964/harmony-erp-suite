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
  Receipt,
  Search,
  Plus,
  RotateCcw,
  Download,
  Calendar,
  Eye,
  Edit,
  DollarSign,
  TrendingUp,
  CreditCard,
  User,
  Dog,
  Clock,
  Filter,
  Home,
  Waves,
  FlaskConical,
  Pill,
  Bone,
  Stethoscope,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listInvoicesFn, deleteInvoiceFn } from "@/lib/mongodb/serverFns/billing";
import { InvoiceDetailModal } from "./InvoiceDetailModal";
import { NewSalesInvoiceModal } from "./NewSalesInvoiceModal";
import { PartialPaymentModal } from "./PartialPaymentModal";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { cn } from "@/lib/utils";
import { InventoryProvider } from "@/components/erp/inventory/useInventoryStore";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

type CategoryFilter = "all" | "Clinical" | "Pharmacy" | "Boarding" | "Swimming" | "Laboratory" | "Nutrition";

function PatientBillingHubInner() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "7days" | "30days" | "all">("7days");
  const [startDate, setStartDate] = useState("2026-08-16");
  const [endDate, setEndDate] = useState("2026-08-22");

  // Selected Invoice Modal state
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // New Sales Invoice Modal state
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);

  // Edit Visit Modal state
  const [editingVisit, setEditingVisit] = useState<any | null>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  // Partial Payment Modal state
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [partialPayOwnerId, setPartialPayOwnerId] = useState("");
  const [partialPayOwnerName, setPartialPayOwnerName] = useState("");
  const [partialPayInvoiceNo, setPartialPayInvoiceNo] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await listInvoicesFn({ data: { query } });
      setInvoices(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleDatePreset = (preset: "today" | "yesterday" | "7days" | "30days" | "all") => {
    setDateFilter(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "7days") {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      setStartDate(past7.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "30days") {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      setStartDate(past30.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "all") {
      setStartDate("2026-01-01");
      setEndDate("2026-12-31");
    }
  };

  // Helper to determine invoice stream category if not explicitly tagged
  const getInvoiceCategory = (inv: any): string => {
    if (inv.category) return inv.category;
    const itemNames = (inv.items || []).map((i: any) => (i.name || "").toLowerCase()).join(" ");
    if (itemNames.includes("kennel") || itemNames.includes("boarding")) return "Boarding";
    if (itemNames.includes("hydrotherapy") || itemNames.includes("swim") || itemNames.includes("pool")) return "Swimming";
    if (itemNames.includes("cbc") || itemNames.includes("blood") || itemNames.includes("biochemistry") || itemNames.includes("panel")) return "Laboratory";
    if (itemNames.includes("renal support") || itemNames.includes("diet") || itemNames.includes("food")) return "Nutrition";
    if (inv.items?.some((i: any) => i.lineType === "Vaccine" || i.lineType === "Consultation")) return "Clinical";
    return "Clinical";
  };

  const handleDeleteInvoice = async (inv: any) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${inv.invoiceNo} for ${inv.petName || "patient"}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteInvoiceFn({ data: { invoiceNo: inv.invoiceNo } });
      toast.success(`Deleted invoice ${inv.invoiceNo}`);
      setInvoices((prev) => prev.filter((i) => i.invoiceNo !== inv.invoiceNo));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete invoice");
    }
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    const q = query.toLowerCase().trim();
    return invoices.filter((inv) => {
      const cat = getInvoiceCategory(inv);
      const matchCat = categoryFilter === "all" || cat.toLowerCase() === categoryFilter.toLowerCase();

      const matchQ =
        !q ||
        inv.invoiceNo?.toLowerCase().includes(q) ||
        inv.petName?.toLowerCase().includes(q) ||
        inv.petId?.toLowerCase().includes(q) ||
        inv.ownerName?.toLowerCase().includes(q) ||
        inv.ownerPhone?.includes(q) ||
        cat.toLowerCase().includes(q);

      // Date filtering
      let matchDate = true;
      if (dateFilter !== "all" && inv.date) {
        if (startDate && inv.date < startDate) matchDate = false;
        if (endDate && inv.date > endDate) matchDate = false;
      }

      return matchCat && matchQ && matchDate;
    });
  }, [invoices, query, categoryFilter, dateFilter, startDate, endDate]);

  const totalSales = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalPaid = filteredInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  const totalBalance = filteredInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

  // Category revenue aggregates for bar chart / badges
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {
      Clinical: 0,
      Pharmacy: 0,
      Boarding: 0,
      Swimming: 0,
      Laboratory: 0,
      Nutrition: 0,
    };
    for (const inv of invoices) {
      const cat = getInvoiceCategory(inv);
      if (map[cat] !== undefined) {
        map[cat] += inv.totalAmount || 0;
      } else {
        map["Clinical"] = (map["Clinical"] ?? 0) + (inv.totalAmount || 0);
      }

    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const handleOpenDetail = (inv: any) => {
    setSelectedInvoice(inv);
    setShowDetailModal(true);
  };

  const handleEditInvoice = (inv: any) => {
    setEditingVisit(inv);
    setShowWorkspaceModal(true);
  };

  const exportCsv = () => {
    const header = "Serial No,Invoice No,Category,Pet,Patient ID,Owner,Date,Total Amount,Total Paid,Balance,Status";
    const body = filteredInvoices
      .map(
        (inv, idx) =>
          `"${idx + 1}","${inv.invoiceNo}","${getInvoiceCategory(inv)}","${inv.petName}","${inv.petId || ""}","${inv.ownerName}","${inv.date}","${inv.totalAmount || 0}","${inv.amountPaid || 0}","${inv.balanceDue || 0}","${inv.status || "Paid"}"`
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hospital_sales_billing_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Sales invoices CSV exported");
  };

  return (
    <Shell title="Sales — Patient Billing &amp; Multi-Stream Invoices">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Header matching Screenshot 1 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-xs">
              <Receipt className="size-6" />
            </span>
            <div>
              <h1 className="page-title text-xl font-bold text-foreground">Sales &amp; Patient Invoices</h1>
              <p className="text-xs text-muted-foreground">
                Clinical OPD, Pharmacy, Kennel Boarding, Hydrotherapy Swimming &amp; Lab billing ledger
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadInvoices} className="gap-1.5 text-xs font-semibold h-9">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs font-semibold h-9">
              <Download className="size-3.5" /> Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setPartialPayOwnerId(""); setPartialPayOwnerName(""); setPartialPayInvoiceNo(undefined); setShowPartialPayment(true); }}
              className="gap-1.5 text-xs font-bold h-9 border-amber-500/40 text-amber-700 bg-amber-50/60 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40 shadow-2xs"
            >
              <CreditCard className="size-3.5" /> Partial Payment
            </Button>
            <Button
              size="sm"
              onClick={() => setShowNewInvoiceModal(true)}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> + New Sales Invoice
            </Button>
          </div>
        </div>

        {/* Top 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={{ label: "Total Invoices", value: String(filteredInvoices.length), trend: "Filtered Ledger", trendTone: "flat" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "Total Invoiced", value: `₹${totalSales.toLocaleString("en-IN")}`, trend: "+14.2% MTD", trendTone: "up" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "Total Collected", value: `₹${totalPaid.toLocaleString("en-IN")}`, trend: "Cash, UPI, Card", trendTone: "up" }}
            index={2}
          />
          <KpiCard
            kpi={{
              label: "Outstanding Balance",
              value: `₹${totalBalance.toLocaleString("en-IN")}`,
              trend: totalBalance > 0 ? "Pending dues" : "All cleared",
              trendTone: totalBalance > 0 ? "down" : "up",
            }}
            index={3}
          />
        </div>

        {/* Department Revenue Stream Distribution Breakdown */}
        <div className="erp-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              ALL HOSPITAL BILLING STREAMS DISTRIBUTION
            </p>
            <span className="text-xs font-mono font-bold text-primary">
              Grand Total: ₹{invoices.reduce((a, b) => a + (b.totalAmount || 0), 0).toLocaleString("en-IN")}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            {categorySummary.map((c) => (
              <div
                key={c.name}
                onClick={() => setCategoryFilter(categoryFilter === c.name ? "all" : (c.name as any))}
                className={cn(
                  "p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between shadow-2xs",
                  categoryFilter === c.name
                    ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                    : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold">
                  {c.name === "Clinical" && <span>🩺 Clinical</span>}
                  {c.name === "Pharmacy" && <span>💊 Pharmacy</span>}
                  {c.name === "Boarding" && <span>🏠 Boarding</span>}
                  {c.name === "Swimming" && <span>🏊‍♂️ Swimming</span>}
                  {c.name === "Laboratory" && <span>🔬 Lab Tests</span>}
                  {c.name === "Nutrition" && <span>🥣 Nutrition</span>}
                </div>
                <p className={cn("font-mono font-black text-sm mt-1", categoryFilter === c.name ? "text-white" : "text-foreground")}>
                  ₹{c.value.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Toolbar (Search + Category Filter + Date Range + Day/Week/Month Presets) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="erp-card overflow-hidden shadow-xs space-y-0"
        >
          <div className="p-4 space-y-3 bg-card border-b border-border">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by owner, pet name, Patient UID (e.g. PET-0001), or invoice #..."
                className="pl-9 text-xs h-10 w-full"
              />
            </div>

            {/* Category Filter Pills & Time Horizon Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: "All Streams" },
                    { id: "Clinical", label: "🩺 Clinical" },
                    { id: "Pharmacy", label: "💊 Pharmacy" },
                    { id: "Boarding", label: "🏠 Boarding" },
                    { id: "Swimming", label: "🏊‍♂️ Swimming" },
                    { id: "Laboratory", label: "🔬 Lab" },
                    { id: "Nutrition", label: "🥣 Nutrition" },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setCategoryFilter(pill.id)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-semibold border transition-all",
                      categoryFilter === pill.id
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Date Range & Presets (Screenshot 1: Today, Yesterday, 7 Days, 30 Days) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateFilter("all");
                    }}
                    className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 w-32 font-mono"
                  />
                  <span className="text-xs text-muted-foreground">—</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateFilter("all");
                    }}
                    className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 w-32 font-mono"
                  />
                </div>

                <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => handleDatePreset("today")}
                    className={cn(
                      "px-3 py-1 rounded-md transition-all",
                      dateFilter === "today" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => handleDatePreset("yesterday")}
                    className={cn(
                      "px-3 py-1 rounded-md transition-all",
                      dateFilter === "yesterday" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Yesterday
                  </button>
                  <button
                    onClick={() => handleDatePreset("7days")}
                    className={cn(
                      "px-3 py-1 rounded-md transition-all",
                      dateFilter === "7days" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    7 Days
                  </button>
                  <button
                    onClick={() => handleDatePreset("30days")}
                    className={cn(
                      "px-3 py-1 rounded-md transition-all",
                      dateFilter === "30days" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    30 Days
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Invoices Table (Screenshot 1 Match with Category Badges) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3 w-16">Serial No.</th>
                  <th className="px-4 py-3">Invoice No.</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Pet</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((inv, idx) => {
                  const cat = getInvoiceCategory(inv);
                  return (
                    <tr
                      key={inv.invoiceNo || idx}
                      className="hover:bg-primary-soft/30 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetail(inv)}
                    >
                      {/* Serial No. */}
                      <td className="px-4 py-3 font-medium text-muted-foreground">{idx + 1}</td>

                      {/* Invoice No. */}
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        <span className="hover:text-primary transition-colors">{inv.invoiceNo}</span>
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit",
                            cat === "Boarding" ? "bg-amber-500/10 text-amber-700 border border-amber-500/20" :
                            cat === "Swimming" ? "bg-blue-500/10 text-blue-700 border border-blue-500/20" :
                            cat === "Laboratory" ? "bg-purple-500/10 text-purple-700 border border-purple-500/20" :
                            cat === "Pharmacy" ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" :
                            cat === "Nutrition" ? "bg-orange-500/10 text-orange-700 border border-orange-500/20" :
                            "bg-primary/10 text-primary border border-primary/20"
                          )}
                        >
                          {cat === "Boarding" && "🏠 Boarding"}
                          {cat === "Swimming" && "🏊‍♂️ Swimming"}
                          {cat === "Laboratory" && "🔬 Lab"}
                          {cat === "Pharmacy" && "💊 Pharmacy"}
                          {cat === "Nutrition" && "🥣 Nutrition"}
                          {cat === "Clinical" && "🩺 Clinical"}
                        </span>
                      </td>

                      {/* Pet */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>{inv.species === "Feline" ? "🐱" : "🐶"}</span>
                          <span>{inv.petName || "Pet"}</span>
                          {inv.petId && (
                            <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                              {inv.petId}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3 font-medium text-foreground">
                        <p>{inv.ownerName || "Client"}</p>
                        {inv.ownerPhone && (
                          <p className="text-[10px] font-mono text-muted-foreground">{inv.ownerPhone}</p>
                        )}
                      </td>

                      {/* Date — displayed as DD/MM/YYYY */}
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {formatDisplayDate(inv.date) || inv.date || "—"}
                      </td>

                      {/* Total Amount */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        ₹{Number(inv.totalAmount || 0).toLocaleString("en-IN")}
                      </td>

                      {/* Total Paid */}
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                        ₹{Number(inv.amountPaid || 0).toLocaleString("en-IN")}
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded",
                            (inv.balanceDue || 0) > 0
                              ? "bg-red-500/10 text-destructive border border-red-500/20"
                              : "text-muted-foreground"
                          )}
                        >
                          ₹{Number(inv.balanceDue || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDetail(inv)}
                            className="h-7 px-2 text-xs font-semibold hover:text-primary gap-1"
                          >
                            <Eye className="size-3.5" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditInvoice(inv)}
                            className="h-7 px-2 text-xs font-semibold hover:text-primary gap-1"
                          >
                            <Edit className="size-3.5" /> Edit
                          </Button>
                          {(inv.balanceDue ?? 0) > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setPartialPayOwnerId(inv.ownerId || "");
                                setPartialPayOwnerName(inv.ownerName || "");
                                setPartialPayInvoiceNo(inv.invoiceNo);
                                setShowPartialPayment(true);
                              }}
                              className="h-7 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40 gap-1"
                            >
                              <CreditCard className="size-3.5" /> Pay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteInvoice(inv)}
                            className="h-7 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 gap-1"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-muted-foreground">
                      No invoices match the selected category or timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Detailed Invoice Modal (Screenshot 2 & 3) */}
        <InvoiceDetailModal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onUpdated={() => {
            void loadInvoices();
          }}
          onDeleted={() => {
            void loadInvoices();
          }}
          onEdit={(inv) => {
            handleEditInvoice(inv);
          }}
        />

        {/* Dynamic New Sales Invoice Modal */}
        <NewSalesInvoiceModal
          open={showNewInvoiceModal}
          onClose={() => setShowNewInvoiceModal(false)}
          onInvoiceCreated={() => {
            void loadInvoices();
          }}
        />

        {/* Clinical Workspace Modal for Editing Invoice & Line Items */}
        {editingVisit && (
          <VisitWorkspaceModal
            open={showWorkspaceModal}
            onClose={() => {
              setShowWorkspaceModal(false);
              setEditingVisit(null);
            }}
            visit={editingVisit}
            onVisitFinalized={() => {
              void loadInvoices();
            }}
          />
        )}

        {/* Partial / Combined Payment Modal */}
        <PartialPaymentModal
          open={showPartialPayment}
          onClose={() => setShowPartialPayment(false)}
          prefilledOwnerId={partialPayOwnerId || undefined}
          prefilledOwnerName={partialPayOwnerName || undefined}
          prefilledInvoiceNo={partialPayInvoiceNo}
          onPaymentRecorded={() => {
            void loadInvoices();
            setShowPartialPayment(false);
          }}
        />
      </div>
    </Shell>
  );
}

export function PatientBillingHub() {
  return (
    <InventoryProvider>
      <PatientBillingHubInner />
    </InventoryProvider>
  );
}
