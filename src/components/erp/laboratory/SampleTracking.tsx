import { useState, useMemo } from "react";
import {
  QrCode,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building,
  Clock,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SAMPLE_TRACKING_DATA = [
  { barcode: "SMP-90412", pet: "Bruno", petId: "PET-0001", specimen: "Whole Blood (EDTA)", tubeColor: "Purple", storage: "Refrigerated 2-8°C", lab: "In-House Mindray BC-5000", collectedAt: "09:45 AM", status: "In process" },
  { barcode: "SMP-90413", pet: "Coco", petId: "PET-0008", specimen: "Skin Cytology Slide", tubeColor: "Glass Slide Box", storage: "Ambient 20-25°C", lab: "In-House Microscopy", collectedAt: "10:20 AM", status: "In process" },
  { barcode: "SMP-90414", pet: "Luna", petId: "PET-0002", specimen: "Serum (SST Gel)", tubeColor: "Yellow", storage: "Centrifuged & Refrigerated", lab: "In-House Fuji Dri-Chem", collectedAt: "10:55 AM", status: "Urgent" },
  { barcode: "SMP-90415", pet: "Milo", petId: "PET-0005", specimen: "Sterile Urine", tubeColor: "Sterile Cup", storage: "Refrigerated 2-8°C", lab: "In-House Urinalysis", collectedAt: "11:10 AM", status: "Pending" },
  { barcode: "SMP-90416", pet: "Kiwi", petId: "PET-0004", specimen: "Swab Culture Media", tubeColor: "Transport Swab", storage: "Ambient", lab: "Outsourced (IDEXX Metropolis)", collectedAt: "11:35 AM", status: "In transit" },
  { barcode: "SMP-90417", pet: "Rocky", petId: "PET-0003", specimen: "Biopsy in 10% Formalin", tubeColor: "Formalin Jar", storage: "Ambient", lab: "Outsourced (Veterinary Histopath)", collectedAt: "08:30 AM", status: "In transit" },
];

export function SampleTracking() {
  const [samples, setSamples] = useState(SAMPLE_TRACKING_DATA);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return samples.filter(
      (s) =>
        !q ||
        s.barcode.toLowerCase().includes(q) ||
        s.pet.toLowerCase().includes(q) ||
        s.specimen.toLowerCase().includes(q) ||
        s.lab.toLowerCase().includes(q)
    );
  }, [samples, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sample barcode, patient, tube type, or destination lab..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {filtered.length} active samples tracked
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
              <th className="px-4 py-3">BARCODE ID</th>
              <th className="px-4 py-3">PATIENT</th>
              <th className="px-4 py-3">SPECIMEN &amp; TUBE</th>
              <th className="px-4 py-3">STORAGE CONDITION</th>
              <th className="px-4 py-3">PROCESSING LAB</th>
              <th className="px-4 py-3">COLLECTED AT</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.barcode} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-mono font-bold text-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                    {s.barcode}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <span>{s.pet}</span>
                    <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary">
                      {s.petId}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{s.specimen}</p>
                  <p className="text-[10px] text-muted-foreground">Tube: {s.tubeColor}</p>
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{s.storage}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded",
                    s.lab.includes("In-House") ? "bg-primary/10 text-primary" : "bg-purple-500/10 text-purple-600"
                  )}>
                    {s.lab}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{s.collectedAt}</td>
                <td className="px-4 py-3">
                  <StatusPill value={s.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toast.info(`Printing 2D Barcode label for ${s.barcode}`)}
                    className="h-7 text-[11px] font-semibold text-primary"
                  >
                    Print Label
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
