import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, RefreshCw, Clock, CheckCircle2, AlertCircle, XCircle,
  Package, Calendar, Hash, BadgeCheck,
} from "lucide-react";
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
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────────────────── */
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingType: "recurring" | "session_pack";
  frequency: "monthly" | "quarterly" | "annual" | null;
  sessionCount: number | null;
  validityDays: number | null;
  category: string;
}

type SubscriptionStatus = "Active" | "Expiring" | "Expired" | "Cancelled";

interface Subscription {
  id: string;
  planId: string;
  planName: string;
  petName: string;
  ownerName: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string | null;
  sessionsRemaining: number | null;
  nextBillingDate: string | null;
  totalPaid: number;
}

/* ─── Seed data ───────────────────────────────────────────────────── */
const SEED_PLANS: SubscriptionPlan[] = [
  { id: "pl1", name: "Boarding Monthly Pass",   price: 8500,  billingType: "recurring",     frequency: "monthly",   sessionCount: null, validityDays: 30,  category: "Boarding" },
  { id: "pl2", name: "Swimming 10-Session Pack", price: 3200, billingType: "session_pack",  frequency: null,        sessionCount: 10,   validityDays: 60,  category: "Swimming" },
  { id: "pl3", name: "Wellness Annual Plan",    price: 5999,  billingType: "recurring",     frequency: "annual",    sessionCount: null, validityDays: 365, category: "Clinic" },
  { id: "pl4", name: "Grooming Quarterly Pack", price: 2800,  billingType: "recurring",     frequency: "quarterly", sessionCount: null, validityDays: 90,  category: "Grooming" },
  { id: "pl5", name: "Swimming Monthly Pass",   price: 1800,  billingType: "recurring",     frequency: "monthly",   sessionCount: null, validityDays: 30,  category: "Swimming" },
];

const SEED_SUBSCRIPTIONS: Subscription[] = [
  {
    id: "s1", planId: "pl2", planName: "Swimming 10-Session Pack", petName: "Bruno", ownerName: "Tariq Hussain",
    status: "Active", startDate: "01/08/2026", endDate: "30/09/2026", sessionsRemaining: 7,
    nextBillingDate: null, totalPaid: 3200,
  },
  {
    id: "s2", planId: "pl1", planName: "Boarding Monthly Pass", petName: "Luna", ownerName: "Vikram Shetty",
    status: "Expiring", startDate: "16/07/2026", endDate: "15/08/2026", sessionsRemaining: null,
    nextBillingDate: "15/08/2026", totalPaid: 8500,
  },
  {
    id: "s3", planId: "pl3", planName: "Wellness Annual Plan", petName: "Simba", ownerName: "Nalini Prasad",
    status: "Active", startDate: "01/01/2026", endDate: "31/12/2026", sessionsRemaining: null,
    nextBillingDate: "01/09/2026", totalPaid: 5999,
  },
  {
    id: "s4", planId: "pl5", planName: "Swimming Monthly Pass", petName: "Coco", ownerName: "Deepika Iyer",
    status: "Cancelled", startDate: "01/06/2026", endDate: "30/06/2026", sessionsRemaining: null,
    nextBillingDate: null, totalPaid: 1800,
  },
];

const PETS = [
  { id: "PET-001", name: "Bruno",  owner: "Tariq Hussain"  },
  { id: "PET-002", name: "Luna",   owner: "Vikram Shetty"  },
  { id: "PET-003", name: "Simba",  owner: "Nalini Prasad"  },
  { id: "PET-004", name: "Coco",   owner: "Deepika Iyer"   },
  { id: "PET-005", name: "Milo",   owner: "Ananya Sharma"  },
];

function money(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

function statusIcon(s: SubscriptionStatus) {
  return {
    Active:    <CheckCircle2 className="size-4 text-emerald-500" />,
    Expiring:  <AlertCircle  className="size-4 text-amber-500"   />,
    Expired:   <XCircle      className="size-4 text-rose-400"    />,
    Cancelled: <XCircle      className="size-4 text-muted-foreground" />,
  }[s];
}

/* ─── New Subscription Dialog ─────────────────────────────────────── */
function NewSubscriptionDialog({
  open,
  onClose,
  plans,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  plans: SubscriptionPlan[];
  onSave: (sub: Subscription) => void;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [petId, setPetId] = useState(PETS[0]?.id ?? "PET-001");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const plan = plans.find(p => p.id === planId);
  const pet  = PETS.find(p => p.id === petId);

  const submit = () => {
    if (!plan || !pet) return;
    const start = new Date(startDate);
    const endMs = start.getTime() + (plan.validityDays ?? 30) * 86400000;
    const endDate = new Date(endMs).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const startLabel = start.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

    const sub: Subscription = {
      id: crypto.randomUUID(),
      planId: plan.id,
      planName: plan.name,
      petName: pet.name,
      ownerName: pet.owner,
      status: "Active",
      startDate: startLabel,
      endDate,
      sessionsRemaining: plan.sessionCount,
      nextBillingDate: plan.billingType === "recurring" ? endDate : null,
      totalPaid: plan.price,
    };
    onSave(sub);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5 text-primary" /> Sell Subscription
          </DialogTitle>
          <DialogDescription>
            Link a subscription plan to a pet/owner record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Subscription Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {money(p.price)} ({p.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {plan && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize font-medium">{plan.billingType.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold text-primary">{money(plan.price)}</span>
              </div>
              {plan.frequency && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billed</span>
                  <span className="capitalize">{plan.frequency}</span>
                </div>
              )}
              {plan.sessionCount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sessions</span>
                  <span>{plan.sessionCount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Validity</span>
                <span>{plan.validityDays} days</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Pet / Owner</Label>
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>
            <BadgeCheck className="size-4" /> Sell Subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── New Plan Dialog ─────────────────────────────────────────────── */
function NewPlanDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (plan: SubscriptionPlan) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [billingType, setBillingType] = useState<"recurring" | "session_pack">("recurring");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [sessions, setSessions] = useState("");
  const [validity, setValidity] = useState("30");
  const [category, setCategory] = useState("Clinic");

  const submit = () => {
    if (!name || !price || !validity) {
      toast.error("Fill in all required fields");
      return;
    }
    const plan: SubscriptionPlan = {
      id: crypto.randomUUID(),
      name, price: Number(price),
      billingType,
      frequency: billingType === "recurring" ? frequency : null,
      sessionCount: billingType === "session_pack" ? Number(sessions) : null,
      validityDays: Number(validity),
      category,
    };
    onSave(plan);
    toast.success(`Plan "${name}" created`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" /> New Subscription Plan
          </DialogTitle>
          <DialogDescription>Define a membership or package plan for customers.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 py-2">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs font-semibold">Plan name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Boarding Monthly Pass" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Price (₹) *</Label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="3500" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Clinic", "Boarding", "Swimming", "Grooming", "Other"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Billing type</Label>
            <Select value={billingType} onValueChange={(v) => setBillingType(v as "recurring" | "session_pack")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">Recurring</SelectItem>
                <SelectItem value="session_pack">Session Pack</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {billingType === "recurring" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as "monthly" | "quarterly" | "annual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Session count</Label>
              <Input type="number" value={sessions} onChange={e => setSessions(e.target.value)} placeholder="10" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Validity (days) *</Label>
            <Input type="number" value={validity} onChange={e => setValidity(e.target.value)} placeholder="30" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}><Plus className="size-4" /> Create Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */
export function SubscriptionBilling() {
  const [plans, setPlans]     = useState<SubscriptionPlan[]>(SEED_PLANS);
  const [subs, setSubs]       = useState<Subscription[]>(SEED_SUBSCRIPTIONS);
  const [sellOpen, setSellOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const cancelSub = (id: string) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: "Cancelled" as const } : s));
    toast.success("Subscription cancelled");
  };

  const renewSub = (id: string) => {
    setSubs(prev => prev.map(s => {
      if (s.id !== id) return s;
      const plan = plans.find(p => p.id === s.planId);
      if (!plan) return s;
      return {
        ...s, status: "Active" as const,
        totalPaid: s.totalPaid + plan.price,
        nextBillingDate: "16/09/2026",
      };
    }));
    toast.success("Subscription renewed — invoice generated");
  };

  const active   = subs.filter(s => s.status === "Active").length;
  const expiring = subs.filter(s => s.status === "Expiring").length;
  const mrr      = subs
    .filter(s => s.status === "Active")
    .reduce((total, sub) => {
      const plan = plans.find(p => p.id === sub.planId);
      if (!plan || plan.billingType !== "recurring") return total;
      const monthlyValue = plan.frequency === "annual" ? plan.price / 12
        : plan.frequency === "quarterly" ? plan.price / 3
        : plan.price;
      return total + monthlyValue;
    }, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Subscription & Recurring Billing</h2>
          <p className="text-sm text-muted-foreground">
            Membership plans, session packs and auto-renewal tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)} className="h-8 text-xs">
            <Package className="size-3.5" /> New Plan
          </Button>
          <Button size="sm" onClick={() => setSellOpen(true)} className="h-8 text-xs active:scale-95 transition-all">
            <Plus className="size-3.5" /> Sell Subscription
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Active subscriptions", value: String(active) },
          { label: "Expiring soon",        value: String(expiring), warn: expiring > 0 },
          { label: "Plans available",      value: String(plans.length) },
          { label: "MRR (approx.)",        value: money(Math.round(mrr)) },
        ].map((k) => (
          <div key={k.label} className="erp-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.warn ? "text-amber-600" : ""}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Plan catalogue */}
      <div className="erp-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Package className="size-4 text-primary" />
          <p className="font-semibold text-sm">Plan Catalogue</p>
          <span className="ml-auto text-xs text-muted-foreground">{plans.length} plans</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-border p-4 bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.category}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                  {plan.billingType === "session_pack" ? "Session pack" : plan.frequency}
                </span>
              </div>
              <p className="text-xl font-bold text-primary">{money(plan.price)}</p>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                {plan.sessionCount && (
                  <span className="flex items-center gap-1"><Hash className="size-3" />{plan.sessionCount} sessions</span>
                )}
                <span className="flex items-center gap-1"><Calendar className="size-3" />{plan.validityDays}d validity</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active subscriptions */}
      <div className="erp-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <RefreshCw className="size-4 text-primary" />
          <p className="font-semibold text-sm">Subscription Status</p>
          <span className="ml-auto text-xs text-muted-foreground">{subs.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                {["Plan", "Pet", "Owner", "Start", "End / Sessions left", "Next Invoice", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence>
                {subs.map((s) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-primary-soft/25 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{s.planName}</td>
                    <td className="px-4 py-3">{s.petName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.ownerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.startDate}</td>
                    <td className="px-4 py-3">
                      {s.sessionsRemaining != null ? (
                        <span className={`font-semibold ${s.sessionsRemaining <= 2 ? "text-amber-500" : ""}`}>
                          {s.sessionsRemaining} sessions left
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{s.endDate}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.nextBillingDate ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(s.status)}
                        <StatusPill value={s.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(s.status === "Active" || s.status === "Expiring") && (
                          <>
                            <button
                              onClick={() => renewSub(s.id)}
                              className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-medium transition-colors"
                            >
                              Renew
                            </button>
                            <button
                              onClick={() => cancelSub(s.id)}
                              className="text-xs px-2 py-1 rounded-md bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <NewSubscriptionDialog
        open={sellOpen}
        onClose={() => setSellOpen(false)}
        plans={plans}
        onSave={(sub) => { setSubs(prev => [sub, ...prev]); toast.success(`Subscription sold to ${sub.ownerName}`); }}
      />
      <NewPlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onSave={(plan) => setPlans(prev => [plan, ...prev])}
      />
    </motion.div>
  );
}
