import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  Plus,
  RotateCcw,
  Download,
  Calendar,
  Eye,
  Printer,
  ShieldCheck,
  Activity,
  Sparkles,
  UploadCloud,
  FolderOpen,
  Dog,
  User,
  Users,
  FlaskConical,
  Layers,
  CheckCircle2,
  Clock,
  Trash2,
  BarChart3,
  LayoutDashboard,
  DollarSign,
  CreditCard,
  Package,
  Stethoscope,
  Link2,
  Loader2,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ViewReportModal } from "./ViewReportModal";
import { UploadDocumentModal } from "./UploadDocumentModal";
import { PatientSpecificDossier } from "./PatientSpecificDossier";
import { UploadedDocumentsView } from "./UploadedDocumentsView";
import { listClinicalReportsFn, deleteClinicalReportFn } from "@/lib/mongodb/serverFns/reports";
import { getCentralAnalyticsFn, type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { cn } from "@/lib/utils";

// Analytics Sub-Components
import { type AnalyticsTabId, type DrilldownTarget } from "./analytics/analyticsTypes";
import { AnalyticsFilterBar } from "./analytics/AnalyticsFilterBar";
import { InsightsBanner } from "./analytics/InsightsBanner";
import { DrilldownDetailModal } from "./analytics/DrilldownDetailModal";
import { exportAnalyticsCsv } from "./analytics/analyticsExport";
import { AnalyticsOverviewTab } from "./analytics/AnalyticsOverviewTab";
import { PetAnalyticsTab } from "./analytics/PetAnalyticsTab";
import { ClientAnalyticsTab } from "./analytics/ClientAnalyticsTab";
import { AppointmentAnalyticsTab } from "./analytics/AppointmentAnalyticsTab";
import { BillingRevenueTab } from "./analytics/BillingRevenueTab";
import { PaymentAnalysisTab } from "./analytics/PaymentAnalysisTab";
import { LaboratoryAnalyticsTab } from "./analytics/LaboratoryAnalyticsTab";
import { InventoryAnalyticsTab } from "./analytics/InventoryAnalyticsTab";
import { ClinicalAnalyticsTab } from "./analytics/ClinicalAnalyticsTab";
import { CrossModuleDrilldownTab } from "./analytics/CrossModuleDrilldownTab";
import { QuotationsRegisterView } from "./QuotationsRegisterView";
import { QuotationModal } from "@/components/erp/billing/QuotationModal";

type HubMode = "analytics" | "medical-records";
type ReportsTab = "all-reports" | "patient-dossier" | "upload-documents" | "quotations";

const ANALYTICS_TABS: { id: AnalyticsTabId; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pets", label: "Pets", icon: Dog },
  { id: "clients", label: "Clients", icon: Users },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "billing", label: "Billing & Revenue", icon: DollarSign },
  { id: "payments", label: "Payment Analysis", icon: CreditCard },
  { id: "laboratory", label: "Laboratory", icon: FlaskConical },
  { id: "inventory", label: "Inventory & Stock", icon: Package },
  { id: "clinical", label: "Clinical Records", icon: Stethoscope },
  { id: "cross-module", label: "Cross-Module Audit", icon: Link2 },
];

export function ClinicalReportsHub() {
  // Top-Level Mode: Analytics vs Medical Records
  const [hubMode, setHubMode] = useState<HubMode>("analytics");

  // ── ANALYTICS STATE ──────────────────────────────────────────────────────────
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTabId>("overview");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [dateRange, setDateRange] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState("all");
  const [drilldownTarget, setDrilldownTarget] = useState<DrilldownTarget | null>(null);

  // ── CLINICAL REPORTS STATE (100% Preserved) ──────────────────────────────────
  const [activeTab, setActiveTab] = useState<ReportsTab>("all-reports");
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Fetch Analytics Data
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const resp = await getCentralAnalyticsFn({
        data: {
          dateRange,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          doctor: doctorFilter !== "all" ? doctorFilter : undefined,
          category: analyticsCategoryFilter !== "all" ? analyticsCategoryFilter : undefined,
        },
      });
      setAnalyticsData(resp);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load central analytics data");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [dateRange, startDate, endDate, doctorFilter, analyticsCategoryFilter]);

  // Fetch Existing Reports
  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await listClinicalReportsFn();
      setReports(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load clinical reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    void loadReports();
  }, []);

  const handleCustomDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleExportCsv = () => {
    if (!analyticsData) {
      toast.error("No analytics data available to export");
      return;
    }
    exportAnalyticsCsv(analyticsTab, analyticsData);
  };

  // Filtered reports for the Medical Records section
  const filteredReports = useMemo(() => {
    const q = query.toLowerCase().trim();
    return reports.filter((r) => {
      const matchCat = categoryFilter === "all" || r.category?.toLowerCase() === categoryFilter.toLowerCase();
      const matchStatus = statusFilter === "all" || r.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchQ =
        !q ||
        r.reportId?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.pet?.toLowerCase().includes(q) ||
        r.petId?.toLowerCase().includes(q) ||
        r.owner?.toLowerCase().includes(q) ||
        r.doctor?.toLowerCase().includes(q);

      return matchCat && matchStatus && matchQ;
    });
  }, [reports, query, categoryFilter, statusFilter]);

  const handleOpenView = (report: any) => {
    setSelectedReport(report);
    setShowViewModal(true);
  };

  const handleDeleteReport = async (report: any) => {
    if (!window.confirm(`Are you sure you want to delete clinical report ${report.reportId} (${report.title})?`)) {
      return;
    }
    try {
      await deleteClinicalReportFn({ data: { reportId: report.reportId } });
      toast.success(`Deleted report ${report.reportId}`);
      setReports((prev) => prev.filter((r) => r.reportId !== report.reportId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete report");
    }
  };

  const handleResetReports = () => {
    void loadReports();
    setQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    toast.success("Reports list reloaded from MongoDB");
  };

  const exportClinicalArchiveCsv = () => {
    const header = "Report ID,Title,Category,Pet,Patient ID,Owner,Doctor,Date,Status";
    const body = filteredReports
      .map(
        (r) =>
          `"${r.reportId}","${r.title}","${r.category}","${r.pet}","${r.petId}","${r.owner}","${r.doctor}","${r.date}","${r.status}"`
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinical_reports_archive_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Clinical reports archive CSV exported");
  };

  return (
    <Shell title="Reports & Analytics Central Hub">
      <div className="mx-auto max-w-[1550px] space-y-6">
        {/* Top Header & Master Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-xs">
              {hubMode === "analytics" ? <BarChart3 className="size-6" /> : <FileText className="size-6" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="page-title text-xl font-bold text-foreground">
                  {hubMode === "analytics"
                    ? "Executive Analytics & Performance Intelligence"
                    : "Clinical Reports & Diagnostic Archive"}
                </h1>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                  Single Source of Truth
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {hubMode === "analytics"
                  ? "Consolidated cross-module metrics across Pets, Clients, Appointments, Revenue, Laboratory, and Inventory"
                  : "Central medical record repository, patient-specific dossiers, and external document ingestion"}
              </p>
            </div>
          </div>

          {/* Master View Mode Switcher */}
          <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border">
            <button
              onClick={() => setHubMode("analytics")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                hubMode === "analytics"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="size-4" />
              Analytics Dashboard
            </button>
            <button
              onClick={() => setHubMode("medical-records")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                hubMode === "medical-records"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="size-4" />
              Medical Reports &amp; Records
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted-foreground/20">
                {reports.length}
              </span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* MODE 1: CONSOLIDATED ANALYTICS DASHBOARD                              */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {hubMode === "analytics" && (
          <div className="space-y-5">
            {/* Global Date Range & Contextual Filter Bar */}
            <AnalyticsFilterBar
              activeTab={analyticsTab}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              startDate={startDate}
              endDate={endDate}
              onCustomDatesChange={handleCustomDateChange}
              doctorFilter={doctorFilter}
              onDoctorFilterChange={setDoctorFilter}
              categoryFilter={analyticsCategoryFilter}
              onCategoryFilterChange={setAnalyticsCategoryFilter}
              onReset={loadAnalytics}
              dateRangeLabel={analyticsData?.dateRangeLabel ?? "All Time"}
              onExportCsv={handleExportCsv}
            />

            {/* Dynamic Rule Evaluation Insights Banner */}
            {analyticsData?.insights && analyticsData.insights.length > 0 && (
              <InsightsBanner insights={analyticsData.insights} />
            )}

            {/* 10 Specialized Analytics Sub-Tabs */}
            <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto scrollbar-none">
              {ANALYTICS_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = analyticsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAnalyticsTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Analytics Sub-Tab Content */}
            {analyticsLoading ? (
              <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-xs font-medium">Aggregating live ERP records from MongoDB...</p>
              </div>
            ) : !analyticsData ? (
              <div className="erp-card p-12 text-center space-y-3">
                <p className="text-sm font-semibold text-foreground">No data available for the selected period</p>
                <p className="text-xs text-muted-foreground">
                  Try broadening the date filter or resetting custom criteria.
                </p>
                <Button size="sm" variant="outline" onClick={loadAnalytics}>
                  <RotateCcw className="size-3.5 mr-1" /> Retry Query
                </Button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={analyticsTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {analyticsTab === "overview" && (
                    <AnalyticsOverviewTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "pets" && (
                    <PetAnalyticsTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "clients" && (
                    <ClientAnalyticsTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "appointments" && (
                    <AppointmentAnalyticsTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "billing" && (
                    <BillingRevenueTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "payments" && (
                    <PaymentAnalysisTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "laboratory" && (
                    <LaboratoryAnalyticsTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "inventory" && (
                    <InventoryAnalyticsTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "clinical" && (
                    <ClinicalAnalyticsTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                  {analyticsTab === "cross-module" && (
                    <CrossModuleDrilldownTab data={analyticsData} onDrilldown={setDrilldownTarget} />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* MODE 2: MEDICAL RECORDS & CLINICAL REPORTS ARCHIVE (100% INTACT)     */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {hubMode === "medical-records" && (
          <div className="space-y-6">
            {/* Header Action Toolbar for Medical Records */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
              <div className="text-xs text-muted-foreground">
                Managing <span className="font-bold text-foreground">{reports.length}</span> medical encounters &amp; patient dossiers
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResetReports} className="gap-1.5 text-xs font-semibold h-9">
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
                <Button variant="outline" size="sm" onClick={exportClinicalArchiveCsv} className="gap-1.5 text-xs font-semibold h-9">
                  <Download className="size-3.5" /> Export Archive
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowUploadModal(true)}
                  className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  <UploadCloud className="size-4" /> + Upload External Report
                </Button>
              </div>
            </div>

            {/* Top 4 KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                kpi={{ label: "TOTAL CLINICAL REPORTS", value: reports.length.toString(), trend: "Direct documents", trendTone: "up" }}
                index={0}
              />
              <KpiCard
                kpi={{
                  label: "VERIFIED & SIGNED",
                  value: reports.filter((r) => r.status === "Verified & Signed").length.toString(),
                  trend: "Complete records",
                  trendTone: "up",
                }}
                index={1}
              />
              <KpiCard
                kpi={{
                  label: "PENDING DOCTOR REVIEW",
                  value: reports.filter((r) => r.status === "Pending Review").length.toString(),
                  trend: "Action required",
                  trendTone: "down",
                }}
                index={2}
              />
              <KpiCard
                kpi={{
                  label: "EXTERNAL UPLOADS",
                  value: reports.filter((r) => r.category === "Uploaded External" || r.isUploaded).length.toString(),
                  trend: "PDF / DICOM",
                  trendTone: "up",
                }}
                index={3}
              />
            </div>

            {/* 3 Master Tabs for Clinical Records */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
              <button
                onClick={() => setActiveTab("all-reports")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
                  activeTab === "all-reports"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <FileText className="size-4" /> All Reports Master Archive
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    activeTab === "all-reports" ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {reports.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("patient-dossier")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
                  activeTab === "patient-dossier"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Dog className="size-4" /> Patient-Specific Medical Dossier
              </button>

              <button
                onClick={() => setActiveTab("upload-documents")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
                  activeTab === "upload-documents"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <UploadCloud className="size-4" /> Document Ingestion &amp; Uploads
              </button>

              <button
                onClick={() => setActiveTab("quotations")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
                  activeTab === "quotations"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <FileText className="size-4" /> Medical Quotations &amp; Estimates
              </button>
            </div>

            {/* ── SUB-TAB 1: ALL REPORTS MASTER ARCHIVE ──────────────────────── */}
            {activeTab === "all-reports" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="erp-card overflow-hidden shadow-xs space-y-0"
              >
                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
                  <div className="relative min-w-[240px] flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search across all reports by ID, test name, pet, owner, or clinician..."
                      className="pl-9 text-xs h-9"
                    />
                  </div>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px] text-xs h-9">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="laboratory">🔬 Laboratory</SelectItem>
                      <SelectItem value="radiology & imaging">🩻 Radiology &amp; Imaging</SelectItem>
                      <SelectItem value="surgical & ot">🔪 Surgical &amp; OT</SelectItem>
                      <SelectItem value="rehab & nutrition">🏊 Rehab &amp; Nutrition</SelectItem>
                      <SelectItem value="uploaded external">📁 Uploaded External</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px] text-xs h-9">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Verified & Signed">Verified &amp; Signed</SelectItem>
                      <SelectItem value="Pending Review">Pending Review</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="text-xs text-muted-foreground font-medium">
                    {filteredReports.length} of {reports.length} reports
                  </span>
                </div>

                {/* Reports Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                        <th className="px-4 py-3">REPORT ID</th>
                        <th className="px-4 py-3">INVESTIGATION / PROCEDURE TITLE</th>
                        <th className="px-4 py-3">CATEGORY</th>
                        <th className="px-4 py-3">PATIENT &amp; OWNER</th>
                        <th className="px-4 py-3">DOCTOR / FACILITY</th>
                        <th className="px-4 py-3">DATE</th>
                        <th className="px-4 py-3">STATUS</th>
                        <th className="px-4 py-3 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredReports.map((r) => (
                        <tr key={r.reportId} className="hover:bg-primary-soft/30 transition-colors">
                          {/* ID */}
                          <td className="px-4 py-3 font-mono font-bold text-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                              {r.reportId}
                            </span>
                          </td>

                          {/* Title */}
                          <td className="px-4 py-3">
                            <p className="font-bold text-foreground">{r.title}</p>
                            {r.impression && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                Impression: {r.impression}
                              </p>
                            )}
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold py-0",
                                r.category === "Laboratory"
                                  ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
                                  : r.category === "Radiology & Imaging"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                  : r.category === "Surgical & OT"
                                  ? "bg-red-500/10 text-red-700 border-red-500/20"
                                  : r.category === "Uploaded External"
                                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                  : "bg-primary/10 text-primary border-primary/20"
                              )}
                            >
                              {r.category}
                            </Badge>
                          </td>

                          {/* Patient & Owner */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 font-bold text-foreground">
                              <span>{r.species === "Feline" ? "🐱" : "🐶"}</span>
                              <span>{r.pet}</span>
                              {r.petId && (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20"
                                >
                                  {r.petId}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{r.owner}</p>
                          </td>

                          {/* Doctor */}
                          <td className="px-4 py-3 text-foreground">{r.doctor || r.facility}</td>

                          {/* Date */}
                          <td className="px-4 py-3 font-mono text-muted-foreground">{r.date}</td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              {r.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenView(r)}
                                className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                              >
                                <Eye className="size-3" /> View Report
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteReport(r)}
                                className="h-7 text-[11px] font-bold text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground gap-1"
                              >
                                <Trash2 className="size-3" /> Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredReports.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                            No clinical reports match your filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* ── SUB-TAB 2: PATIENT-SPECIFIC MEDICAL DOSSIER ─────────────────── */}
            {activeTab === "patient-dossier" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <PatientSpecificDossier
                  reports={reports}
                  onViewReport={handleOpenView}
                  onUploadDoc={() => setShowUploadModal(true)}
                />
              </motion.div>
            )}

            {/* ── SUB-TAB 3: UPLOADED EXTERNAL DOCUMENTS STATION ───────────────── */}
            {activeTab === "upload-documents" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <UploadedDocumentsView
                  documents={reports.filter((r) => r.category === "Uploaded External" || r.isUploaded)}
                  onViewDoc={handleOpenView}
                  onUploadDoc={() => setShowUploadModal(true)}
                  onDeleteDoc={(id) => {
                    setReports((prev) => prev.filter((r) => r.reportId !== id));
                    toast.success("Uploaded document removed");
                  }}
                />
              </motion.div>
            )}

            {/* ── SUB-TAB 4: MEDICAL QUOTATIONS & COST ESTIMATES ─────────────── */}
            {activeTab === "quotations" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <QuotationsRegisterView
                  onNewQuotation={() => setShowQuotationModal(true)}
                  onViewQuotation={(q) => {
                    // Open clean printable quotation preview
                    window.print();
                  }}
                />
              </motion.div>
            )}
          </div>
        )}

        {/* Modals */}
        <ViewReportModal
          open={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedReport(null);
          }}
          report={selectedReport}
        />

        <UploadDocumentModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploaded={(newDoc) => setReports((prev) => [newDoc, ...prev])}
        />

        <QuotationModal
          open={showQuotationModal}
          onClose={() => setShowQuotationModal(false)}
        />

        {/* Drilldown Detail Modal */}
        <DrilldownDetailModal
          target={drilldownTarget}
          onClose={() => setDrilldownTarget(null)}
        />
      </div>
    </Shell>
  );
}
