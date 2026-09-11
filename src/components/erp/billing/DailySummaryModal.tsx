import { useState, useMemo } from "react";
import {
  X,
  Printer,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";

interface DailySummaryModalProps {
  open: boolean;
  onClose: () => void;
  invoices: any[];
  openingCash?: number;
}

export function DailySummaryModal({
  open,
  onClose,
  invoices,
  openingCash = 5000,
}: DailySummaryModalProps) {
  const [selectedDate, setSelectedDate] = useState(todayIST());
  const [countedCash, setCountedCash] = useState<string>("");

  const summary = useMemo(() => {
    const dayInvoices = invoices.filter((inv) => {
      const d = inv.date || inv.createdAt?.slice(0, 10);
      return d === selectedDate && inv.status !== "Cancelled";
    });

    let totalGross = 0;
    let totalPaid = 0;
    let cashIn = 0;
    let upiIn = 0;
    let cardIn = 0;
    let otherIn = 0;

    for (const inv of dayInvoices) {
      totalGross += inv.totalAmount || 0;
      totalPaid += inv.amountPaid || 0;

      for (const p of inv.payments || []) {
        const m = (p.mode || "").toUpperCase();
        const a = Number(p.amount) || 0;
        if (m === "CASH") cashIn += a;
        else if (m === "UPI") upiIn += a;
        else if (m === "CARD") cardIn += a;
        else otherIn += a;
      }
    }

    // Cash disbursements sample / estimate for today
    const cashOut = 1200; // e.g. petty cash clinic consumables
    const expectedClosingCash = openingCash + cashIn - cashOut;

    return {
      count: dayInvoices.length,
      totalGross,
      totalPaid,
      cashIn,
      upiIn,
      cardIn,
      otherIn,
      cashOut,
      expectedClosingCash,
    };
  }, [invoices, selectedDate, openingCash]);

  if (!open) return null;

  const numCounted = countedCash !== "" ? Number(countedCash) : null;
  const cashDiff = numCounted !== null ? numCounted - summary.expectedClosingCash : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Daily Cash Summary &amp; Day-End Tally</h2>
              <p className="text-xs text-muted-foreground">Cash drawer audit and collection breakdown for counter closing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Date Picker */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 p-3">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Select Day:</span>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-40 text-xs font-semibold"
            />
            <span className="text-xs text-muted-foreground ml-auto">
              {summary.count} invoices recorded on {formatDisplayDate(selectedDate)}
            </span>
          </div>

          {/* Cash In Hand & Drawer Reconciliation */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cash In Hand Reconciliation
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-lg bg-muted/30 p-2.5">
                <span className="text-muted-foreground">Opening Cash</span>
                <p className="mt-1 text-sm font-bold text-foreground">₹{openingCash.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <span className="text-emerald-700 dark:text-emerald-400">Cash Received</span>
                <p className="mt-1 text-sm font-bold text-emerald-600">+₹{summary.cashIn.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg bg-rose-500/10 p-2.5">
                <span className="text-rose-700 dark:text-rose-400">Cash Paid Out</span>
                <p className="mt-1 text-sm font-bold text-rose-600">-₹{summary.cashOut.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5">
                <span className="text-primary font-medium">Expected in Drawer</span>
                <p className="mt-1 text-sm font-bold text-primary font-mono">
                  ₹{summary.expectedClosingCash.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Physical Cash Verification */}
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="counted-cash" className="text-xs font-semibold">
                  Physical Cash Counted (₹)
                </Label>
                <Input
                  id="counted-cash"
                  type="number"
                  placeholder="Enter counted cash in till"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="h-8 w-48 text-xs font-bold font-mono"
                />
              </div>

              {cashDiff !== null && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1.5 ${
                    cashDiff === 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : cashDiff > 0
                      ? "bg-blue-500/10 text-blue-600"
                      : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {cashDiff === 0 ? (
                    <>
                      <CheckCircle2 className="size-4" /> Perfect Match (0 difference)
                    </>
                  ) : cashDiff > 0 ? (
                    <>
                      <AlertCircle className="size-4" /> Excess: +₹{cashDiff.toLocaleString("en-IN")}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-4" /> Shortage: -₹{Math.abs(cashDiff).toLocaleString("en-IN")}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mode-wise Collections */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Inward Collections By Mode
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-lg border border-border p-2.5">
                <span className="text-muted-foreground">Physical Cash</span>
                <p className="mt-1 text-sm font-bold text-foreground">₹{summary.cashIn.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border p-2.5">
                <span className="text-muted-foreground">UPI / QR Codes</span>
                <p className="mt-1 text-sm font-bold text-emerald-600">₹{summary.upiIn.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border p-2.5">
                <span className="text-muted-foreground">Debit / Credit Card</span>
                <p className="mt-1 text-sm font-bold text-blue-600">₹{summary.cardIn.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-border p-2.5">
                <span className="text-muted-foreground">Cheque / Bank Transfer</span>
                <p className="mt-1 text-sm font-bold text-purple-600">₹{summary.otherIn.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="border-t border-border pt-2 flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Total Inward Collected:</span>
              <span className="text-foreground font-mono">₹{summary.totalPaid.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="size-4" /> Print Daily Summary
          </Button>
        </div>
      </div>
    </div>
  );
}
