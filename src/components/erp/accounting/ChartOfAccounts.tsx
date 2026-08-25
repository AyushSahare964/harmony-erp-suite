import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronDown, Plus, Search, AlertCircle, CheckCircle2,
  BookOpen, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import {
  getAccountsFn,
  createAccountFn,
  createJournalFn,
  getJournalsFn,
  type GLAccountRow,
  type JournalRow,
} from "@/lib/mongodb/serverFns/finance";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface Account {
  code: string;
  name: string;
  type: "Assets" | "Liabilities" | "Equity" | "Income" | "Expense";
  isGroup: boolean;
  parent?: string;
  balance: number;
}

export interface LedgerEntry {
  date: string;
  account: string;
  voucherType: "Journal Entry" | "Payment Entry" | "Sales Invoice" | "Purchase Invoice";
  voucherNo: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

// Fallback initial accounts
const DEFAULT_ACCOUNTS: Account[] = [
  { code: "1000", name: "Assets", type: "Assets", isGroup: true, balance: 3270000 },
  { code: "1100", name: "Cash", type: "Assets", isGroup: false, parent: "1000", balance: 142000 },
  { code: "1200", name: "Bank — HDFC Current", type: "Assets", isGroup: false, parent: "1000", balance: 1288000 },
  { code: "1300", name: "Accounts Receivable", type: "Assets", isGroup: false, parent: "1000", balance: 680000 },
  { code: "1400", name: "Inventory", type: "Assets", isGroup: false, parent: "1000", balance: 1160000 },
  { code: "2000", name: "Liabilities", type: "Liabilities", isGroup: true, balance: 420000 },
  { code: "2100", name: "Accounts Payable", type: "Liabilities", isGroup: false, parent: "2000", balance: 240000 },
  { code: "2200", name: "GST Payable", type: "Liabilities", isGroup: false, parent: "2000", balance: 180000 },
  { code: "3000", name: "Equity", type: "Equity", isGroup: true, balance: 1610000 },
  { code: "3100", name: "Owner's Capital", type: "Equity", isGroup: false, parent: "3000", balance: 1610000 },
  { code: "4000", name: "Income", type: "Income", isGroup: true, balance: 2160000 },
  { code: "4100", name: "Consultation Income", type: "Income", isGroup: false, parent: "4000", balance: 845000 },
  { code: "4200", name: "Pharmacy Income", type: "Income", isGroup: false, parent: "4000", balance: 462000 },
  { code: "4300", name: "Laboratory Income", type: "Income", isGroup: false, parent: "4000", balance: 411000 },
  { code: "4400", name: "Boarding Income", type: "Income", isGroup: false, parent: "4000", balance: 340000 },
  { code: "4500", name: "Swimming Income", type: "Income", isGroup: false, parent: "4000", balance: 102000 },
  { code: "5000", name: "Expense", type: "Expense", isGroup: true, balance: 920000 },
  { code: "5100", name: "Salaries", type: "Expense", isGroup: false, parent: "5000", balance: 740000 },
  { code: "5200", name: "Supplier Payments", type: "Expense", isGroup: false, parent: "5000", balance: 112000 },
  { code: "5300", name: "Utilities & Rent", type: "Expense", isGroup: false, parent: "5000", balance: 68000 },
];

const INITIAL_LEDGER: LedgerEntry[] = [
  { date: "2026-08-15", account: "Consultation Income", voucherType: "Sales Invoice", voucherNo: "INV-20481", debit: 0, credit: 84500, runningBalance: 845000 },
  { date: "2026-08-15", account: "Pharmacy Income", voucherType: "Sales Invoice", voucherNo: "INV-20482", debit: 0, credit: 46200, runningBalance: 462000 },
  { date: "2026-08-14", account: "Salaries", voucherType: "Journal Entry", voucherNo: "JV-3303", debit: 38000, credit: 0, runningBalance: 740000 },
  { date: "2026-08-14", account: "Accounts Payable", voucherType: "Purchase Invoice", voucherNo: "JV-3304", debit: 112000, credit: 0, runningBalance: 240000 },
  { date: "2026-08-13", account: "GST Payable", voucherType: "Journal Entry", voucherNo: "JV-3305", debit: 0, credit: 180000, runningBalance: 180000 },
  { date: "2026-08-12", account: "Bank — HDFC Current", voucherType: "Payment Entry", voucherNo: "PE-1101", debit: 124850, credit: 0, runningBalance: 1288000 },
  { date: "2026-08-11", account: "Laboratory Income", voucherType: "Sales Invoice", voucherNo: "INV-20478", debit: 0, credit: 41000, runningBalance: 411000 },
];

function money(v: number) {
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

// ─── KPI Strip ─────────────────────────────────────────────────────────────────
function KpiStrip({ accounts }: { accounts: Account[] }) {
  const totalAccounts = accounts.filter((a) => !a.isGroup).length;
  const unbalanced = 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: "Total Accounts", value: String(totalAccounts), note: "active leaf accounts" },
        { label: "Unbalanced Entries", value: String(unbalanced), note: unbalanced > 0 ? "fix immediately" : "all balanced", alert: unbalanced > 0 },
        { label: "Last Reconciled", value: "15 Aug 2026", note: "HDFC Current" },
        { label: "Fiscal Year", value: "FY 2026–27", note: "Apr 2026 – Mar 2027" },
      ].map((k) => (
        <div key={k.label} className={`erp-card px-4 py-3 ${k.alert ? "border-destructive/40 bg-danger-soft/30" : ""}`}>
          <p className="section-label">{k.label}</p>
          <p className={`mt-1 text-xl font-bold ${k.alert ? "text-destructive" : "text-primary"}`}>{k.value}</p>
          <p className={`mt-0.5 text-xs ${k.alert ? "text-destructive" : "text-muted-foreground"}`}>
            {k.alert && <AlertCircle className="mr-1 inline size-3" />}
            {k.note}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Account Tree Row ─────────────────────────────────────────────────────────
function AccountRow({ account, depth, isExpanded, onToggle }: {
  account: Account;
  depth: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  const typeColors: Record<string, string> = {
    Assets: "text-primary",
    Liabilities: "text-destructive",
    Equity: "text-warning",
    Income: "text-success",
    Expense: "text-warning",
  };
  return (
    <div
      className={`flex items-center gap-2 py-2 px-3 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${account.isGroup ? "font-semibold bg-muted/20" : ""}`}
      style={{ paddingLeft: `${12 + depth * 20}px` }}
      onClick={account.isGroup ? onToggle : undefined}
    >
      {account.isGroup
        ? (isExpanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />)
        : <span className="size-3.5" />
      }
      <span className="w-16 shrink-0 text-xs text-muted-foreground font-mono">{account.code}</span>
      <span className={`flex-1 text-sm ${account.isGroup ? typeColors[account.type] : "text-foreground"}`}>{account.name}</span>
      <span className={`text-sm font-medium ${account.balance >= 0 ? "text-foreground" : "text-destructive"}`}>
        {money(account.balance)}
      </span>
    </div>
  );
}

// ─── Trial Balance Row ────────────────────────────────────────────────────────
function TrialBalance({ accounts }: { accounts: Account[] }) {
  const leafAccounts = accounts.filter((a) => !a.isGroup);
  const totalDebit = leafAccounts.reduce((s, a) => s + (a.type === "Expense" || a.type === "Assets" ? a.balance : 0), 0);
  const totalCredit = leafAccounts.reduce((s, a) => s + (a.type === "Income" || a.type === "Liabilities" || a.type === "Equity" ? a.balance : 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 1;
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Opening Bal.</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Debit</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Credit</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Closing Bal.</th>
            </tr>
          </thead>
          <tbody>
            {leafAccounts.map((a) => {
              const isDebitNorm = a.type === "Assets" || a.type === "Expense";
              return (
                <tr key={a.code} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-2.5 text-right">{isDebitNorm ? money(a.balance) : "—"}</td>
                  <td className="px-4 py-2.5 text-right">{!isDebitNorm ? money(a.balance) : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{money(a.balance)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right text-foreground">{money(totalDebit)}</td>
              <td className="px-4 py-3 text-right text-foreground">{money(totalCredit)}</td>
              <td className="px-4 py-3 text-right">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${balanced ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"}`}>
                  {balanced ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                  {balanced ? "Balanced" : "Unbalanced!"}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── New Account Dialog (MongoDB-backed) ────────────────────────────────────────
function NewAccountDialog({
  open,
  onClose,
  accounts,
  onAccountCreated,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  onAccountCreated: () => void;
}) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "Assets" as Account["type"],
    parent: "",
    isGroup: false,
    openingBalance: "0",
  });
  const [saving, setSaving] = useState(false);

  const handle = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Account code and name are required");
      return;
    }
    setSaving(true);
    try {
      await createAccountFn({
        data: {
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          subtype: "",
          parent: form.parent || undefined,
          isGroup: form.isGroup,
          currency: "INR",
          openingBalance: Number(form.openingBalance) || 0,
          freezeAccount: false,
          allowReconciliation: true,
        },
      });
      toast.success(`Account ${form.code} created in MongoDB`);
      onAccountCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New GL Account</DialogTitle>
          <DialogDescription>Add a new account to the Chart of Accounts (saved to MongoDB).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Account Code *</Label>
              <Input placeholder="e.g. 4600" value={form.code} onChange={(e) => handle("code", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Account Name *</Label>
              <Input placeholder="e.g. Grooming Income" value={form.name} onChange={(e) => handle("name", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Account Type</Label>
              <Select value={form.type} onValueChange={(v) => handle("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Assets", "Liabilities", "Equity", "Income", "Expense"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Opening Balance (₹)</Label>
              <Input type="number" value={form.openingBalance} onChange={(e) => handle("openingBalance", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Parent Group Account</Label>
            <Select value={form.parent} onValueChange={(v) => handle("parent", v)}>
              <SelectTrigger><SelectValue placeholder="None (Root Account)" /></SelectTrigger>
              <SelectContent>
                {accounts.filter((a) => a.isGroup).map((a) => (
                  <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer">
            <input type="checkbox" checked={form.isGroup} onChange={(e) => handle("isGroup", e.target.checked)} className="rounded" />
            Is Group (parent account containing child accounts)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Journal Entry Dialog (MongoDB-backed) ──────────────────────────────────
function NewJournalEntryDialog({
  open,
  onClose,
  accounts,
  onJournalCreated,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  onJournalCreated: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [voucherType, setVoucherType] = useState<"Journal Entry" | "Contra Entry" | "Credit Note" | "Debit Note">("Journal Entry");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState([
    { account: accounts.find((a) => !a.isGroup)?.name || "", debit: "", credit: "" },
    { account: accounts.find((a) => !a.isGroup && a.code !== "1000")?.name || "", debit: "", credit: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const difference = totalDebit - totalCredit;
  const isBalanced = Math.abs(difference) < 0.01 && totalDebit > 0;

  const addLine = () => {
    setLines([...lines, { account: accounts.find((a) => !a.isGroup)?.name || "", debit: "", credit: "" }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) {
      toast.error("A Journal Entry requires at least 2 lines");
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const submit = async () => {
    if (!isBalanced) {
      toast.error(`Journal is not balanced! Difference: ₹${Math.abs(difference).toFixed(2)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await createJournalFn({
        data: {
          date,
          voucherType,
          narration,
          isOpeningEntry: false,
          isAccrual: false,
          lines: lines.map((l) => ({
            account: l.account,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        },
      });
      toast.success(`Journal Entry ${res.journalNo} saved to MongoDB!`);
      onJournalCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save journal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle>New Double-Entry Journal Voucher</DialogTitle>
          <DialogDescription>Debits must equal Credits to record voucher in MongoDB.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Posting Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Voucher Type</Label>
              <Select value={voucherType} onValueChange={(v) => setVoucherType(v as typeof voucherType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Journal Entry", "Contra Entry", "Credit Note", "Debit Note"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Narration / Remarks</Label>
              <Input placeholder="e.g. Monthly rent adjustment" value={narration} onChange={(e) => setNarration(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accounting Lines</p>
              <Button size="sm" variant="outline" onClick={addLine} className="h-7 text-xs">
                <Plus className="size-3 mr-1" /> Add Row
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
                  <div className="flex-1">
                    <Select value={l.account} onValueChange={(v) => updateLine(idx, "account", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => !a.isGroup).map((a) => (
                          <SelectItem key={a.code} value={a.name}>{a.code} — {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      placeholder="Debit ₹"
                      className="h-8 text-xs text-right"
                      value={l.debit}
                      onChange={(e) => {
                        updateLine(idx, "debit", e.target.value);
                        if (e.target.value) updateLine(idx, "credit", "");
                      }}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      placeholder="Credit ₹"
                      className="h-8 text-xs text-right"
                      value={l.credit}
                      onChange={(e) => {
                        updateLine(idx, "credit", e.target.value);
                        if (e.target.value) updateLine(idx, "debit", "");
                      }}
                    />
                  </div>
                  <button onClick={() => removeLine(idx)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Balance summary */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs">
            <div className="flex gap-4">
              <span>Total Debit: <strong className="text-destructive font-mono">₹{totalDebit.toFixed(2)}</strong></span>
              <span>Total Credit: <strong className="text-success font-mono">₹{totalCredit.toFixed(2)}</strong></span>
            </div>
            <div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${
                isBalanced ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"
              }`}>
                {isBalanced ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                {isBalanced ? "Balanced" : `Diff: ₹${Math.abs(difference).toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={!isBalanced || saving}>
            {saving ? "Saving…" : "Post Journal Voucher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [ledger, setLedger] = useState<LedgerEntry[]>(INITIAL_LEDGER);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1000", "4000", "5000"]));
  const [view, setView] = useState<"gl" | "tb">("gl");
  const [search, setSearch] = useState("");
  const [filterAcct, setFilterAcct] = useState("all");
  const [newAcctOpen, setNewAcctOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);

  // ── Load accounts from MongoDB ───────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    try {
      const raw = await getAccountsFn();
      if (raw && raw.length > 0) {
        const mapped: Account[] = raw.map((a: GLAccountRow) => ({
          code: a.code,
          name: a.name,
          type: a.type as Account["type"],
          isGroup: a.isGroup,
          ...(a.parent ? { parent: a.parent } : {}),
          balance: a.openingBalance,
        }));
        setAccounts(mapped);
      }
    } catch (err) {
      console.error("[ChartOfAccounts] Failed to fetch accounts:", err);
    }
  }, []);

  // ── Load journals from MongoDB ───────────────────────────────────────────────
  const fetchJournals = useCallback(async () => {
    try {
      const rawJournals = await getJournalsFn();
      if (rawJournals && rawJournals.length > 0) {
        const newLedgerEntries: LedgerEntry[] = [];
        rawJournals.forEach((j: JournalRow) => {
          j.lines.forEach((line) => {
            newLedgerEntries.push({
              date: j.date,
              account: line.account,
              voucherType: "Journal Entry",
              voucherNo: j.journalNo,
              debit: line.debit,
              credit: line.credit,
              runningBalance: line.debit || line.credit,
            });
          });
        });
        setLedger([...newLedgerEntries, ...INITIAL_LEDGER]);
      }
    } catch (err) {
      console.error("[ChartOfAccounts] Failed to fetch journals:", err);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
    void fetchJournals();
  }, [fetchAccounts, fetchJournals]);

  const toggleExpand = (code: string) => {
    setExpanded((e) => {
      const next = new Set(e);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const filteredLedger = useMemo(() => {
    return ledger.filter((e) => {
      const matchAccount = filterAcct === "all" || e.account === filterAcct;
      const matchSearch = !search || Object.values(e).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      return matchAccount && matchSearch;
    });
  }, [ledger, search, filterAcct]);

  // Build visible account tree
  const visibleAccounts: Array<{ account: Account; depth: number }> = [];
  const roots = accounts.filter((a) => !a.parent);
  const addNode = (acc: Account, depth: number) => {
    visibleAccounts.push({ account: acc, depth });
    if (acc.isGroup && expanded.has(acc.code)) {
      accounts.filter((a) => a.parent === acc.code).forEach((child) => addNode(child, depth + 1));
    }
  };
  roots.forEach((r) => addNode(r, 0));

  return (
    <div className="space-y-5">
      <KpiStrip accounts={accounts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy">Chart of Accounts & General Ledger</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setJournalOpen(true)}>
            <BookOpen className="mr-1.5 size-3.5 text-primary" /> New Journal Entry
          </Button>
          <Button size="sm" onClick={() => setNewAcctOpen(true)}>
            <Plus className="mr-1.5 size-3.5" /> New Account
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ─── Left: Account Tree ─────────────────────────────────────────────── */}
        <div className="erp-card col-span-2 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Hierarchy (Live from MongoDB)</p>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {visibleAccounts.map(({ account, depth }) => (
              <AccountRow
                key={account.code}
                account={account}
                depth={depth}
                isExpanded={expanded.has(account.code)}
                onToggle={() => toggleExpand(account.code)}
              />
            ))}
          </div>
        </div>

        {/* ─── Right: GL or Trial Balance ─────────────────────────────────────── */}
        <div className="col-span-3 space-y-4">
          {/* Segmented control */}
          <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
            {[{ id: "gl", label: "General Ledger" }, { id: "tb", label: "Trial Balance" }].map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id as "gl" | "tb")}
                className={`relative rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${view === v.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
              >
                {view === v.id && (
                  <motion.div layoutId="coaSegment" className="absolute inset-0 rounded-lg ring-1 ring-border" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative">{v.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {view === "gl" ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Search entries…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterAcct} onValueChange={setFilterAcct}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="All accounts" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All accounts</SelectItem>
                        {accounts.filter((a) => !a.isGroup).map((a) => (
                          <SelectItem key={a.code} value={a.name}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-left">
                          {["Date", "Account", "Voucher Type", "Voucher No.", "Debit", "Credit", "Balance"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLedger.map((e, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{e.date}</td>
                            <td className="px-4 py-2.5 font-medium">{e.account}</td>
                            <td className="px-4 py-2.5"><StatusPill value={e.voucherType} /></td>
                            <td className="px-4 py-2.5 font-mono text-xs text-primary">{e.voucherNo}</td>
                            <td className="px-4 py-2.5 text-right text-destructive">{e.debit ? money(e.debit) : "—"}</td>
                            <td className="px-4 py-2.5 text-right text-success">{e.credit ? money(e.credit) : "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{money(e.runningBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <TrialBalance accounts={accounts} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <NewAccountDialog
        open={newAcctOpen}
        onClose={() => setNewAcctOpen(false)}
        accounts={accounts}
        onAccountCreated={fetchAccounts}
      />

      <NewJournalEntryDialog
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        accounts={accounts}
        onJournalCreated={fetchJournals}
      />
    </div>
  );
}
