import { useState, useEffect, useMemo } from "react";
import {
  X,
  Receipt,
  Save,
  Printer,
  Calendar,
  Check,
  Plus,
  Trash2,
  Building2,
  CreditCard,
  Wallet,
  AlertCircle,
  User,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";
import { listPaymentAccountsFn, type PaymentAccountRow } from "@/lib/mongodb/serverFns/masters";
import { recordInvoicePaymentFn } from "@/lib/mongodb/serverFns/billing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaymentInModalProps {
  open: boolean;
  onClose: () => void;
  invoices: any[];
  onSuccess?: () => void;
  initialInvoiceNo?: string | undefined;
}

interface SplitLine {
  id: string;
  mode: "UPI" | "Cash" | "Card" | "NetBanking" | "Cheque";
  accountId: string;
  amount: number;
  refNo: string;
}

const STAFF_OPTIONS = [
  "Billing Counter Staff",
  "Jyoti Sahare (Front Desk)",
  "Sneha Kulkarni (Pharmacy)",
  "Dr. Rohit Sharma",
  "Dr. Aisha Nair",
  "Dr. Vikram Rao",
];

export function PaymentInModal({
  open,
  onClose,
  invoices,
  onSuccess,
  initialInvoiceNo,
}: PaymentInModalProps) {
  const [accounts, setAccounts] = useState<PaymentAccountRow[]>([]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState(initialInvoiceNo || "");
  const [receiptDate, setReceiptDate] = useState(todayIST());
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Single payment primary fields (Matches HiTech Add Expense screen)
  const [primaryMode, setPrimaryMode] = useState<"UPI" | "Cash" | "Card" | "NetBanking" | "Cheque">("UPI");
  const [primaryAccountId, setPrimaryAccountId] = useState("");
  const [primaryAmount, setPrimaryAmount] = useState<number | "">("");
  const [primaryRefNo, setPrimaryRefNo] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [collectedBy, setCollectedBy] = useState("Billing Counter Staff");

  // Advanced Split Payment Mode toggle
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { id: "split_1", mode: "UPI", accountId: "", amount: 0, refNo: "" },
  ]);

  // Filter pending / unpaid invoices
  const unpaidInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.status !== "Paid" && inv.status !== "Cancelled" && (inv.balanceDue || 0) > 0
    );
  }, [invoices]);

  const targetInvoice = useMemo(() => {
    return invoices.find((i) => i.invoiceNo === selectedInvoiceNo);
  }, [invoices, selectedInvoiceNo]);

  const invoiceBalance = targetInvoice
    ? targetInvoice.balanceDue !== undefined
      ? targetInvoice.balanceDue
      : targetInvoice.totalAmount
    : 0;

  useEffect(() => {
    if (!open) return;
    setReceiptDate(todayIST());

    listPaymentAccountsFn()
      .then((accs) => {
        setAccounts(accs || []);
        if (accs && accs.length > 0 && accs[0] && !primaryAccountId) {
          setPrimaryAccountId(accs[0]._id);
        }
      })
      .catch((err) => console.error("Failed to load accounts:", err));

    let initialInv = initialInvoiceNo;
    if (!initialInv && unpaidInvoices.length > 0 && unpaidInvoices[0]) {
      initialInv = unpaidInvoices[0].invoiceNo;
    }

    if (initialInv) {
      setSelectedInvoiceNo(initialInv);
      const inv = invoices.find((i) => i.invoiceNo === initialInv);
      if (inv) {
        const bal = inv.balanceDue !== undefined ? inv.balanceDue : inv.totalAmount;
        setPrimaryAmount(bal);
        setReceivedFrom(inv.ownerName || "");
        setSplitLines([
          { id: "split_1", mode: "UPI", accountId: "", amount: bal, refNo: "" },
        ]);
      }
    }
  }, [open, initialInvoiceNo, unpaidInvoices, invoices]);

  const handleInvoiceChange = (invNo: string) => {
    setSelectedInvoiceNo(invNo);
    const inv = invoices.find((i) => i.invoiceNo === invNo);
    if (inv) {
      const bal = inv.balanceDue !== undefined ? inv.balanceDue : inv.totalAmount;
      setPrimaryAmount(bal);
      setReceivedFrom(inv.ownerName || "");
      setSplitLines([
        { id: "split_1", mode: "UPI", accountId: primaryAccountId, amount: bal, refNo: "" },
      ]);
    }
  };

  // Effective total paid
  const effectiveTotalPaid = useMemo(() => {
    if (isSplitMode) {
      return splitLines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    }
    return typeof primaryAmount === "number" ? primaryAmount : parseFloat(String(primaryAmount)) || 0;
  }, [isSplitMode, splitLines, primaryAmount]);

  const remainingBalanceAfterPayment = Math.max(0, invoiceBalance - effectiveTotalPaid);

  const handleAddSplitLine = () => {
    const remaining = Math.max(0, invoiceBalance - effectiveTotalPaid);
    setSplitLines((prev) => [
      ...prev,
      {
        id: `split_${Date.now()}`,
        mode: "Cash",
        accountId: primaryAccountId,
        amount: remaining,
        refNo: "",
      },
    ]);
  };

  const handleRemoveSplitLine = (id: string) => {
    if (splitLines.length <= 1) {
      toast.error("At least one payment line is required");
      return;
    }
    setSplitLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleUpdateSplitLine = (id: string, field: keyof SplitLine, value: any) => {
    setSplitLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const handleSave = async (andPrint = false) => {
    if (!selectedInvoiceNo) {
      toast.error("Please select an invoice to settle.");
      return;
    }
    if (effectiveTotalPaid <= 0) {
      toast.error("Payment amount must be greater than 0.");
      return;
    }
    if (effectiveTotalPaid > invoiceBalance + 0.05) {
      toast.error(`Payment (₹${effectiveTotalPaid}) exceeds invoice due balance (₹${invoiceBalance})`);
      return;
    }

    setSubmitting(true);
    try {
      if (isSplitMode) {
        for (const line of splitLines) {
          if (line.amount > 0) {
            await recordInvoicePaymentFn({
              data: {
                invoiceNo: selectedInvoiceNo,
                amount: line.amount,
                mode: line.mode === "NetBanking" ? "NetBanking" : (line.mode as any),
                trxRef: line.refNo || undefined,
                notes: remarks ? `${remarks} [Received from: ${receivedFrom}]` : `Received from: ${receivedFrom}`,
                recordedBy: collectedBy || "Billing Counter",
              },
            });
          }
        }
      } else {
        await recordInvoicePaymentFn({
          data: {
            invoiceNo: selectedInvoiceNo,
            amount: effectiveTotalPaid,
            mode: primaryMode === "NetBanking" ? "NetBanking" : (primaryMode as any),
            trxRef: primaryRefNo || undefined,
            notes: remarks ? `${remarks} [Received from: ${receivedFrom}]` : `Received from: ${receivedFrom}`,
            recordedBy: collectedBy || "Billing Counter",
          },
        });
      }

      toast.success(`Receipt of ₹${effectiveTotalPaid.toFixed(2)} recorded against ${selectedInvoiceNo}!`);
      
      if (andPrint) {
        window.print();
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("[PaymentInModal] Save failed:", err);
      toast.error(err.message || "Failed to record payment receipt.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 border border-slate-300 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-lg"
        aria-describedby="payment-in-desc"
      >
        {/* Window Title Header matching HiTech Screenshot Frame */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
              <Receipt className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Record Payment In (Receipt)
            </DialogTitle>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <p id="payment-in-desc" className="sr-only">
          Receive and record customer invoice settlements, cash, card, and UPI collections.
        </p>

        {/* Tab Strip & Status Bar */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-[#f8fafc] dark:bg-slate-950 border-t-2 border-primary border-x border-slate-300 dark:border-slate-700 rounded-t text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs -mb-[5px]">
              Receipt Details
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 font-medium">Receipt Status:</span>
            <span className="font-bold text-rose-600 font-mono tracking-wider">UNSAVED</span>
          </div>
        </div>

        {/* Main Form Body */}
        <div className="p-5 space-y-4">
          {/* ═══ 1. Invoice & Client Details Groupbox ═══ */}
          <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-4 pt-5 shadow-xs">
            <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Invoice &amp; Client Details
            </span>

            <div className="space-y-3">
              {/* Row 1: Invoice Selector & Receipt Date */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-8 flex items-center gap-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap min-w-[130px]">
                    Select Invoice to Settle <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex-1">
                    <Select value={selectedInvoiceNo} onValueChange={handleInvoiceChange}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium">
                        <SelectValue placeholder="Choose pending invoice..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {unpaidInvoices.map((inv) => (
                          <SelectItem key={inv.invoiceNo} value={inv.invoiceNo} className="text-xs">
                            <span className="font-bold font-mono">{inv.invoiceNo}</span> — {inv.ownerName} ({inv.petName || "Pet"}) • Due: ₹{(inv.balanceDue || inv.totalAmount).toLocaleString("en-IN")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="md:col-span-4 flex items-center gap-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap min-w-[70px]">
                    Receipt Date
                  </Label>
                  <Input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Clean Desktop Invoice Info Summary Bar */}
              {targetInvoice && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Customer / Pet Parent:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {targetInvoice.ownerName} {targetInvoice.ownerPhone ? `(${targetInvoice.ownerPhone})` : ""}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Patient / Pet:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {targetInvoice.petName} ({targetInvoice.breed || targetInvoice.species || "Canine"})
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Invoice Total:</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      ₹{targetInvoice.totalAmount.toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                    <span className="text-rose-600 font-semibold block text-[11px]">Outstanding Due:</span>
                    <strong className="font-mono text-sm text-rose-600 font-bold">
                      ₹{invoiceBalance.toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ 2. Payment Details Groupbox (Matches Add Expense Screenshot) ═══ */}
          <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-4 pt-5 shadow-xs">
            <div className="flex items-center justify-between absolute -top-2.5 left-3 right-3">
              <span className="bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment Details
              </span>

              {/* Split Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setIsSplitMode(!isSplitMode)}
                className="bg-white dark:bg-slate-900 px-2 text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="size-3" />
                <span>{isSplitMode ? "Switch to Single Mode" : "+ Split Across Multiple Modes"}</span>
              </button>
            </div>

            {!isSplitMode ? (
              /* ── Single Payment Desktop 2-Column Grid (Directly matching HiTech Add Expense) ── */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 items-start">
                {/* Left Column */}
                <div className="space-y-3">
                  {/* Pay Mode * */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Pay Mode <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8">
                      <Select
                        value={primaryMode}
                        onValueChange={(val: any) => setPrimaryMode(val)}
                      >
                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UPI">UPI / QR Code (GPay, PhonePe, Paytm)</SelectItem>
                          <SelectItem value="Cash">Cash (Currency)</SelectItem>
                          <SelectItem value="Card">Card (POS Swipe Machine)</SelectItem>
                          <SelectItem value="NetBanking">NetBanking / Bank Transfer</SelectItem>
                          <SelectItem value="Cheque">Cheque / Demand Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Amount Received * with Iconic Blue ₹ Box */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Amount <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8 flex items-center">
                      <div className="flex h-7 items-center justify-center px-2.5 bg-[#1976d2] text-white text-xs font-bold rounded-l">
                        ₹
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max={invoiceBalance}
                        step="0.01"
                        value={primaryAmount}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          setPrimaryAmount(val);
                        }}
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 rounded-l-none font-bold text-slate-900 dark:text-slate-100"
                        placeholder="0.00"
                      />
                      {targetInvoice && (
                        <button
                          type="button"
                          onClick={() => setPrimaryAmount(invoiceBalance)}
                          className="ml-1.5 h-7 px-2 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded hover:bg-blue-100 whitespace-nowrap"
                        >
                          Full Due
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Received From */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Received From
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={receivedFrom}
                        onChange={(e) => setReceivedFrom(e.target.value)}
                        placeholder="e.g. Ayush Sahare"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  {/* Remarks / Reference Notes */}
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium pt-1.5">
                      Remarks
                    </Label>
                    <div className="col-span-8">
                      <Textarea
                        rows={2}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Cleared via counter GPay QR"
                        className="min-h-[52px] text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  {/* Deposit Account */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Deposit Account
                    </Label>
                    <div className="col-span-8">
                      <Select value={primaryAccountId} onValueChange={setPrimaryAccountId}>
                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                          <SelectValue placeholder="Select Deposit Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a._id} value={a._id} className="text-xs">
                              {a.name} ({a.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Payment Ref. No / Trx ID */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Payment Ref. No.
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={primaryRefNo}
                        onChange={(e) => setPrimaryRefNo(e.target.value)}
                        placeholder="e.g. UPI-923849283 / CHQ-00124"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>

                  {/* Collected By * */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Collected By <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8">
                      <Select value={collectedBy} onValueChange={setCollectedBy}>
                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Balance Settlement Snapshot Card */}
                  <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Invoice Balance Due:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{invoiceBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 font-semibold">
                      <span>Amount Received Now:</span>
                      <span className="font-mono font-bold">
                        ₹{effectiveTotalPaid.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Remaining After Receipt:
                      </span>
                      <span
                        className={cn(
                          "font-mono font-bold",
                          remainingBalanceAfterPayment === 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        ₹{remainingBalanceAfterPayment.toFixed(2)}
                        {remainingBalanceAfterPayment === 0 ? " (Fully Cleared)" : " (Partial)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Multi-Mode Split Payment Desktop Table ── */
              <div className="space-y-3">
                <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0066cc] text-white font-semibold">
                      <tr>
                        <th className="p-2 w-10 text-center">#</th>
                        <th className="p-2 w-44">Mode</th>
                        <th className="p-2">Deposit Account</th>
                        <th className="p-2 w-36">Amount (₹)</th>
                        <th className="p-2">Ref. / Cheque No.</th>
                        <th className="p-2 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {splitLines.map((line, idx) => (
                        <tr key={line.id}>
                          <td className="p-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-1.5">
                            <Select
                              value={line.mode}
                              onValueChange={(val: any) => handleUpdateSplitLine(line.id, "mode", val)}
                            >
                              <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UPI">UPI / QR Code</SelectItem>
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="Card">Card POS</SelectItem>
                                <SelectItem value="NetBanking">NetBanking</SelectItem>
                                <SelectItem value="Cheque">Cheque</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1.5">
                            <Select
                              value={line.accountId || primaryAccountId}
                              onValueChange={(val) => handleUpdateSplitLine(line.id, "accountId", val)}
                            >
                              <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300">
                                <SelectValue placeholder="Deposit Account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((a) => (
                                  <SelectItem key={a._id} value={a._id} className="text-xs">
                                    {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1.5">
                            <div className="flex items-center">
                              <div className="flex h-7 items-center justify-center px-2 bg-[#1976d2] text-white text-[11px] font-bold rounded-l">
                                ₹
                              </div>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.amount || ""}
                                onChange={(e) =>
                                  handleUpdateSplitLine(
                                    line.id,
                                    "amount",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 rounded-l-none font-bold"
                              />
                            </div>
                          </td>
                          <td className="p-1.5">
                            <Input
                              value={line.refNo}
                              onChange={(e) => handleUpdateSplitLine(line.id, "refNo", e.target.value)}
                              placeholder="Trx / Cheque Ref"
                              className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 font-mono"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveSplitLine(line.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-colors"
                              title="Remove Line"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddSplitLine}
                    className="h-7 text-xs gap-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="size-3" /> + Add Another Mode
                  </Button>

                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-500">
                      Total Split Entered: <strong>₹{effectiveTotalPaid.toFixed(2)}</strong>
                    </span>
                    <span
                      className={cn(
                        "font-bold px-2 py-0.5 rounded text-[11px]",
                        remainingBalanceAfterPayment === 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {remainingBalanceAfterPayment === 0
                        ? "Balanced ✓"
                        : `Pending ₹${remainingBalanceAfterPayment.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Bottom Action Bar matching HiTech Footer ═══ */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between select-none">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="h-8 text-xs border-slate-300 hover:bg-slate-100"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={submitting || effectiveTotalPaid <= 0}
              className="flex items-center gap-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white px-4 py-1.5 rounded text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Printer className="size-3.5" />
              <span>Save &amp; Print</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={submitting || effectiveTotalPaid <= 0}
              className="flex items-center gap-1.5 bg-[#0066cc] hover:bg-[#0055b3] text-white px-5 py-1.5 rounded text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="size-3.5" />
              <span>Save Receipt (₹{effectiveTotalPaid.toLocaleString("en-IN")})</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
