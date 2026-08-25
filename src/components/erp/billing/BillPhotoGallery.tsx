import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, ZoomIn, ZoomOut, RotateCw, Download,
  FileImage, FileText as FilePdf, Image as ImageIcon, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────────────────── */
interface BillPhoto {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  ownerName: string;
  fileName: string;
  fileType: "image" | "pdf";
  sizeLabel: string;
  uploadedBy: string;
  uploadedAt: string;
  /** data URL or placeholder colour */
  dataUrl: string;
  status: "Verified" | "Pending" | "Rejected";
}

/* ─── Seed data ───────────────────────────────────────────────────── */
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"];

const SEED_PHOTOS: BillPhoto[] = [
  {
    id: "ph1", invoiceId: "INV-20481", invoiceNo: "INV-20481", ownerName: "Tariq Hussain",
    fileName: "receipt-upi-payment.jpg", fileType: "image", sizeLabel: "1.2 MB",
    uploadedBy: "Kavitha Nair (Receptionist)", uploadedAt: "16/08/2026 11:42",
    dataUrl: PALETTE[0] ?? "#6366f1", status: "Verified",
  },
  {
    id: "ph2", invoiceId: "INV-20482", invoiceNo: "INV-20482", ownerName: "Nalini Prasad",
    fileName: "bill-front.jpg", fileType: "image", sizeLabel: "2.8 MB",
    uploadedBy: "Kavitha Nair (Receptionist)", uploadedAt: "16/08/2026 10:15",
    dataUrl: PALETTE[1] ?? "#10b981", status: "Pending",
  },
  {
    id: "ph3", invoiceId: "INV-20482", invoiceNo: "INV-20482", ownerName: "Nalini Prasad",
    fileName: "bill-back.jpg", fileType: "image", sizeLabel: "2.1 MB",
    uploadedBy: "Kavitha Nair (Receptionist)", uploadedAt: "16/08/2026 10:17",
    dataUrl: PALETTE[2] ?? "#f59e0b", status: "Pending",
  },
  {
    id: "ph4", invoiceId: "INV-20485", invoiceNo: "INV-20485", ownerName: "Vikram Shetty",
    fileName: "boarding-invoice-scan.pdf", fileType: "pdf", sizeLabel: "680 KB",
    uploadedBy: "Rahul Menon (Accountant)", uploadedAt: "15/08/2026 17:03",
    dataUrl: PALETTE[3] ?? "#ec4899", status: "Verified",
  },
];

const INVOICES = [
  "INV-20481", "INV-20482", "INV-20483", "INV-20484", "INV-20485", "INV-20486",
];

/* ─── Lightbox ───────────────────────────────────────────────────── */
function Lightbox({ photo, onClose }: { photo: BillPhoto; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative mx-4 max-w-2xl w-full bg-card rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileImage className="size-4 text-primary" />
            <span className="text-sm font-semibold">{photo.fileName}</span>
            <span className="text-xs text-muted-foreground">({photo.sizeLabel})</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ZoomOut className="size-4" />
            </button>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ZoomIn className="size-4" />
            </button>
            <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <RotateCw className="size-4" />
            </button>
            <button onClick={() => toast.success(`${photo.fileName} downloaded`)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Download className="size-4" />
            </button>
            <button onClick={onClose} className="ml-1 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex items-center justify-center bg-muted/40 h-96 overflow-hidden p-4">
          <motion.div
            animate={{ scale: zoom, rotate: rotation }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-2xl select-none cursor-zoom-in"
            style={{
              background: photo.dataUrl,
              width: 320,
              height: 240,
            }}
          >
            {photo.fileType === "pdf" ? (
              <div className="text-center">
                <FilePdf className="size-12 mx-auto mb-2 opacity-80" />
                <span className="text-sm opacity-70">PDF Document</span>
              </div>
            ) : (
              <div className="text-center">
                <ImageIcon className="size-12 mx-auto mb-2 opacity-80" />
                <span className="text-sm opacity-70">Bill Photo</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Meta */}
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>Uploaded by {photo.uploadedBy}</span>
          <span>{photo.uploadedAt}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */
export function BillPhotoGallery() {
  const [photos, setPhotos] = useState<BillPhoto[]>(SEED_PHOTOS);
  const [filterInvoice, setFilterInvoice] = useState<string>("all");
  const [lightbox, setLightbox] = useState<BillPhoto | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadInvoice, setUploadInvoice] = useState<string>(INVOICES[0] ?? "INV-20481");
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = filterInvoice === "all"
    ? photos
    : photos.filter((p) => p.invoiceId === filterInvoice);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allowed = ["image/jpeg", "image/png", "image/heic", "application/pdf"];
    Array.from(files).forEach((file) => {
      if (!allowed.includes(file.type)) {
        toast.error(`${file.name}: unsupported type (JPG/PNG/HEIC/PDF only)`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: exceeds 10 MB limit`);
        return;
      }
      const isImage = file.type.startsWith("image/");
      const newPhoto: BillPhoto = {
        id: crypto.randomUUID(),
        invoiceId: uploadInvoice,
        invoiceNo: uploadInvoice,
        ownerName: "—",
        fileName: file.name,
        fileType: isImage ? "image" : "pdf",
        sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadedBy: "Kavitha Nair (Receptionist)",
        uploadedAt: new Date().toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        dataUrl: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? "#6366f1",
        status: "Pending",
      };
      setPhotos((prev) => [newPhoto, ...prev]);
      toast.success(`${file.name} uploaded to ${uploadInvoice}`);
    });
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    toast.success("Photo removed");
  };

  const verifyPhoto = (id: string) => {
    setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, status: "Verified" } : p));
    toast.success("Photo marked as verified");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Bill / Receipt Photo Gallery</h2>
          <p className="text-sm text-muted-foreground">
            Attach and view physical bill photos against invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterInvoice} onValueChange={setFilterInvoice}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All invoices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All invoices</SelectItem>
              {INVOICES.map((inv) => (
                <SelectItem key={inv} value={inv}>{inv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total photos", value: String(photos.length) },
          { label: "Verified", value: String(photos.filter(p => p.status === "Verified").length) },
          { label: "Pending review", value: String(photos.filter(p => p.status === "Pending").length), warn: true },
          { label: "Invoices with photos", value: String(new Set(photos.map(p => p.invoiceId)).size) },
        ].map((k) => (
          <div key={k.label} className="erp-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.warn ? "text-amber-600" : ""}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Upload area */}
      <div className="erp-card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-semibold">Attach to invoice:</p>
          <Select value={uploadInvoice} onValueChange={setUploadInvoice}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICES.map((inv) => (
                <SelectItem key={inv} value={inv}>{inv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? "border-primary bg-primary-soft/40 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/40"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <Upload className="size-8 mx-auto mb-3 text-primary/60" />
          <p className="text-sm font-semibold">Click or drag & drop photos here</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC or PDF · Max 10 MB per file</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Gallery grid */}
      <div>
        <p className="section-label mb-3">{visible.length} photo{visible.length !== 1 ? "s" : ""}</p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {visible.map((photo) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                layout
                className="erp-card overflow-hidden group"
              >
                {/* Thumbnail */}
                <div
                  className="relative h-40 flex items-center justify-center cursor-pointer"
                  style={{ background: photo.dataUrl }}
                  onClick={() => setLightbox(photo)}
                >
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <Eye className="size-8 text-white drop-shadow-lg" />
                  </div>
                  {photo.fileType === "pdf" ? (
                    <FilePdf className="size-12 text-white/80" />
                  ) : (
                    <ImageIcon className="size-12 text-white/80" />
                  )}
                  <div className="absolute top-2 right-2">
                    <StatusPill value={photo.status} />
                  </div>
                </div>

                {/* Meta */}
                <div className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold truncate">{photo.fileName}</p>
                      <p className="text-xs text-muted-foreground">{photo.invoiceNo} · {photo.sizeLabel}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setLightbox(photo)}
                        className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors"
                        title="View full screen"
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="p-1 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                        title="Remove"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{photo.uploadedAt}</p>
                  {photo.status === "Pending" && (
                    <button
                      onClick={() => verifyPhoto(photo.id)}
                      className="mt-1 text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors font-medium"
                    >
                      Mark Verified
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {visible.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No photos for the selected invoice. Upload one above.
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}
