import { useState, useEffect, useCallback } from "react";
import { Plus, FileText, Download, Loader2, Receipt, ShoppingCart, Percent } from "lucide-react";
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
  getTaxationComplianceDataFn,
  type TaxationComplianceData,
  type TaxTemplateItem,
} from "@/lib/mongodb/serverFns/finance";

function money(v: number) {
  const abs = Math.abs(v);
  const str = abs >= 100000 ? `₹${(abs / 100000).toFixed(2)}L` : `₹${abs.toLocaleString("en-IN")}`;
  return v < 0 ? `−${str}` : str;
}

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
                  <SelectItem value="Sales">Sales (Billing)</SelectItem>
                  <SelectItem value="Purchase">Purchase (Inventory)</SelectItem>
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
  const [data, setData] = useState<TaxationComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getTaxationComplianceDataFn();
      if (res) {
        setData(res);
      }
    } catch (err) {
      console.error("[TaxationCompliance] Failed to fetch taxation data:", err);
      toast.error("Failed to load taxation and GST data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const outputGST = data?.outputGst ?? 0;
  const inputGST = data?.inputGst ?? 0;
  const netGSTPayable = data?.netGstPayable ?? 0;
  const taxableSales = data?.taxableSales ?? 0;
  const taxablePurchases = data?.taxablePurchases ?? 0;
  const periodLabel = data?.currentPeriodLabel || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const templates: TaxTemplateItem[] = data?.templates ?? [];
  const rateBreakdown = data?.rateBreakdown ?? [];

  const handleExportGSTR1 = () => {
    if (!data) return;
    try {
      const blob = new Blob([JSON.stringify(data.gstrJsonData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_${new Date().toISOString().slice(0, 7)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Live GSTR-1 JSON exported successfully.");
    } catch {
      toast.error("Failed to export GSTR-1 JSON");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">Taxation & GST Compliance</h2>
          <p className="text-xs text-muted-foreground">
            Real-time Output GST from Billing & Input Tax Credit (ITC) from Inventory Purchase Bills
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportGSTR1} disabled={loading || !data}>
            <Download className="mr-1.5 size-3.5" /> Export GSTR-1 JSON
          </Button>
          <Button size="sm" onClick={() => setNewTemplateOpen(true)}>
            <Plus className="mr-1.5 size-3.5" /> New Template
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="erp-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-7 bg-muted rounded w-1/2 mb-1" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="erp-card px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="section-label">Output GST (Billing)</p>
              <Receipt className="size-4 text-primary" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{money(outputGST)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              collected across {data?.salesCount ?? 0} customer bills
            </p>
          </div>

          <div className="erp-card px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="section-label">Input Tax Credit (ITC)</p>
              <ShoppingCart className="size-4 text-success" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{money(inputGST)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              claimable on {data?.purchaseCount ?? 0} inventory bills
            </p>
          </div>

          <div className={`erp-card px-4 py-3 ${netGSTPayable > 0 ? "border-primary/40 bg-primary-soft/20" : "bg-success-soft/20 border-success/30"}`}>
            <div className="flex items-center justify-between">
              <p className="section-label">
                {netGSTPayable >= 0 ? "Net GST Payable" : "ITC Carry Forward"}
              </p>
              <Percent className={`size-4 ${netGSTPayable >= 0 ? "text-primary" : "text-success"}`} />
            </div>
            <p className={`mt-1 text-xl font-bold ${netGSTPayable >= 0 ? "text-primary" : "text-success"}`}>
              {money(netGSTPayable)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {netGSTPayable >= 0 ? "due by 20th of next month" : "eligible for set-off"}
            </p>
          </div>

          <div className="erp-card px-4 py-3">
            <p className="section-label">Taxable Turnover</p>
            <p className="mt-1 text-xl font-bold text-foreground">{money(taxableSales)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Purchases: {money(taxablePurchases)}
            </p>
          </div>
        </div>
      )}

      {/* GSTR Summary */}
      <div className="erp-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <p className="font-semibold text-navy">GSTR-1 & GSTR-3B Summary ({periodLabel})</p>
              <p className="text-xs text-muted-foreground">Monthly aggregate from live billing and purchase registers</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportGSTR1} disabled={loading || !data}>
            <Download className="mr-1.5 size-3.5" /> Export GSTR-1 JSON
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-muted/40 p-4 border border-border/50">
            <p className="text-xs text-muted-foreground font-medium">Taxable Value (Billing Sales)</p>
            <p className="mt-1.5 text-lg font-bold text-foreground">{money(taxableSales)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">GST Output: {money(outputGST)}</p>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 border border-border/50">
            <p className="text-xs text-muted-foreground font-medium">Taxable Value (Inventory Purchases)</p>
            <p className="mt-1.5 text-lg font-bold text-foreground">{money(taxablePurchases)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">ITC Claimable: {money(inputGST)}</p>
          </div>

          <div className={`rounded-lg p-4 border ${
            netGSTPayable > 0 ? "bg-primary-soft/30 border-primary/30" : "bg-success-soft/30 border-success/30"
          }`}>
            <p className={`text-xs font-semibold ${netGSTPayable > 0 ? "text-primary" : "text-success"}`}>
              {netGSTPayable >= 0 ? "Net Tax Due (GSTR-3B)" : "ITC Credit Balance"}
            </p>
            <p className={`mt-1.5 text-lg font-bold ${netGSTPayable > 0 ? "text-primary" : "text-success"}`}>
              {money(netGSTPayable)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Output GST − Input Tax Credit</p>
          </div>
        </div>
      </div>

      {/* GST Rate Slab Breakdown */}
      <div className="erp-card overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <p className="section-label">GST Rate Slab Breakdown (Billing vs Inventory)</p>
          <span className="text-xs text-muted-foreground">Computed live from document line items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">GST Rate Slab</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Taxable Sales (Billing)</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Output GST</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Taxable Purchases (Inventory)</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Input Tax Credit</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Net Tax Balance</th>
              </tr>
            </thead>
            <tbody>
              {rateBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No GST line-item transactions recorded in the system yet.
                  </td>
                </tr>
              ) : (
                rateBreakdown.map((row) => (
                  <tr key={row.slab} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{row.slab}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(row.salesTaxable)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-primary tabular-nums">{money(row.outputTax)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(row.purchaseTaxable)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-success tabular-nums">{money(row.inputTax)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${row.netTax > 0 ? "text-destructive" : row.netTax < 0 ? "text-success" : "text-muted-foreground"}`}>
                      {money(row.netTax)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rateBreakdown.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold text-xs">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right">{money(taxableSales)}</td>
                  <td className="px-4 py-2.5 text-right text-primary">{money(outputGST)}</td>
                  <td className="px-4 py-2.5 text-right">{money(taxablePurchases)}</td>
                  <td className="px-4 py-2.5 text-right text-success">{money(inputGST)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${netGSTPayable >= 0 ? "text-destructive" : "text-success"}`}>
                    {money(netGSTPayable)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Tax Templates (MongoDB Master) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="section-label">GST Tax Templates (MongoDB)</p>
            <p className="text-xs text-muted-foreground">Configured rate slabs used across Billing and Inventory</p>
          </div>
          <Button size="sm" onClick={() => setNewTemplateOpen(true)}>
            <Plus className="mr-1.5 size-3.5" /> New Template
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Template Name", "Applies To", "Tax Rates", "Default", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No custom tax templates defined.
                  </td>
                </tr>
              ) : (
                templates.map((t, i) => (
                  <tr key={t.id || i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewTemplateDialog
        open={newTemplateOpen}
        onClose={() => setNewTemplateOpen(false)}
        onTemplateCreated={fetchData}
      />
    </div>
  );
}
