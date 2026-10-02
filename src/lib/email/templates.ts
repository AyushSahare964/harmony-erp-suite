/**
 * Unified Email Templates for Harmony ERP / Real Care Animal Clinic
 * Single-file template engine combining HTML structure, inlined CSS, and JS/TS template builders.
 * Supports individual EmailJS templates per query and master template fallback.
 */

import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { type EmailQueryType, resolveTemplateId, logoUrl } from "./emailjs";

// ─── Helpers & Formatting ───────────────────────────────────────────────────

export const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c] || c);

export const inr = (n: number | string): string => {
  const num = Number(n) || 0;
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── Shared Inlined CSS Design Tokens ───────────────────────────────────────

const STYLES = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  primaryColor: "#0284c7",
  primaryDark: "#0369a1",
  slate900: "#0f172a",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  border: "#e2e8f0",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};

// ─── Component Builders ────────────────────────────────────────────────────

/** Renders a standard two-column key/value details table */
export function renderDetailsTable(rows: [string, string | undefined | null][]): string {
  const validRows = rows.filter(([, v]) => v != null && String(v).trim() !== "");
  if (validRows.length === 0) return "";

  const trs = validRows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding: 10px 14px; color: ${STYLES.slate500}; font-size: 13px; font-weight: 500; width: 38%; border-bottom: 1px solid ${STYLES.border}; vertical-align: top;">${esc(k)}</td>
        <td style="padding: 10px 14px; color: ${STYLES.slate900}; font-size: 13px; font-weight: 600; border-bottom: 1px solid ${STYLES.border}; vertical-align: top;">${esc(v)}</td>
      </tr>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" style="border-collapse: collapse; margin: 18px 0; background-color: ${STYLES.slate50}; border-radius: 8px; overflow: hidden; border: 1px solid ${STYLES.border};">
      ${trs}
    </table>`;
}

/** Renders an eye-catching highlight / code box (for OTP, reset code, key amounts) */
export function renderHighlightBox(opts: {
  code: string;
  subtitle?: string;
  badge?: string;
  bg?: string;
  color?: string;
}): string {
  const bg = opts.bg || "#eff6ff";
  const color = opts.color || STYLES.primaryDark;
  return `
    <div style="text-align: center; margin: 24px 0; padding: 22px 16px; background-color: ${bg}; border: 2px dashed #93c5fd; border-radius: 12px;">
      ${opts.badge ? `<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${color}; margin-bottom: 8px;">${esc(opts.badge)}</div>` : ""}
      <div style="display: inline-block; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: ${color}; padding: 6px 16px;">
        ${esc(opts.code)}
      </div>
      ${opts.subtitle ? `<div style="font-size: 12px; font-weight: 500; color: ${STYLES.slate500}; margin-top: 10px;">${esc(opts.subtitle)}</div>` : ""}
    </div>`;
}

/** Renders an alert / caution callout box */
export function renderNoticeBox(opts: { text: string; variant?: "warning" | "info" | "success" | "danger" }): string {
  const variants = {
    warning: { bg: "#fffbeb", border: "#f59e0b", color: "#92400e", title: "Security Notice" },
    info: { bg: "#f0f9ff", border: "#0284c7", color: "#0369a1", title: "Important Information" },
    success: { bg: "#f0fdf4", border: "#16a34a", color: "#166534", title: "Notice" },
    danger: { bg: "#fef2f2", border: "#ef4444", color: "#991b1b", title: "Security Alert" },
  };
  const v = variants[opts.variant || "warning"];
  return `
    <div style="background-color: ${v.bg}; border-left: 4px solid ${v.border}; padding: 14px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${v.color}; margin-bottom: 4px;">
        ${v.title}
      </div>
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${v.color};">
        ${esc(opts.text)}
      </p>
    </div>`;
}

/** Shared master email layout wrapper with inlined CSS */
export function renderEmailLayout(opts: {
  title: string;
  badge?: string;
  preheader?: string;
  bodyHtml: string;
}): string {
  const clinic = CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic";
  const tagline = CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care";
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();
  const phone = CLINIC_CONFIG.phone || "";
  const email = CLINIC_CONFIG.email || "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(opts.title)}</title>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: ${STYLES.slate100}; font-family: ${STYLES.fontFamily}; color: ${STYLES.slate900};">
  ${opts.preheader ? `<div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">${esc(opts.preheader)}</div>` : ""}
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${STYLES.slate100}; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card (600px max) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid ${STYLES.border}; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);">
          
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, ${STYLES.primaryColor} 0%, ${STYLES.primaryDark} 100%); padding: 22px 28px; color: #ffffff;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" width="64" style="vertical-align: middle; padding-right: 14px;">
                    <img src="${esc(logoUrl(CLINIC_CONFIG.logoPath))}" alt="${esc(clinic)}" width="52" height="52" style="display: block; width: 52px; height: 52px; object-fit: contain; background-color: #ffffff; border-radius: 10px; padding: 4px;">
                  </td>
                  <td align="left" style="vertical-align: middle;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #bae6fd; margin-bottom: 3px;">
                      ${esc(tagline)}
                    </div>
                    <div style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px;">
                      ${esc(clinic)}
                    </div>
                  </td>
                  ${
                    opts.badge
                      ? `<td align="right" style="vertical-align: middle;">
                          <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${esc(opts.badge)}
                          </span>
                        </td>`
                      : ""
                  }
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 30px 28px 24px 28px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: ${STYLES.slate900}; line-height: 1.3;">
                ${esc(opts.title)}
              </h2>
              ${opts.bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${STYLES.slate50}; border-top: 1px solid ${STYLES.border}; padding: 18px 28px; font-size: 12px; color: ${STYLES.slate500}; line-height: 1.5;">
              <div style="font-weight: 600; color: ${STYLES.slate700}; margin-bottom: 2px;">${esc(clinic)}</div>
              <div>${esc(address)}${phone ? ` · Tel: ${esc(phone)}` : ""}${email ? ` · ${esc(email)}` : ""}</div>
              <div style="margin-top: 8px; font-size: 11px; color: ${STYLES.slate400};">
                This is an automated system notification from ${esc(clinic)}. Please do not reply directly to this email.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Output Contract ───────────────────────────────────────────────────────

export interface EmailTemplateResult {
  subject: string;
  queryType: EmailQueryType;
  templateId: string;
  html: string;
  /** Parameters matching the individual EmailJS template and master template */
  templateParams: Record<string, string>;
}

// ─── 2. Staff Registration OTP Verification ────────────────────────────────

export interface RegistrationOTPProps {
  name: string;
  email: string;
  code: string;
  minutes?: number;
}

export function registrationOTPEmail(p: RegistrationOTPProps): EmailTemplateResult {
  const queryType: EmailQueryType = "registrationOTP";
  const templateId = resolveTemplateId(queryType);
  const minutes = p.minutes || 10;
  const subject = `Your Staff Registration Verification Code: ${p.code}`;
  const badge = "VERIFICATION";
  const title = "Verify Your Staff Account";
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Hi <b>${esc(p.name)}</b>, use this code to verify your email address:</p>`;
  const highlight = renderHighlightBox({
    code: p.code,
    badge: "Registration OTP",
    subtitle: `Expires in ${minutes} minutes · One-time verification code`,
  });
  const bodyHtml = `${intro}${highlight}`;
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();

  return {
    subject,
    queryType,
    templateId,
    html: renderEmailLayout({
      title,
      badge,
      preheader: `Your verification code is ${p.code}`,
      bodyHtml,
    }),
    templateParams: {
      // Matching 2_registration_otp.html
      clinic_name: CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic",
      clinic_tagline: CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care",
      clinic_address: address,
      clinic_phone: CLINIC_CONFIG.phone || "",
      clinic_logo_url: logoUrl(CLINIC_CONFIG.logoPath),
      to_name: p.name,
      to_email: p.email,
      account_email: p.email,
      otp_code: p.code,
      expiry_minutes: String(minutes),
      role_name: "Staff Portal Access",
      purpose: "Staff Self-Registration Verification",
      // Master template fallbacks
      subject,
      title,
      header_badge: badge,
      greeting_and_intro: `Welcome ${p.name}! Use the verification code below to verify your registration.`,
      highlight_box: highlight,
      details_table: "",
      items_table: "",
      warning_notice: "",
      footer_note: `This code expires in ${minutes} minutes.`,
    },
  };
}

// ─── 3. Password Reset Link ────────────────────────────────────────────────

export interface PasswordResetProps {
  name: string;
  email: string;
  /** Full one-time reset URL (https://<app>/reset-password?token=…) */
  link: string;
  minutes?: number;
}

export function passwordResetEmail(p: PasswordResetProps): EmailTemplateResult {
  const queryType: EmailQueryType = "passwordReset";
  const templateId = resolveTemplateId(queryType);
  const minutes = p.minutes || 30;
  const subject = "Reset Your Clinic Portal Password";
  const badge = "PASSWORD RESET";
  const title = "Reset Your Password";
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Hi <b>${esc(p.name)}</b>, we received a request to reset the password for <b>${esc(p.email)}</b>. Click the button below to choose a new password:</p>`;
  const button = `<div style="text-align: center; margin: 26px 0;"><a href="${esc(p.link)}" style="display: inline-block; background-color: ${STYLES.primaryColor}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 30px; border-radius: 8px;">Reset Password</a><div style="font-size: 12px; color: ${STYLES.slate500}; margin-top: 10px;">Link expires in ${minutes} minutes · Works only once</div></div>`;
  const warning = renderNoticeBox({
    variant: "warning",
    text: "If you did not request a password reset, you can safely ignore this email — your password is unchanged. Never share this link with anyone.",
  });

  const bodyHtml = `${intro}${button}${warning}`;
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();

  return {
    subject,
    queryType,
    templateId,
    html: renderEmailLayout({
      title,
      badge,
      preheader: `Reset your password (link expires in ${minutes} mins)`,
      bodyHtml,
    }),
    templateParams: {
      // Matching 3_password_reset.html
      clinic_name: CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic",
      clinic_tagline: CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care",
      clinic_address: address,
      clinic_phone: CLINIC_CONFIG.phone || "",
      clinic_logo_url: logoUrl(CLINIC_CONFIG.logoPath),
      to_name: p.name,
      to_email: p.email,
      account_email: p.email,
      reset_link: p.link,
      expiry_minutes: String(minutes),
      // Master template fallbacks
      subject,
      title,
      header_badge: badge,
      greeting_and_intro: `Hi ${p.name}, use the link to reset your password.`,
      highlight_box: button,
      details_table: "",
      items_table: "",
      warning_notice: warning,
      footer_note: "If you did not request this, ignore this email.",
    },
  };
}
