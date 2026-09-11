import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  PawPrint,
  Search,
  Phone,
  Eye,
  Stethoscope,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  UserPlus,
  Filter,
  Calendar,
  X,
  HeartPulse,
  ShieldAlert,
  User,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Package,
  Pill,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

interface InventoryAlerts {
  lowStock: any[];
  outOfStock: any[];
  expiringSoon: any[];
}

interface DashboardPatientActivityPanelProps {
  visits: any[];
  onStartConsultation: (visit: any) => void;
  onAdmitPet?: ((pet: any) => void) | undefined;
  onOpenRegisterModal?: (() => void) | undefined;
  className?: string | undefined;
  inventoryAlerts?: InventoryAlerts | undefined;
}

export function DashboardPatientActivityPanel({
  visits,
  onStartConsultation,
  onAdmitPet,
  onOpenRegisterModal,
  className,
  inventoryAlerts,
}: DashboardPatientActivityPanelProps) {
  const [pets, setPets] = useState<any[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<"ALL" | "Canine" | "Feline" | "IN_OPD">("ALL");
  const [activeActivityTab, setActiveActivityTab] = useState<"FEED" | "ALERTS">("FEED");
  const [selectedPetForDetail, setSelectedPetForDetail] = useState<any | null>(null);

  // Load pets on mount
  useEffect(() => {
    void loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoadingPets(true);
    try {
      const data = await listPetsWithOwnersFn();
      setPets(data || []);
    } catch (err) {
      console.warn("Could not load patients for dashboard right panel:", err);
    } finally {
      setLoadingPets(false);
    }
  };

  // Set of pet IDs currently active in OPD
  const activeOpdPetIds = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) {
      if (
        v.petId &&
        v.status !== "Paid" &&
        v.status !== "Settled" &&
        v.status !== "Completed"
      ) {
        set.add(v.petId);
      }
    }
    return set;
  }, [visits]);

  // Live Metrics Calculations
  const metrics = useMemo(() => {
    const totalVisits = visits.length;
    const inQueue = visits.filter(
      (v) =>
        v.status === "Admitted" ||
        v.status === "In Consultation" ||
        v.status === "Waiting" ||
        v.status === "Ready"
    ).length;
    const inConsultation = visits.filter((v) => v.status === "In Consultation").length;
    const settled = visits.filter(
      (v) =>
        v.status === "Paid" ||
        v.status === "Settled" ||
        v.status === "Completed" ||
        (Number(v.totalAmount || 0) > 0 && Number(v.amountPaid || 0) >= Number(v.totalAmount || 0))
    ).length;

    return { totalVisits, inQueue, inConsultation, settled };
  }, [visits]);

  // Dynamic Recent Activity stream from visits
  const recentActivities = useMemo(() => {
    return visits.slice(0, 6).map((v) => {
      const isCompleted =
        v.status === "Paid" ||
        v.status === "Settled" ||
        v.status === "Completed" ||
        (Number(v.totalAmount || 0) > 0 && Number(v.amountPaid || 0) >= Number(v.totalAmount || 0));

      const isConsulting = v.status === "In Consultation";

      let statusColor = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      let statusLabel = v.status || "Admitted";

      if (isCompleted) {
        statusColor = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
        statusLabel = "Bill Settled";
      } else if (isConsulting) {
        statusColor = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
        statusLabel = "In Consultation";
      }

      return {
        visitId: v.visitId,
        petName: v.petName || "Patient",
        species: v.species || "Pet",
        breed: v.breed || "",
        statusLabel,
        statusColor,
        isCompleted,
        totalAmount: v.totalAmount,
        doctorName: v.doctorName || "Doctor",
        date: formatDisplayDate(v.date || v.createdAt) || v.date || "Today",
        complaint: v.vitals?.complaint || v.diagnosis || "OPD Visit",
        rawVisit: v,
      };
    });
  }, [visits]);

  // High-priority clinic alerts (Allergies + Vaccinations)
  const clinicAlerts = useMemo(() => {
    const alerts: Array<{ id: string; type: "ALLERGY" | "VACCINE"; title: string; subtitle: string; raw?: any }> = [];

    // Allergy alerts from visits
    visits.forEach((v) => {
      const hasAllergy =
        (Array.isArray(v.allergies) && v.allergies.length > 0) ||
        String(v.vitals?.complaint || "").toLowerCase().includes("allergy");
      if (hasAllergy) {
        alerts.push({
          id: `allergy-${v.visitId}`,
          type: "ALLERGY",
          title: `Allergy Alert: ${v.petName}`,
          subtitle: `${v.species} · ${Array.isArray(v.allergies) ? v.allergies.join(", ") : "Documented Drug Allergy"}`,
          raw: v,
        });
      }
    });

    // Vaccination due from pets
    pets.forEach((p) => {
      if (p.status === "Vaccination due") {
        alerts.push({
          id: `vacc-${p.petId}`,
          type: "VACCINE",
          title: `Vaccine Due: ${p.name} (${p.petId})`,
          subtitle: `${p.breed || p.species} · Parent: ${p.owner?.name || "Client"} (${p.owner?.phone || ""})`,
          raw: p,
        });
      }
    });

    return alerts.slice(0, 5);
  }, [visits, pets]);

  // Filtered Patients for Quick CRM Directory
  const filteredPets = useMemo(() => {
    let list = pets;

    if (speciesFilter === "Canine") {
      list = list.filter((p) => p.species?.toLowerCase() === "canine" || p.species?.toLowerCase() === "dog");
    } else if (speciesFilter === "Feline") {
      list = list.filter((p) => p.species?.toLowerCase() === "feline" || p.species?.toLowerCase() === "cat");
    } else if (speciesFilter === "IN_OPD") {
      list = list.filter((p) => activeOpdPetIds.has(p.petId));
    }

    if (!searchQuery.trim()) return list.slice(0, 15);

    const q = searchQuery.toLowerCase().trim();
    return list.filter((p) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        p.petId?.toLowerCase().includes(q) ||
        p.breed?.toLowerCase().includes(q) ||
        p.species?.toLowerCase().includes(q) ||
        p.owner?.name?.toLowerCase().includes(q) ||
        p.owner?.phone?.includes(q)
      );
    }).slice(0, 20);
  }, [pets, speciesFilter, searchQuery, activeOpdPetIds]);

  const handleSelectPet = (pet: any) => {
    setSelectedPetForDetail(pet);
  };

  const handleQuickAdmit = (e: React.MouseEvent, pet: any) => {
    e.stopPropagation();
    // If pet has active visit, start that consultation
    const activeVisit = visits.find(
      (v) =>
        v.petId === pet.petId &&
        v.status !== "Paid" &&
        v.status !== "Settled" &&
        v.status !== "Completed"
    );
    if (activeVisit) {
      onStartConsultation(activeVisit);
    } else if (onAdmitPet) {
      onAdmitPet(pet);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>

      {/* ── CRITICAL ALERTS CARD (admin only — shown when inventoryAlerts prop passed) ── */}
      {inventoryAlerts && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/70 bg-gradient-to-r from-destructive/5 to-amber-500/5">
            <AlertTriangle className="size-3.5 text-destructive" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Critical Alerts</span>
            {(inventoryAlerts.outOfStock.length + inventoryAlerts.lowStock.length + inventoryAlerts.expiringSoon.length) > 0 && (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {inventoryAlerts.outOfStock.length + inventoryAlerts.lowStock.length + inventoryAlerts.expiringSoon.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-border/50">
            {inventoryAlerts.outOfStock.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-2.5">
                <Package className="size-3.5 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-destructive">{inventoryAlerts.outOfStock.length} item{inventoryAlerts.outOfStock.length > 1 ? "s" : ""} out of stock</p>
                  <p className="text-muted-foreground text-[11px] truncate">{inventoryAlerts.outOfStock.slice(0, 2).map((i: any) => i.name).join(", ")}{inventoryAlerts.outOfStock.length > 2 ? " …" : ""}</p>
                </div>
              </div>
            )}
            {inventoryAlerts.lowStock.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-2.5">
                <AlertTriangle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">{inventoryAlerts.lowStock.length} item{inventoryAlerts.lowStock.length > 1 ? "s" : ""} below reorder level</p>
                  <p className="text-muted-foreground text-[11px] truncate">{inventoryAlerts.lowStock.slice(0, 2).map((i: any) => i.name).join(", ")}{inventoryAlerts.lowStock.length > 2 ? " …" : ""}</p>
                </div>
              </div>
            )}
            {inventoryAlerts.expiringSoon.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-2.5">
                <Pill className="size-3.5 text-orange-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-orange-600">{inventoryAlerts.expiringSoon.length} medicine{inventoryAlerts.expiringSoon.length > 1 ? "s" : ""} expiring within 30 days</p>
                  <p className="text-muted-foreground text-[11px] truncate">{inventoryAlerts.expiringSoon.slice(0, 2).map((i: any) => i.name).join(", ")}{inventoryAlerts.expiringSoon.length > 2 ? " …" : ""}</p>
                </div>
              </div>
            )}
            {inventoryAlerts.outOfStock.length === 0 && inventoryAlerts.lowStock.length === 0 && inventoryAlerts.expiringSoon.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                All stock levels are healthy
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CARD 1: LIVE CLINIC ACTIVITY MATRIX & STREAM ───────────────────────── */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-gradient-to-r from-muted/30 via-muted/10 to-primary/5">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="size-3.5 text-primary" /> Live Clinic Pulse
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => void loadPatients()}
              title="Refresh Clinic Pulse"
            >
              <RefreshCw className="size-3" />
            </Button>
          </div>
        </div>

        {/* Dynamic KPI Mini-Grid */}
        <div className="grid grid-cols-4 divide-x divide-border/60 border-b border-border/60 bg-muted/15 p-2 text-center">
          <div className="px-1 py-1">
            <p className="text-[10px] text-muted-foreground font-semibold truncate">Active Queue</p>
            <p className="text-base font-extrabold text-foreground font-mono">{metrics.inQueue}</p>
          </div>
          <div className="px-1 py-1">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate">Consulting</p>
            <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              {metrics.inConsultation}
            </p>
          </div>
          <div className="px-1 py-1">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">Settled</p>
            <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {metrics.settled}
            </p>
          </div>
          <div className="px-1 py-1">
            <p className="text-[10px] text-muted-foreground font-semibold truncate">Total Records</p>
            <p className="text-base font-extrabold text-foreground font-mono">{metrics.totalVisits}</p>
          </div>
        </div>

        {/* Activity Tab Selector */}
        <div className="flex items-center border-b border-border/60 px-3 pt-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveActivityTab("FEED")}
            className={cn(
              "pb-2 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 text-xs",
              activeActivityTab === "FEED"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="size-3" /> Realtime Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveActivityTab("ALERTS")}
            className={cn(
              "pb-2 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 text-xs",
              activeActivityTab === "ALERTS"
                ? "border-destructive text-destructive font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldAlert className="size-3" /> Clinic Alerts
            {clinicAlerts.length > 0 && (
              <span className="size-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                {clinicAlerts.length}
              </span>
            )}
          </button>
        </div>

        {/* Activity Feed / Alerts Content */}
        <div className="p-3 max-h-52 overflow-y-auto space-y-2 text-xs">
          {activeActivityTab === "FEED" && (
            <>
              {recentActivities.length === 0 && (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  <HeartPulse className="size-6 mx-auto opacity-30 mb-1" />
                  No recent clinic visit activity logged yet.
                </div>
              )}
              {recentActivities.map((act) => (
                <div
                  key={act.visitId}
                  onClick={() => onStartConsultation(act.rawVisit)}
                  className="group flex items-start justify-between gap-2 p-2 rounded-xl border border-border/50 bg-card hover:bg-muted/30 hover:border-primary/40 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs shrink-0 mt-0.5">
                      {act.species === "Feline" ? "🐱" : "🐶"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="font-bold text-foreground text-[11px] truncate group-hover:text-primary transition-colors">
                          {act.petName}
                        </strong>
                        <span className="font-mono text-[9px] text-muted-foreground">{act.visitId}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                        {act.complaint} · {act.doctorName}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", act.statusColor)}>
                      {act.statusLabel}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground font-mono">{act.date}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {activeActivityTab === "ALERTS" && (
            <>
              {clinicAlerts.length === 0 && (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  <CheckCircle2 className="size-6 mx-auto text-emerald-500 opacity-60 mb-1" />
                  All clear! No pending medical alerts or overdue vaccinations.
                </div>
              )}
              {clinicAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-2.5 rounded-xl border flex items-start gap-2.5 text-xs shadow-2xs transition-all",
                    alert.type === "ALLERGY"
                      ? "bg-destructive/5 border-destructive/20 text-destructive"
                      : "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300"
                  )}
                >
                  {alert.type === "ALLERGY" ? (
                    <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
                  ) : (
                    <Clock className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[11px] leading-tight text-foreground">{alert.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{alert.subtitle}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── CARD 2: QUICK PATIENT DIRECTORY & CRM FAST ACCESS ────────────────── */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden flex flex-col">
        {/* Card Header */}
        <div className="p-4 border-b border-border/70 space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                <PawPrint className="size-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Patient CRM Quick Info
                </h3>
                <p className="text-[10px] text-muted-foreground">Fast search &amp; profile access from Pet section</p>
              </div>
            </div>

            {onOpenRegisterModal && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenRegisterModal}
                className="h-7 text-[11px] font-bold gap-1 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
              >
                <UserPlus className="size-3" /> + New Pet
              </Button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pet name, breed, ID, owner..."
              className="h-8 pl-8 pr-7 text-xs bg-card"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <button
              type="button"
              onClick={() => setSpeciesFilter("ALL")}
              className={cn(
                "px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer",
                speciesFilter === "ALL"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              All ({pets.length})
            </button>
            <button
              type="button"
              onClick={() => setSpeciesFilter("Canine")}
              className={cn(
                "px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1",
                speciesFilter === "Canine"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              🐶 Dogs
            </button>
            <button
              type="button"
              onClick={() => setSpeciesFilter("Feline")}
              className={cn(
                "px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1",
                speciesFilter === "Feline"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              🐱 Cats
            </button>
            <button
              type="button"
              onClick={() => setSpeciesFilter("IN_OPD")}
              className={cn(
                "px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1",
                speciesFilter === "IN_OPD"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              )}
            >
              🏥 In OPD ({activeOpdPetIds.size})
            </button>
          </div>
        </div>

        {/* Patients List */}
        <div className="p-3 max-h-[380px] overflow-y-auto space-y-2">
          {loadingPets && (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
              <RefreshCw className="size-4 animate-spin mr-2 text-primary" /> Loading CRM patient records...
            </div>
          )}

          {!loadingPets && filteredPets.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
              <PawPrint className="size-7 mx-auto opacity-30 mb-1" />
              <p className="font-semibold text-foreground">No matching patients found</p>
              <p className="text-[11px]">Try adjusting your search query or filter chip.</p>
            </div>
          )}

          {!loadingPets &&
            filteredPets.map((p) => {
              const isCurrentlyInOpd = activeOpdPetIds.has(p.petId);

              return (
                <div
                  key={p.petId || p._id}
                  onClick={() => handleSelectPet(p)}
                  className={cn(
                    "group flex items-center justify-between p-2.5 rounded-xl border bg-card hover:bg-muted/30 hover:border-primary/40 transition-all cursor-pointer shadow-2xs",
                    isCurrentlyInOpd && "border-emerald-500/30 bg-emerald-500/5"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-sm shrink-0">
                      {p.species === "Feline" ? "🐱" : "🐶"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {p.name}
                        </strong>
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] px-1 py-0 bg-muted/60 text-muted-foreground"
                        >
                          {p.petId}
                        </Badge>
                        {isCurrentlyInOpd && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 animate-pulse">
                            <span className="size-1 rounded-full bg-emerald-500"></span> OPD Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {p.breed || p.species} · {p.owner?.name || "Client"}
                        {p.owner?.phone && ` (${p.owner.phone})`}
                      </p>
                    </div>
                  </div>

                  {/* Fast Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPet(p);
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Quick Patient Info Sheet"
                    >
                      <Eye className="size-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant={isCurrentlyInOpd ? "default" : "outline"}
                      onClick={(e) => handleQuickAdmit(e, p)}
                      className={cn(
                        "h-7 text-[10px] font-bold px-2 gap-1",
                        isCurrentlyInOpd
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
                      )}
                    >
                      <Stethoscope className="size-3" />
                      {isCurrentlyInOpd ? "Open OPD" : "Admit"}
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── MODAL: QUICK PATIENT DOSSIER & PROFILE SHEET ─────────────────────── */}
      {selectedPetForDetail && (
        <Dialog open={Boolean(selectedPetForDetail)} onOpenChange={() => setSelectedPetForDetail(null)}>
          <DialogContent className="max-w-md p-5 rounded-2xl">
            <DialogHeader className="border-b border-border pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold">
                    {selectedPetForDetail.species === "Feline" ? "🐱" : "🐶"}
                  </span>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      {selectedPetForDetail.name}
                      <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20">
                        {selectedPetForDetail.petId}
                      </Badge>
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedPetForDetail.breed} · {selectedPetForDetail.species}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold uppercase",
                    selectedPetForDetail.status === "Vaccination due"
                      ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                  )}
                >
                  {selectedPetForDetail.status || "Active Patient"}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-1 text-xs">
              {/* Vitals & Demographics Matrix */}
              <div className="grid grid-cols-4 gap-2 bg-muted/20 p-3 rounded-xl border border-border/60 text-center font-mono">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-sans">Age</span>
                  <strong className="text-foreground text-xs">
                    {selectedPetForDetail.ageYears !== undefined
                      ? `${selectedPetForDetail.ageYears} yrs`
                      : selectedPetForDetail.age
                      ? `${selectedPetForDetail.age} yrs`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block font-sans">Gender</span>
                  <strong className="text-foreground text-xs">{selectedPetForDetail.gender || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block font-sans">Weight</span>
                  <strong className="text-foreground text-xs">
                    {selectedPetForDetail.weightKg ? `${selectedPetForDetail.weightKg} kg` : "—"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block font-sans">Blood Group</span>
                  <strong className="text-foreground text-xs">{selectedPetForDetail.bloodGroup || "N/A"}</strong>
                </div>
              </div>

              {/* Allergy Alert Banner if any */}
              {((Array.isArray(selectedPetForDetail.allergies) && selectedPetForDetail.allergies.length > 0) ||
                selectedPetForDetail.allergies) && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 flex items-start gap-2 text-destructive">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[11px]">Known Clinical Allergies</p>
                    <p className="text-[10px] mt-0.5">
                      {Array.isArray(selectedPetForDetail.allergies)
                        ? selectedPetForDetail.allergies.join(", ")
                        : String(selectedPetForDetail.allergies)}
                    </p>
                  </div>
                </div>
              )}

              {/* Pet Parent / Owner Card */}
              <div className="rounded-xl border border-border p-3 space-y-1.5 bg-card shadow-2xs">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <User className="size-3.5 text-primary" /> Pet Parent Information
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {selectedPetForDetail.owner?.ownerId || selectedPetForDetail.ownerId}
                  </span>
                </div>
                <p className="text-xs font-bold text-foreground">
                  {selectedPetForDetail.owner?.name || "Client"}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <a
                    href={`tel:${selectedPetForDetail.owner?.phone}`}
                    className="flex items-center gap-1 text-primary hover:underline font-mono"
                  >
                    <Phone className="size-3" /> {selectedPetForDetail.owner?.phone || "N/A"}
                  </a>
                  <span>{selectedPetForDetail.owner?.city || "Registered Client"}</span>
                </div>
              </div>

              {/* Clinical / Medical Notes */}
              {selectedPetForDetail.medicalNotes && (
                <div className="rounded-xl border border-border/70 p-3 bg-muted/20 space-y-1">
                  <span className="font-bold text-foreground block text-[11px]">Medical Notes &amp; History</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {selectedPetForDetail.medicalNotes}
                  </p>
                </div>
              )}

              {/* Recent Visits for this Pet in OPD Queue */}
              <div className="space-y-1.5">
                <span className="font-bold text-foreground block text-[11px]">OPD Consultation History</span>
                {visits.filter((v) => v.petId === selectedPetForDetail.petId).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic bg-muted/10 p-2 rounded-lg border border-border/40">
                    No past visits logged in this active queue session.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {visits
                      .filter((v) => v.petId === selectedPetForDetail.petId)
                      .map((v) => (
                        <div
                          key={v.visitId}
                          onClick={() => {
                            setSelectedPetForDetail(null);
                            onStartConsultation(v);
                          }}
                          className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-card hover:bg-muted/30 cursor-pointer text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-foreground">{v.visitId}</span>
                            <span className="text-muted-foreground ml-1.5 font-mono">
                              ({formatDisplayDate(v.date) || v.date})
                            </span>
                            <p className="text-[10px] text-muted-foreground truncate">{v.diagnosis || v.vitals?.complaint}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-foreground">₹{v.totalAmount || 0}</span>
                            <ChevronRight className="size-3 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPetForDetail(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const p = selectedPetForDetail;
                    setSelectedPetForDetail(null);
                    handleQuickAdmit({ stopPropagation: () => {} } as any, p);
                  }}
                  className="gap-1.5 font-bold bg-primary text-primary-foreground shadow-xs text-xs"
                >
                  <Stethoscope className="size-3.5" /> Start OPD Consultation &amp; Rx →
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
