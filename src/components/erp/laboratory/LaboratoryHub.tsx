import { useState, useEffect, useMemo } from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  TestTube2,
  FileCheck,
  Search,
  Plus,
  RotateCcw,
  Download,
  Clock,
  User,
  Dog,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Sparkles,
  Layers,
  Activity,
  QrCode,
  SlidersHorizontal,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CreateLabOrderModal } from "./CreateLabOrderModal";
import { EnterLabResultsModal } from "./EnterLabResultsModal";
import { LabReportPrintModal } from "./LabReportPrintModal";
import { TestMasterCatalog } from "./TestMasterCatalog";
import { SampleTracking } from "./SampleTracking";
import { LabAnalytics } from "./LabAnalytics";
import { listLabOrdersFn, createLabOrderFn, updateLabResultsFn } from "@/lib/mongodb/serverFns/laboratory";
import { cn } from "@/lib/utils";

type LabTab = "orders" | "catalog" | "samples" | "analytics";

export function LaboratoryHub() {
  const [activeTab, setActiveTab] = useState<LabTab>("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listLabOrdersFn();
      // Map orderId to order for compatibility
      const mapped = (data || []).map((d: any) => ({
        ...d,
        order: d.orderId || d.order,
        test: d.testName || d.test,
      }));
      setOrders(mapped);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load diagnostic lab orders");
    } finally {
      setLoading(false);
    }
  };


  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const q = query.toLowerCase().trim();
    return orders.filter((o) => {
      const matchQ =
        !q ||
        o.order?.toLowerCase().includes(q) ||
        o.pet?.toLowerCase().includes(q) ||
        o.petId?.toLowerCase().includes(q) ||
        o.test?.toLowerCase().includes(q) ||
        o.owner?.toLowerCase().includes(q) ||
        o.doctor?.toLowerCase().includes(q);

      const matchS =
        statusFilter === "all" ||
        o.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchP =
        priorityFilter === "all" ||
        o.priority?.toLowerCase() === priorityFilter.toLowerCase();

      return matchQ && matchS && matchP;
    });
  }, [orders, query, statusFilter, priorityFilter]);

  const handleReset = () => {
    void loadData();
    setQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    toast.success("Laboratory data reloaded from MongoDB");
  };


  const handleOpenResults = (order: any) => {
    setSelectedOrder(order);
    setShowResultsModal(true);
  };

  const handleOpenPrint = (order: any) => {
    setSelectedOrder(order);
    setShowPrintModal(true);
  };

  const handleSaveResults = (updated: any) => {
    setOrders((prev) =>
      prev.map((o) => (o.order === updated.order ? updated : o))
    );
  };

  const exportCsv = () => {
    const header = "Order,Pet,Patient ID,Owner,Doctor,Test,Sample,Collected At,Priority,Status";
    const body = filteredOrders
      .map(
        (o) =>
          `"${o.order}","${o.pet}","${o.petId || ""}","${o.owner}","${o.doctor}","${o.test}","${o.sample}","${o.collected}","${o.priority}","${o.status}"`
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laboratory_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Laboratory orders CSV exported");
  };

  return (
    <Shell title="Laboratory &amp; Diagnostics">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-xs">
              <FlaskConical className="size-6" />
            </span>
            <div>
              <h1 className="page-title text-xl font-bold text-foreground">Laboratory &amp; Diagnostics</h1>
              <p className="text-xs text-muted-foreground">Orders, sample tracking, reference profiles, and digital diagnostic reports</p>
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
              onClick={() => setShowCreateModal(true)}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> + Create Lab Order
            </Button>
          </div>
        </div>

        {/* Top 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={{ label: "PENDING REPORTS", value: "8", trend: "2 urgent STAT", trendTone: "down" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "ORDERS TODAY", value: "14", trend: "+3 vs yesterday", trendTone: "up" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "SAMPLES IN PROCESS", value: "6", trend: "Mindray & Fuji", trendTone: "flat" }}
            index={2}
          />
          <KpiCard
            kpi={{ label: "AVG. TURNAROUND (TAT)", value: "4.2 hrs", trend: "-40 min", trendTone: "up" }}
            index={3}
          />
        </div>

        {/* Multi-Tab Navigation Bar (Matching InventoryHub style) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab("orders")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "orders"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <FlaskConical className="size-4" /> Diagnostic Orders Queue
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full", activeTab === "orders" ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground")}>
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "catalog"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <TestTube2 className="size-4" /> Test Master &amp; Profiles
          </button>

          <button
            onClick={() => setActiveTab("samples")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "samples"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <QrCode className="size-4" /> Sample Tracking &amp; Barcodes
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "analytics"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Activity className="size-4" /> Equipment &amp; Calibration
          </button>
        </div>

        {/* ── TAB 1: DIAGNOSTIC ORDERS QUEUE ─────────────────────────────────── */}
        {activeTab === "orders" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="erp-card overflow-hidden shadow-xs space-y-0"
          >
            {/* Search and Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by order ID, pet name, test, owner, or doctor..."
                  className="pl-9 text-xs h-9"
                />
              </div>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px] text-xs h-9">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Urgent STAT">🔴 Urgent STAT</SelectItem>
                  <SelectItem value="Routine">🟢 Routine</SelectItem>
                  <SelectItem value="Pre-Op">🟡 Pre-Op</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] text-xs h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In process">In Process</SelectItem>
                  <SelectItem value="In transit">In Transit</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="Reported">Reported</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground font-medium">
                {filteredOrders.length} of {orders.length} orders
              </span>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3">ORDER</th>
                    <th className="px-4 py-3">PET</th>
                    <th className="px-4 py-3">TEST / PANEL</th>
                    <th className="px-4 py-3">SAMPLE SPECIMEN</th>
                    <th className="px-4 py-3">ORDERING DOCTOR</th>
                    <th className="px-4 py-3">COLLECTED</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((row) => (
                    <tr key={row.order} className="hover:bg-primary-soft/30 transition-colors">
                      {/* Order ID */}
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        <span className="bg-muted px-2 py-1 rounded text-xs border border-border">
                          {row.order}
                        </span>
                      </td>

                      {/* Pet */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>{row.species === "Feline" ? "🐱" : row.species === "Avian" ? "🦜" : "🐶"}</span>
                          <span>{row.pet}</span>
                          {row.petId && (
                            <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                              {row.petId}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{row.owner}</p>
                      </td>

                      {/* Test */}
                      <td className="px-4 py-3 font-semibold text-foreground max-w-[220px]">
                        <p className="truncate">{row.test}</p>
                        {row.priority === "Urgent STAT" && (
                          <Badge className="bg-red-500 text-white text-[9px] py-0 mt-0.5">STAT EMERGENCY</Badge>
                        )}
                      </td>

                      {/* Sample */}
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="bg-muted px-2 py-0.5 rounded text-[11px]">
                          {row.sample}
                        </span>
                      </td>

                      {/* Doctor */}
                      <td className="px-4 py-3 text-foreground">{row.doctor}</td>

                      {/* Collected */}
                      <td className="px-4 py-3 font-mono text-muted-foreground">{row.collected}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill value={row.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.status !== "Reported" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenResults(row)}
                              className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                            >
                              <FileCheck className="size-3" /> Enter Results
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPrint(row)}
                              className="h-7 text-[11px] font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white gap-1"
                            >
                              <Printer className="size-3" /> View Report
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        No laboratory orders match your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── TAB 2: TEST MASTER & PROFILES ──────────────────────────────────── */}
        {activeTab === "catalog" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <TestMasterCatalog />
          </motion.div>
        )}

        {/* ── TAB 3: SAMPLE TRACKING & BARCODES ───────────────────────────────── */}
        {activeTab === "samples" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <SampleTracking />
          </motion.div>
        )}

        {/* ── TAB 4: EQUIPMENT & CALIBRATION ─────────────────────────────────── */}
        {activeTab === "analytics" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LabAnalytics />
          </motion.div>
        )}

        {/* Modals */}
        <CreateLabOrderModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onOrderCreated={(newOrder) => setOrders((prev) => [newOrder, ...prev])}
        />

        <EnterLabResultsModal
          open={showResultsModal}
          onClose={() => {
            setShowResultsModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
          onResultsSaved={handleSaveResults}
        />

        <LabReportPrintModal
          open={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      </div>
    </Shell>
  );
}
