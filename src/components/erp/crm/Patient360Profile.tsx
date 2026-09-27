import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bird,
  Calendar,
  CalendarPlus,
  Camera,
  Cat,
  ClipboardList,
  CreditCard,
  Dog,
  Download,
  Edit2,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  PawPrint,
  Phone,
  Pill,
  Printer,
  Rabbit,
  Receipt,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Star,
  Stethoscope,
  Syringe,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/erp/StatusPill";
import { BookAppointmentModal } from "@/components/erp/appointments/BookAppointmentModal";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { PrescriptionPrintView } from "@/components/erp/clinical/PrescriptionPrintView";
import { InvoicePrintView } from "@/components/erp/clinical/InvoicePrintView";
import { InvoiceDetailModal } from "@/components/erp/billing/InvoiceDetailModal";
import { updatePetFn, updateOwnerFn } from "@/lib/mongodb/serverFns/crm";
import { updateAppointmentStatusFn } from "@/lib/mongodb/serverFns/appointments";
import {
  getPatient360Fn,
  addPatientFileFn,
  getPatientFileFn,
  deletePatientFileFn,
} from "@/lib/mongodb/serverFns/patient360";
import {
  ageLabel,
  billOf,
  billingSummary,
  dewormingHistory,
  isBill,
  paymentHistory,
  prescriptionLines,
  splitAppointments,
  vaccinationHistory,
} from "@/lib/erp/patient360";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { readAsDataUrl, resizeImage } from "@/lib/utils/imageUpload";
import { useErp } from "@/lib/erp/store";
import { cn } from "@/lib/utils";

// ─── Small helpers ───────────────────────────────────────────────────────────

const fd = (s: unknown) => (s ? formatDisplayDate(String(s)) || String(s) : "N/A");
const inr = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const list = (a: unknown) => (Array.isArray(a) ? a.filter(Boolean).map(String) : []);
const csv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const todayIso = () => new Date().toISOString().slice(0, 10);
const digits10 = (p: unknown) =>
  String(p ?? "")
    .replace(/\D/g, "")
    .slice(-10);

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const MAX_FILE_BYTES = 3 * 1024 * 1024;

const DOC_CATEGORIES = [
  "Previous Medical Report",
  "Lab Report",
  "X-Ray",
  "Ultrasound Report",
  "Vaccination Certificate",
  "Insurance Document",
  "Other Medical Document",
];
const PHOTO_CATEGORIES = [
  "General Patient Photo",
  "Skin Condition",
  "Wound",
  "Pre-treatment",
  "Post-treatment",
  "Swelling",
  "Injury",
  "Other Clinical Observation",
];


function SpeciesIcon({ species, className }: { species?: string; className?: string }) {
  const Icon =
    species === "Feline"
      ? Cat
      : species === "Avian"
        ? Bird
        : species === "Rabbit"
          ? Rabbit
          : species === "Canine"
            ? Dog
            : PawPrint;
  return <Icon className={className} />;
}

function PetAvatar({ pet, size = "lg" }: { pet: any; size?: "lg" | "sm" }) {
  const cls = size === "lg" ? "size-20 sm:size-24 rounded-2xl" : "size-9 rounded-lg";
  if (pet?.photoUrl) {
    return (
      <img
        src={pet.photoUrl}
        alt={pet.name || "Patient"}
        className={cn(cls, "object-cover border border-border bg-muted")}
      />
    );
  }
  return (
    <span
      className={cn(
        cls,
        "flex items-center justify-center border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
      )}
    >
      <SpeciesIcon species={pet?.species} className={size === "lg" ? "size-10" : "size-4"} />
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
  id,
  className,
}: {
  title: string;
  icon: typeof User;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={cn("rounded-xl border border-border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-primary" /> {title}
        </h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium text-foreground break-words whitespace-pre-line",
          mono && "font-mono text-xs",
          empty && "text-muted-foreground font-normal",
        )}
      >
        {empty ? "N/A" : value}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

/** Loading / error / empty wrapper shared by every async section. */
function SectionBody({
  loading,
  error,
  loadingText,
  onRetry,
  isEmpty,
  emptyText,
  children,
}: {
  loading: boolean;
  error?: string | undefined;
  loadingText: string;
  onRetry: () => void;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (loading)
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> {loadingText}
      </p>
    );
  if (error)
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-xs text-muted-foreground">
        <p>{loadingText.replace(/^Loading /, "Unable to load ").replace(/\.\.\.$/, ".")}</p>
        <Button size="sm" variant="outline" onClick={onRetry} className="h-7 gap-1 text-xs">
          <RotateCcw className="size-3" /> Try again
        </Button>
      </div>
    );
  if (isEmpty) return <Empty>{emptyText}</Empty>;
  return <>{children}</>;
}

function usePaged<T>(items: T[], step = 10) {
  const [n, setN] = useState(step);
  useEffect(() => setN(step), [items, step]);
  return {
    shown: items.slice(0, n),
    moreButton:
      items.length > n ? (
        <div className="pt-3 text-center">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-primary"
            onClick={() => setN((x) => x + step)}
          >
            Show more ({items.length - n} remaining)
          </Button>
        </div>
      ) : null,
  };
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={cn("whitespace-nowrap px-3 py-2 font-semibold", right && "text-right")}>
      {children}
    </th>
  );
}
function Td({
  children,
  right,
  mono,
  className,
}: {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn("px-3 py-2 align-top", right && "text-right", mono && "font-mono", className)}
    >
      {children}
    </td>
  );
}
function Table({
  head,
  children,
  minWidth = 720,
}: {
  head: ReactNode;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-xs" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function visitComplaint(v: any): string {
  const rx = v.prescriptionData || {};
  return rx.symptomsText || list(rx.symptomTags).join(", ") || v.vitals?.complaint || "";
}
function visitFindings(v: any): string {
  const rx = v.prescriptionData || {};
  return [...list(rx.clinicalFindings), rx.clinicalFindingsOther].filter(Boolean).join(", ");
}
function visitFollowUp(v: any): string {
  const rx = v.prescriptionData || {};
  const d = v.nextVisitDate || rx.followUp?.nextTreatmentDate;
  return d ? fd(d) : rx.followUp?.required ? "Required" : "";
}
const names = (arr: any[] | undefined, key: string) =>
  (arr || [])
    .map((m) => m?.[key])
    .filter(Boolean)
    .join(", ");

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  petId: string | null;
  /** Row the user clicked — rendered instantly while the full record loads. */
  initialPet?: any;
  onClose: () => void;
  /** The existing CRM "Start OPD Consultation & Rx" handler, called unchanged. */
  onStartConsultation: (pet: any, owner?: any) => void;
  /** Called after an edit so the parent list can refresh. */
  onChanged?: () => void;
}

type TabKey =
  | "overview"
  | "appointments"
  | "medical"
  | "consultations"
  | "prescriptions"
  | "preventive"
  | "documents"
  | "billing";

export function Patient360Profile({
  open,
  petId,
  initialPet,
  onClose,
  onStartConsultation,
  onChanged,
}: Props) {
  const { currentUser } = useErp();
  const [currentPetId, setCurrentPetId] = useState<string | null>(petId);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  // Child dialogs
  const [editPetOpen, setEditPetOpen] = useState(false);
  const [editOwnerOpen, setEditOwnerOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [uploadKind, setUploadKind] = useState<"document" | "photo" | null>(null);
  const [viewVisit, setViewVisit] = useState<any | null>(null);
  const [printVisit, setPrintVisit] = useState<any | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [printInvoice, setPrintInvoice] = useState<any | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [apptToEdit, setApptToEdit] = useState<any | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCurrentPetId(petId);
      setTab("overview");
    }
  }, [open, petId]);

  const load = useCallback(async (id: string | null) => {
    if (!id) return;
    setLoading(true);
    setFatal(null);
    try {
      setData(await getPatient360Fn({ data: { petId: id } }));
    } catch (err: any) {
      console.error(err);
      const rawMsg = String(err?.message || "");
      const cleanMsg =
        rawMsg.includes("<!doctype") || rawMsg.includes("<html")
          ? "Unable to connect to patient records. The server was refreshing dependencies."
          : rawMsg || "Unable to load patient profile";
      setFatal(cleanMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && currentPetId) {
      setData(null);
      void load(currentPetId);
    }
  }, [open, currentPetId, load]);

  const reload = () => void load(currentPetId);

  // While the first load is in flight, show the clicked row so the header never flashes empty.
  const pet = data?.pet ?? (currentPetId === petId ? initialPet : null) ?? {};
  const owner = data?.owner ?? pet.owner ?? null;
  const errors: Record<string, string> = data?.errors ?? {};
  const busy = loading && !data;
  const visits: any[] = useMemo(() => data?.visits ?? [], [data]);

  const derived = useMemo(() => {
    const appts = splitAppointments(data?.appointments ?? []);
    const rxLines = prescriptionLines(visits);
    const vaccines = vaccinationHistory(visits, data?.vaccinations ?? []);
    const deworms = dewormingHistory(visits, data?.dewormings ?? []);
    const latest = visits[0];
    const withVitals = visits.find(
      (v) =>
        v.vitals?.tempC ||
        v.vitals?.temp ||
        v.prescriptionData?.bodyTemperature ||
        v.vitals?.heartRate,
    );
    const files: any[] = data?.files ?? [];
    return {
      ...appts,
      rxLines,
      vaccines,
      deworms,
      latest,
      withVitals,
      bills: visits.filter(isBill),
      billing: billingSummary(visits),
      payments: paymentHistory(visits),
      documents: files.filter((f) => f.kind === "document"),
      photos: files.filter((f) => f.kind === "photo"),
      nextVaccine: pet.nextVaccineDate || vaccines.find((v) => v.nextDue)?.nextDue,
      nextDeworm: pet.nextDewormingDate || deworms.find((d) => d.nextDue)?.nextDue,
    };
  }, [data, visits, pet.nextVaccineDate, pet.nextDewormingDate]);

  const drugAllergies = list(pet.allergies);
  const foodAllergies = list(pet.foodAllergies);
  const otherAllergies = list(pet.otherAllergies);
  const clinicalAlerts = list(pet.clinicalAlerts);
  const hasAlerts =
    drugAllergies.length + foodAllergies.length + otherAllergies.length + clinicalAlerts.length > 0;

  const weight =
    pet.weightKg ?? derived.latest?.vitals?.weightKg ?? derived.latest?.prescriptionData?.weight;
  const petForWorkflow = () => ({ ...pet, owner: owner ?? pet.owner });

  // ── Photo handling ──
  const pickProfilePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    try {
      setPhotoPreview(await resizeImage(await readAsDataUrl(file), 360));
    } catch (e: any) {
      toast.error(e?.message || "Could not read image");
    }
  };

  const saveProfilePhoto = async (photoUrl: string) => {
    if (!pet.petId) return;
    setSavingPhoto(true);
    try {
      await updatePetFn({ data: { petId: pet.petId, updates: { photoUrl } } });
      toast.success(photoUrl ? "Profile photo updated" : "Profile photo removed");
      setPhotoPreview(null);
      reload();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Could not save photo");
    } finally {
      setSavingPhoto(false);
    }
  };

  const setGalleryAsProfile = async (f: any) => {
    try {
      const full = await getPatientFileFn({ data: { fileId: f.fileId } });
      setPhotoPreview(await resizeImage(full.dataUrl, 360));
    } catch (e: any) {
      toast.error(e?.message || "Could not load photo");
    }
  };

  const openFile = async (f: any, download = false) => {
    if (f.kind === "photo" && !download) {
      try {
        const full = await getPatientFileFn({ data: { fileId: f.fileId } });
        setLightbox({ url: full.dataUrl, name: f.name });
      } catch (e: any) {
        toast.error(e?.message || "Could not load photo");
      }
      return;
    }
    // Open the tab synchronously so pop-up blockers allow it, then point it at the file.
    const w = download ? null : window.open("", "_blank");
    try {
      const full = await getPatientFileFn({ data: { fileId: f.fileId } });
      const blob = await (await fetch(full.dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      if (download || !w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = f.name;
        a.click();
        w?.close();
      } else {
        w.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      w?.close();
      toast.error(e?.message || "Could not open file");
    }
  };

  const deleteFile = async (f: any) => {
    if (!confirm(`Delete "${f.name}" from ${pet.name}'s records? This cannot be undone.`)) return;
    try {
      await deletePatientFileFn({ data: { fileId: f.fileId } });
      toast.success("File deleted");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Could not delete file");
    }
  };

  const cancelAppointment = async (a: any) => {
    if (!confirm(`Cancel appointment ${a.token} on ${fd(a.appointment_date || a.date)}?`)) return;
    try {
      await updateAppointmentStatusFn({ data: { token: a.token, status: "Cancelled" } });
      toast.success("Appointment cancelled");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Could not cancel appointment");
    }
  };

  const visitForAppointment = (a: any) =>
    visits.find((v) => v.appointmentToken && String(v.appointmentToken) === String(a.token)) ||
    visits.find(
      (v) =>
        String(v.date).slice(0, 10) === String(a.appointment_date || a.date || "").slice(0, 10),
    );

  const bookingPrefill = useMemo(
    () =>
      pet.petId
        ? {
            petId: pet.petId,
            petName: pet.name,
            species: pet.species,
            breed: pet.breed,
            ownerId: pet.ownerId,
            ownerName: owner?.name,
            ownerPhone: owner?.phone,
            nextVisitDate: todayIso(),
            doctorName: "",
          }
        : null,
    [pet.petId, pet.name, pet.species, pet.breed, pet.ownerId, owner?.name, owner?.phone],
  );

  const childOpen = Boolean(viewVisit);

  return (
    <>
      <Dialog open={open && !childOpen} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="flex h-[94vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          {/* ── Header ── */}
          <div className="shrink-0 border-b border-border bg-primary-soft/30 px-4 pb-3 pt-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative w-fit shrink-0">
                <PetAvatar pet={pet} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="absolute -bottom-1.5 -right-1.5 flex size-8 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm hover:bg-primary hover:text-primary-foreground"
                      title="Manage profile photo"
                      aria-label="Manage profile photo"
                    >
                      <Camera className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="text-xs">
                    <DropdownMenuItem onClick={() => photoInputRef.current?.click()}>
                      <ImageIcon className="mr-2 size-3.5" />{" "}
                      {pet.photoUrl ? "Change photo" : "Upload from device / gallery"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => filesInputRef.current?.click()}>
                      <FolderOpen className="mr-2 size-3.5" /> Upload from files
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                      <Camera className="mr-2 size-3.5" /> Take photo (camera)
                    </DropdownMenuItem>
                    {pet.photoUrl && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setLightbox({ url: pet.photoUrl, name: pet.name })}
                        >
                          <Eye className="mr-2 size-3.5" /> Preview photo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            confirm("Remove the profile photo?") && void saveProfilePhoto("")
                          }
                        >
                          <Trash2 className="mr-2 size-3.5" /> Remove photo
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void pickProfilePhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={filesInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  hidden
                  onChange={(e) => {
                    void pickProfilePhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void pickProfilePhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1 pr-6">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-xl font-bold capitalize text-foreground">
                    {pet.name || "Patient"}
                  </DialogTitle>
                  {pet.petId && (
                    <Badge className="bg-primary font-mono text-xs text-primary-foreground">
                      {pet.petId}
                    </Badge>
                  )}
                  <StatusPill value={pet.status || "Active"} />
                </div>
                <DialogDescription className="text-sm text-muted-foreground">
                  {[pet.species, pet.breed, pet.gender].filter(Boolean).join(" · ")}
                </DialogDescription>
                <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    Age: <strong className="text-foreground">{ageLabel(pet)}</strong>
                  </span>
                  <span>
                    DOB: <strong className="text-foreground">{fd(pet.dob)}</strong>
                  </span>
                  <span>
                    Weight:{" "}
                    <strong className="text-foreground">{weight ? `${weight} kg` : "N/A"}</strong>
                  </span>
                  {owner?.name && (
                    <span className="flex items-center gap-1">
                      <User className="size-3" />{" "}
                      <strong className="text-foreground">{owner.name}</strong>
                      {owner.phone && <span className="font-mono">· {owner.phone}</span>}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-primary text-xs font-bold text-primary-foreground shadow-xs"
                disabled={!pet.petId}
                onClick={() => onStartConsultation(petForWorkflow())}
              >
                <Stethoscope className="size-3.5" /> Start OPD Consultation &amp; Rx →
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={!bookingPrefill}
                onClick={() => {
                  setApptToEdit(null);
                  setBookOpen(true);
                }}
              >
                <CalendarPlus className="size-3.5" /> Book Appointment
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={!data}
                onClick={() => setEditPetOpen(true)}
              >
                <Edit2 className="size-3.5" /> Edit Patient
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={!owner?.ownerId}
                onClick={() => setEditOwnerOpen(true)}
              >
                <User className="size-3.5" /> Edit Owner
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={!data}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="size-3.5" /> Upload Photo
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={!data}
                onClick={() => setUploadKind("document")}
              >
                <Upload className="size-3.5" /> Upload Document
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs text-primary"
                onClick={() => setTab("medical")}
              >
                <ClipboardList className="size-3.5" /> Medical Records
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs text-primary"
                onClick={() => setTab("consultations")}
              >
                <FileText className="size-3.5" /> Reports
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs text-primary"
                onClick={() => setTab("billing")}
              >
                <Receipt className="size-3.5" /> Previous Bills
              </Button>
            </div>
          </div>

          {/* ── Allergy banner: pinned above every tab so it is never scrolled away ── */}
          <div className="shrink-0 px-4 pt-3 sm:px-6">
            {hasAlerts ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 space-y-1 text-xs">
                  <p className="font-bold text-destructive">Drug Allergies &amp; Clinical Alerts</p>
                  {[
                    ["Drug", drugAllergies],
                    ["Food", foodAllergies],
                    ["Other", otherAllergies],
                    ["Alert", clinicalAlerts],
                  ].map(([label, items]) =>
                    (items as string[]).length ? (
                      <div key={label as string} className="flex flex-wrap items-center gap-1">
                        <span className="w-10 shrink-0 text-[11px] font-semibold text-destructive/80">
                          {label as string}
                        </span>
                        {(items as string[]).map((a) => (
                          <span
                            key={a}
                            className="rounded bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground"
                          >
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-success" /> No known allergies or clinical
                alerts
              </p>
            )}
          </div>

          {fatal ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
              <XCircle className="size-8 text-destructive" />
              <p>{fatal}</p>
              <Button size="sm" variant="outline" onClick={reload} className="gap-1">
                <RotateCcw className="size-3.5" /> Try again
              </Button>
            </div>
          ) : (
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as TabKey)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="shrink-0 overflow-x-auto px-4 pt-3 sm:px-6">
                <TabsList className="h-9 w-max">
                  <TabsTrigger value="overview" className="text-xs">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="appointments" className="text-xs">
                    Appointments
                  </TabsTrigger>
                  <TabsTrigger value="medical" className="text-xs">
                    Medical History
                  </TabsTrigger>
                  <TabsTrigger value="consultations" className="text-xs">
                    Consultations &amp; Reports
                  </TabsTrigger>
                  <TabsTrigger value="prescriptions" className="text-xs">
                    Prescriptions
                  </TabsTrigger>
                  <TabsTrigger value="preventive" className="text-xs">
                    Preventive Care
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">
                    Documents &amp; Photos
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="text-xs">
                    Billing
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-6">
                {/* ── OVERVIEW ── */}
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <Section title="Patient Information" icon={PawPrint}>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                      <Field label="Patient Name" value={pet.name} />
                      <Field label="Patient ID" value={pet.petId} mono />
                      <Field label="Species" value={pet.species} />
                      <Field label="Breed" value={pet.breed} />
                      <Field label="Gender" value={pet.gender} />
                      <Field label="Date of Birth" value={pet.dob ? fd(pet.dob) : ""} />
                      <Field label="Age" value={ageLabel(pet)} />
                      <Field label="Weight" value={weight ? `${weight} kg` : ""} />
                      <Field label="Coat / Color" value={pet.color} />
                      <Field label="Sterilization" value={pet.sterilizationStatus} />
                      <Field label="Microchip No." value={pet.microchipNo} mono />
                      <Field label="Blood Group" value={pet.bloodGroup} />
                      <Field label="Identification / Tag No." value={pet.tagNumber} mono />
                      <Field label="Status" value={pet.status || "Active"} />
                    </dl>
                  </Section>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Section
                      title="Pet Parent / Owner Information"
                      icon={User}
                      action={
                        owner?.ownerId && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {owner.ownerId}
                          </span>
                        )
                      }
                    >
                      <SectionBody
                        loading={busy}
                        error={errors["owner"]}
                        loadingText="Loading owner information..."
                        onRetry={reload}
                        isEmpty={!owner}
                        emptyText="No owner linked to this patient"
                      >
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <Field label="Full Name" value={owner?.name} />
                          <Field label="Owner ID" value={owner?.ownerId} mono />
                          <Field label="Phone Number" value={owner?.phone} mono />
                          <Field label="Alternate Phone" value={owner?.altPhone} mono />
                          <Field label="Email" value={owner?.email} />
                          <Field label="Relationship" value={owner?.relationship} />
                          <div className="col-span-2">
                            <Field
                              label="Billing Address"
                              value={owner?.billingAddress || owner?.address}
                            />
                          </div>
                          <Field label="City" value={owner?.city} />
                          <Field label="State" value={owner?.state} />
                          <Field label="PIN Code" value={owner?.pin} mono />
                          <Field label="Country" value={owner?.country} />
                          {owner?.occupation && (
                            <Field label="Occupation" value={owner.occupation} />
                          )}
                        </dl>
                      </SectionBody>
                    </Section>

                    <div className="space-y-4">
                      <Section title="Contact Information" icon={Phone}>
                        <SectionBody
                          loading={busy}
                          error={errors["owner"]}
                          loadingText="Loading contact information..."
                          onRetry={reload}
                          isEmpty={!owner}
                          emptyText="No contact details on file"
                        >
                          <div className="space-y-2 text-xs">
                            <p className="flex items-center gap-2">
                              <Phone className="size-3.5 text-muted-foreground" />
                              <span className="font-mono">{owner?.phone || "N/A"}</span>
                              {owner?.altPhone && (
                                <span className="font-mono text-muted-foreground">
                                  / {owner.altPhone}
                                </span>
                              )}
                            </p>
                            <p className="flex items-center gap-2">
                              <Mail className="size-3.5 text-muted-foreground" />
                              {owner?.email || "N/A"}
                            </p>
                            <p className="flex items-start gap-2">
                              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                              <span className="whitespace-pre-line">
                                {[
                                  owner?.address || owner?.billingAddress,
                                  [owner?.city, owner?.state, owner?.pin]
                                    .filter(Boolean)
                                    .join(", "),
                                  owner?.country,
                                ]
                                  .filter(Boolean)
                                  .join("\n") || "N/A"}
                              </span>
                            </p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Button
                              asChild={Boolean(owner?.phone)}
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              disabled={!owner?.phone}
                            >
                              {owner?.phone ? (
                                <a href={`tel:${String(owner.phone).replace(/[^\d+]/g, "")}`}>
                                  <Phone className="size-3" /> Call
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="size-3" /> Call
                                </span>
                              )}
                            </Button>
                            <Button
                              asChild={digits10(owner?.phone).length === 10}
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs text-success"
                              disabled={digits10(owner?.phone).length !== 10}
                            >
                              {digits10(owner?.phone).length === 10 ? (
                                <a
                                  href={`https://wa.me/91${digits10(owner?.phone)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <MessageCircle className="size-3" /> WhatsApp
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <MessageCircle className="size-3" /> WhatsApp
                                </span>
                              )}
                            </Button>
                            <Button
                              asChild={Boolean(owner?.email)}
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              disabled={!owner?.email}
                            >
                              {owner?.email ? (
                                <a href={`mailto:${owner.email}`}>
                                  <Mail className="size-3" /> Email
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="size-3" /> Email
                                </span>
                              )}
                            </Button>
                          </div>
                        </SectionBody>
                      </Section>

                      <Section title="Other Pets by This Owner" icon={Users}>
                        <SectionBody
                          loading={busy}
                          error={errors["otherPets"]}
                          loadingText="Loading other pets..."
                          onRetry={reload}
                          isEmpty={!(data?.otherPets ?? []).length}
                          emptyText="No other pets registered for this owner"
                        >
                          <div className="flex flex-wrap gap-2">
                            {(data?.otherPets ?? []).map((p: any) => (
                              <button
                                key={p.petId}
                                onClick={() => setCurrentPetId(p.petId)}
                                className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs hover:border-primary/40 hover:bg-primary-soft/30"
                              >
                                <PetAvatar pet={p} size="sm" />
                                <span>
                                  <span className="block font-semibold capitalize text-foreground">
                                    {p.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {p.petId} · {p.species}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </SectionBody>
                      </Section>
                    </div>
                  </div>

                  <Section title="Current Clinical Summary" icon={Activity}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"]}
                      loadingText="Loading clinical summary..."
                      onRetry={reload}
                      isEmpty={false}
                      emptyText=""
                    >
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                        <Field label="Current Weight" value={weight ? `${weight} kg` : ""} />
                        <Field
                          label="Temperature"
                          value={(() => {
                            const v = derived.withVitals;
                            if (!v) return "";
                            if (v.vitals?.temp)
                              return `${v.vitals.temp} ${v.vitals.tempUnit || "°C"}`;
                            if (v.prescriptionData?.bodyTemperature)
                              return `${v.prescriptionData.bodyTemperature} ${v.prescriptionData.temperatureUnit || "°C"}`;
                            return v.vitals?.tempC ? `${v.vitals.tempC} °C` : "";
                          })()}
                        />
                        <Field
                          label="Heart Rate"
                          value={
                            derived.withVitals?.vitals?.heartRate
                              ? `${derived.withVitals.vitals.heartRate} bpm`
                              : ""
                          }
                        />
                        <Field label="Recent Diagnosis" value={derived.latest?.diagnosis} />
                        <Field
                          label="Current Medications"
                          value={[
                            ...new Set(
                              derived.rxLines
                                .filter((l) => l.status === "Active")
                                .map((l) => l.medicine),
                            ),
                          ].join(", ")}
                        />
                        <Field
                          label="Active Medical Conditions"
                          value={list(pet.chronicConditions).join(", ")}
                        />
                        <Field
                          label="Last Consultation"
                          value={derived.latest ? fd(derived.latest.date) : ""}
                        />
                        <Field
                          label="Next Follow-up"
                          value={derived.latest ? visitFollowUp(derived.latest) : ""}
                        />
                        <Field
                          label="Last Vaccination"
                          value={derived.vaccines[0] ? fd(derived.vaccines[0].date) : ""}
                        />
                        <Field
                          label="Next Vaccination"
                          value={derived.nextVaccine ? fd(derived.nextVaccine) : ""}
                        />
                        <Field
                          label="Last Deworming"
                          value={derived.deworms[0] ? fd(derived.deworms[0].date) : ""}
                        />
                        <Field
                          label="Next Deworming"
                          value={derived.nextDeworm ? fd(derived.nextDeworm) : ""}
                        />
                      </dl>
                      {pet.medicalNotes && (
                        <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs">
                          <span className="mb-1 block font-semibold text-muted-foreground">
                            Clinical / Medical Notes
                          </span>
                          <p className="whitespace-pre-line text-foreground">{pet.medicalNotes}</p>
                        </div>
                      )}
                    </SectionBody>
                  </Section>

                  <Section
                    title="Upcoming Appointment"
                    icon={Calendar}
                    action={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary"
                        onClick={() => setTab("appointments")}
                      >
                        View all
                      </Button>
                    }
                  >
                    <SectionBody
                      loading={busy}
                      error={errors["appointments"]}
                      loadingText="Loading appointments..."
                      onRetry={reload}
                      isEmpty={!derived.upcoming.length}
                      emptyText="No upcoming appointments"
                    >
                      {derived.upcoming[0] && <AppointmentLine a={derived.upcoming[0]} />}
                    </SectionBody>
                  </Section>
                </TabsContent>

                {/* ── APPOINTMENTS ── */}
                <TabsContent value="appointments" className="mt-0 space-y-4">
                  <Section
                    title="Upcoming Appointments"
                    icon={Calendar}
                    action={
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={!bookingPrefill}
                        onClick={() => {
                          setApptToEdit(null);
                          setBookOpen(true);
                        }}
                      >
                        <CalendarPlus className="size-3" /> Schedule Appointment
                      </Button>
                    }
                  >
                    <SectionBody
                      loading={busy}
                      error={errors["appointments"]}
                      loadingText="Loading appointments..."
                      onRetry={reload}
                      isEmpty={!derived.upcoming.length}
                      emptyText="No upcoming appointments"
                    >
                      <AppointmentsTable
                        rows={derived.upcoming}
                        upcoming
                        onReschedule={(a) => {
                          setApptToEdit(a);
                          setBookOpen(true);
                        }}
                        onCancel={cancelAppointment}
                        visitFor={visitForAppointment}
                        onViewVisit={setViewVisit}
                      />
                    </SectionBody>
                  </Section>
                  <Section title="Previous Appointments" icon={ClipboardList}>
                    <SectionBody
                      loading={busy}
                      error={errors["appointments"]}
                      loadingText="Loading appointments..."
                      onRetry={reload}
                      isEmpty={!derived.previous.length}
                      emptyText="No previous appointments"
                    >
                      <AppointmentsTable
                        rows={derived.previous}
                        visitFor={visitForAppointment}
                        onViewVisit={setViewVisit}
                      />
                    </SectionBody>
                  </Section>
                </TabsContent>

                {/* ── MEDICAL HISTORY ── */}
                <TabsContent value="medical" className="mt-0">
                  <Section title="Medical History" icon={ClipboardList}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"]}
                      loadingText="Loading medical history..."
                      onRetry={reload}
                      isEmpty={!visits.length}
                      emptyText="No medical history recorded"
                    >
                      <MedicalTimeline visits={visits} onOpen={setViewVisit} />
                    </SectionBody>
                  </Section>
                </TabsContent>

                {/* ── CONSULTATIONS & REPORTS ── */}
                <TabsContent value="consultations" className="mt-0">
                  <Section title="Consultation Reports" icon={FileText}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"]}
                      loadingText="Loading consultation reports..."
                      onRetry={reload}
                      isEmpty={!visits.length}
                      emptyText="No consultation reports"
                    >
                      <ConsultationReports
                        visits={visits}
                        onView={setPrintVisit}
                        onOpen={setViewVisit}
                      />
                    </SectionBody>
                  </Section>
                </TabsContent>

                {/* ── PRESCRIPTIONS ── */}
                <TabsContent value="prescriptions" className="mt-0">
                  <Section title="Prescription & Medication History" icon={Pill}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"]}
                      loadingText="Loading prescription history..."
                      onRetry={reload}
                      isEmpty={!derived.rxLines.length}
                      emptyText="No prescription history"
                    >
                      <PrescriptionTable rows={derived.rxLines} onView={setPrintVisit} />
                    </SectionBody>
                  </Section>
                </TabsContent>

                {/* ── PREVENTIVE CARE ── */}
                <TabsContent value="preventive" className="mt-0 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DueCard
                      label="Next Vaccination Due"
                      date={derived.nextVaccine}
                      icon={Syringe}
                    />
                    <DueCard label="Next Deworming Due" date={derived.nextDeworm} icon={Pill} />
                  </div>
                  <Section title="Vaccination History" icon={Syringe}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"] || errors["vaccinations"]}
                      loadingText="Loading vaccination records..."
                      onRetry={reload}
                      isEmpty={!derived.vaccines.length}
                      emptyText="No vaccination records"
                    >
                      <Table
                        head={
                          <>
                            <Th>Vaccine</Th>
                            <Th>Date Given</Th>
                            <Th>Next Due</Th>
                            <Th>Batch No.</Th>
                            <Th>Doctor</Th>
                            <Th>Notes</Th>
                          </>
                        }
                        minWidth={640}
                      >
                        {derived.vaccines.map((v, i) => (
                          <tr key={i}>
                            <Td className="font-medium">{v.name}</Td>
                            <Td>{fd(v.date)}</Td>
                            <Td>
                              <DueDate date={v.nextDue} />
                            </Td>
                            <Td mono>{v.batchNo || "N/A"}</Td>
                            <Td>{v.doctor || "N/A"}</Td>
                            <Td>{v.notes || "—"}</Td>
                          </tr>
                        ))}
                      </Table>
                    </SectionBody>
                  </Section>
                  <Section title="Deworming History" icon={Pill}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"] || errors["dewormings"]}
                      loadingText="Loading deworming records..."
                      onRetry={reload}
                      isEmpty={!derived.deworms.length}
                      emptyText="No deworming records"
                    >
                      <Table
                        head={
                          <>
                            <Th>Date</Th>
                            <Th>Medicine</Th>
                            <Th>Dosage</Th>
                            <Th>Next Due</Th>
                            <Th>Doctor</Th>
                            <Th>Notes</Th>
                          </>
                        }
                        minWidth={640}
                      >
                        {derived.deworms.map((d, i) => (
                          <tr key={i}>
                            <Td>{fd(d.date)}</Td>
                            <Td className="font-medium">{d.medicine}</Td>
                            <Td>{d.dosage || "—"}</Td>
                            <Td>
                              <DueDate date={d.nextDue} />
                            </Td>
                            <Td>{d.doctor || "N/A"}</Td>
                            <Td>{d.notes || "—"}</Td>
                          </tr>
                        ))}
                      </Table>
                    </SectionBody>
                  </Section>
                </TabsContent>

                {/* ── DOCUMENTS & PHOTOS ── */}
                <TabsContent value="documents" className="mt-0 space-y-4">
                  <Section
                    title="Patient Documents"
                    icon={FileText}
                    action={
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={!data}
                        onClick={() => setUploadKind("document")}
                      >
                        <Upload className="size-3" /> Upload Document
                      </Button>
                    }
                  >
                    <SectionBody
                      loading={busy}
                      error={errors["files"]}
                      loadingText="Loading documents..."
                      onRetry={reload}
                      isEmpty={!derived.documents.length}
                      emptyText="No documents uploaded"
                    >
                      <Table
                        head={
                          <>
                            <Th>Document</Th>
                            <Th>Category</Th>
                            <Th>Date</Th>
                            <Th>Size</Th>
                            <Th>Uploaded By</Th>
                            <Th right>Actions</Th>
                          </>
                        }
                        minWidth={640}
                      >
                        {derived.documents.map((f) => (
                          <tr key={f.fileId}>
                            <Td>
                              <span className="flex items-center gap-2 font-medium">
                                <FileText className="size-3.5 shrink-0 text-primary" /> {f.name}
                              </span>
                              {f.description && (
                                <span className="block text-[11px] text-muted-foreground">
                                  {f.description}
                                </span>
                              )}
                            </Td>
                            <Td>{f.category}</Td>
                            <Td>{fd(f.date)}</Td>
                            <Td mono>{(f.size / 1024 / 1024).toFixed(2)} MB</Td>
                            <Td>{f.uploadedBy || "N/A"}</Td>
                            <Td right>
                              <div className="flex justify-end gap-1">
                                <IconBtn title="View" onClick={() => void openFile(f)}>
                                  <Eye className="size-3.5" />
                                </IconBtn>
                                <IconBtn title="Download" onClick={() => void openFile(f, true)}>
                                  <Download className="size-3.5" />
                                </IconBtn>
                                <IconBtn title="Delete" danger onClick={() => void deleteFile(f)}>
                                  <Trash2 className="size-3.5" />
                                </IconBtn>
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </Table>
                    </SectionBody>
                  </Section>

                  <Section
                    title="Patient Photos"
                    icon={ImageIcon}
                    action={
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={!data}
                        onClick={() => setUploadKind("photo")}
                      >
                        <Upload className="size-3" /> Upload Photo
                      </Button>
                    }
                  >
                    <SectionBody
                      loading={busy}
                      error={errors["files"]}
                      loadingText="Loading photos..."
                      onRetry={reload}
                      isEmpty={!derived.photos.length}
                      emptyText="No additional photos"
                    >
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {derived.photos.map((f) => (
                          <figure
                            key={f.fileId}
                            className="group overflow-hidden rounded-lg border border-border bg-card"
                          >
                            <button
                              className="block aspect-square w-full bg-muted"
                              onClick={() => void openFile(f)}
                              title="View photo"
                            >
                              {f.thumbUrl ? (
                                <img
                                  src={f.thumbUrl}
                                  alt={f.description || f.category}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="m-auto size-6 text-muted-foreground" />
                              )}
                            </button>
                            <figcaption className="space-y-0.5 p-2 text-[11px]">
                              <p className="truncate font-semibold text-foreground">{f.category}</p>
                              {f.description && (
                                <p className="line-clamp-2 text-muted-foreground">
                                  {f.description}
                                </p>
                              )}
                              <p className="text-muted-foreground">
                                {fd(f.date)}
                                {f.uploadedBy ? ` · ${f.uploadedBy}` : ""}
                              </p>
                              <div className="flex gap-1 pt-1">
                                <IconBtn
                                  title="Set as Profile Photo"
                                  onClick={() => void setGalleryAsProfile(f)}
                                >
                                  <Star className="size-3.5" />
                                </IconBtn>
                                <IconBtn title="Download" onClick={() => void openFile(f, true)}>
                                  <Download className="size-3.5" />
                                </IconBtn>
                                <IconBtn title="Delete" danger onClick={() => void deleteFile(f)}>
                                  <Trash2 className="size-3.5" />
                                </IconBtn>
                              </div>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </SectionBody>
                  </Section>
                </TabsContent>

                {/* ── BILLING ── */}
                <TabsContent value="billing" className="mt-0 space-y-4">
                  <Section
                    title="Billing Summary"
                    icon={Wallet}
                    action={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary"
                        onClick={() =>
                          document
                            .getElementById("p360-bills")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }
                      >
                        View Billing History
                      </Button>
                    }
                  >
                    <SectionBody
                      loading={busy}
                      error={errors["visits"]}
                      loadingText="Loading billing summary..."
                      onRetry={reload}
                      isEmpty={false}
                      emptyText=""
                    >
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat
                          label="Total Consultation Fees"
                          value={inr(derived.billing.consultationFees)}
                        />
                        <Stat label="Total Bill Amount" value={inr(derived.billing.total)} />
                        <Stat label="Total Discount" value={inr(derived.billing.discount)} />
                        <Stat label="Total Paid" value={inr(derived.billing.paid)} tone="green" />
                        <Stat
                          label="Total Pending"
                          value={inr(derived.billing.pending)}
                          tone={derived.billing.pending > 0 ? "amber" : undefined}
                        />
                        <Stat label="Bills" value={String(derived.billing.count)} />
                        <Stat
                          label="Last Payment"
                          value={
                            derived.billing.lastPaymentDate
                              ? fd(derived.billing.lastPaymentDate)
                              : "N/A"
                          }
                        />
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-[11px] text-muted-foreground">Payment Status</p>
                          <div className="mt-1">
                            <StatusPill value={derived.billing.status} />
                          </div>
                        </div>
                      </div>
                    </SectionBody>
                  </Section>

                  <Section id="p360-bills" title="Previous Bills & Billing History" icon={Receipt}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"]}
                      loadingText="Loading billing history..."
                      onRetry={reload}
                      isEmpty={!derived.bills.length}
                      emptyText="No previous bills"
                    >
                      <BillsList
                        bills={derived.bills}
                        pet={pet}
                        onView={setInvoice}
                        onPrint={setPrintInvoice}
                      />
                    </SectionBody>
                  </Section>

                  <Section title="Payment History" icon={CreditCard}>
                    <SectionBody
                      loading={busy}
                      error={errors["visits"]}
                      loadingText="Loading payment history..."
                      onRetry={reload}
                      isEmpty={!derived.payments.length}
                      emptyText="No payment history"
                    >
                      <PaymentsTable rows={derived.payments} />
                    </SectionBody>
                  </Section>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Profile photo preview → explicit "Set as Profile Photo" ── */}
      <Dialog open={Boolean(photoPreview)} onOpenChange={(v) => !v && setPhotoPreview(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base">Preview Profile Photo</DialogTitle>
          <DialogDescription className="text-xs">
            This will replace {pet.name}'s current profile photo.
          </DialogDescription>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Preview"
              className="mx-auto aspect-square w-60 rounded-2xl border border-border object-cover"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPhotoPreview(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={savingPhoto}
              onClick={() => photoPreview && void saveProfilePhoto(photoPreview)}
              className="gap-1"
            >
              {savingPhoto && <Loader2 className="size-3.5 animate-spin" />} Set as Profile Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Full-size photo viewer ── */}
      <Dialog open={Boolean(lightbox)} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="truncate pr-6 text-sm">{lightbox?.name}</DialogTitle>
          {lightbox && (
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {uploadKind && pet.petId && (
        <UploadFileDialog
          kind={uploadKind}
          petId={pet.petId}
          petName={pet.name}
          uploadedBy={currentUser?.fullName || ""}
          onClose={() => setUploadKind(null)}
          onUploaded={reload}
        />
      )}

      {editPetOpen && data?.pet && (
        <EditPetDialog
          pet={data.pet}
          onClose={() => setEditPetOpen(false)}
          onSaved={() => {
            reload();
            onChanged?.();
          }}
        />
      )}
      {editOwnerOpen && owner?.ownerId && (
        <EditOwnerDialog
          owner={owner}
          onClose={() => setEditOwnerOpen(false)}
          onSaved={() => {
            reload();
            onChanged?.();
          }}
        />
      )}

      {/* ── Existing workflows, reused as-is ── */}
      <BookAppointmentModal
        open={bookOpen}
        onClose={() => {
          setBookOpen(false);
          setApptToEdit(null);
        }}
        appointmentToEdit={apptToEdit}
        initialFollowUp={apptToEdit ? null : bookingPrefill}
        onBooked={reload}
        onUpdated={reload}
      />
      {viewVisit && (
        <VisitWorkspaceModal
          open={Boolean(viewVisit)}
          onClose={() => setViewVisit(null)}
          visit={viewVisit}
          onVisitFinalized={() => {
            reload();
            onChanged?.();
          }}
        />
      )}
      {printVisit && (
        <PrescriptionPrintView
          open={Boolean(printVisit)}
          visit={printVisit}
          onClose={() => setPrintVisit(null)}
        />
      )}
      {printInvoice && (
        <InvoicePrintView
          open={Boolean(printInvoice)}
          visit={printInvoice}
          onClose={() => setPrintInvoice(null)}
        />
      )}
      {invoice && (
        <InvoiceDetailModal
          open={Boolean(invoice)}
          onClose={() => setInvoice(null)}
          invoice={invoice}
          onUpdated={reload}
          onDeleted={() => {
            setInvoice(null);
            reload();
          }}
        />
      )}
    </>
  );
}

// ─── Section bodies ──────────────────────────────────────────────────────────

function IconBtn({
  title,
  onClick,
  children,
  danger,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "size-7 p-0 text-muted-foreground",
        danger ? "hover:text-destructive" : "hover:text-primary",
      )}
    >
      {children}
    </Button>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | undefined;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-bold text-foreground",
          tone === "green" && "text-success",
          tone === "amber" && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DueDate({ date }: { date?: string | undefined }) {
  if (!date) return <span className="text-muted-foreground">N/A</span>;
  const d = String(date).slice(0, 10);
  const today = todayIso();
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const tone =
    d < today
      ? "bg-warning-soft text-warning"
      : d <= soon
        ? "bg-primary/10 text-primary"
        : "text-foreground";
  return (
    <span className={cn("rounded px-1.5 py-0.5 font-semibold", tone)}>
      {fd(d)}
      {d < today ? " · Overdue" : d <= soon ? " · Due soon" : ""}
    </span>
  );
}

function DueCard({
  label,
  date,
  icon: Icon,
}: {
  label: string;
  date?: string | undefined;
  icon: typeof User;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="text-xs">
        <p className="text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm">
          <DueDate date={date} />
        </div>
      </div>
    </div>
  );
}

function AppointmentLine({ a }: { a: any }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="font-semibold text-foreground">{fd(a.appointment_date || a.date)}</span>
      <span className="font-mono">{a.time || a.slot || "—"}</span>
      <span>{a.doctor || "N/A"}</span>
      <span className="text-muted-foreground">{a.type || "Consultation"}</span>
      <span className="text-muted-foreground">{a.complaint || a.reason || ""}</span>
      <StatusPill value={a.status || "Scheduled"} />
    </div>
  );
}

function AppointmentsTable({
  rows,
  upcoming,
  onReschedule,
  onCancel,
  visitFor,
  onViewVisit,
}: {
  rows: any[];
  upcoming?: boolean;
  onReschedule?: (a: any) => void;
  onCancel?: (a: any) => void;
  visitFor: (a: any) => any;
  onViewVisit: (v: any) => void;
}) {
  const { shown, moreButton } = usePaged(rows);
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      <Table
        head={
          <>
            <Th>Date</Th>
            <Th>Time</Th>
            <Th>Doctor</Th>
            <Th>Type</Th>
            <Th>Reason / Complaint</Th>
            <Th>Status</Th>
            {upcoming ? <Th>Follow-up Notes</Th> : <Th>Consultation ID</Th>}
            <Th right>Actions</Th>
          </>
        }
        minWidth={820}
      >
        {shown.map((a, i) => {
          const visit = visitFor(a);
          const key = `${a.token}-${i}`;
          return (
            <Fragment key={key}>
              <tr>
                <Td className="whitespace-nowrap font-medium">
                  {fd(a.appointment_date || a.date)}
                </Td>
                <Td mono>{a.time || a.slot || "—"}</Td>
                <Td>{a.doctor || "N/A"}</Td>
                <Td>{a.type || "Consultation"}</Td>
                <Td>{a.complaint || a.reason || "—"}</Td>
                <Td>
                  <StatusPill value={a.status || "Scheduled"} />
                </Td>
                {upcoming ? (
                  <Td>{a.notes || a.followUpNotes || "—"}</Td>
                ) : (
                  <Td mono>{visit?.visitId || "—"}</Td>
                )}
                <Td right>
                  <div className="flex justify-end gap-1">
                    {upcoming ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setExpanded(expanded === key ? null : key)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary"
                          onClick={() => onReschedule?.(a)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => onCancel?.(a)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : visit ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs text-primary"
                        onClick={() => onViewVisit(visit)}
                      >
                        <Eye className="size-3" /> View Consultation
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </Td>
              </tr>
              {expanded === key && (
                <tr className="bg-muted/20">
                  <td colSpan={8} className="px-3 py-2 text-xs">
                    <span className="mr-4">
                      Token: <strong className="font-mono">{a.token}</strong>
                    </span>
                    <span className="mr-4">
                      Priority: <strong>{a.priority || "Normal"}</strong>
                    </span>
                    <span className="mr-4">
                      Owner: <strong>{a.owner || "N/A"}</strong>{" "}
                      {a.ownerPhone && <span className="font-mono">({a.ownerPhone})</span>}
                    </span>
                    {a.vitals?.weightKg && (
                      <span className="mr-4">
                        Weight: <strong>{a.vitals.weightKg} kg</strong>
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>
      {moreButton}
    </>
  );
}

function MedicalTimeline({ visits, onOpen }: { visits: any[]; onOpen: (v: any) => void }) {
  const { shown, moreButton } = usePaged(visits);
  return (
    <>
      <ol className="relative space-y-3 border-l border-border pl-5">
        {shown.map((v) => {
          const rx = v.prescriptionData || {};
          const treatment = [
            names(rx.injectables, "name"),
            names(rx.immediateMedicines, "medicineName"),
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={v.visitId} className="relative">
              <span className="absolute -left-[25px] top-3 size-2.5 rounded-full border-2 border-card bg-primary" />
              <button
                onClick={() => onOpen(v)}
                className="w-full rounded-lg border border-border p-3 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {fd(v.date)}{" "}
                    <span className="ml-1 font-mono font-normal text-muted-foreground">
                      {v.visitId}
                    </span>
                  </p>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Stethoscope className="size-3" /> {v.doctorName || "N/A"}{" "}
                    <StatusPill value={v.status} />
                  </span>
                </div>
                <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  <Field label="Chief Complaint" value={visitComplaint(v)} />
                  <Field label="Diagnosis" value={v.diagnosis} />
                  <Field label="Clinical Findings" value={visitFindings(v)} />
                  <Field label="Treatment" value={treatment} />
                  <Field
                    label="Prescription"
                    value={names(rx.prescribedMedicines, "medicineName")}
                  />
                  <Field label="Follow-up" value={visitFollowUp(v)} />
                  {v.clinicalNotes && <Field label="Notes" value={v.clinicalNotes} />}
                </dl>
              </button>
            </li>
          );
        })}
      </ol>
      {moreButton}
    </>
  );
}

function ConsultationReports({
  visits,
  onView,
  onOpen,
}: {
  visits: any[];
  onView: (v: any) => void;
  onOpen: (v: any) => void;
}) {
  const { shown, moreButton } = usePaged(visits);
  return (
    <>
      <div className="space-y-3">
        {shown.map((v) => {
          const rx = v.prescriptionData || {};
          const bill = billOf(v);
          const fee = Number(rx.consultationFee) || bill.consultationFees;
          return (
            <article key={v.visitId} className="rounded-lg border border-border p-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {fd(v.date)} · {v.doctorName || "N/A"}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {v.visitId}
                    {v.prescriptionNo ? ` · ${v.prescriptionNo}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {isBill(v) && <StatusPill value={bill.status} />}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onView(v)}
                  >
                    <Eye className="size-3" /> View Report
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onView(v)}
                    title="Opens the report with Print and Save-as-PDF"
                  >
                    <Printer className="size-3" /> Print / PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-primary"
                    onClick={() => onOpen(v)}
                  >
                    Open Consultation
                  </Button>
                </div>
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Chief Complaint" value={visitComplaint(v)} />
                <Field label="Diagnosis" value={v.diagnosis} />
                <Field label="Clinical Findings" value={visitFindings(v)} />
                <Field
                  label="Clinical Treatment"
                  value={names(rx.immediateMedicines, "medicineName")}
                />
                <Field label="Medicines" value={names(rx.prescribedMedicines, "medicineName")} />
                <Field label="Injectable Medicines" value={names(rx.injectables, "name")} />
                <Field label="Follow-up" value={visitFollowUp(v)} />
                <Field label="Fees" value={fee ? inr(fee) : ""} />
                <Field label="Notes" value={v.clinicalNotes} />
              </dl>
            </article>
          );
        })}
      </div>
      {moreButton}
    </>
  );
}

function PrescriptionTable({
  rows,
  onView,
}: {
  rows: ReturnType<typeof prescriptionLines>;
  onView: (v: any) => void;
}) {
  const { shown, moreButton } = usePaged(rows, 15);
  return (
    <>
      <Table
        head={
          <>
            <Th>Date</Th>
            <Th>Medicine</Th>
            <Th>Dosage</Th>
            <Th>Frequency</Th>
            <Th>Duration</Th>
            <Th>Route</Th>
            <Th>Prescribed By</Th>
            <Th>Status</Th>
            <Th right>Action</Th>
          </>
        }
        minWidth={880}
      >
        {shown.map((r, i) => (
          <tr key={i}>
            <Td className="whitespace-nowrap">{fd(r.date)}</Td>
            <Td className="font-medium">
              {r.medicine}
              {r.kind !== "Prescribed" && (
                <span className="ml-1 text-[10px] text-muted-foreground">({r.kind})</span>
              )}
            </Td>
            <Td>{r.dosage || "—"}</Td>
            <Td>{r.frequency || "—"}</Td>
            <Td>{r.duration || "—"}</Td>
            <Td>{r.route || "—"}</Td>
            <Td>{r.doctor || "N/A"}</Td>
            <Td>
              <StatusPill value={r.status} />
            </Td>
            <Td right>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-primary"
                onClick={() => onView(r.visit)}
              >
                View Rx
              </Button>
            </Td>
          </tr>
        ))}
      </Table>
      {moreButton}
    </>
  );
}

function BillsList({
  bills,
  pet,
  onView,
  onPrint,
}: {
  bills: any[];
  pet: any;
  onView: (v: any) => void;
  onPrint: (v: any) => void;
}) {
  const { shown, moreButton } = usePaged(bills);
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      <div className="space-y-2">
        {shown.map((v) => {
          const b = billOf(v);
          const open = expanded === v.visitId;
          return (
            <article key={v.visitId} className="rounded-lg border border-border text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-foreground">{v.invoiceNo}</p>
                  <p className="text-muted-foreground">
                    {fd(v.date)} · {v.visitId} · {v.doctorName || "N/A"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Net <strong className="font-mono">{inr(b.net)}</strong>
                  </span>
                  <span>
                    Paid <strong className="font-mono text-success">{inr(b.paid)}</strong>
                  </span>
                  <span>
                    Pending{" "}
                    <strong className={cn("font-mono", b.pending > 0 && "text-warning")}>
                      {inr(b.pending)}
                    </strong>
                  </span>
                  <StatusPill value={b.status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 border-t border-border px-3 py-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs text-primary"
                  onClick={() => onView(v)}
                >
                  <Eye className="size-3" /> View Bill
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setExpanded(open ? null : v.visitId)}
                >
                  <ClipboardList className="size-3" /> {open ? "Hide Details" : "View Details"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => onPrint(v)}
                  title="Opens the invoice with Print and Save-as-PDF"
                >
                  <Printer className="size-3" /> Print / PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => onView(v)}
                >
                  <CreditCard className="size-3" /> Payment Details
                </Button>
              </div>
              {open && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border bg-muted/20 p-3 sm:grid-cols-4">
                  <Field label="Invoice No." value={v.invoiceNo} mono />
                  <Field label="Bill Date" value={fd(v.date)} />
                  <Field
                    label="Patient"
                    value={`${v.petName || pet.name} · ${v.petId || pet.petId}`}
                  />
                  <Field label="Owner" value={v.ownerName} />
                  <Field label="Consultation / Visit ID" value={v.visitId} mono />
                  <Field label="Doctor" value={v.doctorName} />
                  <Field label="Billing Type" value={v.billType} />
                  <Field label="Created By" value={v.receptionistName} />
                  <Field label="Total Amount" value={inr(b.gross)} />
                  <Field label="Discount" value={inr(b.discount)} />
                  <Field label="Net Amount" value={inr(b.net)} />
                  <Field label="Paid Amount" value={inr(b.paid)} />
                  <Field label="Pending Amount" value={inr(b.pending)} />
                  <Field label="Payment Method" value={b.methods.join(", ")} />
                  <Field label="Payment Status" value={b.status} />
                </dl>
              )}
            </article>
          );
        })}
      </div>
      {moreButton}
    </>
  );
}

function PaymentsTable({ rows }: { rows: ReturnType<typeof paymentHistory> }) {
  const { shown, moreButton } = usePaged(rows, 15);
  return (
    <>
      <Table
        head={
          <>
            <Th>Payment Date</Th>
            <Th>Bill No.</Th>
            <Th right>Amount Paid</Th>
            <Th>Method</Th>
            <Th>Reference No.</Th>
            <Th>Received By</Th>
            <Th>Bill Status</Th>
          </>
        }
        minWidth={760}
      >
        {shown.map((p, i) => (
          <tr key={i}>
            <Td className="whitespace-nowrap">{fd(p.date)}</Td>
            <Td mono>{p.invoiceNo}</Td>
            <Td right mono className="font-semibold">
              {inr(p.amount)}
            </Td>
            <Td>{p.mode || "N/A"}</Td>
            <Td mono>{p.ref || "—"}</Td>
            <Td>{p.receivedBy || "N/A"}</Td>
            <Td>
              <StatusPill value={p.billStatus} />
            </Td>
          </tr>
        ))}
      </Table>
      {moreButton}
    </>
  );
}

// ─── Upload dialog (documents & gallery photos) ─────────────────────────────

function UploadFileDialog({
  kind,
  petId,
  petName,
  uploadedBy,
  onClose,
  onUploaded,
}: {
  kind: "document" | "photo";
  petId: string;
  petName: string;
  uploadedBy: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const categories = kind === "document" ? DOC_CATEGORIES : PHOTO_CATEGORIES;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]!);
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  const choose = async (f: File | undefined) => {
    if (!f) return;
    const mime = f.type || EXT_MIME[f.name.split(".").pop()?.toLowerCase() || ""] || "";
    if (!Object.values(EXT_MIME).includes(mime)) {
      toast.error("Supported files: PDF, JPG, JPEG, PNG, DOC, DOCX");
      return;
    }
    if (kind === "photo" && !mime.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    if (!mime.startsWith("image/") && f.size > MAX_FILE_BYTES) {
      toast.error("File is larger than 3 MB");
      return;
    }
    setFile(f);
    if (!name) setName(f.name);
    setPreview(mime.startsWith("image/") ? await readAsDataUrl(f) : null);
  };

  const save = async () => {
    if (!file) {
      toast.error("Choose a file first");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter a name");
      return;
    }
    setSaving(true);
    try {
      let mime = file.type || EXT_MIME[file.name.split(".").pop()?.toLowerCase() || ""]!;
      let dataUrl = await readAsDataUrl(file);
      let thumbUrl: string | undefined;
      if (mime.startsWith("image/")) {
        // Photos are downscaled; large scanned images are too, so they fit the 3 MB limit.
        if (kind === "photo" || file.size > MAX_FILE_BYTES) {
          dataUrl = await resizeImage(dataUrl, 1800);
          mime = "image/jpeg";
        }
        if (kind === "photo") thumbUrl = await resizeImage(dataUrl, 320, 0.8);
      }
      // Normalise the data-URL prefix when the browser gave no MIME type (common for .doc on Windows).
      dataUrl = `data:${mime};base64,${dataUrl.slice(dataUrl.indexOf(",") + 1)}`;
      await addPatientFileFn({
        data: {
          petId,
          kind,
          category,
          name: name.trim(),
          mime,
          size: Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4),
          description: description.trim(),
          date,
          uploadedBy,
          dataUrl,
          ...(thumbUrl ? { thumbUrl } : {}),
        },
      });
      toast.success(`${kind === "document" ? "Document" : "Photo"} saved to ${petName}'s records`);
      onUploaded();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="text-base">
          {kind === "document" ? "Upload Patient Document" : "Upload Patient Photo"}
        </DialogTitle>
        <DialogDescription className="text-xs">
          Saved to <strong>{petName}</strong> ({petId}).{" "}
          {kind === "document"
            ? "PDF, JPG, PNG, DOC or DOCX up to 3 MB."
            : "Does not change the profile photo."}
        </DialogDescription>

        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 font-medium hover:bg-muted">
              <FolderOpen className="size-3.5" />{" "}
              {kind === "document" ? "Choose file" : "Gallery / Files"}
              <input
                type="file"
                hidden
                accept={kind === "document" ? ".pdf,.jpg,.jpeg,.png,.doc,.docx" : "image/*"}
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-3.5" /> Camera
            </Button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {file && (
            <div className="flex items-center gap-2 rounded-lg border border-border p-2">
              {preview ? (
                <img src={preview} alt="" className="size-14 rounded object-cover" />
              ) : (
                <FileText className="size-8 text-primary" />
              )}
              <span className="min-w-0 truncate">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving || !file}
            onClick={() => void save()}
            className="gap-1"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />} Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialogs ────────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-xs">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditPetDialog({
  pet,
  onClose,
  onSaved,
}: {
  pet: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState(() => ({
    name: pet.name || "",
    species: pet.species || "Canine",
    breed: pet.breed || "",
    gender: pet.gender || "Male",
    dob: pet.dob ? String(pet.dob).slice(0, 10) : "",
    weightKg: pet.weightKg != null ? String(pet.weightKg) : "",
    color: pet.color || "",
    sterilizationStatus: pet.sterilizationStatus || "Unknown",
    microchipNo: pet.microchipNo || "",
    bloodGroup: pet.bloodGroup || "",
    tagNumber: pet.tagNumber || "",
    status: pet.status || "Active",
    allergies: list(pet.allergies).join(", "),
    foodAllergies: list(pet.foodAllergies).join(", "),
    otherAllergies: list(pet.otherAllergies).join(", "),
    clinicalAlerts: list(pet.clinicalAlerts).join(", "),
    chronicConditions: list(pet.chronicConditions).join(", "),
    medicalNotes: pet.medicalNotes || "",
  }));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const inp = (k: keyof typeof f, props: Record<string, unknown> = {}) => (
    <Input
      value={f[k]}
      onChange={(e) => set(k)(e.target.value)}
      className="h-8 text-xs"
      {...props}
    />
  );

  const save = async () => {
    if (!f.name.trim() || !f.breed.trim()) {
      toast.error("Patient name and breed are required");
      return;
    }
    if (f.dob && f.dob > todayIso()) {
      toast.error("Date of birth cannot be in the future");
      return;
    }
    const w = f.weightKg.trim() ? Number(f.weightKg) : undefined;
    if (w !== undefined && (!Number.isFinite(w) || w <= 0 || w > 500)) {
      toast.error("Enter a valid weight in kg");
      return;
    }
    setSaving(true);
    try {
      await updatePetFn({
        data: {
          petId: pet.petId,
          updates: {
            name: f.name.trim(),
            species: f.species,
            breed: f.breed.trim(),
            gender: f.gender,
            dob: f.dob,
            ...(w !== undefined ? { weightKg: w } : {}),
            color: f.color.trim(),
            sterilizationStatus: f.sterilizationStatus,
            microchipNo: f.microchipNo.trim(),
            bloodGroup: f.bloodGroup.trim(),
            tagNumber: f.tagNumber.trim(),
            status: f.status,
            allergies: csv(f.allergies),
            foodAllergies: csv(f.foodAllergies),
            otherAllergies: csv(f.otherAllergies),
            clinicalAlerts: csv(f.clinicalAlerts),
            chronicConditions: csv(f.chronicConditions),
            medicalNotes: f.medicalNotes.trim(),
          },
        },
      });
      toast.success("Patient details updated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="text-base">
          Edit Patient · <span className="font-mono text-sm">{pet.petId}</span>
        </DialogTitle>
        <DialogDescription className="text-xs">
          Patient ID cannot be changed. Fields marked <span className="text-destructive">*</span>{" "}
          are required.
        </DialogDescription>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Name" required>
              {inp("name")}
            </FormField>
            <FormField label="Species" required>
              <SelectField
                value={f.species}
                onChange={set("species")}
                options={["Canine", "Feline", "Avian", "Rabbit", "Exotic", "Other"]}
              />
            </FormField>
            <FormField label="Breed" required>
              {inp("breed")}
            </FormField>
            <FormField label="Gender" required>
              <SelectField
                value={f.gender}
                onChange={set("gender")}
                options={["Male", "Female", "Neutered Male", "Spayed Female"]}
              />
            </FormField>
            <FormField label="Date of Birth">
              {inp("dob", { type: "date", max: todayIso() })}
            </FormField>
            <FormField label="Weight (kg)">
              {inp("weightKg", { type: "number", step: "0.1", min: "0" })}
            </FormField>
            <FormField label="Coat / Color">{inp("color")}</FormField>
            <FormField label="Sterilization">
              <SelectField
                value={f.sterilizationStatus}
                onChange={set("sterilizationStatus")}
                options={["Intact", "Sterilized", "Unknown"]}
              />
            </FormField>
            <FormField label="Microchip No.">{inp("microchipNo")}</FormField>
            <FormField label="Blood Group">{inp("bloodGroup")}</FormField>
            <FormField label="Identification / Tag No.">{inp("tagNumber")}</FormField>
            <FormField label="Status">
              <SelectField
                value={f.status}
                onChange={set("status")}
                options={[
                  "Active",
                  "Vaccination due",
                  "Under treatment",
                  "Inactive",
                  "Transferred",
                  "Deceased",
                ]}
              />
            </FormField>
          </div>
          <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="size-3.5" /> Allergies &amp; Clinical Alerts{" "}
              <span className="font-normal text-muted-foreground">(comma separated)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Drug Allergies">
                {inp("allergies", { placeholder: "e.g. NSAIDs (Meloxicam)" })}
              </FormField>
              <FormField label="Food Allergies">{inp("foodAllergies")}</FormField>
              <FormField label="Other Allergies">{inp("otherAllergies")}</FormField>
              <FormField label="Clinical Alerts">
                {inp("clinicalAlerts", { placeholder: "e.g. Aggressive, Cardiac patient" })}
              </FormField>
              <FormField label="Active Medical Conditions">{inp("chronicConditions")}</FormField>
            </div>
          </div>
          <FormField label="Clinical / Medical Notes">
            <Textarea
              value={f.medicalNotes}
              onChange={(e) => set("medicalNotes")(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save()} className="gap-1">
            {saving && <Loader2 className="size-3.5 animate-spin" />} Save Patient
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditOwnerDialog({
  owner,
  onClose,
  onSaved,
}: {
  owner: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState(() => ({
    name: owner.name || "",
    phone: owner.phone || "",
    altPhone: owner.altPhone || "",
    email: owner.email || "",
    billingAddress: owner.billingAddress || owner.address || "",
    city: owner.city || "",
    state: owner.state || "",
    pin: owner.pin || "",
    country: owner.country || "India",
    occupation: owner.occupation || "",
    relationship: owner.relationship || "Owner",
  }));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const inp = (k: keyof typeof f, props: Record<string, unknown> = {}) => (
    <Input
      value={f[k]}
      onChange={(e) => set(k)(e.target.value)}
      className="h-8 text-xs"
      {...props}
    />
  );

  const save = async () => {
    if (!f.name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (digits10(f.phone).length !== 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    if (f.altPhone.trim() && digits10(f.altPhone).length !== 10) {
      toast.error("Alternate phone must be 10 digits");
      return;
    }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      toast.error("Enter a valid email address");
      return;
    }
    if (!f.billingAddress.trim()) {
      toast.error("Billing address is required");
      return;
    }
    if (!f.state.trim()) {
      toast.error("State is required");
      return;
    }
    if (f.pin.trim() && !/^\d{6}$/.test(f.pin.trim())) {
      toast.error("PIN code must be 6 digits");
      return;
    }
    setSaving(true);
    try {
      const trimmed = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]));
      // Only fill the legacy `address` field when it was empty, so an existing residential address is never overwritten.
      await updateOwnerFn({
        data: {
          ownerId: owner.ownerId,
          updates: { ...trimmed, ...(owner.address ? {} : { address: trimmed["billingAddress"] }) },
        },
      });
      toast.success("Owner details updated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save owner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="text-base">
          Edit Pet Parent · <span className="font-mono text-sm">{owner.ownerId}</span>
        </DialogTitle>
        <DialogDescription className="text-xs">
          Changes apply to every pet linked to this owner. Fields marked{" "}
          <span className="text-destructive">*</span> are required.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Full Name" required>
            {inp("name")}
          </FormField>
          <FormField label="Relationship with Pet">
            <SelectField
              value={f.relationship}
              onChange={set("relationship")}
              options={["Owner", "Co-owner", "Family Member", "Caretaker", "Foster", "Other"]}
            />
          </FormField>
          <FormField label="Phone Number" required>
            {inp("phone", { inputMode: "tel" })}
          </FormField>
          <FormField label="Alternate Phone">{inp("altPhone", { inputMode: "tel" })}</FormField>
          <FormField label="Email" wide>
            {inp("email", { type: "email" })}
          </FormField>
          <FormField label="Billing Address" required wide>
            <Textarea
              value={f.billingAddress}
              onChange={(e) => set("billingAddress")(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </FormField>
          <FormField label="City">{inp("city")}</FormField>
          <FormField label="State" required>
            {inp("state")}
          </FormField>
          <FormField label="PIN Code">
            {inp("pin", { inputMode: "numeric", maxLength: 6 })}
          </FormField>
          <FormField label="Country">{inp("country")}</FormField>
          <FormField label="Occupation">{inp("occupation")}</FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save()} className="gap-1">
            {saving && <Loader2 className="size-3.5 animate-spin" />} Save Owner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
