import { layout, detailsTable, esc } from "./layout";

export function loginAlertEmail(p: { name: string; email: string; role: string; whenIST: string }) {
  return {
    subject: "New sign-in to your clinic account",
    html: layout({
      title: "New sign-in detected",
      bodyHtml: `<p style="font-size:14px;color:#334155">Hi ${esc(p.name)}, your staff account was just used to sign in.</p>
${detailsTable([["Account", p.email], ["Role", p.role], ["Time (IST)", p.whenIST]])}
<p style="font-size:13px;color:#b45309">If this wasn't you, reset your password immediately using "Forgot password?" on the login page and tell your Clinic Administrator.</p>`,
    }),
  };
}
