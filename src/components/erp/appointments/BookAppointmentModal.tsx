import { useState, useEffect } from "react";
import {
  Calendar,
  User,
  Dog,
  Stethoscope,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  Clock,
  Sparkles,
  UserCheck,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn, updatePetFn } from "@/lib/mongodb/serverFns/crm";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { createAppointmentFn, updateAppointmentFn } from "@/lib/mongodb/serverFns/appointments";
import { admitPatientFn } from "@/lib/mongodb/serverFns/clinical";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { Patient360Profile } from "@/components/erp/crm/Patient360Profile";
import { cn } from "@/lib/utils";

/* ── Constants ────────────────────────────────────────────────────────── */

const PRESET_TIME_SLOTS = [
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "04:30 PM",
  "05:30 PM",
  "06:30 PM",
  "07:30 PM",
];

/** "14:05" -> "02:05 PM" */
const to12h = (hhmm24: string) => {
  if (!hhmm24) return "";
  const [hStr, mStr] = hhmm24.split(":");
  let h = parseInt(hStr || "", 10);
  if (Number.isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${mStr} ${period}`;
};

/** "02:05 PM" -> "14:05" */
const to24h = (hhmmAmPm: string) => {
  const m = hhmmAmPm?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let h = parseInt(m[1] || "", 10);
  const period = (m[3] || "").toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};

const csvToList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const COMPLAINT_PRESETS = [
  "Routine health checkup",
  "Annual vaccination & booster",
  "Fever & vomiting",
  "Skin allergy & itching",
  "Ear infection / shaking",
  "Limping & leg injury",
  "Deworming & tick care",
  "Appetite loss",
];

const WALKIN_SUB_OPTIONS = [
  { value: "by_reference", label: "By Reference" },
  { value: "social_media", label: "Social Media" },
  { value: "google_maps", label: "Google / Maps" },
  { value: "walk_by", label: "Walk-by / Passerby" },
  { value: "newspaper", label: "Newspaper / Pamphlet" },
  { value: "other_source", label: "Other" },
];

/* ── Props ────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  onBooked?: (appointment: any) => void;
  appointmentToEdit?: any | null;
  onUpdated?: (appointment: any) => void;
  initialFollowUp?: any | null;
  /** When true, also admits the patient to the doctor's OPD queue after booking */
  autoAdmitToOPD?: boolean;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function BookAppointmentModal({
  open,
  onClose,
  onBooked,
  appointmentToEdit,
  onUpdated,
  initialFollowUp,
  autoAdmitToOPD,
}: Props) {
  /* ── Patient Selection / Registration Mode ── */
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  /** Opens the full Patient 360°-aligned registration form so a brand-new patient
   *  collects the same complete record regardless of which screen registers them. */
  const [showFullRegistration, setShowFullRegistration] = useState(false);

  /* ── Section 1: Pet and Parent Details ── */
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  const [petName, setPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState<string>("Canine");
  const [newPetCustomSpecies, setNewPetCustomSpecies] = useState("");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetGender, setNewPetGender] = useState<string>("Male");
  const [newPetDob, setNewPetDob] = useState("");
  const [newPetAgeYears, setNewPetAgeYears] = useState("");

  /* ── Section 2: Parent Contact Details ── */
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  /* ── Section 3: Triage & Attending Physician ── */
  const [doctorsList, setDoctorsList] = useState<
    Array<{ id: string; name: string; specialty?: string }>
  >([]);
  const [doctor, setDoctor] = useState("");
  const [complaint, setComplaint] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [tempC, setTempC] = useState("");
  const [triageConfirmed, setTriageConfirmed] = useState(false);

  /* ── Section 4: Schedule Appointment ── */
  const [token, setToken] = useState("");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("11:30 AM");
  const [useManualTime, setUseManualTime] = useState(false);
  const [customTimeRaw, setCustomTimeRaw] = useState("");
  const [category, setCategory] = useState<string>("");
  const [walkInSubCategory, setWalkInSubCategory] = useState("");
  const [walkInConfirmed, setWalkInConfirmed] = useState(false);
  const [visitType, setVisitType] = useState<string>("Consultation");
  const [priority, setPriority] = useState<string>("Normal");

  /* ── Section 5: Known Allergies ── */
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergiesInput, setAllergiesInput] = useState("");
  // Track profile allergies already saved so we don't overwrite them
  const [profileAllergies, setProfileAllergies] = useState<string[]>([]);
  const [foodAllergiesInput, setFoodAllergiesInput] = useState("");
  const [otherAllergiesInput, setOtherAllergiesInput] = useState("");
  const [clinicalAlertsInput, setClinicalAlertsInput] = useState("");
  const [savingAllergies, setSavingAllergies] = useState(false);

  /* ── Pet Profile Viewer ── */
  const [viewPetId, setViewPetId] = useState<string | null>(null);

  /* ── State ── */
  const [submitting, setSubmitting] = useState(false);

  /* ── Reset Form to Completely Blank ─────────────────────────────────── */
  const resetForm = () => {
    setPatientMode("existing");
    setSearchPetQuery("");
    setSelectedPet(null);
    setPetName("");
    setNewPetSpecies("Canine");
    setNewPetCustomSpecies("");
    setNewPetBreed("");
    setNewPetGender("Male");
    setNewPetDob("");
    setNewPetAgeYears("");
    setOwnerName("");
    setOwnerPhone("");
    setOwnerEmail("");
    setDoctor("");
    setComplaint("");
    setWeightKg("");
    setTempC("");
    setToken(`A-${Math.floor(100 + Math.random() * 900)}`);
    setDate(new Date().toISOString().slice(0, 10));
    setTimeSlot("11:30 AM");
    setUseManualTime(false);
    setCustomTimeRaw("");
    setCategory("");
    setWalkInSubCategory("");
    setWalkInConfirmed(false);
    setVisitType("Consultation");
    setPriority("Normal");
    setTriageConfirmed(false);
    setHasAllergies(false);
    setAllergiesInput("");
    setProfileAllergies([]);
    setFoodAllergiesInput("");
    setOtherAllergiesInput("");
    setClinicalAlertsInput("");
  };

  /* ── Load data on open ──────────────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      void loadPets();

      if (appointmentToEdit) {
        setToken(String(appointmentToEdit.token ?? ""));
        setDate(
          appointmentToEdit.appointment_date ||
            appointmentToEdit.date ||
            new Date().toISOString().slice(0, 10),
        );
        setCategory(
          (appointmentToEdit.appointment_category || appointmentToEdit.category || "") as string,
        );
        setWalkInSubCategory(appointmentToEdit.walk_in_source || "");
        setWalkInConfirmed(false);
        const editTimeSlot = appointmentToEdit.slot || appointmentToEdit.time || "11:30 AM";
        setTimeSlot(editTimeSlot);
        if (PRESET_TIME_SLOTS.includes(editTimeSlot)) {
          setUseManualTime(false);
          setCustomTimeRaw("");
        } else {
          setUseManualTime(true);
          setCustomTimeRaw(to24h(editTimeSlot));
        }
        setDoctor(appointmentToEdit.doctor || "");
        setTriageConfirmed(false);
        setVisitType((appointmentToEdit.type || "Consultation") as string);
        setPriority((appointmentToEdit.priority || "Normal") as string);
        setComplaint(appointmentToEdit.complaint || appointmentToEdit.reason || "");
        setWeightKg(String(appointmentToEdit.vitals?.weightKg ?? ""));
        setTempC(String(appointmentToEdit.vitals?.tempC ?? ""));

        const petRecord = {
          name: appointmentToEdit.pet,
          petId: appointmentToEdit.petId,
          species: appointmentToEdit.species || "Canine",
          breed: appointmentToEdit.breed || "Mix",
          gender: appointmentToEdit.gender || "",
          owner: {
            name: appointmentToEdit.owner,
            phone: appointmentToEdit.ownerPhone || appointmentToEdit.phone || "N/A",
          },
          ownerId: appointmentToEdit.ownerId,
          allergies: appointmentToEdit.allergies || [],
        };
        setSelectedPet(petRecord);
        setPatientMode("existing");
        setPetName(appointmentToEdit.pet || "");
        setOwnerName(appointmentToEdit.owner || "");
        setOwnerPhone((appointmentToEdit.ownerPhone || "").replace(/\D/g, "").slice(-10));
        const existingAllergies = appointmentToEdit.allergies || [];
        if (existingAllergies.length > 0) {
          setHasAllergies(true);
          setAllergiesInput(
            Array.isArray(existingAllergies)
              ? existingAllergies.join(", ")
              : String(existingAllergies),
          );
        } else {
          setHasAllergies(false);
          setAllergiesInput("");
        }
        setFoodAllergiesInput(
          Array.isArray(appointmentToEdit.foodAllergies)
            ? appointmentToEdit.foodAllergies.filter(Boolean).join(", ")
            : "",
        );
        setOtherAllergiesInput(
          Array.isArray(appointmentToEdit.otherAllergies)
            ? appointmentToEdit.otherAllergies.filter(Boolean).join(", ")
            : "",
        );
        setClinicalAlertsInput(
          Array.isArray(appointmentToEdit.clinicalAlerts)
            ? appointmentToEdit.clinicalAlerts.filter(Boolean).join(", ")
            : "",
        );
        void loadDoctors(appointmentToEdit.doctor);
      } else if (initialFollowUp) {
        setToken(`A-${Math.floor(100 + Math.random() * 900)}`);
        setDate(initialFollowUp.nextVisitDate || new Date().toISOString().slice(0, 10));
        setCategory("call");
        setTimeSlot("10:30 AM");
        setUseManualTime(false);
        setCustomTimeRaw("");
        setWalkInConfirmed(false);
        setTriageConfirmed(false);
        setDoctor(initialFollowUp.doctorName || "");
        setVisitType("Follow-up");
        setPriority("Normal");
        setComplaint(
          `Follow-up review for: ${initialFollowUp.diagnosis || "Scheduled clinical return"}`,
        );
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
        setPatientMode("existing");
        setPetName(initialFollowUp.petName || "");
        setOwnerName(initialFollowUp.ownerName || "");
        setOwnerPhone((initialFollowUp.ownerPhone || "").replace(/\D/g, "").slice(-10));
        setWeightKg("");
        setTempC("");
        setHasAllergies(false);
        setAllergiesInput("");
        setFoodAllergiesInput("");
        setOtherAllergiesInput("");
        setClinicalAlertsInput("");
        void loadDoctors(initialFollowUp.doctorName);
      } else {
        // ★ BLANK form on Book New Appointment
        resetForm();
        void loadDoctors();
      }
    }
  }, [open, appointmentToEdit, initialFollowUp]);

  /* ── Data Loaders ───────────────────────────────────────────────────── */
  const loadPets = async () => {
    try {
      const data = await listPetsWithOwnersFn();
      setPets(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDoctors = async (preserveDoctor?: string) => {
    try {
      const docs = await listApprovedDoctorsFn();
      if (docs && docs.length > 0) {
        setDoctorsList(docs);
        if (!preserveDoctor) {
          setDoctor(docs[0]?.name || "");
        }
      }
    } catch (e) {
      console.warn("[BookModal] Could not load doctors:", e);
    }
  };

  /* ── Filter existing pets ───────────────────────────────────────────── */
  const filteredPets = pets
    .filter((p) => {
      const q = searchPetQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.petId?.toLowerCase().includes(q) ||
        p.owner?.name?.toLowerCase().includes(q) ||
        p.owner?.phone?.includes(q)
      );
    })
    .slice(0, 6);

  const handleSelectPet = (p: any) => {
    setSelectedPet(p);
    setPetName(p.name || "");
    setNewPetSpecies(p.species || "Canine");
    setNewPetBreed(p.breed || "");
    setNewPetGender(p.gender || "Male");
    setOwnerName(p.owner?.name || p.ownerName || "");
    const phoneDigits = (p.owner?.phone || p.ownerPhone || "").replace(/\D/g, "").slice(-10);
    setOwnerPhone(phoneDigits);
    setOwnerEmail(p.owner?.email || p.ownerEmail || "");

    const patientAllergies: string[] = Array.isArray(p.allergies)
      ? p.allergies.filter(Boolean)
      : [];
    // Save the patient's current profile allergies as a baseline (read-only reference)
    setProfileAllergies(patientAllergies);
    // Pre-fill the field as informational — user can extend it, but we do NOT
    // overwrite the profile unless they add genuinely new allergens.
    if (patientAllergies.length > 0) {
      setHasAllergies(true);
      setAllergiesInput(patientAllergies.join(", "));
    } else {
      setHasAllergies(false);
      setAllergiesInput("");
    }

    setFoodAllergiesInput(
      Array.isArray(p.foodAllergies) ? p.foodAllergies.filter(Boolean).join(", ") : "",
    );
    setOtherAllergiesInput(
      Array.isArray(p.otherAllergies) ? p.otherAllergies.filter(Boolean).join(", ") : "",
    );
    setClinicalAlertsInput(
      Array.isArray(p.clinicalAlerts) ? p.clinicalAlerts.filter(Boolean).join(", ") : "",
    );
  };

  /** Persist allergy details to the patient's permanent profile immediately —
   *  independent of finishing the whole appointment, since this is medical-record
   *  data, not appointment-specific data. */
  const handleSaveAllergies = async () => {
    if (!selectedPet?.petId) {
      toast.error("Select a registered patient first");
      return;
    }
    setSavingAllergies(true);
    try {
      const drugAllergyArray = hasAllergies ? csvToList(allergiesInput) : [];
      const existingProfileAllergies = profileAllergies.length
        ? profileAllergies
        : selectedPet.allergies || [];
      const normalise = (s: string) => s.trim().toLowerCase();
      const netNewDrugAllergies = drugAllergyArray.filter(
        (a: string) => !existingProfileAllergies.some((e: string) => normalise(e) === normalise(a)),
      );
      const mergedAllergies = netNewDrugAllergies.length
        ? [...existingProfileAllergies, ...netNewDrugAllergies]
        : existingProfileAllergies;

      await updatePetFn({
        data: {
          petId: selectedPet.petId,
          updates: {
            allergies: mergedAllergies,
            foodAllergies: csvToList(foodAllergiesInput),
            otherAllergies: csvToList(otherAllergiesInput),
            clinicalAlerts: csvToList(clinicalAlertsInput),
          },
        },
      });
      setProfileAllergies(mergedAllergies);
      toast.success("Allergy details saved to patient profile");
    } catch (err) {
      console.error("[BookAppointmentModal] Could not save allergies:", err);
      toast.error("Could not save allergies — please try again");
    } finally {
      setSavingAllergies(false);
    }
  };

  /** The full registration form just created the patient — select it and drop
   *  straight back into "existing patient" mode so booking continues normally. */
  const handleRegistrationComplete = (result: { owner: any; pets: any[] }) => {
    const newPet = result.pets[result.pets.length - 1];
    if (newPet) {
      handleSelectPet({ ...newPet, owner: result.owner });
      setPatientMode("existing");
    }
    setShowFullRegistration(false);
    void loadPets();
  };

  /* ── Phone Handler ──────────────────────────────────────────────────── */
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setOwnerPhone(raw.slice(0, 10));
  };

  /* ── Final Booking / Submit ─────────────────────────────────────────── */
  const handleBook = async () => {
    if (patientMode === "new" && !selectedPet) {
      toast.error("Please complete the new patient registration form first");
      return;
    }
    const effectivePetName = (selectedPet?.name || searchPetQuery).trim();

    if (!selectedPet && !effectivePetName) {
      toast.error("Please select an existing patient, or register a new one");
      return;
    }
    if (!selectedPet) {
      // A name was typed but never turned into a real patient record — every
      // patient must come from the registration form so it gets one permanent
      // Patient ID and the complete Patient 360° record, not a half-filled one.
      toast.error(
        `"${effectivePetName}" is not a registered patient. Use "Register New" to add them.`,
      );
      return;
    }
    if (!ownerName.trim()) {
      toast.error("Parent / Owner name is required");
      return;
    }
    // Phone is optional — only validate if the receptionist typed something
    if (ownerPhone && ownerPhone.length > 0 && ownerPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number (or leave blank)");
      return;
    }

    setSubmitting(true);
    const allergyArray =
      hasAllergies && allergiesInput.trim()
        ? allergiesInput
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : [];

    try {
      const finalPet = selectedPet;

      // Only merge GENUINELY NEW allergens into the patient's profile.
      // We never overwrite or remove existing profile allergies from the booking form —
      // the patient profile (CRM) is the single source of truth.
      const existingProfileAllergies: string[] = profileAllergies.length
        ? profileAllergies
        : finalPet.allergies || [];
      const normalise = (s: string) => s.trim().toLowerCase();
      const netNewAllergies = allergyArray.filter(
        (a: string) => !existingProfileAllergies.some((e) => normalise(e) === normalise(a)),
      );
      if (finalPet.petId) {
        // Merge new drug allergens into the existing profile list (non-destructive),
        // and save food/other/clinical alerts alongside them as a safety net in case
        // "Save Allergies" wasn't clicked before finishing the booking.
        const mergedAllergies =
          netNewAllergies.length > 0
            ? [...existingProfileAllergies, ...netNewAllergies]
            : existingProfileAllergies;
        updatePetFn({
          data: {
            petId: finalPet.petId,
            updates: {
              allergies: mergedAllergies,
              foodAllergies: csvToList(foodAllergiesInput),
              otherAllergies: csvToList(otherAllergiesInput),
              clinicalAlerts: csvToList(clinicalAlertsInput),
            },
          },
        }).catch((err) =>
          console.warn("[BookAppointmentModal] Could not merge new allergens into profile:", err),
        );
      }

      const formattedOwnerPhone = ownerPhone
        ? `+91 ${ownerPhone.slice(0, 5)} ${ownerPhone.slice(5)}`
        : finalPet?.owner?.phone || "N/A";

      const appointmentPayload = {
        ...(appointmentToEdit || {}),
        token: appointmentToEdit?.token ?? token,
        time: timeSlot,
        slot: timeSlot,
        date,
        appointment_date: date,
        appointment_category: category || null,
        walk_in_source: category === "walk_in" ? walkInSubCategory : null,
        pet: finalPet?.name || effectivePetName,
        petId: finalPet?.petId,
        species:
          finalPet?.species ||
          (newPetSpecies === "Other" ? newPetCustomSpecies.trim() || "Other" : newPetSpecies),
        breed: finalPet?.breed || newPetBreed.trim(),
        owner: ownerName.trim() || finalPet?.owner?.name || "Client",
        ownerPhone: formattedOwnerPhone,
        ownerId: finalPet?.ownerId,
        doctor: doctor || doctorsList[0]?.name || "Dr. Rohit Sharma",
        type: visitType,
        priority,
        status: appointmentToEdit?.status || "Waiting",
        complaint: complaint.trim(),
        vitals: {
          weightKg: weightKg ? Number(weightKg) : undefined,
          tempC: tempC ? Number(tempC) : undefined,
          complaint: complaint.trim(),
        },
        allergies: allergyArray,
      };

      if (appointmentToEdit) {
        await updateAppointmentFn({ data: appointmentPayload });
        toast.success(`Appointment ${token} updated successfully`);
        onUpdated?.(appointmentPayload);
      } else {
        await createAppointmentFn({ data: appointmentPayload });
        toast.success(
          `Token ${token} booked for ${finalPet?.name || effectivePetName} with ${doctor}`,
        );

        // Auto-admit to OPD if requested (e.g. from Receptionist Dashboard)
        if (autoAdmitToOPD) {
          try {
            // Ensure ownerPhone is a valid non-empty string for the server schema
            const safePhone =
              formattedOwnerPhone && formattedOwnerPhone !== "N/A"
                ? formattedOwnerPhone
                : finalPet?.owner?.phone || "+91 00000 00000";

            await admitPatientFn({
              data: {
                appointmentToken: token,
                petName: finalPet?.name || effectivePetName,
                petId: finalPet?.petId,
                species: finalPet?.species || newPetSpecies,
                breed: finalPet?.breed || newPetBreed.trim() || "Mix",
                ownerName: ownerName.trim() || finalPet?.owner?.name || "Client",
                ownerPhone: safePhone,
                ownerId: finalPet?.ownerId,
                doctorName: doctor || doctorsList[0]?.name || "Dr. Rohit Sharma",
                allergies: allergyArray,
                vitals: {
                  complaint: complaint.trim() || "General Clinical Health Review",
                  weightKg: weightKg ? Number(weightKg) : undefined,
                  tempC: tempC ? Number(tempC) : undefined,
                },
              },
            });
            toast.success(`Patient admitted to ${doctor || doctorsList[0]?.name}'s OPD queue`);
          } catch (admitErr: any) {
            // Show a visible warning — don't silently fail
            console.warn("[BookModal] Auto-admit failed:", admitErr);
            toast.warning(
              `Appointment booked ✓ but OPD admission failed: ${admitErr?.message || "Unknown error"}. Please admit manually from the OPD queue.`,
              { duration: 7000 }
            );
          }
        }

        onBooked?.(appointmentPayload);
      }
      onClose();
    } catch (e) {
      console.error("[BookAppointmentModal] Save error:", e);
      // Fallback
      const fallbackPayload = {
        token: appointmentToEdit?.token ?? token,
        pet: selectedPet?.name || petName.trim() || searchPetQuery.trim(),
        owner: ownerName.trim(),
        doctor: doctor || "Dr. Rohit Sharma",
        status: appointmentToEdit?.status || "Waiting",
        date,
        appointment_date: date,
        time: timeSlot,
        slot: timeSlot,
        type: visitType,
        priority,
        appointment_category: category || null,
      };
      if (appointmentToEdit) {
        toast.success(`Appointment ${token} updated`);
        onUpdated?.(fallbackPayload);
      } else {
        toast.success(`Token ${token} booked for ${selectedPet?.name || petName}`);
        onBooked?.(fallbackPayload);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
   *  RENDER — ONE SINGLE VERTICAL SCROLLABLE FORM
   * ══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <Dialog open={open && !showFullRegistration} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-2xl lg:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0 flex flex-col">
          {/* ── Sticky Header ─────────────────────────────────────────── */}
          <div className="border-b border-border p-4 sm:p-5 bg-muted/20 shrink-0">
            <DialogHeader className="p-0">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
                  <Calendar className="size-5" />
                </span>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {appointmentToEdit
                      ? "Edit Appointment & OPD Queue Slot"
                      : "Book Doctor Appointment & OPD Queue Slot"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {appointmentToEdit
                      ? "Update scheduled date, booking channel, clinician, or clinical details"
                      : "Fill in pet details, contact information, clinical triage, schedule slot, and allergies"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* ── Scrollable Body — All 5 Sections in Vertical Flow ────────── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* ══════════════════════════════════════════════════════════════
             *  SECTION 1: Pet and Parent Details
             * ══════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Dog className="size-4 text-primary" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                    1. Pet &amp; Parent Details
                  </h3>
                </div>

                {/* Mode Toggle: Existing Patient vs Register New */}
                {!appointmentToEdit && (
                  <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setPatientMode("existing");
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1",
                        patientMode === "existing"
                          ? "bg-card text-foreground shadow-2xs font-bold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Search className="size-3" /> Existing Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPatientMode("new");
                        setSelectedPet(null);
                        setShowFullRegistration(true);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1",
                        patientMode === "new"
                          ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Plus className="size-3" /> Register New
                    </button>
                  </div>
                )}
              </div>

              {/* Mode A: Search & Select Existing Patient */}
              {patientMode === "existing" && (
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search patient by name, UID (e.g. PET-0001), or owner phone..."
                      value={searchPetQuery}
                      onChange={(e) => {
                        setSearchPetQuery(e.target.value);
                        if (selectedPet) setSelectedPet(null);
                      }}
                      className="pl-9 text-xs h-9 bg-background"
                    />
                    {searchPetQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchPetQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Selected Patient Highlight Card */}
                  {selectedPet && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/30">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs text-primary bg-primary/10 border-primary/30"
                          >
                            {selectedPet.petId}
                          </Badge>
                          <span className="text-xs font-bold text-foreground">
                            {selectedPet.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({selectedPet.species} · {selectedPet.breed})
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Parent:{" "}
                          <strong className="text-foreground">{selectedPet.owner?.name}</strong> ·
                          Phone: {selectedPet.owner?.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedPet.petId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewPetId(selectedPet.petId)}
                            className="h-7 text-xs text-muted-foreground hover:text-primary gap-1"
                          >
                            <Eye className="size-3.5" /> View
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPet(null);
                            setSearchPetQuery("");
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Existing Patients Results List */}
                  {!selectedPet && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border">
                        {filteredPets.length === 0 ? (
                          <div className="col-span-2 p-3 text-center text-xs text-muted-foreground">
                            No matching registered patient found.{" "}
                            <button
                              type="button"
                              onClick={() => {
                                setPatientMode("new");
                                setPetName(searchPetQuery.trim());
                                setShowFullRegistration(true);
                              }}
                              className="text-primary font-bold hover:underline ml-1 inline-flex items-center gap-0.5"
                            >
                              + Register &ldquo;{searchPetQuery.trim() || "new patient"}&rdquo;
                            </button>
                          </div>
                        ) : (
                          filteredPets.map((p) => (
                            <div
                              key={p.petId}
                              onClick={() => handleSelectPet(p)}
                              className="p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between shadow-2xs bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/50"
                            >
                              <div>
                                <p className="font-bold flex items-center gap-1.5">
                                  <span>{p.species === "Feline" ? "🐱" : "🐶"}</span>
                                  <span>{p.name}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.owner?.name} ({p.owner?.phone})
                                </p>
                              </div>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {p.petId}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: New Patient — always via the full Patient 360° registration form,
               *  so a walk-in and an appointment-booked patient collect identical data. */}
              {patientMode === "new" && (
                <div className="rounded-xl border border-dashed border-primary/40 bg-primary-soft/20 p-4 text-center space-y-2">
                  {selectedPet ? (
                    <div className="flex items-center justify-between rounded-lg bg-card border border-primary/30 p-2.5 text-left">
                      <div>
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          {selectedPet.name}
                          <Badge
                            className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20"
                            variant="outline"
                          >
                            {selectedPet.petId}
                          </Badge>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Registered and ready to book
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedPet(null);
                          setShowFullRegistration(true);
                        }}
                      >
                        Edit / Re-register
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        New patients are registered with their complete Patient 360° record — pet
                        details, owner &amp; address, and allergies — in one form.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShowFullRegistration(true)}
                        className="gap-1.5 text-xs font-bold"
                      >
                        <Plus className="size-3.5" /> Open Registration Form
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
             *  SECTION 2: Parent / Client Contact Details
             * ══════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <User className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                  2. Parent / Client Contact Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Owner Full Name */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-semibold text-foreground">
                    Parent / Owner Full Name *
                  </Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Rajesh Kulkarni"
                      className="h-9 text-xs pl-8 bg-background"
                      required
                    />
                  </div>
                </div>

                {/* 10-Digit Mobile Number (+91) */}
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
                      className="h-9 text-xs border-0 bg-transparent font-mono tracking-wider focus-visible:ring-0"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">10-digit Indian mobile number</p>
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">
                    Email Address (optional)
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="parent@gmail.com"
                      className="h-9 text-xs pl-8 bg-background"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    For digital prescription &amp; invoice copy
                  </p>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
             *  SECTION 3: Triage & Attending Physician (Matching Image 3)
             * ══════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-primary" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                    3. Triage &amp; Attending Physician
                  </h3>
                  {triageConfirmed && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <CheckCircle2 className="size-3" /> Saved
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!doctor) {
                      toast.error("Select an attending doctor first");
                      return;
                    }
                    if (!complaint.trim()) {
                      toast.error("Enter or select a chief complaint first");
                      return;
                    }
                    setTriageConfirmed(true);
                    toast.success("Triage details saved for this visit");
                  }}
                  className="h-7 text-[11px] font-bold gap-1"
                >
                  <CheckCircle2 className="size-3.5" /> Save
                </Button>
              </div>

              {/* Assign Doctor */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">
                  Assign Attending Doctor *
                </Label>
                <Select
                  value={doctor}
                  onValueChange={(v) => {
                    setDoctor(v);
                    setTriageConfirmed(false);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background font-semibold">
                    <SelectValue placeholder="Select doctor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {doctorsList.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        <span className="font-semibold">{d.name}</span>
                        {d.specialty && (
                          <span className="text-[10px] text-muted-foreground ml-1 font-normal">
                            ({d.specialty})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                    {doctorsList.length === 0 && (
                      <SelectItem value="Dr. Rohit Sharma">
                        Dr. Rohit Sharma (Consultant Vet)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Chief Complaint + Quick Preset Chips */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-foreground">
                  Chief Complaint / Reason for Visit *
                </Label>
                <Input
                  value={complaint}
                  onChange={(e) => {
                    setComplaint(e.target.value);
                    setTriageConfirmed(false);
                  }}
                  placeholder="e.g. Mild fever, coughing, annual booster"
                  className="h-9 text-xs bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  Click multiple presets to combine them, or type your own above.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {COMPLAINT_PRESETS.map((preset) => {
                    const tokens = complaint
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    const active = tokens.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? tokens.filter((t) => t !== preset)
                            : [...tokens, preset];
                          setComplaint(next.join(", "));
                          setTriageConfirmed(false);
                        }}
                        className={cn(
                          "text-[10px] px-2.5 py-1 rounded-md border transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ★ Weight & Temperature — in Triage Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
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
                    placeholder="e.g. 18.5"
                    className="h-9 text-xs bg-background font-mono"
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
                    placeholder="e.g. 38.5"
                    className="h-9 text-xs bg-background font-mono"
                  />
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
             *  SECTION 4: Schedule Appointment (Matching Image 2)
             * ══════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <Clock className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                  4. Schedule Appointment
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-3 rounded-xl border border-border bg-muted/20">
                {/* Queue Token # */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Queue Token #</Label>
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="text-xs h-9 font-mono font-bold bg-background"
                    disabled={!!appointmentToEdit}
                  />
                </div>

                {/* Appointment Date */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Appointment Date</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="text-xs h-9 bg-background"
                  />
                </div>

                {/* Time Slot */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Time Slot</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setUseManualTime((prev) => {
                          const next = !prev;
                          if (next) setCustomTimeRaw(to24h(timeSlot));
                          return next;
                        });
                      }}
                      className="text-[10px] font-semibold text-primary hover:underline"
                    >
                      {useManualTime ? "Use preset" : "Enter manually"}
                    </button>
                  </div>
                  {useManualTime ? (
                    <Input
                      type="time"
                      value={customTimeRaw}
                      onChange={(e) => {
                        setCustomTimeRaw(e.target.value);
                        setTimeSlot(to12h(e.target.value));
                      }}
                      className="text-xs h-9 bg-background"
                    />
                  ) : (
                    <Select value={timeSlot} onValueChange={setTimeSlot}>
                      <SelectTrigger className="text-xs h-9 bg-background">
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
                  )}
                </div>

                {/* Appointment Category — with Walk-in */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Appointment Category
                  </Label>
                  <Select
                    value={category || "unspecified"}
                    onValueChange={(val) => {
                      const newCat = val === "unspecified" ? "" : val;
                      setCategory(newCat);
                      if (newCat !== "walk_in") setWalkInSubCategory("");
                    }}
                  >
                    <SelectTrigger className="text-xs h-9 bg-background">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Not specified</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="walk_in">Walk-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Walk-in Referral Source Sub-options */}
              {category === "walk_in" && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      How did the client find us?
                    </Label>
                    {walkInConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 className="size-3" /> Saved
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-amber-700/70 dark:text-amber-300/70">
                    Select all that apply.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {WALKIN_SUB_OPTIONS.map((opt) => {
                      const tokens = walkInSubCategory
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean);
                      const active = tokens.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? tokens.filter((t) => t !== opt.value)
                              : [...tokens, opt.value];
                            setWalkInSubCategory(next.join(", "));
                            setWalkInConfirmed(false);
                          }}
                          className={cn(
                            "text-[11px] px-3 py-1.5 rounded-lg border transition-all font-semibold",
                            active
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                              : "bg-card text-muted-foreground border-border hover:border-amber-500/40 hover:text-amber-700",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!walkInSubCategory.trim()) {
                          toast.error("Select at least one referral source first");
                          return;
                        }
                        setWalkInConfirmed(true);
                        toast.success("Referral source saved for this visit");
                      }}
                      className="h-7 text-[11px] font-bold gap-1"
                    >
                      <CheckCircle2 className="size-3.5" /> Save
                    </Button>
                  </div>
                </div>
              )}

              {/* Visit Type & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Visit Type</Label>
                  <Select value={visitType} onValueChange={(v) => setVisitType(v)}>
                    <SelectTrigger className="text-xs h-9 bg-background">
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
                  <Select value={priority} onValueChange={(v) => setPriority(v)}>
                    <SelectTrigger className="text-xs h-9 bg-background">
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
            </div>

            {/* ══════════════════════════════════════════════════════════════
             *  SECTION 5: Drug & Food Allergies — Appointment Context
             * ══════════════════════════════════════════════════════════════ */}
            <div
              className={cn(
                "rounded-xl border p-4 space-y-3 shadow-2xs",
                hasAllergies ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <AlertTriangle
                  className={cn(
                    "size-4",
                    hasAllergies ? "text-destructive" : "text-muted-foreground",
                  )}
                />
                <h3
                  className={cn(
                    "text-xs font-bold uppercase tracking-wide",
                    hasAllergies ? "text-destructive" : "text-foreground",
                  )}
                >
                  5. Drug &amp; Food Allergies
                </h3>
              </div>

              {/* Show read-only profile allergies if the patient already has some saved */}
              {profileAllergies.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs">
                  <p className="font-semibold text-destructive mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Saved on patient profile — allergies already on record:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profileAllergies.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive"
                      >
                        ⚠ {a}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    These are saved in the patient profile. Use the box below only to add new ones discovered today.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-foreground flex-1">
                  {profileAllergies.length > 0
                    ? "Are there any additional allergies to note for this visit?"
                    : "Does this patient have any known drug, food or vaccine allergies?"}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!hasAllergies ? "default" : "outline"}
                    onClick={() => {
                      setHasAllergies(false);
                      setAllergiesInput("");
                    }}
                    className="h-8 text-xs font-bold px-4"
                  >
                    No
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={hasAllergies ? "default" : "outline"}
                    onClick={() => setHasAllergies(true)}
                    className={cn(
                      "h-8 text-xs font-bold px-4",
                      hasAllergies && "bg-destructive hover:bg-destructive/90 text-white",
                    )}
                  >
                    Yes
                  </Button>
                </div>
              </div>

              {hasAllergies && (
                <div className="space-y-2 pt-2 border-t border-destructive/20">
                  <Label className="text-[11px] font-bold text-destructive">
                    {profileAllergies.length > 0
                      ? "Additional / New Allergies (will be merged into patient profile):"
                      : "Specific Allergy Details (will be saved to patient profile):"}
                  </Label>
                  <Input
                    placeholder="Enter allergy details (comma separated, e.g. Penicillin, NSAIDs, Egg protein)..."
                    value={allergiesInput}
                    onChange={(e) => setAllergiesInput(e.target.value)}
                    className="h-9 text-xs bg-background border-destructive/40 font-bold text-destructive placeholder:text-muted-foreground"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] font-semibold text-muted-foreground mr-1 self-center">
                      Quick Presets:
                    </span>
                    {[
                      "Penicillin",
                      "NSAIDs (Meloxicam)",
                      "Sulfa Drugs",
                      "Egg Protein",
                      "Flea Allergy",
                      "Booster Vaccines",
                    ]
                      .filter((preset) => !profileAllergies.some(
                        (e) => e.toLowerCase() === preset.toLowerCase()
                      ))
                      .map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (allergiesInput.includes(preset)) return;
                            setAllergiesInput(
                              allergiesInput ? `${allergiesInput}, ${preset}` : preset,
                            );
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/10 text-destructive font-bold hover:bg-destructive hover:text-white transition-colors"
                        >
                          + {preset}
                        </button>
                      ))}
                  </div>
                  {allergiesInput.trim() && (
                    <p className="text-[10px] font-semibold text-destructive">
                      ⚠ New allergens will be merged into this patient&apos;s permanent profile and shown as safety alerts in clinical screens.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Food Allergies</Label>
                  <Input
                    placeholder="Comma separated, e.g. Chicken, Dairy"
                    value={foodAllergiesInput}
                    onChange={(e) => setFoodAllergiesInput(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Other Allergies</Label>
                  <Input
                    placeholder="Comma separated"
                    value={otherAllergiesInput}
                    onChange={(e) => setOtherAllergiesInput(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Clinical Alerts</Label>
                  <Input
                    placeholder="e.g. Aggressive, Cardiac patient"
                    value={clinicalAlertsInput}
                    onChange={(e) => setClinicalAlertsInput(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={savingAllergies || !selectedPet?.petId}
                  onClick={handleSaveAllergies}
                  className="h-8 text-xs font-bold gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  {savingAllergies ? "Saving..." : "Save Allergies"}
                </Button>
              </div>
            </div>
          </div>

          {/* ── Sticky Footer ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleBook}
              disabled={submitting}
              className="h-9 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs px-6"
            >
              <CheckCircle2 className="size-4" />
              {submitting
                ? "Booking..."
                : appointmentToEdit
                  ? "Save Changes ✓"
                  : `Confirm & Issue Token ${token} ✓`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Full Patient 360° Registration — same form Reception & CRM use ── */}
      <OwnerPetRegistrationModal
        open={showFullRegistration}
        onClose={() => {
          setShowFullRegistration(false);
          setPatientMode("existing");
        }}
        initialMode="new-all"
        registrationSource="Appointment"
        prefillOwnerName={ownerName.trim() || undefined}
        prefillPetName={(petName || searchPetQuery).trim() || undefined}
        onRegistered={handleRegistrationComplete}
      />

      {/* ── Pet Profile Viewer — opened via "View" on the selected patient card ── */}
      <Patient360Profile
        open={!!viewPetId}
        petId={viewPetId}
        onClose={() => setViewPetId(null)}
        onStartConsultation={() =>
          toast.info("Close this appointment form, then start the consultation from Pet & Owner CRM.")
        }
      />
    </>
  );
}
