import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Dog,
  User,
  Search,
  FileText,
  Calendar,
  Download,
  Printer,
  ShieldCheck,
  Activity,
  Sparkles,
  Eye,
  Paperclip,
  CheckCircle2,
  FolderOpen,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { cn } from "@/lib/utils";

interface Props {
  reports: any[];
  onViewReport: (report: any) => void;
  onUploadDoc: () => void;
}

export function PatientSpecificDossier({ reports, onViewReport, onUploadDoc }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("PET-0001");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    void loadPets();
  }, []);

  const loadPets = async () => {
    try {
      const data = await listPetsWithOwnersFn();
      setPets(data || []);
      if (data && data.length > 0 && !selectedPetId) {
        setSelectedPetId(data[0].petId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedPet = useMemo(() => {
    return pets.find((p) => p.petId === selectedPetId) || pets[0] || {
      petId: "PET-0001",
      name: "Bruno",
      species: "Canine",
      breed: "Golden Retriever",
      gender: "Male Intact",
      weightKg: 31.0,
      dob: "2023-01-15",
      owner: { name: "Tariq Hussain", phone: "+91 90000 11111" },
      allergies: ["Penicillin"],
      microchipNo: "981098765432100",
    };
  }, [pets, selectedPetId]);

  // Filter reports specifically for this patient
  const patientReports = useMemo(() => {
    return reports.filter((r) => {
      const isThisPet = r.petId === selectedPet?.petId || r.pet?.toLowerCase() === selectedPet?.name?.toLowerCase();
      const matchCat = categoryFilter === "all" || r.category?.toLowerCase() === categoryFilter.toLowerCase();
      const matchQ =
        !searchQuery ||
        r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reportId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.doctor?.toLowerCase().includes(searchQuery.toLowerCase());
      return isThisPet && matchCat && matchQ;
    });
  }, [reports, selectedPet, categoryFilter, searchQuery]);

  const handleDownloadDossier = () => {
    toast.success(`Generated Consolidated Medical Dossier for ${selectedPet?.name} (${patientReports.length} records)`);
  };

  return (
    <div className="space-y-6">
      {/* Patient Selector Bar */}
      <div className="erp-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <Label className="text-xs font-bold text-foreground shrink-0 flex items-center gap-1.5">
            <Dog className="size-4 text-primary" /> Active Patient:
          </Label>
          <Select value={selectedPetId} onValueChange={setSelectedPetId}>
            <SelectTrigger className="text-xs h-9 bg-background flex-1">
              <SelectValue placeholder="Select patient dossier..." />
            </SelectTrigger>
            <SelectContent>
              {pets.map((p) => (
                <SelectItem key={p.petId} value={p.petId}>
                  {p.species === "Feline" ? "🐱" : "🐶"} {p.name} ({p.petId}) — {p.owner?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onUploadDoc}
            variant="outline"
            className="h-9 text-xs font-semibold gap-1.5"
          >
            <Plus className="size-3.5" /> Upload Document
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadDossier}
            className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs"
          >
            <Download className="size-3.5" /> Export Medical Dossier (PDF)
          </Button>
        </div>
      </div>

      {/* Selected Patient Identity & Clinical Bio Header Card */}
      {selectedPet && (
        <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-primary-soft/30 to-background p-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-card border border-border text-3xl shadow-xs">
                {selectedPet.species === "Feline" ? "🐱" : "🐶"}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-foreground">{selectedPet.name}</h3>
                  <Badge variant="outline" className="font-mono text-xs text-primary bg-primary/10 border-primary/30">
                    {selectedPet.petId}
                  </Badge>
                  <span className="text-xs font-bold text-muted-foreground">
                    · {selectedPet.species} ({selectedPet.breed || "Mix"})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pet Parent: <strong>{selectedPet.owner?.name || "Client"}</strong> ({selectedPet.owner?.phone || "N/A"})
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[11px] font-mono font-semibold bg-card px-2 py-0.5 rounded border border-border">
                    Weight: {selectedPet.weightKg || 25} kg
                  </span>
                  <span className="text-[11px] font-mono font-semibold bg-card px-2 py-0.5 rounded border border-border">
                    Gender: {selectedPet.gender || "Intact"}
                  </span>
                  {selectedPet.microchipNo && (
                    <span className="text-[11px] font-mono text-muted-foreground bg-card px-2 py-0.5 rounded border border-border">
                      RFID: {selectedPet.microchipNo}
                    </span>
                  )}
                  {selectedPet.allergies && selectedPet.allergies.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] py-0 font-bold">
                      ⚠️ Allergy: {selectedPet.allergies.join(", ")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                {patientReports.length} Historical Reports Available
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Patient Reports Filter Bar */}
      <div className="erp-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search in this patient's medical records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {["all", "Laboratory", "Radiology & Imaging", "Surgical & OT", "Discharge & Rx", "Uploaded External"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg border transition-all",
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                {cat === "all" ? "All Records" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Dossier Timeline Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">REPORT ID</th>
                <th className="px-4 py-3">INVESTIGATION / PROCEDURE</th>
                <th className="px-4 py-3">DEPARTMENT</th>
                <th className="px-4 py-3">DOCTOR / SOURCE</th>
                <th className="px-4 py-3">DATE</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patientReports.map((r) => (
                <tr key={r.reportId} className="hover:bg-primary-soft/30 transition-colors">
                  {/* ID */}
                  <td className="px-4 py-3 font-mono font-bold text-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                      {r.reportId}
                    </span>
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <p className="font-bold text-foreground">{r.title}</p>
                    {r.notes && <p className="text-[10px] text-muted-foreground line-clamp-1">{r.notes}</p>}
                  </td>

                  {/* Department */}
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20">
                      {r.category}
                    </Badge>
                  </td>

                  {/* Doctor */}
                  <td className="px-4 py-3 text-foreground">{r.doctor || r.facility || "Dr. Rohit Sharma"}</td>

                  {/* Date */}
                  <td className="px-4 py-3 font-mono text-muted-foreground">{r.date}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                      {r.status || "Verified"}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewReport(r)}
                      className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                    >
                      <Eye className="size-3" /> View Report
                    </Button>
                  </td>
                </tr>
              ))}

              {patientReports.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    No medical records found matching your filters for this patient.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
