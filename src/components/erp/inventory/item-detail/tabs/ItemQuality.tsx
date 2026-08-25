import { useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/erp/StatusPill";

const TEMPLATES = [
  "Standard Pharmacy QC",
  "Vaccine Cold Chain",
  "Surgical Item Check",
  "None",
];

const INITIAL_INSPECTIONS = [
  { id: "QI-1201", date: "2026-08-10", type: "Incoming GRN", result: "Accepted", inspector: "Dr. Nalini" },
  { id: "QI-1188", date: "2026-07-22", type: "Incoming GRN", result: "Accepted", inspector: "Pharmacy Staff" },
  { id: "QI-1142", date: "2026-06-18", type: "Incoming GRN", result: "Rejected", inspector: "Dr. Nalini" },
];

export function ItemQuality() {
  const [inspectOnPurchase, setInspectOnPurchase] = useState(true);
  const [inspectOnDelivery, setInspectOnDelivery] = useState(false);
  const [template, setTemplate] = useState("Standard Pharmacy QC");
  const [shelfLife, setShelfLife] = useState("12");
  const [inspections, setInspections] = useState(INITIAL_INSPECTIONS);

  return (
    <div className="space-y-6">
      {/* ── Quality Settings ──────────────────────────────────────────── */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Quality Inspection Settings</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Quality Inspection Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Shelf Life (months)</Label>
            <Input
              type="number"
              value={shelfLife}
              onChange={(e) => setShelfLife(e.target.value)}
              min={0}
            />
            <p className="text-[11px] text-muted-foreground">Used to auto-calculate expiry date from manufacture date.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={inspectOnPurchase}
              onChange={(e) => setInspectOnPurchase(e.target.checked)}
              className="size-4 rounded accent-primary"
            />
            <span className="font-medium">Inspection Required on Purchase (GRN Gate)</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={inspectOnDelivery}
              onChange={(e) => setInspectOnDelivery(e.target.checked)}
              className="size-4 rounded accent-primary"
            />
            Inspection Required on Customer Delivery
          </label>
        </div>
      </div>

      {/* ── Current Template Preview ──────────────────────────────────── */}
      {template !== "None" && (
        <div className="erp-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <p className="font-semibold text-navy">{template} Checklist</p>
          </div>
          <div className="space-y-2">
            {[
              "Visual inspection — no damage, discolouration, or leakage",
              "Batch number & expiry date verified against invoice",
              "Manufacturer tamper-evident seal intact",
              "Temperature / cold chain verified (if vaccine/cold-storage item)",
              "Quantity count matches purchase order",
            ].map((check, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/30 px-3 py-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="text-sm">{check}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent QC Records ─────────────────────────────────────────── */}
      <div>
        <p className="section-label mb-3">Quality Inspection Logs</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["QI No.", "Date", "Inspection Type", "Result", "Inspector"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inspections.map((q, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{q.id}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{q.date}</td>
                  <td className="px-4 py-2.5">{q.type}</td>
                  <td className="px-4 py-2.5"><StatusPill value={q.result === "Accepted" ? "approved" : "failed"} /></td>
                  <td className="px-4 py-2.5">{q.inspector}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
