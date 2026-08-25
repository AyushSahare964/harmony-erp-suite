import { useState } from "react";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/erp/StatusPill";
import type { Medicine } from "../../useInventoryStore";
import { toast } from "sonner";

interface VariantAttribute { attribute: string; abbr: string; required: boolean; }
interface VariantRow { name: string; attributes: string; status: "Active" | "Inactive"; }

const DEFAULT_ATTRS: VariantAttribute[] = [
  { attribute: "Dosage Strength", abbr: "DS", required: true },
  { attribute: "Pack Size", abbr: "PS", required: false },
];

const INITIAL_VARIANTS: VariantRow[] = [
  { name: "Strip / 10 Tablets", attributes: "Standard · Strip", status: "Active" },
  { name: "Box / 100 Tablets", attributes: "Bulk · Box", status: "Active" },
  { name: "Bottle / 60ml", attributes: "Liquid · Bottle", status: "Active" },
];

interface Props { medicine: Medicine; }

export function ItemVariants({ medicine }: Props) {
  const [hasVariants, setHasVariants] = useState(medicine.hasVariants || false);
  const [attrs, setAttrs] = useState<VariantAttribute[]>(DEFAULT_ATTRS);
  const [variants, setVariants] = useState<VariantRow[]>(INITIAL_VARIANTS);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantAttrs, setNewVariantAttrs] = useState("");
  const [showAddVariant, setShowAddVariant] = useState(false);

  const removeAttr = (i: number) => setAttrs((a) => a.filter((_, idx) => idx !== i));
  const addAttr = () => setAttrs((a) => [...a, { attribute: "", abbr: "", required: false }]);
  const updateAttr = (i: number, key: keyof VariantAttribute, val: string | boolean) => {
    setAttrs((a) => a.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const handleCreateVariant = () => {
    if (!newVariantName.trim()) {
      toast.error("Please enter a variant name");
      return;
    }
    const newV: VariantRow = {
      name: `${medicine.name} — ${newVariantName.trim()}`,
      attributes: newVariantAttrs.trim() || "Standard",
      status: "Active",
    };
    setVariants((prev) => [...prev, newV]);
    setNewVariantName("");
    setNewVariantAttrs("");
    setShowAddVariant(false);
    toast.success(`Variant "${newV.name}" created.`);
  };

  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
    toast.info("Variant removed.");
  };

  return (
    <div className="space-y-6">
      {/* Has Variants toggle */}
      <div className="erp-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-navy">Item Variants</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enable if {medicine.name} is available in multiple dosages, package sizes, or formulations.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
              className="sr-only"
            />
            <div
              onClick={() => setHasVariants((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${hasVariants ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${hasVariants ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </div>
            <span className="text-sm font-medium">{hasVariants ? "Enabled" : "Disabled"}</span>
          </label>
        </div>
      </div>

      {hasVariants ? (
        <>
          {/* Variant Attributes */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="section-label">Variant Attributes</p>
              <Button variant="outline" size="sm" onClick={addAttr}>
                <Plus className="mr-1.5 size-3.5" />Add Attribute
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attribute Name</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abbreviation</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {attrs.map((a, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-2">
                        <Input
                          value={a.attribute}
                          onChange={(e) => updateAttr(i, "attribute", e.target.value)}
                          placeholder="e.g. Dosage Strength"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={a.abbr}
                          onChange={(e) => updateAttr(i, "abbr", e.target.value)}
                          placeholder="e.g. DS"
                          className="h-8 w-20 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={a.required}
                          onChange={(e) => updateAttr(i, "required", e.target.checked)}
                          className="size-4 rounded accent-primary"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeAttr(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Variants List */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="section-label">Configured Variants</p>
              <Button size="sm" onClick={() => setShowAddVariant((v) => !v)}>
                <Plus className="mr-1.5 size-3.5" />{showAddVariant ? "Cancel" : "Add Variant"}
              </Button>
            </div>

            {showAddVariant && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-primary">New Item Variant</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Variant Suffix / Description *</Label>
                    <Input
                      placeholder="e.g. 500mg Strip of 10"
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Attribute Values</Label>
                    <Input
                      placeholder="e.g. 500mg · Strip"
                      value={newVariantAttrs}
                      onChange={(e) => setNewVariantAttrs(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setShowAddVariant(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleCreateVariant}>Save Variant</Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variant Name</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attributes</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{v.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{v.attributes}</td>
                      <td className="px-4 py-2.5"><StatusPill value={v.status} /></td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => removeVariant(i)}
                          className="text-xs font-medium text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {variants.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                        No variants configured yet. Click &quot;Add Variant&quot; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <p className="text-sm font-medium">Variants are currently disabled for this item.</p>
          <p className="mt-1 text-xs">Enable the switch above if this item has multiple sub-types or packaging variants.</p>
        </div>
      )}
    </div>
  );
}
