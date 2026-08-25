import { useState, useMemo } from "react";
import {
  UploadCloud,
  FileText,
  Search,
  Eye,
  Download,
  Calendar,
  Building,
  Plus,
  Paperclip,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  documents: any[];
  onViewDoc: (doc: any) => void;
  onUploadDoc: () => void;
  onDeleteDoc?: (id: string) => void;
}

export function UploadedDocumentsView({ documents, onViewDoc, onUploadDoc, onDeleteDoc }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return documents.filter((d) => {
      return (
        !q ||
        d.title?.toLowerCase().includes(q) ||
        d.reportId?.toLowerCase().includes(q) ||
        d.pet?.toLowerCase().includes(q) ||
        d.petId?.toLowerCase().includes(q) ||
        d.facility?.toLowerCase().includes(q)
      );
    });
  }, [documents, query]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Drag & Drop Trigger */}
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
            <UploadCloud className="size-6" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Document Ingestion &amp; External Records Station
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload external ultrasound scans, outside referral lab PDFs, historical vaccination booklets, or surgical notes
            </p>
          </div>
        </div>

        <Button
          onClick={onUploadDoc}
          className="h-10 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-2"
        >
          <Plus className="size-4" /> Ingest &amp; Upload Document
        </Button>
      </div>

      {/* Uploaded Documents List */}
      <div className="erp-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search uploaded files by title, patient, or facility..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} uploaded files tracked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((doc) => (
            <div
              key={doc.reportId}
              className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-red-500/10 text-red-600 font-bold text-xs">
                      PDF
                    </span>
                    <div>
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {doc.reportId}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                    {doc.category || "Uploaded External"}
                  </Badge>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-foreground line-clamp-1">{doc.title}</h5>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Patient: <strong>{doc.pet}</strong> ({doc.petId}) · {doc.species}
                  </p>
                  {doc.facility && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Building className="size-3 text-muted-foreground" /> {doc.facility}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {doc.date} · {doc.fileSize || "1.2 MB"}
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewDoc(doc)}
                    className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                  >
                    <Eye className="size-3" /> View
                  </Button>
                  {onDeleteDoc && (
                    <button
                      type="button"
                      onClick={() => onDeleteDoc(doc.reportId)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-3 py-12 text-center text-xs text-muted-foreground">
              No uploaded documents match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
