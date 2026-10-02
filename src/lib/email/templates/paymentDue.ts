import { layout, detailsTable, esc, inr } from "./layout";

export function paymentDueEmail(p: { ownerName: string; petName: string; amount: number; dueDate: string; invoiceNo?: string; reminderType: string }) {
  return {
    subject: `Payment reminder${p.invoiceNo ? ` — invoice ${p.invoiceNo}` : ""}: ${inr(p.amount)} due`,
    html: layout({
      title: "Payment reminder",
      bodyHtml: `<p style="font-size:14px;color:#334155">Dear ${esc(p.ownerName)}, this is a friendly reminder that a payment for <b>${esc(p.petName)}</b> is due.</p>
${detailsTable([["Amount due", inr(p.amount)], ["Due date", p.dueDate], ["Invoice no.", p.invoiceNo], ["Regarding", p.reminderType]])}
<p style="font-size:13px;color:#64748b">Please settle at the clinic counter or contact us if you have already paid.</p>`,
    }),
  };
}
