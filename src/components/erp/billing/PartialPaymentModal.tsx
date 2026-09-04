import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  IndianRupee,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getOwnerOutstandingBillsFn,
  recordPartialPaymentFn,
} from "@/lib/mongodb/serverFns/billing";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { roundMoney, addMoney } from "@/lib/utils/moneyUtils";

interface PartialPaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill with a specific owner if opened from a bill row */
  prefilledOwnerId?: string | undefined;
  prefilledOwnerName?: string | undefined;
  /** If opened from a single invoice, pre-select it */
  prefilledInvoiceNo?: string | undefined;
  onPaymentRecorded?: () => void;
}

interface OutstandingBill {
  invoiceNo: string;
  date: string;
  ownerName: string;
  ownerId: string;
  petName: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

interface Allocation {
  invoiceNo: string;
  allocatedAmount: number;
  maxAmount: number;
}

function generateIdempotencyKey(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function PartialPaymentModal({
  open,
  onClose,
  prefilledOwnerId,
  prefilledOwnerName,
  prefilledInvoiceNo,
  onPaymentRecorded,
}: PartialPaymentModalProps) {
  const [ownerIdInput, setOwnerIdInput] = useState(prefilledOwnerId || "");
  const [bills, setBills] = useState<OutstandingBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<Set<string>>(
    prefilledInvoiceNo ? new Set([prefilledInvoiceNo]) : new Set()
  );
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const [amountReceived, setAmountReceived] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Card" | "NetBanking" | "Cheque">("UPI");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [recordResult, setRecordResult] = useState<any>(null);

  // One idempotency key per modal open — prevents double-posting on re-click
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setOwnerIdInput(prefilledOwnerId || "");
      setBills([]);
      setSelectedInvoiceNos(prefilledInvoiceNo ? new Set([prefilledInvoiceNo]) : new Set());
      setAllocations({});
      setAmountReceived("");
      setPaymentMode("UPI");
      setReferenceNo("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setIsRecording(false);
      setRecorded(false);
      setRecordResult(null);

      if (prefilledOwnerId) {
        void loadBills(prefilledOwnerId);
      }
    }
  }, [open, prefilledOwnerId, prefilledInvoiceNo]);

  const loadBills = async (ownerId: string) => {
    if (!ownerId.trim()) return;
    setLoadingBills(true);
    try {
      const data = await getOwnerOutstandingBillsFn({ data: { ownerId: ownerId.trim() } });
      setBills(data || []);
      // Auto-select pre-filled invoice
      if (prefilledInvoiceNo) {
        setSelectedInvoiceNos(new Set([prefilledInvoiceNo]));
      }
    } catch (e: any) {
      toast.error("Could not load outstanding bills: " + (e?.message || "unknown error"));
    } finally {
      setLoadingBills(false);
    }
  };

  // Derived: selected bills data
  const selectedBills = useMemo(
    () => bills.filter((b) => selectedInvoiceNos.has(b.invoiceNo)),
    [bills, selectedInvoiceNos]
  );

  // Derived: total outstanding of selected bills
  const selectedOutstandingTotal = useMemo(
    () => selectedBills.reduce((sum, b) => addMoney(sum, b.balanceDue), 0),
    [selectedBills]
  );

  // Parse amountReceived as a clean number
  const amountReceivedNum = useMemo(() => {
    const n = parseFloat(amountReceived);
    return isNaN(n) ? 0 : roundMoney(n);
  }, [amountReceived]);

  // Auto-allocate oldest-first when amount or selection changes
  const autoAllocate = useCallback(() => {
    const amount = amountReceivedNum;
    if (amount <= 0 || selectedBills.length === 0) {
      setAllocations({});
      return;
    }
    let remaining = amount;
    const newAllocs: Record<string, number> = {};
    for (const bill of selectedBills) {
      const alloc = Math.min(remaining, bill.balanceDue);
      newAllocs[bill.invoiceNo] = roundMoney(alloc);
      remaining = roundMoney(remaining - alloc);
      if (remaining <= 0) break;
    }
    setAllocations(newAllocs);
  }, [amountReceivedNum, selectedBills]);

  useEffect(() => {
    autoAllocate();
  }, [autoAllocate]);

  // Allocation sum
  const allocationSum = useMemo(
    () =>
      Object.values(allocations).reduce((sum, v) => addMoney(sum, v), 0),
    [allocations]
  );

  // Remaining balance after payment
  const remainingBalance = useMemo(
    () => roundMoney(selectedOutstandingTotal - amountReceivedNum),
    [selectedOutstandingTotal, amountReceivedNum]
  );

  // Validation errors
  const validationError = useMemo(() => {
    if (selectedBills.length === 0) return "Select at least one outstanding bill";
    if (amountReceivedNum <= 0) return "Payment amount must be greater than zero";
    if (amountReceivedNum > selectedOutstandingTotal + 0.01)
      return `Payment (₹${amountReceivedNum.toFixed(2)}) exceeds selected outstanding (₹${selectedOutstandingTotal.toFixed(2)})`;
    if (Math.abs(allocationSum - amountReceivedNum) > 0.01)
      return `Allocation total ₹${allocationSum.toFixed(2)} must equal payment received ₹${amountReceivedNum.toFixed(2)}`;
    return null;
  }, [selectedBills, amountReceivedNum, selectedOutstandingTotal, allocationSum]);

  const handleToggleBill = (invoiceNo: string) => {
    setSelectedInvoiceNos((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceNo)) {
        next.delete(invoiceNo);
      } else {
        next.add(invoiceNo);
      }
      return next;
    });
  };

  const handleAllocationChange = (invoiceNo: string, value: string) => {
    const n = parseFloat(value);
    const bill = bills.find((b) => b.invoiceNo === invoiceNo);
    if (!bill) return;
    const clamped = isNaN(n) ? 0 : Math.min(roundMoney(n), bill.balanceDue);
    setAllocations((prev) => ({ ...prev, [invoiceNo]: roundMoney(clamped) }));
  };

  const handleRecord = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (isRecording) return;

    const ownerRef = bills[0];
    if (!ownerRef) {
      toast.error("Owner information missing");
      return;
    }

    setIsRecording(true);
    try {
      const allocationPayload = selectedBills
        .filter((b) => (allocations[b.invoiceNo] ?? 0) > 0)
        .map((b) => ({
          invoiceNo: b.invoiceNo,
          allocatedAmount: allocations[b.invoiceNo] ?? 0,
        }));

      const result = await recordPartialPaymentFn({
        data: {
          ownerId: ownerRef.ownerId,
          ownerName: ownerRef.ownerName,
          paymentDate,
          amountReceived: amountReceivedNum,
          mode: paymentMode,
          referenceNo: referenceNo.trim() || undefined,
          idempotencyKey,
          allocations: allocationPayload,
        },
      });

      setRecordResult(result);
      setRecorded(true);
      toast.success(result.message || "Payment recorded successfully!");
      onPaymentRecorded?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment. Please try again.");
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <CreditCard className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Record Partial / Combined Payment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Select outstanding bills for{" "}
                <strong>{prefilledOwnerName || ownerIdInput || "owner"}</strong>, enter amount received, and confirm allocation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {recorded && recordResult ? (
            /* ── Success Screen ─────────────────────────────── */
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 flex flex-col items-center justify-center gap-5 text-center h-full"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md">
                <CheckCircle2 className="size-9" />
              </span>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Payment Recorded!</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {recordResult.message}
                </p>
                <p className="text-xs font-mono bg-muted px-3 py-1.5 rounded-lg inline-block mt-2 font-bold">
                  Payment No: {recordResult.paymentNo}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {(recordResult.updatedInvoices || []).map((inv: string) => (
                  <Badge key={inv} variant="outline" className="text-[11px] font-mono">
                    {inv}
                  </Badge>
                ))}
              </div>
              <Button onClick={onClose} className="mt-2 font-bold">
                <CheckCircle2 className="size-4 mr-1.5" /> Done &amp; Close
              </Button>
            </motion.div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Owner lookup (if not prefilled) */}
              {!prefilledOwnerId && (
                <div className="erp-card p-4 space-y-2">
                  <Label className="text-xs font-semibold">Owner ID</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. OWN-0001"
                      value={ownerIdInput}
                      onChange={(e) => setOwnerIdInput(e.target.value)}
                      className="flex-1 text-xs h-9"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadBills(ownerIdInput)}
                      disabled={loadingBills || !ownerIdInput.trim()}
                      className="h-9 text-xs font-bold"
                    >
                      {loadingBills ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        "Load Bills"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Outstanding Bills List */}
              {bills.length === 0 && !loadingBills && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  {prefilledOwnerId
                    ? "No outstanding bills found for this owner."
                    : "Enter an Owner ID and click Load Bills."}
                </div>
              )}

              {bills.length > 0 && (
                <div className="erp-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Outstanding Bills ({bills.length})
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Selected outstanding:</span>
                      <span className="font-bold font-mono text-primary">
                        ₹{selectedOutstandingTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50 max-h-56 overflow-y-auto">
                    {bills.map((bill) => {
                      const isSelected = selectedInvoiceNos.has(bill.invoiceNo);
                      return (
                        <div
                          key={bill.invoiceNo}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 text-xs hover:bg-muted/20 transition-colors",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            id={`bill-${bill.invoiceNo}`}
                            checked={isSelected}
                            onCheckedChange={() => handleToggleBill(bill.invoiceNo)}
                          />
                          <label
                            htmlFor={`bill-${bill.invoiceNo}`}
                            className="flex-1 grid grid-cols-4 gap-2 cursor-pointer items-center"
                          >
                            <div>
                              <p className="font-bold font-mono text-foreground">{bill.invoiceNo}</p>
                              <p className="text-[10px] text-muted-foreground">{bill.petName}</p>
                            </div>
                            <div className="text-muted-foreground">
                              {formatDisplayDate(bill.date)}
                            </div>
                            <div className="text-right text-muted-foreground">
                              <p>Total: ₹{bill.totalAmount.toFixed(2)}</p>
                              <p className="text-[10px]">Paid: ₹{bill.amountPaid.toFixed(2)}</p>
                            </div>
                            <div className="text-right font-bold text-destructive font-mono">
                              ₹{bill.balanceDue.toFixed(2)}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payment Details */}
              {selectedBills.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Payment entry */}
                  <div className="erp-card p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">Payment Details</p>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Amount Received (₹)</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          className="pl-7 h-9 text-sm font-bold font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Max allowed: ₹{selectedOutstandingTotal.toFixed(2)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Payment Mode</Label>
                      <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UPI">UPI (Google Pay / PhonePe)</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Card">Debit / Credit Card</SelectItem>
                          <SelectItem value="NetBanking">NetBanking / NEFT</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {paymentMode !== "Cash" && (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Reference / Transaction No.
                        </Label>
                        <Input
                          placeholder="UPI Ref / Cheque No. / Bank Ref..."
                          value={referenceNo}
                          onChange={(e) => setReferenceNo(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Payment Date (DD/MM/YYYY)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                          {formatDisplayDate(paymentDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Allocation per bill */}
                  <div className="erp-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Allocation per Bill
                      </p>
                      <button
                        type="button"
                        onClick={autoAllocate}
                        className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="size-3" /> Auto-fill
                      </button>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {selectedBills.map((bill) => (
                        <div key={bill.invoiceNo} className="flex items-center gap-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold font-mono text-foreground truncate">{bill.invoiceNo}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Outstanding: ₹{bill.balanceDue.toFixed(2)}
                            </p>
                          </div>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₹</span>
                            <Input
                              type="number"
                              min={0}
                              max={bill.balanceDue}
                              step={0.01}
                              value={allocations[bill.invoiceNo] ?? 0}
                              onChange={(e) => handleAllocationChange(bill.invoiceNo, e.target.value)}
                              className="h-7 pl-5 text-xs font-mono text-right"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Running totals */}
                    <div className="pt-3 border-t border-border space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Payment Received:</span>
                        <span className="font-mono font-bold text-foreground">₹{amountReceivedNum.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Allocated:</span>
                        <span
                          className={cn(
                            "font-mono font-bold",
                            Math.abs(allocationSum - amountReceivedNum) > 0.01
                              ? "text-destructive"
                              : "text-emerald-600"
                          )}
                        >
                          ₹{allocationSum.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-border pt-1.5">
                        <span>Remaining Outstanding:</span>
                        <span className={cn("font-mono", remainingBalance > 0 ? "text-amber-600" : "text-emerald-600")}>
                          ₹{Math.max(0, remainingBalance).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation error */}
              <AnimatePresence>
                {validationError && amountReceivedNum > 0 && (
                  <motion.div
                    key="val-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium"
                  >
                    <AlertTriangle className="size-4 shrink-0" />
                    {validationError}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        {!recorded && (
          <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-muted-foreground">
              {selectedBills.length > 0 ? (
                <span>
                  <strong>{selectedBills.length}</strong> bill(s) selected ·{" "}
                  <strong>₹{selectedOutstandingTotal.toFixed(2)}</strong> outstanding
                </span>
              ) : (
                "Select bills above to continue"
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="h-9 text-xs">
                <X className="size-3.5 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRecord}
                disabled={isRecording || !!validationError || selectedBills.length === 0}
                className="h-9 text-xs font-bold bg-primary hover:bg-primary/90"
              >
                {isRecording ? (
                  <>
                    <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> Recording...
                  </>
                ) : (
                  <>
                    <CreditCard className="size-3.5 mr-1.5" /> Record Partial Payment
                    {amountReceivedNum > 0 && ` (₹${amountReceivedNum.toFixed(2)})`}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
