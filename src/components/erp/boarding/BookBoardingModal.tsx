import { useState, useEffect } from "react";
import {
  Calendar,
  Home,
  User,
  Dog,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
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
  onBooked?: (booking: any) => void;
}

export function BookBoardingModal({ open, onClose, onBooked }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Boarding parameters
  const [bookingId, setBookingId] = useState(`BK-${Math.floor(1000 + Math.random() * 9000)}`);
  const [kennel, setKennel] = useState("Deluxe Suite K-04");
  const [checkIn, setCheckIn] = useState(new Date().toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [ratePerDay, setRatePerDay] = useState("1200");
  const [dietPlan, setDietPlan] = useState("Royal Canin Maxi Adult (2x Daily) + Wet food topper");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPets();
      setBookingId(`BK-${Math.floor(2000 + Math.random() * 8000)}`);
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
      toast.error("Please select a pet");
      return;
    }

    setSubmitting(true);
    const newBooking = {
      booking: bookingId,
      pet: selectedPet.name,
      petId: selectedPet.petId,
      species: selectedPet.species,
      breed: selectedPet.breed,
      owner: selectedPet.owner?.name || "Client",
      ownerPhone: selectedPet.owner?.phone || "N/A",
      kennel,
      checkIn,
      checkOut,
      rate: Number(ratePerDay) || 1200,
      status: "Booked",
      dietPlan,
      notes,
    };

    setTimeout(() => {
      setSubmitting(false);
      toast.success(`Boarding booked for ${selectedPet.name} in ${kennel}!`);
      onBooked?.(newBooking);
      onClose();
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl border-border bg-card shadow-2xl p-0 gap-0">
        <div className="border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
                <Home className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  New Kennel Boarding Stay Reservation
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Book climate-controlled kennel suite, feeding schedule and overnight boarding
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
                <Dog className="size-4 text-primary" /> Select Patient &amp; Pet Parent
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

          {/* Kennel Suite & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Kennel Suite / Room</Label>
              <Select value={kennel} onValueChange={setKennel}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Deluxe Suite K-04">Deluxe Suite K-04 (Climate Controlled)</SelectItem>
                  <SelectItem value="Executive Suite K-12">Executive Suite K-12 (Large Breed)</SelectItem>
                  <SelectItem value="Cozy Cat Condo C-02">Cozy Cat Condo C-02 (Feline Suite)</SelectItem>
                  <SelectItem value="Standard Kennel K-08">Standard Kennel K-08</SelectItem>
                  <SelectItem value="Puppy Playpen P-01">Puppy Playpen P-01</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Rate / Day (₹)</Label>
              <Input
                type="number"
                value={ratePerDay}
                onChange={(e) => setRatePerDay(e.target.value)}
                className="text-xs h-9 font-mono bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Check-in Date</Label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Check-out Date</Label>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Feeding &amp; Diet Plan</Label>
            <Input
              value={dietPlan}
              onChange={(e) => setDietPlan(e.target.value)}
              className="text-xs h-9"
              placeholder="e.g. Kibble morning and night, fresh water always..."
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBook}
              disabled={submitting || !selectedPet}
              className="font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 px-5"
            >
              <CheckCircle2 className="size-4" /> Confirm Boarding Stay ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
