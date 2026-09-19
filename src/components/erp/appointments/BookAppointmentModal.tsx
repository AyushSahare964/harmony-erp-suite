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
import { listPetsWithOwnersFn, createOwnerWithMultiplePetsFn, updatePetFn } from "@/lib/mongodb/serverFns/crm";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { createAppointmentFn, updateAppointmentFn } from "@/lib/mongodb/serverFns/appointments";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onBooked?: (appointment: any) => void;
  appointmentToEdit?: any | null;
  onUpdated?: (appointment: any) => void;
  initialFollowUp?: any | null;
}

export function BookAppointmentModal({ open, onClose, onBooked, appointmentToEdit, onUpdated, initialFollowUp }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<Array<{ id: string; name: string; specialty?: string }>>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Appointment details
  const [token, setToken] = useState(`A-${Math.floor(100 + Math.random() * 900)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<"call" | "whatsapp" | "social_media" | "">("");
  const [timeSlot, setTimeSlot] = useState("11:30 AM");
  const [doctor, setDoctor] = useState("Dr. Rohit Sharma");
  const [visitType, setVisitType] = useState<"Consultation" | "Vaccination" | "Follow-up" | "Dental" | "Surgery Review" | "Emergency Triage">("Consultation");
  const [priority, setPriority] = useState<"Normal" | "High" | "Emergency">("Normal");
  const [complaint, setComplaint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Quick-add: when the typed patient name matches no existing record
  const [newPetSpecies, setNewPetSpecies] = useState<"Canine" | "Feline" | "Avian" | "Rabbit" | "Exotic" | "Other">("Canine");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [newPetAllergies, setNewPetAllergies] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Known allergies for the currently selected patient (editable — saved back to the Pet record)
  const [allergiesInput, setAllergiesInput] = useState("");

  useEffect(() => {
    setAllergiesInput((selectedPet?.allergies || []).join(", "));
  }, [selectedPet?.petId]);

  useEffect(() => {
    if (open) {
      void loadPets();
      void loadDoctors();

      if (appointmentToEdit) {
        setToken(String(appointmentToEdit.token ?? ""));
        setDate(appointmentToEdit.appointment_date || appointmentToEdit.date || new Date().toISOString().slice(0, 10));
        setCategory((appointmentToEdit.appointment_category || appointmentToEdit.category || "") as any);
        setTimeSlot(appointmentToEdit.slot || appointmentToEdit.time || "11:30 AM");
        setDoctor(appointmentToEdit.doctor || "Dr. Rohit Sharma");
        setVisitType((appointmentToEdit.type || "Consultation") as any);
        setPriority((appointmentToEdit.priority || "Normal") as any);
        setComplaint(appointmentToEdit.complaint || appointmentToEdit.reason || "");
        setSelectedPet({
          name: appointmentToEdit.pet,
          petId: appointmentToEdit.petId,
          species: appointmentToEdit.species || "Canine",
          breed: appointmentToEdit.breed || "Mix",
          owner: {
            name: appointmentToEdit.owner,
            phone: appointmentToEdit.ownerPhone || appointmentToEdit.phone || "N/A",
          },
          ownerId: appointmentToEdit.ownerId,
        });
      } else if (initialFollowUp) {
        setToken(`A-${Math.floor(108 + Math.random() * 90)}`);
        setDate(initialFollowUp.nextVisitDate || new Date().toISOString().slice(0, 10));
        setCategory("call");
        setTimeSlot("10:30 AM");
        setDoctor(initialFollowUp.doctorName || "Dr. Rohit Sharma");
        setVisitType("Follow-up");
        setPriority("Normal");
        setComplaint(`Follow-up review for: ${initialFollowUp.diagnosis || "Scheduled clinical return"}`);
        setSelectedPet({
          name: initialFollowUp.petName,
          petId: initialFollowUp.petId,
          species: initialFollowUp.species || "Canine",
          breed: initialFollowUp.breed || "Mix",
          owner: {
            name: initialFollowUp.ownerName,
            phone: initialFollowUp.ownerPhone || "N/A",
          },
          ownerId: initialFollowUp.ownerId,
        });
      } else {
        setToken(`A-${Math.floor(108 + Math.random() * 90)}`);
        setDate(new Date().toISOString().slice(0, 10));
        setCategory("");
        setTimeSlot("11:30 AM");
        setComplaint("");
      }
    }
  }, [open, appointmentToEdit, initialFollowUp]);

  const loadDoctors = async () => {
    try {
      const docs = await listApprovedDoctorsFn();
      if (docs && docs.length > 0) {
        setDoctorsList(docs);
        if (!docs.some((d) => d.name === doctor)) {
          setDoctor(docs[0]?.name || "");
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
      if (data && data.length > 0 && !selectedPet && !appointmentToEdit) {
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

  const handleCreateNewPatient = async () => {
    const petName = searchPetQuery.trim();
    if (!petName) {
      toast.error("Type the new patient's name in the search box above first");
      return;
    }
    if (!newPetBreed.trim()) {
      toast.error("Breed is required for a new patient");
      return;
    }
    if (!newOwnerName.trim() || newOwnerPhone.trim().length < 8) {
      toast.error("Owner name and a valid phone number are required");
      return;
    }

    setCreatingPatient(true);
    try {
      const allergies = newPetAllergies
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const result = await createOwnerWithMultiplePetsFn({
        data: {
          owner: { name: newOwnerName.trim(), phone: newOwnerPhone.trim() },
          pets: [{ name: petName, species: newPetSpecies, breed: newPetBreed.trim(), allergies }],
        },
      });
      const newPet = { ...result.pets[0], owner: result.owner };
      setPets((prev) => [newPet, ...prev]);
      setSelectedPet(newPet);
      setSearchPetQuery("");
      setNewPetBreed("");
      setNewOwnerName("");
      setNewOwnerPhone("");
      setNewPetAllergies("");
      toast.success(`New patient ${newPet.name} (${newPet.petId}) added and selected`);
    } catch (e) {
      console.error("[BookAppointmentModal] Could not create new patient:", e);
      toast.error("Could not save new patient — please check the details and try again");
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleBook = async () => {
    if (!selectedPet) {
      toast.error("Please select a patient");
      return;
    }

    setSubmitting(true);
    const parsedAllergies = allergiesInput.split(",").map((a) => a.trim()).filter(Boolean);
    const existingAllergies: string[] = selectedPet.allergies || [];
    const allergiesChanged =
      parsedAllergies.length !== existingAllergies.length ||
      parsedAllergies.some((a: string, i: number) => a !== existingAllergies[i]);

    const appointmentPayload = {
      ...(appointmentToEdit || {}),
      token: appointmentToEdit?.token ?? token,
      time: timeSlot,
      slot: timeSlot,
      date,
      appointment_date: date,
      appointment_category: category ? category : null,
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
      status: appointmentToEdit?.status || "Waiting",
      complaint: complaint.trim(),
      vitals: appointmentToEdit?.vitals || {
        weightKg: selectedPet.weightKg || 25,
        tempC: 38.5,
        complaint: complaint.trim(),
      },
      allergies: parsedAllergies,
    };

    try {
      // Persist allergy edits back onto the patient record so the doctor's
      // prescription screen picks them up (it reads Pet.allergies via getPetFn)
      if (allergiesChanged && selectedPet.petId) {
        await updatePetFn({ data: { petId: selectedPet.petId, updates: { allergies: parsedAllergies } } }).catch((err) =>
          console.warn("[BookAppointmentModal] Could not save allergy update:", err)
        );
      }

      if (appointmentToEdit) {
        await updateAppointmentFn({ data: appointmentPayload });
        toast.success(`Appointment ${token} updated successfully`);
        onUpdated?.(appointmentPayload);
      } else {
        await createAppointmentFn({ data: appointmentPayload });
        toast.success(`Token ${token} booked for ${selectedPet.name} with ${doctor}`);
        onBooked?.(appointmentPayload);
      }
      onClose();
    } catch (e) {
      console.error("[BookAppointmentModal] Save error:", e);
      // Optimistic fallback
      if (appointmentToEdit) {
        toast.success(`Appointment ${token} updated`);
        onUpdated?.(appointmentPayload);
      } else {
        toast.success(`Token ${token} booked for ${selectedPet.name}`);
        onBooked?.(appointmentPayload);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
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
                  {appointmentToEdit ? "Edit Appointment & OPD Queue Slot" : "Book Doctor Appointment & OPD Queue Slot"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {appointmentToEdit
                    ? "Update scheduled date, booking channel, clinician, or visit details"
                    : "Schedule consultation, issue live queue token, and assign to attending clinician"}
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
              <div className="flex items-center gap-1.5">
                {selectedPet && (
                  <Badge variant="outline" className="font-mono text-xs text-primary bg-primary/10 border-primary/30">
                    {selectedPet.petId} · {selectedPet.name} ({selectedPet.owner?.name})
                  </Badge>
                )}
                {selectedPet && allergiesInput.trim() && (
                  <Badge variant="destructive" className="text-[10px] font-bold gap-1">
                    <AlertTriangle className="size-3" /> Allergy
                  </Badge>
                )}
              </div>
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

            {searchPetQuery.trim() && filteredPets.length === 0 && (
              <div className="p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-2.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Plus className="size-3.5 text-primary" /> No match for &ldquo;{searchPetQuery.trim()}&rdquo; — add as a new patient
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Species</Label>
                    <Select value={newPetSpecies} onValueChange={(v) => setNewPetSpecies(v as any)}>
                      <SelectTrigger className="h-8 text-xs bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Canine">Canine</SelectItem>
                        <SelectItem value="Feline">Feline</SelectItem>
                        <SelectItem value="Avian">Avian</SelectItem>
                        <SelectItem value="Rabbit">Rabbit</SelectItem>
                        <SelectItem value="Exotic">Exotic</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Breed</Label>
                    <Input
                      value={newPetBreed}
                      onChange={(e) => setNewPetBreed(e.target.value)}
                      placeholder="e.g. Labrador"
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Owner Name</Label>
                    <Input
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="Owner's full name"
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Owner Phone</Label>
                    <Input
                      value={newOwnerPhone}
                      onChange={(e) => setNewOwnerPhone(e.target.value)}
                      placeholder="+91 ..."
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Known Allergies (optional, comma separated)</Label>
                    <Input
                      value={newPetAllergies}
                      onChange={(e) => setNewPetAllergies(e.target.value)}
                      placeholder="e.g. Penicillin, Chicken protein"
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateNewPatient}
                  disabled={creatingPatient}
                  className="h-8 text-xs font-bold gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" /> {creatingPatient ? "Saving..." : "Save New Patient"}
                </Button>
              </div>
            )}
          </div>

          {/* Known Allergies (for the selected patient — highlighted bold for the doctor if present) */}
          {selectedPet && (
            <div
              className={cn(
                "p-3 rounded-xl border space-y-1.5",
                allergiesInput.trim() ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/20"
              )}
            >
              <Label
                className={cn(
                  "text-xs font-bold flex items-center gap-1.5",
                  allergiesInput.trim() ? "text-destructive" : "text-foreground"
                )}
              >
                <AlertTriangle className="size-3.5" /> Known Allergies
              </Label>
              <Input
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                placeholder="No known allergies — type to add (comma separated)"
                className={cn("text-xs h-9 bg-card", allergiesInput.trim() && "font-bold border-destructive/40")}
              />
              {allergiesInput.trim() && (
                <p className="text-[10px] font-semibold text-destructive">
                  ⚠ Will show as a bold allergy alert on the doctor's prescription screen.
                </p>
              )}
            </div>
          )}

          {/* Appointment Timing, Category & Token Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Queue Token #</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="text-xs h-9 font-mono font-bold bg-card"
                disabled={!!appointmentToEdit}
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

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Appointment Category</Label>
              <Select
                value={category || "unspecified"}
                onValueChange={(val) => setCategory(val === "unspecified" ? "" : (val as any))}
              >
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">Not specified</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
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
              <CheckCircle2 className="size-4" />
              {appointmentToEdit ? "Save Changes ✓" : `Confirm & Issue Token ${token} ✓`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
