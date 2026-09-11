import { useState, useMemo } from "react";
import {
  Search,
  Eye,
  CreditCard,
  Printer,
  Download,
  Plus,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DateRangeFilter,
  defaultDateRange,
  type DateRange,
} from "@/components/erp/shared/DateRangeFilter";
import { StatusPill } from "@/components/erp/StatusPill";
import { InvoiceDetailModal } from "./InvoiceDetailModal";
import { PaymentInModal } from "./PaymentInModal";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

interface BillingInvoicesListProps {
  invoices: any[];
  loading: boolean;
  onRefresh: () => void;
  onNewInvoice: () => void;
}

export function BillingInvoicesList({
  invoices,
  loading,
  onRefresh,
  onNewInvoice,
}: BillingInvoicesListProps) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected invoice for the detail modal (Preserves bill viewing as requested!)
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Quick payment modal
  const [payModalInvoiceNo, setPayModalInvoiceNo] = useState<string | null>(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Date filter
      const d = inv.date || inv.createdAt?.slice(0, 10);
      if (d) {
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > dateRange.to) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "Paid" && inv.status !== "Paid") return false;
        if (statusFilter === "Unpaid" && inv.status !== "Unpaid") return false;
        if (statusFilter === "Partially Paid" && inv.status !== "Partially Paid") return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.ownerName?.toLowerCase().includes(q) ||
          inv.ownerPhone?.toLowerCase().includes(q) ||
          inv.petName?.toLowerCase().includes(q) ||
          inv.doctorName?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [invoices, dateRange, statusFilter, searchQuery]);

  // Calculations
  const totalBilled = filteredInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalReceived = filteredInvoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const totalBalance = Math.max(0, totalBilled - totalReceived);

  const handleOpenDetail = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* ── Top Controls ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={onNewInvoice} className="gap-1.5 shadow-xs">
            <Plus className="size-4" /> New Sales Invoice
          </Button>
        </div>
      </div>

      {/* ── Metrics Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Invoices</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <FileText className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {filteredInvoices.length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">In selected date range</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Billed</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Gross invoice values</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Amount Collected</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Received from pet owners</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Outstanding Dues</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600">
            ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Unsettled receivables</div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice #, customer name, mobile, pet, or doctor..."
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
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Partially Paid">Partially Paid</SelectItem>
            <SelectItem value="Unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer (Pet Owner)</th>
                <th className="px-4 py-3">Patient / Pet</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                <th className="px-4 py-3 text-right">Paid (₹)</th>
                <th className="px-4 py-3 text-right">Balance Due (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    No billing records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const balance = inv.balanceDue ?? Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0));
                  return (
                    <tr
                      key={inv.invoiceNo}
                      onClick={() => handleOpenDetail(inv)}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDisplayDate(inv.date || inv.createdAt?.slice(0, 10))}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-primary whitespace-nowrap">
                        {inv.invoiceNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.ownerName}</div>
                        {inv.ownerPhone && (
                          <div className="text-[10px] text-muted-foreground">{inv.ownerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.petName}</div>
                        {(inv.breed || inv.species) && (
                          <div className="text-[10px] text-muted-foreground">
                            {inv.breed || inv.species}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {inv.doctorName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        ₹{(inv.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium whitespace-nowrap">
                        ₹{(inv.amountPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
                          balance > 0 ? "text-rose-600" : "text-muted-foreground"
                        }`}
                      >
                        ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <StatusPill value={inv.status} />
                      </td>
                      <td
                        className="px-4 py-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDetail(inv)}
                            title="View Full Bill & Line Items"
                            className="size-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {balance > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPayModalInvoiceNo(inv.invoiceNo)}
                              title="Receive Payment"
                              className="h-6 px-2 text-[10px] gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              <CreditCard className="size-3" /> Pay
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredInvoices.length > 0 && (
              <tfoot className="border-t border-border bg-muted/30 font-semibold text-foreground">
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right">
                    Total Active Records ({filteredInvoices.length}):
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    ₹{totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">
                    ₹{totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-rose-600">
                    ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Bill Viewing Modal (Preserved as requested!) ── */}
      {selectedInvoice && (
        <InvoiceDetailModal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onUpdated={onRefresh}
          onDeleted={onRefresh}
        />
      )}

      {/* ── Payment In Modal ── */}
      {payModalInvoiceNo && (
        <PaymentInModal
          open={!!payModalInvoiceNo}
          onClose={() => setPayModalInvoiceNo(null)}
          invoices={invoices}
          initialInvoiceNo={payModalInvoiceNo}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
