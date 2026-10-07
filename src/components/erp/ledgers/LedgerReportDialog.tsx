import { useEffect, useState, useMemo } from "react";
import {
  Mail,
  MessageCircle,
  Printer,
  FileSpreadsheet,
  FileText,
  Search,
  RotateCcw,
  Plus,
  Calendar,
  X,
  Users,
  Truck,
  UserCog,
  Banknote,
  BookOpen,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  SearchX,
  Phone,
  ChevronRight,
  Building2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLedgerFn,
  listLedgerSubjectsFn,
  addStaffLedgerEntryFn,
  type LedgerReport,
  type LedgerSubject,
  type LedgerType,
} from "@/lib/mongodb/serverFns/ledgers";
import { STAFF_ENTRY_KINDS } from "@/lib/ledger/buildLedger";
import { addDaysToISO, fiscalYearRange, formatDisplayDate, todayIST } from "@/lib/utils/dateUtils";
import { balanceLabel, exportCsv, exportPdf, money, printLedger, summaryText } from "./ledgerExport";
import { cn } from "@/lib/utils";

const LABEL: Record<LedgerType, { title: string; subtitle: string; icon: React.FC<{ className?: string }>; color: string }> = {
  customer: {
    title: "Customer",
    subtitle: "Select a customer to view invoices, payment receipts, and balance statement",
    icon: Users,
    color: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
  },
  supplier: {
    title: "Supplier",
    subtitle: "Select a supplier to view purchase bills, payments, and outstanding payables",
    icon: Truck,
    color: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
  },
  cash: {
    title: "Cash in Hand",
    subtitle: "Cash book statement showing daily cash inflows and outflows",
    icon: Banknote,
    color: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
  },
  staff: {
    title: "Staff Member",
    subtitle: "Select an employee to view salary accruals, advances, and expense reimbursements",
    icon: UserCog,
    color: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border-purple-200 dark:border-purple-900/50",
  },
};

const balanceTone = (n: number) =>
  n < 0 ? "text-rose-600 dark:text-rose-400" : n > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first) return "—";
  if (!last || parts.length === 1) return first.slice(0, 2).toUpperCase();
  const c1 = first[0] ?? "";
  const c2 = last[0] ?? "";
  return (c1 + c2).toUpperCase() || first.slice(0, 2).toUpperCase();
}

interface Props {
  type: LedgerType | null;
  onClose: () => void;
}

export function LedgerReportDialog({ type, onClose }: Props) {
  const today = todayIST();
  const fyFrom = fiscalYearRange().from;

  const [subject, setSubject] = useState<LedgerSubject | null>(null);
  const [q, setQ] = useState("");
  const [subjects, setSubjects] = useState<LedgerSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [from, setFrom] = useState(fyFrom);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);

  // New tile → reset state
  useEffect(() => {
    setSubject(null);
    setQ("");
    setReport(null);
    setFrom(fyFrom);
    setTo(today);
  }, [type, fyFrom, today]);

  const needsPicker = type !== null && type !== "cash" && !subject;

  useEffect(() => {
    if (!type || type === "cash" || subject) return;
    setLoadingSubjects(true);
    const t = setTimeout(() => {
      listLedgerSubjectsFn({ data: { type, q } })
        .then(setSubjects)
        .catch(() => toast.error("Could not load list"))
        .finally(() => setLoadingSubjects(false));
    }, 200);
    return () => clearTimeout(t);
  }, [type, q, subject]);

  useEffect(() => {
    if (!type || needsPicker) return;
    setLoading(true);
    getLedgerFn({ data: { type, from, to, ...(subject ? { subjectId: subject.id } : {}) } })
      .then(setReport)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load ledger"))
      .finally(() => setLoading(false));
  }, [type, subject, from, to, needsPicker, reload]);

  const setPresetRange = (preset: "today" | "yesterday" | "7d" | "30d" | "month" | "fy") => {
    if (preset === "today") {
      setFrom(today);
      setTo(today);
    } else if (preset === "yesterday") {
      const y = addDaysToISO(today, -1);
      setFrom(y);
      setTo(y);
    } else if (preset === "7d") {
      setFrom(addDaysToISO(today, -6));
      setTo(today);
    } else if (preset === "30d") {
      setFrom(addDaysToISO(today, -29));
      setTo(today);
    } else if (preset === "month") {
      const monthStart = `${today.slice(0, 7)}-01`;
      setFrom(monthStart);
      setTo(today);
    } else if (preset === "fy") {
      setFrom(fyFrom);
      setTo(today);
    }
  };

  const activePreset = useMemo(() => {
    if (from === today && to === today) return "today";
    if (from === addDaysToISO(today, -1) && to === addDaysToISO(today, -1)) return "yesterday";
    if (from === addDaysToISO(today, -6) && to === today) return "7d";
    if (from === addDaysToISO(today, -29) && to === today) return "30d";
    if (from === `${today.slice(0, 7)}-01` && to === today) return "month";
    if (from === fyFrom && to === today) return "fy";
    return null;
  }, [from, to, today, fyFrom]);

  if (!type) return null;
  const config = LABEL[type];
  const IconComp = config.icon;

  // Semantic description of closing balance
  const balanceNote = (b: number) => {
    if (b === 0) return "Settled / Nil";
    if (type === "customer") return b > 0 ? "Receivable from Customer" : "Advance from Customer";
    if (type === "supplier") return b < 0 ? "Payable to Supplier" : "Advance with Supplier";
    if (type === "cash") return "Cash in Hand";
    return b > 0 ? "Advance with Staff" : "Payable to Staff";
  };

  return (
    <Dialog open={type !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 border border-border shadow-2xl transition-all duration-200",
          needsPicker ? "max-w-xl" : "max-w-6xl"
        )}
      >
        {/* Header */}
        <DialogHeader className="border-b px-5 py-3.5 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", config.color)}>
                <IconComp className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold truncate flex items-center gap-2">
                  {report && !needsPicker ? (
                    <>
                      <span>{report.subjectName}</span>
                      <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border">
                        {report.title}
                      </span>
                    </>
                  ) : (
                    <span>Select {config.title}</span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {report && !needsPicker ? (
                    <span>
                      Period: {formatDisplayDate(from)} to {formatDisplayDate(to)}
                      {report.subjectMeta ? ` • ${report.subjectMeta}` : ""}
                    </span>
                  ) : (
                    config.subtitle
                  )}
                </DialogDescription>
              </div>
            </div>

            {/* Quick switcher if in report mode */}
            {subject && !needsPicker && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSubject(null);
                  setReport(null);
                }}
                className="h-8 gap-1.5 text-xs font-medium shrink-0 hover:border-primary/50"
              >
                <ArrowLeftRight className="size-3.5 text-muted-foreground" />
                Change {config.title}
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* ─── PARTY PICKER VIEW ─────────────────────────────────────── */}
        {needsPicker ? (
          <div className="flex flex-col gap-3 p-5 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={`Search ${config.title.toLowerCase()} by name, phone or contact...`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-10 pl-9 pr-9 text-sm rounded-xl bg-muted/30 focus-visible:bg-background border-border/80"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
              <span>
                {loadingSubjects ? "Searching..." : `Showing ${subjects.length} ${config.title.toLowerCase()}${subjects.length === 1 ? "" : "s"}`}
              </span>
              <span className="hidden sm:inline">Click to open ledger statement</span>
            </div>

            <div className="max-h-[52vh] overflow-y-auto divide-y rounded-xl border border-border bg-card">
              {loadingSubjects ? (
                <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                  Searching accounts…
                </div>
              ) : subjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                    <SearchX className="size-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No matches found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {q ? `No ${config.title.toLowerCase()} found matching "${q}". Try checking the spelling.` : `No active ${config.title.toLowerCase()} records exist.`}
                  </p>
                  {q && (
                    <Button variant="ghost" size="sm" onClick={() => setQ("")} className="mt-3 text-xs h-7">
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                subjects.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setSubject(s)}
                    className="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-primary/5 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20">
                        {getInitials(s.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {s.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">#{idx + 1}</span>
                        </div>
                        {s.sub && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Phone className="size-3 text-muted-foreground/70" />
                            <span className="truncate">{s.sub}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline-flex text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        View Statement
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* ─── LEDGER REPORT VIEW ────────────────────────────────────── */
          <>
            {/* Filter Toolbar */}
            <div className="border-b bg-muted/20 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Date Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">From</span>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="bg-transparent text-foreground focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Up to</span>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="bg-transparent text-foreground focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Range preset chips */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={activePreset === "today" ? "default" : "outline"}
                      className="h-7 text-xs px-2.5"
                      onClick={() => setPresetRange("today")}
                    >
                      Today
                    </Button>
                    <Button
                      size="sm"
                      variant={activePreset === "yesterday" ? "default" : "outline"}
                      className="h-7 text-xs px-2.5"
                      onClick={() => setPresetRange("yesterday")}
                    >
                      Yesterday
                    </Button>
                    <Button
                      size="sm"
                      variant={activePreset === "7d" ? "default" : "outline"}
                      className="h-7 text-xs px-2.5"
                      onClick={() => setPresetRange("7d")}
                    >
                      7 days
                    </Button>
                    <Button
                      size="sm"
                      variant={activePreset === "30d" ? "default" : "outline"}
                      className="h-7 text-xs px-2.5"
                      onClick={() => setPresetRange("30d")}
                    >
                      30 days
                    </Button>
                    <Button
                      size="sm"
                      variant={activePreset === "month" ? "default" : "outline"}
                      className="h-7 text-xs px-2.5 hidden sm:inline-flex"
                      onClick={() => setPresetRange("month")}
                    >
                      This Month
                    </Button>
                    <Button
                      size="sm"
                      variant={activePreset === "fy" ? "default" : "outline"}
                      className="h-7 text-xs px-2.5 hidden sm:inline-flex"
                      onClick={() => setPresetRange("fy")}
                    >
                      This FY
                    </Button>
                  </div>
                </div>

                {/* Search & Reset */}
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-8 gap-1.5 text-xs shadow-xs" onClick={() => setReload((n) => n + 1)}>
                    <Search className="size-3.5" /> Search
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      setFrom(fyFrom);
                      setTo(today);
                    }}
                  >
                    <RotateCcw className="size-3.5" /> Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {report && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3 border-b bg-card/60">
                {/* 1. Opening Balance */}
                <div className="rounded-xl border border-border bg-background p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Opening Balance</span>
                    <Wallet className="size-3.5" />
                  </div>
                  <div className="text-base font-bold text-foreground">
                    ₹ {money(report.openingBalance)}{" "}
                    <span className="text-xs font-semibold text-muted-foreground">
                      {report.openingBalance < 0 ? "Cr" : "Dr"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Brought Forward</p>
                </div>

                {/* 2. Total Debit */}
                <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Total Debit (Dr)</span>
                    <TrendingUp className="size-3.5" />
                  </div>
                  <div className="text-base font-bold text-blue-900 dark:text-blue-200">
                    ₹ {money(report.totalDebit)}
                  </div>
                  <p className="text-[11px] text-blue-700/80 dark:text-blue-400 mt-0.5">
                    {type === "customer" ? "Invoices & charges" : type === "supplier" ? "Payments made" : "Total outflows/debits"}
                  </p>
                </div>

                {/* 3. Total Credit */}
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Total Credit (Cr)</span>
                    <TrendingDown className="size-3.5" />
                  </div>
                  <div className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                    ₹ {money(report.totalCredit)}
                  </div>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                    {type === "customer" ? "Payments received" : type === "supplier" ? "Bills received" : "Total inflows/credits"}
                  </p>
                </div>

                {/* 4. Closing Net Balance */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-2xs">
                  <div className="flex items-center justify-between text-primary mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Net Balance</span>
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <div className={`text-base font-bold ${balanceTone(report.closingBalance)}`}>
                    ₹ {money(report.closingBalance)}{" "}
                    <span className="text-xs font-semibold">
                      {report.closingBalance < 0 ? "Cr" : "Dr"}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground/80 mt-0.5 truncate">
                    {balanceNote(report.closingBalance)}
                  </p>
                </div>
              </div>
            )}

            {/* Table Container */}
            <div className="flex-1 overflow-auto px-5 py-3 min-h-[220px]">
              {loading || !report ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground animate-pulse">
                  <BookOpen className="size-8 text-muted-foreground/50 mb-2" />
                  <span>Loading ledger transactions…</span>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden bg-card">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/70 border-b border-border text-foreground font-semibold">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-12 text-muted-foreground">Sr.</th>
                        <th className="px-3 py-2.5 text-left w-28">Date</th>
                        <th className="px-3 py-2.5 text-left w-36">Voucher #</th>
                        <th className="px-3 py-2.5 text-left">Particulars</th>
                        <th className="px-3 py-2.5 text-right w-32">Debit (₹)</th>
                        <th className="px-3 py-2.5 text-right w-32">Credit (₹)</th>
                        <th className="px-3 py-2.5 text-right w-36">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* Opening Balance Row */}
                      <tr className="bg-amber-500/5 font-medium transition-colors">
                        <td className="px-3 py-2.5 text-center text-muted-foreground">—</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground font-mono text-[11px]">
                          {formatDisplayDate(from)}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">—</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className="inline-block size-1.5 rounded-full bg-amber-500" />
                            Opening Balance (Brought Forward)
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${balanceTone(report.openingBalance)}`}>
                          ₹ {money(report.openingBalance)} {report.openingBalance < 0 ? "Cr" : "Dr"}
                        </td>
                      </tr>

                      {/* Empty State */}
                      {report.rows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center">
                            <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
                              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                                <Receipt className="size-5" />
                              </div>
                              <p className="text-sm font-semibold text-foreground">No transactions in this period</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                There are no posted vouchers recorded between {formatDisplayDate(from)} and {formatDisplayDate(to)} for this account.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Transaction Rows */}
                      {report.rows.map((r, i) => (
                        <tr key={i} className="odd:bg-muted/20 hover:bg-primary/5 transition-colors">
                          <td className="px-3 py-2 text-center text-muted-foreground font-mono text-[11px]">
                            {i + 1}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-foreground font-mono text-[11px]">
                            {formatDisplayDate(r.date)}
                          </td>
                          <td className="px-3 py-2">
                            {r.voucherNo ? (
                              <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded border border-border/60 text-foreground font-medium">
                                {r.voucherNo}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-foreground font-medium">
                            {r.particulars}
                          </td>
                          <td className="px-3 py-2 text-right text-foreground font-mono">
                            {r.debit ? `₹ ${money(r.debit)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-foreground font-mono">
                            {r.credit ? `₹ ${money(r.credit)}` : "—"}
                          </td>
                          <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-semibold ${balanceTone(r.balance)}`}>
                            ₹ {money(r.balance)} {r.balance < 0 ? "Cr" : "Dr"}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Footer Totals */}
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/60 font-semibold text-xs">
                        <td className="px-3 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-3 py-3 text-muted-foreground">—</td>
                        <td className="px-3 py-3 text-muted-foreground">—</td>
                        <td className="px-3 py-3 text-foreground">
                          Period Total ({report.rows.length} transaction{report.rows.length === 1 ? "" : "s"})
                        </td>
                        <td className="px-3 py-3 text-right text-foreground font-mono font-bold">
                          ₹ {money(report.totalDebit)}
                        </td>
                        <td className="px-3 py-3 text-right text-foreground font-mono font-bold">
                          ₹ {money(report.totalCredit)}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-3 text-right font-mono font-bold ${balanceTone(report.closingBalance)}`}>
                          ₹ {money(report.closingBalance)} {report.closingBalance < 0 ? "Cr" : "Dr"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Staff Entry Form if staff ledger */}
            {type === "staff" && subject && (
              <StaffEntryForm staffId={subject.id} onSaved={() => setReload((n) => n + 1)} />
            )}

            {/* Bottom Action Footer Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-900 px-5 py-3 text-slate-100 dark:bg-card dark:text-foreground">
              {/* Closing balance tag */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-muted-foreground">Net Closing Balance:</span>
                <span className="text-sm font-bold tracking-tight">
                  {report ? balanceLabel(report.closingBalance) : "—"}
                </span>
                {report && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 dark:bg-muted dark:text-muted-foreground border border-slate-700 dark:border-border">
                    {balanceNote(report.closingBalance)}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              {report && (
                <div className="flex items-center gap-1.5">
                  <FooterBtn title="Excel Spreadsheet (.csv)" onClick={() => exportCsv(report, from, to)}>
                    <FileSpreadsheet className="size-4 text-emerald-400" />
                    <span className="hidden sm:inline">Excel</span>
                  </FooterBtn>

                  <FooterBtn
                    title="Send Statement via WhatsApp"
                    onClick={() =>
                      window.open(
                        `https://wa.me/?text=${encodeURIComponent(summaryText(report, from, to))}`,
                        "_blank"
                      )
                    }
                  >
                    <MessageCircle className="size-4 text-emerald-400" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </FooterBtn>

                  <FooterBtn title="Download PDF Statement" onClick={() => void exportPdf(report, from, to)}>
                    <FileText className="size-4 text-rose-400" />
                    <span className="hidden sm:inline">PDF</span>
                  </FooterBtn>

                  <FooterBtn
                    title="Email Statement"
                    onClick={() =>
                      (window.location.href = `mailto:?subject=${encodeURIComponent(report.title)}&body=${encodeURIComponent(
                        summaryText(report, from, to)
                      )}`)
                    }
                  >
                    <Mail className="size-4 text-sky-400" />
                    <span className="hidden sm:inline">Email</span>
                  </FooterBtn>

                  <FooterBtn title="Print Statement (Ctrl + P)" onClick={() => printLedger(report, from, to)}>
                    <Printer className="size-4 text-slate-300" />
                    <span className="hidden sm:inline">Print</span>
                  </FooterBtn>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FooterBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-white/10 active:scale-95 text-slate-200 dark:hover:bg-muted cursor-pointer"
    >
      {children}
    </button>
  );
}

/** Minimal salary/advance entry until the Payroll module owns this. */
function StaffEntryForm({ staffId, onSaved }: { staffId: string; onSaved: () => void }) {
  const [kind, setKind] = useState<(typeof STAFF_ENTRY_KINDS)[number]>("ADVANCE");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await addStaffLedgerEntryFn({ data: { staffId, kind, amount: n, narration } });
      setAmount("");
      setNarration("");
      toast.success("Ledger entry added successfully");
      onSaved();
    } catch {
      toast.error("Could not save entry");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t bg-muted/20 px-5 py-2.5 text-xs">
      <span className="font-semibold text-foreground flex items-center gap-1">
        <Plus className="size-3.5" /> Add Staff Entry:
      </span>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
        className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium cursor-pointer"
      >
        {STAFF_ENTRY_KINDS.map((k) => (
          <option key={k} value={k}>
            {k[0]}
            {k.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <Input
        type="number"
        min="0"
        placeholder="Amount (₹)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-8 w-32 text-xs rounded-lg"
      />
      <Input
        placeholder="Narration / Note"
        value={narration}
        onChange={(e) => setNarration(e.target.value)}
        className="h-8 w-64 text-xs rounded-lg"
      />
      <Button size="sm" className="h-8 gap-1 text-xs rounded-lg" onClick={() => void save()}>
        <Plus className="size-3.5" /> Save Entry
      </Button>
    </div>
  );
}
