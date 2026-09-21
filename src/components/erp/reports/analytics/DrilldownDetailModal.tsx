import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DrilldownTarget } from "./analyticsTypes";
import {
  User,
  Phone,
  Hash,
  Dog,
  Stethoscope,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Calendar,
  ShieldCheck,
  Mail,
  MapPin,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  target: DrilldownTarget | null;
  onClose: () => void;
}

// ── Stat mini-card ──────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  accent = "text-foreground",
  bg = "bg-muted/50",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: string;
  bg?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border p-3.5 space-y-1.5", bg)}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn("text-xl font-black tracking-tight", accent)}>{value}</p>
    </div>
  );
}

// ── Client Profile Panel ────────────────────────────────────────────────────
function ClientProfilePanel({ c }: { c: any }) {
  const initials = (c.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || "")
    .join("");

  const outstandingAmt = Number(c.outstanding || c.outstandingBalance || 0);
  const totalSpend = Number(c.totalSpend || 0);
  const totalVisits = Number(c.totalVisits || 0);
  const petsCount = Number(c.petsCount || c.pets?.length || 0);
  const ltv = totalSpend > 0 ? `₹${totalSpend.toLocaleString("en-IN")}` : "₹0";
  const avgPerVisit =
    totalVisits > 0 ? `₹${Math.round(totalSpend / totalVisits).toLocaleString("en-IN")}` : "—";

  return (
    <div className="space-y-5">
      {/* Avatar + Identity Banner */}
      <div className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
        <div className="flex-shrink-0 size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-black shadow-md select-none">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-foreground truncate">{c.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
              <Hash className="size-3" />{c.ownerId}
            </span>
            {outstandingAmt > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
                <AlertCircle className="size-3" /> Due: ₹{outstandingAmt.toLocaleString("en-IN")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="size-3" /> Cleared
              </span>
            )}
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
              totalVisits >= 5
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : totalVisits >= 2
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              {totalVisits >= 5 ? "🏆 VIP Client" : totalVisits >= 2 ? "⭐ Regular" : "🆕 New"}
            </span>
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {c.phone && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-xs">
            <Phone className="size-3.5 text-primary flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold">Phone</p>
              <p className="font-bold text-foreground font-mono">{c.phone}</p>
            </div>
          </div>
        )}
        {(c.email) && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-xs">
            <Mail className="size-3.5 text-primary flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold">Email</p>
              <p className="font-bold text-foreground truncate">{c.email}</p>
            </div>
          </div>
        )}
        {(c.city || c.address) && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-xs">
            <MapPin className="size-3.5 text-primary flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold">Location</p>
              <p className="font-bold text-foreground">{c.city || c.address || "Nagpur"}</p>
            </div>
          </div>
        )}
        {c.memberSince && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-xs">
            <Calendar className="size-3.5 text-primary flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold">Member Since</p>
              <p className="font-bold text-foreground">{c.memberSince}</p>
            </div>
          </div>
        )}
      </div>

      {/* KPI Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Dog}
          label="Pets"
          value={petsCount}
          accent="text-primary"
          bg="bg-primary/5"
        />
        <StatCard
          icon={Stethoscope}
          label="Visits"
          value={totalVisits}
          accent="text-blue-600"
          bg="bg-blue-50/60"
        />
        <StatCard
          icon={IndianRupee}
          label="Total Spend"
          value={ltv}
          accent="text-emerald-700"
          bg="bg-emerald-50/60"
        />
        <StatCard
          icon={outstandingAmt > 0 ? AlertCircle : ShieldCheck}
          label="Outstanding"
          value={outstandingAmt > 0 ? `₹${outstandingAmt.toLocaleString("en-IN")}` : "₹0"}
          accent={outstandingAmt > 0 ? "text-destructive" : "text-emerald-700"}
          bg={outstandingAmt > 0 ? "bg-destructive/5" : "bg-emerald-50/60"}
        />
      </div>

      {/* Derived Insights Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="size-3.5" />
            <p className="text-[10px] font-bold uppercase tracking-wider">Avg. Spend / Visit</p>
          </div>
          <p className="text-base font-black text-foreground">{avgPerVisit}</p>
          <p className="text-[10px] text-muted-foreground">Lifetime value proxy</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="size-3.5" />
            <p className="text-[10px] font-bold uppercase tracking-wider">Account Status</p>
          </div>
          <p className={cn(
            "text-base font-black",
            outstandingAmt === 0 ? "text-emerald-700" : "text-amber-600"
          )}>
            {outstandingAmt === 0 ? "Good Standing" : "Has Dues"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {outstandingAmt === 0 ? "No pending balance" : `₹${outstandingAmt.toLocaleString("en-IN")} unpaid`}
          </p>
        </div>
      </div>

      {/* Pets list if available */}
      {Array.isArray(c.pets) && c.pets.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/40">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Registered Pets ({c.pets.length})
            </p>
          </div>
          <div className="divide-y divide-border">
            {c.pets.map((pet: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors">
                <span className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                  <Dog className="size-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{pet.name || "Pet"}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {pet.species} · {pet.breed || "Mixed"} · {pet.petId || ""}
                  </p>
                </div>
                {pet.status && (
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    pet.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {pet.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/60">
        <ShieldCheck className="size-3.5 text-emerald-500" />
        <span>Client record from live database · Data shown is real-time</span>
      </div>
    </div>
  );
}

// ── Main Modal ──────────────────────────────────────────────────────────────
export function DrilldownDetailModal({ target, onClose }: Props) {
  if (!target) return null;

  const isClientProfile = target.type === "Client Profile";

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto border-border bg-card shadow-2xl p-0",
          isClientProfile ? "sm:max-w-2xl" : "sm:max-w-2xl"
        )}
      >
        {/* Header */}
        <div className="border-b border-border p-5 bg-muted/20 sticky top-0 z-10">
          <DialogHeader className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {target.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isClientProfile
                    ? "Full client profile · lifetime value · account standing"
                    : "Detailed record inspection & underlying transaction log"}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 flex-shrink-0">
                {target.type}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isClientProfile ? (
            <ClientProfilePanel c={target.data} />
          ) : Array.isArray(target.data) && target.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[10px]">
                    {Object.keys(target.data[0] || {}).map((col) => (
                      <th key={col} className="px-3 py-2">
                        {col.replace(/([A-Z])/g, " $1").trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {target.data.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      {Object.values(row).map((val: any, cIdx: number) => (
                        <td key={cIdx} className="px-3 py-2 text-foreground font-medium whitespace-nowrap">
                          {typeof val === "object" ? JSON.stringify(val) : String(val ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : typeof target.data === "object" && target.data !== null ? (
            <div className="grid grid-cols-2 gap-3 p-4 bg-muted/20 rounded-xl border border-border text-xs">
              {Object.entries(target.data).map(([k, v]) => (
                <div key={k} className="space-y-0.5">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">
                    {k.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <p className="font-bold text-foreground">
                    {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              No underlying records to display.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={onClose} className="h-8 text-xs font-semibold">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
