import { useState, useEffect, useMemo, useRef } from "react";
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
import { Patient360Profile } from "./Patient360Profile";
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
  const initialDeepLinkHandled = useRef(false);

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

      // Auto-open patient record ONLY ONCE on initial mount if petId was passed via URL search param
      if (!initialDeepLinkHandled.current) {
        initialDeepLinkHandled.current = true;
        try {
          const params = new URLSearchParams(window.location.search);
          const deepPetId = params.get("petId");
          if (deepPetId) {
            const match = (petsData || []).find((p: any) => p.petId === deepPetId);
            if (match) {
              setSelectedPetDetail(match);
            }
            // Clear search params so subsequent reloads/saves never re-trigger popup
            const url = new URL(window.location.href);
            url.searchParams.delete("petId");
            url.searchParams.delete("petName");
            window.history.replaceState({}, "", url.toString());
          }
        } catch (_) { /* ignore URL parse errors */ }
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not load CRM records");
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const totalPets = pets.length;
  const totalOwners = owners.length;
  const vaccDueCount = pets.filter((p) => p.status === "Vaccination due").length;
  // Build registration chart from actual pet createdAt dates (last 6 months)
  const monthlyChartData = useMemo(() => {
    const now = new Date();
    const months: { name: string; value: number; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleString("default", { month: "short" }),
        year: d.getFullYear(),
        month: d.getMonth(),
        value: 0,
      });
    }
    for (const pet of pets) {
      const raw = pet.createdAt || pet._id?.toString();
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const bucket = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
      if (bucket) bucket.value += 1;
    }
    return months.map(({ name, value }) => ({ name, value }));
  }, [pets]);

  const avgMonthlyRegistrations = useMemo(() => {
    const sum = monthlyChartData.reduce((acc, curr) => acc + (curr.value || 0), 0);
    return monthlyChartData.length > 0 ? Math.round(sum / monthlyChartData.length) : 0;
  }, [monthlyChartData]);

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
    setSelectedPetDetail(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("petId");
      url.searchParams.delete("petName");
      window.history.replaceState({}, "", url.toString());
    } catch (_) {}

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
            kpi={{ label: "REGISTERED PETS", value: String(totalPets), trend: totalPets > 0 ? "+0 today" : "0 today", trendTone: "flat" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "OWNERS", value: String(totalOwners), trend: totalOwners > 0 ? "+0 today" : "0 today", trendTone: "flat" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "VISITS THIS MONTH", value: "0", trend: "0%", trendTone: "flat" }}
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
              Avg. {avgMonthlyRegistrations} / month
            </Badge>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  allowDecimals={false}
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

        {/* ── Patient 360° Profile ─────────────────────────────────────────── */}
        <Patient360Profile
          open={Boolean(selectedPetDetail) && !showVisitModal}
          petId={selectedPetDetail?.petId ?? null}
          initialPet={selectedPetDetail}
          onClose={() => setSelectedPetDetail(null)}
          onStartConsultation={(p, o) => {
            setSelectedPetDetail(null);
            handleStartConsultation(p, o);
          }}
          onChanged={() => void loadData()}
        />

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
            onVisitFinalized={(updatedVisit) => {
              if (updatedVisit) {
                setSelectedVisit(updatedVisit);
              }
              void loadData();
            }}
          />
        )}

      </div>
    </Shell>
  );
}
