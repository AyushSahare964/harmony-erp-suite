import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Medicine } from "../../useInventoryStore";

interface Props { medicine: Medicine; }

export function ItemSales({ medicine }: Props) {
  return (
    <div className="space-y-6">
      <div className="erp-card p-5">
        <p className="section-label mb-4">Selling Settings</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Default Price List</Label>
            <Select defaultValue="standard">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard Selling</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Default Sale Price (₹)</Label>
            <Input type="number" defaultValue={medicine.defaultSalePrice} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Sales UOM</Label>
            <Select defaultValue={medicine.unit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Tablet", "ml", "Vial", "Box", "Strip", "Kg", "Bottle"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Max Discount (%)</Label>
            <Input type="number" defaultValue={10} min={0} max={100} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" defaultChecked className="size-4 rounded accent-primary" />
            Is Sales Item
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-4 rounded accent-primary" />
            Allow Sales Without Stock
          </label>
        </div>
      </div>

      {/* ── Pricing Rules ─────────────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-3">Pricing Rules</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Price List", "Applicable To", "Min Qty", "Rate (₹)", "Discount %", "Valid Till"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-medium">Standard Selling</td>
                <td className="px-4 py-2.5 text-muted-foreground">All Customers</td>
                <td className="px-4 py-2.5">1</td>
                <td className="px-4 py-2.5 font-semibold">₹{medicine.defaultSalePrice}</td>
                <td className="px-4 py-2.5">—</td>
                <td className="px-4 py-2.5 text-muted-foreground">—</td>
              </tr>
              <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-medium">Bulk Discount</td>
                <td className="px-4 py-2.5 text-muted-foreground">All Customers</td>
                <td className="px-4 py-2.5">50</td>
                <td className="px-4 py-2.5 font-semibold">₹{Math.round(medicine.defaultSalePrice * 0.9)}</td>
                <td className="px-4 py-2.5 text-success font-medium">10%</td>
                <td className="px-4 py-2.5 text-muted-foreground">2026-12-31</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Description for Sales ─────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-3">Sales Description</p>
        <p className="mb-2 text-xs text-muted-foreground">Shown on sales invoices and quotations.</p>
        <textarea
          rows={3}
          defaultValue={`${medicine.name} — ${medicine.genericName || medicine.category}. ${medicine.unit} form.`}
          className="w-full rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
    </div>
  );
}
