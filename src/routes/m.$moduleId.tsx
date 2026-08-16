import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Download, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { getIcon } from "@/components/erp/icon";
import { getWorkspace, type Row } from "@/lib/erp/workspaces";
import { useErp } from "@/lib/erp/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$moduleId")({
  head: ({ params }) => {
    const ws = getWorkspace(params.moduleId);
    const title = ws ? `${ws.title} — VetOS ERP` : "Module — VetOS ERP";
    const description = ws?.subtitle ?? "VetOS ERP veterinary clinic management module.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ModulePage,
});

function money(v: string | number) {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return `₹${n.toLocaleString("en-IN")}`;
}

function ModulePage() {
  const { moduleId } = Route.useParams();
  const ws = getWorkspace(moduleId);
  const { getRows, addRow, deleteRow, resetRows } = useErp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const rows = ws ? getRows(ws.id) : [];

  const statuses = useMemo(() => {
    if (!ws?.statusKey) return [];
    const key = ws.statusKey;
    return Array.from(new Set(rows.map((r) => String(r[key] ?? "")))).filter(Boolean);
  }, [rows, ws]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((r) => {
      const matchQ = !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q));
      const matchS =
        filter === "all" || !ws?.statusKey || String(r[ws.statusKey] ?? "") === filter;
      return matchQ && matchS;
    });
  }, [rows, query, filter, ws]);

  if (!ws) {
    return (
      <Shell title="Module not found">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="erp-card mx-auto max-w-md p-8 text-center"
        >
          <h1 className="text-xl font-bold">Module not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This module isn't part of the current workspace.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
        </motion.div>
      </Shell>
    );
  }

  const Icon = getIcon(ws.icon);

  const submit = () => {
    const missing = ws.fields.filter((f) => f.required && !draft[f.key]?.trim());
    if (missing.length) {
      toast.error(`Please fill: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    const row: Row = {};
    for (const f of ws.fields) {
      const raw = draft[f.key] ?? "";
      row[f.key] = f.type === "number" ? Number(raw || 0) : raw || "—";
    }
    addRow(ws.id, row);
    setDraft({});
    setOpen(false);
    toast.success(`${ws.createLabel.replace(/^(New|Add|Create) /, "")} saved`);
  };

  const exportCsv = () => {
    const header = ws.columns.map((c) => c.label).join(",");
    const body = visible
      .map((r) => ws.columns.map((c) => `"${String(r[c.key] ?? "")}"`).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ws.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <Shell title={ws.title}>
      <motion.div 
        key={ws.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[1500px] space-y-6"
      >
        {/* Module Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <motion.span 
              whileHover={{ rotate: 8, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs"
            >
              <Icon className="size-5" />
            </motion.span>
            <div>
              <h1 className="page-title">{ws.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{ws.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => resetRows(ws.id)} className="transition-all hover:bg-muted active:scale-95">
              <RotateCcw className="size-4" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="transition-all hover:bg-muted active:scale-95">
              <Download className="size-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="transition-all shadow-xs active:scale-95">
              <Plus className="size-4" /> {ws.createLabel}
            </Button>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ws.kpis.map((k, idx) => (
            <KpiCard key={k.label} kpi={k} index={idx} />
          ))}
        </div>

        {/* Chart Section */}
        {ws.series && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="erp-card p-5"
          >
            <p className="section-label">{ws.seriesLabel}</p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ws.series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--color-border)",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={46} isAnimationActive={true} animationDuration={600} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Interactive Data Table Container */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="erp-card overflow-hidden shadow-xs"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records…"
                className="pl-9 transition-all focus:ring-2 focus:ring-primary/10"
              />
            </div>
            {statuses.length > 0 && (
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground font-medium">
              {visible.length} of {rows.length} records
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                  {ws.columns.map((c) => (
                    <th
                      key={c.key}
                      className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide ${
                        c.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <AnimatePresence mode="popLayout">
                  {visible.map((row, i) => (
                    <motion.tr
                      key={String(row["id"] ?? row["code"] ?? row["invoice"] ?? row["ref"] ?? row["name"] ?? i)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="transition-colors hover:bg-primary-soft/35"
                    >
                      {ws.columns.map((c) => (
                        <td
                          key={c.key}
                          className={`whitespace-nowrap px-4 py-3 ${
                            c.align === "right" ? "text-right tabular-nums" : ""
                          }`}
                        >
                          {c.kind === "status" ? (
                            <StatusPill value={String(row[c.key] ?? "—")} />
                          ) : c.kind === "money" ? (
                            <span className="font-semibold">{money(row[c.key] ?? 0)}</span>
                          ) : (
                            String(row[c.key] ?? "—")
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            deleteRow(ws.id, rows.indexOf(row));
                            toast.success("Record removed");
                          }}
                          className="text-muted-foreground transition-all hover:text-destructive hover:scale-110 active:scale-95 p-1 rounded-md"
                          aria-label="Delete record"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={ws.columns.length + 1}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No records match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>

      {/* Animated Record Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{ws.createLabel}</DialogTitle>
            <DialogDescription>{ws.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2 py-2">
            {ws.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-xs font-semibold">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </Label>
                {f.type === "select" ? (
                  <Select
                    value={draft[f.key] ?? ""}
                    onValueChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                  >
                    <SelectTrigger id={f.key}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={f.key}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={draft[f.key] ?? ""}
                    placeholder={f.placeholder ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
