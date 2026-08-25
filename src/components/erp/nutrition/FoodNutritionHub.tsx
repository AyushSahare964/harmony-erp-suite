import { useState, useEffect, useMemo } from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bone,
  Search,
  Plus,
  RotateCcw,
  Download,
  Calendar,
  User,
  Dog,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Printer,
  Sparkles,
  Package,
  Clock,
  Trash2,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { NewFeedingPlanModal } from "./NewFeedingPlanModal";
import { DietChartPrintModal } from "./DietChartPrintModal";
import { CalorieCalculatorPanel } from "./CalorieCalculatorPanel";
import { TherapeuticDietCatalog } from "./TherapeuticDietCatalog";
import { listFeedingPlansFn, createFeedingPlanFn, deleteFeedingPlanFn } from "@/lib/mongodb/serverFns/nutrition";
import { cn } from "@/lib/utils";

type NutritionTab = "plans" | "calculator" | "stock";

export function FoodNutritionHub() {
  const [activeTab, setActiveTab] = useState<NutritionTab>("plans");
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  useEffect(() => {
    void loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await listFeedingPlansFn();
      setPlans(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load feeding plans");
    } finally {
      setLoading(false);
    }
  };


  const filteredPlans = useMemo(() => {
    const q = query.toLowerCase().trim();
    return plans.filter((p) => {
      const matchQ =
        !q ||
        p.plan.toLowerCase().includes(q) ||
        p.pet.toLowerCase().includes(q) ||
        p.petId?.toLowerCase().includes(q) ||
        p.diet.toLowerCase().includes(q) ||
        p.owner?.toLowerCase().includes(q);

      const matchS =
        statusFilter === "all" ||
        p.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchQ && matchS;
    });
  }, [plans, query, statusFilter]);

  const handleReset = () => {
    void loadPlans();
    setQuery("");
    setStatusFilter("all");
    toast.success("Feeding plans reloaded from MongoDB");
  };

  const handleOpenPrint = (plan: any) => {
    setSelectedPlan(plan);
    setShowPrintModal(true);
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await deleteFeedingPlanFn({ data: { plan: planId } });
      setPlans((prev) => prev.filter((p) => p.plan !== planId));
      toast.success(`Plan ${planId} deleted from database`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete plan");
    }
  };


  const exportCsv = () => {
    const header = "Plan,Pet,Patient ID,Diet,Daily Quantity (g),Next Review,Status";
    const body = filteredPlans
      .map((p) => `"${p.plan}","${p.pet}","${p.petId || ""}","${p.diet}","${p.qtyPerDay}","${p.nextReview}","${p.status}"`)
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feeding_nutrition_plans_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Feeding plans CSV exported");
  };

  return (
    <Shell title="Food &amp; Nutrition">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Header Bar matching Screenshot */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-xs">
              <Bone className="size-6" />
            </span>
            <div>
              <h1 className="page-title text-xl font-bold text-foreground">Food &amp; Nutrition</h1>
              <p className="text-xs text-muted-foreground">Feeding plans, prescription diets, and caloric calculations</p>
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
              onClick={() => setShowNewPlanModal(true)}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> + New Feeding Plan
            </Button>
          </div>
        </div>

        {/* Top 4 KPI Cards (Exact Screenshot Match) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={{ label: "REORDER DUE", value: "5", trend: "3 critical", trendTone: "down" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "ACTIVE FEEDING PLANS", value: "142", trend: "+8", trendTone: "up" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "FOOD SALES MTD", value: "₹2.7L", trend: "+6%", trendTone: "up" }}
            index={2}
          />
          <KpiCard
            kpi={{ label: "DIET REVIEWS DUE", value: "12", trend: "this week", trendTone: "flat" }}
            index={3}
          />
        </div>

        {/* Multi-Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab("plans")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "plans"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Bone className="size-4" /> Clinical Feeding Plans
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full", activeTab === "plans" ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground")}>
              {plans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("calculator")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "calculator"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Calculator className="size-4" /> Calorie &amp; RER Calculator
          </button>

          <button
            onClick={() => setActiveTab("stock")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "stock"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Package className="size-4" /> Prescription Diets Stock
          </button>
        </div>

        {/* ── TAB 1: CLINICAL FEEDING PLANS TABLE (Screenshot Match) ─────────── */}
        {activeTab === "plans" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="erp-card overflow-hidden shadow-xs space-y-0"
          >
            {/* Search and Status Dropdown */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search records by pet, plan ID, diet type, or owner..."
                  className="pl-9 text-xs h-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] text-xs h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Review due">Review due</SelectItem>
                  <SelectItem value="Paused">Paused</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground font-medium">
                {filteredPlans.length} of {plans.length} records
              </span>
            </div>

            {/* Table (Screenshot Columns: PLAN, PET, DIET, QTY/DAY (G), NEXT REVIEW, STATUS) */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3">PLAN</th>
                    <th className="px-4 py-3">PET</th>
                    <th className="px-4 py-3">DIET</th>
                    <th className="px-4 py-3 text-center">QTY/DAY (G)</th>
                    <th className="px-4 py-3">NEXT REVIEW</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPlans.map((row) => (
                    <tr key={row.plan} className="hover:bg-primary-soft/30 transition-colors">
                      {/* Plan */}
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                          {row.plan}
                        </span>
                      </td>

                      {/* Pet */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>{row.species === "Feline" ? "🐱" : "🐶"}</span>
                          <span>{row.pet}</span>
                          {row.petId && (
                            <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                              {row.petId}
                            </Badge>
                          )}
                        </div>
                        {row.owner && (
                          <p className="text-[10px] text-muted-foreground">{row.owner}</p>
                        )}
                      </td>

                      {/* Diet */}
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <span className="bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded font-medium text-[11px]">
                          {row.diet}
                        </span>
                      </td>

                      {/* Qty/Day */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                        {row.qtyPerDay}
                      </td>

                      {/* Next Review */}
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {row.nextReview}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill value={row.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPrint(row)}
                            className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                          >
                            <Printer className="size-3" /> Chart
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlan(row.plan)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredPlans.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                        No feeding plans found matching your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── TAB 2: CALORIE & RER CALCULATOR ────────────────────────────────── */}
        {activeTab === "calculator" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <CalorieCalculatorPanel />
          </motion.div>
        )}

        {/* ── TAB 3: THERAPEUTIC DIETS STOCK ─────────────────────────────────── */}
        {activeTab === "stock" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <TherapeuticDietCatalog />
          </motion.div>
        )}

        {/* Modals */}
        <NewFeedingPlanModal
          open={showNewPlanModal}
          onClose={() => setShowNewPlanModal(false)}
          onPlanCreated={(newPlan) => setPlans((prev) => [newPlan, ...prev])}
        />

        <DietChartPrintModal
          open={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setSelectedPlan(null);
          }}
          plan={selectedPlan}
        />
      </div>
    </Shell>
  );
}
