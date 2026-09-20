import { useState, useEffect, useMemo } from "react";
import {
  TestTube2,
  Search,
  Plus,
  X,
  Clock,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { loadTestCatalog, addTestToCatalog, deleteTestFromCatalog, type LabTestProfile } from "@/lib/erp/labTestCatalog";

export function TestMasterCatalog() {
  const [catalog, setCatalog] = useState<LabTestProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingTest, setSavingTest] = useState(false);

  // New test draft fields
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSample, setNewSample] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newTat, setNewTat] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newUrgent, setNewUrgent] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await loadTestCatalog();
      setCatalog(rows);
    } catch (e) {
      console.error(e);
      toast.error("Could not load diagnostic test catalog");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return catalog.filter((t) => {
      const matchQ =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.sample?.toLowerCase().includes(q);

      const matchD = deptFilter === "all" || t.dept === deptFilter;
      return matchQ && matchD;
    });
  }, [catalog, query, deptFilter]);

  const departments = Array.from(new Set(catalog.map((t) => t.dept).filter(Boolean)));

  const resetForm = () => {
    setNewCode("");
    setNewName("");
    setNewSample("");
    setNewDept("");
    setNewTat("");
    setNewPrice("");
    setNewUrgent(false);
  };

  const handleAddTest = async () => {
    if (!newName.trim() || !newSample.trim() || !newPrice.trim()) {
      toast.error("Test name, sample type, and price are required");
      return;
    }
    setSavingTest(true);
    try {
      const code =
        newCode.trim() ||
        `TST-${newName.trim().slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "")}${Math.floor(10 + Math.random() * 90)}`;
      const test: LabTestProfile = {
        code,
        name: newName.trim(),
        sample: newSample.trim(),
        dept: newDept.trim() || "General",
        tat: newTat.trim() || "—",
        price: Number(newPrice),
        urgentAvailable: newUrgent,
      };
      await addTestToCatalog(test);
      toast.success(`Test profile "${test.name}" added to catalog`);
      resetForm();
      setShowAddForm(false);
      void refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not save new test profile");
    } finally {
      setSavingTest(false);
    }
  };

  const handleDeleteTest = async (t: LabTestProfile) => {
    if (!window.confirm(`Remove "${t.name}" from the diagnostic test catalog?`)) return;
    const idx = catalog.findIndex((c) => c.code === t.code);
    if (idx === -1) return;
    try {
      await deleteTestFromCatalog(idx);
      toast.success(`${t.name} removed from catalog`);
      void refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not delete test profile");
    }
  };

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
            variant={showAddForm ? "outline" : "default"}
            onClick={() => setShowAddForm((v) => !v)}
            className="text-xs font-bold h-9 gap-1"
          >
            {showAddForm ? (
              <><X className="size-3.5" /> Cancel</>
            ) : (
              <><Plus className="size-3.5" /> + New Test Profile</>
            )}
          </Button>
        </div>
      </div>

      {/* Add New Test Profile Form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-3">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Plus className="size-3.5 text-primary" /> New Diagnostic Test Profile
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Test Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Fecal Occult Blood Test"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Test Code (optional)</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Auto-generated if left blank"
                className="h-8 text-xs bg-card font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Department</Label>
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="e.g. Hematology"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Sample / Specimen *</Label>
              <Input
                value={newSample}
                onChange={(e) => setNewSample(e.target.value)}
                placeholder="e.g. Serum (SST Yellow)"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Turnaround Time (TAT)</Label>
              <Input
                value={newTat}
                onChange={(e) => setNewTat(e.target.value)}
                placeholder="e.g. 2 hrs"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Price (₹) *</Label>
              <Input
                type="number"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="e.g. 750"
                className="h-8 text-xs bg-card font-mono"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={newUrgent}
              onChange={(e) => setNewUrgent(e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
            Available for Urgent / STAT orders
          </label>
          <Button size="sm" onClick={handleAddTest} disabled={savingTest} className="h-8 text-xs font-bold gap-1.5">
            <CheckCircle2 className="size-3.5" /> {savingTest ? "Saving..." : "Save Test Profile"}
          </Button>
        </div>
      )}

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
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                    {t.dept}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteTest(t)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete Test Profile"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
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
              <span className="font-mono font-bold text-sm text-foreground">₹{Number(t.price).toLocaleString("en-IN")}</span>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-xs text-muted-foreground italic">
            No diagnostic test profiles match your search.
          </div>
        )}
      </div>
    </div>
  );
}
