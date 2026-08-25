import { ToggleLeft, ToggleRight, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Medicine } from "../../useInventoryStore";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props { medicine: Medicine; }

const TAX_TEMPLATES = [
  "GST 18% (Sales)",
  "GST 12% (Sales)",
  "GST 5% (Medicines)",
  "Zero Rated",
];

interface TaxOverride { territory: string; template: string; }

const INITIAL_OVERRIDES: TaxOverride[] = [
  { territory: "Maharashtra (Home State)", template: "GST 18% (Sales)" },
  { territory: "Export / SEZ", template: "Zero Rated" },
];

export function ItemTax({ medicine }: Props) {
  const [isDefault, setIsDefault] = useState(false);
  const [overrides, setOverrides] = useState<TaxOverride[]>(INITIAL_OVERRIDES);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newTerritory, setNewTerritory] = useState("");
  const [newTemplate, setNewTemplate] = useState<string>(TAX_TEMPLATES[0] || "GST 18% (Sales)");

  // Determine default template from GST rate
  const defaultTemplate = medicine.gstRate === 5
    ? "GST 5% (Medicines)"
    : medicine.gstRate === 12
    ? "GST 12% (Sales)"
    : "GST 18% (Sales)";

  const handleAddOverride = () => {
    if (!newTerritory.trim()) {
      toast.error("Please enter a territory or state name");
      return;
    }
    setOverrides((prev) => [...prev, { territory: newTerritory.trim(), template: newTemplate }]);
    setNewTerritory("");
    setShowAddOverride(false);
    toast.success(`Tax override added for ${newTerritory}.`);
  };

  return (
    <div className="space-y-6">
      {/* ── Item Tax Template ──────────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Item Tax Template</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Tax Template</Label>
            <Select defaultValue={defaultTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAX_TEMPLATES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Auto-selected based on GST rate: {medicine.gstRate}%</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">HSN/SAC Code</Label>
            <Input placeholder="e.g. 30049099" defaultValue={medicine.category === "Medicine" ? "30049099" : ""} />
            <p className="text-[11px] text-muted-foreground">Harmonized System Nomenclature code for GST filing.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">CGST Rate (%)</Label>
            <Input type="number" defaultValue={medicine.gstRate / 2} readOnly className="bg-muted/20" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">SGST Rate (%)</Label>
            <Input type="number" defaultValue={medicine.gstRate / 2} readOnly className="bg-muted/20" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setIsDefault((v) => !v)}>
            {isDefault
              ? <ToggleRight className="size-6 text-success" />
              : <ToggleLeft className="size-6 text-muted-foreground/40" />
            }
          </button>
          <span className="text-sm">Override with item-specific rate (ignore category template)</span>
        </div>
      </div>

      {/* ── GST Summary ───────────────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-3">GST Classification Summary</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-primary-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tax Category</p>
            <p className="mt-1 text-xl font-bold text-primary">{medicine.gstRate > 0 ? "Taxable" : "Exempt"}</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Effective GST Rate</p>
            <p className="mt-1 text-xl font-bold text-foreground">{medicine.gstRate}%</p>
          </div>
          <div className="rounded-xl bg-success-soft/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-success">Template</p>
            <p className="mt-1 text-sm font-bold text-success">{defaultTemplate}</p>
          </div>
        </div>
      </div>

      {/* ── Territory Overrides ───────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Tax Rate Overrides by Territory</p>
          <Button variant="outline" size="sm" onClick={() => setShowAddOverride((v) => !v)}>
            <Plus className="mr-1.5 size-3.5" />{showAddOverride ? "Cancel" : "Add Override"}
          </Button>
        </div>

        {showAddOverride && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">New Territory Tax Override</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Territory / State *</Label>
                <Input
                  placeholder="e.g. Karnataka, Special Economic Zone"
                  value={newTerritory}
                  onChange={(e) => setNewTerritory(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tax Template</Label>
                <Select value={newTemplate} onValueChange={setNewTemplate}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_TEMPLATES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setShowAddOverride(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddOverride}>Save Override</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Territory</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax Template</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((o, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{o.territory}</td>
                  <td className="px-4 py-2.5 text-primary">{o.template}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => setOverrides((a) => a.filter((_, idx) => idx !== i))}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {overrides.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-xs text-muted-foreground">
                    No territory overrides configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
