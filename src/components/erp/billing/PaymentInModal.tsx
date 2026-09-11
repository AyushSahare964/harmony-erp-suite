import { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Check,
  User,
  AlertCircle,
  Receipt,
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
import { todayIST } from "@/lib/utils/dateUtils";
import { listPaymentAccountsFn } from "@/lib/mongodb/serverFns/masters";
import { recordInvoicePaymentFn } from "@/lib/mongodb/serverFns/billing";
import { toast } from "sonner";

interface PaymentInModalProps {
  open: boolean;
  onClose: () => void;
  invoices: any[];
  onSuccess?: () => void;
  initialInvoiceNo?: string;
}

export function PaymentInModal({
  open,
  onClose,
  invoices,
  onSuccess,
  initialInvoiceNo,
}: PaymentInModalProps) {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState(initialInvoiceNo || "");
  const [receiptDate, setReceiptDate] = useState(todayIST());
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    {
      id: "line_1",
      mode: "UPI",
      accountId: "",
      amount: 0,
      referenceNo: "",
      chequeDate: "",
    },
  ]);

  // Filter only unpaid/partial invoices
  const unpaidInvoices = invoices.filter(
    (inv) => inv.status !== "Paid" && inv.status !== "Cancelled" && (inv.balanceDue || 0) > 0
  );

  useEffect(() => {
    if (!open) return;
    listPaymentAccountsFn()
      .then(setAccounts)
      .catch((err) => console.error("Failed to load accounts:", err));

    if (initialInvoiceNo) {
      setSelectedInvoiceNo(initialInvoiceNo);
      const target = invoices.find((i) => i.invoiceNo === initialInvoiceNo);
      if (target) {
        setPaymentLines([
          {
            id: "line_1",
            mode: "UPI",
            accountId: "",
            amount: target.balanceDue || target.totalAmount,
            referenceNo: "",
            chequeDate: "",
          },
        ]);
      }
    } else if (unpaidInvoices.length > 0 && !selectedInvoiceNo) {
      setSelectedInvoiceNo(unpaidInvoices[0].invoiceNo);
      setPaymentLines([
        {
          id: "line_1",
          mode: "UPI",
          accountId: "",
          amount: unpaidInvoices[0].balanceDue || unpaidInvoices[0].totalAmount,
          referenceNo: "",
          chequeDate: "",
        },
      ]);
    }
  }, [open, initialInvoiceNo, invoices]);

  const targetInvoice = invoices.find((i) => i.invoiceNo === selectedInvoiceNo);
  const invoiceBalance = targetInvoice ? targetInvoice.balanceDue || targetInvoice.totalAmount : 0;
  const linesTotal = paymentLines.reduce((s, l) => s + (l.amount || 0), 0);
  const diff = invoiceBalance - linesTotal;

  const handleInvoiceChange = (invNo: string) => {
    setSelectedInvoiceNo(invNo);
    const inv = invoices.find((i) => i.invoiceNo === invNo);
    if (inv) {
      setPaymentLines([
        {
          id: "line_1",
          mode: "UPI",
          accountId: "",
          amount: inv.balanceDue || inv.totalAmount,
          referenceNo: "",
          chequeDate: "",
        },
      ]);
    }
  };

  const handleSave = async () => {
    if (!selectedInvoiceNo) {
      toast.error("Please select an invoice");
      return;
    }
    if (linesTotal <= 0) {
      toast.error("Payment amount must be greater than 0");
      return;
    }
    if (linesTotal > invoiceBalance + 0.01) {
      toast.error(`Payment cannot exceed invoice balance (₹${invoiceBalance.toLocaleString("en-IN")})`);
      return;
    }

    setSubmitting(true);
    try {
      // Record payment against target invoice
      for (const line of paymentLines) {
        if (line.amount > 0) {
          await recordInvoicePaymentFn({
            data: {
              invoiceNo: selectedInvoiceNo,
              amount: line.amount,
              mode: line.mode === "BANK_TRANSFER" ? "NetBanking" : (line.mode as any),
              trxRef: line.referenceNo || undefined,
              notes: remarks || undefined,
              recordedBy: "Billing Counter",
            },
          });
        }
      }

      toast.success(`Payment of ₹${linesTotal.toLocaleString("en-IN")} recorded!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Payment In recording failed:", err);
      toast.error(err.message || "Failed to record receipt");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Receipt className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Record Payment In (Receipt)</h2>
              <p className="text-xs text-muted-foreground">Receive settlement from pet owner against invoice dues</p>
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
          <div className="space-y-1.5">
            <Label htmlFor="pay-inv">Select Invoice to Settle *</Label>
            <Select value={selectedInvoiceNo} onValueChange={handleInvoiceChange}>
              <SelectTrigger id="pay-inv">
                <SelectValue placeholder="Choose pending invoice..." />
              </SelectTrigger>
              <SelectContent>
                {unpaidInvoices.map((inv) => (
                  <SelectItem key={inv.invoiceNo} value={inv.invoiceNo}>
                    {inv.invoiceNo} — {inv.ownerName} ({inv.petName}) • Due: ₹{(inv.balanceDue || inv.totalAmount).toLocaleString("en-IN")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetInvoice && (
            <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold text-foreground">{targetInvoice.ownerName} ({targetInvoice.ownerPhone || "—"})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient / Pet:</span>
                <span className="font-semibold text-foreground">{targetInvoice.petName} ({targetInvoice.breed || targetInvoice.species})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Total:</span>
                <span className="font-mono text-foreground">₹{targetInvoice.totalAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-bold">
                <span className="text-rose-600">Outstanding Balance Due:</span>
                <span className="font-mono text-rose-600 text-sm">₹{invoiceBalance.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rcpt-date">Receipt Date</Label>
            <Input
              id="rcpt-date"
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </div>

          {/* Split Payment Input */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Payment Breakdown (Modes &amp; Accounts)
            </Label>
            <SplitPaymentInput
              total={invoiceBalance}
              lines={paymentLines}
              onChange={setPaymentLines}
              accounts={accounts}
              requireExactMatch={false}
              defaultMode="UPI"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rcpt-notes">Receipt Remarks / Reference</Label>
            <Input
              id="rcpt-notes"
              placeholder="e.g. Cleared via GPAY QR / HDFC swipe"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={submitting || linesTotal <= 0}
            className="gap-1.5"
          >
            <Check className="size-4" /> Save Receipt (₹{linesTotal.toLocaleString("en-IN")})
          </Button>
        </div>
      </div>
    </div>
  );
}
