import { useState, useEffect } from "react";
import { X, BookOpen, Download, Printer, Calendar, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSupplierLedgerFn,
  type SupplierLedgerResult,
} from "@/lib/mongodb/serverFns/supplierPayments";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";
import { toast } from "sonner";

interface SupplierLedgerModalProps {
  open: boolean;
  onClose: () => void;
  supplierId: string;
}

export function SupplierLedgerModal({
  open,
  onClose,
  supplierId,
}: SupplierLedgerModalProps) {
  const today = todayIST();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-04-01`); // Beginning of current FY
  const [to, setTo] = useState(today);
  const [data, setData] = useState<SupplierLedgerResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supplierId) return;
    setLoading(true);
    getSupplierLedgerFn({
      data: { supplierId, from, to },
    })
      .then(setData)
      .catch((err) => {
        console.error("Failed to load supplier ledger:", err);
        toast.error("Failed to load supplier ledger");
      })
      .finally(() => setLoading(false));
  }, [open, supplierId, from, to]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Supplier Statement / Ledger
              </h2>
              {data && (
                <p className="text-xs text-muted-foreground">
                  {data.supplier.name} • GSTIN: {data.supplier.gstin || "N/A"}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Date Filter & Info Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-3 bg-muted/10">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Period:</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-7 w-32 text-xs"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-7 w-32 text-xs"
            />
          </div>

          {data && (
            <div className="flex items-center gap-4 text-xs">
              <div className="rounded-lg bg-card px-3 py-1 border border-border">
                <span className="text-muted-foreground">Opening: </span>
                <span className="font-semibold text-foreground">
                  ₹{data.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {data.openingBalanceType}
                </span>
              </div>
              <div className="rounded-lg bg-card px-3 py-1 border border-border">
                <span className="text-muted-foreground">Closing: </span>
                <span className={`font-bold ${data.closingBalanceType === "Cr" ? "text-rose-600" : "text-emerald-600"}`}>
                  ₹{data.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {data.closingBalanceType}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Generating running ledger...
            </div>
          ) : !data ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No ledger data available.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Voucher #</th>
                    <th className="px-4 py-2.5">Particulars</th>
                    <th className="px-4 py-2.5 text-right">Debit (₹) [Paid]</th>
                    <th className="px-4 py-2.5 text-right">Credit (₹) [Billed]</th>
                    <th className="px-4 py-2.5 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* Opening Balance Row */}
                  <tr className="bg-muted/20 font-medium">
                    <td className="px-4 py-2 text-muted-foreground">{formatDisplayDate(from)}</td>
                    <td className="px-4 py-2 text-muted-foreground">—</td>
                    <td className="px-4 py-2 text-foreground font-semibold">Opening Balance B/F</td>
                    <td className="px-4 py-2 text-right">—</td>
                    <td className="px-4 py-2 text-right">—</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      ₹{data.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {data.openingBalanceType}
                    </td>
                  </tr>

                  {/* Transaction Rows */}
                  {data.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                        No transactions recorded in this date range.
                      </td>
                    </tr>
                  ) : (
                    data.entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                          {formatDisplayDate(entry.date)}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-medium text-foreground whitespace-nowrap">
                          {entry.voucherNo}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">{entry.particulars}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-medium whitespace-nowrap">
                          {entry.debit > 0
                            ? `₹${entry.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-rose-600 font-medium whitespace-nowrap">
                          {entry.credit > 0
                            ? `₹${entry.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                          ₹{entry.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {entry.balanceType}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="border-t border-border bg-muted/40 font-semibold text-foreground">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 text-right">Period Totals:</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">
                      ₹{data.totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-rose-600">
                      ₹{data.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-primary">
                      ₹{data.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {data.closingBalanceType}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
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
            <Printer className="size-4" /> Print Statement
          </Button>
        </div>
      </div>
    </div>
  );
}
