import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Medicine } from "../../useInventoryStore";

interface Props { medicine: Medicine; }

const SUPPLIERS = [
  "MedVet Distributors",
  "BioPharm",
  "PetNutri",
  "CareSupplies",
  "PharmaCo",
];

export function ItemPurchasing({ medicine }: Props) {
  return (
    <div className="space-y-6">
      {/* ── Primary purchasing fields ──────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Purchasing Settings</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Default Supplier</Label>
            <Select defaultValue="MedVet Distributors">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPLIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Lead Time (days)</Label>
            <Input type="number" defaultValue={3} min={0} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Minimum Order Qty</Label>
            <Input type="number" defaultValue={medicine.reorderLevel} min={1} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Last Purchase Price (₹)</Label>
            <Input type="number" defaultValue={medicine.defaultSalePrice * 0.65} readOnly className="bg-muted/20" />
            <p className="text-[11px] text-muted-foreground">Auto-updated from last Purchase Order.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Purchase UOM</Label>
            <Select defaultValue={medicine.unit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Tablet", "ml", "Vial", "Box", "Strip", "Kg", "Bottle"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Conversion Factor (Purchase → Stock UOM)</Label>
            <Input type="number" defaultValue={1} min={0.001} step={0.001} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" defaultChecked className="size-4 rounded accent-primary" />
            Is Purchase Item
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-4 rounded accent-primary" />
            Is Customer Provided Item
          </label>
        </div>
      </div>

      {/* ── Supplier List ─────────────────────────────────────────────── */}
      <div>
        <p className="section-label mb-3">Approved Suppliers</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Supplier", "Supplier Part No.", "Lead Time (days)", "Last Price (₹)"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { supplier: "MedVet Distributors", partNo: "MVD-AMX250", lead: 3, price: medicine.defaultSalePrice * 0.65 },
                { supplier: "BioPharm", partNo: "BP-AMOX-250", lead: 5, price: medicine.defaultSalePrice * 0.68 },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.supplier}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{r.partNo}</td>
                  <td className="px-4 py-2.5">{r.lead}</td>
                  <td className="px-4 py-2.5 font-medium">₹{r.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
