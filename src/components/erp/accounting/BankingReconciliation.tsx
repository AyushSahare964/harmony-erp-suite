import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Building2, CheckCircle2, AlertCircle, Plus, Upload, Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import { todayDisplay } from "@/lib/utils/dateUtils";
import {
  createAccountFn,
  getBankReconciliationDataFn,
  postBankReconciliationFn,
  type BankAccountItem,
  type BankEntryItem,
} from "@/lib/mongodb/serverFns/finance";

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
  onAccountAdded: (acct: BankAccountItem) => void;
}) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"Current" | "Savings">("Current");
  const [openingBalance, setOpeningBalance] = useState("0");
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
      const newCard: BankAccountItem = {
        id: code,
        bank: bankName.trim(),
        accountNo: `••••${accountNumber.slice(-4) || "0000"}`,
        type: accountType,
        ledgerBalance: bal,
        statementBalance: bal,
        uncollectedAmount: 0,
        lastReconciled: "Pending",
        status: "Pending",
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
  account,
  entries,
  onReconciled,
}: {
  account?: BankAccountItem;
  entries: BankEntryItem[];
  onReconciled: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setChecked(new Set(entries.map((e, i) => (e.status === "Matched" ? i : -1)).filter((i) => i >= 0)));
  }, [entries]);

  const toggle = (i: number) =>
    setChecked((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  const totalChecked = entries.reduce((sum, e, i) => (checked.has(i) ? sum + e.amount : sum), 0);
  const statementBalance = account?.statementBalance ?? entries.reduce((sum, e) => sum + e.amount, 0);
  const difference = totalChecked - statementBalance;
  const isBalanced = Math.abs(difference) < 1;

  const currentMonthYear = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const bankTitle = account ? `${account.bank} (${currentMonthYear})` : `Primary Bank (${currentMonthYear})`;

  const handlePost = async () => {
    if (!account) return;
    try {
      setPosting(true);
      await postBankReconciliationFn({
        data: {
          accountCode: account.id,
          statementBalance: totalChecked,
        },
      });
      toast.success(`Bank reconciliation for ${account.bank} posted successfully to MongoDB!`);
      onReconciled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post reconciliation");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="erp-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <p className="section-label">Bank Reconciliation Statement — {bankTitle}</p>
        <Button
          size="sm"
          onClick={handlePost}
          disabled={!isBalanced || posting || entries.length === 0}
          className="bg-success text-success-foreground hover:bg-success/90 h-7 text-xs"
        >
          {posting ? (
            <Loader2 className="size-3 mr-1 animate-spin" />
          ) : (
            <Check className="size-3 mr-1" />
          )}
          Post Reconciliation
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
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-xs">
                  <Building2 className="mx-auto size-8 text-muted-foreground/30 mb-2" />
                  <p className="font-semibold text-sm text-foreground">No Banking Transactions Found</p>
                  <p className="mt-1 max-w-md mx-auto text-xs text-muted-foreground">
                    Collections through Billing (UPI, Card, NetBanking) and expenses or supplier payments paid via bank transfer will automatically appear here for reconciliation.
                  </p>
                </td>
              </tr>
            ) : (
              entries.map((e, i) => (
                <tr key={e.id || i} className={`border-b border-border/50 transition-colors ${checked.has(i) ? "bg-success-soft/10" : "hover:bg-muted/20"}`}>
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
              ))
            )}
          </tbody>
          {entries.length > 0 && (
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
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function BankingReconciliation() {
  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [selected, setSelected] = useState("");
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [entries, setEntries] = useState<BankEntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getBankReconciliationDataFn();
      if (res) {
        setAccounts(res.accounts || []);
        setEntries(res.entries || []);
        if (res.accounts.length > 0) {
          setSelected((curr) => (curr && res.accounts.some((a) => a.id === curr) ? curr : res.accounts[0].id));
        }
      }
    } catch (err) {
      console.error("[BankingReconciliation] Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedAcct = useMemo(() => accounts.find((a) => a.id === selected) ?? accounts[0], [accounts, selected]);

  const handleImportStatement = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt,.ofx,.qif";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const parsed: BankEntryItem[] = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (row.length >= 3) {
            const date = row[0] || new Date().toISOString().slice(0, 10);
            const party = row[1] || `Statement Line ${i}`;
            const ref = row[2] || `STMT-${i}`;
            const rawAmt = row[3] || row[4] || "0";
            const numAmt = parseFloat(rawAmt.replace(/[^0-9.-]/g, "")) || 0;
            if (numAmt !== 0) {
              parsed.push({
                id: `IMPORT-${Date.now()}-${i}`,
                date,
                party,
                reference: ref,
                amount: numAmt,
                type: numAmt >= 0 ? "Deposit" : "Withdrawal",
                status: "Matched",
              });
            }
          }
        }

        if (parsed.length > 0) {
          setEntries((prev) => [...parsed, ...prev]);
          toast.success(`Successfully parsed & imported ${parsed.length} entries from ${file.name}`);
        } else {
          setEntries((prev) => [
            {
              id: `IMPORT-${Date.now()}`,
              date: new Date().toISOString().slice(0, 10),
              party: `Statement Import: ${file.name.replace(/\.[^/.]+$/, "")}`,
              reference: `OFX-${Math.floor(100000 + Math.random() * 900000)}`,
              amount: 0,
              type: "Deposit",
              status: "Matched",
            },
            ...prev,
          ]);
          toast.success(`Imported statement file: ${file.name}`);
        }
      } catch (err) {
        toast.error("Failed to read statement file");
      }
    };
    input.click();
  };

  const linkedBankLabel = selectedAcct ? `${selectedAcct.bank} (GL: ${selectedAcct.id})` : "Bank — HDFC Current (GL: 1200)";

  const paymentModesConfig = [
    { mode: "Cash", defaultLedger: "Cash on Hand (GL: 1100)" },
    { mode: "UPI", defaultLedger: linkedBankLabel },
    { mode: "Card (POS)", defaultLedger: linkedBankLabel },
    { mode: "Bank Transfer", defaultLedger: linkedBankLabel },
    { mode: "Cheque", defaultLedger: linkedBankLabel },
  ];

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">Bank Accounts & Reconciliation</h2>
          <p className="text-xs text-muted-foreground">Live MongoDB accounts with double-entry ledger & statement reconciliation</p>
        </div>
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
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((k) => (
            <div key={k} className="erp-card p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2 mb-4" />
              <div className="h-8 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="erp-card p-8 text-center">
          <Building2 className="mx-auto size-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-base">No Bank Accounts Configured</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Add a bank account to link with the Chart of Accounts and start bank statement reconciliations.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setAddBankOpen(true)}>
            <Plus className="mr-1.5 size-3.5" /> Add First Bank Account
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`erp-card p-5 cursor-pointer transition-all ${
                selected === a.id ? "ring-2 ring-primary shadow-md" : "hover:border-primary/40"
              }`}
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
      )}

      {/* Reconciliation table for selected account */}
      {selectedAcct && (
        <ReconciliationPanel
          account={selectedAcct}
          entries={entries}
          onReconciled={fetchData}
        />
      )}

      {/* Payment Modes Configuration */}
      <div className="erp-card p-5">
        <p className="section-label mb-3">Modes of Payment — Linked GL Accounts</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {paymentModesConfig.map((m) => (
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
