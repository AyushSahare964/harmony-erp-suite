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
type ARStatus = "Unpaid" | "Partially paid" | "Overdue";
type APStatus = "Unpaid" | "Partially paid" | "Overdue";

interface ARRow {
  owner: string; invoice: string; date: string; due: string;
  amount: number; outstanding: number; bucket: Bucket; status: ARStatus;
}
interface APRow {
  supplier: string; bill: string; date: string; due: string;
  amount: number; outstanding: number; bucket: Bucket; status: APStatus;
}
interface JETemplate { name: string; accounts: string; narration: string; }

// ─── Initial Data ─────────────────────────────────────────────────────────────
const INITIAL_AR: ARRow[] = [
  { owner: "Tariq Hussain", invoice: "INV-20483", date: "2026-08-13", due: "2026-08-20", amount: 1650, outstanding: 1650, bucket: "0–30", status: "Unpaid" },
  { owner: "Rajan Kumar", invoice: "INV-20484", date: "2026-08-13", due: "2026-08-20", amount: 600, outstanding: 600, bucket: "0–30", status: "Unpaid" },
  { owner: "Vikram Shetty", invoice: "INV-20485", date: "2026-08-14", due: "2026-08-21", amount: 4500, outstanding: 2250, bucket: "0–30", status: "Partially paid" },
  { owner: "Deepika Iyer", invoice: "INV-20401", date: "2026-07-18", due: "2026-07-25", amount: 3200, outstanding: 3200, bucket: "31–60", status: "Overdue" },
  { owner: "Nalini Prasad", invoice: "INV-20312", date: "2026-06-10", due: "2026-06-17", amount: 8400, outstanding: 8400, bucket: "61–90", status: "Overdue" },
  { owner: "Ananya Sharma", invoice: "INV-20215", date: "2026-05-01", due: "2026-05-08", amount: 1800, outstanding: 1800, bucket: "90+", status: "Overdue" },
];

const INITIAL_AP: APRow[] = [
  { supplier: "MedVet Distributors", bill: "PO-5501", date: "2026-08-12", due: "2026-08-26", amount: 112000, outstanding: 112000, bucket: "0–30", status: "Unpaid" },
  { supplier: "BioPharm", bill: "PO-5502", date: "2026-08-10", due: "2026-08-24", amount: 48000, outstanding: 24000, bucket: "0–30", status: "Partially paid" },
  { supplier: "PetNutri", bill: "PO-5432", date: "2026-07-20", due: "2026-08-03", amount: 32000, outstanding: 32000, bucket: "31–60", status: "Overdue" },
  { supplier: "CareSupplies", bill: "PO-5388", date: "2026-07-05", due: "2026-07-19", amount: 18000, outstanding: 18000, bucket: "31–60", status: "Overdue" },
];

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

// ─── Payment Entry Dialog (MongoDB-backed) ──────────────────────────────────────
function PaymentEntryDialog({
  open,
  onClose,
  partyType,
  onPaymentSaved,
}: {
  open: boolean;
  onClose: () => void;
  partyType: "Customer" | "Supplier";
  onPaymentSaved: () => void;
}) {
  const [form, setForm] = useState({
    party: "",
    invoice: "",
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
      toast.error("Please fill Party Name and a valid Amount");
      return;
    }
    setSaving(true);
    try {
      const paidAmt = Number(form.amount);
      const res = await createPaymentFn({
        data: {
          paymentType: partyType === "Customer" ? "Receive" : "Pay",
          paymentDate: form.date,
          partyType: partyType,
          partyName: form.party.trim(),
          modeOfPayment: form.mode,
          bankAccount: form.bank,
          referenceNo: form.ref || undefined,
          paidAmount: paidAmt,
          narration: form.narration || undefined,
          references: form.invoice ? [
            {
              invoiceNo: form.invoice,
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
          <DialogTitle>New Payment Entry — {partyType}</DialogTitle>
          <DialogDescription>
            Record payment {partyType === "Customer" ? "received from" : "made to"} a {partyType.toLowerCase()}. Auto-generates unique sequence ID in MongoDB.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Party Type</Label>
              <Input value={partyType} disabled className="bg-muted/40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{partyType} Name *</Label>
              <Input placeholder={partyType === "Customer" ? "e.g. Tariq Hussain" : "e.g. BioPharm"} value={form.party} onChange={(e) => handle("party", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Reference {partyType === "Customer" ? "Invoice" : "Bill"}</Label>
              <Input placeholder={partyType === "Customer" ? "INV-20483" : "PO-5501"} value={form.invoice} onChange={(e) => handle("invoice", e.target.value)} />
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
            <Input placeholder="e.g. Full settlement against invoice" value={form.narration} onChange={(e) => handle("narration", e.target.value)} />
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

// ─── AR / AP Table ─────────────────────────────────────────────────────────────
function ARTable({ data, onPayment }: { data: ARRow[]; onPayment: () => void }) {
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");
  const filtered = useMemo(() =>
    data.filter((r) => {
      const matchS = !search || [r.owner, r.invoice].some((v) => v.toLowerCase().includes(search.toLowerCase()));
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
          { label: "Total Receivables", value: money(total), tone: "" },
          { label: "Overdue (all buckets)", value: money(overdue), tone: "text-destructive" },
          { label: "Avg. Collection Period", value: "28 days", tone: "" },
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
          <Input placeholder="Search owner or invoice…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Ageing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buckets</SelectItem>
            {["0–30", "31–60", "61–90", "90+"].map((b) => <SelectItem key={b} value={b}>{b} days</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onPayment} className="bg-success text-success-foreground hover:bg-success/90">
          <Plus className="mr-1.5 size-3.5" />Record Payment
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              {["Customer", "Invoice No.", "Invoice Date", "Due Date", "Invoice Amount", "Outstanding", "Ageing", "Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-medium">{r.owner}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-primary">{r.invoice}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
          { label: "Avg. Payment Cycle", value: "21 days", tone: "" },
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
            {filtered.map((r, i) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function ReceivablesPayables() {
  const [view, setView] = useState<"ar" | "ap">("ar");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [templates, setTemplates] = useState<JETemplate[]>(INITIAL_TEMPLATES);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: "", accounts: "", narration: "" });

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
      {/* Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {[{ id: "ar", label: "Accounts Receivable" }, { id: "ap", label: "Accounts Payable" }].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id as "ar" | "ap")}
              className={`relative rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${view === v.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              {view === v.id && <motion.div layoutId="arSegment" className="absolute inset-0 rounded-lg ring-1 ring-border" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative">{v.label}</span>
            </button>
          ))}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${view === "ar" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
          {view === "ar" ? "Money owed to clinic" : "Money clinic owes"}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {view === "ar"
            ? <ARTable data={INITIAL_AR} onPayment={() => setPaymentOpen(true)} />
            : <APTable data={INITIAL_AP} onPayment={() => setPaymentOpen(true)} />
          }
        </motion.div>
      </AnimatePresence>

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
        partyType={view === "ar" ? "Customer" : "Supplier"}
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
