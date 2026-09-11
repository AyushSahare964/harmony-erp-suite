import { useState, useEffect } from "react";
import { X, Receipt, Check, AlertCircle, Plus } from "lucide-react";
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
import { SplitPaymentInput, type PaymentLine, type PaymentAccount } from "@/components/erp/shared/SplitPaymentInput";
import { todayIST } from "@/lib/utils/dateUtils";
import { listExpenseCategoriesFn, listPaymentAccountsFn, type ExpenseCategoryRow } from "@/lib/mongodb/serverFns/masters";
import { createExpenseFn } from "@/lib/mongodb/serverFns/expenses";
import { toast } from "sonner";

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExpenseFormModal({ open, onClose, onSuccess }: ExpenseFormModalProps) {
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [expenseDate, setExpenseDate] = useState(todayIST());
  const [categoryId, setCategoryId] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [billRefNo, setBillRefNo] = useState("");
  const [totalAmount, setTotalAmount] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [showGst, setShowGst] = useState(false);
  const [gstAmount, setGstAmount] = useState<number | "">("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    {
      id: "line_1",
      mode: "CASH",
      accountId: "cash",
      amount: 0,
      referenceNo: "",
      chequeDate: "",
    },
  ]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([listExpenseCategoriesFn(), listPaymentAccountsFn()])
      .then(([cats, accs]) => {
        setCategories(cats);
        setAccounts(accs);
        if (cats.length > 0 && !categoryId) {
          setCategoryId(cats[0]._id);
        }
      })
      .catch((err) => {
        console.error("Failed to load expense masters:", err);
        toast.error("Failed to load categories or accounts");
      })
      .finally(() => setLoading(false));
  }, [open]);

  // When totalAmount changes, auto-fill first payment line if it's the only one and was 0 or matched previous total
  const handleTotalChange = (val: number | "") => {
    setTotalAmount(val);
    if (typeof val === "number" && val > 0 && paymentLines.length === 1) {
      setPaymentLines([{ ...paymentLines[0], amount: val }]);
    }
  };

  const selectedCategory = categories.find((c) => c._id === categoryId);
  const numericTotal = typeof totalAmount === "number" ? totalAmount : 0;
  const linesTotal = paymentLines.reduce((s, l) => s + (l.amount || 0), 0);
  const diff = numericTotal - linesTotal;

  const handleSave = async (saveAndNew = false) => {
    if (!categoryId) {
      toast.error("Please select an expense category");
      return;
    }
    if (!numericTotal || numericTotal <= 0) {
      toast.error("Total amount must be greater than 0");
      return;
    }
    if (Math.abs(diff) > 0.01) {
      toast.error(`Payment breakdown does not match total amount (difference: ₹${diff.toFixed(2)})`);
      return;
    }
    for (const l of paymentLines) {
      if (l.mode === "CHEQUE" && !l.chequeDate) {
        toast.error("Cheque date is required for cheque payments");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await createExpenseFn({
        data: {
          expenseDate,
          categoryId,
          paidTo: paidTo.trim() || undefined,
          billRefNo: billRefNo.trim() || undefined,
          totalAmount: numericTotal,
          gstAmount: typeof gstAmount === "number" ? gstAmount : undefined,
          vendorGstin: vendorGstin.trim() || undefined,
          description: description.trim() || undefined,
          attachmentUrl: attachmentUrl.trim() || undefined,
          paymentLines: paymentLines.map((l) => {
            const acc = accounts.find((a) => a._id === l.accountId);
            return {
              mode: l.mode,
              accountId: l.accountId,
              accountName: l.mode === "CASH" ? "Cash" : acc?.name || "Bank Account",
              amount: l.amount,
              referenceNo: l.referenceNo || undefined,
              chequeDate: l.chequeDate || undefined,
            };
          }),
        },
      });

      toast.success(`Expense saved! Voucher: ${res.voucherNo}`);
      onSuccess?.();

      if (saveAndNew) {
        setPaidTo("");
        setBillRefNo("");
        setTotalAmount("");
        setDescription("");
        setGstAmount("");
        setVendorGstin("");
        setAttachmentUrl("");
        setPaymentLines([
          {
            id: Math.random().toString(36).slice(2),
            mode: "CASH",
            accountId: "cash",
            amount: 0,
            referenceNo: "",
            chequeDate: "",
          },
        ]);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error("Save expense failed:", err);
      toast.error(err.message || "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Record New Expense</h2>
              <p className="text-xs text-muted-foreground">Post operational, utility, or clinic expenses with split payments</p>
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
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading masters...</div>
          ) : (
            <>
              {/* Row 1: Date & Category */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-date">Expense Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exp-cat">Category *</Label>
                    {selectedCategory && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {selectedCategory.nature}
                      </span>
                    )}
                  </div>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="exp-cat">
                      <SelectValue placeholder="Select expense category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Paid To & Total Amount */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-paid-to">Paid To / Beneficiary</Label>
                  <Input
                    id="exp-paid-to"
                    placeholder="e.g. Adani Electricity, Landlord, Dr. Sharma"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="exp-total">Total Amount (₹) *</Label>
                  <Input
                    id="exp-total"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={(e) => handleTotalChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className="text-base font-semibold"
                  />
                </div>
              </div>

              {/* Row 3: Bill Reference & Description */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-ref">Bill / Invoice Reference No.</Label>
                  <Input
                    id="exp-ref"
                    placeholder="e.g. INV-2026-0881"
                    value={billRefNo}
                    onChange={(e) => setBillRefNo(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="exp-desc">Remarks / Description</Label>
                  <Input
                    id="exp-desc"
                    placeholder="Brief description of expense..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Payment Allocation (SplitPaymentInput) */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment Mode &amp; Account Breakdown
                </Label>
                <SplitPaymentInput
                  total={numericTotal}
                  lines={paymentLines}
                  onChange={setPaymentLines}
                  accounts={accounts}
                  requireExactMatch={true}
                />
              </div>

              {/* Optional GST / Vendor Tax Info */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
                <button
                  type="button"
                  onClick={() => setShowGst(!showGst)}
                  className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>GST &amp; Tax Details (Optional)</span>
                  <span>{showGst ? "− Hide" : "+ Add"}</span>
                </button>
                {showGst && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 animate-in fade-in">
                    <div className="space-y-1">
                      <Label htmlFor="exp-gst" className="text-xs">GST Included (₹)</Label>
                      <Input
                        id="exp-gst"
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={gstAmount}
                        onChange={(e) => setGstAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="exp-gstin" className="text-xs">Vendor GSTIN</Label>
                      <Input
                        id="exp-gstin"
                        placeholder="27AAAAA0000A1Z5"
                        value={vendorGstin}
                        onChange={(e) => setVendorGstin(e.target.value)}
                        className="h-8 text-xs uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={submitting || loading || Math.abs(diff) > 0.01}
            >
              Save &amp; New
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={submitting || loading || Math.abs(diff) > 0.01}
              className="gap-1.5"
            >
              <Check className="size-4" /> Save Expense
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
