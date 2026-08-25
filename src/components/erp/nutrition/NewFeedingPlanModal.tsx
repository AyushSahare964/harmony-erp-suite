import { useState, useEffect } from "react";
import {
  Bone,
  Calendar,
  User,
  Dog,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Scale,
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
import { cn } from "@/lib/utils";

export const THERAPEUTIC_DIETS = [
  { name: "Royal Canin Renal Support", brand: "Royal Canin", type: "Renal / Kidney", kcalPerKg: 3950, form: "Dry Kibble" },
  { name: "Farmina Vet Life Gastrointestinal", brand: "Farmina", type: "Digestive Care", kcalPerKg: 3800, form: "Dry Kibble" },
  { name: "Hill's Prescription Diet Hypoallergenic z/d", brand: "Hill's", type: "Dermatology / Food Allergy", kcalPerKg: 3600, form: "Dry Kibble" },
  { name: "Royal Canin Satiety Weight Management", brand: "Royal Canin", type: "Weight Loss", kcalPerKg: 2900, form: "Dry Kibble" },
  { name: "Purina Pro Plan Veterinary Diets FortiFlora / EN", brand: "Purina", type: "GI / Probiotics", kcalPerKg: 3750, form: "Dry Kibble" },
  { name: "Royal Canin Puppy Maxi Growth", brand: "Royal Canin", type: "Puppy Growth", kcalPerKg: 4050, form: "Dry Kibble" },
  { name: "Royal Canin Hairball Care Feline", brand: "Royal Canin", type: "Feline Hairball", kcalPerKg: 3760, form: "Dry Kibble" },
  { name: "Farmina Vet Life Diabetic Management", brand: "Farmina", type: "Endocrinology", kcalPerKg: 3100, form: "Dry Kibble" },
  { name: "Hill's Prescription Diet c/d Multicare Urinary", brand: "Hill's", type: "Urinary / Struvite", kcalPerKg: 3820, form: "Dry Kibble" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onPlanCreated?: (plan: any) => void;
}

export function NewFeedingPlanModal({ open, onClose, onPlanCreated }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Plan parameters
  const fallbackDiet = THERAPEUTIC_DIETS[0] ?? { name: "Royal Canin Renal Support", brand: "Royal Canin", type: "Renal / Kidney", kcalPerKg: 3950, form: "Dry Kibble" };
  const [planId, setPlanId] = useState(`NUT-${Math.floor(200 + Math.random() * 800)}`);
  const [selectedDiet, setSelectedDiet] = useState(fallbackDiet.name);
  const [currentWeight, setCurrentWeight] = useState("24.5");
  const [targetWeight, setTargetWeight] = useState("23.0");
  const [bcs, setBcs] = useState("5 / 9 (Ideal)");
  const [qtyPerDayGrams, setQtyPerDayGrams] = useState("320");
  const [mealsPerDay, setMealsPerDay] = useState("2 Meals (Morning & Evening)");
  const [hydrationGoal, setHydrationGoal] = useState("1.2 Litres fresh water daily");
  const [restrictions, setRestrictions] = useState("Strictly no table scraps, no poultry fat treats");
  const [nextReview, setNextReview] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().slice(0, 10);
  });
  const [doctor, setDoctor] = useState("Dr. Rohit Sharma");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPets();
      setPlanId(`NUT-${Math.floor(200 + Math.random() * 800)}`);
    }
  }, [open]);

  const loadPets = async () => {
    try {
      const data = await listPetsWithOwnersFn();
      setPets(data || []);
      if (data && data.length > 0 && !selectedPet) {
        setSelectedPet(data[0]);
        if (data[0].weightKg) {
          setCurrentWeight(String(data[0].weightKg));
          setTargetWeight(String(data[0].weightKg));
        }
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

  // Auto calculate daily grams based on weight and diet
  const handleAutoCalculate = () => {
    const wt = Number(currentWeight) || 10;
    // RER = 70 * (wt ^ 0.75)
    const rer = 70 * Math.pow(wt, 0.75);
    const mer = rer * 1.4; // standard maintenance
    const dietObj = THERAPEUTIC_DIETS.find((d) => d.name === selectedDiet) || fallbackDiet;
    const grams = Math.round((mer / (dietObj?.kcalPerKg || 3800)) * 1000);
    setQtyPerDayGrams(String(grams));
    toast.success(`Calculated: ${Math.round(mer)} kcal/day → ${grams}g of ${dietObj?.name || selectedDiet}`);
  };


  const handleCreate = () => {
    if (!selectedPet) {
      toast.error("Please select a pet");
      return;
    }

    setSubmitting(true);
    const newPlan = {
      plan: planId,
      pet: selectedPet.name,
      petId: selectedPet.petId,
      species: selectedPet.species || "Canine",
      breed: selectedPet.breed || "Mix",
      owner: selectedPet.owner?.name || "Client",
      ownerPhone: selectedPet.owner?.phone || "N/A",
      diet: selectedDiet,
      qtyPerDay: Number(qtyPerDayGrams) || 300,
      currentWeight: Number(currentWeight) || 20,
      targetWeight: Number(targetWeight) || 20,
      bcs,
      mealsPerDay,
      hydrationGoal,
      restrictions,
      nextReview,
      doctor,
      status: "Active",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setTimeout(() => {
      setSubmitting(false);
      toast.success(`Feeding Plan ${planId} prescribed for ${selectedPet.name}!`);
      onPlanCreated?.(newPlan);
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
                <Bone className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Prescribe Clinical Feeding &amp; Nutrition Plan
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Formulate therapeutic prescription diet, portion sizing, target caloric intake and review schedule
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
                    onClick={() => {
                      setSelectedPet(p);
                      if (p.weightKg) {
                        setCurrentWeight(String(p.weightKg));
                        setTargetWeight(String(p.weightKg));
                      }
                    }}
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
                        {p.owner?.name} ({p.owner?.phone}) · {p.weightKg || 25} kg
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

          {/* Weight, Target & BCS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Current Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                className="text-xs h-9 font-mono bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Target Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="text-xs h-9 font-mono bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Body Condition Score (BCS)</Label>
              <Select value={bcs} onValueChange={setBcs}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3 / 9 (Underweight)">3 / 9 (Underweight)</SelectItem>
                  <SelectItem value="4 / 9 (Lean)">4 / 9 (Lean)</SelectItem>
                  <SelectItem value="5 / 9 (Ideal)">5 / 9 (Ideal / Optimal)</SelectItem>
                  <SelectItem value="6 / 9 (Overweight)">6 / 9 (Overweight)</SelectItem>
                  <SelectItem value="7 / 9 (Heavy)">7 / 9 (Heavy)</SelectItem>
                  <SelectItem value="8 / 9 (Obese)">8 / 9 (Obese)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Diet Selection & Caloric Portioning */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Therapeutic Diet &amp; Daily Portion</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoCalculate}
                className="h-7 text-[11px] font-bold text-primary gap-1 border-primary/30"
              >
                <Calculator className="size-3" /> Auto Calculate Grams
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Prescription Diet Product</Label>
                <Select value={selectedDiet} onValueChange={setSelectedDiet}>
                  <SelectTrigger className="text-xs h-9 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THERAPEUTIC_DIETS.map((d) => (
                      <SelectItem key={d.name} value={d.name}>
                        {d.name} ({d.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Prescribed Quantity / Day (Grams)</Label>
                <Input
                  type="number"
                  value={qtyPerDayGrams}
                  onChange={(e) => setQtyPerDayGrams(e.target.value)}
                  className="text-xs h-9 font-mono font-bold bg-card"
                />
              </div>
            </div>
          </div>

          {/* Meal Frequency, Hydration & Review Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Meal Frequency</Label>
              <Select value={mealsPerDay} onValueChange={setMealsPerDay}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1 Meal (Once Daily)">1 Meal (Once Daily)</SelectItem>
                  <SelectItem value="2 Meals (Morning & Evening)">2 Meals (Morning &amp; Evening)</SelectItem>
                  <SelectItem value="3 Meals (Divided Equally)">3 Meals (Divided Equally)</SelectItem>
                  <SelectItem value="Free Choice / Grazing">Free Choice / Grazing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Hydration Target</Label>
              <Input
                value={hydrationGoal}
                onChange={(e) => setHydrationGoal(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Next Review Date</Label>
              <Input
                type="date"
                value={nextReview}
                onChange={(e) => setNextReview(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Dietary Restrictions &amp; Treat Guidelines</Label>
            <Input
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
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
              disabled={submitting || !selectedPet}
              className="font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 px-5"
            >
              <CheckCircle2 className="size-4" /> Prescribe Feeding Plan #{planId} ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
