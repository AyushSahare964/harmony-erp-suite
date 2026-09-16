import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Plus,
  Search,
  BookOpen,
  RefreshCw,
  Ban,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitPaymentInput, type PaymentLine, type PaymentAccount } from "@/components/erp/shared/SplitPaymentInput";
import {
  DateRangeFilter,
  defaultDateRange,
  type DateRange,
} from "@/components/erp/shared/DateRangeFilter";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";
import {
  listSupplierPaymentsFn,
  createSupplierPaymentFn,
  voidSupplierPaymentFn,
  type SupplierPaymentRow,
} from "@/lib/mongodb/serverFns/supplierPayments";
import {
  listPurchaseBillsFn,
  type PurchaseBillRow,
} from "@/lib/mongodb/serverFns/purchaseBills";
import {
  listSuppliersFn,
  listPaymentAccountsFn,
  type SupplierMasterRow,
} from "@/lib/mongodb/serverFns/masters";
import { SupplierLedgerModal } from "./SupplierLedgerModal";
import { toast } from "sonner";

interface BillAllocationRow {
  billId: string;
  internalRef: string;
  billNumber: string;
  billDate: string;
  dueDate?: string | undefined;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  payAmount: number;
  selected: boolean;
}

export function PaymentOutTab({
  initialSupplierId,
  initialBillId,
}: {
  initialSupplierId?: string | undefined;
  initialBillId?: string | undefined;
}) {
  const [viewMode, setViewMode] = useState<"RECORD" | "HISTORY">("RECORD");
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId || "");

  // Record Form States
  const [paymentDate, setPaymentDate] = useState(todayIST());
  const [allocationMode, setAllocationMode] = useState<"SELECTED" | "OLDEST_FIRST" | "ON_ACCOUNT">("SELECTED");
  const [unpaidBills, setUnpaidBills] = useState<BillAllocationRow[]>([]);
  const [onAccountAmount, setOnAccountAmount] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    {
      id: "line_1",
      mode: "BANK_TRANSFER",
      accountId: "",
      amount: 0,
      referenceNo: "",
      chequeDate: "",
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [ledgerModalSupplierId, setLedgerModalSupplierId] = useState<string | null>(null);

  // History Filter States
  const [historyDateRange, setHistoryDateRange] = useState<DateRange>(defaultDateRange());
  const [historyPayments, setHistoryPayments] = useState<SupplierPaymentRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // Load masters
  useEffect(() => {
    Promise.all([listSuppliersFn(), listPaymentAccountsFn()])
      .then(([sups, accs]) => {
        setSuppliers(sups);
        setAccounts(accs);
        if (sups.length > 0 && !selectedSupplierId && sups[0]) {
          setSelectedSupplierId(sups[0]._id);
        }
      })
      .catch((err) => console.error("Error loading masters:", err));
  }, []);

  // Fetch unpaid bills when supplier changes
  useEffect(() => {
    if (!selectedSupplierId) {
      setUnpaidBills([]);
      return;
    }

    listPurchaseBillsFn({
      data: {
        supplierId: selectedSupplierId,
        status: "ALL",
        from: "2020-01-01", // fetch all historical pending bills
        to: todayIST(),
      },
    })
      .then((bills) => {
        const pending = bills
          .filter((b) => b.status === "UNPAID" || b.status === "PARTIAL")
          .map((b) => {
            const balance = Math.max(0, b.grandTotal - b.amountPaid);
            const isInitial = initialBillId && b._id === initialBillId;
            return {
              billId: b._id,
              internalRef: b.internalRef,
              billNumber: b.billNumber,
              billDate: b.billDate,
              dueDate: b.dueDate,
              grandTotal: b.grandTotal,
              amountPaid: b.amountPaid,
              balance,
              payAmount: isInitial ? balance : 0,
              selected: !!isInitial,
            };
          });
        setUnpaidBills(pending);

        // If an initial bill was targeted, auto-fill the payment lines
        if (initialBillId) {
          const target = pending.find((p) => p.billId === initialBillId);
          if (target) {
            setPaymentLines([
              {
                id: "line_1",
                mode: "BANK_TRANSFER",
                accountId: accounts.find((a) => a.type === "BANK")?._id || "",
                amount: target.balance,
                referenceNo: "",
                chequeDate: "",
              },
            ]);
          }
        }
      })
      .catch((err) => console.error("Error fetching unpaid bills:", err));
  }, [selectedSupplierId, initialBillId, accounts]);

  // Load payment history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await listSupplierPaymentsFn({
        data: {
          from: historyDateRange.from,
          to: historyDateRange.to,
          q: historySearch.trim() || undefined,
        },
      });
      setHistoryPayments(data);
    } catch (err) {
      console.error("Error loading payment history:", err);
      toast.error("Failed to load payment history");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDateRange, historySearch]);

  useEffect(() => {
    if (viewMode === "HISTORY") {
      fetchHistory();
    }
  }, [viewMode, fetchHistory]);

  // Allocation calculation
  const totalAllocated =
    allocationMode === "ON_ACCOUNT"
      ? typeof onAccountAmount === "number"
        ? onAccountAmount
        : 0
      : unpaidBills.reduce((s, b) => s + (b.selected ? b.payAmount || 0 : 0), 0);

  const linesTotal = paymentLines.reduce((s, l) => s + (l.amount || 0), 0);
  const diff = totalAllocated - linesTotal;

  // Toggle bill selection
  const handleToggleBill = (billId: string) => {
    setUnpaidBills((prev) =>
      prev.map((b) => {
        if (b.billId === billId) {
          const nextSelected = !b.selected;
          return {
            ...b,
            selected: nextSelected,
            payAmount: nextSelected ? b.balance : 0,
          };
        }
        return b;
      })
    );
  };

  const handlePayAmountChange = (billId: string, amount: number) => {
    setUnpaidBills((prev) =>
      prev.map((b) => {
        if (b.billId === billId) {
          return {
            ...b,
            payAmount: Math.min(b.balance, Math.max(0, amount)),
          };
        }
        return b;
      })
    );
  };

  // Oldest First FIFO auto-distribution
  const handleApplyOldestFirst = (enteredTotal: number) => {
    let remaining = enteredTotal;
    setUnpaidBills((prev) =>
      prev.map((b) => {
        if (remaining <= 0) {
          return { ...b, selected: false, payAmount: 0 };
        }
        const alloc = Math.min(b.balance, remaining);
        remaining -= alloc;
        return {
          ...b,
          selected: alloc > 0,
          payAmount: alloc,
        };
      })
    );
  };

  // Synchronize payment lines with totalAllocated
  const handleSyncPaymentLines = () => {
    const firstLine = paymentLines[0];
    if (paymentLines.length === 1 && totalAllocated > 0 && firstLine) {
      setPaymentLines([{ ...firstLine, amount: totalAllocated }]);
    }
  };

  const handleSavePayment = async () => {
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (totalAllocated <= 0) {
      toast.error("Please allocate an amount to pay");
      return;
    }
    if (Math.abs(diff) > 0.01) {
      toast.error(`Payment lines total does not match allocation amount (difference: ₹${diff.toFixed(2)})`);
      return;
    }

    const sup = suppliers.find((s) => s._id === selectedSupplierId);

    const allocations =
      allocationMode === "ON_ACCOUNT"
        ? []
        : unpaidBills
            .filter((b) => b.selected && b.payAmount > 0)
            .map((b) => ({
              purchaseBillId: b.billId,
              billRef: `${b.internalRef} (${b.billNumber})`,
              amount: b.payAmount,
            }));

    setSubmitting(true);
    try {
      const res = await createSupplierPaymentFn({
        data: {
          supplierId: selectedSupplierId,
          supplierName: sup?.name,
          paymentDate,
          totalAmount: totalAllocated,
          allocationMode,
          remarks: remarks.trim() || undefined,
          allocations,
          paymentLines: paymentLines.map((l) => {
            const acc = accounts.find((a) => a._id === l.accountId);
            return {
              mode: l.mode,
              accountId: l.accountId,
              accountName: l.mode === "CASH" ? "Cash" : acc?.name || "Bank",
              amount: l.amount,
              referenceNo: l.referenceNo || undefined,
              chequeDate: l.chequeDate || undefined,
            };
          }),
        },
      });

      toast.success(`Payment recorded! Voucher: ${res.voucherNo}`);
      // Reset form
      setRemarks("");
      setOnAccountAmount("");
      setPaymentLines([
        {
          id: Math.random().toString(36).slice(2),
          mode: "BANK_TRANSFER",
          accountId: accounts.find((a) => a.type === "BANK")?._id || "",
          amount: 0,
          referenceNo: "",
          chequeDate: "",
        },
      ]);
      // Refresh bills
      setSelectedSupplierId(selectedSupplierId);
      setViewMode("HISTORY");
    } catch (err: any) {
      console.error("Payment out failed:", err);
      toast.error(err.message || "Failed to record payment out");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidVoucher = async (id: string, voucherNo: string) => {
    const reason = window.prompt(`Enter reason to cancel/void payment voucher ${voucherNo}:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error("A valid cancellation reason is required");
      return;
    }

    try {
      await voidSupplierPaymentFn({ data: { id, reason: reason.trim() } });
      toast.success(`Payment voucher ${voucherNo} cancelled`);
      fetchHistory();
    } catch (err: any) {
      console.error("Void payment failed:", err);
      toast.error(err.message || "Failed to cancel payment voucher");
    }
  };

  const selectedSupplier = suppliers.find((s) => s._id === selectedSupplierId);

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* ── Sub-view Tabs ── */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-border bg-muted/40 p-1">
          <button
            onClick={() => setViewMode("RECORD")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "RECORD"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            + Record Payment Out
          </button>
          <button
            onClick={() => setViewMode("HISTORY")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "HISTORY"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Payment Vouchers History
          </button>
        </div>

        {selectedSupplierId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLedgerModalSupplierId(selectedSupplierId)}
            className="gap-1.5 text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
          >
            <BookOpen className="size-3.5" /> View Supplier Statement / Ledger
          </Button>
        )}
      </div>

      {viewMode === "RECORD" ? (
        /* ── RECORD VIEW ── */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left 2 Cols: Form & Allocations */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header selection card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="pay-sup">Supplier *</Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger id="pay-sup">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pay-date">Payment Date</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>

              {selectedSupplier && (
                <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/20 p-2.5 text-xs text-muted-foreground border border-border/60">
                  <span>Contact: <strong>{selectedSupplier.contactPerson || "—"}</strong></span>
                  <span>Phone: <strong>{selectedSupplier.phone || "—"}</strong></span>
                  <span>Credit Days: <strong>{selectedSupplier.creditDays}d</strong></span>
                  <span>
                    Opening:{" "}
                    <strong>
                      ₹{selectedSupplier.openingBalance.toLocaleString("en-IN")} {selectedSupplier.openingBalanceType}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Bill Allocation Section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Allocate Against Bills</h3>
                  <p className="text-xs text-muted-foreground">Select how this payment settles outstanding bills</p>
                </div>

                <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAllocationMode("SELECTED")}
                    className={`rounded px-2.5 py-1 font-medium transition-all ${
                      allocationMode === "SELECTED" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Select Bills
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllocationMode("OLDEST_FIRST");
                      const amt = prompt("Enter total payment amount to allocate against oldest bills first:");
                      if (amt && !isNaN(Number(amt))) {
                        handleApplyOldestFirst(Number(amt));
                      }
                    }}
                    className={`rounded px-2.5 py-1 font-medium transition-all ${
                      allocationMode === "OLDEST_FIRST" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Oldest First (FIFO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode("ON_ACCOUNT")}
                    className={`rounded px-2.5 py-1 font-medium transition-all ${
                      allocationMode === "ON_ACCOUNT" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    On Account / Advance
                  </button>
                </div>
              </div>

              {allocationMode === "ON_ACCOUNT" ? (
                <div className="py-4 space-y-2">
                  <Label htmlFor="on-acc-amt">Advance / On Account Amount (₹) *</Label>
                  <Input
                    id="on-acc-amt"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={onAccountAmount}
                    onChange={(e) => setOnAccountAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className="max-w-xs font-semibold text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    This advance will be recorded on the supplier's account and can be adjusted later against future bills.
                  </p>
                </div>
              ) : unpaidBills.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No unpaid or partial bills found for this supplier. You can use <strong>On Account / Advance</strong> mode.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground sticky top-0">
                      <tr>
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2">Bill Date</th>
                        <th className="px-3 py-2">Ref / Inv #</th>
                        <th className="px-3 py-2 text-right">Bill Total (₹)</th>
                        <th className="px-3 py-2 text-right">Outstanding (₹)</th>
                        <th className="px-3 py-2 w-32 text-right">Pay Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unpaidBills.map((b) => (
                        <tr key={b.billId} className={`hover:bg-muted/30 ${b.selected ? "bg-primary/5" : ""}`}>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={b.selected}
                              onChange={() => handleToggleBill(b.billId)}
                              className="size-4 rounded border-border text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {formatDisplayDate(b.billDate)}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-mono font-medium text-foreground">{b.internalRef}</span>
                            <span className="ml-1 text-muted-foreground">({b.billNumber})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            ₹{b.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-rose-600 whitespace-nowrap">
                            ₹{b.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              max={b.balance}
                              step="0.01"
                              value={b.payAmount || ""}
                              disabled={!b.selected}
                              onChange={(e) =>
                                handlePayAmountChange(b.billId, parseFloat(e.target.value) || 0)
                              }
                              className="h-7 text-xs text-right font-bold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Total Allocated to Pay:
                </span>
                <span className="text-base font-bold text-primary font-mono">
                  ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Split Payment Input Section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Payment Modes &amp; Accounts</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncPaymentLines}
                  className="h-7 text-xs"
                >
                  Match Allocated (₹{totalAllocated.toFixed(2)})
                </Button>
              </div>

              <SplitPaymentInput
                total={totalAllocated}
                lines={paymentLines}
                onChange={setPaymentLines}
                accounts={accounts}
                requireExactMatch={true}
                defaultMode="BANK_TRANSFER"
              />
            </div>
          </div>

          {/* Right Col: Summary & Confirmation */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-semibold text-foreground">Payment Summary</h3>

              <div className="space-y-2 text-xs divide-y divide-border">
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Supplier:</span>
                  <span className="font-semibold text-foreground">{selectedSupplier?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Payment Date:</span>
                  <span className="font-semibold text-foreground">{formatDisplayDate(paymentDate)}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Mode of Allocation:</span>
                  <span className="font-semibold text-foreground uppercase">{allocationMode}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Total Bill Amount:</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Payment Lines Sum:</span>
                  <span className={`font-mono font-bold ${Math.abs(diff) <= 0.01 ? "text-emerald-600" : "text-rose-600"}`}>
                    ₹{linesTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {Math.abs(diff) > 0.01 && (
                <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600">
                  Mismatch: Payment lines differ from allocated total by ₹{diff.toFixed(2)}. Click "Match Allocated" above to sync.
                </div>
              )}

              <div className="space-y-1.5 pt-2">
                <Label htmlFor="pay-remarks" className="text-xs">Remarks / Cheque Details / Notes</Label>
                <Input
                  id="pay-remarks"
                  placeholder="e.g. Cleared via RTGS UTR 128912"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="text-xs"
                />
              </div>

              <Button
                onClick={handleSavePayment}
                disabled={submitting || totalAllocated <= 0 || Math.abs(diff) > 0.01}
                className="w-full gap-2 shadow-xs"
              >
                <CheckCircle2 className="size-4" />
                Confirm &amp; Record Payment Out
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── HISTORY VIEW ── */
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DateRangeFilter value={historyDateRange} onChange={setHistoryDateRange} />

            <div className="flex items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search voucher # or supplier..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchHistory}
                disabled={historyLoading}
                className="gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Voucher #</th>
                    <th className="px-4 py-3">Supplier Name</th>
                    <th className="px-4 py-3">Payment Modes</th>
                    <th className="px-4 py-3">Allocations (Bills Settled)</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        Loading payment history...
                      </td>
                    </tr>
                  ) : historyPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        No payment out vouchers found.
                      </td>
                    </tr>
                  ) : (
                    historyPayments.map((row) => {
                      const isVoid = row.status === "VOID";
                      return (
                        <tr
                          key={row._id}
                          className={`transition-colors hover:bg-muted/30 ${
                            isVoid ? "opacity-50 bg-destructive/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {formatDisplayDate(row.paymentDate)}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">
                            {row.voucherNo}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.supplierName}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {row.paymentLines.map((l, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                                >
                                  <span>{l.mode}:</span>
                                  <span className="font-semibold">₹{l.amount.toLocaleString("en-IN")}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {row.allocations.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic">On Account / Advance</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {row.allocations.map((a, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                                  >
                                    {a.billRef} (₹{a.amount.toLocaleString("en-IN")})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                            ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                !isVoid
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-rose-500/10 text-rose-600"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {!isVoid ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleVoidVoucher(row._id, row.voucherNo)}
                                title="Void Voucher & Reverse Allocations"
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
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Supplier Statement Ledger Modal ── */}
      {ledgerModalSupplierId && (
        <SupplierLedgerModal
          open={!!ledgerModalSupplierId}
          onClose={() => setLedgerModalSupplierId(null)}
          supplierId={ledgerModalSupplierId}
        />
      )}
    </div>
  );
}
