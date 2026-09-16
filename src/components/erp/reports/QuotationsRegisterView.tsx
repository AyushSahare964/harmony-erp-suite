import { useState, useEffect, useMemo } from "react";
import {
  Search,
  FileText,
  Printer,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Dog,
  User,
  Plus,
  ArrowRight,
  Sparkles,
  Share2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listQuotationsFn, deleteQuotationFn, updateQuotationStatusFn } from "@/lib/mongodb/serverFns/quotations";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

interface Props {
  onNewQuotation?: () => void;
  onConvertToInvoice?: ((quotation: any) => void) | undefined;
  onViewQuotation?: ((quotation: any) => void) | undefined;
}

export function QuotationsRegisterView({ onNewQuotation, onConvertToInvoice, onViewQuotation }: Props) {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const data = await listQuotationsFn({ data: { query: "" } });
      // Also merge with localStorage if any local drafts exist
      try {
        const local = JSON.parse(localStorage.getItem("vetos_quotations") || "[]");
        const combined = [...(data || [])];
        for (const loc of local) {
          if (!combined.some((c) => c.quotationNo === loc.quotationNo)) {
            combined.unshift(loc);
          }
        }
        setQuotations(combined);
      } catch {
        setQuotations(data || []);
      }
    } catch (err) {
      console.error("Failed to load quotations:", err);
      toast.error("Failed to load quotations register");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuotations();
  }, []);

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const s = searchQuery.toLowerCase();
        const match =
          q.quotationNo?.toLowerCase().includes(s) ||
          q.petName?.toLowerCase().includes(s) ||
          q.ownerName?.toLowerCase().includes(s) ||
          q.ownerPhone?.toLowerCase().includes(s) ||
          q.doctorName?.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [quotations, statusFilter, searchQuery]);

  // Analytics Metrics
  const totalEstimates = filteredQuotations.length;
  const totalValue = filteredQuotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
  const convertedCount = filteredQuotations.filter((q) => q.status === "Converted" || q.status === "Accepted").length;
  const conversionRate = totalEstimates > 0 ? Math.round((convertedCount / totalEstimates) * 100) : 0;

  const handleExportCsv = () => {
    if (filteredQuotations.length === 0) {
      toast.info("No quotation records to export.");
      return;
    }

    const headers = [
      "Quotation No",
      "Date",
      "Valid Until",
      "Pet Name",
      "Species",
      "Owner Name",
      "Contact Phone",
      "Doctor",
      "Items Count",
      "Subtotal",
      "GST Amount",
      "Grand Total",
      "Status",
    ];

    const rows = filteredQuotations.map((q) => [
      q.quotationNo,
      q.date,
      q.validUntil,
      q.petName,
      q.species || "Canine",
      q.ownerName,
      q.ownerPhone || "",
      q.doctorName || "",
      q.items?.length || 0,
      q.subtotal || 0,
      q.totalGst || 0,
      q.grandTotal || 0,
      q.status || "Draft",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Quotations_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Quotations Register exported successfully!");
  };

  const handleUpdateStatus = async (quotationNo: string, newStatus: any) => {
    try {
      await updateQuotationStatusFn({ data: { quotationNo, status: newStatus } });
      setQuotations((prev) => prev.map((q) => (q.quotationNo === quotationNo ? { ...q, status: newStatus } : q)));
      toast.success(`Quotation ${quotationNo} marked as ${newStatus}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (quotationNo: string) => {
    if (!confirm(`Are you sure you want to delete quotation ${quotationNo}?`)) return;
    try {
      await deleteQuotationFn({ data: { quotationNo } });
      setQuotations((prev) => prev.filter((q) => q.quotationNo !== quotationNo));
      // Remove from local storage as well
      try {
        const local = JSON.parse(localStorage.getItem("vetos_quotations") || "[]");
        localStorage.setItem("vetos_quotations", JSON.stringify(local.filter((l: any) => l.quotationNo !== quotationNo)));
      } catch {}
      toast.success("Quotation deleted");
    } catch {
      toast.error("Failed to delete quotation");
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* ── Top Header Strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
            <FileText className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Medical Quotations &amp; Estimates Register</h3>
            <p className="text-xs text-muted-foreground">
              Formal proforma estimates, surgery packages, and procedure cost quotes for pet parents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadQuotations} className="h-8 gap-1.5 text-xs">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-8 gap-1.5 text-xs">
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>
          {onNewQuotation && (
            <Button size="sm" onClick={onNewQuotation} className="h-8 gap-1.5 text-xs shadow-xs">
              <Plus className="size-3.5" />
              <span>New Quotation</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Summary Strip ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Quotations
          </span>
          <div className="mt-2 text-2xl font-black text-foreground font-mono">{totalEstimates}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Estimates issued</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Value Quoted
          </span>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            ₹{totalValue.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Cumulative estimate value</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Accepted / Converted
          </span>
          <div className="mt-2 text-2xl font-black text-emerald-600 font-mono">{convertedCount}</div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium">Patients booked/treated</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Conversion Rate
          </span>
          <div className="mt-2 text-2xl font-black text-primary font-mono">{conversionRate}%</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Quote-to-invoice ratio</div>
        </div>
      </div>

      {/* ── Search and Filters ── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by quote #, patient, pet owner, phone, or doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Status: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent to Owner</SelectItem>
            <SelectItem value="Accepted">Accepted</SelectItem>
            <SelectItem value="Converted">Converted</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        {(searchQuery || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* ── Quotations Table ── */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Valid Until</th>
                <th className="px-4 py-3">Patient / Pet</th>
                <th className="px-4 py-3">Pet Parent (Owner)</th>
                <th className="px-4 py-3">Attending Vet</th>
                <th className="px-4 py-3">Items Summary</th>
                <th className="px-4 py-3 text-right">Estimated Amount (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-5 animate-spin text-primary" />
                      <span>Loading quotations register...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground">No quotations found</p>
                      <p className="text-xs">No cost estimate records matched your filters.</p>
                      {onNewQuotation && (
                        <Button size="sm" onClick={onNewQuotation} className="mt-2 text-xs">
                          + Generate New Quotation
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => {
                  const isConverted = q.status === "Converted";
                  const isAccepted = q.status === "Accepted";

                  return (
                    <tr
                      key={q.quotationNo}
                      className="cursor-pointer transition-colors hover:bg-muted/30 group"
                      onClick={() => onViewQuotation?.(q)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                          <span className="px-1 py-0.2 rounded text-[9px] font-black bg-indigo-600 text-white">QTN</span>
                          <span>{q.quotationNo}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDisplayDate(q.date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-muted-foreground">{formatDisplayDate(q.validUntil)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground flex items-center gap-1">
                          <Dog className="size-3 text-primary" />
                          <span>{q.petName}</span>
                        </div>
                        {(q.species || q.breed) && (
                          <div className="text-[10px] text-muted-foreground">
                            {q.species} {q.breed && `· ${q.breed}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{q.ownerName}</div>
                        {q.ownerPhone && (
                          <div className="text-[10px] text-muted-foreground font-mono">{q.ownerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {q.doctorName || "Dr. Rohit Sharma"}
                      </td>
                      <td className="px-4 py-3 max-w-[220px] truncate text-muted-foreground">
                        {q.items?.[0]?.name || "Procedure Package"}
                        {q.items?.length > 1 && ` +${q.items.length - 1} more`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        ₹{(q.grandTotal || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            q.status === "Converted"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : q.status === "Accepted"
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : q.status === "Sent"
                              ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                              : q.status === "Expired"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {q.status || "Draft"}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (onViewQuotation) onViewQuotation(q);
                              else {
                                window.print();
                              }
                            }}
                            title="View / Print Quotation"
                            className="h-7 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary gap-1"
                          >
                            <Printer className="size-3" />
                            <span>Print</span>
                          </Button>

                          {!isConverted && onConvertToInvoice && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onConvertToInvoice(q);
                                handleUpdateStatus(q.quotationNo, "Converted");
                              }}
                              title="Convert quotation into Live Sales Invoice"
                              className="h-7 px-2 text-[11px] font-semibold text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 gap-1"
                            >
                              <CheckCircle2 className="size-3" />
                              <span>Convert</span>
                            </Button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(q.quotationNo)}
                            className="rounded p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
