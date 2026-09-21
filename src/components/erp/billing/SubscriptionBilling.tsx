import { useEffect, useState } from "react";
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
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import {
  createSubscriptionPlanFn, listSubscriptionPlansFn,
  sellSubscriptionFn, listClientSubscriptionsFn,
  cancelSubscriptionFn, renewSubscriptionFn,
  type SubscriptionPlanRow, type ClientSubscriptionRow,
} from "@/lib/mongodb/serverFns/subscriptions";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";

/* ─── Types ──────────────────────────────────────────────────────── */
type SubscriptionPlan = SubscriptionPlanRow & { id: string };
type Subscription = ClientSubscriptionRow & { id: string };
type SubscriptionStatus = Subscription["status"];
interface PetOption { id: string; name: string; owner: string; ownerId: string }

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
  pets,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  plans: SubscriptionPlan[];
  pets: PetOption[];
  onSave: (sub: Subscription) => void;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [petId, setPetId] = useState(pets[0]?.id ?? "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const plan = plans.find(p => p.id === planId);
  const pet  = pets.find(p => p.id === petId);

  const submit = async () => {
    if (!plan || !pet) return;
    setSaving(true);
    try {
      const sub = await sellSubscriptionFn({
        data: {
          planId: plan.id, petId: pet.id, petName: pet.name,
          ownerId: pet.ownerId, ownerName: pet.owner, startDate,
        },
      });
      onSave({ ...sub, id: sub.subId });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sell subscription");
    } finally {
      setSaving(false);
    }
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
                {pets.map((p) => (
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
          <Button onClick={submit} disabled={saving || !plan || !pet}>
            <BadgeCheck className="size-4" /> {saving ? "Selling…" : "Sell Subscription"}
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
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name || !price || !validity) {
      toast.error("Fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const plan = await createSubscriptionPlanFn({
        data: {
          name, price: Number(price), billingType,
          frequency: billingType === "recurring" ? frequency : null,
          sessionCount: billingType === "session_pack" ? Number(sessions) : null,
          validityDays: Number(validity), category,
        },
      });
      onSave({ ...plan, id: plan.planId });
      toast.success(`Plan "${name}" created`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create plan");
    } finally {
      setSaving(false);
    }
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
          <Button onClick={submit} disabled={saving}>
            <Plus className="size-4" /> {saving ? "Creating…" : "Create Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */
export function SubscriptionBilling() {
  const [plans, setPlans]     = useState<SubscriptionPlan[]>([]);
  const [subs, setSubs]       = useState<Subscription[]>([]);
  const [pets, setPets]       = useState<PetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellOpen, setSellOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  useEffect(() => {
    Promise.all([listSubscriptionPlansFn(), listClientSubscriptionsFn(), listPetsWithOwnersFn()])
      .then(([planRows, subRows, petRows]) => {
        setPlans(planRows.map((p) => ({ ...p, id: p.planId })));
        setSubs(subRows.map((s) => ({ ...s, id: s.subId })));
        setPets((petRows as any[]).map((p) => ({
          id: p.petId, name: p.name, owner: p.owner?.name ?? "Unknown Owner", ownerId: p.ownerId,
        })));
      })
      .catch(() => toast.error("Could not load subscription data"))
      .finally(() => setLoading(false));
  }, []);

  const cancelSub = async (id: string) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: "Cancelled" as const } : s));
    try {
      await cancelSubscriptionFn({ data: { subId: id } });
      toast.success("Subscription cancelled");
    } catch {
      toast.error("Could not cancel subscription");
    }
  };

  const renewSub = async (id: string) => {
    try {
      const updated = await renewSubscriptionFn({ data: { subId: id } });
      setSubs(prev => prev.map(s => s.id === id ? { ...updated, id: updated.subId } : s));
      toast.success("Subscription renewed — invoice generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not renew subscription");
    }
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

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading subscriptions…</div>;
  }

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
                    <td className="px-4 py-3 text-muted-foreground">{formatDisplayDate(s.startDate)}</td>
                    <td className="px-4 py-3">
                      {s.sessionsRemaining != null ? (
                        <span className={`font-semibold ${s.sessionsRemaining <= 2 ? "text-amber-500" : ""}`}>
                          {s.sessionsRemaining} sessions left
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{formatDisplayDate(s.endDate)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.nextBillingDate ? formatDisplayDate(s.nextBillingDate) : "—"}
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
        pets={pets}
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
