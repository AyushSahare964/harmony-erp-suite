import { Receipt } from "lucide-react";
import { fmtDate } from "@/lib/doctor/format";
import type { HistoryRecord } from "@/lib/doctor/records";

const flagClass = (v: string) =>
  /^(Normal|Negative|Not seen)$/i.test(v)
    ? "ok"
    : /^(Abnormal|High|Low|Positive)$/i.test(v)
      ? "late"
      : undefined;

/** One record with every detail as labelled fields, an optional table, a View bill button and a status tag. */
export function RecordCard({
  record: r,
  onViewBill,
}: {
  record: HistoryRecord;
  onViewBill: (invoiceNo: string) => void;
}) {
  return (
    <article className="rec">
      <header>
        <span className="rec-date">{fmtDate(r.date)}</span>
        <h4>{r.title}</h4>
        {r.bill && (
          <button className="bill-btn" type="button" onClick={() => onViewBill(r.bill!)}>
            <Receipt aria-hidden="true" /> View bill
          </button>
        )}
        <span className={`chip ${r.tone}`}>{r.tag}</span>
      </header>
      <dl className="rec-grid">
        {r.fields.map(([label, value, wide]) => (
          <div key={label} className={wide ? "wide" : undefined}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {r.table && (
        <table className="mini">
          <thead>
            <tr>
              {r.table.cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={flagClass(cell)}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {r.note && <p className="rec-note">{r.note}</p>}
    </article>
  );
}
