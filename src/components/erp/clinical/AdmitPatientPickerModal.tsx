import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Search,
  User,
  Heart,
  Stethoscope,
  Plus,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useErp } from "@/lib/erp/store";
import { listAppointmentsFn, updateAppointmentStatusFn } from "@/lib/mongodb/serverFns/appointments";
import { searchOwnersFn } from "@/lib/mongodb/serverFns/crm";

interface AdmitPatientPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPatient: (visitDraft: any) => void;
}

export function AdmitPatientPickerModal({
  open,
  onClose,
  onSelectPatient,
}: AdmitPatientPickerModalProps) {
  const { currentUser, role } = useErp();
  const activeDoctorName =
    currentUser?.fullName || (currentUser?.roleId === "doctor" ? currentUser.fullName : role?.person || "Dr. Rohit Sharma");

  const [tab, setTab] = useState<"appointments" | "crm" | "walkin">("appointments");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // CRM Search state
  const [crmOwners, setCrmOwners] = useState<any[]>([]);
  const [crmSearch, setCrmSearch] = useState("");
  const [searchingCrm, setSearchingCrm] = useState(false);

  // Walk-in form state
  const [walkinPetName, setWalkinPetName] = useState("");
  const [walkinSpecies, setWalkinSpecies] = useState("Canine");
  const [walkinBreed, setWalkinBreed] = useState("Labrador");
  const [walkinOwnerName, setWalkinOwnerName] = useState("");
  const [walkinOwnerPhone, setWalkinOwnerPhone] = useState("");
  const [walkinComplaint, setWalkinComplaint] = useState("Routine OPD consultation");
  const [walkinWeight, setWalkinWeight] = useState("25.0");
  const [walkinTemp, setWalkinTemp] = useState("38.5");

  useEffect(() => {
    if (open) {
      void fetchAppointments();
      void handleSearchCrm("");
    }
  }, [open]);

  const fetchAppointments = async () => {
    setLoadingAppts(true);
    try {
      const data = await listAppointmentsFn();
      setAppointments(data);
    } catch (e) {
      console.error("Failed to load appointments:", e);
    } finally {
      setLoadingAppts(false);
    }
  };

  const handleSearchCrm = async (q: string) => {
    setSearchingCrm(true);
    try {
      const data = await searchOwnersFn({ data: q });
      setCrmOwners(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingCrm(false);
    }
  };

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (apt.pet && apt.pet.toLowerCase().includes(q)) ||
        (apt.owner && apt.owner.toLowerCase().includes(q)) ||
        (apt.phone && apt.phone.includes(q)) ||
        (apt.reason && apt.reason.toLowerCase().includes(q)) ||
        (apt.breed && apt.breed.toLowerCase().includes(q)) ||
        String(apt.token).includes(q);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "waiting" && (apt.status === "Waiting" || apt.status === "Scheduled")) ||
        (statusFilter === "in_consultation" && apt.status === "In Consultation") ||
        (statusFilter === "priority" && (apt.priority === "Priority" || apt.priority?.includes("Emergency")));

      return matchSearch && matchStatus;
    });
  }, [appointments, searchQuery, statusFilter]);

  // Handle admit from scheduled appointment
  const handleAdmitAppointment = async (apt: any) => {
    try {
      if (apt.token) {
        await updateAppointmentStatusFn({ data: { token: apt.token, status: "In Consultation" } });
      }
    } catch {
      // continue anyway
    }

    const visitDraft = {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNo: `INV/2026-27/${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: apt.petId || `PET-${Math.floor(1000 + Math.random() * 9000)}`,
      petName: apt.pet || "Patient",
      species: apt.species || "Canine",
      breed: apt.breed || "Crossbreed",
      ownerId: `OWN-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerName: apt.owner || "Pet Parent",
      ownerPhone: apt.phone || "+91 90000 00000",
      doctorName: activeDoctorName,
      vitals: {
        weightKg: 24.5,
        tempC: 38.5,
        complaint: apt.reason || "Scheduled clinical consultation",
      },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };

    toast.success(`Admitted ${apt.pet} (${apt.owner}) to OPD Consultation.`);
    onSelectPatient(visitDraft);
    onClose();
  };

  // Handle admit from CRM pet
  const handleAdmitCrmPet = (owner: any, pet: any) => {
    const visitDraft = {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNo: `INV/2026-27/${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: pet.petId || "PET-0001",
      petName: pet.name || "Patient",
      species: pet.species || "Canine",
      breed: pet.breed || "Standard",
      ownerId: owner.ownerId || "OWN-0001",
      ownerName: owner.name || "Pet Parent",
      ownerPhone: owner.phone || "+91 90000 00000",
      doctorName: activeDoctorName,
      vitals: {
        weightKg: pet.weightKg || 25.0,
        tempC: 38.5,
        complaint: "OPD Consultation & Health Review",
      },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };

    toast.success(`Admitted ${pet.name} (${owner.name}) to OPD.`);
    onSelectPatient(visitDraft);
    onClose();
  };

  // Handle admit walk-in
  const handleAdmitWalkin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinPetName.trim() || !walkinOwnerName.trim()) {
      toast.error("Please enter patient pet name and owner name");
      return;
    }

    const visitDraft = {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNo: `INV/2026-27/${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: `PET-${Math.floor(1000 + Math.random() * 9000)}`,
      petName: walkinPetName.trim(),
      species: walkinSpecies,
      breed: walkinBreed.trim() || "Standard",
      ownerId: `OWN-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerName: walkinOwnerName.trim(),
      ownerPhone: walkinOwnerPhone.trim() || "+91 90000 00000",
      doctorName: activeDoctorName,
      vitals: {
        weightKg: Number(walkinWeight) || 25.0,
        tempC: Number(walkinTemp) || 38.5,
        complaint: walkinComplaint.trim() || "Walk-in OPD consultation",
      },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };

    toast.success(`Admitted Walk-in patient ${walkinPetName} to OPD.`);
    onSelectPatient(visitDraft);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* ── Modal Top Header ────────────────────────────────────────────── */}
        <div className="border-b border-border bg-muted/30 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
              <Stethoscope className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy">Admit Patient to OPD Consultation</h2>
                <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold">
                  OPD Intake
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                First select a patient from today's appointment queue or choose a registered walk-in.
              </p>
            </div>
          </div>

          {/* Active Logged-in Doctor Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-left">
              <span className="text-[10px] text-muted-foreground block leading-none font-semibold">Attending Doctor</span>
              <span className="text-xs font-bold text-foreground block mt-0.5">{activeDoctorName}</span>
            </div>
          </div>
        </div>

        {/* ── Navigation Tab Switcher ────────────────────────────────────── */}
        <div className="px-6 pt-3 border-b border-border/60 bg-muted/10 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTab("appointments")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all",
                tab === "appointments"
                  ? "border-primary text-primary bg-card font-bold shadow-2xs"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Calendar className="size-3.5" />
              1. Scheduled Appointments &amp; Queue ({appointments.length})
            </button>

            <button
              onClick={() => setTab("crm")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all",
                tab === "crm"
                  ? "border-primary text-primary bg-card font-bold shadow-2xs"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="size-3.5" />
              2. Registered Patient Directory
            </button>

            <button
              onClick={() => setTab("walkin")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all",
                tab === "walkin"
                  ? "border-primary text-primary bg-card font-bold shadow-2xs"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Plus className="size-3.5" />
              3. Direct Walk-in Patient
            </button>
          </div>
        </div>

        {/* ── Tab Contents ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: SCHEDULED APPOINTMENTS & QUEUE */}
          {tab === "appointments" && (
            <div className="space-y-4">
              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by pet name, owner name, phone, reason or token #…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-9 bg-card"
                  />
                </div>

                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                  {[
                    { id: "all", label: "All Queue" },
                    { id: "waiting", label: "Waiting" },
                    { id: "priority", label: "Priority / STAT" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
                        statusFilter === f.id
                          ? "bg-primary text-primary-foreground border-primary font-bold"
                          : "bg-card text-muted-foreground border-border hover:border-primary/40"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Appointments List */}
              {loadingAppts ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <Clock className="size-6 animate-spin mx-auto mb-2 text-primary" />
                  Loading patient appointments queue…
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-2xl">
                  <AlertCircle className="size-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-semibold text-foreground">No appointments found matching your search</p>
                  <p className="text-[11px] mt-0.5">Switch to the "Direct Walk-in Patient" tab to admit a new walk-in patient.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredAppointments.map((apt) => (
                    <div
                      key={apt.token || apt.pet}
                      className="erp-card p-4 bg-card hover:border-primary/50 transition-all shadow-2xs space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="size-7 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center font-mono">
                              #{apt.token || 1}
                            </span>
                            <div>
                              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                {apt.pet}
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  ({apt.species} · {apt.breed})
                                </span>
                              </h3>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <User className="size-3" /> {apt.owner} · <Phone className="size-2.5" /> {apt.phone}
                              </p>
                            </div>
                          </div>
                          <StatusPill value={apt.status || "Waiting"} />
                        </div>

                        {/* Slot & Reason Box */}
                        <div className="mt-3 bg-muted/30 rounded-xl p-2.5 text-xs space-y-1 border border-border/50">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground flex items-center gap-1 font-mono">
                              <Clock className="size-3 text-primary" /> {apt.slot || "10:00 AM"}
                            </span>
                            {apt.priority && (
                              <span
                                className={cn(
                                  "font-bold text-[10px] px-1.5 py-0.2 rounded",
                                  apt.priority.includes("Emergency")
                                    ? "bg-destructive/15 text-destructive font-extrabold"
                                    : apt.priority === "Priority"
                                    ? "bg-warning/15 text-warning font-bold"
                                    : "text-muted-foreground"
                                )}
                              >
                                {apt.priority}
                              </span>
                            )}
                          </div>
                          <p className="text-foreground font-medium text-xs pt-0.5">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block">Complaint:</span>
                            {apt.reason || "Routine Consultation"}
                          </p>
                        </div>
                      </div>

                      {/* Admit Action Button */}
                      <Button
                        size="sm"
                        onClick={() => handleAdmitAppointment(apt)}
                        className="w-full h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 mt-2"
                      >
                        <Stethoscope className="size-3.5" /> Admit to OPD / Start Consultation →
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CRM REGISTERED PATIENTS */}
          {tab === "crm" && (
            <div className="space-y-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search registered owner name, phone, or pet name…"
                  value={crmSearch}
                  onChange={(e) => {
                    setCrmSearch(e.target.value);
                    void handleSearchCrm(e.target.value);
                  }}
                  className="pl-8 text-xs h-9 bg-card"
                />
              </div>

              {searchingCrm ? (
                <div className="py-10 text-center text-xs text-muted-foreground">Searching database…</div>
              ) : crmOwners.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">No registered pet owners found.</div>
              ) : (
                <div className="space-y-3">
                  {crmOwners.map((owner) => (
                    <div key={owner.ownerId} className="erp-card p-4 bg-card space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div>
                          <span className="font-bold text-sm text-foreground">{owner.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">
                            {owner.phone} · {owner.ownerId}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{owner.city || "Nagpur"}</span>
                      </div>

                      {/* Owner's Pets List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(owner.pets || []).map((pet: any) => (
                          <div
                            key={pet.petId}
                            className="rounded-xl border border-border/70 bg-muted/20 p-2.5 flex items-center justify-between gap-2 hover:border-primary/40 transition-all"
                          >
                            <div>
                              <span className="font-bold text-xs text-foreground block">{pet.name}</span>
                              <span className="text-[10px] text-muted-foreground block">
                                {pet.species} · {pet.breed} ({pet.ageYears ? `${pet.ageYears}y` : "Adult"})
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdmitCrmPet(owner, pet)}
                              className="h-7 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                            >
                              Admit →
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT WALK-IN PATIENT */}
          {tab === "walkin" && (
            <form onSubmit={handleAdmitWalkin} className="erp-card p-5 space-y-4 bg-card max-w-2xl mx-auto">
              <div>
                <h3 className="text-sm font-bold text-foreground">Direct Walk-in Patient Registration &amp; Intake</h3>
                <p className="text-xs text-muted-foreground">Quickly admit an unregistered walk-in pet for OPD consultation.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Label className="text-xs font-semibold">Pet Name *</Label>
                  <Input
                    required
                    placeholder="e.g. Max, Oscar, Bella"
                    value={walkinPetName}
                    onChange={(e) => setWalkinPetName(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Species</Label>
                  <Select value={walkinSpecies} onValueChange={setWalkinSpecies}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Canine">Canine (Dog)</SelectItem>
                      <SelectItem value="Feline">Feline (Cat)</SelectItem>
                      <SelectItem value="Avian">Avian (Bird)</SelectItem>
                      <SelectItem value="Exotic">Exotic / Small Mammal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Breed</Label>
                  <Input
                    placeholder="e.g. Golden Retriever, Persian"
                    value={walkinBreed}
                    onChange={(e) => setWalkinBreed(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={walkinWeight}
                    onChange={(e) => setWalkinWeight(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Owner / Parent Name *</Label>
                  <Input
                    required
                    placeholder="Full name of pet parent"
                    value={walkinOwnerName}
                    onChange={(e) => setWalkinOwnerName(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Phone Number</Label>
                  <Input
                    placeholder="10-digit mobile number"
                    value={walkinOwnerPhone}
                    onChange={(e) => setWalkinOwnerPhone(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Presenting Complaint / Reason for Visit</Label>
                  <Input
                    placeholder="e.g. Fever, Lethargy, Vomiting, Routine checkup"
                    value={walkinComplaint}
                    onChange={(e) => setWalkinComplaint(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold text-xs">
                  <Stethoscope className="size-3.5 mr-1.5" /> Admit Walk-in &amp; Open Consultation →
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
