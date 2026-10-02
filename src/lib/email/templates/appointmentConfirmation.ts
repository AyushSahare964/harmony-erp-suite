import { layout, detailsTable, esc } from "./layout";

export function appointmentEmail(p: {
  ownerName: string; petName: string; date: string; time?: string; doctor?: string; token?: string | number; reason?: string;
}) {
  return {
    subject: `Appointment confirmed for ${p.petName} — ${p.date}`,
    html: layout({
      title: "Your appointment is booked",
      bodyHtml: `<p style="font-size:14px;color:#334155">Dear ${esc(p.ownerName)}, we have booked a visit for <b>${esc(p.petName)}</b>.</p>
${detailsTable([
  ["Date", p.date], ["Time", p.time], ["Doctor", p.doctor],
  ["Token", p.token != null ? String(p.token) : undefined], ["Reason", p.reason],
])}
<p style="font-size:13px;color:#64748b">Please arrive 10 minutes early and bring any previous medical records. To reschedule, call the clinic.</p>`,
    }),
  };
}
