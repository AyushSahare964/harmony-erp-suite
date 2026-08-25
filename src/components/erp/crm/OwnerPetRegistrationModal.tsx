import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Plus,
  Search,
  CheckCircle2,
  Phone,
  User,
  Heart,
  Dog,
  Cat,
  Bird,
  ShieldAlert,
  Trash2,
  Sparkles,
  Stethoscope,
  Building,
  Mail,
  CreditCard,
  Tag,
  Hash,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  searchOwnersFn,
  createOwnerFn,
  createPetFn,
  createOwnerWithMultiplePetsFn,
  peekNextOwnerIdFn,
  peekNextPetIdFn,
} from "@/lib/mongodb/serverFns/crm";
import { cn } from "@/lib/utils";

export interface PetDraft {
  id: string;
  name: string;
  species: "Canine" | "Feline" | "Avian" | "Rabbit" | "Exotic" | "Other";
  breed: string;
  gender: "Male" | "Female" | "Neutered Male" | "Spayed Female";
  dob?: string | undefined;
  ageYears?: number | undefined;
  ageMonths?: number | undefined;
  color?: string | undefined;
  weightKg?: string | undefined;
  microchipNo?: string | undefined;
  sterilizationStatus: "Intact" | "Sterilized" | "Unknown";
  bloodGroup?: string | undefined;
  allergies: string[];
  chronicConditions: string[];
  dietPreference?: string | undefined;
  medicalNotes?: string | undefined;
}

export const DEFAULT_PET_DRAFT = (): PetDraft => ({
  id: "pet-" + Math.random().toString(36).substring(2, 9),
  name: "",
  species: "Canine",
  breed: "",
  gender: "Male",
  dob: "",
  ageYears: undefined,
  ageMonths: undefined,
  color: "",
  weightKg: "",
  microchipNo: "",
  sterilizationStatus: "Intact",
  bloodGroup: "",
  allergies: [],
  chronicConditions: [],
  dietPreference: "",
  medicalNotes: "",
});

const COMMON_ALLERGIES = ["Penicillin", "NSAIDs", "Sulfa Drugs", "Vaccine Reaction", "Chicken/Poultry", "Flea Allergy", "Beef"];

interface Props {
  open: boolean;
  onClose: () => void;
  initialMode?: "new-all" | "new-pet-only";
  preselectedOwner?: any;
  onRegistered?: (result: { owner: any; pets: any[] }) => void;
  onAdmitToOpd?: (pet: any, owner: any) => void;
}

export function OwnerPetRegistrationModal({
  open,
  onClose,
  initialMode = "new-all",
  preselectedOwner = null,
  onRegistered,
  onAdmitToOpd,
}: Props) {
  const [step, setStep] = useState<"owner" | "pets" | "success">("owner");
  const [mode, setMode] = useState<"new-all" | "new-pet-only">(initialMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [existingOwners, setExistingOwners] = useState<any[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<any | null>(preselectedOwner);

  // Auto-ID previews
  const [previewOwnerId, setPreviewOwnerId] = useState<string>("OWN-0001");
  const [previewBasePetId, setPreviewBasePetId] = useState<string>("PET-0001");

  // Owner form state
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerAltPhone, setOwnerAltPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerGender, setOwnerGender] = useState<"Male" | "Female" | "Other">("Male");
  const [ownerDob, setOwnerDob] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [ownerCity, setOwnerCity] = useState("Nagpur");
  const [idProofType, setIdProofType] = useState<"Aadhaar" | "PAN" | "Driving License" | "Passport" | "Other">("Aadhaar");
  const [idProofNo, setIdProofNo] = useState("");
  const [preferredPaymentMode, setPreferredPaymentMode] = useState<"UPI" | "Cash" | "Card" | "Credit">("UPI");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [referredBy, setReferredBy] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");

  // Multi-Pet Drafts state
  const [pets, setPets] = useState<PetDraft[]>([DEFAULT_PET_DRAFT()]);
  const [activePetIndex, setActivePetIndex] = useState(0);

  // Registered results
  const [registeredResult, setRegisteredResult] = useState<{ owner: any; pets: any[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPreviews();
      void loadOwners();
      if (preselectedOwner) {
        setSelectedOwner(preselectedOwner);
        setMode("new-pet-only");
        setStep("pets");
      } else if (initialMode === "new-pet-only") {
        setMode("new-pet-only");
        setStep("owner");
      } else {
        setMode("new-all");
        setStep("owner");
      }
    }
  }, [open, preselectedOwner, initialMode]);

  const loadPreviews = async () => {
    try {
      const [oId, pId] = await Promise.all([peekNextOwnerIdFn(), peekNextPetIdFn()]);
      if (oId) setPreviewOwnerId(oId);
      if (pId) setPreviewBasePetId(pId);
    } catch (e) {
      console.warn("Could not peek IDs", e);
    }
  };

  const loadOwners = async (query = "") => {
    try {
      const res = await searchOwnersFn({ data: query });
      setExistingOwners(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    void loadOwners(q);
  };

  const handleSelectOwner = (owner: any) => {
    setSelectedOwner(owner);
    setStep("pets");
  };

  const handleOwnerPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
    setOwnerPhone(clean);
  };

  const handleOwnerAltPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
    setOwnerAltPhone(clean);
  };

  const handleProceedNewOwner = () => {
    if (!ownerName.trim()) {
      toast.error("Pet parent / owner full name is required.");
      return;
    }
    if (!ownerPhone.trim() || ownerPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit Indian mobile number (e.g. 98230 44556).");
      return;
    }
    setSelectedOwner(null);
    setStep("pets");
  };

  // ── Multi-Pet Management ──────────────────────────────────────────────────

  const handleAddAnotherPet = () => {
    const newDraft = DEFAULT_PET_DRAFT();
    setPets((prev) => [...prev, newDraft]);
    setActivePetIndex(pets.length); // switch to newly added pet
    toast.info(`Added Pet #${pets.length + 1} to intake form`);
  };

  const handleRemovePet = (index: number) => {
    if (pets.length <= 1) {
      toast.error("At least one pet is required");
      return;
    }
    const updated = pets.filter((_, i) => i !== index);
    setPets(updated);
    if (activePetIndex >= updated.length) {
      setActivePetIndex(updated.length - 1);
    }
  };

  const updateCurrentPet = (field: keyof PetDraft, val: any) => {
    setPets((prev) => {
      const next = [...prev];
      const target = next[activePetIndex] || DEFAULT_PET_DRAFT();
      next[activePetIndex] = { ...target, [field]: val };
      return next;
    });
  };

  const toggleAllergy = (allergy: string) => {
    const current = pets[activePetIndex]?.allergies || [];
    const exists = current.includes(allergy);
    const updated = exists ? current.filter((a) => a !== allergy) : [...current, allergy];
    updateCurrentPet("allergies", updated);
  };

  // Calculate projected Pet ID for index
  const getProjectedPetId = (index: number) => {
    const prefix = previewBasePetId.split("-")[0] || "PET";
    const numPart = parseInt(previewBasePetId.split("-")[1] || "1", 10);
    const targetNum = numPart + index;
    return `${prefix}-${String(targetNum).padStart(4, "0")}`;
  };

  // ── Save & Register Flow ─────────────────────────────────────────────────

  const handleCompleteRegistration = async () => {
    // Validate all pets in list
    for (let i = 0; i < pets.length; i++) {
      const p = pets[i];
      if (!p || !p.name.trim()) {
        setActivePetIndex(i);
        toast.error(`Pet #${i + 1} name is required`);
        return;
      }
      if (!p.breed.trim()) {
        setActivePetIndex(i);
        toast.error(`Pet #${i + 1} (${p.name || "Untitled"}) breed is required`);
        return;
      }
    }

    setSaving(true);
    try {
      if (selectedOwner) {
        // Mode 1: Add pets to existing owner
        const createdPetsList = [];
        for (const p of pets) {
          const newPet = await createPetFn({
            data: {
              ownerId: selectedOwner.ownerId,
              name: p.name.trim(),
              species: p.species,
              breed: p.breed.trim(),
              gender: p.gender,
              dob: p.dob || undefined,
              ageYears: p.ageYears || undefined,
              ageMonths: p.ageMonths || undefined,
              color: p.color?.trim() || undefined,
              weightKg: p.weightKg ? Number(p.weightKg) : undefined,
              microchipNo: p.microchipNo?.trim() || undefined,
              sterilizationStatus: p.sterilizationStatus,
              bloodGroup: p.bloodGroup?.trim() || undefined,
              allergies: p.allergies,
              chronicConditions: p.chronicConditions,
              dietPreference: p.dietPreference?.trim() || undefined,
              medicalNotes: p.medicalNotes?.trim() || undefined,
              status: "Active",
            },
          });
          createdPetsList.push(newPet);
        }

        const res = { owner: selectedOwner, pets: createdPetsList };
        setRegisteredResult(res);
        setStep("success");
        toast.success(`Successfully registered ${createdPetsList.length} pet(s) under ${selectedOwner.name}!`);
        onRegistered?.(res);
      } else {
        // Mode 2: Create new Owner + all Pets atomically
        const formattedPhone = ownerPhone.length === 10 ? `+91 ${ownerPhone.slice(0, 5)} ${ownerPhone.slice(5)}` : ownerPhone.trim();
        const formattedAltPhone = ownerAltPhone.length === 10 ? `+91 ${ownerAltPhone.slice(0, 5)} ${ownerAltPhone.slice(5)}` : (ownerAltPhone.trim() || undefined);

        const ownerPayload = {
          name: ownerName.trim(),
          phone: formattedPhone,
          altPhone: formattedAltPhone,
          email: ownerEmail.trim() || undefined,
          gender: ownerGender,
          dob: ownerDob || undefined,
          address: ownerAddress.trim() || undefined,
          city: ownerCity.trim() || "Nagpur",
          idProofType,
          idProofNo: idProofNo.trim() || undefined,
          preferredPaymentMode,
          referredBy: referredBy.trim() || undefined,
          outstandingBalance: openingBalance ? Number(openingBalance) : 0,
          notes: ownerNotes.trim() || undefined,
        };

        const petsPayload = pets.map((p) => ({
          name: p.name.trim(),
          species: p.species,
          breed: p.breed.trim(),
          gender: p.gender,
          dob: p.dob || undefined,
          ageYears: p.ageYears || undefined,
          ageMonths: p.ageMonths || undefined,
          color: p.color?.trim() || undefined,
          weightKg: p.weightKg ? Number(p.weightKg) : undefined,
          microchipNo: p.microchipNo?.trim() || undefined,
          sterilizationStatus: p.sterilizationStatus,
          bloodGroup: p.bloodGroup?.trim() || undefined,
          allergies: p.allergies,
          chronicConditions: p.chronicConditions,
          dietPreference: p.dietPreference?.trim() || undefined,
          medicalNotes: p.medicalNotes?.trim() || undefined,
          status: "Active" as const,
        }));

        const res = await createOwnerWithMultiplePetsFn({
          data: {
            owner: ownerPayload,
            pets: petsPayload,
          },
        });

        setRegisteredResult(res);
        setStep("success");
        toast.success(`Registered owner ${res.owner.name} with ${res.pets.length} pet(s)!`);
        onRegistered?.(res);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to complete registration");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAndClose = () => {
    setStep("owner");
    setMode("new-all");
    setSearchQuery("");
    setSelectedOwner(null);
    setOwnerName("");
    setOwnerPhone("");
    setOwnerAltPhone("");
    setOwnerEmail("");
    setOwnerAddress("");
    setPets([DEFAULT_PET_DRAFT()]);
    setActivePetIndex(0);
    setRegisteredResult(null);
    onClose();
  };

  const handleAddMorePetsToSameOwner = () => {
    if (registeredResult?.owner) {
      setSelectedOwner(registeredResult.owner);
      setPets([DEFAULT_PET_DRAFT()]);
      setActivePetIndex(0);
      setRegisteredResult(null);
      setStep("pets");
    }
  };

  const activePet: PetDraft = pets[activePetIndex] || pets[0] || DEFAULT_PET_DRAFT();

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleResetAndClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0">
        {/* Modal Header */}
        <div className="border-b border-border/80 bg-muted/30 p-5">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-xs">
                  <UserPlus className="size-5" />
                </span>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {step === "owner"
                      ? mode === "new-all"
                        ? "Register New Pet & Owner"
                        : "Select Existing Owner"
                      : step === "pets"
                      ? "Patient Registration"
                      : "Registration Complete"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {step === "owner"
                      ? "Onboard a new client or attach new patients to an existing account."
                      : step === "pets"
                      ? `Registering patient(s) under ${selectedOwner?.name || ownerName || "Client"}. One owner can have multiple pets.`
                      : "Client & patient records have been successfully saved."}
                  </DialogDescription>
                </div>
              </div>

              {step === "owner" && !selectedOwner && (
                <div className="flex rounded-lg bg-muted p-0.5 text-xs">
                  <button
                    onClick={() => setMode("new-all")}
                    className={cn(
                      "px-3 py-1 font-semibold rounded-md transition-all",
                      mode === "new-all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    + New Pet &amp; Owner
                  </button>
                  <button
                    onClick={() => setMode("new-pet-only")}
                    className={cn(
                      "px-3 py-1 font-semibold rounded-md transition-all",
                      mode === "new-pet-only" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    + New Pet Only
                  </button>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* ── STEP 1: OWNER INTAKE / SELECTION ─────────────────────────────────── */}
        {step === "owner" && (
          <div className="p-6 space-y-5">
            {mode === "new-pet-only" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Search Existing Pet Parent</Label>
                  <span className="text-[11px] text-muted-foreground font-mono">Select client to link new pets</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by owner name, mobile, email, or UID (e.g. Atul, 98230...)"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-9 text-sm h-10"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-border p-2 bg-muted/20">
                  {existingOwners.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">No matching clients found.</p>
                      <Button variant="outline" size="sm" onClick={() => setMode("new-all")}>
                        <UserPlus className="mr-1.5 size-3.5" /> Register as New Client Instead
                      </Button>
                    </div>
                  ) : (
                    existingOwners.map((o) => (
                      <div
                        key={o.ownerId}
                        onClick={() => handleSelectOwner(o)}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary-soft/20 cursor-pointer transition-all shadow-2xs group"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {o.name}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                              {o.ownerId}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Phone className="size-3 text-muted-foreground" /> {o.phone}
                            {o.email && ` · ${o.email}`}
                            {o.address && ` · ${o.address}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              {o.pets?.length || 0} pet(s) registered
                            </span>
                            {o.outstandingBalance !== undefined && o.outstandingBalance !== 0 && (
                              <p className={cn("text-[10px] font-bold mt-0.5", o.outstandingBalance < 0 ? "text-destructive" : "text-emerald-600")}>
                                A/C: ₹{o.outstandingBalance}
                              </p>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold group-hover:bg-primary group-hover:text-primary-foreground">
                            Select →
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* New Owner Form */
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-primary-soft/30 px-3.5 py-2.5 border border-primary/20">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Hash className="size-3.5" />
                    <span>Auto-Generated Client UID:</span>
                    <Badge className="font-mono bg-primary text-primary-foreground text-xs shadow-2xs">{previewOwnerId}</Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Assigned automatically on save</span>
                </div>

                {/* Section 1: Client & Contact */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                    <User className="size-3.5 text-primary" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">1. Personal &amp; Contact Details</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-bold text-foreground">
                        Pet Parent / Owner Full Name <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          placeholder="e.g. Atul Bhise"
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          className="text-sm h-9 pl-8"
                          required
                        />
                      </div>
                    </div>

                    {/* Primary Mobile Number (10 digits Indian) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                        <span>Primary Mobile Number <span className="text-destructive">*</span></span>
                        <span className="text-[10px] text-muted-foreground font-mono">{ownerPhone.length}/10 digits</span>
                      </Label>
                      <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-primary">
                        <span className="bg-muted/60 px-2.5 py-1 text-xs font-bold font-mono text-muted-foreground border-r border-input select-none flex items-center gap-1">
                          <span>🇮🇳</span> +91
                        </span>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          placeholder="98230 11221"
                          value={ownerPhone}
                          onChange={handleOwnerPhoneChange}
                          maxLength={10}
                          className="text-sm h-9 border-0 bg-transparent font-mono tracking-wider focus-visible:ring-0"
                          required
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Primary contact for OTP, bills &amp; reminders</p>
                    </div>

                    {/* WhatsApp / Alternate Number */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>WhatsApp / Alternate Mobile</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{ownerAltPhone.length}/10 digits</span>
                      </Label>
                      <div className="flex items-center rounded-md border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-primary">
                        <span className="bg-muted/60 px-2.5 py-1 text-xs font-bold font-mono text-muted-foreground border-r border-input select-none flex items-center gap-1">
                          <span>🇮🇳</span> +91
                        </span>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          placeholder="98230 99999"
                          value={ownerAltPhone}
                          onChange={handleOwnerAltPhoneChange}
                          maxLength={10}
                          className="text-sm h-9 border-0 bg-transparent font-mono tracking-wider focus-visible:ring-0"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">For WhatsApp prescriptions &amp; updates</p>
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-semibold text-foreground">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="e.g. atul.bhise@gmail.com"
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                          className="text-sm h-9 pl-8"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">For digital tax invoices, diagnostic lab reports &amp; history</p>
                    </div>

                    {/* Gender & DOB */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">Gender</Label>
                      <Select value={ownerGender} onValueChange={(v) => setOwnerGender(v as any)}>
                        <SelectTrigger className="text-xs h-9 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">Date of Birth (Optional)</Label>
                      <Input
                        type="date"
                        value={ownerDob}
                        onChange={(e) => setOwnerDob(e.target.value)}
                        className="text-sm h-9 bg-background font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Address & Location */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                    <Building className="size-3.5 text-primary" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">2. Location &amp; Address</h4>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">City</Label>
                      <Input
                        placeholder="e.g. Nagpur"
                        value={ownerCity}
                        onChange={(e) => setOwnerCity(e.target.value)}
                        className="text-sm h-9 bg-background"
                      />
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {["Nagpur", "Hyderabad", "Pune", "Mumbai", "Bengaluru", "Delhi NCR"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setOwnerCity(c)}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-md border transition-colors",
                              ownerCity === c
                                ? "bg-primary text-primary-foreground border-primary font-semibold"
                                : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">Residential Address / Landmark</Label>
                      <Input
                        placeholder="e.g. Flat 302, Dharampeth Extension, Near Coffee House"
                        value={ownerAddress}
                        onChange={(e) => setOwnerAddress(e.target.value)}
                        className="text-sm h-9 bg-background"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: ID Proof & Account Opening */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                    <CreditCard className="size-3.5 text-primary" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">3. ID Proof &amp; Billing Preference</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">ID Proof Type</Label>
                      <Select value={idProofType} onValueChange={(v) => setIdProofType(v as any)}>
                        <SelectTrigger className="text-xs h-9 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Aadhaar">Aadhaar Card</SelectItem>
                          <SelectItem value="PAN">PAN Card</SelectItem>
                          <SelectItem value="Driving License">Driving License</SelectItem>
                          <SelectItem value="Passport">Passport</SelectItem>
                          <SelectItem value="Other">Other ID</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">ID Proof Number</Label>
                      <Input
                        placeholder={idProofType === "Aadhaar" ? "XXXX-XXXX-XXXX" : idProofType === "PAN" ? "ABCDE1234F" : "Document ID No."}
                        value={idProofNo}
                        onChange={(e) => setIdProofNo(e.target.value)}
                        className="text-sm h-9 font-mono bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">Opening Balance (₹)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        className="text-sm h-9 font-mono bg-background"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setMode("new-pet-only")} className="text-xs">
                    Search Existing Client Instead
                  </Button>
                  <Button size="sm" onClick={handleProceedNewOwner} className="gap-1.5 font-bold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                    Next: Add Patient Details →
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: MULTI-PET REGISTRATION STEP ──────────────────────────────── */}
        {step === "pets" && (
          <div className="p-6 space-y-5">
            {/* Linked Owner Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-soft/30 p-3 border border-primary/20">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                  <User className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-2">
                    Linked Owner: {selectedOwner?.name || ownerName}
                    <Badge variant="outline" className="text-[10px] font-mono py-0 bg-background text-primary">
                      {selectedOwner?.ownerId || previewOwnerId}
                    </Badge>
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Phone className="size-3" /> {selectedOwner?.phone || ownerPhone}
                    {(selectedOwner?.city || ownerCity) && ` · ${selectedOwner?.city || ownerCity}`}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("owner")}
                className="h-7 text-xs font-semibold text-primary hover:bg-primary-soft"
              >
                Change Owner
              </Button>
            </div>

            {/* Multi-Pet Header with "+ Add Another Pet" button & tabs */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Patients ({pets.length})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    — Configure one or multiple pets for this client
                  </span>
                </div>

                {/* PROMINENT "+ Add Another Pet" Button requested by user */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddAnotherPet}
                  className="h-8 gap-1.5 text-xs font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs"
                >
                  <Plus className="size-4 stroke-[3]" /> Add Another Pet
                </Button>
              </div>

              {/* Dynamic Pet Tab Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {pets.map((p, idx) => (
                  <div
                    key={p.id}
                    onClick={() => setActivePetIndex(idx)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all shadow-2xs",
                      activePetIndex === idx
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <span>{p.species === "Feline" ? "🐱" : p.species === "Avian" ? "🦜" : "🐶"}</span>
                    <span>{p.name.trim() || `Pet #${idx + 1}`}</span>
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1 rounded",
                        activePetIndex === idx ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {getProjectedPetId(idx)}
                    </span>

                    {pets.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePet(idx);
                        }}
                        className={cn(
                          "ml-1 p-0.5 rounded hover:bg-destructive hover:text-destructive-foreground transition-colors",
                          activePetIndex === idx ? "text-primary-foreground/80 hover:text-white" : "text-muted-foreground"
                        )}
                        title="Remove this pet"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddAnotherPet}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary-soft/40 text-xs font-bold transition-all"
                >
                  <Plus className="size-3.5" /> New Pet
                </button>
              </div>
            </div>

            {/* Active Pet Detailed Form */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-bold">
                    Pet #{activePetIndex + 1} of {pets.length}
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">{activePet.name || "Unnamed Pet"}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hash className="size-3.5 text-primary" />
                  <span>Assigned Pet ID:</span>
                  <Badge className="font-mono bg-primary/10 text-primary border-primary/30 text-xs font-bold">
                    {getProjectedPetId(activePetIndex)}
                  </Badge>
                </div>
              </div>

              {/* Core Clinical Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Pet Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Bruno"
                    value={activePet.name}
                    onChange={(e) => updateCurrentPet("name", e.target.value)}
                    className="text-sm h-9 font-medium"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Species <span className="text-destructive">*</span>
                  </Label>
                  <Select value={activePet.species} onValueChange={(v) => updateCurrentPet("species", v)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Canine">🐶 Canine (Dog)</SelectItem>
                      <SelectItem value="Feline">🐱 Feline (Cat)</SelectItem>
                      <SelectItem value="Avian">🦜 Avian (Bird)</SelectItem>
                      <SelectItem value="Rabbit">🐰 Rabbit / Small Mammal</SelectItem>
                      <SelectItem value="Exotic">🦎 Exotic Pet</SelectItem>
                      <SelectItem value="Other">🐾 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Breed <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Labrador Retriever, Persian Cat, Beagle"
                    value={activePet.breed}
                    onChange={(e) => updateCurrentPet("breed", e.target.value)}
                    className="text-sm h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <Select value={activePet.gender} onValueChange={(v) => updateCurrentPet("gender", v)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Neutered Male">Neutered Male</SelectItem>
                      <SelectItem value="Spayed Female">Spayed Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 24.5"
                    value={activePet.weightKg || ""}
                    onChange={(e) => updateCurrentPet("weightKg", e.target.value)}
                    className="text-sm h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Date of Birth</Label>
                  <Input
                    type="date"
                    value={activePet.dob || ""}
                    onChange={(e) => {
                      const dobVal = e.target.value;
                      updateCurrentPet("dob", dobVal);
                      if (dobVal) {
                        const birth = new Date(dobVal);
                        const now = new Date();
                        const diffYears = now.getFullYear() - birth.getFullYear();
                        if (diffYears >= 0) updateCurrentPet("ageYears", diffYears);
                      }
                    }}
                    className="text-sm h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Coat Color / Markings</Label>
                  <Input
                    placeholder="e.g. Golden, Black & Tan, Fawn"
                    value={activePet.color || ""}
                    onChange={(e) => updateCurrentPet("color", e.target.value)}
                    className="text-sm h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Microchip / RFID No</Label>
                  <Input
                    placeholder="e.g. 981098123456789"
                    value={activePet.microchipNo || ""}
                    onChange={(e) => updateCurrentPet("microchipNo", e.target.value)}
                    className="text-sm h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Sterilization Status</Label>
                  <Select
                    value={activePet.sterilizationStatus}
                    onValueChange={(v) => updateCurrentPet("sterilizationStatus", v)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Intact">Intact</SelectItem>
                      <SelectItem value="Sterilized">Sterilized / Neutered / Spayed</SelectItem>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Blood Group / Type</Label>
                  <Input
                    placeholder="e.g. DEA 1.1+ / Type A"
                    value={activePet.bloodGroup || ""}
                    onChange={(e) => updateCurrentPet("bloodGroup", e.target.value)}
                    className="text-sm h-9 font-mono"
                  />
                </div>
              </div>

              {/* Allergies and Special Flags Section */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="size-3.5 text-amber-500" />
                    Known Drug Allergies / Critical Flags
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Click common badges to toggle</span>
                </div>

                {/* Quick Allergy Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_ALLERGIES.map((allergy) => {
                    const isSelected = activePet.allergies?.includes(allergy);
                    return (
                      <button
                        key={allergy}
                        type="button"
                        onClick={() => toggleAllergy(allergy)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                          isSelected
                            ? "bg-destructive text-destructive-foreground border-destructive shadow-xs font-bold"
                            : "bg-muted/60 text-muted-foreground border-border hover:border-destructive/40 hover:text-foreground"
                        )}
                      >
                        {isSelected && "✓ "}
                        {allergy}
                      </button>
                    );
                  })}
                </div>

                <Input
                  placeholder="Type other custom allergies or notes (e.g. Sensitive stomach, Severe otitis history)..."
                  value={activePet.medicalNotes || ""}
                  onChange={(e) => updateCurrentPet("medicalNotes", e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setStep("owner")}>
                ← Back to Owner Details
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAnotherPet}
                  className="h-9 gap-1.5 text-xs font-bold border-dashed border-primary text-primary hover:bg-primary-soft"
                >
                  <Plus className="size-4" /> Add Another Pet ({pets.length})
                </Button>

                <Button
                  size="sm"
                  onClick={handleCompleteRegistration}
                  disabled={saving}
                  className="h-9 gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs px-5"
                >
                  {saving ? "Saving Records..." : `Complete Registration (${pets.length} Pet${pets.length > 1 ? "s" : ""}) ✓`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: SUCCESS CONFIRMATION ─────────────────────────────────────── */}
        {step === "success" && registeredResult && (
          <div className="p-8 space-y-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs"
            >
              <CheckCircle2 className="size-9" />
            </motion.div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">Registration Successful!</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Client profile &amp; patient records have been permanently assigned and indexed in the CRM.
              </p>
            </div>

            {/* Client and Multi-Pet Summary Card */}
            <div className="mx-auto max-w-xl rounded-2xl border border-border bg-muted/30 p-4 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{registeredResult.owner.name}</p>
                    <p className="text-xs text-muted-foreground">{registeredResult.owner.phone}</p>
                  </div>
                </div>
                <Badge className="font-mono bg-primary text-primary-foreground">{registeredResult.owner.ownerId}</Badge>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Registered Patients ({registeredResult.pets.length})
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {registeredResult.pets.map((p: any) => (
                    <div
                      key={p.petId}
                      className="rounded-xl border border-border bg-card p-3 space-y-1 shadow-2xs hover:border-primary/40 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            {p.species === "Feline" ? "🐱" : p.species === "Avian" ? "🦜" : "🐶"} {p.name}
                          </span>
                          <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                            {p.petId}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.species} · {p.breed} · {p.gender}
                        </p>
                        {p.allergies?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.allergies.map((a: string) => (
                              <span key={a} className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.2 rounded font-semibold">
                                ⚠ {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {onAdmitToOpd && (
                        <div className="pt-2 mt-2 border-t border-border/50">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              onAdmitToOpd(p, registeredResult.owner);
                              handleResetAndClose();
                            }}
                            className="w-full h-7 text-xs font-bold gap-1"
                          >
                            <Stethoscope className="size-3" /> Admit to OPD Consultation
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Success Bottom Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={handleAddMorePetsToSameOwner} className="gap-1.5 text-xs font-bold">
                <Plus className="size-3.5" /> + Add Another Pet to this Client
              </Button>
              <Button size="sm" onClick={handleResetAndClose} className="px-6 font-bold shadow-xs">
                Done &amp; Close CRM
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
