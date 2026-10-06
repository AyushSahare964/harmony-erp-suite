import { useEffect, useState } from "react";
import { Mail, MessageCircle, Printer, FileSpreadsheet, FileText, Search, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const LABEL: Record<LedgerType, string> = {
  customer: "Customer",
  supplier: "Supplier",
  cash: "Cash",
  staff: "Staff",
};

const balanceTone = (n: number) => (n < 0 ? "text-rose-600" : n > 0 ? "text-emerald-600" : "text-muted-foreground");

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
  const [from, setFrom] = useState(fyFrom);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);

  // New tile → start from scratch.
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
    const t = setTimeout(() => {
      listLedgerSubjectsFn({ data: { type, q } })
        .then(setSubjects)
        .catch(() => toast.error("Could not load list"));
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

  const range = (days: number, endYesterday = false) => {
    const end = endYesterday ? addDaysToISO(today, -1) : today;
    setFrom(addDaysToISO(end, -days));
    setTo(end);
  };

  return (
    <Dialog open={type !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="text-sm">
            {report && !needsPicker ? `${report.subjectName} – ${report.title}` : type ? `Select ${LABEL[type]}` : ""}
          </DialogTitle>
        </DialogHeader>

        {needsPicker ? (
          <div className="space-y-3 p-5">
            <Input autoFocus placeholder={`Search ${type} by name…`} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
              {subjects.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No matches.</p>}
              {subjects.map((s) => (
                <button key={s.id} onClick={() => setSubject(s)} className="flex w-full justify-between px-4 py-2.5 text-left text-sm hover:bg-muted/50">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 border-b bg-muted/20 px-5 py-3 text-xs">
              <label className="space-y-1">
                <span className="text-muted-foreground">From</span>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">Up to</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36 text-xs" />
              </label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => range(0)}>Today</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => range(0, true)}>Yesterday</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => range(6)}>7 day(s)</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => range(29)}>30 day(s)</Button>
              </div>
              <div className="ml-auto flex gap-2">
                <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setReload((n) => n + 1)}>
                  <Search className="size-3.5" /> Search
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { setFrom(fyFrom); setTo(today); }}>
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
                {subject && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSubject(null); setReport(null); }}>
                    Change {type}
                  </Button>
                )}
              </div>
            </div>

            {report && <p className="px-5 pt-2 text-xs text-muted-foreground">
              Ledger from {formatDisplayDate(from)} to {formatDisplayDate(to)}{report.subjectMeta ? ` • ${report.subjectMeta}` : ""}
            </p>}

            {/* Table */}
            <div className="min-h-[200px] flex-1 overflow-auto px-5 py-2">
              {loading || !report ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{loading ? "Loading ledger…" : ""}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-primary text-primary-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Particulars</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 font-medium">Opening Balance</td>
                      <td /><td />
                      <td className={`px-3 py-2 text-right font-medium ${balanceTone(report.openingBalance)}`}>{money(report.openingBalance)} {report.openingBalance < 0 ? "Cr" : "Dr"}</td>
                    </tr>
                    {report.rows.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center italic text-muted-foreground">No transactions in this period.</td></tr>
                    )}
                    {report.rows.map((r, i) => (
                      <tr key={i} className="border-b odd:bg-muted/40">
                        <td className="whitespace-nowrap px-3 py-2">{formatDisplayDate(r.date)}</td>
                        <td className="px-3 py-2">{r.particulars}</td>
                        <td className="px-3 py-2 text-right">{r.debit ? money(r.debit) : ""}</td>
                        <td className="px-3 py-2 text-right">{r.credit ? money(r.credit) : ""}</td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${balanceTone(r.balance)}`}>{money(r.balance)} {r.balance < 0 ? "Cr" : "Dr"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={2} className="px-3 py-2 text-right">Period total</td>
                      <td className="px-3 py-2 text-right">{money(report.totalDebit)}</td>
                      <td className="px-3 py-2 text-right">{money(report.totalCredit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {type === "staff" && subject && <StaffEntryForm staffId={subject.id} onSaved={() => setReload((n) => n + 1)} />}

            {/* Footer bar */}
            <div className="flex items-center justify-between bg-primary px-5 py-2.5 text-primary-foreground">
              <span className="text-sm font-semibold">{report ? balanceLabel(report.closingBalance) : "—"}</span>
              {report && (
                <div className="flex items-center gap-1">
                  <FooterBtn title="Excel (CSV)" onClick={() => exportCsv(report, from, to)}><FileSpreadsheet className="size-4" /></FooterBtn>
                  <FooterBtn title="WhatsApp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(summaryText(report, from, to))}`, "_blank")}><MessageCircle className="size-4" /></FooterBtn>
                  <FooterBtn title="PDF" onClick={() => void exportPdf(report, from, to)}><FileText className="size-4" /></FooterBtn>
                  <FooterBtn title="Email" onClick={() => (window.location.href = `mailto:?subject=${encodeURIComponent(report.title)}&body=${encodeURIComponent(summaryText(report, from, to))}`)}><Mail className="size-4" /></FooterBtn>
                  <FooterBtn title="Print" onClick={() => printLedger(report, from, to)}><Printer className="size-4" /></FooterBtn>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FooterBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="rounded-md p-2 transition-colors hover:bg-white/20">
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
      toast.error("Enter an amount");
      return;
    }
    try {
      await addStaffLedgerEntryFn({ data: { staffId, kind, amount: n, narration } });
      setAmount("");
      setNarration("");
      onSaved();
    } catch {
      toast.error("Could not save entry");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-5 py-2 text-xs">
      <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-8 rounded-md border bg-background px-2">
        {STAFF_ENTRY_KINDS.map((k) => <option key={k} value={k}>{k[0]}{k.slice(1).toLowerCase()}</option>)}
      </select>
      <Input type="number" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-28 text-xs" />
      <Input placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} className="h-8 w-64 text-xs" />
      <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => void save()}><Plus className="size-3.5" /> Add entry</Button>
    </div>
  );
}
