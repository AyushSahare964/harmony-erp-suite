import { useState, useEffect } from "react";
import { X, Receipt, Save } from "lucide-react";
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
import { todayIST } from "@/lib/utils/dateUtils";
import {
  listExpenseCategoriesFn,
  listPaymentAccountsFn,
  type ExpenseCategoryRow,
} from "@/lib/mongodb/serverFns/masters";
import { createExpenseFn } from "@/lib/mongodb/serverFns/expenses";
import { toast } from "sonner";

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExpenseFormModal({ open, onClose, onSuccess }: ExpenseFormModalProps) {
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form states matching HiTech "Add Expense" screenshot
  const [expenseDate, setExpenseDate] = useState(todayIST());
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paidTo, setPaidTo] = useState("");
  const [remarks, setRemarks] = useState("");

  const [payMode, setPayMode] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "CHEQUE">("CASH");
  const [paymentRefNo, setPaymentRefNo] = useState("");
  const [paidBy, setPaidBy] = useState("Dr. Rohit Sharma");

  useEffect(() => {
    if (!open) return;
    setExpenseDate(todayIST());
    Promise.all([listExpenseCategoriesFn(), listPaymentAccountsFn()])
      .then(([cats, accs]) => {
        setCategories(cats || []);
        setAccounts(accs || []);
        if (cats && cats.length > 0 && !categoryId && cats[0]) {
          setCategoryId(cats[0]._id);
        }
      })
      .catch((err) => {
        console.error("Failed to load expense categories:", err);
      });
  }, [open]);

  const handleSave = async () => {
    if (!categoryId) {
      toast.error("Please select an Expense Type.");
      return;
    }
    const numericAmount = typeof amount === "number" ? amount : parseFloat(String(amount));
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }
    if (!paidTo.trim()) {
      toast.error("Please specify Paid To.");
      return;
    }
    if (!paidBy.trim()) {
      toast.error("Please specify Paid By.");
      return;
    }

    setSubmitting(true);
    try {
      // Find appropriate account id or fallback to cash/bank
      let accountId = "cash";
      let accountName = "Cash Drawer";
      if (payMode !== "CASH") {
        const bankAcc = accounts.find((a) => a.type === "BANK" || a._id !== "cash");
        if (bankAcc) {
          accountId = bankAcc._id;
          accountName = bankAcc.name || "Bank Account";
        } else {
          accountId = "bank_default";
          accountName = "Primary Operating Bank Account";
        }
      }

      const fullDescription = [
        remarks.trim(),
        paidBy.trim() ? `[Paid by: ${paidBy.trim()}]` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const res = await createExpenseFn({
        data: {
          expenseDate,
          categoryId,
          paidTo: paidTo.trim(),
          billRefNo: paymentRefNo.trim() || undefined,
          totalAmount: numericAmount,
          description: fullDescription || undefined,
          paymentLines: [
            {
              mode: payMode,
              accountId,
              accountName,
              amount: numericAmount,
              referenceNo: paymentRefNo.trim() || undefined,
              chequeDate: payMode === "CHEQUE" ? expenseDate : undefined,
            },
          ],
        },
      });

      toast.success(`Expense saved successfully! Voucher: ${res.voucherNo}`);
      onSuccess?.();
      onClose();

      // Reset
      setAmount("");
      setPaidTo("");
      setRemarks("");
      setPaymentRefNo("");
    } catch (err: any) {
      console.error("[ExpenseFormModal] Save error:", err);
      toast.error(err.message || "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 border border-slate-300 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-lg"
        aria-describedby="add-expense-desc"
      >
        {/* Top Window Header matching HiTech Screenshot Frame */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
              <Receipt className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Add Expense
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

        <p id="add-expense-desc" className="sr-only">
          Record operational, utility, clinical maintenance, or staff expense payments.
        </p>

        <div className="p-5 space-y-4">
          {/* Expense Details Groupbox matching Screenshot */}
          <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-4 pt-5 shadow-xs">
            <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Expense Details
            </span>

            {/* 2-Column Grid Layout matching screenshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 items-start">
              {/* ═══ LEFT COLUMN: Date, Expense Type, Amount, Paid To, Remarks ═══ */}
              <div className="space-y-3">
                {/* Date */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Date
                  </Label>
                  <div className="col-span-8">
                    <Input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>

                {/* Expense Type * */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Expense Type <span className="text-rose-500">*</span>
                  </Label>
                  <div className="col-span-8">
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium">
                        <SelectValue placeholder="Select Expense Type" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {categories.map((c) => (
                          <SelectItem key={c._id} value={c._id} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Amount * with Blue ₹ Box */}
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
                      step="any"
                      value={amount || ""}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || "")}
                      placeholder=""
                      className="h-7 rounded-l-none text-xs font-mono font-bold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Paid To * */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Paid To <span className="text-rose-500">*</span>
                  </Label>
                  <div className="col-span-8">
                    <Input
                      value={paidTo}
                      onChange={(e) => setPaidTo(e.target.value)}
                      placeholder=""
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="grid grid-cols-12 gap-2 items-start">
                  <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium pt-1">
                    Remarks
                  </Label>
                  <div className="col-span-8">
                    <Textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder=""
                      className="text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 min-h-[60px]"
                    />
                  </div>
                </div>
              </div>

              {/* ═══ RIGHT COLUMN: Pay Mode, Payment Ref. No., Paid By ═══ */}
              <div className="space-y-3">
                {/* Pay Mode * */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Pay Mode <span className="text-rose-500">*</span>
                  </Label>
                  <div className="col-span-8">
                    <Select value={payMode} onValueChange={(v: any) => setPayMode(v)}>
                      <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH" className="text-xs">Cash</SelectItem>
                        <SelectItem value="UPI" className="text-xs">UPI / QR</SelectItem>
                        <SelectItem value="BANK_TRANSFER" className="text-xs">Bank Transfer / NEFT</SelectItem>
                        <SelectItem value="CARD" className="text-xs">Debit / Credit Card</SelectItem>
                        <SelectItem value="CHEQUE" className="text-xs">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Payment Ref. No. */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Payment Ref. No.
                  </Label>
                  <div className="col-span-8">
                    <Input
                      value={paymentRefNo}
                      onChange={(e) => setPaymentRefNo(e.target.value)}
                      placeholder=""
                      disabled={payMode === "CASH"}
                      className={`h-7 text-xs border-slate-300 dark:border-slate-700 font-mono ${
                        payMode === "CASH"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          : "bg-white dark:bg-slate-950"
                      }`}
                    />
                  </div>
                </div>

                {/* Paid By * */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Paid By <span className="text-rose-500">*</span>
                  </Label>
                  <div className="col-span-8">
                    <Input
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      placeholder="Dr. Rohit Sharma"
                      className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footer: Save Button */}
          <div className="flex items-center justify-end pt-1">
            <Button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="h-9 px-6 gap-2 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs shadow-sm"
            >
              <Save className="size-3.5" />
              <span>{submitting ? "Saving..." : "Save"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
