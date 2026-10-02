/** Shared HTML shell + helpers for every email template. Inline styles only (email clients strip <style>). */
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:38%">${esc(label)}</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600">${esc(value)}</td></tr>`;

export const detailsTable = (rows: [string, string | undefined | null][]) =>
  `<table role="presentation" width="100%" style="border-collapse:collapse;margin:12px 0">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => row(k, v!))
    .join("")}</table>`;

export function layout(opts: { title: string; bodyHtml: string }): string {
  const clinic = esc(CLINIC_CONFIG.fullName);
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" style="padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#1976d2;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">${clinic}</td></tr>
<tr><td style="padding:24px">
<h2 style="margin:0 0 12px;font-size:18px;color:#0f172a">${esc(opts.title)}</h2>
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11px">This is an automated message from ${clinic}. Please do not reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
}
