import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Ban,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
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
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import {
  listPurchaseBillsFn,
  voidPurchaseBillFn,
  type PurchaseBillRow,
} from "@/lib/mongodb/serverFns/purchaseBills";
import {
  listSuppliersFn,
  type SupplierMasterRow,
} from "@/lib/mongodb/serverFns/masters";
import { SupplierBillFormModal } from "./SupplierBillFormModal";
import { toast } from "sonner";

interface SupplierBillsTabProps {
  onPayBill?: (supplierId: string, billId: string) => void;
}

export function SupplierBillsTab({ onPayBill }: SupplierBillsTabProps) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"UNPAID" | "PARTIAL" | "PAID" | "VOID" | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [bills, setBills] = useState<PurchaseBillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    listSuppliersFn()
      .then(setSuppliers)
      .catch((err) => console.error("Failed to load suppliers:", err));
  }, []);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPurchaseBillsFn({
        data: {
          from: dateRange.from,
          to: dateRange.to,
          supplierId: selectedSupplier === "ALL" ? undefined : selectedSupplier,
          status: selectedStatus === "ALL" ? undefined : selectedStatus,
          q: searchQuery.trim() || undefined,
        },
      });
      setBills(data);
    } catch (err) {
      console.error("Failed to load purchase bills:", err);
      toast.error("Failed to load purchase bills");
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedSupplier, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleVoid = async (id: string, ref: string) => {
    const reason = window.prompt(`Enter cancellation reason for purchase bill ${ref}:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error("A valid cancellation reason is required (at least 3 characters)");
      return;
    }

    try {
      await voidPurchaseBillFn({ data: { id, reason: reason.trim() } });
      toast.success(`Purchase Bill ${ref} cancelled`);
      fetchBills();
    } catch (err: any) {
      console.error("Void failed:", err);
      toast.error(err.message || "Failed to cancel bill");
    }
  };

  // Calculations
  const activeBills = bills.filter((b) => b.status !== "VOID");
  const totalPurchases = activeBills.reduce((s, b) => s + b.grandTotal, 0);
  const totalPaid = activeBills.reduce((s, b) => s + b.amountPaid, 0);
  const totalOutstanding = Math.max(0, totalPurchases - totalPaid);
  const unpaidCount = activeBills.filter((b) => b.status === "UNPAID" || b.status === "PARTIAL").length;

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* ── Top Bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBills}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-1.5 shadow-xs"
          >
            <Plus className="size-4" /> New Supplier Bill
          </Button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Inward Bills</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <FileSpreadsheet className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activeBills.length} active bill{activeBills.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Amount Settled</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Paid against bills</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Outstanding Balance</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600">
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {unpaidCount} unpaid / partial bill{unpaidCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Registered Suppliers</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {suppliers.length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Active supply vendors</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search internal ref, supplier bill #, or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Supplier: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="UNPAID">Unpaid</SelectItem>
            <SelectItem value="PARTIAL">Partially Paid</SelectItem>
            <SelectItem value="PAID">Fully Paid</SelectItem>
            <SelectItem value="VOID">Cancelled / Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Bills Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Bill Date</th>
                <th className="px-4 py-3">Internal Ref</th>
                <th className="px-4 py-3">Supplier Invoice #</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3 text-right">Bill Total (₹)</th>
                <th className="px-4 py-3 text-right">Paid (₹)</th>
                <th className="px-4 py-3 text-right">Balance (₹)</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    Loading supplier bills...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    No supplier bills found matching your criteria.
                  </td>
                </tr>
              ) : (
                bills.map((row) => {
                  const isVoid = row.status === "VOID";
                  const balance = Math.max(0, row.grandTotal - row.amountPaid);
                  return (
                    <tr
                      key={row._id}
                      className={`transition-colors hover:bg-muted/30 ${
                        isVoid ? "opacity-50 bg-destructive/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDisplayDate(row.billDate)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                        {row.internalRef}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                        {row.billNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.supplierName}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        ₹{row.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium whitespace-nowrap">
                        ₹{row.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          balance > 0 ? "text-rose-600" : "text-muted-foreground"
                        }`}
                      >
                        ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {row.dueDate ? formatDisplayDate(row.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            row.status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : row.status === "PARTIAL"
                              ? "bg-amber-500/10 text-amber-600"
                              : row.status === "UNPAID"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {!isVoid ? (
                          <div className="flex items-center justify-center gap-1">
                            {balance > 0 && onPayBill && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPayBill(row.supplierId, row._id)}
                                className="h-6 px-2 text-[10px] gap-1 text-primary border-primary/20 hover:bg-primary/10"
                              >
                                <CreditCard className="size-3" /> Pay
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleVoid(row._id, row.internalRef)}
                              title="Void Bill"
                              className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                            >
                              <Ban className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Cancelled</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {activeBills.length > 0 && (
              <tfoot className="border-t border-border bg-muted/30 font-semibold text-foreground">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right">
                    Total Active Bills ({activeBills.length}):
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    ₹{totalPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">
                    ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-rose-600">
                    ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      <SupplierBillFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchBills}
      />
    </div>
  );
}
