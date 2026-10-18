import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Download, Inbox, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRangeFilter, type DateRange } from "@/components/erp/shared/DateRangeFilter";
import { presetDateRange, todayIST } from "@/lib/utils/dateUtils";

export const inr = (n: number) =>
  `${n < 0 ? "-" : ""}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Blank for zero, so wide tables stay readable. */
export const inrOrDash = (n: number) => (Math.abs(n) < 0.005 ? "—" : inr(n));

export const MODE_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  DD: "Demand draft",
  WALLET: "Wallet",
};
export const modeLabel = (m: string) => MODE_LABEL[m] ?? m;

/** Reports default to the current financial year so earlier months are never silently hidden. */
export function useFyRange() {
  return useState<DateRange>(() => ({ ...presetDateRange("THIS_FY"), preset: "THIS_FY" }));
}

export { todayIST };

/** Loads on mount and whenever `key` changes; ignores stale responses. */
export function useReport<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: "",
    loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    load()
      .then((data) => !cancelled && setState({ data, error: "", loading: false }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setState({
            data: null,
            error: e instanceof Error ? e.message : "Could not load report",
            loading: false,
          }),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportFrame({
  title,
  subtitle,
  range,
  onRange,
  asOf,
  onAsOf,
  onExport,
  loading,
  error,
  notes,
  children,
}: {
  title: string;
  subtitle: string;
  range?: DateRange;
  onRange?: (r: DateRange) => void;
  asOf?: string;
  onAsOf?: (d: string) => void;
  onExport?: () => void;
  loading: boolean;
  error: string;
  notes?: string[];
  children: ReactNode;
}) {
  return (
    <section className="space-y-4" aria-label={title}>
      <div className="erp-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-navy">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {range && onRange && <DateRangeFilter value={range} onChange={onRange} />}
          {asOf !== undefined && onAsOf && (
            <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-card px-3 text-xs font-semibold">
              As on
              <input
                type="date"
                value={asOf}
                max={todayIST()}
                onChange={(e) => e.target.value && onAsOf(e.target.value)}
                className="bg-transparent font-mono outline-none"
              />
            </label>
          )}
          {onExport && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={onExport}
              disabled={loading || !!error}
            >
              <Download className="mr-1 size-3.5" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {loading && <ReportSkeleton />}
      {error && (
        <div
          role="alert"
          className="erp-card flex items-center gap-2 border-destructive/40 bg-danger-soft p-4 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}
      {!loading && !error && children}
      {!loading && !error && notes && notes.length > 0 && (
        <details className="group rounded-lg border border-border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold [&::-webkit-details-marker]:hidden">
            <Info className="size-3.5" /> How this report is calculated
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading report">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="erp-card h-[74px] animate-pulse bg-muted/50" />
        ))}
      </div>
      <div className="erp-card h-64 animate-pulse bg-muted/40" />
    </div>
  );
}

const ACCENT = {
  good: "bg-success",
  bad: "bg-destructive",
  muted: "bg-border",
  default: "bg-primary",
} as const;

export function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "muted" | undefined;
  hint?: string | undefined;
}) {
  return (
    <div className="erp-card relative overflow-hidden px-4 py-3">
      <span className={cn("absolute inset-y-0 left-0 w-1", ACCENT[tone ?? "default"])} />
      <p className="section-label">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-xl font-bold tracking-tight tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const PILL = {
  good: "bg-success-soft text-success",
  bad: "bg-danger-soft text-destructive",
  warn: "bg-warning-soft text-warning",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary-soft text-primary",
} as const;

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof PILL;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
        PILL[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="erp-card flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
      <Inbox className="size-7 opacity-50" />
      {children}
    </div>
  );
}

export const th =
  "sticky top-0 z-10 bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
export const thR = cn(th, "text-right");
export const td = "px-3 py-2.5 text-xs";
export const tdR = cn(td, "text-right font-mono tabular-nums");

export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="erp-card max-h-[68vh] overflow-auto p-0">
      <table className="w-full border-collapse [&_tbody_tr:hover]:bg-muted/30">{children}</table>
    </div>
  );
}
