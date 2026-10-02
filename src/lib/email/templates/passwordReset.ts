import { layout, esc } from "./layout";

export function passwordResetEmail(p: { name: string; code: string; minutes: number }) {
  return {
    subject: `Your password reset code: ${p.code}`,
    html: layout({
      title: "Reset your password",
      bodyHtml: `<p style="font-size:14px;color:#334155">Hi ${esc(p.name)}, use this one-time code to set a new password:</p>
<p style="text-align:center;margin:20px 0"><span style="display:inline-block;letter-spacing:8px;font-size:30px;font-weight:700;color:#1976d2;background:#eff6ff;padding:12px 22px;border-radius:10px">${esc(p.code)}</span></p>
<p style="font-size:13px;color:#64748b">The code expires in ${p.minutes} minutes and works once. If you didn't request this, ignore this email — your password is unchanged.</p>`,
    }),
  };
}
