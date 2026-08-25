import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Printer,
  Download,
  Trash2,
  Edit2,
  Calendar,
  User,
  Dog,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShieldCheck,
  Building,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { recordInvoicePaymentFn, deleteInvoiceFn } from "@/lib/mongodb/serverFns/billing";
import { InvoicePrintView } from "@/components/erp/clinical/InvoicePrintView";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  invoice: any;
  onUpdated?: () => void;
  onDeleted?: () => void;
  onEdit?: (invoice: any) => void;
}

export function InvoiceDetailModal({ open, onClose, invoice, onUpdated, onDeleted, onEdit }: Props) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Card" | "NetBanking" | "Cheque">("UPI");
  const [paymentRef, setPaymentRef] = useState("");
  const [recording, setRecording] = useState(false);

  if (!invoice) return null;

  const handleRecordPayment = async () => {
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    if (amt > (invoice.balanceDue || 0)) {
      toast.error(`Amount cannot exceed remaining balance of ₹${invoice.balanceDue}`);
      return;
    }

    setRecording(true);
    try {
      await recordInvoicePaymentFn({
        data: {
          invoiceNo: invoice.invoiceNo,
          amount: amt,
          mode: paymentMode,
          trxRef: paymentRef || undefined,
        },
      });
      toast.success(`Payment of ₹${amt} recorded successfully`);
      setShowAddPaymentDialog(false);
      setPaymentAmount("");
      setPaymentRef("");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment");
    } finally {
      setRecording(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoiceNo}?`)) return;
    try {
      await deleteInvoiceFn({ data: { invoiceNo: invoice.invoiceNo } });
      toast.success(`Invoice ${invoice.invoiceNo} deleted`);
      onDeleted?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete invoice");
    }
  };

  // Group line items by category
  const categorizedItems: Record<string, any[]> = {};
  for (const item of invoice.items || []) {
    const cat = item.lineType || "Services";
    if (!categorizedItems[cat]) categorizedItems[cat] = [];
    categorizedItems[cat]!.push(item);
  }

  const paymentsList = invoice.payments || (invoice.amountPaid > 0 ? [{
    mode: invoice.paymentMode || "UPI",
    amount: invoice.amountPaid,
    timestamp: invoice.updatedAt || invoice.createdAt || new Date().toISOString(),
  }] : []);

  const totalPaid = invoice.amountPaid || paymentsList.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const balanceDue = invoice.balanceDue !== undefined ? invoice.balanceDue : Math.max(0, (invoice.totalAmount || 0) - totalPaid);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl border-border bg-card shadow-2xl p-0 gap-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-5 bg-card sticky top-0 z-10">
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg font-bold text-foreground">
                Invoice - {invoice.invoiceNo || "INV/2026-27/905"}
              </DialogTitle>
              <DialogDescription className="sr-only">Detailed invoice view</DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5">
            {/* Sale Information Card (Exact Recreation of Screenshot 2) */}
            <div className="rounded-2xl border border-border/90 bg-muted/20 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-foreground">Sale Information</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Date:</span>
                  <strong className="text-foreground">{invoice.date || new Date().toISOString().slice(0, 10)}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Invoice no:</span>
                  <strong className="text-foreground font-mono">{invoice.invoiceNo}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Branch:</span>
                  <strong className="text-foreground">{invoice.branch || "perfect society"}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Bill Type:</span>
                  <strong className="text-foreground">{invoice.billType || "Non-GST"}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Next Visit Date:</span>
                  <strong className="text-foreground">{invoice.nextVisitDate || "Not scheduled"}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Next Vaccine Date:</span>
                  <strong className="text-foreground">{invoice.nextVaccineDate || "Not scheduled"}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Next Deworming Date:</span>
                  <strong className="text-foreground">{invoice.nextDewormingDate || "Not scheduled"}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Pet Name:</span>
                  <strong className="text-foreground capitalize flex items-center gap-1.5">
                    {invoice.petName}
                    <Badge variant="outline" className="font-mono text-[10px] py-0 bg-primary/10 text-primary border-primary/20">
                      {invoice.petId}
                    </Badge>
                  </strong>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Owner Name:</span>
                  <strong className="text-foreground capitalize">{invoice.ownerName}</strong>
                  {invoice.ownerPhone && (
                    <span className="text-muted-foreground font-mono ml-2">({invoice.ownerPhone})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items Breakdown (Grouped by Category as in Screenshot 2) */}
            <div className="space-y-4">
              {Object.entries(categorizedItems).length === 0 ? (
                <div className="rounded-xl border border-border p-4 text-center text-xs text-muted-foreground">
                  No itemized charges listed.
                </div>
              ) : (
                Object.entries(categorizedItems).map(([category, items]) => {
                  const categoryTotal = items.reduce((sum, it) => sum + (it.lineTotal || (it.quantity * it.unitPrice) || 0), 0);
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-foreground capitalize">{category}</h4>
                        <span className="text-xs font-bold text-primary">Total: ₹{categoryTotal.toFixed(2)}</span>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/40 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                              <th className="px-4 py-2.5">NAME</th>
                              <th className="px-4 py-2.5 text-center">QTY</th>
                              <th className="px-4 py-2.5 text-right">PRICE</th>
                              <th className="px-4 py-2.5 text-right">DISC(%)</th>
                              <th className="px-4 py-2.5 text-right">TOTAL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {items.map((it, idx) => (
                              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-foreground capitalize">{it.name}</td>
                                <td className="px-4 py-2.5 text-center font-mono">{it.quantity}</td>
                                <td className="px-4 py-2.5 text-right font-mono">₹{Number(it.unitPrice).toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right font-mono">{it.discountPercent || 0}%</td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold">
                                  ₹{Number(it.lineTotal || it.quantity * it.unitPrice).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Payment History & Payment Summary Grid (Screenshot 3) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment History Card */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h4 className="text-xs font-bold text-foreground">Payment History</h4>
                    {balanceDue > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddPaymentDialog(true)}
                        className="h-6 text-[11px] font-bold text-primary gap-1"
                      >
                        <Plus className="size-3" /> Record Payment
                      </Button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border/60 text-left font-semibold text-[11px]">
                          <th className="py-1.5">Sr.</th>
                          <th className="py-1.5">Date &amp; Time</th>
                          <th className="py-1.5">Mode</th>
                          <th className="py-1.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {paymentsList.map((p: any, idx: number) => {
                          const dateObj = new Date(p.timestamp || invoice.date);
                          const dateFormatted = dateObj.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });
                          const timeFormatted = dateObj.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          });
                          return (
                            <tr key={idx}>
                              <td className="py-2 text-muted-foreground">{idx + 1}</td>
                              <td className="py-2 font-mono text-muted-foreground">
                                {dateFormatted}, {timeFormatted}
                              </td>
                              <td className="py-2">
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                  {p.mode || "UPI"}
                                </span>
                              </td>
                              <td className="py-2 text-right font-mono font-bold">
                                ₹{Number(p.amount).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}

                        {paymentsList.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-muted-foreground italic">
                              No payment recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs font-bold text-foreground">Total Paid</span>
                  <span className="text-sm font-bold font-mono text-emerald-600">₹{Number(totalPaid).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Summary Card */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5 shadow-2xs">
                <h4 className="text-xs font-bold text-foreground border-b border-border pb-2">Payment Summary</h4>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-mono font-semibold">₹{Number(invoice.subtotal || invoice.totalAmount || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discount Amount:</span>
                    <span className="font-mono text-muted-foreground">-₹{Number(invoice.billDiscount || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-mono font-semibold">₹{Number(invoice.totalAmount || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Round-off:</span>
                    <span className="font-mono text-muted-foreground">₹{Number(invoice.roundOff || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-bold text-foreground">Total Amount:</span>
                    <span className="text-base font-bold font-mono text-primary">₹{Number(invoice.totalAmount || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-mono font-semibold text-emerald-600">₹{Number(totalPaid).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-xs font-bold text-foreground">Balance:</span>
                    <span className={cn("text-sm font-bold font-mono", balanceDue > 0 ? "text-destructive" : "text-emerald-600")}>
                      ₹{Number(balanceDue).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions (Screenshot 3: Download PDF, Edit, Close, Delete) */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-border">
              {/* Green Download PDF button */}
              <Button
                size="sm"
                onClick={() => setShowPrintModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-xs"
              >
                <Download className="size-3.5" /> Download PDF / Print
              </Button>

              {/* Blue Edit button */}
              <Button
                size="sm"
                onClick={() => {
                  onEdit?.(invoice);
                  onClose();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 px-4 gap-1.5 shadow-xs"
              >
                <Edit2 className="size-3.5" /> Edit
              </Button>

              {/* Dark Grey Close button */}
              <Button
                size="sm"
                variant="secondary"
                onClick={onClose}
                className="font-bold text-xs h-9 px-4 bg-muted hover:bg-muted/80 text-foreground"
              >
                Close
              </Button>

              {/* Red Delete button */}
              <Button
                size="sm"
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs h-9 px-4 gap-1.5 shadow-xs"
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Installment Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Record Payment for {invoice.invoiceNo}</DialogTitle>
            <DialogDescription className="text-xs">
              Remaining Balance Due: <strong className="text-destructive font-mono">₹{balanceDue}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payment Amount (₹)</Label>
              <Input
                type="number"
                placeholder={String(balanceDue)}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="font-mono text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI (GooglePay / PhonePe / Paytm)</SelectItem>
                  <SelectItem value="Cash">Cash on Counter</SelectItem>
                  <SelectItem value="Card">Credit / Debit Card</SelectItem>
                  <SelectItem value="NetBanking">NetBanking / NEFT / IMPS</SelectItem>
                  <SelectItem value="Cheque">Bank Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Transaction Reference / UTR (Optional)</Label>
              <Input
                placeholder="e.g. UPI-98124012019"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setShowAddPaymentDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRecordPayment} disabled={recording} className="font-bold">
              {recording ? "Recording..." : "Confirm & Save Payment ✓"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable Invoice Dialog */}
      <InvoicePrintView
        visit={invoice}
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />

    </>
  );
}
