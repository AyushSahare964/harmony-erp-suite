import { useState, useMemo } from "react";
import {
  TestTube2,
  Search,
  Plus,
  Filter,
  Sparkles,
  Clock,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DEFAULT_TEST_CATALOG } from "./CreateLabOrderModal";
import { cn } from "@/lib/utils";

const EXTENDED_TEST_CATALOG = [
  ...DEFAULT_TEST_CATALOG,
  { code: "TST-FE-SNAP", name: "Feline Triple Snap (FeLV / FIV / Heartworm)", sample: "Whole Blood / Serum", dept: "Serology", tat: "20 min", price: 1650, urgentAvailable: true },
  { code: "TST-LIPASE-CPL", name: "Canine Pancreatic Lipase (cPL) Rapid", sample: "Serum", dept: "Gastroenterology", tat: "25 min", price: 1250, urgentAvailable: true },
  { code: "TST-CORTISOL", name: "Basal Serum Cortisol (RIA / ECLIA)", sample: "Serum (Red Plain)", dept: "Endocrinology", tat: "24 hrs", price: 1800, urgentAvailable: false },
  { code: "TST-BLOOD-GAS", name: "Venous Blood Gas & Acid-Base (i-STAT)", sample: "Heparin Blood", dept: "Critical Care", tat: "15 min", price: 1100, urgentAvailable: true },
  { code: "TST-HISTO-BX", name: "Histopathology Biopsy (Small / Medium Specimen)", sample: "Tissue in 10% Formalin", dept: "Anatomic Pathology", tat: "5-7 days", price: 2800, urgentAvailable: false },
  { code: "TST-CSF-CYTO", name: "CSF Fluid Analysis & Total Protein", sample: "Cerebrospinal Fluid", dept: "Neurology", tat: "4 hrs", price: 1950, urgentAvailable: true },
];

export function TestMasterCatalog() {
  const [catalog, setCatalog] = useState(EXTENDED_TEST_CATALOG);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return catalog.filter((t) => {
      const matchQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.sample.toLowerCase().includes(q);

      const matchD = deptFilter === "all" || t.dept === deptFilter;
      return matchQ && matchD;
    });
  }, [catalog, query, deptFilter]);

  const departments = Array.from(new Set(catalog.map((t) => t.dept)));

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search diagnostic test by name, panel code, sample type..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[180px] text-xs h-9">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} of {catalog.length} test profiles
          </span>
          <Button
            size="sm"
            onClick={() => toast.info("Test Master editor opened.")}
            className="text-xs font-bold h-9 gap-1"
          >
            <Plus className="size-3.5" /> + New Test Profile
          </Button>
        </div>
      </div>

      {/* Grid of Test Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.map((t) => (
          <div
            key={t.code}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  {t.code}
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                  {t.dept}
                </Badge>
              </div>
              <h4 className="text-xs font-bold text-foreground leading-snug">{t.name}</h4>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <TestTube2 className="size-3 text-primary" /> Specimen: <strong className="text-foreground">{t.sample}</strong>
              </p>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                <span>TAT: {t.tat}</span>
              </div>
              <span className="font-mono font-bold text-sm text-foreground">₹{t.price.toLocaleString("en-IN")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
