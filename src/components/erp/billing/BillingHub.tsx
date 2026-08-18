import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Receipt, ShoppingCart, Image, BarChart3, Zap, RefreshCw,
  Plus, Download, RotateCcw, Search, Trash2, ArrowLeft,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { ManualBilling }      from "@/components/erp/billing/ManualBilling";
import { BillPhotoGallery }   from "@/components/erp/billing/BillPhotoGallery";
import { PaymentAnalytics }   from "@/components/erp/billing/PaymentAnalytics";
import { RazorpayGateway }    from "@/components/erp/billing/RazorpayGateway";
import { SubscriptionBilling } from "@/components/erp/billing/SubscriptionBilling";

/* ─── Types ──────────────────────────────────────────────────────── */
type TabId = "invoices" | "manual" | "photos" | "analytics" | "razorpay" | "subscriptions";

interface TabDef {
  id: TabId;
  label: string;
  Icon: React.FC<{ className?: string }>;
  badge?: string;
}

/* ─── Billing workspace data (local, mirrors workspaces.ts) ─────── */
const BILLING_KPIS = [
  { label: "Unpaid invoices",  value: "23",        trend: "₹38,400",    trendTone: "down"  as const },
  { label: "Collected today",  value: "₹1,24,850", trend: "+12.4%",     trendTone: "up"    as const },
  { label: "Unreconciled",     value: "17",        trend: "gateway sync",trendTone: "flat"  as const },
  { label: "Refunds MTD",      value: "₹6,400",    trend: "3 requests", trendTone: "flat"  as const },
];

const BILLING_SERIES = [
  { name: "Mar", value: 182000 },
  { name: "Apr", value: 194000 },
  { name: "May", value: 201000 },
  { name: "Jun", value: 208000 },
  { name: "Jul", value: 210000 },
  { name: "Aug", value: 216000 },
];

type Row = Record<string, string | number>;

const SEED_ROWS: Row[] = [
  { invoice: "INV-20481", owner: "Tariq Hussain",  pet: "Bruno", dept: "OPD",       amount: 850,  mode: "UPI",  status: "Paid"           },
  { invoice: "INV-20482", owner: "Nalini Prasad",  pet: "Simba", dept: "Pharmacy",  amount: 3200, mode: "Card", status: "Paid"           },
  { invoice: "INV-20483", owner: "Deepika Iyer",   pet: "Coco",  dept: "Laboratory",amount: 1650, mode: "—",    status: "Unpaid"         },
  { invoice: "INV-20484", owner: "Rajan Kumar",    pet: "Kiwi",  dept: "OPD",       amount: 600,  mode: "—",    status: "Unpaid"         },
  { invoice: "INV-20485", owner: "Vikram Shetty",  pet: "Luna",  dept: "Boarding",  amount: 4500, mode: "Cash", status: "Partially paid" },
  { invoice: "INV-20486", owner: "Ananya Sharma",  pet: "Milo",  dept: "Swimming",  amount: 650,  mode: "UPI",  status: "Unreconciled"   },
];

const COLUMNS = [
  { key: "invoice", label: "Invoice" },
  { key: "owner",   label: "Owner"   },
  { key: "pet",     label: "Pet"     },
  { key: "dept",    label: "Department" },
  { key: "amount",  label: "Amount", align: "right" as const, kind: "money" as const },
  { key: "mode",    label: "Mode"    },
  { key: "status",  label: "Status", kind: "status" as const },
];

const FIELDS = [
  { key: "invoice", label: "Invoice no.", type: "text",   required: true, placeholder: "INV-20487" },
  { key: "owner",   label: "Owner",       type: "text",   required: true },
  { key: "pet",     label: "Pet",         type: "text",   required: true },
  { key: "dept",    label: "Department",  type: "select", options: ["OPD","Laboratory","Pharmacy","Boarding","Swimming","Manual"], required: true },
  { key: "amount",  label: "Amount",      type: "number", required: true },
  { key: "mode",    label: "Payment mode",type: "select", options: ["Cash","UPI","Card","Razorpay","—"] },
  { key: "status",  label: "Status",      type: "select", options: ["Paid","Unpaid","Partially paid","Unreconciled","Refunded"], required: true },
];

const TABS: TabDef[] = [
  { id: "invoices",       label: "Invoices",        Icon: Receipt },
  { id: "manual",        label: "Manual Bill",      Icon: ShoppingCart, badge: "11.4" },
  { id: "photos",        label: "Bill Photos",      Icon: Image,        badge: "11.5" },
  { id: "analytics",     label: "Analytics",        Icon: BarChart3,    badge: "11.6" },
  { id: "razorpay",      label: "Razorpay",         Icon: Zap,          badge: "11.7" },
  { id: "subscriptions", label: "Subscriptions",    Icon: RefreshCw,    badge: "11.8" },
];

function money(v: string | number) {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return `₹${n.toLocaleString("en-IN")}`;
}

/* ─── Invoices Tab ───────────────────────────────────────────────── */
function InvoicesTab() {
  const [rows, setRows]   = useState<Row[]>(SEED_ROWS);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const statuses = Array.from(new Set(rows.map((r) => String(r["status"])))).filter(Boolean);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((r) => {
      const matchQ = !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q));
      const matchS = filter === "all" || String(r["status"]) === filter;
      return matchQ && matchS;
    });
  }, [rows, query, filter]);

  const submit = () => {
    const missing = FIELDS.filter((f) => f.required && !draft[f.key]?.trim());
    if (missing.length) { toast.error(`Please fill: ${missing.map(f => f.label).join(", ")}`); return; }
    const row: Row = {};
    for (const f of FIELDS) {
      const raw = draft[f.key] ?? "";
      row[f.key] = f.type === "number" ? Number(raw || 0) : raw || "—";
    }
    setRows((prev) => [row, ...prev]);
    setDraft({});
    setOpen(false);
    toast.success("Invoice saved");
  };

  const exportCsv = () => {
    const header = COLUMNS.map(c => c.label).join(",");
    const body = visible.map(r => COLUMNS.map(c => `"${String(r[c.key] ?? "")}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "billing.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {BILLING_KPIS.map((k, idx) => <KpiCard key={k.label} kpi={k} index={idx} />)}
      </div>

      {/* Chart */}
      <div className="erp-card p-5">
        <p className="section-label">Collections (₹ lakh)</p>
        <div className="mt-4 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={BILLING_SERIES} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} />
              <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={46} isAnimationActive animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="erp-card overflow-hidden shadow-xs">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoices…" className="pl-9" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground font-medium">{visible.length} of {rows.length} records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRows(SEED_ROWS); toast.success("Reset"); }}>
              <RotateCcw className="size-4" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Raise Invoice
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.label}
                  </th>
                ))}
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {visible.map((row, i) => (
                  <motion.tr
                    key={String(row["invoice"] ?? i)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="transition-colors hover:bg-primary-soft/35"
                  >
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                        {c.kind === "status" ? (
                          <StatusPill value={String(row[c.key] ?? "—")} />
                        ) : c.kind === "money" ? (
                          <span className="font-semibold">{money(row[c.key] ?? 0)}</span>
                        ) : (
                          String(row[c.key] ?? "—")
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setRows(prev => prev.filter((_, idx) => prev[idx] !== row)); toast.success("Record removed"); }}
                        className="text-muted-foreground transition-all hover:text-destructive hover:scale-110 active:scale-95 p-1 rounded-md"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {visible.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} className="px-4 py-12 text-center text-sm text-muted-foreground">No records match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New invoice dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise Invoice</DialogTitle>
            <DialogDescription>Add a new billing record</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 py-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-xs font-semibold">
                  {f.label}{f.required && <span className="text-destructive"> *</span>}
                </Label>
                {f.type === "select" ? (
                  <Select value={draft[f.key] ?? ""} onValueChange={(v) => setDraft(d => ({ ...d, [f.key]: v }))}>
                    <SelectTrigger id={f.key}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={f.key}
                    type={f.type === "number" ? "number" : "text"}
                    value={draft[f.key] ?? ""}
                    placeholder={f.placeholder ?? ""}
                    onChange={(e) => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Save Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ─── BillingHub ─────────────────────────────────────────────────── */
export function BillingHub() {
  const [activeTab, setActiveTab] = useState<TabId>("invoices");

  return (
    <Shell title="Billing & Payments">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[1500px] space-y-5"
      >
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <motion.span
              whileHover={{ rotate: 8, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs"
            >
              <Receipt className="size-5" />
            </motion.span>
            <div>
              <h1 className="page-title">Billing & Payments</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Invoices · Manual bills · Photo gallery · Analytics · Razorpay · Subscriptions
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              <tab.Icon className="size-3.5" />
              {tab.label}
              {tab.badge && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 rounded-lg ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {activeTab === "invoices"       && <InvoicesTab />}
            {activeTab === "manual"        && <ManualBilling />}
            {activeTab === "photos"        && <BillPhotoGallery />}
            {activeTab === "analytics"     && <PaymentAnalytics />}
            {activeTab === "razorpay"      && <RazorpayGateway />}
            {activeTab === "subscriptions" && <SubscriptionBilling />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </Shell>
  );
}
