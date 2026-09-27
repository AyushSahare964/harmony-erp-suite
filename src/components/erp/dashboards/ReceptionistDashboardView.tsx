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
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { useErp } from "@/lib/erp/store";
import { listVisitsFn, deleteVisitFn } from "@/lib/mongodb/serverFns/clinical";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { BookAppointmentModal } from "@/components/erp/appointments/BookAppointmentModal";

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

  // Quick Intake Modal
  const [showQuickIntakeModal, setShowQuickIntakeModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Registered patients count & data
  const [existingPatients, setExistingPatients] = useState<any[]>([]);

  useEffect(() => {
    void loadData();
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

  const filteredVisits = visits.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.petName?.toLowerCase().includes(q) ||
      v.ownerName?.toLowerCase().includes(q) ||
      v.ownerPhone?.includes(q) ||
      v.visitId?.toLowerCase().includes(q)
    );
  });

  const waitingVisits = visits.filter(
    (v) => v.status !== "Paid" && v.status !== "Settled" && v.status !== "Completed",
  );
  const completedVisits = visits.filter(
    (v) => v.status === "Paid" || v.status === "Settled" || v.status === "Completed",
  );

  const receptionistKpis = [
    {
      label: "Waiting in Lobby",
      value: String(waitingVisits.length),
      trend: waitingVisits.length > 0 ? "Ready for triage" : "Lobby clear",
      trendTone: waitingVisits.length > 0 ? ("up" as const) : ("flat" as const),
    },
    {
      label: "Today's Appointments",
      value: String(visits.length),
      trend: completedVisits.length > 0 ? `${completedVisits.length} completed` : "0 checked in",
      trendTone: visits.length > 0 ? ("up" as const) : ("flat" as const),
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
    <div className="space-y-6">
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
                    <strong className="text-sm font-bold text-foreground">{v.petName}</strong>
                    {v.petId && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[9px] py-0 bg-blue-500/10 text-blue-700 border-blue-500/20"
                      >
                        {v.petId}
                      </Badge>
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
              No patients currently waiting in lobby. Click &ldquo;Quick Patient Intake&rdquo; to
              admit a walk-in patient.
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
    </div>
  );
}
