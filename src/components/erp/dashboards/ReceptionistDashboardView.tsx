import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { ModuleFlashcard } from "@/components/erp/Flashcard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useErp } from "@/lib/erp/store";
import { listVisitsFn, admitPatientFn, deleteVisitFn } from "@/lib/mongodb/serverFns/clinical";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";

interface Props {
  role: any;
  onOpenConsultation?: (visit: any) => void;
}

export function ReceptionistDashboardView({ role, onOpenConsultation }: Props) {
  const { currentUser } = useErp();
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick Intake Modal
  const [showQuickIntakeModal, setShowQuickIntakeModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Intake Form State
  const [existingPatients, setExistingPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("new");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("Canine");
  const [gender, setGender] = useState("Male");
  const [breed, setBreed] = useState("");
  const [doctorName, setDoctorName] = useState("Dr. Rohit Sharma");
  const [complaint, setComplaint] = useState("Routine consultation & health checkup");
  const [weightKg, setWeightKg] = useState("18.5");
  const [tempC, setTempC] = useState("38.5");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitList, patientList] = await Promise.all([
        listVisitsFn(),
        listPetsWithOwnersFn().catch(() => []),
      ]);
      setVisits(visitList || []);
      setExistingPatients(patientList || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExistingPatient = (petId: string) => {
    setSelectedPatientId(petId);
    if (petId === "new") {
      setPetName("");
      setSpecies("Canine");
      setGender("Male");
      setBreed("");
      setOwnerName("");
      setOwnerPhone("");
      setOwnerEmail("");
      return;
    }
    const found = existingPatients.find((p) => p.petId === petId);
    if (found) {
      setPetName(found.name || "");
      setSpecies(found.species || "Canine");
      setGender(found.gender || "Male");
      setBreed(found.breed || "");
      setOwnerName(found.owner?.name || found.ownerName || "");
      // Clean phone to 10 digits
      const phoneDigits = (found.owner?.phone || found.ownerPhone || "").replace(/\D/g, "").slice(-10);
      setOwnerPhone(phoneDigits);
      setOwnerEmail(found.owner?.email || found.ownerEmail || "");
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setOwnerPhone(raw.slice(0, 10));
  };

  const handleCreateIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) {
      toast.error("Please enter the pet/patient name.");
      return;
    }
    if (!ownerName.trim()) {
      toast.error("Please enter the pet parent name.");
      return;
    }
    if (ownerPhone && ownerPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit Indian mobile number (e.g. 98230 44556).");
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedPhone = ownerPhone ? `+91 ${ownerPhone.slice(0, 5)} ${ownerPhone.slice(5)}` : "+91 98000 00000";

      await admitPatientFn({
        data: {
          petName: petName.trim(),
          petId: selectedPatientId !== "new" ? selectedPatientId : `PET-${Math.floor(1000 + Math.random() * 9000)}`,
          species: species || "Canine",
          breed: breed.trim() || "Standard Breed",
          ownerName: ownerName.trim(),
          ownerPhone: formattedPhone,
          doctorName: doctorName || "Dr. Rohit Sharma",
          vitals: {
            complaint: complaint.trim() || "General Clinical Health Review",
            weightKg: Number(weightKg) || undefined,
            tempC: Number(tempC) || undefined,
          },
        },
      });

      toast.success(`Patient ${petName} admitted! Routed directly to ${doctorName}'s OPD queue.`);
      setShowQuickIntakeModal(false);
      // Reset form
      setPetName("");
      setOwnerName("");
      setOwnerPhone("");
      setOwnerEmail("");
      setBreed("");
      setComplaint("Routine consultation & health checkup");
      setSelectedPatientId("new");

      // Refresh list
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to admit patient");
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="space-y-7">
      {/* ── Receptionist Command Header ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-blue-500/10 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
            <CalendarClock className="size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">Front-Desk Triage &amp; Intake Console</h2>
              <span className="bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20">
                Live Queue Sync
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check in walk-in pet parents, record complaint &amp; vitals, and route directly to Doctor OPD.
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
        {role.kpis.map((k: any, idx: number) => (
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
              <p className="text-[11px] text-muted-foreground">Patients registered at front desk awaiting doctor consultation</p>
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
                      <Badge variant="outline" className="font-mono text-[9px] py-0 bg-blue-500/10 text-blue-700 border-blue-500/20">
                        {v.petId}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{v.species} · {v.breed}</p>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    v.status === "PAID" || v.status === "Settled" || v.status === "Completed"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-700 border-blue-500/20"
                  )}
                >
                  {v.status || "Admitted"}
                </span>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1 text-muted-foreground">
                <p><strong className="text-foreground">Parent:</strong> {v.ownerName} ({v.ownerPhone})</p>
                <p className="line-clamp-1"><strong className="text-foreground">Chief Complaint:</strong> {v.vitals?.complaint || "Routine Checkup"}</p>
                <p className="text-blue-700 dark:text-blue-300 font-semibold">Assigned Dr: {v.doctorName || "Dr. Rohit Sharma"}</p>
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
              No patients currently waiting in lobby. Click &ldquo;Quick Patient Intake&rdquo; to admit a walk-in patient.
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

      {/* ── Quick Patient Intake Modal ──────────────────────────────────────── */}
      <Dialog open={showQuickIntakeModal} onOpenChange={setShowQuickIntakeModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-border/80 shadow-xl max-h-[92vh] flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
                <UserPlus className="size-4.5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Quick Patient Intake &amp; OPD Admission
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Register walk-in client, record preliminary triage vitals, and route directly to Doctor OPD.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateIntake} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {/* Existing Patient Lookup Bar */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-1.5">
              <Label className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                <span>Select Existing Patient or Register New</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {existingPatients.length} registered patients
                </span>
              </Label>
              <Select value={selectedPatientId} onValueChange={handleSelectExistingPatient}>
                <SelectTrigger className="h-8.5 text-xs bg-background border-blue-500/20 font-medium">
                  <SelectValue placeholder="Search or select patient..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="new" className="font-bold text-blue-600">
                    + Register New Walk-in Patient
                  </SelectItem>
                  {existingPatients.map((p) => (
                    <SelectItem key={p.petId} value={p.petId}>
                      {p.name} ({p.species} · {p.breed}) — Parent: {p.owner?.name || p.ownerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section 1: Patient Details */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                <PawPrint className="size-3.5 text-blue-600" />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">1. Patient / Pet Details</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Pet / Patient Name *</Label>
                  <Input
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="e.g. Bruno, Bella, Simba"
                    required
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Species *</Label>
                  <Select value={species} onValueChange={setSpecies}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Canine">🐶 Canine (Dog)</SelectItem>
                      <SelectItem value="Feline">🐱 Feline (Cat)</SelectItem>
                      <SelectItem value="Avian">🦜 Avian (Bird)</SelectItem>
                      <SelectItem value="Exotic">🐰 Exotic / Rabbit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Breed / Variety</Label>
                  <Input
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="e.g. Golden Retriever, Persian, Beagle"
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Gender</Label>
                  <div className="flex items-center gap-2 pt-0.5">
                    {["Male", "Female"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={cn(
                          "flex-1 h-7.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                          gender === g
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                        )}
                      >
                        <span>{g === "Male" ? "♂ Male" : "♀ Female"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Pet Parent Information */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                <User className="size-3.5 text-blue-600" />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">2. Pet Parent / Client Contact</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-semibold text-foreground">Parent / Owner Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Rajesh Kulkarni"
                      required
                      className="h-8 text-xs pl-8 bg-background"
                    />
                  </div>
                </div>

                {/* 10-digit Indian Mobile Number */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                    <span>Contact Mobile Number *</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {ownerPhone.length}/10 digits
                    </span>
                  </Label>
                  <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-primary">
                    <span className="bg-muted/60 px-2.5 py-1 text-xs font-bold font-mono text-muted-foreground border-r border-input select-none flex items-center gap-1">
                      <span>🇮🇳</span> +91
                    </span>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={ownerPhone}
                      onChange={handlePhoneChange}
                      placeholder="98230 44556"
                      maxLength={10}
                      className="h-8 text-xs border-0 bg-transparent font-mono tracking-wider focus-visible:ring-0"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">10-digit Indian mobile number</p>
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="parent@gmail.com"
                      className="h-8 text-xs pl-8 bg-background"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">For digital prescription &amp; invoice copy</p>
                </div>
              </div>
            </div>

            {/* Section 3: Clinical Triage & Doctor Assignment */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                <Stethoscope className="size-3.5 text-blue-600" />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">3. Triage &amp; Attending Physician</h4>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">Assign Attending Doctor *</Label>
                <Select value={doctorName} onValueChange={setDoctorName}>
                  <SelectTrigger className="h-8 text-xs bg-background font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr. Rohit Sharma">🩺 Dr. Rohit Sharma (Senior Physician)</SelectItem>
                    <SelectItem value="Dr. Ayush Sahare">🩺 Dr. Ayush Sahare (Consultant Vet)</SelectItem>
                    <SelectItem value="Dr. Ananya Rao">🩺 Dr. Ananya Rao (Surgeon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chief Complaint + Quick Chips */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-foreground">Chief Complaint / Reason for Visit *</Label>
                <Input
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="e.g. Mild fever, coughing, annual booster"
                  className="h-8 text-xs bg-background"
                />
                {/* Quick selection chips */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[
                    "Routine health checkup",
                    "Annual vaccination & booster",
                    "Fever & vomiting",
                    "Skin allergy & itching",
                    "Ear infection / shaking",
                    "Limping & leg injury",
                    "Deworming & tick care",
                    "Appetite loss",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setComplaint(preset)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-md border transition-colors",
                        complaint === preset
                          ? "bg-blue-600 text-white border-blue-600 font-semibold"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vitals */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <span>Weight (kg)</span>
                    <span className="text-[10px] text-muted-foreground">(Preliminary)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="h-8 text-xs bg-background font-mono"
                    placeholder="18.5"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <span>Temperature (°C)</span>
                    <span className="text-[10px] text-muted-foreground">(Normal: 38–39.2°C)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                    className="h-8 text-xs bg-background font-mono"
                    placeholder="38.5"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border sticky bottom-0 bg-background/95 backdrop-blur-xs">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowQuickIntakeModal(false)}
                className="h-8.5 text-xs font-semibold px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 px-5 shadow-xs"
              >
                {isSubmitting ? "Admitting Patient..." : "Admit to Doctor OPD Queue →"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full CRM Registration Modal */}
      <OwnerPetRegistrationModal
        open={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        mode="new-all"
        onRegistered={() => {
          void loadData();
        }}
      />
    </div>
  );
}
