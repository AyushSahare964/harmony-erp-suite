import { Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ItemManufacturing() {
  return (
    <div className="space-y-6">
      {/* ── BOM Settings ──────────────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Manufacturing Settings</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Default BOM</Label>
            <Input placeholder="Select or enter BOM…" className="bg-muted/10" />
            <p className="text-[11px] text-muted-foreground">Bill of Materials for manufacturing this item in-house.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Manufacturing Lead Time (days)</Label>
            <Input type="number" defaultValue={0} min={0} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Supply Method</Label>
            <select className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option>Buy</option>
              <option>Manufacture</option>
              <option>Buy or Manufacture</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Customer Provided Components</Label>
            <select className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option>None</option>
              <option>Yes — from customer</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-4 rounded accent-primary" />
            Is Sub-assembled Item
          </label>
        </div>
      </div>

      {/* ── Coming Soon placeholder ───────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Wrench className="size-7 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-semibold text-muted-foreground">BOM Management — Coming in v2</p>
        <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs text-center">
          Full Bill of Materials editor, work orders, and production planning will be available in the next release.
        </p>
      </div>
    </div>
  );
}
