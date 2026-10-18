import { getProfitLossFn, getTaxReportFn } from "@/lib/mongodb/serverFns/accounts";
import type { TaxSection } from "@/lib/accounts/compute";
import { cn } from "@/lib/utils";
import {
  Empty,
  ReportFrame,
  Stat,
  TableCard,
  downloadCsv,
  inr,
  inrOrDash,
  td,
  tdR,
  th,
  thR,
  useFyRange,
  useReport,
} from "./shared";

// ─── Input / Output Tax ──────────────────────────────────────────────────────

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function TaxCard({
  title,
  section,
  caption,
}: {
  title: string;
  section: TaxSection;
  caption: string;
}) {
  const t = section.totals;
  const parts: [string, number][] = [
    ["CGST", t.cgst],
    ["SGST", t.sgst],
    ["IGST", t.igst],
    ["Cess", t.cess],
    ["On expenses", t.other],
  ];
  return (
    <div className="erp-card space-y-3 p-4">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{caption}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label">Taxable value</p>
          <p className="font-mono text-sm">{inr(t.taxable)}</p>
        </div>
        <div className="text-right">
          <p className="section-label">Tax</p>
          <p className="font-mono text-lg font-bold">{inr(t.total)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {parts
          .filter(([, v]) => Math.abs(v) >= 0.005)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono">{inr(v)}</dd>
            </div>
          ))}
      </dl>

      {section.byRate.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 text-left font-semibold text-muted-foreground">Rate</th>
              <th className="py-1 text-right font-semibold text-muted-foreground">Taxable</th>
              <th className="py-1 text-right font-semibold text-muted-foreground">Tax</th>
            </tr>
          </thead>
          <tbody>
            {section.byRate.map((r) => (
              <tr key={String(r.rate)} className="border-b border-border/50">
                <td className="py-1">{r.rate == null ? "Expenses (rate n/a)" : `${r.rate}%`}</td>
                <td className="py-1 text-right font-mono">{inr(r.taxable)}</td>
                <td className="py-1 text-right font-mono">{inr(r.tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function TaxView() {
  const [range, setRange] = useFyRange();
  const { data, error, loading } = useReport(
    () => getTaxReportFn({ data: { from: range.from, to: range.to } }),
    `${range.from}|${range.to}`,
  );

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    for (const [side, s] of [
      ["Output", data.output],
      ["Input", data.input],
    ] as const) {
      for (const m of s.byMonth) rows.push([side, monthLabel(m.month), m.taxable, m.tax]);
    }
    downloadCsv(`GST_${range.from}_${range.to}.csv`, ["Side", "Month", "Taxable", "Tax"], rows);
  };

  const months = data
    ? [...new Set([...data.output.byMonth, ...data.input.byMonth].map((m) => m.month))].sort()
    : [];

  return (
    <ReportFrame
      title="Input / Output Tax"
      subtitle="GST collected on sales against GST credit on purchases and expenses."
      range={range}
      onRange={setRange}
      onExport={exportCsv}
      loading={loading}
      error={error}
      notes={[
        "Output = posted invoices less credit notes. Input = purchase bills marked ITC-eligible (less debit notes) plus expenses with ITC claimed.",
        "GST already deposited with the government is not recorded in the system, so net payable is before any such deposits.",
      ]}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Output tax (collected)" value={inr(data.output.totals.total)} />
            <Stat label="Input tax credit" value={inr(data.input.totals.total)} />
            <Stat
              label={data.netPayable >= 0 ? "Net GST payable" : "Net credit carried forward"}
              value={inr(Math.abs(data.netPayable))}
              tone={data.netPayable > 0 ? "bad" : "good"}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TaxCard
              title="Output tax"
              caption="Sales invoices net of credit notes"
              section={data.output}
            />
            <TaxCard
              title="Input tax credit"
              caption="Purchase bills and expenses"
              section={data.input}
            />
          </div>
          {months.length > 0 && (
            <TableCard>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className={th}>Month</th>
                  <th className={thR}>Output tax</th>
                  <th className={thR}>Input tax</th>
                  <th className={thR}>Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {months.map((m) => {
                  const o = data.output.byMonth.find((x) => x.month === m)?.tax ?? 0;
                  const i = data.input.byMonth.find((x) => x.month === m)?.tax ?? 0;
                  return (
                    <tr key={m}>
                      <td className={td}>{monthLabel(m)}</td>
                      <td className={tdR}>{inrOrDash(o)}</td>
                      <td className={tdR}>{inrOrDash(i)}</td>
                      <td className={cn(tdR, "font-semibold")}>{inr(o - i)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
          {months.length === 0 && <Empty>No taxable activity in this period.</Empty>}
        </>
      )}
    </ReportFrame>
  );
}

// ─── Profit & Loss ───────────────────────────────────────────────────────────

function Line({
  label,
  amount,
  bold,
  indent,
  share,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  /** 0–1: this line as a share of its section, drawn as a thin bar. */
  share?: number;
}) {
  return (
    <div
      className={cn(
        "py-1 text-xs",
        bold && "border-t border-border pt-2 text-sm font-bold",
        indent && "pl-4",
      )}
    >
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{inr(amount)}</span>
      </div>
      {share !== undefined && share > 0 && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${Math.min(100, share * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ProfitLossView() {
  const [range, setRange] = useFyRange();
  const { data, error, loading } = useReport(
    () => getProfitLossFn({ data: { from: range.from, to: range.to } }),
    `${range.from}|${range.to}`,
  );

  const exportCsv = () =>
    data &&
    downloadCsv(
      `Profit_Loss_${range.from}_${range.to}.csv`,
      ["Section", "Line", "Amount"],
      [
        ...data.income.map((r) => ["Income", r.label, r.amount] as (string | number)[]),
        ["Income", "Total income", data.totalIncome],
        ["Cost", "Purchases", data.purchases],
        ["Result", "Gross profit", data.grossProfit],
        ...data.expenses.map((r) => ["Expense", r.label, r.amount] as (string | number)[]),
        ["Expense", "Total expenses", data.totalExpenses],
        ["Result", "Net profit", data.netProfit],
      ],
    );

  return (
    <ReportFrame
      title="Profit & Loss Summary"
      subtitle="Income earned, goods bought and money spent over the period."
      range={range}
      onRange={setRange}
      onExport={exportCsv}
      loading={loading}
      error={error}
      notes={[
        "Figures exclude GST. Income = posted invoices less credit notes; purchases = bills less debit notes, with non-claimable GST counted as cost.",
        "Purchase basis: stock bought is counted in full when billed and closing stock is not deducted, so profit reads low while the clinic is building up stock.",
      ]}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Income" value={inr(data.totalIncome)} hint="excluding GST" />
            <Stat label="Purchases" value={inr(data.purchases)} />
            <Stat label="Expenses" value={inr(data.totalExpenses)} />
            <Stat
              hint={
                data.totalIncome > 0
                  ? `${((data.netProfit / data.totalIncome) * 100).toFixed(1)}% of income`
                  : undefined
              }
              label="Net profit"
              value={inr(data.netProfit)}
              tone={data.netProfit < 0 ? "bad" : "good"}
            />
          </div>
          <div className="erp-card mx-auto max-w-2xl space-y-1 p-5">
            <p className="section-label pb-1">Income</p>
            {data.income.length === 0 && (
              <p className="text-xs text-muted-foreground">No sales in this period.</p>
            )}
            {data.income.map((r) => (
              <Line
                key={r.label}
                indent
                label={r.label}
                amount={r.amount}
                share={data.totalIncome > 0 ? r.amount / data.totalIncome : 0}
              />
            ))}
            <Line bold label="Total income" amount={data.totalIncome} />

            <p className="section-label pb-1 pt-4">Cost of purchases</p>
            <Line indent label="Purchases (net of debit notes)" amount={data.purchases} />
            <Line bold label="Gross profit" amount={data.grossProfit} />

            <p className="section-label pb-1 pt-4">Expenses</p>
            {data.expenses.length === 0 && (
              <p className="text-xs text-muted-foreground">No expenses in this period.</p>
            )}
            {data.expenses.map((r) => (
              <Line
                key={r.label}
                indent
                label={r.label}
                amount={r.amount}
                share={data.totalExpenses > 0 ? r.amount / data.totalExpenses : 0}
              />
            ))}
            <Line bold label="Total expenses" amount={data.totalExpenses} />

            <div
              className={cn(
                "mt-3 rounded-lg px-3 py-2",
                data.netProfit < 0 ? "bg-destructive/10" : "bg-success/10",
              )}
            >
              <Line
                bold
                label={data.netProfit < 0 ? "Net loss" : "Net profit"}
                amount={data.netProfit}
              />
            </div>
            {data.excludedPersonal > 0 && (
              <p className="pt-2 text-[11px] text-muted-foreground">
                {inr(data.excludedPersonal)} of personal-nature expenses is excluded from profit.
              </p>
            )}
          </div>
        </>
      )}
    </ReportFrame>
  );
}
