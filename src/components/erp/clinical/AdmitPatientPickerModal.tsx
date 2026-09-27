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
  AlertTriangle,
  X,
  Loader2,
  MapPin,
  Mail,
  Activity,
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
import { searchOwnersFn, createOwnerWithMultiplePetsFn } from "@/lib/mongodb/serverFns/crm";

const COMMON_BREEDS_BY_SPECIES: Record<string, string[]> = {
  Canine: ["Labrador Retriever", "Golden Retriever", "German Shepherd", "Indie / Mixed", "Shih Tzu", "Beagle", "Rottweiler", "Pomeranian", "Pug"],
  Feline: ["Persian", "Domestic Shorthair", "Indie Cat", "Siamese", "British Shorthair", "Maine Coon", "Bengal"],
  Avian: ["Budgerigar", "Cockatiel", "Lovebird", "Indian Ringneck", "Pigeon", "African Grey"],
  Rabbit: ["Netherland Dwarf", "Holland Lop", "Angora", "Domestic Rabbit"],
  Exotic: ["Guinea Pig", "Hamster", "Turtle / Terrapin", "Iguana", "Ferret"],
  Other: ["Mixed / Crossbreed", "Standard"],
};

const QUICK_COMPLAINTS = [
  "Routine OPD consultation",
  "Fever & Lethargy",
  "Vomiting / Diarrhea",
  "Skin Itching & Rash",
  "Loss of Appetite",
  "Ear Infection / Discharge",
  "Limping / Trauma",
  "Vaccination & Deworming",
];

const COMMON_ALLERGIES = [
  "Penicillin",
  "NSAIDs",
  "Sulfa Drugs",
  "Chicken / Poultry",
  "Flea Allergy",
  "Vaccine Reaction",
];

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
  const [speciesCategoryFilter, setSpeciesCategoryFilter] = useState<"all" | "canine" | "feline" | "exotic">("all");

  // Walk-in form comprehensive parameters (aligned with CRM registration)
  const [walkinPetName, setWalkinPetName] = useState("");
  const [walkinSpecies, setWalkinSpecies] = useState<"Canine" | "Feline" | "Avian" | "Rabbit" | "Exotic" | "Other">("Canine");
  const [walkinBreed, setWalkinBreed] = useState("Labrador Retriever");
  const [walkinGender, setWalkinGender] = useState<"Male" | "Female" | "Neutered Male" | "Spayed Female">("Male");
  const [walkinDob, setWalkinDob] = useState("");
  const [walkinAgeYears, setWalkinAgeYears] = useState("2");
  const [walkinAgeMonths, setWalkinAgeMonths] = useState("0");
  const [walkinColor, setWalkinColor] = useState("");
  const [walkinSterilization, setWalkinSterilization] = useState<"Intact" | "Sterilized" | "Unknown">("Intact");
  const [walkinMicrochip, setWalkinMicrochip] = useState("");
  const [walkinAllergies, setWalkinAllergies] = useState<string[]>([]);
  const [customAllergyInput, setCustomAllergyInput] = useState("");

  // Owner details
  const [walkinOwnerName, setWalkinOwnerName] = useState("");
  const [walkinOwnerPhone, setWalkinOwnerPhone] = useState("");
  const [walkinOwnerAltPhone, setWalkinOwnerAltPhone] = useState("");
  const [walkinOwnerEmail, setWalkinOwnerEmail] = useState("");
  const [walkinOwnerCity, setWalkinOwnerCity] = useState("Nagpur");
  const [walkinOwnerAddress, setWalkinOwnerAddress] = useState("");
  const [walkinRelationship, setWalkinRelationship] = useState("Owner");

  // Clinical Vitals & Triage
  const [walkinComplaint, setWalkinComplaint] = useState("Routine OPD consultation");
  const [walkinWeight, setWalkinWeight] = useState("25.0");
  const [walkinTemp, setWalkinTemp] = useState("38.5");
  const [walkinPriority, setWalkinPriority] = useState<"Routine" | "Priority" | "Emergency">("Routine");
  const [walkinDoctor, setWalkinDoctor] = useState(activeDoctorName);
  const [isSubmittingWalkin, setIsSubmittingWalkin] = useState(false);

  const handleSpeciesChange = (newSpecies: "Canine" | "Feline" | "Avian" | "Rabbit" | "Exotic" | "Other") => {
    setWalkinSpecies(newSpecies);
    const defaults = COMMON_BREEDS_BY_SPECIES[newSpecies];
    if (defaults && defaults.length > 0 && (!walkinBreed || COMMON_BREEDS_BY_SPECIES[walkinSpecies]?.includes(walkinBreed))) {
      setWalkinBreed(defaults[0]);
    }
  };

  const handleDobChange = (dobVal: string) => {
    setWalkinDob(dobVal);
    if (dobVal) {
      const birth = new Date(dobVal);
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      let months = now.getMonth() - birth.getMonth();
      if (now.getDate() < birth.getDate()) {
        months--;
      }
      if (months < 0) {
        years--;
        months += 12;
      }
      if (years >= 0) setWalkinAgeYears(String(years));
      if (months >= 0) setWalkinAgeMonths(String(months));
    }
  };

  const handleToggleAllergy = (allergy: string) => {
    setWalkinAllergies((prev) =>
      prev.includes(allergy) ? prev.filter((a) => a !== allergy) : [...prev, allergy]
    );
  };

  const handleAddCustomAllergy = () => {
    const val = customAllergyInput.trim();
    if (val && !walkinAllergies.includes(val)) {
      setWalkinAllergies((prev) => [...prev, val]);
      setCustomAllergyInput("");
    }
  };

  useEffect(() => {
    if (open) {
      void fetchAppointments();
      void handleSearchCrm("", true);
    }
  }, [open]);

  // Debounced background sync for CRM search without UI blocking
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (crmSearch.trim()) {
        void handleSearchCrm(crmSearch, false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [crmSearch, open]);

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

  const handleSearchCrm = async (q: string, isInitial = false) => {
    if (isInitial && crmOwners.length === 0) setSearchingCrm(true);
    try {
      const data = await searchOwnersFn({ data: q });
      if (Array.isArray(data)) {
        if (!q.trim()) {
          setCrmOwners(data);
        } else {
          // Merge newly found owners with existing state so nothing flickers or disappears
          setCrmOwners((prev) => {
            const map = new Map<string, any>();
            data.forEach((o: any) => {
              if (o.ownerId) map.set(o.ownerId, o);
            });
            prev.forEach((o: any) => {
              if (o.ownerId && !map.has(o.ownerId)) map.set(o.ownerId, o);
            });
            return Array.from(map.values());
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isInitial) setSearchingCrm(false);
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

  // Flatten registered patients (Pet + Owner) into individual flashcards with instant dynamic filtering
  const { allRegisteredPetCards, speciesCounts, totalAvailableCount } = useMemo(() => {
    const rawList: Array<{ pet: any; owner: any; isPlaceholder?: boolean }> = [];
    crmOwners.forEach((owner) => {
      if (Array.isArray(owner.pets) && owner.pets.length > 0) {
        owner.pets.forEach((pet: any) => {
          rawList.push({ pet, owner });
        });
      } else {
        rawList.push({
          pet: {
            name: `${owner.name}'s Pet`,
            species: "Canine",
            breed: "General",
            petId: owner.ownerId ? `P-${owner.ownerId.replace(/[^0-9]/g, "") || "01"}` : "P-01",
          },
          owner,
          isPlaceholder: true,
        });
      }
    });

    const q = crmSearch.toLowerCase().trim();

    // Dynamic instant filtering across all patient & owner properties
    const searchedList = rawList.filter((item) => {
      if (!q) return true;
      const petName = String(item.pet?.name || "").toLowerCase();
      const petBreed = String(item.pet?.breed || "").toLowerCase();
      const petSpecies = String(item.pet?.species || "").toLowerCase();
      const petId = String(item.pet?.petId || "").toLowerCase();
      const ownerName = String(item.owner?.name || "").toLowerCase();
      const ownerPhone = String(item.owner?.phone || "").toLowerCase();
      const ownerId = String(item.owner?.ownerId || "").toLowerCase();
      const ownerCity = String(item.owner?.city || "").toLowerCase();
      const microchip = String(item.pet?.microchipNumber || "").toLowerCase();

      return (
        petName.includes(q) ||
        petBreed.includes(q) ||
        petSpecies.includes(q) ||
        petId.includes(q) ||
        ownerName.includes(q) ||
        ownerPhone.includes(q) ||
        ownerId.includes(q) ||
        ownerCity.includes(q) ||
        microchip.includes(q)
      );
    });

    // Dynamic category counts based on current search query
    const counts = {
      all: searchedList.length,
      canine: searchedList.filter((i) => {
        const sp = String(i.pet.species || "").toLowerCase();
        return sp.includes("canine") || sp.includes("dog");
      }).length,
      feline: searchedList.filter((i) => {
        const sp = String(i.pet.species || "").toLowerCase();
        return sp.includes("feline") || sp.includes("cat");
      }).length,
      exotic: searchedList.filter((i) => {
        const sp = String(i.pet.species || "").toLowerCase();
        return !sp.includes("canine") && !sp.includes("dog") && !sp.includes("feline") && !sp.includes("cat");
      }).length,
    };

    const filtered = searchedList.filter((item) => {
      if (speciesCategoryFilter === "all") return true;
      const sp = String(item.pet.species || "").toLowerCase();
      if (speciesCategoryFilter === "canine") return sp.includes("canine") || sp.includes("dog");
      if (speciesCategoryFilter === "feline") return sp.includes("feline") || sp.includes("cat");
      if (speciesCategoryFilter === "exotic") {
        return !sp.includes("canine") && !sp.includes("dog") && !sp.includes("feline") && !sp.includes("cat");
      }
      return true;
    });

    return {
      allRegisteredPetCards: filtered,
      speciesCounts: counts,
      totalAvailableCount: rawList.length,
    };
  }, [crmOwners, crmSearch, speciesCategoryFilter]);

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
      appointmentToken: apt.token ? String(apt.token) : undefined,
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

  // Handle admit walk-in with real MongoDB CRM registration & OPD draft creation
  const handleAdmitWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinPetName.trim()) {
      toast.error("Please enter the patient's pet name");
      return;
    }
    if (!walkinOwnerName.trim()) {
      toast.error("Please enter the pet parent / owner's name");
      return;
    }
    const cleanPhone = walkinOwnerPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error("Please enter a valid mobile number (at least 8–10 digits)");
      return;
    }

    setIsSubmittingWalkin(true);

    try {
      // 1. Persist directly into MongoDB CRM with auto-generated sequential IDs
      const res = await createOwnerWithMultiplePetsFn({
        data: {
          owner: {
            name: walkinOwnerName.trim(),
            phone: cleanPhone,
            altPhone: walkinOwnerAltPhone.replace(/\D/g, "") || undefined,
            email: walkinOwnerEmail.trim() || undefined,
            city: walkinOwnerCity.trim() || "Nagpur",
            address: walkinOwnerAddress.trim() || "Direct walk-in registration",
            relationship: walkinRelationship || "Owner",
            preferredPaymentMode: "UPI",
            outstandingBalance: 0,
          },
          pets: [
            {
              name: walkinPetName.trim(),
              species: walkinSpecies,
              breed: walkinBreed.trim() || "Mixed / Standard",
              gender: walkinGender,
              dob: walkinDob || undefined,
              ageYears: walkinAgeYears ? Number(walkinAgeYears) : undefined,
              ageMonths: walkinAgeMonths ? Number(walkinAgeMonths) : undefined,
              color: walkinColor.trim() || undefined,
              weightKg: walkinWeight ? Number(walkinWeight) : undefined,
              sterilizationStatus: walkinSterilization,
              microchipNo: walkinMicrochip.trim() || undefined,
              allergies: walkinAllergies,
              registrationSource: "Walk-In",
              status: "Active",
            },
          ],
        },
      });

      const createdOwner = res?.owner;
      const createdPet = res?.pets?.[0];

      // Update CRM state dynamically so the new patient immediately appears in Directory
      if (createdOwner && createdPet) {
        setCrmOwners((prev) => [{ ...createdOwner, pets: [createdPet] }, ...prev]);
      }

      const generatedVisitId = `V-${Math.floor(1000 + Math.random() * 9000)}`;
      const visitDraft = {
        visitId: generatedVisitId,
        invoiceNo: `INV/2026-27/${Math.floor(1000 + Math.random() * 9000)}`,
        prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toISOString().slice(0, 10),
        branch: "Main Clinic",
        billType: "GST",
        petId: createdPet?.petId || `PET-${Math.floor(1000 + Math.random() * 9000)}`,
        petName: createdPet?.name || walkinPetName.trim(),
        species: createdPet?.species || walkinSpecies,
        breed: createdPet?.breed || walkinBreed.trim() || "Standard",
        gender: createdPet?.gender || walkinGender,
        dob: createdPet?.dob || walkinDob || undefined,
        ownerId: createdOwner?.ownerId || `OWN-${Math.floor(1000 + Math.random() * 9000)}`,
        ownerName: createdOwner?.name || walkinOwnerName.trim(),
        ownerPhone: createdOwner?.phone || cleanPhone,
        doctorName: walkinDoctor || activeDoctorName,
        vitals: {
          weightKg: Number(walkinWeight) || 0,
          tempC: Number(walkinTemp) || 38.5,
          complaint: walkinComplaint.trim() || "Walk-in OPD consultation",
          priority: walkinPriority,
        },
        status: "Admitted",
        items: [],
        subtotal: 0,
        totalAmount: 0,
        amountPaid: 0,
      };

      toast.success(`Registered & admitted walk-in patient ${walkinPetName} (${walkinOwnerName}) to OPD.`);
      onSelectPatient(visitDraft);
      onClose();
    } catch (err: any) {
      console.error("Failed to register walk-in patient to MongoDB CRM:", err);
      // Fallback in-memory visit draft so consultation flow is never blocked
      const fallbackVisitDraft = {
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
        gender: walkinGender,
        dob: walkinDob || undefined,
        ownerId: `OWN-${Math.floor(1000 + Math.random() * 9000)}`,
        ownerName: walkinOwnerName.trim(),
        ownerPhone: cleanPhone,
        doctorName: walkinDoctor || activeDoctorName,
        vitals: {
          weightKg: Number(walkinWeight) || 25.0,
          tempC: Number(walkinTemp) || 38.5,
          complaint: walkinComplaint.trim() || "Walk-in OPD consultation",
          priority: walkinPriority,
        },
        status: "Admitted",
        items: [],
        subtotal: 0,
        totalAmount: 0,
        amountPaid: 0,
      };
      toast.success(`Admitted walk-in patient ${walkinPetName} to OPD.`);
      onSelectPatient(fallbackVisitDraft);
      onClose();
    } finally {
      setIsSubmittingWalkin(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
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
              2. Registered Patient Directory ({speciesCounts.all})
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
                <div className="group relative flex items-center w-full flex-1 rounded-full bg-muted/30 hover:bg-muted/50 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 border border-border/60 transition-all duration-200 px-3.5 h-9 shadow-2xs">
                  <Search className="size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by pet name, owner, phone, reason, or token #…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchQuery("");
                    }}
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none border-none p-0 pr-2 font-normal"
                  />
                  {searchQuery && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-medium text-muted-foreground/70 bg-background/80 px-2 py-0.5 rounded-full border border-border/40 select-none">
                        {filteredAppointments.length} found
                      </span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        title="Clear search (Esc)"
                        className="size-4.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto shrink-0 py-0.5">
                  {[
                    { id: "all", label: "All Queue" },
                    { id: "waiting", label: "Waiting" },
                    { id: "priority", label: "Priority / STAT" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer select-none",
                        statusFilter === f.id
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/30"
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
                            {apt.reason || "General Checkup"}
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

          {/* TAB 2: CRM REGISTERED PATIENTS — FLASH CARDS GRID */}
          {tab === "crm" && (
            <div className="space-y-3.5">
              {/* Minimalist Dynamic Search & Species Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="group relative flex items-center w-full flex-1 rounded-full bg-muted/30 hover:bg-muted/50 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 border border-border/60 transition-all duration-200 px-3.5 h-10 shadow-2xs">
                  <Search className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search registered pet, owner, phone, breed, or ID…"
                    value={crmSearch}
                    onChange={(e) => setCrmSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setCrmSearch("");
                    }}
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none border-none p-0 pr-2 font-normal"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    {searchingCrm && (
                      <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                    )}
                    {crmSearch && (
                      <>
                        <span className="text-[10px] font-medium text-muted-foreground/70 bg-background/80 px-2 py-0.5 rounded-full border border-border/40 select-none">
                          {allRegisteredPetCards.length} found
                        </span>
                        <button
                          type="button"
                          onClick={() => setCrmSearch("")}
                          title="Clear search (Esc)"
                          className="size-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    )}
                    {!crmSearch && (
                      <kbd className="hidden sm:inline-block text-[10px] text-muted-foreground/40 font-mono px-1.5 py-0.5 rounded bg-background/60 border border-border/30 select-none">
                        ESC
                      </kbd>
                    )}
                  </div>
                </div>

                {/* Minimalist Species Filter Pills */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto shrink-0 py-0.5">
                  {[
                    { id: "all", label: "All", count: speciesCounts.all },
                    { id: "canine", label: "Dogs 🐶", count: speciesCounts.canine },
                    { id: "feline", label: "Cats 🐱", count: speciesCounts.feline },
                    { id: "exotic", label: "Exotics 🦎", count: speciesCounts.exotic },
                  ].map((f) => {
                    const active = speciesCategoryFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSpeciesCategoryFilter(f.id as any)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap select-none",
                          active
                            ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                            : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/30"
                        )}
                      >
                        <span>{f.label}</span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold",
                            active
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted/80 text-muted-foreground"
                          )}
                        >
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minimal Active Search Context Row */}
              {(crmSearch.trim() || speciesCategoryFilter !== "all") && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span>
                      Showing <strong className="text-foreground font-semibold">{allRegisteredPetCards.length}</strong> of {totalAvailableCount} registered patients
                    </span>
                    {crmSearch.trim() && (
                      <span className="text-muted-foreground/70">
                        matching &ldquo;<span className="text-foreground font-medium">{crmSearch}</span>&rdquo;
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCrmSearch("");
                      setSpeciesCategoryFilter("all");
                    }}
                    className="text-primary hover:underline font-medium text-[11px] cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              )}

              {/* Patient Flashcards Grid / Minimal Empty State */}
              {allRegisteredPetCards.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground bg-muted/15 border border-dashed border-border/60 rounded-2xl p-6">
                  <Search className="size-7 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="font-semibold text-foreground text-sm">No matching patients found</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                    {crmSearch
                      ? `We couldn't find any registered pet or owner matching "${crmSearch}".`
                      : "No registered patients in this category."}
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs rounded-full"
                      onClick={() => {
                        setCrmSearch("");
                        setSpeciesCategoryFilter("all");
                      }}
                    >
                      Clear Search & Filters
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs rounded-full gap-1.5"
                      onClick={() => setTab("walkin")}
                    >
                      <Plus className="size-3" /> Admit as Direct Walk-in
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {allRegisteredPetCards.map((item) => {
                    const sp = String(item.pet.species || "").toLowerCase();
                    const isCat = sp.includes("feline") || sp.includes("cat");
                    const isDog = sp.includes("canine") || sp.includes("dog");

                    const hasAllergy = Boolean(
                      (Array.isArray(item.pet.allergies) && item.pet.allergies.length > 0) ||
                      (item.pet.allergies && String(item.pet.allergies).trim().length > 0)
                    );

                    return (
                      <div
                        key={`${item.owner.ownerId}-${item.pet.petId || item.pet.name}`}
                        className="group relative rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between p-4 shadow-2xs overflow-hidden"
                      >
                        {/* Top species color accent bar */}
                        <div
                          className={cn(
                            "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
                            isCat
                              ? "from-amber-400 to-orange-500"
                              : isDog
                              ? "from-blue-500 to-indigo-600"
                              : "from-emerald-400 to-teal-500"
                          )}
                        />

                        <div className="space-y-3">
                          {/* Pet Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={cn(
                                  "size-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-xs shrink-0",
                                  isCat
                                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                    : isDog
                                    ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                )}
                              >
                                {isCat ? "🐱" : isDog ? "🐶" : "🦎"}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-extrabold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                    {item.pet.name}
                                  </h4>
                                  {item.pet.petId && (
                                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-bold">
                                      {item.pet.petId}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                                  {item.pet.species} · {item.pet.breed}
                                  {item.pet.ageYears ? ` (${item.pet.ageYears}y)` : ""}
                                </p>
                              </div>
                            </div>

                            <span
                              className={cn(
                                "text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0",
                                isCat
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                  : isDog
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                              )}
                            >
                              {item.pet.species || "Pet"}
                            </span>
                          </div>

                          {/* Owner & Contact Pill */}
                          <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1 border border-border/50">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground truncate flex items-center gap-1">
                                <User className="size-3 text-muted-foreground shrink-0" />
                                <span className="truncate">{item.owner.name}</span>
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {item.owner.city || "Nagpur"}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                              <Phone className="size-2.5 text-primary shrink-0" /> {item.owner.phone}
                            </p>
                          </div>

                          {/* Documented Allergies Tag */}
                          {hasAllergy && (
                            <div className="text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-0.5 flex items-center gap-1">
                              <AlertTriangle className="size-3 shrink-0" />
                              <span className="truncate">
                                Allergy: {Array.isArray(item.pet.allergies) ? item.pet.allergies.join(", ") : String(item.pet.allergies)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quick Admit Action Button */}
                        <Button
                          size="sm"
                          onClick={() => handleAdmitCrmPet(item.owner, item.pet)}
                          className="w-full h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 mt-3 shadow-2xs hover:shadow-xs group-hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <Stethoscope className="size-3.5" /> Admit {item.pet.name} to OPD →
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT WALK-IN PATIENT — COMPREHENSIVE CLINICAL INTAKE */}
          {tab === "walkin" && (
            <form onSubmit={handleAdmitWalkin} className="space-y-4 max-w-4xl mx-auto pb-4">
              {/* Header Banner */}
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                    ✨
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Direct Walk-in Patient Registration &amp; OPD Intake
                      <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full border border-primary/20">
                        Auto CRM Sync
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Register a new pet parent &amp; patient into clinic database and admit directly to consultation queue.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40 shrink-0">
                  <User className="size-3.5 text-primary" />
                  <span>Attending: <strong className="text-foreground">{walkinDoctor || activeDoctorName}</strong></span>
                </div>
              </div>

              {/* ── SECTION 1: PATIENT (PET) DETAILS ── */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center text-xs font-bold">
                      🐾
                    </span>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Patient (Pet) Profile
                    </h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Step 1 of 3</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Pet Name */}
                  <div className="lg:col-span-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Pet Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="e.g. Leo, Max, Bella, Oscar"
                      value={walkinPetName}
                      onChange={(e) => setWalkinPetName(e.target.value)}
                      className="h-8.5 text-xs mt-1"
                    />
                  </div>

                  {/* Species */}
                  <div>
                    <Label className="text-xs font-semibold">Species</Label>
                    <Select value={walkinSpecies} onValueChange={(val: any) => handleSpeciesChange(val)}>
                      <SelectTrigger className="h-8.5 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Canine">🐶 Canine (Dog)</SelectItem>
                        <SelectItem value="Feline">🐱 Feline (Cat)</SelectItem>
                        <SelectItem value="Avian">🦜 Avian (Bird)</SelectItem>
                        <SelectItem value="Rabbit">🐇 Rabbit</SelectItem>
                        <SelectItem value="Exotic">🦎 Exotic / Reptile</SelectItem>
                        <SelectItem value="Other">🐾 Other Species</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender */}
                  <div>
                    <Label className="text-xs font-semibold">Gender</Label>
                    <Select value={walkinGender} onValueChange={(val: any) => setWalkinGender(val)}>
                      <SelectTrigger className="h-8.5 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male ♂</SelectItem>
                        <SelectItem value="Female">Female ♀</SelectItem>
                        <SelectItem value="Neutered Male">Neutered Male</SelectItem>
                        <SelectItem value="Spayed Female">Spayed Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Breed */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Breed</Label>
                      <span className="text-[10px] text-muted-foreground">Pick quick suggestion or type</span>
                    </div>
                    <Input
                      placeholder="e.g. Labrador Retriever, Persian"
                      value={walkinBreed}
                      onChange={(e) => setWalkinBreed(e.target.value)}
                      className="h-8.5 text-xs mt-1"
                    />
                    {/* Quick Breed Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pt-1.5 scrollbar-none">
                      {(COMMON_BREEDS_BY_SPECIES[walkinSpecies] || []).slice(0, 5).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setWalkinBreed(b)}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] transition-colors whitespace-nowrap cursor-pointer",
                            walkinBreed.toLowerCase() === b.toLowerCase()
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date of Birth (DOB) */}
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <span>Date of Birth</span>
                      <span className="text-[10px] text-muted-foreground font-normal">(DOB)</span>
                    </Label>
                    <Input
                      type="date"
                      value={walkinDob}
                      onChange={(e) => handleDobChange(e.target.value)}
                      className="h-8.5 text-xs mt-1"
                    />
                  </div>

                  {/* Age (Years & Months) */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Age (Years / Mos)</Label>
                      {walkinDob && (
                        <span className="text-[10px] text-primary font-semibold">Auto-computed</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        placeholder="Yrs"
                        value={walkinAgeYears}
                        onChange={(e) => {
                          setWalkinAgeYears(e.target.value);
                          if (e.target.value && !walkinDob) {
                            const d = new Date();
                            d.setFullYear(d.getFullYear() - Number(e.target.value));
                            setWalkinDob(d.toISOString().slice(0, 10));
                          }
                        }}
                        className="h-8.5 text-xs"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="11"
                        placeholder="Mos"
                        value={walkinAgeMonths}
                        onChange={(e) => setWalkinAgeMonths(e.target.value)}
                        className="h-8.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Color / Coat */}
                  <div>
                    <Label className="text-xs font-semibold">Coat / Color</Label>
                    <Input
                      placeholder="e.g. Golden, Fawn, Calico"
                      value={walkinColor}
                      onChange={(e) => setWalkinColor(e.target.value)}
                      className="h-8.5 text-xs mt-1"
                    />
                  </div>

                  {/* Sterilization */}
                  <div>
                    <Label className="text-xs font-semibold">Sterilization Status</Label>
                    <Select value={walkinSterilization} onValueChange={(val: any) => setWalkinSterilization(val)}>
                      <SelectTrigger className="h-8.5 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Intact">Intact</SelectItem>
                        <SelectItem value="Sterilized">Sterilized</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Microchip / Tag */}
                  <div className="lg:col-span-2">
                    <Label className="text-xs font-semibold">Microchip No. / Identification Tag (Optional)</Label>
                    <Input
                      placeholder="15-digit RFID microchip or municipal tag #"
                      value={walkinMicrochip}
                      onChange={(e) => setWalkinMicrochip(e.target.value)}
                      className="h-8.5 text-xs mt-1"
                    />
                  </div>
                </div>

                {/* Allergies & Alerts */}
                <div className="pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertTriangle className="size-3.5" /> Known Allergies &amp; Drug Reaction Alerts
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Select all that apply</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {COMMON_ALLERGIES.map((allergy) => {
                      const active = walkinAllergies.includes(allergy);
                      return (
                        <button
                          key={allergy}
                          type="button"
                          onClick={() => handleToggleAllergy(allergy)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                            active
                              ? "bg-destructive text-destructive-foreground border-destructive font-bold shadow-xs"
                              : "bg-muted/40 text-muted-foreground border-border/60 hover:border-destructive/40 hover:text-destructive"
                          )}
                        >
                          {allergy}
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-1 ml-1">
                      <Input
                        placeholder="+ Add custom allergy…"
                        value={customAllergyInput}
                        onChange={(e) => setCustomAllergyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomAllergy();
                          }
                        }}
                        className="h-7 text-[11px] w-36"
                      />
                      {customAllergyInput.trim() && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={handleAddCustomAllergy}
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION 2: PET PARENT / OWNER DETAILS ── */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-bold">
                      👤
                    </span>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Pet Parent / Owner Details
                    </h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Step 2 of 3</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Full Name */}
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Parent / Owner Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="e.g. Ramesh Patel, Sunita Sharma"
                      value={walkinOwnerName}
                      onChange={(e) => setWalkinOwnerName(e.target.value)}
                      className="h-8.5 text-xs mt-1"
                    />
                  </div>

                  {/* Primary Phone */}
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Primary Mobile Number <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        required
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        value={walkinOwnerPhone}
                        onChange={(e) => setWalkinOwnerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="pl-8 h-8.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Relationship */}
                  <div>
                    <Label className="text-xs font-semibold">Relationship</Label>
                    <Select value={walkinRelationship} onValueChange={setWalkinRelationship}>
                      <SelectTrigger className="h-8.5 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Owner">Primary Owner</SelectItem>
                        <SelectItem value="Co-owner">Co-owner</SelectItem>
                        <SelectItem value="Family Member">Family Member</SelectItem>
                        <SelectItem value="Caretaker">Caretaker</SelectItem>
                        <SelectItem value="Foster">Foster Parent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Alternate Phone */}
                  <div>
                    <Label className="text-xs font-semibold">Alternate / Emergency Contact</Label>
                    <Input
                      type="tel"
                      maxLength={10}
                      placeholder="Optional alternate phone"
                      value={walkinOwnerAltPhone}
                      onChange={(e) => setWalkinOwnerAltPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="h-8.5 text-xs mt-1 font-mono"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Label className="text-xs font-semibold">Email Address (Optional)</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="parent@example.com"
                        value={walkinOwnerEmail}
                        onChange={(e) => setWalkinOwnerEmail(e.target.value)}
                        className="pl-8 h-8.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <Label className="text-xs font-semibold">City</Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        placeholder="City"
                        value={walkinOwnerCity}
                        onChange={(e) => setWalkinOwnerCity(e.target.value)}
                        className="pl-8 h-8.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Residential Address */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs font-semibold">Address / Landmark (Optional)</Label>
                    <Input
                      placeholder="Flat, street name, locality or landmark"
                      value={walkinOwnerAddress}
                      onChange={(e) => setWalkinOwnerAddress(e.target.value)}
                      className="h-8.5 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* ── SECTION 3: CLINICAL INTAKE & VITALS ── */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center text-xs font-bold">
                      🩺
                    </span>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Clinical Intake &amp; Vitals (OPD Triage)
                    </h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Step 3 of 3</span>
                </div>

                {/* Presenting Complaint & Quick Chips */}
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    Chief Presenting Complaint / Reason for Visit <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    required
                    placeholder="e.g. Vomiting since 2 days, Fever & lethargy, Routine checkup"
                    value={walkinComplaint}
                    onChange={(e) => setWalkinComplaint(e.target.value)}
                    className="h-8.5 text-xs mt-1"
                  />
                  {/* Quick Complaint Suggestions */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-2 scrollbar-none">
                    {QUICK_COMPLAINTS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setWalkinComplaint(c)}
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer border",
                          walkinComplaint.toLowerCase() === c.toLowerCase()
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Body Weight */}
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Activity className="size-3 text-primary" /> Body Weight (kg)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 15.5"
                      value={walkinWeight}
                      onChange={(e) => setWalkinWeight(e.target.value)}
                      className="h-8.5 text-xs mt-1 font-mono"
                    />
                  </div>

                  {/* Temperature */}
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      Temperature (°C)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="38.5"
                      value={walkinTemp}
                      onChange={(e) => setWalkinTemp(e.target.value)}
                      className="h-8.5 text-xs mt-1 font-mono"
                    />
                  </div>

                  {/* Priority / Triage */}
                  <div>
                    <Label className="text-xs font-semibold">Triage Priority</Label>
                    <Select value={walkinPriority} onValueChange={(val: any) => setWalkinPriority(val)}>
                      <SelectTrigger className="h-8.5 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Routine">🟢 Routine OPD</SelectItem>
                        <SelectItem value="Priority">🟡 Priority / Urgent</SelectItem>
                        <SelectItem value="Emergency">🔴 STAT / Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ── Action Buttons Footer ── */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isSubmittingWalkin}
                  className="h-9 px-4 rounded-xl text-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmittingWalkin}
                  className="h-9 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-xs gap-2 shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  {isSubmittingWalkin ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Registering Patient in CRM…
                    </>
                  ) : (
                    <>
                      <Stethoscope className="size-3.5" />
                      Register &amp; Admit Walk-in to OPD Consultation →
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
