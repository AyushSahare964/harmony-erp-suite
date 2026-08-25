import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Search,
  Plus,
  RotateCcw,
  Download,
  Phone,
  User,
  Heart,
  Dog,
  Cat,
  Bird,
  ShieldAlert,
  Trash2,
  Edit2,
  Eye,
  Stethoscope,
  CheckCircle2,
  Calendar,
  Sparkles,
  UserPlus,
  ArrowUpDown,
  Filter,
  Syringe,
  Activity,
  Layers,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { OwnerPetRegistrationModal } from "./OwnerPetRegistrationModal";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import {
  listPetsWithOwnersFn,
  listOwnersWithPetsFn,
  deletePetFn,
  deleteOwnerFn,
  updatePetFn,
  updateOwnerFn,
} from "@/lib/mongodb/serverFns/crm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MONTHLY_REGISTRATION_DATA = [
  { name: "Mar", value: 118 },
  { name: "Apr", value: 132 },
  { name: "May", value: 141 },
  { name: "Jun", value: 156 },
  { name: "Jul", value: 149 },
  { name: "Aug", value: 172 },
];

export function PetOwnerCrmHub() {
  const [activeTab, setActiveTab] = useState<"pets" | "owners">("pets");
  const [pets, setPets] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rowLimit, setRowLimit] = useState(25);

  // Modals state
  const [showRegModal, setShowRegModal] = useState(false);
  const [regMode, setRegMode] = useState<"new-all" | "new-pet-only">("new-all");
  const [selectedOwnerForNewPet, setSelectedOwnerForNewPet] = useState<any | null>(null);

  // Patient profile drawer / modal
  const [selectedPetDetail, setSelectedPetDetail] = useState<any | null>(null);

  // OPD consultation workspace modal
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);

  // Edit states
  const [editingPet, setEditingPet] = useState<any | null>(null);
  const [editingOwner, setEditingOwner] = useState<any | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [petsData, ownersData] = await Promise.all([
        listPetsWithOwnersFn(),
        listOwnersWithPetsFn(),
      ]);
      setPets(petsData || []);
      setOwners(ownersData || []);
    } catch (err) {
      console.error(err);
      toast.error("Could not load CRM records");
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const totalPets = pets.length || 3148;
  const totalOwners = owners.length || 2406;
  const vaccDueCount = pets.filter((p) => p.status === "Vaccination due").length || 56;

  // Filtered Pets list
  const filteredPets = useMemo(() => {
    const q = query.toLowerCase().trim();
    return pets.filter((p) => {
      const matchQ =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.petId?.toLowerCase().includes(q) ||
        p.breed?.toLowerCase().includes(q) ||
        p.species?.toLowerCase().includes(q) ||
        p.owner?.name?.toLowerCase().includes(q) ||
        p.owner?.phone?.includes(q);
      const matchS = statusFilter === "all" || p.status === statusFilter;
      return matchQ && matchS;
    });
  }, [pets, query, statusFilter]);

  // Filtered Owners list
  const filteredOwners = useMemo(() => {
    const q = query.toLowerCase().trim();
    return owners
      .filter((o) => {
        const matchQ =
          !q ||
          o.name?.toLowerCase().includes(q) ||
          o.ownerId?.toLowerCase().includes(q) ||
          o.phone?.includes(q) ||
          o.email?.toLowerCase().includes(q) ||
          o.pets?.some((p: any) => p.name?.toLowerCase().includes(q));
        return matchQ;
      })
      .slice(0, rowLimit);
  }, [owners, query, rowLimit]);

  const handleOpenNewPetAndOwner = () => {
    setSelectedOwnerForNewPet(null);
    setRegMode("new-all");
    setShowRegModal(true);
  };

  const handleOpenNewPetOnly = (owner?: any) => {
    setSelectedOwnerForNewPet(owner || null);
    setRegMode("new-pet-only");
    setShowRegModal(true);
  };

  const handleDeletePet = async (petId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove patient record for ${name} (${petId})?`)) return;
    try {
      await deletePetFn({ data: { petId } });
      toast.success(`Removed record for ${name}`);
      void loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete pet");
    }
  };

  const handleDeleteOwner = async (ownerId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove client ${name} and all linked pets?`)) return;
    try {
      await deleteOwnerFn({ data: { ownerId } });
      toast.success(`Removed client ${name}`);
      void loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete owner");
    }
  };

  const handleStartConsultation = (pet: any, owner?: any) => {
    const ownerInfo = owner || pet.owner || { name: "Client", phone: "N/A", ownerId: pet.ownerId };
    const newVisitDraft = {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNo: `INV/2026-27/090${Math.floor(10 + Math.random() * 90)}`,
      prescriptionNo: `RX-090${Math.floor(10 + Math.random() * 90)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: pet.petId,
      petName: pet.name,
      species: pet.species,
      breed: pet.breed,
      ownerId: ownerInfo.ownerId || pet.ownerId,
      ownerName: ownerInfo.name,
      ownerPhone: ownerInfo.phone,
      doctorName: "Dr. Rohit Sharma",
      vitals: {
        weightKg: pet.weightKg || 25,
        tempC: 38.5,
        complaint: pet.allergies?.length ? `History: ${pet.allergies.join(", ")}` : "Clinical Consultation",
      },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };
    setSelectedVisit(newVisitDraft);
    setShowVisitModal(true);
  };

  const exportCsv = () => {
    if (activeTab === "pets") {
      const header = "Pet ID,Pet Name,Species,Breed,Gender,Age,Weight (kg),Owner Name,Owner Phone,Status";
      const body = filteredPets
        .map(
          (p) =>
            `"${p.petId}","${p.name}","${p.species}","${p.breed}","${p.gender}","${p.ageYears || p.age || ""}","${p.weightKg || ""}","${p.owner?.name || ""}","${p.owner?.phone || ""}","${p.status || "Active"}"`
        )
        .join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm_patients_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const header = "UID,Owner Name,Phone,Email,City,Pets Count,A/C Balance";
      const body = filteredOwners
        .map(
          (o) =>
            `"${o.ownerId}","${o.name}","${o.phone}","${o.email || ""}","${o.city || "Nagpur"}","${o.pets?.length || 0}","${o.outstandingBalance || 0}"`
        )
        .join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm_owners_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success("CSV file exported");
  };

  return (
    <Shell title="Pet &amp; Owner CRM">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-xs">
              <Dog className="size-6" />
            </span>
            <div>
              <h1 className="page-title text-xl font-bold text-foreground">Pet &amp; Owner CRM</h1>
              <p className="text-xs text-muted-foreground">Registered pets, owner records and visit history</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 text-xs font-semibold h-9">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs font-semibold h-9">
              <Download className="size-3.5" /> Export
            </Button>

            {/* Quick Action Buttons */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenNewPetOnly()}
              className="gap-1.5 text-xs font-bold h-9 border-primary/30 text-primary hover:bg-primary-soft"
            >
              <Plus className="size-3.5" /> + New Pet Only
            </Button>

            <Button
              size="sm"
              onClick={handleOpenNewPetAndOwner}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> + Register Pet / New Owner
            </Button>
          </div>
        </div>

        {/* ── KPI Stat Cards Grid (Screenshot 1) ─────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={{ label: "REGISTERED PETS", value: String(totalPets), trend: "+9 today", trendTone: "up" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "OWNERS", value: String(totalOwners), trend: "+7 today", trendTone: "up" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "VISITS THIS MONTH", value: "912", trend: "+11%", trendTone: "up" }}
            index={2}
          />
          <KpiCard
            kpi={{ label: "VACCINATION DUE", value: String(vaccDueCount), trend: "next 14 days", trendTone: "flat" }}
            index={3}
          />
        </div>

        {/* ── New Registrations Chart (Screenshot 1) ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="erp-card p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">NEW REGISTRATIONS</p>
              <p className="text-[11px] text-muted-foreground">Monthly patient onboarding pace</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-primary bg-primary/10">
              Avg. 144 / month
            </Badge>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_REGISTRATION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  }}
                  formatter={(val: any) => [`${val} registrations`, "Patients"]}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Dual Tab Selector: View Patients (Screenshot 1) vs View Owners (Screenshot 2) ── */}
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("pets")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
                activeTab === "pets"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Dog className="size-4" /> Patients / Pets View
              <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full", activeTab === "pets" ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground")}>
                {pets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("owners")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
                activeTab === "owners"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <User className="size-4" /> Pet Parents / Owners View
              <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full", activeTab === "owners" ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground")}>
                {owners.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenNewPetOnly()}
              className="text-xs h-8 gap-1 font-semibold"
            >
              <Plus className="size-3.5" /> + New Pet Only
            </Button>
            <Button
              size="sm"
              onClick={handleOpenNewPetAndOwner}
              className="text-xs h-8 gap-1 font-bold bg-primary text-primary-foreground"
            >
              <UserPlus className="size-3.5" /> + New Pet &amp; Owner
            </Button>
          </div>
        </div>

        {/* ── TAB 1: PATIENTS / PETS VIEW (Screenshot 1) ───────────────────────── */}
        {activeTab === "pets" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="erp-card overflow-hidden shadow-xs space-y-0"
          >
            {/* Search and Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search records by pet name, ID, breed, owner..."
                  className="pl-9 text-xs h-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] text-xs h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Vaccination due">Vaccination due</SelectItem>
                  <SelectItem value="Under treatment">Under treatment</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground font-medium">
                {filteredPets.length} of {pets.length} records
              </span>
            </div>

            {/* Patients Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">PET ID</th>
                    <th className="px-4 py-3">PET</th>
                    <th className="px-4 py-3">SPECIES</th>
                    <th className="px-4 py-3 text-right">AGE</th>
                    <th className="px-4 py-3">OWNER</th>
                    <th className="px-4 py-3">PHONE</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPets.map((p) => (
                    <tr
                      key={p.petId}
                      className="hover:bg-primary-soft/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedPetDetail(p)}
                    >
                      {/* Pet ID */}
                      <td className="px-4 py-3 font-mono font-bold text-primary">
                        <span className="bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                          {p.petId}
                        </span>
                      </td>

                      {/* Pet Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-full bg-muted flex items-center justify-center text-xs">
                            {p.species === "Feline" ? "🐱" : p.species === "Avian" ? "🦜" : "🐶"}
                          </span>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{p.breed}</p>
                          </div>
                        </div>
                      </td>

                      {/* Species */}
                      <td className="px-4 py-3 text-foreground font-medium">{p.species}</td>

                      {/* Age */}
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {p.ageYears !== undefined ? `${p.ageYears} yrs` : p.age ? `${p.age} yrs` : "—"}
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{p.owner?.name || "Unknown"}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{p.ownerId}</p>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 font-mono text-muted-foreground">{p.owner?.phone || "—"}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill value={p.status || "Active"} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartConsultation(p)}
                            className="h-7 text-[11px] font-bold gap-1 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
                          >
                            <Stethoscope className="size-3" /> Admit OPD
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedPetDetail(p)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="View Full Profile"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePet(p.petId, p.name)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Delete Record"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredPets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        No matching patients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── TAB 2: OWNERS / PET PARENTS VIEW (Screenshot 2) ─────────────────── */}
        {activeTab === "owners" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="erp-card overflow-hidden shadow-xs space-y-0"
          >
            {/* Search and Row Limit Bar (Screenshot 2) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 bg-card">
              <div className="relative min-w-[280px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search owners or pets..."
                  className="pl-9 text-xs h-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Row limit:</span>
                <Select value={String(rowLimit)} onValueChange={(v) => setRowLimit(Number(v))}>
                  <SelectTrigger className="w-[80px] text-xs h-9 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Owners Table (Screenshot 2 Columns: S.No, UID, Owner name, pets, sex, DOB, a/c balance) */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider">
                    <th className="px-4 py-3 w-14">S.No</th>
                    <th className="px-4 py-3">
                      <div className="flex items-center gap-1 cursor-pointer">
                        UID <ArrowUpDown className="size-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3">Owner name</th>
                    <th className="px-4 py-3">pets</th>
                    <th className="px-4 py-3">sex</th>
                    <th className="px-4 py-3">DOB</th>
                    <th className="px-4 py-3">a/c balance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOwners.map((o, idx) => (
                    <tr key={o.ownerId} className="hover:bg-primary-soft/30 transition-colors group">
                      {/* S.No */}
                      <td className="px-4 py-3 font-medium text-muted-foreground">{idx + 1}</td>

                      {/* UID */}
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        <span className="bg-muted px-2 py-0.5 rounded text-xs">{o.ownerId}</span>
                      </td>

                      {/* Owner Name (Clickable link style as screenshot 2) */}
                      <td className="px-4 py-3 font-semibold text-primary hover:underline cursor-pointer">
                        {o.name}
                        <p className="text-[10px] text-muted-foreground font-mono font-normal">{o.phone}</p>
                      </td>

                      {/* Pets List (Clickable blue links/badges) */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {o.pets && o.pets.length > 0 ? (
                            o.pets.map((pet: any) => (
                              <button
                                key={pet.petId}
                                onClick={() => setSelectedPetDetail({ ...pet, owner: o })}
                                className="text-primary hover:underline font-semibold text-xs bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md transition-colors"
                              >
                                {pet.name.toLowerCase()}
                              </button>
                            ))
                          ) : (
                            <span className="text-muted-foreground italic">No pets</span>
                          )}
                        </div>
                      </td>

                      {/* Sex / Gender */}
                      <td className="px-4 py-3 text-muted-foreground capitalize">{o.gender || "male"}</td>

                      {/* DOB */}
                      <td className="px-4 py-3 font-mono text-muted-foreground">{o.dob || "N/A"}</td>

                      {/* A/C Balance (Bold red for negative, normal for zero/positive) */}
                      <td className="px-4 py-3 font-bold font-mono">
                        {o.outstandingBalance !== undefined && o.outstandingBalance < 0 ? (
                          <span className="text-destructive">₹{o.outstandingBalance}</span>
                        ) : (
                          <span className="text-foreground">₹{o.outstandingBalance || 0}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenNewPetOnly(o)}
                            className="h-7 text-[11px] font-bold gap-1 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
                          >
                            <Plus className="size-3" /> Add Pet
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteOwner(o.ownerId, o.name)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Delete Owner"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredOwners.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        No matching clients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── Patient Medical Profile Modal / Drawer ─────────────────────────── */}
        <Dialog open={Boolean(selectedPetDetail)} onOpenChange={(v) => !v && setSelectedPetDetail(null)}>
          {selectedPetDetail && (
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl border-border bg-card shadow-2xl p-0">
              <div className="border-b border-border bg-primary-soft/40 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl shadow-xs">
                      {selectedPetDetail.species === "Feline" ? "🐱" : selectedPetDetail.species === "Avian" ? "🦜" : "🐶"}
                    </span>
                    <div>
                      <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                        {selectedPetDetail.name}
                        <Badge className="font-mono bg-primary text-primary-foreground text-xs">
                          {selectedPetDetail.petId}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        {selectedPetDetail.species} · {selectedPetDetail.breed} · {selectedPetDetail.gender}
                      </DialogDescription>
                    </div>
                  </div>

                  <StatusPill value={selectedPetDetail.status || "Active"} />
                </div>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Critical Allergies Alert */}
                {selectedPetDetail.allergies && selectedPetDetail.allergies.length > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2.5">
                    <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-destructive">Drug Allergies &amp; Clinical Alerts</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPetDetail.allergies.map((a: string) => (
                          <span key={a} className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded text-[11px] font-bold">
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Vitals / Identity Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Weight</span>
                    <strong className="text-foreground text-sm">
                      {selectedPetDetail.weightKg ? `${selectedPetDetail.weightKg} kg` : "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Age / DOB</span>
                    <strong className="text-foreground text-sm">
                      {selectedPetDetail.ageYears ? `${selectedPetDetail.ageYears} yrs` : selectedPetDetail.dob || "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Sterilization</span>
                    <strong className="text-foreground text-sm">
                      {selectedPetDetail.sterilizationStatus || "Unknown"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Microchip No</span>
                    <strong className="text-foreground text-xs font-mono">
                      {selectedPetDetail.microchipNo || "Not Tagged"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Coat / Color</span>
                    <strong className="text-foreground text-xs">
                      {selectedPetDetail.color || "Standard"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Blood Group</span>
                    <strong className="text-foreground text-xs font-mono">
                      {selectedPetDetail.bloodGroup || "N/A"}
                    </strong>
                  </div>
                </div>

                {/* Linked Owner Card */}
                <div className="rounded-xl border border-border p-3 space-y-1.5 bg-card">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <User className="size-3.5 text-primary" /> Pet Parent Information
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {selectedPetDetail.ownerId || selectedPetDetail.owner?.ownerId}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedPetDetail.owner?.name || "Client"}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Phone className="size-3" /> {selectedPetDetail.owner?.phone || "N/A"}
                    {selectedPetDetail.owner?.city && ` · ${selectedPetDetail.owner.city}`}
                  </p>
                </div>

                {/* Medical Notes */}
                {selectedPetDetail.medicalNotes && (
                  <div className="rounded-xl border border-border p-3 bg-muted/20">
                    <span className="font-bold text-muted-foreground block mb-1">Clinical / Medical Notes</span>
                    <p className="text-foreground">{selectedPetDetail.medicalNotes}</p>
                  </div>
                )}

                {/* Direct OPD Action */}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPetDetail(null)}>
                    Close
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const p = selectedPetDetail;
                      setSelectedPetDetail(null);
                      handleStartConsultation(p);
                    }}
                    className="gap-1.5 font-bold bg-primary text-primary-foreground shadow-xs"
                  >
                    <Stethoscope className="size-4" /> Start OPD Consultation &amp; Rx →
                  </Button>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* ── Multi-Pet Registration Modal ─────────────────────────────────────── */}
        <OwnerPetRegistrationModal
          open={showRegModal}
          onClose={() => {
            setShowRegModal(false);
            setSelectedOwnerForNewPet(null);
          }}
          initialMode={regMode}
          preselectedOwner={selectedOwnerForNewPet}
          onRegistered={() => {
            void loadData();
          }}
          onAdmitToOpd={(pet, owner) => {
            handleStartConsultation(pet, owner);
          }}
        />

        {/* ── Connected Clinical Workspace Modal ──────────────────────────────── */}
        {selectedVisit && (
          <VisitWorkspaceModal
            open={showVisitModal}
            onClose={() => {
              setShowVisitModal(false);
              setSelectedVisit(null);
            }}
            visit={selectedVisit}
            onVisitFinalized={() => {
              void loadData();
            }}
          />
        )}

      </div>
    </Shell>
  );
}
