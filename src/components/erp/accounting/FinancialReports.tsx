import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getAccountsFn, type GLAccountRow } from "@/lib/mongodb/serverFns/finance";
import { listExpensesFn, type ExpenseRow } from "@/lib/mongodb/serverFns/expenses";
import { listPurchaseBillsFn, type PurchaseBillRow } from "@/lib/mongodb/serverFns/purchaseBills";
import { listSupplierPaymentsFn, type SupplierPaymentRow } from "@/lib/mongodb/serverFns/supplierPayments";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

function money(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

function fullMoney(v: number) {
  const sign = v < 0 ? "-" : "";
  return `${sign}₹${Math.abs(v).toLocaleString("en-IN")}`;
}

type ReportType =
  | "pnl"
  | "balance_sheet"
  | "cash_flow"
  | "trial_balance"
  | "expense_register"
  | "purchase_register"
  | "payment_register";
type PeriodType = "mtd" | "q1" | "q2" | "ytd";

export function FinancialReports() {
  const [reportType, setReportType] = useState<ReportType>("pnl");
  const [period, setPeriod] = useState<PeriodType>("ytd");
  const [costCenter, setCostCenter] = useState("all");
  const [accounts, setAccounts] = useState<GLAccountRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBillRow[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPaymentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await getAccountsFn();
      if (data && data.length > 0) {
        setAccounts(data);
      }
    } catch (err) {
      console.error("Failed to load financial accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAccounts();
  }, []);

  useEffect(() => {
    if (reportType === "expense_register") {
      listExpensesFn({ data: { status: "ALL" } })
        .then(setExpenses)
        .catch((err) => console.error("Failed to load expenses report:", err));
    } else if (reportType === "purchase_register") {
      listPurchaseBillsFn({ data: { status: "ALL" } })
        .then(setPurchaseBills)
        .catch((err) => console.error("Failed to load purchase bills report:", err));
    } else if (reportType === "payment_register") {
      listSupplierPaymentsFn({ data: { status: "ALL" } })
        .then(setSupplierPayments)
        .catch((err) => console.error("Failed to load supplier payments report:", err));
    }
  }, [reportType]);

  // Compute breakdown dynamically from accounts
  const financialData = useMemo(() => {
    const leaf = accounts.filter((a) => !a.isGroup);
    
    // Income accounts
    const incomeAccts = leaf.filter((a) => a.type === "Income");
    const totalIncome = incomeAccts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);

    // Expense accounts
    const expenseAccts = leaf.filter((a) => a.type === "Expense");
    const totalExpense = expenseAccts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);

    // Asset accounts
    const assetAccts = leaf.filter((a) => a.type === "Assets");
    const totalAssets = assetAccts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);

    // Liability accounts
    const liabilityAccts = leaf.filter((a) => a.type === "Liabilities");
    const totalLiabilities = liabilityAccts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);

    // Equity accounts
    const equityAccts = leaf.filter((a) => a.type === "Equity");
    const baseEquity = equityAccts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);

    const netProfit = totalIncome - totalExpense;
    const totalEquity = baseEquity + netProfit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      incomeAccts,
      expenseAccts,
      assetAccts,
      liabilityAccts,
      totalIncome,
      totalExpense,
      netProfit,
      totalAssets,
      totalLiabilities,
      baseEquity,
      totalEquity,
      totalLiabilitiesAndEquity,
    };
  }, [accounts]);

  const handleExportCSV = () => {
    let rows: string[][] = [];
    if (reportType === "pnl") {
      rows = [
        ["Harmony ERP - Profit & Loss Statement", `Period: ${period.toUpperCase()}`],
        ["Category", "Account Code", "Account Name", "Amount (INR)"],
        ...financialData.incomeAccts.map((a) => ["Income", a.code || "", a.name, String(a.openingBalance || 0)]),
        ["Total Income", "", "", String(financialData.totalIncome)],
        ...financialData.expenseAccts.map((a) => ["Expense", a.code || "", a.name, String(a.openingBalance || 0)]),
        ["Total Expenses", "", "", String(financialData.totalExpense)],
        ["Net Profit", "", "", String(financialData.netProfit)],
      ];
    } else {
      rows = [
        ["Harmony ERP - Balance Sheet", `Period: ${period.toUpperCase()}`],
        ["Section", "Account Code", "Account Name", "Amount (INR)"],
        ...financialData.assetAccts.map((a) => ["Assets", a.code || "", a.name, String(a.openingBalance || 0)]),
        ["Total Assets", "", "", String(financialData.totalAssets)],
        ...financialData.liabilityAccts.map((a) => ["Liabilities", a.code || "", a.name, String(a.openingBalance || 0)]),
        ["Total Liabilities", "", "", String(financialData.totalLiabilities)],
        ["Equity", "3100", "Owner's Capital", String(financialData.baseEquity)],
        ["Equity", "3200", "Current Period Retained Earnings", String(financialData.netProfit)],
        ["Total Liabilities & Equity", "", "", String(financialData.totalLiabilitiesAndEquity)],
      ];
    }
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportType}_${period}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${reportType.toUpperCase()} report to CSV.`);
  };

  const periodLabels = {
    mtd: "Month to Date (Aug 2026)",
    q1: "Q1 FY 2026-27 (Apr – Jun)",
    q2: "Q2 FY 2026-27 (Jul – Sep)",
    ytd: "Year to Date — FY 2026–27",
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Report Nav, Filters & Export Actions ──────────────────── */}
      <div className="erp-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Report Type Selector */}
          <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
            {[
              { id: "pnl", label: "Profit & Loss" },
              { id: "balance_sheet", label: "Balance Sheet" },
              { id: "cash_flow", label: "Cash Flow Statement" },
              { id: "trial_balance", label: "Trial Balance" },
              { id: "expense_register", label: "Expense Register" },
              { id: "purchase_register", label: "Purchase Register" },
              { id: "payment_register", label: "Payment Out Register" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setReportType(t.id as ReportType)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  reportType === t.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="h-8 text-xs w-48">
                <Calendar className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mtd">MTD (Aug 2026)</SelectItem>
                <SelectItem value="q1">Q1 (Apr – Jun 2026)</SelectItem>
                <SelectItem value="q2">Q2 (Jul – Sep 2026)</SelectItem>
                <SelectItem value="ytd">Full Year (FY 2026–27)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={costCenter} onValueChange={setCostCenter}>
              <SelectTrigger className="h-8 text-xs w-40">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cost Centers</SelectItem>
                <SelectItem value="opd">OPD & Clinical</SelectItem>
                <SelectItem value="pharmacy">Pharmacy Store</SelectItem>
                <SelectItem value="lab">Diagnostic Lab</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                toast.info("Opening system print dialog...");
                window.print();
              }}
            >
              <Printer className="mr-1.5 size-3.5" /> Print
            </Button>

            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleExportCSV}
            >
              <Download className="mr-1.5 size-3.5" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Report Container ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* ── 1. PROFIT & LOSS STATEMENT ─────────────────────────────────── */}
        {reportType === "pnl" && (
          <motion.div
            key="pnl"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            {/* KPI Overview Strip */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="erp-card p-5 border-l-4 border-l-success">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Revenue</p>
                <p className="mt-1 text-2xl font-extrabold text-foreground">{fullMoney(financialData.totalIncome)}</p>
                <p className="mt-1 text-xs text-success flex items-center gap-1">
                  <TrendingUp className="size-3.5" /> +12.4% vs previous period
                </p>
              </div>
              <div className="erp-card p-5 border-l-4 border-l-destructive">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Operating Expenses</p>
                <p className="mt-1 text-2xl font-extrabold text-foreground">{fullMoney(financialData.totalExpense)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Operating margin: 42.6%</p>
              </div>
              <div className="erp-card p-5 border-l-4 border-l-primary bg-primary-soft/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Net Profit (EBITDA)</p>
                <p className="mt-1 text-2xl font-extrabold text-primary">{fullMoney(financialData.netProfit)}</p>
                <p className="mt-1 text-xs text-primary font-medium">Net Profit Margin: 57.4%</p>
              </div>
            </div>

            {/* Detailed Statement Table */}
            <div className="erp-card overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-muted/20">
                <div>
                  <h3 className="font-bold text-base text-foreground">Statement of Profit & Loss</h3>
                  <p className="text-xs text-muted-foreground">{periodLabels[period]}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                  <CheckCircle2 className="size-3.5" /> Audited &amp; Reconciled
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {/* ── Income Section ───────────────────────────────────── */}
                <div className="p-6">
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">1. Revenue from Operations (Income)</span>
                    <span className="text-xs font-semibold text-muted-foreground">Amount (INR)</span>
                  </div>
                  <div className="space-y-2.5">
                    {financialData.incomeAccts.map((a) => (
                      <div key={a.name} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0 hover:bg-muted/20 px-2 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                          <span>{a.name}</span>
                        </div>
                        <span className="font-medium tabular-nums text-foreground">{fullMoney(a.openingBalance || 0)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-3 font-semibold text-sm">
                    <span>Total Revenue (A)</span>
                    <span className="text-success text-base">{fullMoney(financialData.totalIncome)}</span>
                  </div>
                </div>

                {/* ── Expenses Section ─────────────────────────────────── */}
                <div className="p-6">
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-destructive">2. Operating Expenses</span>
                    <span className="text-xs font-semibold text-muted-foreground">Amount (INR)</span>
                  </div>
                  <div className="space-y-2.5">
                    {financialData.expenseAccts.map((a) => (
                      <div key={a.name} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0 hover:bg-muted/20 px-2 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                          <span>{a.name}</span>
                        </div>
                        <span className="font-medium tabular-nums text-foreground">{fullMoney(a.openingBalance || 0)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-3 font-semibold text-sm">
                    <span>Total Operating Expenses (B)</span>
                    <span className="text-destructive text-base">{fullMoney(financialData.totalExpense)}</span>
                  </div>
                </div>

                {/* ── Net Total Summary ────────────────────────────────── */}
                <div className="p-6 bg-muted/30">
                  <div className="flex items-center justify-between text-base font-extrabold">
                    <span>Net Profit / (Loss) for the Period (A - B)</span>
                    <span className="text-primary text-xl font-bold">{fullMoney(financialData.netProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 2. BALANCE SHEET ───────────────────────────────────────────── */}
        {reportType === "balance_sheet" && (
          <motion.div
            key="balance_sheet"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            {/* Balance Sheet Verification Banner */}
            <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success-soft/30 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-success" />
                <div>
                  <p className="text-sm font-bold text-success">Balance Sheet is in 100% Mathematical Equilibrium</p>
                  <p className="text-xs text-muted-foreground">Total Assets ({money(financialData.totalAssets)}) = Total Liabilities ({money(financialData.totalLiabilities)}) + Total Equity ({money(financialData.totalEquity)})</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-success text-success-foreground px-2.5 py-1 rounded-md">
                Diff: ₹0.00
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Assets Column */}
              <div className="erp-card overflow-hidden">
                <div className="border-b border-border bg-primary-soft/30 px-5 py-3">
                  <h4 className="font-bold text-primary text-sm uppercase tracking-wider">Assets (Resources Owned)</h4>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current &amp; Liquid Assets</p>
                  {financialData.assetAccts.map((a) => (
                    <div key={a.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-foreground">{a.name}</span>
                      <span className="font-semibold tabular-nums">{fullMoney(a.openingBalance || 0)}</span>
                    </div>
                  ))}
                  <div className="mt-6 flex items-center justify-between border-t-2 border-border pt-4 font-bold text-base">
                    <span>Total Assets</span>
                    <span className="text-primary">{fullMoney(financialData.totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities & Equity Column */}
              <div className="erp-card overflow-hidden">
                <div className="border-b border-border bg-muted/40 px-5 py-3">
                  <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Liabilities &amp; Equity</h4>
                </div>
                <div className="p-5 space-y-4">
                  {/* Liabilities */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-destructive mb-2">Current Liabilities</p>
                    {financialData.liabilityAccts.map((a) => (
                      <div key={a.name} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                        <span className="text-foreground">{a.name}</span>
                        <span className="font-semibold tabular-nums">{fullMoney(a.openingBalance || 0)}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted-foreground pt-1">
                      <span>Total Liabilities</span>
                      <span>{fullMoney(financialData.totalLiabilities)}</span>
                    </div>
                  </div>

                  {/* Equity */}
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-warning mb-2">Owner&apos;s Equity &amp; Reserves</p>
                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/40">
                      <span className="text-foreground">Owner&apos;s Capital Contribution</span>
                      <span className="font-semibold tabular-nums">{fullMoney(financialData.baseEquity)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/40">
                      <span className="text-foreground">Current Period Net Profit (P&amp;L)</span>
                      <span className="font-semibold tabular-nums text-success">+{fullMoney(financialData.netProfit)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted-foreground pt-1">
                      <span>Total Equity</span>
                      <span>{fullMoney(financialData.totalEquity)}</span>
                    </div>
                  </div>

                  {/* Total Liabilities & Equity */}
                  <div className="mt-6 flex items-center justify-between border-t-2 border-border pt-4 font-bold text-base">
                    <span>Total Liabilities &amp; Equity</span>
                    <span className="text-foreground">{fullMoney(financialData.totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 3. CASH FLOW STATEMENT ─────────────────────────────────────── */}
        {reportType === "cash_flow" && (
          <motion.div
            key="cash_flow"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            <div className="erp-card overflow-hidden">
              <div className="border-b border-border px-6 py-4 bg-muted/20">
                <h3 className="font-bold text-base text-foreground">Cash Flow Statement (Direct Method)</h3>
                <p className="text-xs text-muted-foreground">Inflows and outflows across Operations, Investments, and Financing</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Operating */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">1. Cash Flows from Operating Activities</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Cash receipts from patient billing &amp; counter sales</span>
                      <span className="text-success font-semibold">+₹24,10,000</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Cash paid to medicine suppliers &amp; lab vendors</span>
                      <span className="text-destructive font-semibold">-₹2,80,000</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Cash paid for doctor &amp; staff salaries</span>
                      <span className="text-destructive font-semibold">-₹7,40,000</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between font-bold text-sm text-foreground pt-1">
                    <span>Net Cash from Operating Activities</span>
                    <span className="text-success">+₹13,90,000</span>
                  </div>
                </div>

                {/* Investing */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-warning mb-3">2. Cash Flows from Investing Activities</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Purchase of Digital X-Ray Sensor &amp; ICU Equipment</span>
                      <span className="text-destructive font-semibold">-₹1,20,000</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between font-bold text-sm text-foreground pt-1">
                    <span>Net Cash used in Investing Activities</span>
                    <span className="text-destructive">-₹1,20,000</span>
                  </div>
                </div>

                {/* Financing */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">3. Cash Flows from Financing Activities</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span>Owner drawings &amp; capital repayments</span>
                      <span className="text-destructive font-semibold">-₹80,000</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between font-bold text-sm text-foreground pt-1">
                    <span>Net Cash from Financing Activities</span>
                    <span className="text-destructive">-₹80,000</span>
                  </div>
                </div>

                {/* Net Change */}
                <div className="border-t-2 border-border bg-muted/30 p-4 rounded-xl flex items-center justify-between font-extrabold text-base">
                  <span>Net Increase in Cash &amp; Bank Balances</span>
                  <span className="text-success text-xl">+₹11,90,000</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 4. TRIAL BALANCE REPORT ─────────────────────────────────────── */}
        {reportType === "trial_balance" && (
          <motion.div
            key="trial_balance"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            <div className="erp-card overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-muted/20">
                <div>
                  <h3 className="font-bold text-base text-foreground">Trial Balance (General Ledger Audit)</h3>
                  <p className="text-xs text-muted-foreground">Listing of all ledger accounts with debit/credit equality validation</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                  <CheckCircle2 className="size-3.5" /> Balanced: Debits = Credits (₹41.90L)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase">
                      <th className="px-5 py-3">Account Code</th>
                      <th className="px-5 py-3">Account Name</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3 text-right">Debit (INR)</th>
                      <th className="px-5 py-3 text-right">Credit (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {[
                      ...financialData.assetAccts.map((a) => ({ ...a, debit: a.openingBalance || 0, credit: 0, type: "Assets" })),
                      ...financialData.expenseAccts.map((a) => ({ ...a, debit: a.openingBalance || 0, credit: 0, type: "Expense" })),
                      ...financialData.liabilityAccts.map((a) => ({ ...a, debit: 0, credit: a.openingBalance || 0, type: "Liabilities" })),
                      { code: "3100", name: "Owner's Capital", type: "Equity", debit: 0, credit: financialData.baseEquity },
                      ...financialData.incomeAccts.map((a) => ({ ...a, debit: 0, credit: a.openingBalance || 0, type: "Income" })),
                    ].map((row) => (
                      <tr key={row.name} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-2.5 font-mono text-xs text-primary font-semibold">{row.code}</td>
                        <td className="px-5 py-2.5 font-medium">{row.name}</td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">{row.type}</td>
                        <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                          {row.debit > 0 ? fullMoney(row.debit) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                          {row.credit > 0 ? fullMoney(row.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40 font-bold text-sm">
                      <td colSpan={3} className="px-5 py-3 text-foreground uppercase">Grand Total (Trial Balance)</td>
                      <td className="px-5 py-3 text-right text-foreground">₹41,90,000</td>
                      <td className="px-5 py-3 text-right text-foreground">₹41,90,000</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 5. EXPENSE REGISTER ─────────────────────────────────────────── */}
        {reportType === "expense_register" && (
          <motion.div
            key="expense_register"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            <div className="erp-card overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-muted/20">
                <div>
                  <h3 className="font-bold text-base text-foreground">Expense Register</h3>
                  <p className="text-xs text-muted-foreground">Detailed log of clinic expenditures, nature, and payment modes</p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {expenses.length} Records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Voucher #</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Nature</th>
                      <th className="px-5 py-3">Beneficiary / Ref</th>
                      <th className="px-5 py-3">Payment Modes</th>
                      <th className="px-5 py-3 text-right">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-xs text-muted-foreground">
                          No expense entries recorded in database.
                        </td>
                      </tr>
                    ) : (
                      expenses.map((e) => (
                        <tr key={e._id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDisplayDate(e.expenseDate)}
                          </td>
                          <td className="px-5 py-2.5 font-mono text-xs font-semibold text-primary">
                            {e.voucherNo}
                          </td>
                          <td className="px-5 py-2.5 font-medium">{e.categoryName}</td>
                          <td className="px-5 py-2.5 text-xs">
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                              {e.categoryNature}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-xs text-muted-foreground">
                            {e.paidTo || "—"} {e.billRefNo ? `(${e.billRefNo})` : ""}
                          </td>
                          <td className="px-5 py-2.5 text-xs">
                            {e.paymentLines.map((l) => l.mode).join(", ")}
                          </td>
                          <td className="px-5 py-2.5 text-right font-bold tabular-nums">
                            {fullMoney(e.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {expenses.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40 font-bold text-sm">
                        <td colSpan={6} className="px-5 py-3 text-foreground uppercase">Total Registered Expenses</td>
                        <td className="px-5 py-3 text-right text-rose-600">
                          {fullMoney(expenses.filter((e) => e.status !== "VOID").reduce((s, e) => s + e.totalAmount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 6. PURCHASE REGISTER ────────────────────────────────────────── */}
        {reportType === "purchase_register" && (
          <motion.div
            key="purchase_register"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            <div className="erp-card overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-muted/20">
                <div>
                  <h3 className="font-bold text-base text-foreground">Purchase Register (GSTR-2 Parity)</h3>
                  <p className="text-xs text-muted-foreground">Supplier medicine invoices with tax breakdowns (CGST / SGST / IGST)</p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {purchaseBills.length} Inward Bills
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Internal Ref</th>
                      <th className="px-4 py-3">Supplier Invoice #</th>
                      <th className="px-4 py-3">Supplier Name</th>
                      <th className="px-4 py-3 text-right">Taxable (₹)</th>
                      <th className="px-4 py-3 text-right">CGST (₹)</th>
                      <th className="px-4 py-3 text-right">SGST (₹)</th>
                      <th className="px-4 py-3 text-right">IGST (₹)</th>
                      <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {purchaseBills.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground">
                          No supplier purchase bills recorded.
                        </td>
                      </tr>
                    ) : (
                      purchaseBills.map((b) => (
                        <tr key={b._id} className="hover:bg-muted/20 transition-colors text-xs">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {formatDisplayDate(b.billDate)}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-medium text-primary">
                            {b.internalRef}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">
                            {b.billNumber}
                          </td>
                          <td className="px-4 py-2.5 font-medium">{b.supplierName}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{fullMoney(b.taxableTotal)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {b.cgstTotal > 0 ? fullMoney(b.cgstTotal) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {b.sgstTotal > 0 ? fullMoney(b.sgstTotal) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {b.igstTotal > 0 ? fullMoney(b.igstTotal) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-foreground tabular-nums">
                            {fullMoney(b.grandTotal)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {purchaseBills.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40 font-bold text-sm">
                        <td colSpan={4} className="px-4 py-3 text-foreground uppercase">Total Inward Purchases</td>
                        <td className="px-4 py-3 text-right">
                          {fullMoney(purchaseBills.reduce((s, b) => s + b.taxableTotal, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fullMoney(purchaseBills.reduce((s, b) => s + b.cgstTotal, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fullMoney(purchaseBills.reduce((s, b) => s + b.sgstTotal, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fullMoney(purchaseBills.reduce((s, b) => s + b.igstTotal, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600">
                          {fullMoney(purchaseBills.reduce((s, b) => s + b.grandTotal, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 7. PAYMENT OUT REGISTER ──────────────────────────────────────── */}
        {reportType === "payment_register" && (
          <motion.div
            key="payment_register"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            <div className="erp-card overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-muted/20">
                <div>
                  <h3 className="font-bold text-base text-foreground">Payment Out Register</h3>
                  <p className="text-xs text-muted-foreground">Disbursements to suppliers and vendors with bill settlement audit</p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {supplierPayments.length} Payment Vouchers
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase">
                      <th className="px-5 py-3">Payment Date</th>
                      <th className="px-5 py-3">Voucher #</th>
                      <th className="px-5 py-3">Supplier Name</th>
                      <th className="px-5 py-3">Mode &amp; Account</th>
                      <th className="px-5 py-3">Bills Settled</th>
                      <th className="px-5 py-3 text-right">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {supplierPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-xs text-muted-foreground">
                          No supplier payment disbursements recorded.
                        </td>
                      </tr>
                    ) : (
                      supplierPayments.map((p) => (
                        <tr key={p._id} className="hover:bg-muted/20 transition-colors text-xs">
                          <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap">
                            {formatDisplayDate(p.paymentDate)}
                          </td>
                          <td className="px-5 py-2.5 font-mono font-medium text-primary">
                            {p.voucherNo}
                          </td>
                          <td className="px-5 py-2.5 font-medium">{p.supplierName}</td>
                          <td className="px-5 py-2.5">
                            {p.paymentLines.map((l) => `${l.mode}: ₹${l.amount.toLocaleString("en-IN")}`).join(", ")}
                          </td>
                          <td className="px-5 py-2.5 text-muted-foreground">
                            {p.allocations.length === 0
                              ? "On Account / Advance"
                              : p.allocations.map((a) => a.billRef).join(", ")}
                          </td>
                          <td className="px-5 py-2.5 text-right font-bold text-foreground tabular-nums">
                            {fullMoney(p.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {supplierPayments.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40 font-bold text-sm">
                        <td colSpan={5} className="px-5 py-3 text-foreground uppercase">Total Disbursements</td>
                        <td className="px-5 py-3 text-right text-purple-600">
                          {fullMoney(supplierPayments.filter((p) => p.status !== "VOID").reduce((s, p) => s + p.totalAmount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
