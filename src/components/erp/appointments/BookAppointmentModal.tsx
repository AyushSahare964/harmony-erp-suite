import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  User,
  Dog,
  Stethoscope,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onBooked?: (appointment: any) => void;
}

export function BookAppointmentModal({ open, onClose, onBooked }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<Array<{ id: string; name: string; specialty?: string }>>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Appointment details
  const [token, setToken] = useState(`A-${Math.floor(100 + Math.random() * 900)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState("11:30 AM");
  const [doctor, setDoctor] = useState("Dr. Rohit Sharma");
  const [visitType, setVisitType] = useState<"Consultation" | "Vaccination" | "Follow-up" | "Dental" | "Surgery Review" | "Emergency Triage">("Consultation");
  const [priority, setPriority] = useState<"Normal" | "High" | "Emergency">("Normal");
  const [complaint, setComplaint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPets();
      void loadDoctors();
      setToken(`A-${Math.floor(108 + Math.random() * 90)}`);
    }
  }, [open]);

  const loadDoctors = async () => {
    try {
      const docs = await listApprovedDoctorsFn();
      if (docs && docs.length > 0) {
        setDoctorsList(docs);
        if (!docs.some((d) => d.name === doctor)) {
          setDoctor(docs[0].name);
        }
      }
    } catch (e) {
      console.warn("[BookModal] Could not load doctors:", e);
    }
  };

  const loadPets = async () => {
    try {
      const data = await listPetsWithOwnersFn();
      setPets(data || []);
      if (data && data.length > 0 && !selectedPet) {
        setSelectedPet(data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredPets = pets.filter((p) => {
    const q = searchPetQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.petId?.toLowerCase().includes(q) ||
      p.owner?.name?.toLowerCase().includes(q) ||
      p.owner?.phone?.includes(q)
    );
  }).slice(0, 6);

  const handleBook = () => {
    if (!selectedPet) {
      toast.error("Please select a patient");
      return;
    }

    setSubmitting(true);
    const newAppointment = {
      token,
      time: timeSlot,
      date,
      pet: selectedPet.name,
      petId: selectedPet.petId,
      species: selectedPet.species,
      breed: selectedPet.breed,
      owner: selectedPet.owner?.name || "Client",
      ownerPhone: selectedPet.owner?.phone || "N/A",
      ownerId: selectedPet.ownerId,
      doctor,
      type: visitType,
      priority,
      status: "Waiting",
      complaint: complaint.trim() || "Routine OPD Consultation",
      vitals: {
        weightKg: selectedPet.weightKg || 25,
        tempC: 38.5,
        complaint: complaint.trim() || "Routine Consultation",
      },
    };

    setTimeout(() => {
      setSubmitting(false);
      toast.success(`Token ${token} booked for ${selectedPet.name} with ${doctor}`);
      onBooked?.(newAppointment);
      onClose();
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl border-border bg-card shadow-2xl p-0 gap-0">
        <div className="border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
                <Calendar className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Book Doctor Appointment &amp; OPD Queue Slot
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Schedule consultation, issue live queue token, and assign to attending clinician
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Patient Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Dog className="size-4 text-primary" /> Select Patient &amp; Owner
              </Label>
              {selectedPet && (
                <Badge variant="outline" className="font-mono text-xs text-primary bg-primary/10 border-primary/30">
                  {selectedPet.petId} · {selectedPet.name} ({selectedPet.owner?.name})
                </Badge>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patient by name, UID (e.g. PET-0001), or owner phone..."
                value={searchPetQuery}
                onChange={(e) => setSearchPetQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border">
              {filteredPets.map((p) => {
                const isSelected = selectedPet?.petId === p.petId;
                return (
                  <div
                    key={p.petId}
                    onClick={() => setSelectedPet(p)}
                    className={cn(
                      "p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between shadow-2xs",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <div>
                      <p className="font-bold flex items-center gap-1">
                        <span>{p.species === "Feline" ? "🐱" : "🐶"}</span>
                        <span>{p.name}</span>
                      </p>
                      <p className={cn("text-[10px]", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {p.owner?.name} ({p.owner?.phone})
                      </p>
                    </div>
                    <span className={cn("font-mono text-[10px] px-1 py-0.5 rounded", isSelected ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground")}>
                      {p.petId}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Appointment Timing & Token Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Queue Token #</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="text-xs h-9 font-mono font-bold bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Appointment Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Time Slot</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="09:30 AM">09:30 AM (Morning OPD)</SelectItem>
                  <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                  <SelectItem value="10:30 AM">10:30 AM</SelectItem>
                  <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                  <SelectItem value="11:30 AM">11:30 AM</SelectItem>
                  <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                  <SelectItem value="04:30 PM">04:30 PM (Evening OPD)</SelectItem>
                  <SelectItem value="05:30 PM">05:30 PM</SelectItem>
                  <SelectItem value="06:30 PM">06:30 PM</SelectItem>
                  <SelectItem value="07:30 PM">07:30 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clinician, Visit Type & Triage Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Attending Doctor</Label>
              <Select value={doctor} onValueChange={setDoctor}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {doctorsList.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      <span className="font-semibold">{d.name}</span>
                      {d.specialty && <span className="text-[10px] text-muted-foreground ml-1 font-normal">({d.specialty})</span>}
                    </SelectItem>
                  ))}
                  {doctorsList.length === 0 && (
                    <SelectItem value="Dr. Rohit Sharma">Dr. Rohit Sharma (Consultant Vet)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Visit Type</Label>
              <Select value={visitType} onValueChange={(v) => setVisitType(v as any)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consultation">General Consultation</SelectItem>
                  <SelectItem value="Vaccination">Vaccination / Booster</SelectItem>
                  <SelectItem value="Follow-up">Post-op Follow-up</SelectItem>
                  <SelectItem value="Dental">Dental Prophylaxis</SelectItem>
                  <SelectItem value="Surgery Review">Surgery Review</SelectItem>
                  <SelectItem value="Emergency Triage">Emergency Triage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Triage Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">🟢 Normal Queue</SelectItem>
                  <SelectItem value="High">🟡 High Priority</SelectItem>
                  <SelectItem value="Emergency">🔴 Red / Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Primary Chief Complaint / Reason for Visit</Label>
            <Input
              placeholder="e.g. Mild fever, persistent scratching, annual vaccination booster..."
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBook}
              disabled={submitting || !selectedPet}
              className="font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 px-5"
            >
              <CheckCircle2 className="size-4" /> Confirm &amp; Issue Token {token} ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
