import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Medicine, MedicineCategory, UnitOfMeasure } from "../../useInventoryStore";

const CATEGORIES: MedicineCategory[] = ["Medicine", "Food", "Accessory", "Consumable"];
const UNITS: UnitOfMeasure[] = ["Tablet", "ml", "Vial", "Box", "Strip", "Kg", "Bottle"];
const GST_RATES = ["0", "5", "12", "18", "28"];

interface ExtendedFields {
  isZeroRated: boolean;
  isExempt: boolean;
  isDisabled: boolean;
  allowAlternative: boolean;
  maintainStock: boolean;
  valuationRate: string;
  isFixedAsset: boolean;
  overDeliveryAllowance: string;
  overBillingAllowance: string;
  taxCode: string;
  description: string;
  uomConversions: Array<{ uom: string; conversionFactor: string }>;
}

interface Props {
  medicine: Medicine;
  extended: ExtendedFields;
  onExtended: (f: ExtendedFields) => void;
}

function SectionToggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-0 py-4 text-sm font-semibold text-foreground hover:text-primary transition-colors"
      >
        {title}
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

export function ItemDetails({ medicine, extended, onExtended }: Props) {
  const set = (k: keyof ExtendedFields, v: string | boolean) =>
    onExtended({ ...extended, [k]: v });

  return (
    <div className="space-y-0">
      {/* ── Main Fields Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-5 pb-6 md:grid-cols-2">

        {/* Left column */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Item Name <span className="text-destructive">*</span>
            </Label>
            <Input value={medicine.name} readOnly className="bg-muted/30 font-medium" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Item Group <span className="text-destructive">*</span>
            </Label>
            <Select defaultValue={medicine.category}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Tax Code</Label>
            <Input
              value={extended.taxCode}
              onChange={(e) => set("taxCode", e.target.value)}
              placeholder="e.g. GST18"
              className="bg-muted/10"
            />
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={extended.isZeroRated}
                onChange={(e) => set("isZeroRated", e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Is Zero Rated
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={extended.isExempt}
                onChange={(e) => set("isExempt", e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Is Exempt
            </label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Default Unit of Measure <span className="text-destructive">*</span>
            </Label>
            <Select defaultValue={medicine.unit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <label className="flex items-center gap-2.5 text-sm pt-1">
            <input
              type="checkbox"
              checked={extended.isDisabled}
              onChange={(e) => set("isDisabled", e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            Disabled
          </label>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={extended.allowAlternative}
              onChange={(e) => set("allowAlternative", e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            Allow Alternative Item
          </label>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={extended.maintainStock}
              onChange={(e) => set("maintainStock", e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            <span className="font-medium">Maintain Stock</span>
          </label>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Valuation Rate</Label>
            <Input
              type="number"
              value={extended.valuationRate}
              onChange={(e) => set("valuationRate", e.target.value)}
              placeholder="0.00"
              className="bg-muted/10"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={extended.isFixedAsset}
              onChange={(e) => set("isFixedAsset", e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            Is Fixed Asset
          </label>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Over Delivery / Receipt Allowance (%)</Label>
            <Input
              type="number"
              step="0.001"
              value={extended.overDeliveryAllowance}
              onChange={(e) => set("overDeliveryAllowance", e.target.value)}
              placeholder="0.000"
              className="bg-muted/10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Over Billing Allowance (%)</Label>
            <Input
              type="number"
              step="0.001"
              value={extended.overBillingAllowance}
              onChange={(e) => set("overBillingAllowance", e.target.value)}
              placeholder="0.000"
              className="bg-muted/10"
            />
          </div>
        </div>
      </div>

      {/* ── Collapsible Sections ──────────────────────────────────────────── */}
      <SectionToggle title="Description">
        <textarea
          rows={4}
          value={extended.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Enter item description…"
          className="w-full rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </SectionToggle>

      <SectionToggle title="Units of Measure">
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">UOM</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversion Factor</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 font-medium">{medicine.unit}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">1.0 (base)</td>
                  <td className="px-4 py-2.5"></td>
                </tr>
                {extended.uomConversions.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-2.5">
                      <Input
                        value={row.uom}
                        onChange={(e) => {
                          const next = [...extended.uomConversions];
                          const curr = next[i] ?? row;
                          next[i] = { uom: e.target.value, conversionFactor: curr.conversionFactor };
                          onExtended({ ...extended, uomConversions: next });
                        }}
                        className="h-7 text-xs"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        value={row.conversionFactor}
                        onChange={(e) => {
                          const next = [...extended.uomConversions];
                          const curr = next[i] ?? row;
                          next[i] = { uom: curr.uom, conversionFactor: e.target.value };
                          onExtended({ ...extended, uomConversions: next });
                        }}
                        className="h-7 text-xs w-28"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => onExtended({ ...extended, uomConversions: extended.uomConversions.filter((_, idx) => idx !== i) })}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => onExtended({ ...extended, uomConversions: [...extended.uomConversions, { uom: "", conversionFactor: "1" as string }] })}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Add Row
          </button>
        </div>
      </SectionToggle>

      <SectionToggle title="Item Defaults">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Default Cost Center", placeholder: "e.g. OPD" },
            { label: "Default Supplier", placeholder: "e.g. MedVet Distributors" },
            { label: "Default Expense Account", placeholder: "e.g. 5200 Supplier Payments" },
            { label: "Default Income Account", placeholder: "e.g. 4100 Consultation Income" },
          ].map((f) => (
            <div key={f.label} className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">{f.label}</Label>
              <Input placeholder={f.placeholder} className="bg-muted/10 text-sm" />
            </div>
          ))}
        </div>
      </SectionToggle>
    </div>
  );
}

export type { ExtendedFields };
