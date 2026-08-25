import { useState, useEffect } from "react";
import {
  Waves,
  Calendar,
  User,
  Dog,
  Plus,
  Search,
  CheckCircle2,
  Clock,
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

interface Props {
  open: boolean;
  onClose: () => void;
  onBooked?: (session: any) => void;
}

export function BookSwimmingModal({ open, onClose, onBooked }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Pool Session details
  const [sessionId, setSessionId] = useState(`SW-${Math.floor(100 + Math.random() * 900)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState("03:30 PM");
  const [sessionType, setSessionType] = useState<"Hydro-Rehab" | "Fun Splash" | "Weight Loss & Fitness" | "First Swim Trial">("Hydro-Rehab");
  const [duration, setDuration] = useState("30 min");
  const [trainer, setTrainer] = useState("Sunil Jadhav (Certified Hydrotherapist)");
  const [rate, setRate] = useState("650");
  const [lifeJacket, setLifeJacket] = useState<"Provided by Clinic" | "Owner's Own" | "Not Required">("Provided by Clinic");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPets();
      setSessionId(`SW-${Math.floor(200 + Math.random() * 800)}`);
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

  const handleBook = () => {
    if (!selectedPet) {
      toast.error("Please select a patient");
      return;
    }

    setSubmitting(true);
    const newSession = {
      session: sessionId,
      time: timeSlot,
      date,
      pet: selectedPet.name,
      petId: selectedPet.petId,
      species: selectedPet.species,
      breed: selectedPet.breed,
      owner: selectedPet.owner?.name || "Client",
      ownerPhone: selectedPet.owner?.phone || "N/A",
      type: sessionType,
      duration,
      trainer,
      rate: Number(rate) || 650,
      lifeJacket,
      status: "Scheduled",
    };

    setTimeout(() => {
      setSubmitting(false);
      toast.success(`Swimming & Hydrotherapy slot booked for ${selectedPet.name}!`);
      onBooked?.(newSession);
      onClose();
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl border-border bg-card shadow-2xl p-0 gap-0">
        <div className="border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-500 text-white font-bold shadow-xs">
                <Waves className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Book Hydrotherapy &amp; Pool Swimming Session
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Assisted rehabilitation, conditioning swims, and temperature-controlled pool lanes
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
                <Dog className="size-4 text-primary" /> Select Swimmer (Patient)
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

          {/* Session Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Session Type</Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as any)}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hydro-Rehab">Post-op Hydro-Rehabilitation</SelectItem>
                  <SelectItem value="Fun Splash">Recreational Fun Swim</SelectItem>
                  <SelectItem value="Weight Loss & Fitness">Weight Loss Conditioning</SelectItem>
                  <SelectItem value="First Swim Trial">First-Time Puppy Water Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Time Slot</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10:00 AM">10:00 AM - Lane 1</SelectItem>
                  <SelectItem value="11:30 AM">11:30 AM - Lane 2</SelectItem>
                  <SelectItem value="02:30 PM">02:30 PM - Lane 1</SelectItem>
                  <SelectItem value="03:30 PM">03:30 PM - Lane 2</SelectItem>
                  <SelectItem value="04:30 PM">04:30 PM - Lane 1</SelectItem>
                  <SelectItem value="05:30 PM">05:30 PM - Lane 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Duration &amp; Fee (₹)</Label>
              <Input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="text-xs h-9 font-mono bg-card"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Hydrotherapist / Trainer</Label>
              <Select value={trainer} onValueChange={setTrainer}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sunil Jadhav (Certified Hydrotherapist)">Sunil Jadhav (Certified Hydrotherapist)</SelectItem>
                  <SelectItem value="Ramesh Shinde (Canine Swim Trainer)">Ramesh Shinde (Canine Swim Trainer)</SelectItem>
                  <SelectItem value="Dr. Aisha Nair (Rehab Supervisor)">Dr. Aisha Nair (Rehab Supervisor)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Life Jacket &amp; Buoyancy Gear</Label>
              <Select value={lifeJacket} onValueChange={(v) => setLifeJacket(v as any)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Provided by Clinic">Provided by Clinic (Fitted)</SelectItem>
                  <SelectItem value="Owner's Own">Owner Brought Own Jacket</SelectItem>
                  <SelectItem value="Not Required">Competent Swimmer (No Vest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBook}
              disabled={submitting || !selectedPet}
              className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5 px-5"
            >
              <CheckCircle2 className="size-4" /> Confirm Pool Session ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
