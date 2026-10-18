import { formatDisplayDate } from "@/lib/utils/dateUtils";
import {
  getBookFn,
  getDailySummaryFn,
  getPaymentRegisterFn,
} from "@/lib/mongodb/serverFns/accounts";
import {
  Empty,
  Pill,
  ReportFrame,
  Stat,
  TableCard,
  downloadCsv,
  inr,
  inrOrDash,
  modeLabel,
  td,
  tdR,
  th,
  thR,
  useFyRange,
  useReport,
} from "./shared";

const KIND_LABEL: Record<string, string> = {
  RECEIPT: "Receipt",
  REFUND: "Customer refund",
  SUPPLIER_PAYMENT: "Supplier payment",
  EXPENSE: "Expense",
};

// ─── Cash Book / Business Book ───────────────────────────────────────────────

export function BookView({ scope }: { scope: "CASH" | "BUSINESS" }) {
  const [range, setRange] = useFyRange();
  const title = scope === "CASH" ? "Cash Book" : "Business Book";
  const { data, error, loading } = useReport(
    () => getBookFn({ data: { scope, from: range.from, to: range.to } }),
    `${scope}|${range.from}|${range.to}`,
  );

  const exportCsv = () =>
    data &&
    downloadCsv(
      `${title.replace(" ", "_")}_${range.from}_${range.to}.csv`,
      ["Date", "Voucher", "Particulars", "Mode", "Received", "Paid", "Balance"],
      data.rows.map((r) => [
        r.date,
        r.voucherNo,
        r.particulars,
        r.mode,
        r.received,
        r.paid,
        r.pending ? "" : r.balance,
      ]),
    );

  return (
    <ReportFrame
      title={title}
      subtitle={
        scope === "CASH"
          ? "Physical cash only — receipts, supplier payments and expenses paid in cash."
          : "All money in and out across cash, UPI, card, bank transfer and cheque."
      }
      range={range}
      onRange={setRange}
      onExport={exportCsv}
      loading={loading}
      error={error}
      notes={[
        "Built live from client receipts, supplier payments and expenses. Bounced cheques are left out; uncleared cheques/DDs are listed but kept out of the balance.",
      ]}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Opening balance"
              value={inr(data.openingBalance)}
              hint={`on ${formatDisplayDate(range.from)}`}
              tone="muted"
            />
            <Stat label="Total received" value={inr(data.totalReceived)} tone="good" />
            <Stat label="Total paid" value={inr(data.totalPaid)} tone="bad" />
            <Stat
              label="Closing balance"
              value={inr(data.closingBalance)}
              hint={`on ${formatDisplayDate(range.to)}`}
              tone={data.closingBalance < 0 ? "bad" : undefined}
            />
          </div>

          {scope === "BUSINESS" && data.byMode.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.byMode.map((m) => (
                <span
                  key={m.mode}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground"
                >
                  <b className="text-foreground">{modeLabel(m.mode)}</b> · in{" "}
                  <span className="font-mono text-success">{inr(m.received)}</span> · out{" "}
                  <span className="font-mono text-destructive">{inr(m.paid)}</span>
                </span>
              ))}
            </div>
          )}
          {(data.pendingReceived > 0 || data.pendingPaid > 0) && (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
              Pending clearance (not in the balance): {inr(data.pendingReceived)} received,{" "}
              {inr(data.pendingPaid)} issued.
            </p>
          )}

          {data.rows.length === 0 ? (
            <Empty>No {scope === "CASH" ? "cash" : ""} movements in this period.</Empty>
          ) : (
            <TableCard>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Voucher</th>
                  <th className={th}>Particulars</th>
                  <th className={th}>Mode</th>
                  <th className={thR}>Received</th>
                  <th className={thR}>Paid</th>
                  <th className={thR}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-muted/40 font-semibold">
                  <td className={td} colSpan={6}>
                    Opening balance
                  </td>
                  <td className={tdR}>{inr(data.openingBalance)}</td>
                </tr>
                {data.rows.map((r, i) => (
                  <tr key={`${r.voucherNo}-${i}`} className={r.pending ? "opacity-60" : undefined}>
                    <td className={td}>{formatDisplayDate(r.date)}</td>
                    <td className={`${td} font-mono`}>{r.voucherNo}</td>
                    <td className={td}>{r.particulars}</td>
                    <td className={td}>
                      <Pill tone={r.pending ? "warn" : "neutral"}>{modeLabel(r.mode)}</Pill>
                    </td>
                    <td className={`${tdR} text-success`}>{inrOrDash(r.received)}</td>
                    <td className={`${tdR} text-destructive`}>{inrOrDash(r.paid)}</td>
                    <td className={`${tdR} ${r.balance < 0 ? "text-destructive" : ""}`}>
                      {r.pending ? "—" : inr(r.balance)}
                    </td>
                  </tr>
                ))}
                <tr className="sticky bottom-0 bg-muted font-bold">
                  <td className={td} colSpan={4}>
                    Closing balance
                  </td>
                  <td className={tdR}>{inr(data.totalReceived)}</td>
                  <td className={tdR}>{inr(data.totalPaid)}</td>
                  <td className={tdR}>{inr(data.closingBalance)}</td>
                </tr>
              </tbody>
            </TableCard>
          )}
        </>
      )}
    </ReportFrame>
  );
}

// ─── Payment Received / Payment Paid ─────────────────────────────────────────

export function PaymentRegisterView({ direction }: { direction: "IN" | "OUT" }) {
  const [range, setRange] = useFyRange();
  const title = direction === "IN" ? "Payment Received" : "Payment Paid";
  const { data, error, loading } = useReport(
    () => getPaymentRegisterFn({ data: { direction, from: range.from, to: range.to } }),
    `${direction}|${range.from}|${range.to}`,
  );

  const exportCsv = () =>
    data &&
    downloadCsv(
      `${title.replace(" ", "_")}_${range.from}_${range.to}.csv`,
      ["Date", "Voucher", "Type", "Party", "Mode", "Reference", "Against", "Amount"],
      data.rows.map((r) => [
        r.date,
        r.voucherNo,
        KIND_LABEL[r.kind] ?? r.kind,
        r.party,
        r.modes,
        r.reference,
        r.against,
        r.amount,
      ]),
    );

  return (
    <ReportFrame
      title={title}
      subtitle={
        direction === "IN"
          ? "Every receipt from clients, with the invoices it settled."
          : "Supplier payments, expenses paid and refunds to clients."
      }
      range={range}
      onRange={setRange}
      onExport={exportCsv}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={direction === "IN" ? "Total received" : "Total paid"}
              value={inr(data.total)}
              tone={direction === "IN" ? "good" : "bad"}
            />
            <Stat label="Vouchers" value={String(data.rows.length)} tone="muted" />
            {data.byKind.map((k) => (
              <Stat key={k.kind} label={KIND_LABEL[k.kind] ?? k.kind} value={inr(k.amount)} />
            ))}
            {data.pending > 0 && (
              <Stat label="Pending clearance" value={inr(data.pending)} tone="muted" />
            )}
          </div>
          {data.byMode.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.byMode.map((m) => (
                <span
                  key={m.mode}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground"
                >
                  <b className="text-foreground">{modeLabel(m.mode)}</b> ·{" "}
                  <span className="font-mono">{inr(m.amount)}</span>
                </span>
              ))}
            </div>
          )}

          {data.rows.length === 0 ? (
            <Empty>No payments in this period.</Empty>
          ) : (
            <TableCard>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Voucher</th>
                  <th className={th}>Type</th>
                  <th className={th}>Party</th>
                  <th className={th}>Mode</th>
                  <th className={th}>Reference</th>
                  <th className={th}>Against</th>
                  <th className={thR}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r) => (
                  <tr key={`${r.kind}-${r.voucherNo}`}>
                    <td className={td}>{formatDisplayDate(r.date)}</td>
                    <td className={`${td} font-mono`}>{r.voucherNo}</td>
                    <td className={td}>
                      <Pill
                        tone={
                          r.kind === "RECEIPT" ? "good" : r.kind === "EXPENSE" ? "warn" : "info"
                        }
                      >
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </Pill>
                    </td>
                    <td className={`${td} font-medium`}>{r.party || "—"}</td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        {r.modes.split(" + ").map((m) => (
                          <Pill key={m}>{modeLabel(m)}</Pill>
                        ))}
                      </span>
                    </td>
                    <td className={`${td} font-mono`}>{r.reference || "—"}</td>
                    <td className={td}>
                      {r.against || (r.narration ? r.narration : "On account")}
                    </td>
                    <td className={tdR}>
                      {inr(r.amount)}
                      {r.pendingAmount > 0 && (
                        <span className="block text-[10px] text-warning">
                          +{inr(r.pendingAmount)} pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </>
      )}
    </ReportFrame>
  );
}

// ─── Daily Summary ───────────────────────────────────────────────────────────

export function DailySummaryView() {
  const [range, setRange] = useFyRange();
  const { data, error, loading } = useReport(
    () => getDailySummaryFn({ data: { from: range.from, to: range.to } }),
    `${range.from}|${range.to}`,
  );

  const cols = [
    ["Invoices", "invoiceCount"],
    ["Sales", "saleTotal"],
    ["Credit notes", "creditNoteTotal"],
    ["Purchases", "purchaseTotal"],
    ["Expenses", "expenseTotal"],
    ["Received", "received"],
    ["Paid out", "paidOut"],
    ["Cash in", "cashIn"],
    ["Cash out", "cashOut"],
  ] as const;

  const exportCsv = () =>
    data &&
    downloadCsv(
      `Daily_Summary_${range.from}_${range.to}.csv`,
      ["Date", ...cols.map((c) => c[0]), "Net cash"],
      data.rows.map((r) => [r.date, ...cols.map(([, k]) => r[k]), r.cashIn - r.cashOut]),
    );

  return (
    <ReportFrame
      title="Daily Summary"
      subtitle="One line per day: what was billed, bought, spent, collected and paid."
      range={range}
      onRange={setRange}
      onExport={exportCsv}
      loading={loading}
      error={error}
      notes={[
        "Sales, purchases and expenses are gross of GST (document totals). Received / paid out cover every payment mode; cash in / out is cash only.",
      ]}
    >
      {data && data.rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Sales"
            value={inr(data.totals.saleTotal - data.totals.creditNoteTotal)}
            hint={`${data.totals.invoiceCount} invoices, net of credit notes`}
          />
          <Stat label="Purchases" value={inr(data.totals.purchaseTotal)} tone="muted" />
          <Stat label="Expenses" value={inr(data.totals.expenseTotal)} tone="muted" />
          <Stat
            label="Net cash"
            value={inr(data.totals.cashIn - data.totals.cashOut)}
            hint="cash in minus cash out"
            tone={data.totals.cashIn - data.totals.cashOut < 0 ? "bad" : "good"}
          />
        </div>
      )}
      {data &&
        (data.rows.length === 0 ? (
          <Empty>No activity in this period.</Empty>
        ) : (
          <TableCard>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className={th}>Date</th>
                {cols.map(([label]) => (
                  <th key={label} className={thR}>
                    {label}
                  </th>
                ))}
                <th className={thR}>Net cash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r) => (
                <tr key={r.date}>
                  <td className={td}>{formatDisplayDate(r.date)}</td>
                  {cols.map(([label, k]) => (
                    <td key={label} className={tdR}>
                      {k === "invoiceCount" ? r[k] || "—" : inrOrDash(r[k])}
                    </td>
                  ))}
                  <td
                    className={`${tdR} font-semibold ${r.cashIn - r.cashOut < 0 ? "text-destructive" : "text-success"}`}
                  >
                    {inrOrDash(r.cashIn - r.cashOut)}
                  </td>
                </tr>
              ))}
              <tr className="sticky bottom-0 bg-muted font-bold">
                <td className={td}>Total</td>
                {cols.map(([label, k]) => (
                  <td key={label} className={tdR}>
                    {k === "invoiceCount" ? data.totals[k] : inr(data.totals[k])}
                  </td>
                ))}
                <td className={tdR}>{inr(data.totals.cashIn - data.totals.cashOut)}</td>
              </tr>
            </tbody>
          </TableCard>
        ))}
    </ReportFrame>
  );
}
