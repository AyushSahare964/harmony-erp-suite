import { useState, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  Dog,
  User,
  Search,
  CheckCircle2,
  Calendar,
  Building,
  Sparkles,
  Paperclip,
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
  onUploaded?: (doc: any) => void;
}

export function UploadDocumentModal({ open, onClose, onUploaded }: Props) {
  const [pets, setPets] = useState<any[]>([]);
  const [searchPetQuery, setSearchPetQuery] = useState("");
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Form state
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<string>("Uploaded External");
  const [facilityName, setFacilityName] = useState("External Diagnostic Centre / Referral");
  const [testDate, setTestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPets();
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
      p.owner?.name?.toLowerCase().includes(q)
    );
  }).slice(0, 6);

  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      toast.success(`Selected file: ${file.name}`);
    }
  };

  const handleSave = () => {
    if (!selectedPet) {
      toast.error("Please select a patient");
      return;
    }
    if (!docTitle) {
      toast.error("Please enter a document title");
      return;
    }

    setSubmitting(true);
    const repId = `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newDoc = {
      reportId: repId,
      title: docTitle,
      category: docCategory,
      pet: selectedPet.name,
      petId: selectedPet.petId,
      species: selectedPet.species || "Canine",
      breed: selectedPet.breed || "Mix",
      owner: selectedPet.owner?.name || "Client",
      ownerPhone: selectedPet.owner?.phone || "N/A",
      doctor: "Dr. Rohit Sharma",
      facility: facilityName,
      date: testDate,
      fileName: fileName || `${docTitle.toLowerCase().replace(/\s+/g, "_")}.pdf`,
      fileSize: fileSize || "1.45 MB",
      status: "Verified & Signed",
      isUploaded: true,
      notes,
    };

    setTimeout(() => {
      setSubmitting(false);
      toast.success(`Document ${repId} successfully ingested into ${selectedPet.name}'s medical dossier!`);
      onUploaded?.(newDoc);
      onClose();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl border-border bg-card shadow-2xl p-0 gap-0">
        <div className="border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
                <UploadCloud className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Ingest &amp; Upload Medical Document / External Report
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Attach outside referral reports, ultrasound scans, historical vaccination cards, or PDF investigations
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Patient Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Dog className="size-4 text-primary" /> Select Patient
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
                placeholder="Search patient by name or UID..."
                value={searchPetQuery}
                onChange={(e) => setSearchPetQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border">
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
                        {p.owner?.name}
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

          {/* File Upload Drag & Drop Zone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Upload Document File (PDF, DICOM, PNG, JPG)</Label>
            <label className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary-soft/10 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-muted/10">
              <UploadCloud className="size-8 text-primary mb-2" />
              <p className="text-xs font-bold text-foreground">
                {fileName ? fileName : "Click to select or drag & drop file here"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {fileSize ? `Size: ${fileSize}` : "PDF, JPEG, PNG or DICOM up to 25MB"}
              </p>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.dicom,.dcm"
                onChange={handleSimulatedFileUpload}
              />
            </label>
          </div>

          {/* Document Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Document Title</Label>
              <Input
                placeholder="e.g. Abdominal Ultrasound Scan Report"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Report Category</Label>
              <Select value={docCategory} onValueChange={setDocCategory}>
                <SelectTrigger className="text-xs h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Uploaded External">📁 External Referral / Outside Report</SelectItem>
                  <SelectItem value="Radiology & Imaging">🩻 Radiology &amp; Imaging Scan</SelectItem>
                  <SelectItem value="Laboratory">🔬 Outside Reference Lab Panel</SelectItem>
                  <SelectItem value="Surgical & OT">🔪 Surgical / Histopathology Report</SelectItem>
                  <SelectItem value="Discharge & Rx">📝 Historical Vaccine Card / Discharge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Diagnostic Facility / Source</Label>
              <Input
                placeholder="e.g. City Vet Diagnostics / Specialist Referral"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Date of Investigation</Label>
              <Input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="text-xs h-9 font-mono bg-card"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Doctor's Clinical Notes / Summary</Label>
            <Input
              placeholder="Key diagnostic impressions, findings, or follow-up recommendations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs h-9 bg-card"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={submitting || !selectedPet || !docTitle}
              className="font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 px-5"
            >
              <CheckCircle2 className="size-4" /> Save to Patient Dossier ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
