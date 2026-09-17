import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  Users,
  Activity,
  BarChart3,
  CalendarClock,
  Calendar,
  Clock,
  ArrowRight,
  Trash2,
  FileText,
  Stethoscope,
  FlaskConical,
  Home,
  Waves,
  Package,
  PlusCircle,
  ChevronRight,
  TrendingUp,
  Syringe,
  Pill,
  RefreshCw,
} from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { ModuleFlashcard } from "@/components/erp/Flashcard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { DashboardPatientActivityPanel } from "./DashboardPatientActivityPanel";
import { listLabOrdersFn } from "@/lib/mongodb/serverFns/laboratory";
import {
  listBoardingBookingsFn,
  listSwimSessionsFn,
} from "@/lib/mongodb/serverFns/facilities";
import { getItemsFn } from "@/lib/mongodb/serverFns/inventory";
import { listAppointmentsFn } from "@/lib/mongodb/serverFns/appointments";
import { getRowsFn } from "@/lib/mongodb/serverFns/rows";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import type { Kpi } from "@/lib/erp/config";

interface Props {
  role: any;
  visits: any[];
  onStartConsultation: (visit: any) => void;
  onDeleteVisit: (visit: any) => void;
  onOpenAdmitPicker: () => void;
  onOpenRegisterModal: () => void;
  onAdmitPet?: (pet: any) => void;
}

function StatChip({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl border border-border bg-muted/20 min-w-[80px]">
      <p className={cn("text-lg font-extrabold font-mono leading-none", accent ?? "text-foreground")}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">{label}</p>
    </div>
  );
}

function HorizBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function AdminDashboardView({
  role, visits, onStartConsultation, onDeleteVisit, onOpenAdmitPicker, onOpenRegisterModal, onAdmitPet,
}: Props) {
  const navigate = useNavigate();
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [boardingList, setBoardingList] = useState<any[]>([]);
  const [swimSessions, setSwimSessions] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [hrmsStaff, setHrmsStaff] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [petsList, setPetsList] = useState<any[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoadingFacilities(true);
      try {
        const [lab, boarding, swim, inv, appts, hrms, staff, pets] = await Promise.all([
          listLabOrdersFn().catch(() => []),
          listBoardingBookingsFn().catch(() => []),
          listSwimSessionsFn().catch(() => []),
          getItemsFn({ data: { status: "Active" } }).catch(() => []),
          listAppointmentsFn().catch(() => []),
          getRowsFn({ data: { moduleId: "hrms" } }).catch(() => []),
          listApprovedDoctorsFn().catch(() => []),
          listPetsWithOwnersFn().catch(() => []),
        ]);
        setLabOrders(lab ?? []);
        setBoardingList(boarding ?? []);
        setSwimSessions(swim ?? []);
        setInventory(inv ?? []);
        setAppointments(appts ?? []);
        setHrmsStaff(hrms ?? []);
        setStaffList(staff ?? []);
        setPetsList(pets ?? []);
      } catch (e) {
        console.warn("Admin dashboard data fetch error:", e);
      } finally {
        setLoadingFacilities(false);
      }
    })();
  }, []);

  const todayVisits = useMemo(() => visits, [visits]);
  const waitingVisits = todayVisits.filter(v => v.status !== "Paid" && v.status !== "Settled" && v.status !== "Completed");
  const outstanding = useMemo(() => visits.reduce((sum, v) => { const bal = Number(v.totalAmount || 0) - Number(v.amountPaid || 0); return bal > 0 ? sum + bal : sum; }, 0), [visits]);
  const vaccineDue = useMemo(() => new Set(visits.filter(v => String(v.vitals?.complaint || "").toLowerCase().includes("vacc")).map(v => v.petId)).size, [visits]);
  const followupDue = useMemo(() => visits.filter(v => v.prescriptionData?.followUp?.nextVisitDate && v.prescriptionData.followUp.nextVisitDate !== "Not scheduled").length, [visits]);

  const labPending = labOrders.filter(o => o.status !== "Completed").length;
  const labCritical = labOrders.filter(o => o.isAbnormal).length;
  const labDoctorReview = labOrders.filter(o => o.status === "Completed" && o.isAbnormal).length;

  const labTestCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of labOrders) {
      const profile = (o.profile || o.testName || "Other").split(" ")[0].replace(/[^A-Za-z]/g, "");
      map[profile] = (map[profile] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [labOrders]);
  const labMax = Math.max(...labTestCounts.map(x => x[1]), 1);

  const boardingOccupied = boardingList.filter(b => b.status === "Occupied").length;
  const boardingTotal = 25;
  const boardingCheckouts = boardingList.filter(b => b.status === "Checked Out").length;
  const boardingMedDue = boardingList.filter(b => b.diet).length;

  const swimToday = swimSessions.length;
  const swimCompleted = swimSessions.filter(s => s.status === "Completed").length;
  const swimUpcoming = swimSessions.filter(s => s.status === "Booked").length;
  const swimActive = swimSessions.filter(s => s.status === "In Session").length;

  const now = new Date(); const soon = new Date(now); soon.setDate(soon.getDate() + 30);
  const lowStock = inventory.filter(i => i.currentStock <= i.reorderLevel && i.currentStock > 0);
  const outOfStock = inventory.filter(i => i.currentStock === 0);
  const expiringSoon = inventory.filter(i => { const exp = i.medicineDetails?.expiryDate; if (!exp) return false; const d = new Date(exp); return d >= now && d <= soon; });

  const isCompleted = (v: any) =>
    v.status === "PAID" || v.status === "Settled" || v.status === "Paid" || v.status === "Completed" || v.status === "Partially Paid" ||
    (Number(v.totalAmount || 0) > 0 && Number(v.amountPaid || 0) >= Number(v.totalAmount || 0));

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const todayAppointments = useMemo(() => {
    return appointments.filter((a: any) => {
      const d = (a.appointment_date || a.date || a.createdAt || "").slice(0, 10);
      return !d || d === todayStr;
    });
  }, [appointments, todayStr]);

  const appointmentsCount = todayAppointments.length > 0 ? todayAppointments.length : visits.length;

  const appointmentsTrend = useMemo(() => {
    if (waitingVisits.length > 0) return `${waitingVisits.length} in OPD queue`;
    if (appointmentsCount > 0) {
      const completed = todayAppointments.filter((a: any) => a.status === "Completed").length;
      return completed > 0 ? `${completed} completed` : `${appointmentsCount} scheduled`;
    }
    return "0 in OPD queue";
  }, [waitingVisits.length, appointmentsCount, todayAppointments]);

  const revMix = useMemo(() => ({
    Clinical: visits.reduce((s, v) => s + Number(v.amountPaid || (isCompleted(v) ? v.totalAmount : 0) || 0), 0),
    Lab: labOrders.filter(o => o.status === "Completed").length * 500,
    Boarding: boardingOccupied * 800,
    Swimming: swimCompleted * 600,
  }), [visits, labOrders, boardingOccupied, swimCompleted]);

  const revTotal = useMemo(() => Object.values(revMix).reduce((a, b) => a + b, 0), [revMix]);
  const revMax = Math.max(revTotal, 1);

  const boardingPct = boardingTotal > 0 ? Math.round((boardingOccupied / boardingTotal) * 100) : 0;
  const totalLowStock = lowStock.length + outOfStock.length;

  const presentStaff = hrmsStaff.filter((r: any) => r.status === "Present" || r.status === "Late").length;
  const onLeaveStaff = hrmsStaff.filter((r: any) => r.status === "On leave" || r.status === "Leave").length;
  const activeStaffCount = hrmsStaff.length > 0 ? presentStaff : staffList.length;

  const snapshotKpis: Kpi[] = useMemo(() => [
    {
      label: "Today's Appointments",
      value: String(appointmentsCount),
      trend: appointmentsTrend,
      trendTone: appointmentsCount > 0 ? "up" : "flat",
    },
    {
      label: "Revenue Today",
      value: `₹${revTotal.toLocaleString("en-IN")}`,
      trend: revTotal > 0 ? `${visits.filter(isCompleted).length} settled visits` : "₹0 collected today",
      trendTone: revTotal > 0 ? "up" : "flat",
    },
    {
      label: "Boarding Occupancy",
      value: `${boardingPct}%`,
      trend: `${boardingOccupied} / ${boardingTotal} kennels`,
      trendTone: boardingOccupied > 0 ? "up" : "flat",
    },
    {
      label: "Low-Stock Items",
      value: String(totalLowStock),
      trend: outOfStock.length > 0 ? `${outOfStock.length} out of stock` : lowStock.length > 0 ? `${lowStock.length} reorder alert` : "Stock levels normal",
      trendTone: totalLowStock > 0 ? "down" : "up",
    },
    {
      label: "Staff on Shift",
      value: String(activeStaffCount),
      trend: onLeaveStaff > 0 ? `${onLeaveStaff} on leave` : activeStaffCount > 0 ? "Roster active" : "0 on shift",
      trendTone: activeStaffCount > 0 ? "up" : "flat",
    },
  ], [appointmentsCount, appointmentsTrend, revTotal, visits, boardingPct, boardingOccupied, boardingTotal, totalLowStock, outOfStock.length, lowStock.length, activeStaffCount, onLeaveStaff]);

  const statusBadge = (v: any) => {
    if (isCompleted(v)) return { label: "Completed", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
    if (v.status === "In Consultation") return { label: "In Consultation", cls: "bg-blue-500/10 text-blue-700 border-blue-500/20" };
    if (v.prescriptionData?.laboratoryRequired || String(v.status || "").toLowerCase().includes("lab"))
      return { label: "Lab Ready", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
    return { label: "Waiting", cls: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" };
  };

  const pharmacySales = useMemo(() => {
    return visits.reduce((sum, v) => {
      const itemsSum = (v.items || [])
        .filter((i: any) => String(i.lineType || "").toLowerCase() === "pharmacy" || String(i.lineType || "").toLowerCase() === "vaccine")
        .reduce((s: number, i: any) => s + Number(i.lineTotal || 0), 0);
      return sum + itemsSum;
    }, 0);
  }, [visits]);

  const resolveCard = (card: any) => {
    const c = { ...card };
    delete c.trend;
    delete c.trendTone;
    delete c.badge;

    if (card.module === "identity") {
      c.metricLabel = "Active staff accounts";
      c.metricValue = String(activeStaffCount);
    } else if (card.module === "crm-pets") {
      c.metricLabel = "Registered patients";
      c.metricValue = String(petsList.length);
    } else if (card.module === "appointments") {
      c.metricLabel = "In queue now";
      c.metricValue = String(waitingVisits.length);
      if (waitingVisits.length > 0) c.badge = `${waitingVisits.length} waiting`;
      if (appointmentsCount > 0) c.trend = `${appointmentsCount} scheduled today`;
    } else if (card.module === "laboratory") {
      c.metricLabel = "Pending reports";
      c.metricValue = String(labPending);
      if (labCritical > 0) c.badge = `${labCritical} critical`;
    } else if (card.module === "boarding") {
      c.metricLabel = "Occupied kennels";
      c.metricValue = `${boardingOccupied} / ${boardingTotal}`;
      if (swimToday > 0) c.badge = `${swimToday} swim today`;
    } else if (card.module === "pharmacy") {
      c.metricLabel = "Sales today";
      c.metricValue = `₹${pharmacySales.toLocaleString("en-IN")}`;
    } else if (card.module === "nutrition") {
      c.metricLabel = "Diet plans active";
      c.metricValue = String(boardingMedDue);
    } else if (card.module === "inventory") {
      c.metricLabel = "Low-stock items";
      c.metricValue = String(totalLowStock);
      if (outOfStock.length > 0) c.badge = `${outOfStock.length} out of stock`;
      else if (expiringSoon.length > 0) c.badge = `${expiringSoon.length} expiring`;
    } else if (card.module === "billing") {
      if (card.title?.includes("Manual")) {
        c.metricLabel = "Invoices today";
        c.metricValue = String(visits.length);
      } else if (card.title?.includes("Analytics")) {
        c.metricLabel = "Total outstanding";
        c.metricValue = `₹${outstanding.toLocaleString("en-IN")}`;
      } else if (card.title?.includes("Subscription")) {
        c.metricLabel = "Settled visits";
        c.metricValue = String(visits.filter(isCompleted).length);
      } else {
        c.metricLabel = "Unpaid invoices";
        c.metricValue = String(waitingVisits.length);
      }
    } else if (card.module === "accounting") {
      c.metricLabel = "Revenue today";
      c.metricValue = `₹${revTotal.toLocaleString("en-IN")}`;
    } else if (card.module === "hrms") {
      c.metricLabel = "On leave today";
      c.metricValue = String(onLeaveStaff);
      if (presentStaff > 0) c.badge = `${presentStaff} present`;
    } else if (card.module === "identity-global") {
      c.metricLabel = "Active users";
      c.metricValue = String(activeStaffCount);
    } else if (card.module === "marketing") {
      c.metricLabel = "Vaccines due";
      c.metricValue = String(vaccineDue);
    } else if (card.module === "communication") {
      c.metricLabel = "Follow-ups due";
      c.metricValue = String(followupDue);
    } else if (card.module === "reports") {
      c.metricLabel = "Visits recorded";
      c.metricValue = String(visits.length);
    } else if (card.module === "integrations") {
      c.metricLabel = "System status";
      c.metricValue = "Online";
    }

    return c;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">

          {/* Header */}
          <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-purple-500/8 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-purple-600 text-white font-bold shadow-xs">
                <ShieldCheck className="size-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-foreground">Clinic Administrator & Owner Dashboard</h2>
                  <span className="bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20">Full Access</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Live overview of Clinical, Laboratory, Boarding, Swimming & Inventory operations.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={onOpenAdmitPicker} className="h-9 gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
                <CalendarClock className="size-3.5" /> OPD Queue
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenRegisterModal} className="h-9 gap-1.5 text-xs font-semibold bg-card hover:bg-muted">
                <Users className="size-3.5" /> Register Client
              </Button>
            </div>
          </div>

          {/* Attention Today */}
          <div className="space-y-3">
            <div className="flex items-center gap-3"><h3 className="section-label">Attention Required Today</h3><span className="h-px flex-1 bg-border" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Calendar className="size-4" /></span>
                  <p className="text-xs font-bold text-foreground">Appointments</p>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {todayVisits.slice(0, 3).map(v => (
                    <div key={v.visitId} className="flex items-center justify-between gap-1">
                      <span className="font-medium text-foreground truncate">{v.petName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{v.date ? formatDisplayDate(v.date) : "Today"}</span>
                    </div>
                  ))}
                  {todayVisits.length === 0 && <p className="text-[11px] italic">No appointments today</p>}
                </div>
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={onOpenAdmitPicker}>View All</Button>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><FlaskConical className="size-4" /></span>
                  <p className="text-xs font-bold text-foreground">Patients to Review</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between"><span className="text-destructive font-semibold">Critical / Abnormal</span><span className="font-mono font-bold text-destructive">{labCritical}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Reports Ready</span><span className="font-mono font-semibold">{labOrders.filter(o => o.status === "Completed").length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Doctor Review Due</span><span className="font-mono font-semibold">{labDoctorReview}</span></div>
                </div>
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => void navigate({ to: "/m/$moduleId", params: { moduleId: "lab_orders" } })}>Review</Button>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Syringe className="size-4" /></span>
                  <p className="text-xs font-bold text-foreground">Dues & Reminders</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Vaccinations Due</span><span className="font-mono font-semibold">{vaccineDue || "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Follow-ups Scheduled</span><span className="font-mono font-semibold">{followupDue || "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-amber-600 font-semibold">Medicines Expiring</span><span className="font-mono font-semibold text-amber-600">{expiringSoon.length}</span></div>
                </div>
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => void navigate({ to: "/m/$moduleId", params: { moduleId: "inventory" } })}>View All</Button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-3"><h3 className="section-label">Quick Actions</h3><span className="h-px flex-1 bg-border" /></div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "New Patient", icon: <PlusCircle className="size-4" />, action: onOpenRegisterModal },
                { label: "Treat Patient", icon: <Stethoscope className="size-4" />, action: onOpenAdmitPicker },
              ].map(q => (
                <button key={q.label} type="button" onClick={q.action} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-all shadow-xs cursor-pointer">
                  <span className="text-primary">{q.icon}</span>{q.label}
                </button>
              ))}
              {[
                { label: "Lab Order", icon: <FlaskConical className="size-4" />, module: "lab_orders" },
                { label: "Pharmacy", icon: <Pill className="size-4" />, module: "pharmacy" },
                { label: "Boarding", icon: <Home className="size-4" />, module: "boarding" },
                { label: "Swimming", icon: <Waves className="size-4" />, module: "swimming" },
                { label: "Inventory", icon: <Package className="size-4" />, module: "inventory" },
              ].map(q => (
                <Link key={q.label} to="/m/$moduleId" params={{ moduleId: q.module }} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-all shadow-xs">
                  <span className="text-primary">{q.icon}</span>{q.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Treatment Queue */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Activity className="size-4" /></span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Treatment Queue — Today</h3>
                  <p className="text-[11px] text-muted-foreground">Live OPD admissions and consultation status</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{visits.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border/50">
                    <th className="pb-2 font-semibold pr-3">Date</th>
                    <th className="pb-2 font-semibold pr-3">Patient</th>
                    <th className="pb-2 font-semibold pr-3">Complaint</th>
                    <th className="pb-2 font-semibold pr-3">Status</th>
                    <th className="pb-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {visits.slice(0, 10).map(v => {
                    const sb = statusBadge(v);
                    return (
                      <tr key={v.visitId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-3 font-mono text-muted-foreground whitespace-nowrap">{formatDisplayDate(v.date || v.createdAt) || "—"}</td>
                        <td className="py-2.5 pr-3"><p className="font-semibold text-foreground">{v.petName}</p><p className="text-[10px] text-muted-foreground">{v.ownerName}</p></td>
                        <td className="py-2.5 pr-3 max-w-[150px]"><p className="truncate text-muted-foreground">{v.vitals?.complaint || v.diagnosis || "OPD Visit"}</p></td>
                        <td className="py-2.5 pr-3"><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", sb.cls)}>{sb.label}</span></td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => onDeleteVisit(v)} className="h-6 px-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="size-3" /></Button>
                            <Button size="sm" onClick={() => onStartConsultation(v)} className={cn("h-6 px-2 text-[10px] font-semibold gap-1", isCompleted(v) ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary text-primary-foreground")}>
                              {isCompleted(v) ? <><FileText className="size-3" /> View</> : <>Treat <ArrowRight className="size-3" /></>}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visits.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground italic text-xs">No active visits today. Click "OPD Queue" to admit patients.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hospital Snapshot */}
          <div className="space-y-3">
            <div className="flex items-center gap-3"><h3 className="section-label">Hospital Snapshot</h3><span className="h-px flex-1 bg-border" /></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {snapshotKpis.map((k, idx) => (
                <KpiCard key={k.label} kpi={k} index={idx} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /><p className="text-xs font-bold text-foreground">Revenue Mix (Today)</p></div>
                <div className="space-y-2">
                  {Object.entries(revMix).map(([k, v]) => <HorizBar key={k} label={k} value={Number(v)} max={revMax} color="bg-primary" />)}
                </div>
                <p className="text-[11px] text-muted-foreground">Based on today's clinical visits, lab orders, boarding & swimming records.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2"><BarChart3 className="size-4 text-amber-600" /><p className="text-xs font-bold text-foreground">Outstanding & Billing</p></div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Total Outstanding</span><span className="font-mono font-bold text-destructive">₹{outstanding.toLocaleString("en-IN")}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Today's Invoices</span><span className="font-mono font-semibold">{visits.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Settled Visits</span><span className="font-mono font-semibold text-emerald-600">{visits.filter(isCompleted).length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Waiting / Active</span><span className="font-mono font-semibold text-blue-600">{waitingVisits.length}</span></div>
                </div>
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => void navigate({ to: "/m/$moduleId", params: { moduleId: "billing" } })}>
                  Open Billing <ChevronRight className="size-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          {/* Laboratory Analytics */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><FlaskConical className="size-4" /></span>
                <div><h3 className="text-sm font-bold text-foreground">Laboratory Analytics</h3><p className="text-[11px] text-muted-foreground">Real-time lab order data</p></div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void navigate({ to: "/m/$moduleId", params: { moduleId: "lab_orders" } })}>Open Lab <ChevronRight className="size-3 ml-1" /></Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatChip label="Samples Today" value={labOrders.length} />
              <StatChip label="Pending" value={labPending} accent="text-amber-600" />
              <StatChip label="Doctor Review" value={labDoctorReview} accent="text-blue-600" />
              <StatChip label="Critical" value={labCritical} accent="text-destructive" />
              <StatChip label="Completed" value={labOrders.filter(o => o.status === "Completed").length} accent="text-emerald-600" />
            </div>
            {labTestCounts.length > 0 ? (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Test Profile Volume</p>
                {labTestCounts.map(([name, cnt]) => <HorizBar key={name} label={name} value={cnt} max={labMax} color="bg-violet-500" />)}
              </div>
            ) : !loadingFacilities && <p className="text-xs text-muted-foreground italic">No lab orders recorded.</p>}
            {loadingFacilities && <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin" /> Loading lab data…</div>}
          </div>

          {/* Boarding */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Home className="size-4" /></span>
                <div><h3 className="text-sm font-bold text-foreground">Boarding</h3><p className="text-[11px] text-muted-foreground">Current occupancy and schedule</p></div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void navigate({ to: "/m/$moduleId", params: { moduleId: "boarding" } })}>Open Boarding <ChevronRight className="size-3 ml-1" /></Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatChip label={`Occupancy (/${boardingTotal})`} value={boardingOccupied} accent={boardingOccupied > boardingTotal * 0.8 ? "text-destructive" : "text-emerald-600"} />
              <StatChip label="Check-ins" value={boardingOccupied} />
              <StatChip label="Check-outs" value={boardingCheckouts} />
              <StatChip label="Diet Plans" value={boardingMedDue} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Occupancy Rate</span>
                <span className="font-mono font-semibold text-foreground">{Math.round((boardingOccupied / boardingTotal) * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", boardingOccupied / boardingTotal > 0.8 ? "bg-destructive" : "bg-amber-500")} style={{ width: `${Math.min((boardingOccupied / boardingTotal) * 100, 100)}%` }} />
              </div>
            </div>
            {boardingList.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border/50">
                      <th className="pb-1.5 font-semibold pr-3">Patient</th>
                      <th className="pb-1.5 font-semibold pr-3">Suite</th>
                      <th className="pb-1.5 font-semibold pr-3">Check-in</th>
                      <th className="pb-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {boardingList.slice(0, 5).map(b => (
                      <tr key={b.id} className="hover:bg-muted/20">
                        <td className="py-2 pr-3 font-semibold text-foreground">{b.pet}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{b.suite}</td>
                        <td className="py-2 pr-3 font-mono text-muted-foreground">{b.checkIn}</td>
                        <td className="py-2">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", b.status === "Occupied" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : b.status === "Booked" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" : "bg-muted text-muted-foreground border-border")}>{b.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {loadingFacilities && <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin" /> Loading boarding data…</div>}
          </div>

          {/* Swimming */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Waves className="size-4" /></span>
                <div><h3 className="text-sm font-bold text-foreground">Swimming & Hydrotherapy</h3><p className="text-[11px] text-muted-foreground">Session schedule and completion</p></div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void navigate({ to: "/m/$moduleId", params: { moduleId: "swimming" } })}>Open Swimming <ChevronRight className="size-3 ml-1" /></Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatChip label="Total Today" value={swimToday} />
              <StatChip label="Completed" value={swimCompleted} accent="text-emerald-600" />
              <StatChip label="In Session" value={swimActive} accent="text-blue-600" />
              <StatChip label="Upcoming" value={swimUpcoming} accent="text-amber-600" />
            </div>
            {swimSessions.length > 0 && (
              <div className="space-y-2">
                {swimSessions.slice(0, 4).map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                    <div><p className="font-semibold text-foreground">{s.pet}</p><p className="text-muted-foreground">{s.sessionType}</p></div>
                    <div className="text-right">
                      <p className="font-mono text-muted-foreground">{s.timeSlot}</p>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", s.status === "Completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : s.status === "In Session" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20")}>{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {loadingFacilities && <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin" /> Loading session data…</div>}
          </div>

        </div>

        {/* Right panel */}
        <div className="xl:col-span-4 space-y-4 xl:sticky xl:top-4">
          <DashboardPatientActivityPanel
            visits={visits}
            onStartConsultation={onStartConsultation}
            onAdmitPet={onAdmitPet}
            onOpenRegisterModal={onOpenRegisterModal}
            inventoryAlerts={{ lowStock, outOfStock, expiringSoon }}
          />
        </div>
      </div>

      {/* Module flashcards */}
      {role.blocks.map((block: any, bIdx: number) => (
        <motion.section key={block.category} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: bIdx * 0.08, ease: "easeOut" }} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="section-label">{block.category}</h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{block.cards.length} modules</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {block.cards.map((card: any, cIdx: number) => {
              const liveCard = resolveCard(card);
              return <ModuleFlashcard key={card.module + card.title} card={liveCard} index={cIdx} />;
            })}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
