import type { LedgerReport } from "@/lib/mongodb/serverFns/ledgers";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

export const money = (n: number) =>
  Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Balance label: positive = Dr, negative = Cr. */
export const balanceLabel = (n: number) => `₹ ${money(n)} ${n < 0 ? "Cr" : "Dr"}`;

const fileBase = (r: LedgerReport, from: string, to: string) =>
  `${r.subjectName.replace(/[^\w]+/g, "_")}_ledger_${from}_${to}`;

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Opens in Excel; no xlsx dependency needed. */
export function exportCsv(r: LedgerReport, from: string, to: string) {
  const lines = [
    ["Sr No", "Date", "Voucher No", "Particulars", "Debit", "Credit", "Balance"],
    ["—", formatDisplayDate(from), "—", "Opening Balance", "", "", balanceLabel(r.openingBalance)],
    ...r.rows.map((x, idx) => [
      idx + 1,
      formatDisplayDate(x.date),
      x.voucherNo || "—",
      x.particulars,
      x.debit || "",
      x.credit || "",
      balanceLabel(x.balance),
    ]),
    ["—", "—", "—", "Total", r.totalDebit, r.totalCredit, balanceLabel(r.closingBalance)],
  ];
  const csv = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBase(r, from, to)}.csv`);
}

export async function exportPdf(r: LedgerReport, from: string, to: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const X = { sr: 36, date: 62, vch: 125, part: 200, debit: 410, credit: 480, bal: W - 36 };
  let y = 44;

  doc.setFontSize(14).setFont("helvetica", "bold").text(`${r.title} — ${r.subjectName}`, 36, y);
  y += 16;
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`${formatDisplayDate(from)} to ${formatDisplayDate(to)}${r.subjectMeta ? `   •   ${r.subjectMeta}` : ""}`, 36, y);
  y += 20;

  const head = () => {
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("Sr.", X.sr, y)
       .text("Date", X.date, y)
       .text("Voucher #", X.vch, y)
       .text("Particulars", X.part, y);
    doc.text("Debit (Dr)", X.debit + 50, y, { align: "right" })
       .text("Credit (Cr)", X.credit + 50, y, { align: "right" });
    doc.text("Balance", X.bal, y, { align: "right" });
    y += 12;
    doc.setFont("helvetica", "normal");
  };
  const line = (cells: [string, string, string, string, string, string, string]) => {
    if (y > H - 50) {
      doc.addPage();
      y = 44;
      head();
    }
    doc.text(cells[0], X.sr, y);
    doc.text(cells[1], X.date, y);
    doc.text(cells[2].slice(0, 14), X.vch, y);
    doc.text(doc.splitTextToSize(cells[3], 190)[0] ?? "", X.part, y);
    doc.text(cells[4], X.debit + 50, y, { align: "right" });
    doc.text(cells[5], X.credit + 50, y, { align: "right" });
    doc.text(cells[6], X.bal, y, { align: "right" });
    y += 13;
  };

  head();
  line(["—", formatDisplayDate(from), "—", "Opening Balance", "", "", balanceLabel(r.openingBalance)]);
  r.rows.forEach((x, idx) => {
    line([
      String(idx + 1),
      formatDisplayDate(x.date),
      x.voucherNo || "—",
      x.particulars,
      x.debit ? money(x.debit) : "",
      x.credit ? money(x.credit) : "",
      balanceLabel(x.balance),
    ]);
  });
  doc.setFont("helvetica", "bold");
  line(["—", "—", "—", "Total", money(r.totalDebit), money(r.totalCredit), balanceLabel(r.closingBalance)]);
  doc.save(`${fileBase(r, from, to)}.pdf`);
}

export function printLedger(r: LedgerReport, from: string, to: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const tr = (c: string[]) => `<tr>${c.map((v, i) => `<td class="${i >= 4 ? "r" : i === 0 ? "c" : ""}">${esc(v)}</td>`).join("")}</tr>`;
  const html = `<html><head><title>${esc(r.title)} - ${esc(r.subjectName)}</title><style>
    body{font:12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;margin:28px;color:#1e293b}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:16px}
    h2{margin:0 0 4px 0;font-size:18px;color:#0f172a}
    p{margin:0;font-size:12px;color:#64748b}
    table{border-collapse:collapse;width:100%;font-size:11px}
    td,th{border:1px solid #cbd5e1;padding:6px 8px}
    th{background:#f1f5f9;font-weight:600;text-align:left;color:#334155}
    .r{text-align:right}
    .c{text-align:center}
    .total-row td{font-weight:bold;background:#f8fafc;border-top:2px solid #0f172a}
    .opening-row td{background:#fafaf9;font-weight:500;color:#475569}
    @media print {
      body { margin: 12mm; }
      th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    </style></head><body>
    <div class="header">
      <div>
        <h2>${esc(r.title)} — ${esc(r.subjectName)}</h2>
        <p>Statement Period: ${formatDisplayDate(from)} to ${formatDisplayDate(to)} ${r.subjectMeta ? ` &bull; ${esc(r.subjectMeta)}` : ""}</p>
      </div>
      <div style="text-align:right">
        <p style="font-size:11px">Generated: ${formatDisplayDate(new Date().toISOString().slice(0, 10))}</p>
        <p style="font-size:14px;font-weight:bold;color:#2563eb;margin-top:4px">Closing: ${balanceLabel(r.closingBalance)}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center">Sr.</th>
          <th style="width:75px">Date</th>
          <th style="width:90px">Voucher #</th>
          <th>Particulars</th>
          <th class="r" style="width:85px">Debit (₹)</th>
          <th class="r" style="width:85px">Credit (₹)</th>
          <th class="r" style="width:95px">Balance (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr class="opening-row">
          <td class="c">—</td>
          <td>${formatDisplayDate(from)}</td>
          <td>—</td>
          <td>Opening Balance (Brought Forward)</td>
          <td class="r">—</td>
          <td class="r">—</td>
          <td class="r">${balanceLabel(r.openingBalance)}</td>
        </tr>
        ${r.rows.map((x, idx) => tr([
          String(idx + 1),
          formatDisplayDate(x.date),
          x.voucherNo || "—",
          x.particulars,
          x.debit ? money(x.debit) : "",
          x.credit ? money(x.credit) : "",
          balanceLabel(x.balance)
        ])).join("")}
        <tr class="total-row">
          <td class="c">—</td>
          <td>—</td>
          <td>—</td>
          <td>Period Total (${r.rows.length} transactions)</td>
          <td class="r">${money(r.totalDebit)}</td>
          <td class="r">${money(r.totalCredit)}</td>
          <td class="r">${balanceLabel(r.closingBalance)}</td>
        </tr>
      </tbody>
    </table></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

/** Short text summary for WhatsApp / email. */
export function summaryText(r: LedgerReport, from: string, to: string) {
  return `${r.title}: ${r.subjectName}\n${formatDisplayDate(from)} to ${formatDisplayDate(to)}\nClosing balance: ${balanceLabel(r.closingBalance)}`;
}
