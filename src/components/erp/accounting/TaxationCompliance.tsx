import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import {
  createTaxTemplateFn,
  getTaxTemplatesFn,
  type TaxTemplateRow,
} from "@/lib/mongodb/serverFns/finance";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TaxTemplate {
  name: string;
  appliesTo: "Sales" | "Purchase" | "Both";
  rates: string;
  isDefault: boolean;
  status: "Active" | "Inactive";
}
interface ItemTaxOverride { item: string; override: string; reason: string; }
interface TDSRow { party: string; section: string; rate: string; ytd: number; certificate: string; }

// ─── Initial Data ─────────────────────────────────────────────────────────────
const INITIAL_TAX_TEMPLATES: TaxTemplate[] = [
  { name: "GST 18% (Sales)", appliesTo: "Sales", rates: "CGST 9% + SGST 9%", isDefault: true, status: "Active" },
  { name: "GST 12% (Sales)", appliesTo: "Sales", rates: "CGST 6% + SGST 6%", isDefault: false, status: "Active" },
  { name: "GST 5% (Medicines)", appliesTo: "Sales", rates: "CGST 2.5% + SGST 2.5%", isDefault: false, status: "Active" },
  { name: "GST 18% (Purchases)", appliesTo: "Purchase", rates: "CGST 9% + SGST 9%", isDefault: true, status: "Active" },
  { name: "Zero Rated", appliesTo: "Sales", rates: "0%", isDefault: false, status: "Inactive" },
];

const INITIAL_OVERRIDES: ItemTaxOverride[] = [
  { item: "Rabies Vaccine", override: "GST 5% (Medicines)", reason: "Exempt category medicine" },
  { item: "Royal Canin Maxi 4kg", override: "GST 12% (Sales)", reason: "Pet food — reduced rate" },
  { item: "Surgical Consultation", override: "GST 18% (Sales)", reason: "Professional service" },
];

const TDS_ROWS: TDSRow[] = [
  { party: "MedVet Distributors", section: "194C", rate: "1%", ytd: 8400, certificate: "None" },
  { party: "Cleaning Services Ltd", section: "194C", rate: "2%", ytd: 2100, certificate: "None" },
  { party: "Dr. Consulting Vet", section: "194J", rate: "10%", ytd: 14200, certificate: "Attached — expiry 2026-12-31" },
];

function money(v: number) { return `₹${v.toLocaleString("en-IN")}`; }

// ─── New Template Dialog (MongoDB-backed) ──────────────────────────────────────
function NewTemplateDialog({
  open,
  onClose,
  onTemplateCreated,
}: {
  open: boolean;
  onClose: () => void;
  onTemplateCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState<"Sales" | "Purchase" | "Both">("Sales");
  const [rate, setRate] = useState("18");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);
    try {
      const numRate = Number(rate) || 0;
      await createTaxTemplateFn({
        data: {
          name: name.trim(),
          appliesTo,
          isDefault,
          isInclusive: false,
          rows: [
            { account: "CGST", taxType: "CGST", rate: numRate / 2 },
            { account: "SGST", taxType: "SGST", rate: numRate / 2 },
          ],
        },
      });
      toast.success(`Tax template "${name}" saved to MongoDB!`);
      onTemplateCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New GST Tax Template</DialogTitle>
          <DialogDescription>Define a tax rate template saved to MongoDB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Template Name *</Label>
            <Input placeholder="e.g. GST 28% Luxury" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Applies To</Label>
              <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as typeof appliesTo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GST Rate (%)</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
            Set as default for {appliesTo}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function TaxationCompliance() {
  const [templates, setTemplates] = useState<TaxTemplate[]>(INITIAL_TAX_TEMPLATES);
  const [overrides, setOverrides] = useState<ItemTaxOverride[]>(INITIAL_OVERRIDES);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [newOverrideOpen, setNewOverrideOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ item: "", override: "GST 5% (Medicines)", reason: "" });

  const fetchTaxTemplates = useCallback(async () => {
    try {
      const raw = await getTaxTemplatesFn();
      if (raw && raw.length > 0) {
        const mapped: TaxTemplate[] = raw.map((t: TaxTemplateRow) => ({
          name: t.name,
          appliesTo: t.appliesTo as TaxTemplate["appliesTo"],
          rates: t.rows.map((r) => `${r.taxType} ${r.rate}%`).join(" + "),
          isDefault: t.isDefault,
          status: t.status as TaxTemplate["status"],
        }));
        setTemplates([...mapped, ...INITIAL_TAX_TEMPLATES]);
      }
    } catch (err) {
      console.error("[TaxationCompliance] Failed to fetch tax templates:", err);
    }
  }, []);

  useEffect(() => {
    void fetchTaxTemplates();
  }, [fetchTaxTemplates]);

  const addOverride = () => {
    if (!overrideForm.item || !overrideForm.reason) {
      toast.error("Please provide item name and reason");
      return;
    }
    setOverrides([...overrides, overrideForm]);
    toast.success("Item tax override added");
    setOverrideForm({ item: "", override: "GST 5% (Medicines)", reason: "" });
    setNewOverrideOpen(false);
  };

  // GST Calculation
  const outputGST = 324000;
  const inputGST = 144000;
  const netGSTPayable = outputGST - inputGST;

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Output GST (Sales)", value: money(outputGST), note: "collected this month" },
          { label: "Input Tax Credit (ITC)", value: money(inputGST), note: "claimable on purchases" },
          { label: "Net GST Payable", value: money(netGSTPayable), note: "due by 20th of next month", highlight: true },
          { label: "TDS Deducted (YTD)", value: money(24700), note: "deposited with govt." },
        ].map((k) => (
          <div key={k.label} className={`erp-card px-4 py-3 ${k.highlight ? "border-primary/40 bg-primary-soft/20" : ""}`}>
            <p className="section-label">{k.label}</p>
            <p className={`mt-1 text-xl font-bold ${k.highlight ? "text-primary" : "text-foreground"}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.note}</p>
          </div>
        ))}
      </div>

      {/* GSTR Summary */}
      <div className="erp-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <p className="font-semibold text-navy">GSTR-1 & GSTR-3B Summary (August 2026)</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const gstrData = {
                gstin: "27AABCV1234F1Z5",
                fp: "082026",
                cur_gt: 2160000,
                gt: 2160000,
                b2b: [
                  {
                    ctin: "27AABCM8890K1ZP",
                    inv: [
                      {
                        inum: "INV-20440",
                        idt: "10-06-2026",
                        val: 12500,
                        pos: "27",
                        rchrg: "N",
                        inv_typ: "R",
                        itms: [{ num: 1, itm_det: { txval: 11160, rt: 12, samt: 670, camt: 670 } }]
                      }
                    ]
                  }
                ],
                b2cs: [
                  { sply_ty: "INTRA", txval: 1800000, rt: 18, camt: 162000, samt: 162000 }
                ]
              };
              const blob = new Blob([JSON.stringify(gstrData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "GSTR1_082026.json";
              a.click();
              URL.revokeObjectURL(url);
              toast.success("GSTR-1 JSON payload downloaded successfully.");
            }}
          >
            Export GSTR-1 JSON
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Taxable Value (Sales)</p>
            <p className="mt-1 text-lg font-bold">₹21,60,000</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Taxable Value (Purchases)</p>
            <p className="mt-1 text-lg font-bold">₹9,20,000</p>
          </div>
          <div className="rounded-lg bg-success-soft/30 p-3 border border-success/30">
            <p className="text-xs text-success font-medium">Net Tax Due (GSTR-3B)</p>
            <p className="mt-1 text-lg font-bold text-success">₹1,80,000</p>
          </div>
        </div>
      </div>

      {/* Tax Templates */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">GST Tax Templates (MongoDB)</p>
          <Button size="sm" onClick={() => setNewTemplateOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />New Template
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Template Name", "Applies To", "Tax Rates", "Default", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5">{t.appliesTo}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.rates}</td>
                  <td className="px-4 py-2.5">
                    {t.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><StatusPill value={t.status} /></td>
                  <td className="px-4 py-2.5">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => toast.success(`Template ${t.name} active`)}>
                      Verify
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Tax Overrides */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Item-Level Tax Overrides</p>
          <Button variant="outline" size="sm" onClick={() => setNewOverrideOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />Add Item Override
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Item", "Applied Override", "Reason", "Action"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overrides.map((o, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{o.item}</td>
                  <td className="px-4 py-2.5 font-semibold text-primary">{o.override}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{o.reason}</td>
                  <td className="px-4 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        setOverrides(overrides.filter((_, idx) => idx !== i));
                        toast.success("Override removed");
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TDS Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">TDS (Tax Deducted at Source)</p>
          <span className="text-xs text-muted-foreground">Threshold tracking & certificates</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Party", "Section", "TDS Rate", "YTD Deductions", "Certificate Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TDS_ROWS.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.party}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.section}</td>
                  <td className="px-4 py-2.5">{r.rate}</td>
                  <td className="px-4 py-2.5 font-medium">{money(r.ytd)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.certificate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewTemplateDialog
        open={newTemplateOpen}
        onClose={() => setNewTemplateOpen(false)}
        onTemplateCreated={fetchTaxTemplates}
      />

      <Dialog open={newOverrideOpen} onOpenChange={setNewOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item Tax Override</DialogTitle>
            <DialogDescription>Assign a custom tax template to a specific item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Item Name</Label>
              <Input placeholder="e.g. Amoxicillin 250mg" value={overrideForm.item} onChange={(e) => setOverrideForm({ ...overrideForm, item: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tax Override Template</Label>
              <Select value={overrideForm.override} onValueChange={(v) => setOverrideForm({ ...overrideForm, override: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason / Legal Note</Label>
              <Input placeholder="e.g. Life saving drug under exempt list" value={overrideForm.reason} onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOverrideOpen(false)}>Cancel</Button>
            <Button onClick={addOverride}>Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
