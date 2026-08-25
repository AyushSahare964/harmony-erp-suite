import { useState, useEffect } from "react";
import {
  FlaskConical,
  Calendar,
  User,
  Dog,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  TestTube2,
  Syringe,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { cn } from "@/lib/utils";

export const DEFAULT_TEST_CATALOG = [
  { code: "TST-CBC", name: "Complete Blood Count (CBC + Diff)", sample: "Blood (EDTA Purple)", dept: "Hematology", tat: "2 hrs", price: 750, urgentAvailable: true },
  { code: "TST-LFT", name: "Liver Function Panel (ALT, AST, ALP, Bili, Alb)", sample: "Serum (SST Yellow)", dept: "Biochemistry", tat: "4 hrs", price: 1200, urgentAvailable: true },
  { code: "TST-KFT", name: "Kidney Function Panel (BUN, Creatinine, Phos)", sample: "Serum (SST Yellow)", dept: "Biochemistry", tat: "3 hrs", price: 950, urgentAvailable: true },
  { code: "TST-ELISA-PARVO", name: "Canine Parvovirus Antigen ELISA Snap", sample: "Fecal Swab", dept: "Serology", tat: "30 min", price: 850, urgentAvailable: true },
  { code: "TST-URINE", name: "Urinalysis + Microscopic Sediment", sample: "Urine (Sterile Cup)", dept: "Clinical Pathology", tat: "2 hrs", price: 500, urgentAvailable: false },
  { code: "TST-SKIN-CYTO", name: "Skin Scraping Cytology & Tape Impression", sample: "Skin / Exudate", dept: "Microbiology", tat: "3 hrs", price: 650, urgentAvailable: false },
  { code: "TST-THYROID", name: "Total Thyroxine (T4) Immunoassay", sample: "Serum (Plain Red)", dept: "Endocrinology", tat: "6 hrs", price: 1400, urgentAvailable: false },
  { code: "TST-ELECTRO", name: "Electrolytes Panel (Na+, K+, Cl-, iCa)", sample: "Whole Blood (Heparin Green)", dept: "Critical Care", tat: "45 min", price: 800, urgentAvailable: true },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onOrderCreated?: (order: any) => void;
}

export function CreateLabOrderModal({ open, onClose, onOrderCreated }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Order fields
  const [orderId, setOrderId] = useState(`LAB-${Math.floor(8800 + Math.random() * 200)}`);
  const [selectedTestCodes, setSelectedTestCodes] = useState<string[]>(["TST-CBC"]);
  const [priority, setPriority] = useState<"Routine" | "Urgent STAT" | "Pre-Op">("Routine");
  const [doctor, setDoctor] = useState("Dr. Rohit Sharma");
  const [sampleCollector, setSampleCollector] = useState("Jyoti Sahare (Vet Tech)");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPets();
      setOrderId(`LAB-${Math.floor(8800 + Math.random() * 200)}`);
    }
  }, [open]);

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

  const toggleTest = (code: string) => {
    setSelectedTestCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const selectedTests = DEFAULT_TEST_CATALOG.filter((t) => selectedTestCodes.includes(t.code));
  const totalCost = selectedTests.reduce((acc, t) => acc + t.price, 0);

  const handleCreate = () => {
    if (!selectedPet) {
      toast.error("Please select a patient");
      return;
    }
    if (selectedTestCodes.length === 0) {
      toast.error("Please select at least one laboratory test");
      return;
    }

    setSubmitting(true);
    const newOrder = {
      order: orderId,
      pet: selectedPet.name,
      petId: selectedPet.petId,
      species: selectedPet.species || "Canine",
      breed: selectedPet.breed || "Mix",
      owner: selectedPet.owner?.name || "Client",
      ownerPhone: selectedPet.owner?.phone || "N/A",
      test: selectedTests.map((t) => t.name).join(", "),
      tests: selectedTests,
      sample: selectedTests.map((t) => t.sample).join("; "),
      collected: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toISOString().slice(0, 10),
      doctor,
      collector: sampleCollector,
      priority,
      status: priority === "Urgent STAT" ? "Urgent" : "In process",
      totalAmount: totalCost,
      notes,
    };

    setTimeout(() => {
      setSubmitting(false);
      toast.success(`Lab Order ${orderId} created for ${selectedPet.name} (${selectedTests.length} tests)!`);
      onOrderCreated?.(newOrder);
      onClose();
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl border-border bg-card shadow-2xl p-0 gap-0">
        <div className="border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
                <FlaskConical className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Create Diagnostic Laboratory Order
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Order hematology, biochemistry panels, serology snap tests and cytology
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
                placeholder="Search patient by name, UID (e.g. PET-0001), or phone..."
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

          {/* Test Profile Multi-Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Select Diagnostic Tests &amp; Panels ({selectedTestCodes.length})</Label>
              <span className="text-xs font-mono font-bold text-primary">Est. Cost: ₹{totalCost.toLocaleString("en-IN")}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-muted/20 rounded-xl border border-border">
              {DEFAULT_TEST_CATALOG.map((t) => {
                const isChecked = selectedTestCodes.includes(t.code);
                return (
                  <div
                    key={t.code}
                    onClick={() => toggleTest(t.code)}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between shadow-2xs",
                      isChecked
                        ? "bg-primary/10 border-primary text-foreground font-semibold"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <TestTube2 className={cn("size-3.5", isChecked ? "text-primary" : "text-muted-foreground")} />
                        <span>{t.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{t.sample} · TAT: {t.tat}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-xs">₹{t.price}</span>
                      {isChecked && <CheckCircle2 className="size-3.5 text-primary ml-auto mt-1" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority, Doctor & Sample Collector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Order Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">🟢 Routine OPD Test</SelectItem>
                  <SelectItem value="Urgent STAT">🔴 Urgent STAT (Emergency)</SelectItem>
                  <SelectItem value="Pre-Op">🟡 Pre-Operative Screening</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Ordering Doctor</Label>
              <Select value={doctor} onValueChange={setDoctor}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dr. Rohit Sharma">Dr. Rohit Sharma</SelectItem>
                  <SelectItem value="Dr. Aisha Nair">Dr. Aisha Nair</SelectItem>
                  <SelectItem value="Dr. Rao">Dr. Rao</SelectItem>
                  <SelectItem value="Dr. Hussain">Dr. Hussain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Phlebotomist / Tech</Label>
              <Input
                value={sampleCollector}
                onChange={(e) => setSampleCollector(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Clinical Indications &amp; Diagnostic Notes</Label>
            <Input
              placeholder="e.g. Suspected acute gastroenteritis, check platelet count, fasting 8 hours..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={submitting || !selectedPet || selectedTestCodes.length === 0}
              className="font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 px-5"
            >
              <CheckCircle2 className="size-4" /> Place Lab Order #{orderId} ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
