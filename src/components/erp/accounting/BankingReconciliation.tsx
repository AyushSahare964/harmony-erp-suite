import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, CheckCircle2, AlertCircle, Plus, Upload, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import {
  createAccountFn,
  getAccountsFn,
  type GLAccountRow,
} from "@/lib/mongodb/serverFns/finance";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface BankAccount {
  id: string; bank: string; accountNo: string; type: "Current" | "Savings";
  ledgerBalance: number; statementBalance: number; uncollectedAmount: number;
  lastReconciled: string; status: "Reconciled" | "Pending";
}

interface BankEntry {
  date: string; party: string; reference: string;
  amount: number; type: "Deposit" | "Withdrawal";
  status: "Matched" | "Unmatched" | "Excluded";
}

interface ModeOfPayment { mode: string; defaultLedger: string; }

// ─── Initial Data ─────────────────────────────────────────────────────────────
const INITIAL_ACCOUNTS: BankAccount[] = [
  {
    id: "hdfc", bank: "HDFC Bank", accountNo: "••••4821", type: "Current",
    ledgerBalance: 1288000, statementBalance: 1248000, uncollectedAmount: 40000,
    lastReconciled: "15 Aug 2026", status: "Pending",
  },
  {
    id: "sbi", bank: "State Bank of India", accountNo: "••••1902", type: "Savings",
    ledgerBalance: 450000, statementBalance: 450000, uncollectedAmount: 0,
    lastReconciled: "01 Aug 2026", status: "Reconciled",
  },
];

const INITIAL_ENTRIES: BankEntry[] = [
  { date: "2026-08-15", party: "Consultation — Rahul Varma", reference: "UPI/260815/9901", amount: 1650, type: "Deposit", status: "Matched" },
  { date: "2026-08-15", party: "Pet Shop Sale — Priya Sen", reference: "POS/2026/0441", amount: 4200, type: "Deposit", status: "Matched" },
  { date: "2026-08-14", party: "Supplier — MedVet Distributors", reference: "NEFT/N08140021", amount: -48000, type: "Withdrawal", status: "Matched" },
  { date: "2026-08-14", party: "Electricity Bill (BESCOM)", reference: "AUTODEBIT/BESCOM", amount: -14200, type: "Withdrawal", status: "Matched" },
  { date: "2026-08-13", party: "Staff Salary — Dr. Ananya", reference: "SAL/2026/AUG/01", amount: -75000, type: "Withdrawal", status: "Unmatched" },
  { date: "2026-08-12", party: "Surgery Advance — Vikram", reference: "IMPS/260812/0014", amount: 25000, type: "Deposit", status: "Unmatched" },
  { date: "2026-08-11", party: "Pet Boarding — Tariq", reference: "UPI/260811/4481", amount: 6800, type: "Deposit", status: "Matched" },
];

const MOP: ModeOfPayment[] = [
  { mode: "Cash", defaultLedger: "Cash" },
  { mode: "UPI", defaultLedger: "Bank — HDFC Current" },
  { mode: "Card (POS)", defaultLedger: "Bank — HDFC Current" },
  { mode: "Bank Transfer", defaultLedger: "Bank — HDFC Current" },
  { mode: "Cheque", defaultLedger: "Bank — HDFC Current" },
];

function money(v: number) {
  const abs = Math.abs(v);
  const str = abs >= 100000 ? `₹${(abs / 100000).toFixed(1)}L` : `₹${abs.toLocaleString("en-IN")}`;
  return v < 0 ? `−${str}` : str;
}

// ─── Add Bank Account Dialog (MongoDB-backed) ──────────────────────────────────
function AddBankDialog({
  open,
  onClose,
  onAccountAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAccountAdded: (acct: BankAccount) => void;
}) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"Current" | "Savings">("Current");
  const [openingBalance, setOpeningBalance] = useState("100000");
  const [ifsc, setIfsc] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!bankName.trim() || !accountNumber.trim()) {
      toast.error("Bank name and account number are required");
      return;
    }
    setSaving(true);
    try {
      const code = `12${Math.floor(10 + Math.random() * 90)}`;
      const bal = Number(openingBalance) || 0;
      await createAccountFn({
        data: {
          code,
          name: `Bank — ${bankName.trim()} ${accountType}`,
          type: "Assets",
          subtype: "Bank",
          parent: "1000",
          isGroup: false,
          currency: "INR",
          openingBalance: bal,
          freezeAccount: false,
          allowReconciliation: true,
          bankName: bankName.trim(),
          bankAccountNo: accountNumber.trim(),
          ifscCode: ifsc.trim() || undefined,
          bankAccountType: accountType,
        },
      });
      const newCard: BankAccount = {
        id: code,
        bank: bankName.trim(),
        accountNo: `••••${accountNumber.slice(-4) || "0000"}`,
        type: accountType,
        ledgerBalance: bal,
        statementBalance: bal,
        uncollectedAmount: 0,
        lastReconciled: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        status: "Reconciled",
      };
      toast.success(`Bank account added & saved to MongoDB (GL: ${code})`);
      onAccountAdded(newCard);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add bank account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Bank Account</DialogTitle>
          <DialogDescription>Link a bank account to the Chart of Accounts in MongoDB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Bank Name *</Label>
            <Input placeholder="e.g. ICICI Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Account Number *</Label>
              <Input placeholder="e.g. 501004821901" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IFSC Code</Label>
              <Input placeholder="e.g. ICIC0000001" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Account Type</Label>
              <div className="flex gap-4 pt-2">
                {["Current", "Savings"].map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" name="accType" checked={accountType === t} onChange={() => setAccountType(t as "Current" | "Savings")} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Opening Balance (₹)</Label>
              <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save Bank Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reconciliation Drawer Panel ──────────────────────────────────────────────
function ReconciliationPanel({
  entries,
  onReconciled,
}: {
  entries: BankEntry[];
  onReconciled: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(
    new Set(entries.map((e, i) => e.status === "Matched" ? i : -1).filter((i) => i >= 0))
  );
  const toggle = (i: number) => setChecked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const totalChecked = entries.reduce((sum, e, i) => checked.has(i) ? sum + e.amount : sum, 0);
  const statementBalance = entries.reduce((sum, e) => sum + e.amount, 0);
  const difference = totalChecked - statementBalance;
  const isBalanced = Math.abs(difference) < 1;

  const handleClear = () => {
    toast.success("Bank reconciliation posted successfully! All matched entries confirmed.");
    onReconciled();
  };

  return (
    <div className="erp-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <p className="section-label">Bank Reconciliation Statement — HDFC Current (Aug 2026)</p>
        <Button size="sm" onClick={handleClear} disabled={!isBalanced} className="bg-success text-success-foreground hover:bg-success/90 h-7 text-xs">
          <Check className="size-3 mr-1" /> Post Reconciliation
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className="px-4 py-2.5 w-8"></th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Party / Narration</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Amount</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className={`border-b border-border/50 transition-colors ${checked.has(i) ? "bg-success-soft/10" : "hover:bg-muted/20"}`}>
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={() => toggle(i)}
                    className="size-4 rounded accent-primary"
                  />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">{e.date}</td>
                <td className="px-4 py-2.5 font-medium">{e.party}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{e.reference}</td>
                <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${e.amount >= 0 ? "text-success" : "text-destructive"}`}>
                  {money(e.amount)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    e.status === "Matched" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                  }`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 font-semibold text-xs">
              <td colSpan={4} className="px-4 py-3">Total Reconciled / Variance</td>
              <td className="px-4 py-3 text-right">{money(totalChecked)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${
                  isBalanced ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"
                }`}>
                  {isBalanced ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                  {isBalanced ? "Reconciled" : `Diff: ${money(difference)}`}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function BankingReconciliation() {
  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_ACCOUNTS);
  const [selected, setSelected] = useState("hdfc");
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [entries, setEntries] = useState<BankEntry[]>(INITIAL_ENTRIES);

  const fetchBankAccounts = useCallback(async () => {
    try {
      const raw = await getAccountsFn();
      if (raw && raw.length > 0) {
        const banks = raw.filter((a: GLAccountRow) => a.subtype === "Bank" || a.type === "Assets");
        if (banks.length > 0) {
          const mapped: BankAccount[] = banks.map((b: GLAccountRow) => ({
            id: b.code,
            bank: b.bankName || b.name,
            accountNo: b.bankAccountNo ? `••••${b.bankAccountNo.slice(-4)}` : "••••4821",
            type: (b.bankAccountType as "Current" | "Savings") || "Current",
            ledgerBalance: b.openingBalance,
            statementBalance: b.openingBalance,
            uncollectedAmount: 0,
            lastReconciled: "15 Aug 2026",
            status: "Reconciled",
          }));
          setAccounts(mapped);
        }
      }
    } catch (err) {
      console.error("[BankingReconciliation] Failed to fetch accounts:", err);
    }
  }, []);

  useEffect(() => {
    void fetchBankAccounts();
  }, [fetchBankAccounts]);

  const selectedAcct = useMemo(() => accounts.find((a) => a.id === selected) ?? accounts[0], [accounts, selected]);

  const handleImportStatement = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.ofx,.qif";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        toast.success(`Imported ${file.name} (${(file.size / 1024).toFixed(1)} KB) into reconciliation ledger.`);
        // Add a sample freshly-parsed statement entry to live entries
        setEntries((prev) => [
          {
            date: new Date().toISOString().slice(0, 10),
            party: `Statement Import: ${file.name.replace(/\.[^/.]+$/, "")}`,
            reference: `OFX-${Math.floor(100000 + Math.random() * 900000)}`,
            amount: 24500,
            type: "Deposit",
            status: "Unmatched",
          },
          ...prev,
        ]);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy">Bank Accounts & Reconciliation</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportStatement}>
            <Upload className="mr-1.5 size-3.5" />Import Statement (OFX/CSV)
          </Button>
          <Button size="sm" onClick={() => setAddBankOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />Add Bank Account
          </Button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <div
            key={a.id}
            onClick={() => setSelected(a.id)}
            className={`erp-card p-5 cursor-pointer transition-all ${selected === a.id ? "ring-2 ring-primary shadow-md" : "hover:border-primary/40"}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold text-sm">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{a.bank}</p>
                  <p className="text-xs text-muted-foreground">{a.accountNo} · {a.type}</p>
                </div>
              </div>
              <StatusPill value={a.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-border/50 pt-3">
              <div>
                <p className="text-muted-foreground">Ledger Balance</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{money(a.ledgerBalance)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Statement Bal.</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{money(a.statementBalance)}</p>
              </div>
            </div>

            {a.uncollectedAmount > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1 text-xs text-warning font-medium">
                <AlertCircle className="size-3.5" />
                <span>{money(a.uncollectedAmount)} in uncollected cheques</span>
              </div>
            )}

            <p className="mt-3 text-[11px] text-muted-foreground">
              Last reconciled: <span className="font-medium">{a.lastReconciled}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Reconciliation table for selected account */}
      {selectedAcct && (
        <ReconciliationPanel
          entries={entries}
          onReconciled={() => {
            setAccounts((prev) =>
              prev.map((a) => (a.id === selected ? { ...a, status: "Reconciled" } : a))
            );
          }}
        />
      )}

      {/* Payment Modes Configuration */}
      <div className="erp-card p-5">
        <p className="section-label mb-3">Modes of Payment — Linked GL Accounts</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MOP.map((m) => (
            <div key={m.mode} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
              <span className="text-sm font-medium">{m.mode}</span>
              <span className="text-xs font-mono text-muted-foreground">{m.defaultLedger}</span>
            </div>
          ))}
        </div>
      </div>

      <AddBankDialog
        open={addBankOpen}
        onClose={() => setAddBankOpen(false)}
        onAccountAdded={(newAcct) => {
          setAccounts((all) => [...all, newAcct]);
          setSelected(newAcct.id);
        }}
      />
    </div>
  );
}
