import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ExternalLink, CheckCircle2, DollarSign } from "lucide-react";
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
  createPaymentFn,
  getPaymentsFn,
  type PaymentRow,
} from "@/lib/mongodb/serverFns/finance";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Bucket = "0–30" | "31–60" | "61–90" | "90+";
type APStatus = "Unpaid" | "Partially paid" | "Overdue";

interface APRow {
  supplier: string; bill: string; date: string; due: string;
  amount: number; outstanding: number; bucket: Bucket; status: APStatus;
}
interface JETemplate { name: string; accounts: string; narration: string; }

// ─── Initial Data ─────────────────────────────────────────────────────────────
const INITIAL_AP: APRow[] = [];

const INITIAL_TEMPLATES: JETemplate[] = [
  { name: "Monthly Rent", accounts: "Rent Expense → Cash", narration: "Monthly clinic rent payment" },
  { name: "Bank Charges", accounts: "Bank Charges → Bank", narration: "Monthly bank service charges" },
  { name: "Depreciation Entry", accounts: "Depreciation → Fixed Assets", narration: "Monthly equipment depreciation" },
];

function money(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

const BUCKET_COLORS: Record<Bucket, string> = {
  "0–30": "bg-success-soft text-success",
  "31–60": "bg-warning-soft text-warning",
  "61–90": "bg-warning-soft text-warning",
  "90+": "bg-danger-soft text-destructive",
};

// ─── Payment Entry Dialog (MongoDB-backed Supplier Payment) ────────────────────
function PaymentEntryDialog({
  open,
  onClose,
  onPaymentSaved,
}: {
  open: boolean;
  onClose: () => void;
  onPaymentSaved: () => void;
}) {
  const [form, setForm] = useState({
    party: "",
    bill: "",
    amount: "",
    mode: "UPI",
    bank: "HDFC Current",
    ref: "",
    date: new Date().toISOString().slice(0, 10),
    narration: "",
  });
  const [saving, setSaving] = useState(false);

  const handle = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.party.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error("Please fill Supplier Name and a valid Amount");
      return;
    }
    setSaving(true);
    try {
      const paidAmt = Number(form.amount);
      const res = await createPaymentFn({
        data: {
          paymentType: "Pay",
          paymentDate: form.date,
          partyType: "Supplier",
          partyName: form.party.trim(),
          modeOfPayment: form.mode,
          bankAccount: form.bank,
          referenceNo: form.ref || undefined,
          paidAmount: paidAmt,
          narration: form.narration || undefined,
          references: form.bill ? [
            {
              invoiceNo: form.bill,
              invoiceDate: form.date,
              dueDate: form.date,
              invoiceAmount: paidAmt,
              outstanding: 0,
              allocatedAmount: paidAmt,
            }
          ] : [],
        },
      });
      toast.success(`Payment entry ${res.paymentNo} recorded in MongoDB!`);
      onPaymentSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Payment Entry — Supplier</DialogTitle>
          <DialogDescription>
            Record payment made to a supplier. Auto-generates unique sequence ID in MongoDB.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Party Type</Label>
              <Input value="Supplier" disabled className="bg-muted/40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Supplier Name *</Label>
              <Input placeholder="e.g. BioPharm / Apex Med" value={form.party} onChange={(e) => handle("party", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Reference PO Bill No.</Label>
              <Input placeholder="PO-5501" value={form.bill} onChange={(e) => handle("bill", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Amount (₹) *</Label>
              <Input type="number" placeholder="0" value={form.amount} onChange={(e) => handle("amount", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mode of Payment</Label>
              <Select value={form.mode} onValueChange={(v) => handle("mode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "UPI", "Card", "Bank Transfer", "Cheque"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bank Account</Label>
              <Select value={form.bank} onValueChange={(v) => handle("bank", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HDFC Current">HDFC Current ••••4821</SelectItem>
                  <SelectItem value="SBI Savings">SBI Savings ••••1902</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Reference No. (UTR / Cheque)</Label>
              <Input placeholder="UTR / Cheque no." value={form.ref} onChange={(e) => handle("ref", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Posting Date</Label>
              <Input type="date" value={form.date} onChange={(e) => handle("date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Narration / Notes</Label>
            <Input placeholder="e.g. Full settlement against PO bill" value={form.narration} onChange={(e) => handle("narration", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save Payment to MongoDB"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function APTable({ data, onPayment }: { data: APRow[]; onPayment: () => void }) {
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");
  const filtered = useMemo(() =>
    data.filter((r) => {
      const matchS = !search || [r.supplier, r.bill].some((v) => v.toLowerCase().includes(search.toLowerCase()));
      const matchB = bucketFilter === "all" || r.bucket === bucketFilter;
      return matchS && matchB;
    }),
    [data, search, bucketFilter]
  );
  const total = data.reduce((s, r) => s + r.outstanding, 0);
  const overdue = data.filter((r) => r.status === "Overdue").reduce((s, r) => s + r.outstanding, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Payables", value: money(total), tone: "" },
          { label: "Overdue (all buckets)", value: money(overdue), tone: "text-destructive" },
          { label: "Avg. Payment Cycle", value: data.length > 0 ? "21 days" : "—", tone: "" },
        ].map((k) => (
          <div key={k.label} className="erp-card px-4 py-3">
            <p className="section-label">{k.label}</p>
            <p className={`mt-1 text-xl font-bold ${k.tone || "text-primary"}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search supplier or PO bill…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Ageing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buckets</SelectItem>
            {["0–30", "31–60", "61–90", "90+"].map((b) => <SelectItem key={b} value={b}>{b} days</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onPayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          <Plus className="mr-1.5 size-3.5" />Record Payment
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              {["Supplier", "PO Bill No.", "Bill Date", "Due Date", "Bill Amount", "Outstanding", "Ageing", "Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No accounts payable records found.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.supplier}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{r.bill}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.due}</td>
                  <td className="px-4 py-2.5 text-right">{money(r.amount)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-destructive">{money(r.outstanding)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BUCKET_COLORS[r.bucket]}`}>
                      {r.bucket}d
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill value={r.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { listPurchaseBillsFn } from "@/lib/mongodb/serverFns/purchaseBills";

// ─── Main Component ────────────────────────────────────────────────────────────
export function ReceivablesPayables() {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [templates, setTemplates] = useState<JETemplate[]>(INITIAL_TEMPLATES);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: "", accounts: "", narration: "" });
  const [apRows, setApRows] = useState<APRow[]>(INITIAL_AP);

  const fetchPayments = useCallback(async () => {
    try {
      const raw = await getPaymentsFn({ data: { partyType: "all" } });
      if (raw) setPayments(raw);
    } catch (err) {
      console.error("[ReceivablesPayables] Failed to load payments:", err);
    }
  }, []);

  useEffect(() => {
    void fetchPayments();

    listPurchaseBillsFn({ data: { status: "ALL" } })
      .then((bills) => {
        const active = bills.filter((b) => b.status !== "VOID");
        const today = new Date();
        const mapped: APRow[] = active.map((b) => {
          const out = Math.max(0, b.grandTotal - b.amountPaid);
          const billD = new Date(b.billDate);
          const diffDays = Math.floor((today.getTime() - billD.getTime()) / (1000 * 3600 * 24));
          let bucket: Bucket = "0–30";
          if (diffDays > 90) bucket = "90+";
          else if (diffDays > 60) bucket = "61–90";
          else if (diffDays > 30) bucket = "31–60";

          let status: APStatus = "Unpaid";
          if (b.status === "PAID") status = "Unpaid";
          else if (b.status === "PARTIAL") status = "Partially paid";
          else if (diffDays > 30) status = "Overdue";

          return {
            supplier: b.supplierName,
            bill: b.internalRef || b.billNumber,
            date: b.billDate,
            due: b.dueDate || b.billDate,
            amount: b.grandTotal,
            outstanding: out,
            bucket,
            status,
          };
        });
        setApRows(mapped);
      })
      .catch((err) => console.error("Error loading bills in AP:", err));
  }, [fetchPayments]);

  const addTemplate = () => {
    if (!newTpl.name || !newTpl.accounts) {
      toast.error("Template name and accounts are required");
      return;
    }
    setTemplates([...templates, newTpl]);
    toast.success("Journal Entry Template created");
    setNewTpl({ name: "", accounts: "", narration: "" });
    setNewTemplateOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-foreground">Accounts Payable (AP) &amp; Ageing</h3>
          <p className="text-xs text-muted-foreground">Real-time supplier liability tracking calculated from purchase bills and outgoing payments</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-bold bg-warning-soft text-warning">
          Money clinic owes to suppliers
        </span>
      </div>

      <APTable data={apRows} onPayment={() => setPaymentOpen(true)} />

      {/* Recorded MongoDB Payments */}
      {payments.length > 0 && (
        <div className="erp-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-label">MongoDB Payment Entries Ledger</p>
            <span className="text-xs text-muted-foreground font-mono">{payments.length} entries</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  {["Payment No.", "Date", "Party Type", "Party Name", "Amount", "Mode", "Bank", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p._id || p.paymentNo || i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{p.paymentNo || `PE-${i + 1}`}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.paymentDate || "—"}</td>
                    <td className="px-4 py-2.5"><StatusPill value={p.partyType || "Party"} /></td>
                    <td className="px-4 py-2.5 font-medium">{p.partyName || "—"}</td>
                    <td className="px-4 py-2.5 font-semibold">₹{(p.paidAmount ?? 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.modeOfPayment || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.bankAccount || "—"}</td>
                    <td className="px-4 py-2.5"><StatusPill value={p.status || "Submitted"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Journal Entry Templates */}
      <div className="erp-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Journal Entry Templates</p>
          <Button variant="outline" size="sm" onClick={() => setNewTemplateOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />New Template
          </Button>
        </div>
        <div className="divide-y divide-border">
          {templates.map((t) => (
            <div key={t.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.accounts} · {t.narration}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    setTemplates(templates.filter((x) => x.name !== t.name));
                    toast.success(`Template ${t.name} removed`);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PaymentEntryDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onPaymentSaved={fetchPayments}
      />

      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Journal Template</DialogTitle>
            <DialogDescription>Create a reusable double-entry journal template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Template Name</Label>
              <Input placeholder="e.g. Utility Bills" value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Accounts Flow</Label>
              <Input placeholder="e.g. Utilities Expense → Bank" value={newTpl.accounts} onChange={(e) => setNewTpl({ ...newTpl, accounts: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default Narration</Label>
              <Input placeholder="e.g. Electricity and water bill" value={newTpl.narration} onChange={(e) => setNewTpl({ ...newTpl, narration: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTemplateOpen(false)}>Cancel</Button>
            <Button onClick={addTemplate}>Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
