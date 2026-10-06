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
    ["Date", "Voucher", "Particulars", "Debit", "Credit", "Balance"],
    ["", "", "Opening Balance", "", "", balanceLabel(r.openingBalance)],
    ...r.rows.map((x) => [formatDisplayDate(x.date), x.voucherNo, x.particulars, x.debit || "", x.credit || "", balanceLabel(x.balance)]),
    ["", "", "Total", r.totalDebit, r.totalCredit, balanceLabel(r.closingBalance)],
  ];
  const csv = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBase(r, from, to)}.csv`);
}

export async function exportPdf(r: LedgerReport, from: string, to: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const X = { date: 36, vch: 100, part: 170, debit: 400, credit: 465, bal: W - 36 };
  let y = 44;

  doc.setFontSize(14).setFont("helvetica", "bold").text(`${r.title} — ${r.subjectName}`, 36, y);
  y += 16;
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`${formatDisplayDate(from)} to ${formatDisplayDate(to)}${r.subjectMeta ? `   •   ${r.subjectMeta}` : ""}`, 36, y);
  y += 20;

  const head = () => {
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("Date", X.date, y).text("Voucher", X.vch, y).text("Particulars", X.part, y);
    doc.text("Debit", X.debit + 50, y, { align: "right" }).text("Credit", X.credit + 50, y, { align: "right" });
    doc.text("Balance", X.bal, y, { align: "right" });
    y += 12;
    doc.setFont("helvetica", "normal");
  };
  const line = (cells: [string, string, string, string, string, string]) => {
    if (y > H - 50) {
      doc.addPage();
      y = 44;
      head();
    }
    doc.text(cells[0], X.date, y).text(cells[1].slice(0, 14), X.vch, y);
    doc.text(doc.splitTextToSize(cells[2], 220)[0] ?? "", X.part, y);
    doc.text(cells[3], X.debit + 50, y, { align: "right" }).text(cells[4], X.credit + 50, y, { align: "right" });
    doc.text(cells[5], X.bal, y, { align: "right" });
    y += 13;
  };

  head();
  line(["", "", "Opening Balance", "", "", balanceLabel(r.openingBalance)]);
  for (const x of r.rows) {
    line([formatDisplayDate(x.date), x.voucherNo, x.particulars, x.debit ? money(x.debit) : "", x.credit ? money(x.credit) : "", balanceLabel(x.balance)]);
  }
  doc.setFont("helvetica", "bold");
  line(["", "", "Total", money(r.totalDebit), money(r.totalCredit), balanceLabel(r.closingBalance)]);
  doc.save(`${fileBase(r, from, to)}.pdf`);
}

export function printLedger(r: LedgerReport, from: string, to: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const tr = (c: string[]) => `<tr>${c.map((v, i) => `<td class="${i > 2 ? "r" : ""}">${esc(v)}</td>`).join("")}</tr>`;
  const html = `<html><head><title>${esc(r.title)}</title><style>
    body{font:12px Arial;margin:24px}table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ccc;padding:4px 6px}th{background:#eee}.r{text-align:right}</style></head><body>
    <h3>${esc(r.title)} — ${esc(r.subjectName)}</h3><p>${formatDisplayDate(from)} to ${formatDisplayDate(to)} ${esc(r.subjectMeta)}</p>
    <table><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
    ${tr(["", "", "Opening Balance", "", "", balanceLabel(r.openingBalance)])}
    ${r.rows.map((x) => tr([formatDisplayDate(x.date), x.voucherNo, x.particulars, x.debit ? money(x.debit) : "", x.credit ? money(x.credit) : "", balanceLabel(x.balance)])).join("")}
    ${tr(["", "", "Total", money(r.totalDebit), money(r.totalCredit), balanceLabel(r.closingBalance)])}
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
