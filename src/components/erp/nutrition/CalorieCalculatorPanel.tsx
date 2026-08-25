import { useState } from "react";
import {
  Calculator,
  Scale,
  Sparkles,
  Zap,
  RotateCcw,
  Dog,
  Bone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THERAPEUTIC_DIETS } from "./NewFeedingPlanModal";

export function CalorieCalculatorPanel() {
  const [weightKg, setWeightKg] = useState("20");
  const [species, setSpecies] = useState<"Canine" | "Feline">("Canine");
  const [lifeStageFactor, setLifeStageFactor] = useState("1.6"); // Neutered Adult
  const fallbackDiet = THERAPEUTIC_DIETS[0] ?? { name: "Royal Canin Renal Support", brand: "Royal Canin", type: "Renal", kcalPerKg: 3950, form: "Dry Kibble" };
  const [selectedDietName, setSelectedDietName] = useState(fallbackDiet.name);

  const wt = Math.max(0.5, Number(weightKg) || 10);
  const factor = Number(lifeStageFactor) || 1.6;

  // RER = 70 * (weight ^ 0.75)
  const rer = Math.round(70 * Math.pow(wt, 0.75));
  const mer = Math.round(rer * factor);

  const dietObj = THERAPEUTIC_DIETS.find((d) => d.name === selectedDietName) || fallbackDiet;
  const gramsPerDay = Math.round((mer / (dietObj?.kcalPerKg || 3800)) * 1000);
  const cupsPerDay = (gramsPerDay / 100).toFixed(1); // approx 100g per measuring cup
  const waterIntakeMl = Math.round(mer * 1.0); // 1ml per kcal of MER


  return (
    <div className="erp-card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calculator className="size-4 text-primary" />
            Veterinary Caloric Requirement &amp; Portion Calculator (RER / MER)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scientific metabolic calculations following WSAVA Nutritional Assessment Guidelines
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono text-primary bg-primary/10">
          WSAVA Standard Formula
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Parameters */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Species</Label>
              <Select value={species} onValueChange={(v) => setSpecies(v as any)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Canine">🐶 Canine (Dog)</SelectItem>
                  <SelectItem value="Feline">🐱 Feline (Cat)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Current Body Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="text-xs h-9 font-mono font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Life Stage &amp; Activity Factor</Label>
            <Select value={lifeStageFactor} onValueChange={setLifeStageFactor}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">Weight Loss / Severe Obesity (1.0x RER)</SelectItem>
                <SelectItem value="1.2">Senior / Inactive / Sedentary (1.2x RER)</SelectItem>
                <SelectItem value="1.4">Weight Maintenance / Light Activity (1.4x RER)</SelectItem>
                <SelectItem value="1.6">Neutered Adult (Normal Activity) (1.6x RER)</SelectItem>
                <SelectItem value="1.8">Intact Adult / Active Dog (1.8x RER)</SelectItem>
                <SelectItem value="2.0">Puppy Growth / High Performance (2.0x RER)</SelectItem>
                <SelectItem value="3.0">Lactation / Heavy Working (3.0x RER)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Selected Therapeutic Diet Product</Label>
            <Select value={selectedDietName} onValueChange={setSelectedDietName}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THERAPEUTIC_DIETS.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    {d.name} ({d.kcalPerKg} kcal/kg)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Output Caloric Matrix Card */}
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-primary/20 pb-2">
              <span className="text-xs font-bold text-foreground">Target Daily Energy Requirement (MER)</span>
              <span className="font-mono text-lg font-black text-primary">{mer} kcal / day</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-card border border-border">
                <p className="text-[10px] text-muted-foreground">Resting Energy (RER):</p>
                <p className="font-mono font-bold text-sm text-foreground">{rer} kcal</p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <p className="text-[10px] text-muted-foreground">Hydration Need:</p>
                <p className="font-mono font-bold text-sm text-foreground">{waterIntakeMl} ml / day</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Prescribed Dry Food Portion:</span>
                <span className="font-mono text-base font-black text-emerald-600">{gramsPerDay} g / day</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Approx. <strong>{cupsPerDay} standard measuring cups</strong> divided into 2 meals (<strong>{Math.round(gramsPerDay / 2)}g each</strong>).
              </p>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">
            * Caloric requirements are estimated guidelines. Monitor body weight weekly and adjust ±10% as clinically indicated.
          </div>
        </div>
      </div>
    </div>
  );
}
