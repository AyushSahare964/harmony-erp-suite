import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  UserPlus,
  PawPrint,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Home,
  Waves,
  FlaskConical,
  Boxes,
  FileText,
  Bone,
  Stethoscope,
  ArrowRight,
  Phone,
  User,
  Sparkles,
  RefreshCw,
  Trash2,
  Mail,
  Activity,
  Check,
  AlertTriangle,
  Calendar,
  CreditCard,
  Banknote,
  X,
  BellRing,
  IndianRupee,
  Timer,
  Receipt,
  Eye,
} from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { ModuleFlashcard } from "@/components/erp/Flashcard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDisplayDate, todayISO } from "@/lib/utils/dateUtils";
import { useErp } from "@/lib/erp/store";
import { listVisitsFn, admitPatientFn, deleteVisitFn, listPaymentRequestsFn, collectReceptionistPaymentFn } from "@/lib/mongodb/serverFns/clinical";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { BookAppointmentModal } from "@/components/erp/appointments/BookAppointmentModal";
import { Patient360Profile } from "@/components/erp/crm/Patient360Profile";

interface Props {
  role?: any;
  onOpenConsultation?: (visit: any) => void;
}

export function ReceptionistDashboardView({ role, onOpenConsultation }: Props) {
  const { currentUser } = useErp();
  const [visits, setVisits] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<
    Array<{ id: string; name: string; specialty?: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  // Pending payment collection queue (doctor -> receptionist)
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [payInputs, setPayInputs] = useState<Record<string, { amount: string; mode: string; trxRef: string }>>({});
  const [collectingVisitId, setCollectingVisitId] = useState<string | null>(null);
  const [activePayTab, setActivePayTab] = useState<"lobby" | "collections">("lobby");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarBillTab, setSidebarBillTab] = useState<"pending" | "completed" | "all">("all");

  // Quick Intake Modal
  const [showQuickIntakeModal, setShowQuickIntakeModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Registered patients count & data
  const [existingPatients, setExistingPatients] = useState<any[]>([]);
  const [selectedProfilePetId, setSelectedProfilePetId] = useState<string | null>(null);

  useEffect(() => {
    // Defer initial data load so the skeleton renders first
    const t = setTimeout(() => { void loadData(); }, 800);
    return () => clearTimeout(t);
  }, []);

  // Poll for pending payment requests every 30 seconds (down from 15s)
  useEffect(() => {
    let cancelled = false;
    const fetchPaymentRequests = async () => {
      try {
        const reqs = await listPaymentRequestsFn();
        if (cancelled) return;
        setPaymentRequests(reqs || []);
        if (reqs && reqs.length > 0) {
          setActivePayTab("collections");
        }
      } catch (e) {
        console.error("Failed to load payment requests:", e);
      }
    };
    void fetchPaymentRequests();
    const interval = setInterval(() => { void fetchPaymentRequests(); }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitList, patientList, docsList] = await Promise.all([
        listVisitsFn().catch(() => []),
        listPetsWithOwnersFn().catch(() => []),
        listApprovedDoctorsFn().catch(() => []),
      ]);
      setVisits(visitList || []);
      setExistingPatients(patientList || []);
      if (docsList && docsList.length > 0) {
        setDoctorsList(docsList);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVisit = async (v: any) => {
    if (!window.confirm(`Are you sure you want to remove ${v.petName}'s visit ticket?`)) return;
    try {
      await deleteVisitFn({ data: { visitId: v.visitId } });
      toast.success(`Removed visit ticket ${v.visitId}`);
      setVisits((prev) => prev.filter((item) => item.visitId !== v.visitId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove ticket");
    }
  };

  // A visit counts as "today's" by its own admission date, not by when this
  // page happens to load — falls back to createdAt for older rows saved
  // before `date` was always set.
  const isVisitToday = (v: any) => String(v.date || v.createdAt || "").slice(0, 10) === todayISO();
  const isWaitingStatus = (v: any) =>
    v.status !== "Paid" && v.status !== "Settled" && v.status !== "Completed";

  // The lobby queue: today's admissions plus any older ticket that was never
  // closed out (so a genuinely still-open case never silently disappears).
  const queueVisits = visits.filter((v) => isVisitToday(v) || isWaitingStatus(v));

  const filteredVisits = queueVisits.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.petName?.toLowerCase().includes(q) ||
      v.ownerName?.toLowerCase().includes(q) ||
      v.ownerPhone?.includes(q) ||
      v.visitId?.toLowerCase().includes(q)
    );
  });

  // Categorize bills into pending, completed, and all
  const billLists = useMemo(() => {
    const all = visits
      .filter((v) =>
        Number(v.totalAmount || 0) > 0 ||
        v.invoiceNo ||
        v.prescriptionNo ||
        v.paymentStatus ||
        v.paymentRequestStatus === "pending" ||
        v.status === "Paid" ||
        v.status === "Billed" ||
        v.status === "Settled"
      )
      .sort((a, b) => new Date(b.createdAt || b.paymentRequestedAt || 0).getTime() - new Date(a.createdAt || a.paymentRequestedAt || 0).getTime());

    const pending = all.filter((v) => {
      const due = Number(v.balanceDue ?? v.pendingAmount ?? 0);
      return due > 0 || v.paymentStatus === "Partial" || v.paymentStatus === "Unpaid" || v.paymentRequestStatus === "pending";
    });

    const completed = all.filter((v) => {
      const due = Number(v.balanceDue ?? v.pendingAmount ?? 0);
      const isSettled = v.paymentStatus === "Full" || v.status === "Paid" || v.status === "Settled";
      return due <= 0 && isSettled;
    });

    return { all, pending, completed };
  }, [visits]);

  const currentTabBills = useMemo(() => {
    if (sidebarBillTab === "pending") return billLists.pending;
    if (sidebarBillTab === "completed") return billLists.completed;
    return billLists.all;
  }, [billLists, sidebarBillTab]);

  const filteredSidebarBills = useMemo(() => {
    if (!sidebarSearch.trim()) return currentTabBills;
    const q = sidebarSearch.toLowerCase().trim();
    return currentTabBills.filter((v) =>
      v.petName?.toLowerCase().includes(q) ||
      v.ownerName?.toLowerCase().includes(q) ||
      v.ownerPhone?.includes(q) ||
      v.visitId?.toLowerCase().includes(q) ||
      v.invoiceNo?.toLowerCase().includes(q) ||
      v.prescriptionNo?.toLowerCase().includes(q) ||
      v.doctorName?.toLowerCase().includes(q)
    );
  }, [currentTabBills, sidebarSearch]);

  const waitingVisits = visits.filter(isWaitingStatus);
  const todaysVisits = visits.filter(isVisitToday);
  const todaysCompletedVisits = todaysVisits.filter((v) => !isWaitingStatus(v));

  const receptionistKpis = [
    {
      label: "Waiting in Lobby",
      value: String(waitingVisits.length),
      trend: waitingVisits.length > 0 ? "Ready for triage" : "Lobby clear",
      trendTone: waitingVisits.length > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Today's Appointments",
      value: String(todaysVisits.length),
      trend: todaysCompletedVisits.length > 0 ? `${todaysCompletedVisits.length} completed` : "0 checked in",
      trendTone: todaysVisits.length > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Registered Patients",
      value: String(existingPatients.length),
      trend: `${existingPatients.length} records in CRM`,
      trendTone: existingPatients.length > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Doctors on Duty",
      value: String(doctorsList.length),
      trend: `${doctorsList.length} consultants available`,
      trendTone: doctorsList.length > 0 ? ("up" as const) : ("flat" as const),
    },
  ];

  return (
    <div className="flex gap-0 items-start min-h-0">
      {/* ── Main Dashboard Content ── */}
      <div className="flex-1 min-w-0 space-y-6 pr-0">
      {/* ── Reception Quick Action Command Bar ──────────────────────────────── */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-blue-500/8 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
            <CalendarClock className="size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                Receptionist &amp; Patient Admittance Hub
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] border-blue-500/30 text-blue-600 bg-blue-500/10 font-bold"
              >
                Front Desk Live
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check in walk-in pet parents, record complaint &amp; vitals, and route directly to
              Doctor OPD.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowQuickIntakeModal(true)}
            className="h-9 gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <UserPlus className="size-3.5" /> Quick Patient Intake &amp; Admit
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowRegisterModal(true)}
            className="h-9 gap-1.5 text-xs font-semibold bg-card hover:bg-muted"
          >
            <PawPrint className="size-3.5" /> Full CRM Registration
          </Button>
        </div>
      </div>

      {/* ── Receptionist KPI Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {receptionistKpis.map((k, idx) => (
          <KpiCard key={k.label} kpi={k} index={idx} />
        ))}
      </div>


      {/* ── Pending Collections Tab ─────────────────────────────────────────── */}
      {paymentRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-50/80 via-orange-50/60 to-amber-50/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/10 shadow-md shadow-amber-500/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-amber-300/40 bg-amber-500/10">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30 shrink-0">
                <BellRing className="size-5 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">Pending Collections</h3>
                  <span className="inline-flex items-center justify-center size-5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold shadow-xs">
                    {paymentRequests.length}
                  </span>
                  <span className="text-[10px] bg-amber-500/20 border border-amber-400/40 text-amber-800 dark:text-amber-300 rounded-full px-2 py-0.5 font-bold uppercase tracking-wide">Doctor Requested</span>
                </div>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                  Patients sent by doctor for immediate payment — collect now
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const reqs = await listPaymentRequestsFn();
                  setPaymentRequests(reqs || []);
                } catch {}
              }}
              className="h-7 text-xs gap-1 border-amber-400/50 text-amber-700 hover:bg-amber-100"
            >
              <RefreshCw className="size-3" /> Refresh
            </Button>
          </div>

          {/* Payment Request Cards */}
          <div className="p-4 space-y-3">
            {paymentRequests.map((req: any) => {
              const inputs = payInputs[req.visitId] || { amount: String(req.pendingAmount ?? req.balanceDue ?? req.totalAmount ?? 0), mode: "Cash", trxRef: "" };
              const pendingAmt = Number(req.pendingAmount ?? req.balanceDue ?? 0);
              const totalAmt = Number(req.totalAmount ?? 0);
              const paidAmt = Number(req.amountPaid ?? 0);
              return (
                <motion.div
                  key={req.visitId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-xl border border-amber-300/50 bg-white dark:bg-slate-900 shadow-xs p-4 space-y-3"
                >
                  {/* Patient Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/30 text-amber-700 dark:text-amber-300 font-extrabold text-sm shrink-0">
                        {(req.petName || "P").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{req.petName} <span className="text-muted-foreground font-normal text-xs">({req.species || ""})</span></p>
                        <p className="text-[11px] text-muted-foreground">{req.ownerName} · {req.ownerPhone}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground font-mono">{req.visitId}</p>
                      <p className="text-[10px] text-amber-600 font-semibold">Dr: {req.doctorName || "—"}</p>
                    </div>
                  </div>

                  {/* Bill Summary */}
                  <div className="rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/40 px-3 py-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Total Bill</p>
                      <p className="text-sm font-extrabold text-foreground font-mono">₹{totalAmt.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Paid</p>
                      <p className="text-sm font-bold text-emerald-600 font-mono">₹{paidAmt.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Due</p>
                      <p className="text-base font-extrabold text-amber-600 font-mono">₹{pendingAmt.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Payment Input Row */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <IndianRupee className="size-3" /> Amount
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={pendingAmt}
                        value={inputs.amount}
                        onChange={(e) =>
                          setPayInputs((prev) => ({
                            ...prev,
                            [req.visitId]: { ...inputs, amount: e.target.value },
                          }))
                        }
                        className="h-8 text-sm font-bold font-mono bg-background"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <CreditCard className="size-3" /> Mode
                      </label>
                      <Select
                        value={inputs.mode}
                        onValueChange={(v) =>
                          setPayInputs((prev) => ({
                            ...prev,
                            [req.visitId]: { ...inputs, mode: v },
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Cash", "UPI", "Card", "NetBanking", "Cheque", "Account Due"].map((m) => (
                            <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Ref / UTR</label>
                      <Input
                        value={inputs.trxRef}
                        onChange={(e) =>
                          setPayInputs((prev) => ({
                            ...prev,
                            [req.visitId]: { ...inputs, trxRef: e.target.value },
                          }))
                        }
                        className="h-8 text-xs bg-background"
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => onOpenConsultation?.({ ...req, openedFromReception: true })}
                      className="h-8 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white gap-1.5 shadow-xs"
                      title="Open full bill settlement workspace to view items, discount, GST and collect"
                    >
                      <Receipt className="size-3.5" /> View &amp; Settle Bill
                    </Button>
                    <Button
                      size="sm"
                      disabled={collectingVisitId === req.visitId || !inputs.amount || Number(inputs.amount) <= 0}
                      onClick={async () => {
                        setCollectingVisitId(req.visitId);
                        try {
                          await collectReceptionistPaymentFn({
                            data: {
                              visitId: req.visitId,
                              paymentMode: inputs.mode as any,
                              amountPaid: Number(inputs.amount),
                              trxRef: inputs.trxRef || undefined,
                              recordedBy: currentUser?.name || "Receptionist",
                            },
                          });
                          toast.success(`Payment of ₹${Number(inputs.amount).toFixed(2)} collected for ${req.petName}!`);
                          setPaymentRequests((prev) => prev.filter((r) => r.visitId !== req.visitId));
                        } catch (err: any) {
                          toast.error(err?.message || "Failed to collect payment");
                        } finally {
                          setCollectingVisitId(null);
                        }
                      }}
                      className="flex-1 h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                    >
                      {collectingVisitId === req.visitId ? (
                        <><Timer className="size-3.5 animate-spin" /> Collecting…</>
                      ) : (
                        <><Banknote className="size-3.5" /> Quick Collect ₹{Number(inputs.amount || 0).toFixed(2)}</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={collectingVisitId === req.visitId}
                      onClick={async () => {
                        try {
                          await collectReceptionistPaymentFn({
                            data: { visitId: req.visitId, paymentMode: "Cash", amountPaid: 0, dismiss: true },
                          });
                          setPaymentRequests((prev) => prev.filter((r) => r.visitId !== req.visitId));
                          toast.info(`Payment request for ${req.petName} dismissed.`);
                        } catch (err: any) {
                          toast.error(err?.message || "Failed to dismiss");
                        }
                      }}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1"
                    >
                      <X className="size-3.5" /> Dismiss
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
      {/* ── Live Waiting Lobby & OPD Queue (Pre-filled for Doctors) ──────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 font-bold text-xs">
              <Clock className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Waiting Lobby &amp; OPD Queue</h3>
              <p className="text-[11px] text-muted-foreground">
                Patients registered at front desk awaiting doctor consultation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search patient, owner, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/30"
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadData()}
              className="h-8 text-xs font-semibold gap-1"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        {/* Queue Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVisits.map((v) => (
            <motion.div
              key={v.visitId}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-border bg-card hover:border-blue-500/40 p-3.5 shadow-2xs space-y-3 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{v.species === "Feline" ? "🐱" : "🐶"}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedProfilePetId(v.petId || null)}
                      className={cn(
                        "text-sm font-bold text-foreground text-left transition-colors",
                        v.petId ? "hover:text-blue-600 hover:underline cursor-pointer" : ""
                      )}
                      title={v.petId ? "View Patient 360° Profile" : undefined}
                    >
                      {v.petName}
                    </button>
                    {v.petId && (
                      <button
                        type="button"
                        onClick={() => setSelectedProfilePetId(v.petId)}
                        className="cursor-pointer"
                        title="View Patient 360° Profile"
                      >
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] py-0 bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                        >
                          {v.petId}
                        </Badge>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {v.species} · {v.breed}
                  </p>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    v.status === "PAID" || v.status === "Settled" || v.status === "Completed"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-700 border-blue-500/20",
                  )}
                >
                  {v.status || "Admitted"}
                </span>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1 text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <strong className="text-foreground flex items-center gap-1">
                    <Calendar className="size-3 text-muted-foreground" /> Date:
                  </strong>{" "}
                  <span>
                    {formatDisplayDate(v.date || v.createdAt || v.prescriptionData?.dateOfVisit) ||
                      v.date ||
                      "—"}
                  </span>
                </p>
                <p>
                  <strong className="text-foreground">Parent:</strong> {v.ownerName} ({v.ownerPhone}
                  )
                </p>
                <p className="line-clamp-1">
                  <strong className="text-foreground">Chief Complaint:</strong>{" "}
                  {v.vitals?.complaint || "Routine Checkup"}
                </p>
                <p className="text-blue-700 dark:text-blue-300 font-semibold">
                  Assigned Dr: {v.doctorName || "Dr. Rohit Sharma"}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-[11px] font-mono text-muted-foreground">{v.visitId}</span>
                <div className="flex items-center gap-1.5">
                  {v.petId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedProfilePetId(v.petId)}
                      className="h-7 px-2 text-xs text-primary hover:bg-primary/10 border-primary/30 gap-1 font-semibold"
                      title="Open Patient 360° Profile"
                    >
                      <Eye className="size-3" /> Profile
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteVisit(v)}
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <Trash2 className="size-3" />
                  </Button>

                  {onOpenConsultation && (
                    <Button
                      size="sm"
                      onClick={() => onOpenConsultation(v)}
                      className="h-7 text-xs font-semibold gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      View Ticket <ArrowRight className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {filteredVisits.length === 0 && (
            <div className="col-span-full py-10 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
              No patients admitted today and no older tickets still waiting. Click
              &ldquo;Quick Patient Intake&rdquo; to admit a walk-in patient.
            </div>
          )}
        </div>
      </div>

      {/* ── Receptionist Modules Matrix ────────────────────────────────────────── */}
      {role.blocks.map((block: any, bIdx: number) => (
        <motion.section
          key={block.category}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: bIdx * 0.08, ease: "easeOut" }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3">
            <h2 className="section-label">{block.category}</h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{block.cards.length} modules</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {block.cards.map((card: any, cIdx: number) => (
              <ModuleFlashcard key={card.module + card.title} card={card} index={cIdx} />
            ))}
          </div>
        </motion.section>
      ))}

      {/* ── Unified Patient Intake & Appointment Booking Modal ───────────────── */}
      <BookAppointmentModal
        open={showQuickIntakeModal}
        onClose={() => setShowQuickIntakeModal(false)}
        onBooked={() => {
          void loadData();
        }}
        autoAdmitToOPD
      />

      {/* Full CRM Registration Modal */}
      <OwnerPetRegistrationModal
        open={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        initialMode="new-all"
        registrationSource="Reception"
        onRegistered={() => {
          void loadData();
        }}
      />

      {/* Patient 360° Profile Dialog */}
      <Patient360Profile
        open={Boolean(selectedProfilePetId)}
        petId={selectedProfilePetId}
        onClose={() => setSelectedProfilePetId(null)}
        onStartConsultation={(pet, owner) => {
          setSelectedProfilePetId(null);
          onOpenConsultation?.({
            petId: pet.petId,
            petName: pet.name,
            species: pet.species,
            breed: pet.breed,
            ownerId: owner?.ownerId,
            ownerName: owner?.name,
            ownerPhone: owner?.phone,
            openedFromReception: true,
          });
        }}
        onChanged={() => void loadData()}
      />

      </div>{/* end main content */}

      {/* ─────────────────── PATIENT BILLS SIDEBAR (PENDING & COMPLETE) ─────────────────── */}
      <aside className="w-[320px] min-w-[280px] max-w-[340px] shrink-0 self-start sticky top-0 ml-4 hidden lg:flex flex-col rounded-2xl border border-border bg-card shadow-md overflow-hidden"
             style={{ maxHeight: "calc(100vh - 80px)" }}>

        {/* Sidebar Header with Segmented Tabs */}
        <div className="px-4 pt-3.5 pb-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 shrink-0 text-violet-200" />
              <div>
                <h3 className="text-[13px] font-extrabold leading-tight">Patient Bills</h3>
                <p className="text-[10px] text-white/75 leading-tight">
                  {sidebarBillTab === "pending"
                    ? "Unpaid & partial payments"
                    : sidebarBillTab === "completed"
                    ? "Completed & settled payments"
                    : "All billing transactions"}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center justify-center min-w-[22px] h-5 rounded-full bg-white/20 border border-white/30 text-white text-[10px] font-extrabold px-1.5">
              {filteredSidebarBills.length}
            </span>
          </div>

          {/* Segmented Filter: Pending | Complete | All */}
          <div className="grid grid-cols-3 gap-1 mt-2.5 p-0.5 bg-black/20 rounded-lg text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSidebarBillTab("pending")}
              className={cn(
                "py-1 px-1 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer",
                sidebarBillTab === "pending"
                  ? "bg-white text-violet-900 shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              <span>Pending</span>
              <span className={cn(
                "text-[9px] px-1 rounded-full font-mono font-extrabold",
                sidebarBillTab === "pending" ? "bg-amber-100 text-amber-800" : "bg-white/20 text-white"
              )}>
                {billLists.pending.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarBillTab("completed")}
              className={cn(
                "py-1 px-1 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer",
                sidebarBillTab === "completed"
                  ? "bg-white text-violet-900 shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              <span>Complete</span>
              <span className={cn(
                "text-[9px] px-1 rounded-full font-mono font-extrabold",
                sidebarBillTab === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-white/20 text-white"
              )}>
                {billLists.completed.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarBillTab("all")}
              className={cn(
                "py-1 px-1 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer",
                sidebarBillTab === "all"
                  ? "bg-white text-violet-900 shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              <span>All</span>
              <span className={cn(
                "text-[9px] px-1 rounded-full font-mono font-extrabold",
                sidebarBillTab === "all" ? "bg-violet-100 text-violet-900" : "bg-white/20 text-white"
              )}>
                {billLists.all.length}
              </span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search patient, owner, invoice..."
              className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 placeholder:text-muted-foreground transition-all"
            />
            {sidebarSearch && (
              <button
                type="button"
                onClick={() => setSidebarSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bill List — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filteredSidebarBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 mb-3">
                <CheckCircle2 className="size-6 text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-foreground">
                {sidebarSearch
                  ? "No matching bills"
                  : sidebarBillTab === "pending"
                  ? "All Bills Cleared!"
                  : sidebarBillTab === "completed"
                  ? "No Completed Bills Yet"
                  : "No Bills Recorded"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {sidebarSearch
                  ? "Try a different search term"
                  : sidebarBillTab === "pending"
                  ? "No pending payments right now"
                  : "Bills will appear here once finalized"}
              </p>
              {sidebarBillTab === "pending" && billLists.completed.length > 0 && !sidebarSearch && (
                <button
                  type="button"
                  onClick={() => setSidebarBillTab("completed")}
                  className="mt-3 text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View Completed Bills ({billLists.completed.length}) <ArrowRight className="size-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredSidebarBills.map((v: any, idx: number) => {
                const due = Number(v.balanceDue ?? v.pendingAmount ?? 0);
                const total = Number(v.totalAmount ?? 0);
                const paid = Number(v.amountPaid ?? (due <= 0 && total > 0 ? total : 0));
                const pctPaid = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : (due <= 0 ? 100 : 0);
                const isPaid =
                  (due <= 0 && (total > 0 || paid > 0)) ||
                  v.paymentStatus === "Full" ||
                  v.status === "Paid" ||
                  v.status === "Settled" ||
                  v.paymentRequestStatus === "collected";
                const isPartial = !isPaid && (v.paymentStatus === "Partial" || paid > 0);
                const effectiveMode =
                  v.paymentMode ||
                  (Array.isArray(v.payments) && v.payments.length > 0 ? v.payments[v.payments.length - 1]?.mode : null) ||
                  null;

                return (
                  <div
                    key={v.visitId || idx}
                    className="px-3 py-3 hover:bg-muted/30 transition-colors group cursor-default"
                  >
                    {/* Row header: serial + patient + badges */}
                    <div className="flex items-start gap-2">
                      {/* Serial number */}
                      <span className={cn(
                        "flex size-5 items-center justify-center rounded-md text-[10px] font-extrabold shrink-0 mt-0.5",
                        isPaid
                          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                      )}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-foreground truncate">{v.petName}</p>
                          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                            {effectiveMode && isPaid && (
                              <span className={cn(
                                "text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider",
                                effectiveMode === "UPI"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                  : effectiveMode === "Card"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                  : effectiveMode === "Cash"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              )}>
                                {effectiveMode}
                              </span>
                            )}
                            <span className={cn(
                              "shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full",
                              isPaid
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : isPartial
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            )}>
                              {isPaid ? "PAID ✓" : isPartial ? "PARTIAL" : "UNPAID"}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{v.ownerName} · {v.ownerPhone}</p>
                      </div>
                    </div>

                    {/* Invoice + Doctor */}
                    <div className="mt-1.5 ml-7 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                        {v.invoiceNo || v.prescriptionNo || v.visitId}
                      </span>
                      {v.doctorName && (
                        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold truncate max-w-[140px]">
                          Dr: {v.doctorName}
                        </span>
                      )}
                    </div>

                    {/* Progress / Settlement Info */}
                    <div className="mt-2 ml-7 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">
                          {isPaid
                            ? `Paid ₹${(paid || total).toFixed(2)}${effectiveMode ? ` · ${effectiveMode}` : ""}`
                            : `Paid ₹${paid.toFixed(2)} / ₹${total.toFixed(2)}`}
                        </span>
                        <span className={cn(
                          "font-bold",
                          isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {isPaid ? "Fully Settled" : `₹${due.toFixed(2)} due`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isPaid
                              ? "bg-emerald-500 w-full"
                              : "bg-gradient-to-r from-violet-500 to-indigo-500"
                          )}
                          style={{ width: isPaid ? "100%" : `${pctPaid}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Button: Settle Bill & Collect (opens Bill Settlement page) OR View Bill / Rx (if paid) */}
                    <div className="mt-2 ml-7">
                      {!isPaid && due > 0 ? (
                        <button
                          type="button"
                          onClick={() => onOpenConsultation?.({ ...v, openedFromReception: true })}
                          className="w-full h-7 text-[11px] font-bold rounded-lg bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          title="Open bill settlement page to choose payment method (UPI, Card, Cash, NetBanking, etc.)"
                        >
                          <Receipt className="size-3.5" /> Settle Bill &amp; Collect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenConsultation?.({ ...v, openedFromReception: true })}
                          className="w-full h-7 text-[11px] font-bold rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50/70 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                          title="Open finalized visit, invoice & prescription"
                        >
                          <Eye className="size-3" /> View Bill &amp; Rx
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer summary */}
        {filteredSidebarBills.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/60 bg-muted/20 shrink-0 space-y-1">
            {sidebarBillTab === "pending" ? (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-semibold">Total Outstanding</span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400 font-mono text-sm">
                  ₹{filteredSidebarBills.reduce((sum, v) => sum + Number(v.balanceDue ?? v.pendingAmount ?? 0), 0).toFixed(2)}
                </span>
              </div>
            ) : sidebarBillTab === "completed" ? (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-semibold">Total Collected</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  ₹{filteredSidebarBills.reduce((sum, v) => sum + Number(v.amountPaid ?? v.totalAmount ?? 0), 0).toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Total Billed</span>
                  <span className="font-extrabold text-foreground font-mono">
                    ₹{filteredSidebarBills.reduce((sum, v) => sum + Number(v.totalAmount ?? 0), 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Collected: ₹{filteredSidebarBills.reduce((sum, v) => sum + Number(v.amountPaid ?? (Number(v.balanceDue ?? v.pendingAmount ?? 0) <= 0 ? v.totalAmount : 0) ?? 0), 0).toFixed(2)}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    Due: ₹{filteredSidebarBills.reduce((sum, v) => sum + Number(v.balanceDue ?? v.pendingAmount ?? 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
