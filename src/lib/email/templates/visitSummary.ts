import { layout, detailsTable, esc, inr } from "./layout";

export interface VisitEmailLine { name: string; quantity: number; unitPrice: number; lineTotal: number; dosageInstructions?: string | undefined }

/** Bill + prescription sent to the owner after treatment is finalised. */
export function visitSummaryEmail(p: {
  ownerName: string; petName: string; date: string; doctor?: string; invoiceNo: string; prescriptionNo: string;
  diagnosis?: string; notes?: string; nextVisitDate?: string;
  lines: VisitEmailLine[]; totalAmount: number; amountPaid: number; balanceDue: number;
}) {
  const th = 'style="text-align:left;padding:8px;background:#f1f5f9;font-size:12px;color:#475569"';
  const td = 'style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;vertical-align:top"';
  const rows = p.lines
    .map(
      (l) => `<tr><td ${td}>${esc(l.name)}${l.dosageInstructions ? `<br><span style="color:#64748b;font-size:12px">${esc(l.dosageInstructions)}</span>` : ""}</td>
<td ${td} align="center">${esc(l.quantity)}</td><td ${td} align="right">${inr(l.lineTotal)}</td></tr>`
    )
    .join("");
  return {
    subject: `Treatment summary & invoice ${p.invoiceNo} for ${p.petName}`,
    html: layout({
      title: `Treatment summary for ${p.petName}`,
      bodyHtml: `<p style="font-size:14px;color:#334155">Dear ${esc(p.ownerName)}, thank you for visiting us. Here are the details of today's treatment.</p>
${detailsTable([
  ["Visit date", p.date], ["Doctor", p.doctor], ["Invoice no.", p.invoiceNo], ["Prescription no.", p.prescriptionNo],
  ["Diagnosis", p.diagnosis], ["Advice", p.notes], ["Next visit", p.nextVisitDate],
])}
<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:8px">
<tr><th ${th}>Prescription / Item</th><th ${th} align="center">Qty</th><th ${th} align="right">Amount</th></tr>${rows}
<tr><td ${td} colspan="2" align="right"><b>Total</b></td><td ${td} align="right"><b>${inr(p.totalAmount)}</b></td></tr>
<tr><td ${td} colspan="2" align="right">Paid</td><td ${td} align="right">${inr(p.amountPaid)}</td></tr>
<tr><td ${td} colspan="2" align="right"><b>Balance due</b></td><td ${td} align="right"><b style="color:${p.balanceDue > 0 ? "#dc2626" : "#16a34a"}">${inr(p.balanceDue)}</b></td></tr>
</table>`,
    }),
  };
}
