import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ACCOUNTS = [
  "5100 — Salaries",
  "5200 — Supplier Payments",
  "5300 — Utilities & Rent",
  "4100 — Consultation Income",
  "4200 — Pharmacy Income",
  "4300 — Laboratory Income",
  "1400 — Inventory",
];

const COST_CENTERS = ["OPD", "Pharmacy", "Laboratory", "Boarding", "Swimming", "HR & Admin"];
const VALUATION_METHODS = ["FIFO", "Moving Average", "Last Purchase Price"];

export function ItemAccounting() {
  return (
    <div className="space-y-6">
      <div className="erp-card p-5">
        <p className="section-label mb-4">Account Mapping</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Expense Account</Label>
            <Select defaultValue="5200 — Supplier Payments">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Used when this item is purchased.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Income Account</Label>
            <Select defaultValue="4200 — Pharmacy Income">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Used when this item is sold.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Default Cost Center</Label>
            <Select defaultValue="Pharmacy">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COST_CENTERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Stock Adjustment Account</Label>
            <Select defaultValue="1400 — Inventory">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="erp-card p-5">
        <p className="section-label mb-4">Valuation</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Valuation Method</Label>
            <Select defaultValue="FIFO">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VALUATION_METHODS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Standard Buying Price (₹)</Label>
            <Input type="number" placeholder="0.00" className="bg-muted/10" />
          </div>
        </div>
      </div>

      <div className="erp-card p-5">
        <p className="section-label mb-3">Price Lists</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Price List", "Currency", "Buying", "Selling", "Rate (₹)"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { list: "Standard Buying", currency: "INR", buying: true, selling: false, rate: "" },
                { list: "Standard Selling", currency: "INR", buying: false, selling: true, rate: "" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.list}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.currency}</td>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" defaultChecked={r.buying} className="size-4 rounded accent-primary" />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" defaultChecked={r.selling} className="size-4 rounded accent-primary" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input type="number" placeholder="0.00" className="h-7 w-28 text-xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
