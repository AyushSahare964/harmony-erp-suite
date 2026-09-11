import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Receipt,
  Download,
  Filter,
  Ban,
  Wallet,
  ArrowDownRight,
  CreditCard,
  Building2,
  RefreshCw,
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
  listExpensesFn,
  voidExpenseFn,
  type ExpenseRow,
} from "@/lib/mongodb/serverFns/expenses";
import {
  listExpenseCategoriesFn,
  type ExpenseCategoryRow,
} from "@/lib/mongodb/serverFns/masters";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { toast } from "sonner";

export function ExpensesTab() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedNature, setSelectedNature] = useState<"ALL" | "BUSINESS" | "PERSONAL">("ALL");
  const [selectedMode, setSelectedMode] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "VOID" | "ALL">("ACTIVE");

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  // Load masters
  useEffect(() => {
    listExpenseCategoriesFn()
      .then(setCategories)
      .catch((err) => console.error("Error loading categories:", err));
  }, []);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listExpensesFn({
        data: {
          from: dateRange.from,
          to: dateRange.to,
          categoryId: selectedCategory === "ALL" ? undefined : selectedCategory,
          nature: selectedNature === "ALL" ? undefined : selectedNature,
          mode: selectedMode === "ALL" ? undefined : selectedMode,
          status: statusFilter,
          q: searchQuery.trim() || undefined,
        },
      });
      setExpenses(data);
    } catch (err) {
      console.error("Failed to load expenses:", err);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCategory, selectedNature, selectedMode, statusFilter, searchQuery]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Handle Void
  const handleVoid = async (id: string, voucherNo: string) => {
    const reason = window.prompt(`Enter cancellation/void reason for voucher ${voucherNo}:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error("A valid void reason is required (at least 3 chars)");
      return;
    }

    try {
      await voidExpenseFn({ data: { id, reason: reason.trim() } });
      toast.success(`Voucher ${voucherNo} voided`);
      fetchExpenses();
    } catch (err: any) {
      console.error("Void failed:", err);
      toast.error(err.message || "Failed to void voucher");
    }
  };

  // Calculations for Summary Strip
  const activeExpenses = expenses.filter((e) => e.status === "ACTIVE");
  const totalAmount = activeExpenses.reduce((s, e) => s + e.totalAmount, 0);

  let cashTotal = 0;
  let digitalTotal = 0;
  const catTotals: Record<string, number> = {};

  for (const e of activeExpenses) {
    catTotals[e.categoryName] = (catTotals[e.categoryName] || 0) + e.totalAmount;
    for (const l of e.paymentLines) {
      if (l.mode === "CASH") cashTotal += l.amount;
      else digitalTotal += l.amount;
    }
  }

  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* ── Top Bar: Date Filter + Quick Action ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExpenses}
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
            <Plus className="size-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Expenses</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activeExpenses.length} active voucher{activeExpenses.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cash Outflow</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{cashTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Physical cash paid</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Bank &amp; Digital</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            ₹{digitalTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">UPI, Card &amp; Bank transfers</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Top Category</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <ArrowDownRight className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-foreground truncate" title={topCategory ? topCategory[0] : "None"}>
            {topCategory ? topCategory[0] : "—"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {topCategory ? `₹${topCategory[1].toLocaleString("en-IN")}` : "No expenses"}
          </div>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search voucher, beneficiary, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Category: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMode} onValueChange={setSelectedMode}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Mode: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Modes</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="UPI">UPI</SelectItem>
            <SelectItem value="CARD">Card</SelectItem>
            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
            <SelectItem value="CHEQUE">Cheque</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="VOID">Voided</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
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
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Paid To / Ref</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Payment Breakdown</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No expense records found for the selected filters.
                  </td>
                </tr>
              ) : (
                expenses.map((row) => {
                  const isVoid = row.status === "VOID";
                  return (
                    <tr
                      key={row._id}
                      className={`transition-colors hover:bg-muted/30 ${
                        isVoid ? "opacity-50 bg-destructive/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDisplayDate(row.expenseDate)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                        {row.voucherNo}
                        {isVoid && (
                          <span className="ml-1.5 rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[9px] font-bold text-rose-600">
                            VOID
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{row.categoryName}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {row.categoryNature}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{row.paidTo || "—"}</div>
                        {row.billRefNo && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Ref: {row.billRefNo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                        {row.description || "—"}
                        {isVoid && row.voidReason && (
                          <div className="text-[10px] text-rose-500 italic">
                            Reason: {row.voidReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.paymentLines.map((l, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                            >
                              <span>{l.mode}:</span>
                              <span className="font-semibold">₹{l.amount.toLocaleString("en-IN")}</span>
                              {l.referenceNo && (
                                <span className="text-muted-foreground">({l.referenceNo})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!isVoid ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVoid(row._id, row.voucherNo)}
                            title="Void Voucher"
                            className="size-7 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                          >
                            <Ban className="size-3.5" />
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Voided</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {activeExpenses.length > 0 && (
              <tfoot className="border-t border-border bg-muted/30 font-semibold text-foreground">
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-right">
                    Total Active Expenses ({activeExpenses.length}):
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      <ExpenseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchExpenses}
      />
    </div>
  );
}
