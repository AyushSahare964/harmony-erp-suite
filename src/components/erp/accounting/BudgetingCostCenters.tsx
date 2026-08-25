import { useState, useEffect, useCallback } from "react";
import { Plus, AlertTriangle, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  createBudgetFn,
  getBudgetsFn,
  type BudgetRow,
} from "@/lib/mongodb/serverFns/finance";

// ─── Types ─────────────────────────────────────────────────────────────────────
type BudgetStatus = "Within budget" | "Near limit" | "Over budget";

interface CostCenter {
  id: string; name: string; parent?: string;
  budgeted: number; actual: number;
}
interface Dimension { label: string; }

// ─── Initial Data ─────────────────────────────────────────────────────────────
const INITIAL_COST_CENTERS: CostCenter[] = [
  { id: "root", name: "Clinic — All Departments", budgeted: 9800000, actual: 9200000 },
  { id: "opd", name: "OPD", parent: "root", budgeted: 2400000, actual: 2280000 },
  { id: "lab", name: "Laboratory", parent: "root", budgeted: 1500000, actual: 1390000 },
  { id: "pharmacy", name: "Pharmacy", parent: "root", budgeted: 3800000, actual: 3960000 },
  { id: "boarding", name: "Boarding", parent: "root", budgeted: 1900000, actual: 1820000 },
  { id: "swimming", name: "Swimming & Hydrotherapy", parent: "root", budgeted: 1280000, actual: 1410000 },
  { id: "hradmin", name: "HR & Admin", parent: "root", budgeted: 800000, actual: 740000 },
];

const DIMENSIONS: Dimension[] = [
  { label: "Doctor" },
  { label: "Referral Source" },
  { label: "Project" },
];

const ALLOCATION = [
  { dept: "OPD", pct: 40, color: "bg-primary" },
  { dept: "Pharmacy", pct: 30, color: "bg-success" },
  { dept: "Boarding", pct: 30, color: "bg-warning" },
];

function money(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

function pctDiff(b: number, a: number) {
  const diff = a - b;
  const pct = ((diff / b) * 100).toFixed(1);
  return { diff, pct: `${diff >= 0 ? "+" : ""}${pct}%`, positive: diff >= 0 };
}

function getBudgetStatus(budgeted: number, actual: number): BudgetStatus {
  const ratio = actual / budgeted;
  if (ratio > 1.0) return "Over budget";
  if (ratio > 0.9) return "Near limit";
  return "Within budget";
}

const STATUS_STYLES: Record<BudgetStatus, string> = {
  "Within budget": "bg-success-soft text-success",
  "Near limit": "bg-warning-soft text-warning",
  "Over budget": "bg-danger-soft text-destructive",
};

// ─── Set Budget Dialog (MongoDB-backed) ──────────────────────────────────────────
function SetBudgetDialog({
  open,
  onClose,
  costCenters,
  onBudgetSaved,
}: {
  open: boolean;
  onClose: () => void;
  costCenters: CostCenter[];
  onBudgetSaved: () => void;
}) {
  const [budgetName, setBudgetName] = useState("Annual Operating Budget");
  const [fiscalYear, setFiscalYear] = useState("FY 2026–27");
  const [costCenter, setCostCenter] = useState("OPD");
  const [account, setAccount] = useState("Salaries");
  const [annualAmount, setAnnualAmount] = useState("2400000");
  const [actionOnOverage, setActionOnOverage] = useState<"Warn" | "Stop" | "Ignore">("Warn");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!budgetName.trim() || !annualAmount || Number(annualAmount) <= 0) {
      toast.error("Please enter a valid budget name and amount");
      return;
    }
    setSaving(true);
    try {
      const annual = Number(annualAmount);
      const m = Math.round(annual / 12);
      const res = await createBudgetFn({
        data: {
          budgetName: budgetName.trim(),
          fiscalYear,
          costCenter,
          budgetActionOnOverage: actionOnOverage,
          monthlyDistribution: "Equal",
          lines: [
            {
              account,
              annualBudget: annual,
              q1: m * 3,
              q2: m * 3,
              q3: m * 3,
              q4: annual - m * 9,
              monthly: [m, m, m, m, m, m, m, m, m, m, m, annual - m * 11],
            },
          ],
        },
      });
      toast.success(`Budget ${res.budgetNo} saved to MongoDB!`);
      onBudgetSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Cost Center Budget</DialogTitle>
          <DialogDescription>Assign an annual budget with auto-computed quarterly & monthly breakdown in MongoDB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Budget Plan Name</Label>
              <Input value={budgetName} onChange={(e) => setBudgetName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fiscal Year</Label>
              <Input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cost Center</Label>
              <Select value={costCenter} onValueChange={setCostCenter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {costCenters.filter((c) => c.id !== "root").map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expense GL Account</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Salaries", "Supplier Payments", "Utilities & Rent", "Equipment Maintenance", "Medical Consumables"].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Annual Budget (₹) *</Label>
              <Input type="number" value={annualAmount} onChange={(e) => setAnnualAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Action on Overage</Label>
              <Select value={actionOnOverage} onValueChange={(v) => setActionOnOverage(v as typeof actionOnOverage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Warn">Warn user</SelectItem>
                  <SelectItem value="Stop">Stop transaction</SelectItem>
                  <SelectItem value="Ignore">Ignore</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {Number(annualAmount) > 0 && (
            <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
              <p className="font-semibold text-foreground">Auto-distributed Targets:</p>
              <p className="text-muted-foreground">Monthly: ₹{Math.round(Number(annualAmount) / 12).toLocaleString("en-IN")}</p>
              <p className="text-muted-foreground">Quarterly: ₹{Math.round(Number(annualAmount) / 4).toLocaleString("en-IN")}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save Budget to MongoDB"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cost Center Tree ─────────────────────────────────────────────────────────
function CostCenterTree({ costCenters }: { costCenters: CostCenter[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const toggle = (id: string) => setExpanded((e) => { const n = new Set(e); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const roots = costCenters.filter((c) => !c.parent);
  const children = (id: string) => costCenters.filter((c) => c.parent === id);

  function renderNode(node: CostCenter, depth: number) {
    const kids = children(node.id);
    const isExpanded = expanded.has(node.id);
    const status = getBudgetStatus(node.budgeted, node.actual);
    return (
      <div key={node.id}>
        <div
          className={`flex cursor-pointer items-center gap-2 border-b border-border/50 py-2 px-3 hover:bg-muted/30 transition-colors ${depth === 0 ? "bg-muted/20 font-semibold" : ""}`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => kids.length > 0 ? toggle(node.id) : undefined}
        >
          {kids.length > 0
            ? (isExpanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />)
            : <span className="size-3.5" />
          }
          <span className="flex-1 text-sm">{node.name}</span>
          <span className="text-xs text-muted-foreground mr-3">MTD Actual: <span className="font-medium text-foreground">{money(Math.round(node.actual / 12))}</span></span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[status]}`}>{status}</span>
        </div>
        {isExpanded && kids.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="erp-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost Center Hierarchy</p>
      </div>
      <div>{roots.map((r) => renderNode(r, 0))}</div>
    </div>
  );
}

// ─── Allocation Editor ────────────────────────────────────────────────────────
function AllocationEditor() {
  const [rows, setRows] = useState(ALLOCATION.map((r) => ({ ...r })));
  const total = rows.reduce((s, r) => s + r.pct, 0);
  const balanced = total === 100;

  const update = (i: number, val: number) => {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, pct: val } : row));
  };

  return (
    <div className="erp-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-navy">Cost Center Allocation</p>
          <p className="text-xs text-muted-foreground mt-0.5">Split shared expenses across departments. Must total 100%.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${balanced ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"}`}>
          Total: {total}%
        </span>
      </div>
      {/* Visual bar */}
      <div className="mb-4 flex h-3 overflow-hidden rounded-full">
        {rows.map((r) => (
          <div key={r.dept} className={`${r.color} transition-all`} style={{ width: `${r.pct}%` }} />
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.dept} className="flex items-center gap-3">
            <span className={`size-3 shrink-0 rounded-full ${r.color}`} />
            <span className="w-32 text-sm font-medium">{r.dept}</span>
            <input
              type="range" min={0} max={100} value={r.pct}
              onChange={(e) => update(i, Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <Input
              type="number" min={0} max={100} value={r.pct}
              onChange={(e) => update(i, Number(e.target.value))}
              className="w-16 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        ))}
      </div>
      {!balanced && (
        <p className="mt-3 flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="size-3.5" />
          Allocation does not total 100%. Adjust the percentages above.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          disabled={!balanced}
          onClick={() => toast.success("Cost center allocation saved successfully")}
          className={balanced ? "" : "opacity-50"}
        >
          Save Allocation
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function BudgetingCostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>(INITIAL_COST_CENTERS);
  const [mongoBudgets, setMongoBudgets] = useState<BudgetRow[]>([]);
  const [setBudgetOpen, setSetBudgetOpen] = useState(false);
  const [dimInput, setDimInput] = useState("");
  const [dims, setDims] = useState<Dimension[]>(DIMENSIONS);

  const fetchBudgets = useCallback(async () => {
    try {
      const raw = await getBudgetsFn();
      if (raw && raw.length > 0) {
        setMongoBudgets(raw);
        // Sync updated budget values to cost centers
        setCostCenters((prev) =>
          prev.map((c) => {
            const match = raw.find((b) => b.costCenter === c.name);
            if (match) {
              return { ...c, budgeted: match.totalBudget };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error("[BudgetingCostCenters] Failed to load budgets:", err);
    }
  }, []);

  useEffect(() => {
    void fetchBudgets();
  }, [fetchBudgets]);

  const addDim = () => {
    if (dimInput.trim()) { setDims((d) => [...d, { label: dimInput.trim() }]); setDimInput(""); }
  };

  const totalBudgeted = costCenters.find((c) => c.id === "root")!.budgeted;
  const totalActual = costCenters.find((c) => c.id === "root")!.actual;
  const overBudgetCount = costCenters.filter((c) => c.id !== "root" && c.actual > c.budgeted).length;
  const largestVariance = costCenters
    .filter((c) => c.id !== "root")
    .map((c) => ({ name: c.name, pct: Math.abs((c.actual - c.budgeted) / c.budgeted * 100) }))
    .sort((a, b) => b.pct - a.pct)[0] ?? { name: "N/A", pct: 0 };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Budgeted (FY)", value: money(totalBudgeted), note: "FY 2026–27" },
          { label: "Total Spent (FY)", value: money(totalActual), note: "across all centers" },
          { label: "Centers Over Budget", value: String(overBudgetCount), note: overBudgetCount > 0 ? "review immediately" : "all within budget", alert: overBudgetCount > 0 },
          { label: "Largest Variance", value: `${largestVariance.pct.toFixed(1)}%`, note: largestVariance.name },
        ].map((k) => (
          <div key={k.label} className={`erp-card px-4 py-3 ${k.alert ? "border-destructive/40 bg-danger-soft/30" : ""}`}>
            <p className="section-label">{k.label}</p>
            <p className={`mt-1 text-xl font-bold ${k.alert ? "text-destructive" : "text-primary"}`}>{k.value}</p>
            <p className={`mt-0.5 text-xs ${k.alert ? "text-destructive" : "text-muted-foreground"}`}>{k.note}</p>
          </div>
        ))}
      </div>

      {/* Cost Center Tree */}
      <CostCenterTree costCenters={costCenters} />

      {/* Budget vs Actual Table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Budget vs Actual — FY 2026–27</p>
          <Button size="sm" onClick={() => setSetBudgetOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />Set Budget
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                {["Cost Center", "Budgeted (FY)", "Actual (FY)", "Variance (₹)", "Variance (%)", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costCenters.filter((c) => c.id !== "root").map((c) => {
                const { diff, pct, positive } = pctDiff(c.budgeted, c.actual);
                const status = getBudgetStatus(c.budgeted, c.actual);
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-right">{money(c.budgeted)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{money(c.actual)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${positive ? "text-destructive" : "text-success"}`}>
                      {positive ? "+" : ""}{money(diff)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${positive ? "text-destructive" : "text-success"}`}>{pct}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[status]}`}>{status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MongoDB Budgets List */}
      {mongoBudgets.length > 0 && (
        <div className="erp-card p-5 space-y-3">
          <p className="section-label">MongoDB Budgets Recorded</p>
          <div className="divide-y divide-border">
            {mongoBudgets.map((b) => (
              <div key={b.budgetNo} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-semibold text-primary mr-2">{b.budgetNo}</span>
                  <span className="font-medium text-foreground">{b.budgetName}</span>
                  <span className="text-muted-foreground ml-2">({b.costCenter} · {b.fiscalYear})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">₹{b.totalBudget.toLocaleString("en-IN")}</span>
                  <span className="rounded-full bg-success-soft text-success px-2 py-0.5 font-semibold text-[10px]">{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allocation Editor */}
      <AllocationEditor />

      {/* Accounting Dimensions */}
      <div className="erp-card p-5">
        <p className="mb-3 font-semibold text-navy">Accounting Dimensions</p>
        <p className="mb-4 text-xs text-muted-foreground">Extra tags available for labelling transactions beyond Cost Center.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {dims.map((d) => (
            <span key={d.label} className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm">
              {d.label}
              <button onClick={() => setDims((all) => all.filter((x) => x.label !== d.label))} className="text-muted-foreground hover:text-destructive transition-colors">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="New dimension label…" value={dimInput} onChange={(e) => setDimInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDim()} className="max-w-xs" />
          <Button variant="outline" size="sm" onClick={addDim}><Plus className="mr-1.5 size-3.5" />Add</Button>
        </div>
      </div>

      <SetBudgetDialog
        open={setBudgetOpen}
        onClose={() => setSetBudgetOpen(false)}
        costCenters={costCenters}
        onBudgetSaved={fetchBudgets}
      />
    </div>
  );
}
