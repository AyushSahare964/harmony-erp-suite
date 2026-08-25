import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Receipt,
  TrendingUp,
  CreditCard,
  Building2,
  DollarSign,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Layers,
  PieChart as PieIcon,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { KpiCard } from "@/components/erp/KpiCard";
import { ModuleFlashcard } from "@/components/erp/Flashcard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listInvoicesFn, recordInvoicePaymentFn } from "@/lib/mongodb/serverFns/billing";
import { getJournalsFn, createJournalFn } from "@/lib/mongodb/serverFns/finance";

interface Props {
  role: any;
}

const REVENUE_CATEGORIES = [
  { name: "Consultations", value: 48500, color: "#3b82f6" },
  { name: "Pharmacy & Vaccines", value: 38200, color: "#10b981" },
  { name: "Laboratory", value: 16400, color: "#8b5cf6" },
  { name: "Pet Boarding", value: 12500, color: "#f59e0b" },
  { name: "Hydrotherapy/Swim", value: 8900, color: "#06b6d4" },
  { name: "Food & Nutrition", value: 14200, color: "#ec4899" },
];

const PAYMENT_MODES_DATA = [
  { mode: "UPI / QR", amount: 72400, count: 32 },
  { mode: "Debit / Credit Card", amount: 38500, count: 14 },
  { mode: "Cash POS", amount: 21800, count: 18 },
  { mode: "NetBanking / Bank Transfer", amount: 6000, count: 2 },
];

export function AccountantDashboardView({ role }: Props) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick Action Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Expense Form
  const [expenseCategory, setExpenseCategory] = useState("Medical Consumables & Surgical Supplies");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaymentMode, setExpensePaymentMode] = useState("Bank Transfer");
  const [expensePayee, setExpensePayee] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");

  // Payment Settle Form
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMode, setSettleMode] = useState("UPI");
  const [settleRef, setSettleRef] = useState("");

  useEffect(() => {
    void loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const [invList, trxList] = await Promise.all([
        listInvoicesFn().catch(() => []),
        getJournalsFn().catch(() => []),
      ]);
      setInvoices(invList || []);
      setTransactions(trxList || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const outstandingInvoices = useMemo(() => {
    return invoices.filter((i) => (Number(i.balanceDue) || 0) > 0);
  }, [invoices]);

  const totalOutstandingAR = useMemo(() => {
    return outstandingInvoices.reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);
  }, [outstandingInvoices]);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }

    try {
      await createJournalFn({
        data: {
          voucherType: "Journal Entry",
          date: new Date().toISOString().slice(0, 10),
          narration: `Payment for ${expenseCategory} to ${expensePayee || "Vendor"}. Notes: ${expenseNotes || "General clinic expense"}`,
          isOpeningEntry: false,
          isAccrual: false,
          lines: [
            {
              accountCode: "5300",
              accountName: `Operating Expense — ${expenseCategory}`,
              debit: amt,
              credit: 0,
            },
            {
              accountCode: expensePaymentMode === "Cash" ? "1000" : "1200",
              accountName: expensePaymentMode === "Cash" ? "Cash on Hand" : "Bank — HDFC Current",
              debit: 0,
              credit: amt,
            },
          ],
        },
      });

      toast.success(`Recorded expense voucher of ₹${amt.toLocaleString("en-IN")}`);
      setShowExpenseModal(false);
      setExpenseAmount("");
      setExpensePayee("");
      setExpenseNotes("");
      await loadFinanceData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record expense");
    }
  };

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceNo) {
      toast.error("Please select an invoice to settle");
      return;
    }
    const amt = Number(settleAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter valid payment amount");
      return;
    }

    try {
      await recordInvoicePaymentFn({
        data: {
          invoiceNo: selectedInvoiceNo,
          amountPaid: amt,
          paymentMode: settleMode,
          transactionRef: settleRef || undefined,
        },
      });

      toast.success(`Settled ₹${amt.toLocaleString("en-IN")} on invoice ${selectedInvoiceNo}`);
      setShowPaymentModal(false);
      setSelectedInvoiceNo("");
      setSettleAmount("");
      setSettleRef("");
      await loadFinanceData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to settle payment");
    }
  };

  return (
    <div className="space-y-7">
      {/* ── Accountant Header & Command Strip ────────────────────────────────── */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-emerald-500/10 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
            <Wallet className="size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">Finance, Ledger &amp; Revenue Analytics</h2>
              <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                FY 2026-27 Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live double-entry postings, AR settlements, cash flow monitoring, and GSTR compliance.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowPaymentModal(true)}
            className="h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <CreditCard className="size-3.5" /> Settle AR Payment
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowExpenseModal(true)}
            className="h-9 gap-1.5 text-xs font-semibold bg-card hover:bg-muted"
          >
            <Plus className="size-3.5 text-destructive" /> Record Expense Voucher
          </Button>
        </div>
      </div>

      {/* ── Finance KPI Stats Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {role.kpis.map((k: any, idx: number) => (
          <KpiCard key={k.label} kpi={k} index={idx} />
        ))}
      </div>

      {/* ── Visual Financial Analytics Charts ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Revenue Breakdown */}
        <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Revenue by Service Line (MTD)</h3>
              <p className="text-[11px] text-muted-foreground">Itemized revenue contribution across clinical and commercial departments</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
              Total ₹1,38,700
            </Badge>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_CATEGORIES} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Revenue"]}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {REVENUE_CATEGORIES.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collections Breakdown by Payment Mode */}
        <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Collections by Payment Mode</h3>
              <p className="text-[11px] text-muted-foreground">Today&apos;s settlement distribution</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">₹1,38,700</span>
          </div>

          <div className="space-y-3 pt-2">
            {PAYMENT_MODES_DATA.map((item) => (
              <div key={item.mode} className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{item.mode}</span>
                  <span className="font-mono font-bold text-foreground">₹{item.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{item.count} settlements</span>
                  <span className="font-mono">{((item.amount / 138700) * 100).toFixed(1)}% of total</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(item.amount / 138700) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Outstanding Accounts Receivable (AR Aging Queue) ────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold text-xs">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Outstanding Accounts Receivable (AR)</h3>
              <p className="text-[11px] text-muted-foreground">Unpaid invoices requiring payment follow-up or write-off</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-muted-foreground">Total Pending: </span>
            <span className="text-sm font-mono font-bold text-destructive">
              ₹{totalOutstandingAR.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Invoices List */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b border-border text-left font-bold text-[11px] uppercase">
                <th className="px-3 py-2.5">Invoice No.</th>
                <th className="px-3 py-2.5">Patient / Pet</th>
                <th className="px-3 py-2.5">Parent (Owner)</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5 text-right">Total (₹)</th>
                <th className="px-3 py-2.5 text-right">Paid (₹)</th>
                <th className="px-3 py-2.5 text-right">Balance Due (₹)</th>
                <th className="px-3 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {outstandingInvoices.slice(0, 5).map((inv) => (
                <tr key={inv.invoiceNo} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-bold text-foreground">{inv.invoiceNo}</td>
                  <td className="px-3 py-2.5 font-medium">{inv.petName || "Patient"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{inv.ownerName} ({inv.ownerPhone})</td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{inv.date || "2026-08-25"}</td>
                  <td className="px-3 py-2.5 text-right font-mono">₹{Number(inv.totalAmount || 0).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-600">₹{Number(inv.amountPaid || 0).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-destructive">₹{Number(inv.balanceDue || 0).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedInvoiceNo(inv.invoiceNo);
                        setSettleAmount(String(inv.balanceDue || 0));
                        setShowPaymentModal(true);
                      }}
                      className="h-6 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Settle →
                    </Button>
                  </td>
                </tr>
              ))}

              {outstandingInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                    All patient accounts are settled in full. No outstanding balances due!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Finance Role Modules Matrix ────────────────────────────────────────── */}
      {role.blocks.map((block: any, bIdx: number) => (
        <motion.section
          key={block.category}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: bIdx * 0.08, ease: "easeOut" }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3">
            <h2 className="section-label">{block.category}</h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{block.cards.length} modules</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {block.cards.map((card: any, cIdx: number) => (
              <ModuleFlashcard key={card.module + card.title} card={card} index={cIdx} />
            ))}
          </div>
        </motion.section>
      ))}

      {/* ── Record Expense Modal ──────────────────────────────────────────────── */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Plus className="size-4 text-destructive" /> Record Operating Expense Voucher
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRecordExpense} className="space-y-3.5 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Expense Category</Label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger className="h-8 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Medical Consumables & Surgical Supplies">Medical Consumables &amp; Surgical Supplies</SelectItem>
                  <SelectItem value="Pet Diets & Nutritional Stock Purchase">Pet Diets &amp; Nutritional Stock Purchase</SelectItem>
                  <SelectItem value="Clinic Rent & Facility Maintenance">Clinic Rent &amp; Facility Maintenance</SelectItem>
                  <SelectItem value="Electricity & High-Power HVAC">Electricity &amp; High-Power HVAC</SelectItem>
                  <SelectItem value="Lab Reagents & Pathology Outsource">Lab Reagents &amp; Pathology Outsource</SelectItem>
                  <SelectItem value="Staff Refreshments & Front-Desk Supplies">Staff Refreshments &amp; Front-Desk Supplies</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Amount (₹) *</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="e.g. 4500"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                  className="h-8 text-xs bg-card font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Payment Method</Label>
                <Select value={expensePaymentMode} onValueChange={setExpensePaymentMode}>
                  <SelectTrigger className="h-8 text-xs bg-card font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">HDFC Operating Bank</SelectItem>
                    <SelectItem value="UPI">Corporate UPI / Scanner</SelectItem>
                    <SelectItem value="Cash">Petty Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Payee / Vendor Name</Label>
              <Input
                placeholder="e.g. Zydus Animal Health / Landlord"
                value={expensePayee}
                onChange={(e) => setExpensePayee(e.target.value)}
                className="h-8 text-xs bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Invoice / Reference Notes</Label>
              <Input
                placeholder="Bill number, invoice reference, or check memo"
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="h-8 text-xs bg-card"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowExpenseModal(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="h-8 text-xs font-bold bg-destructive hover:bg-destructive/90 text-white">
                Post Expense Entry →
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── AR Settlement Modal ──────────────────────────────────────────────── */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <CreditCard className="size-4 text-emerald-600" /> Settle Accounts Receivable (AR)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSettlePayment} className="space-y-3.5 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Select Outstanding Invoice</Label>
              <Select value={selectedInvoiceNo} onValueChange={(val) => {
                setSelectedInvoiceNo(val);
                const found = invoices.find((i) => i.invoiceNo === val);
                if (found) setSettleAmount(String(found.balanceDue || 0));
              }}>
                <SelectTrigger className="h-8 text-xs bg-card">
                  <SelectValue placeholder="Select invoice..." />
                </SelectTrigger>
                <SelectContent>
                  {outstandingInvoices.map((i) => (
                    <SelectItem key={i.invoiceNo} value={i.invoiceNo}>
                      {i.invoiceNo} — {i.petName} ({i.ownerName}) [Due: ₹{i.balanceDue}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Amount to Settle (₹) *</Label>
                <Input
                  type="number"
                  step="1"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  className="h-8 text-xs bg-card font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Payment Mode</Label>
                <Select value={settleMode} onValueChange={setSettleMode}>
                  <SelectTrigger className="h-8 text-xs bg-card font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Card">Debit / Credit Card</SelectItem>
                    <SelectItem value="Cash">Cash Receipt</SelectItem>
                    <SelectItem value="NetBanking">NetBanking / NEFT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Transaction / Reference ID</Label>
              <Input
                placeholder="e.g. UPI-992384728"
                value={settleRef}
                onChange={(e) => setSettleRef(e.target.value)}
                className="h-8 text-xs bg-card font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                Record Payment Settlement →
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
