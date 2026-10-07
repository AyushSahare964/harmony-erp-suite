import { useEffect, useState } from "react";
import { BadgePercent, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/erp/Shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteDiscountSchemeFn,
  listDiscountSchemesFn,
  saveDiscountSchemeFn,
  type DiscountSchemeRow,
} from "@/lib/mongodb/serverFns/discountSchemes";
import { schemeStatus, todayYmd, type SchemeStatus } from "@/lib/utils/discountSchemes";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<SchemeStatus, string> = {
  ongoing: "border-green-500/40 bg-green-50 text-green-700",
  upcoming: "border-blue-500/40 bg-blue-50 text-blue-700",
  expired: "border-muted-foreground/30 bg-muted text-muted-foreground",
  inactive: "border-amber-500/40 bg-amber-50 text-amber-700",
};

const blank = () => ({
  _id: undefined as string | undefined,
  name: "",
  description: "",
  discountPercent: "",
  startDate: todayYmd(),
  endDate: todayYmd(),
  isActive: true,
});

export function DiscountSchemesHub() {
  const [schemes, setSchemes] = useState<DiscountSchemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setSchemes(await listDiscountSchemesFn());
    } catch (e) {
      console.error(e);
      toast.error("Failed to load discount schemes.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!form) return;
    const pct = Number(form.discountPercent);
    const err = !form.name.trim()
      ? "Scheme name is required."
      : !(pct > 0 && pct <= 100)
        ? "Discount must be between 0 and 100%."
        : !form.startDate || !form.endDate
          ? "Start and end dates are required."
          : form.endDate < form.startDate
            ? "End date must be on or after start date."
            : "";
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      await saveDiscountSchemeFn({
        data: {
          ...(form._id ? { _id: form._id } : {}),
          name: form.name.trim(),
          description: form.description.trim(),
          discountPercent: pct,
          startDate: form.startDate,
          endDate: form.endDate,
          isActive: form.isActive,
        },
      });
      toast.success(form._id ? "Scheme updated." : "Scheme created.");
      setForm(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save scheme.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: DiscountSchemeRow) => {
    if (!window.confirm(`Delete scheme "${s.name}"?`)) return;
    try {
      await deleteDiscountSchemeFn({ data: { _id: s._id } });
      toast.success("Scheme deleted.");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete scheme.");
    }
  };

  const toggle = async (s: DiscountSchemeRow) => {
    try {
      await saveDiscountSchemeFn({ data: { ...s, isActive: !s.isActive } });
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update scheme.");
    }
  };

  return (
    <Shell title="Discount Schemes">
      <div className="space-y-6 pb-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-navy">
              Discount Schemes <BadgePercent className="size-5 text-primary" />
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Special offers for clients. An ongoing scheme is highlighted to the doctor while prescribing.
            </p>
          </div>
          <Button onClick={() => setForm(blank())} className="text-xs font-bold">
            <Plus className="mr-1.5 size-3.5" /> New Scheme
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : schemes.length === 0 ? (
          <div className="erp-card p-8 text-center text-sm text-muted-foreground">
            No schemes yet. Click "New Scheme" to create your first offer.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schemes.map((s) => {
              const st = schemeStatus(s);
              return (
                <div key={s._id} className={cn("erp-card space-y-3 p-4", st === "ongoing" && "ring-2 ring-green-500/40")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-navy">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDisplayDate(s.startDate)} → {formatDisplayDate(s.endDate)}
                      </p>
                    </div>
                    <p className="text-2xl font-extrabold text-primary">{s.discountPercent}%</p>
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={cn("text-xs font-semibold capitalize", STATUS_STYLE[st])}>
                      {st === "ongoing" ? "● Ongoing" : st}
                    </Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void toggle(s)}>
                        {s.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Edit scheme"
                        onClick={() => setForm({ ...s, discountPercent: String(s.discountPercent) })}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Delete scheme"
                        className="text-destructive"
                        onClick={() => void remove(s)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form?._id ? "Edit Scheme" : "New Discount Scheme"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Scheme name *</Label>
                <Input
                  value={form.name}
                  maxLength={80}
                  placeholder="e.g. Diwali Special"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Discount (%) *</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start date *</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>End date *</Label>
                  <Input type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description / terms</Label>
                <Input
                  value={form.description}
                  maxLength={300}
                  placeholder="Optional - shown to the doctor"
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Scheme enabled
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save Scheme"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
