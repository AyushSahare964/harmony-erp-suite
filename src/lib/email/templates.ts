/**
 * Unified Email Templates for Harmony ERP / Real Care Animal Clinic
 * Single-file template engine combining HTML structure, inlined CSS, and JS/TS template builders.
 * Supports individual EmailJS templates per query and master template fallback.
 */

import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { type EmailQueryType, resolveTemplateId } from "./emailjs";

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

// ─── 1. Login Security Alert ───────────────────────────────────────────────

export interface LoginAlertProps {
  name: string;
  email: string;
  role: string;
  whenIST: string;
}

export function loginAlertEmail(p: LoginAlertProps): EmailTemplateResult {
  const queryType: EmailQueryType = "loginAlert";
  const templateId = resolveTemplateId(queryType);
  const subject = "Security Alert: New Sign-in to Your Clinic Account";
  const badge = "SECURITY ALERT";
  const title = "New Sign-in Detected";
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Hi <b>${esc(p.name)}</b>, your clinic staff account was just used to sign in to the portal.</p>`;
  const details = renderDetailsTable([
    ["Account Email", p.email],
    ["Assigned Role", p.role],
    ["Sign-in Time (IST)", p.whenIST],
    ["Security Status", "Successful Authentication"],
  ]);
  const warning = renderNoticeBox({
    variant: "warning",
    text: "If this was not you, reset your password immediately using 'Forgot password?' on the login screen and inform your Clinic Administrator.",
  });

  const bodyHtml = `${intro}${details}${warning}`;
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();

  return {
    subject,
    queryType,
    templateId,
    html: renderEmailLayout({
      title,
      badge,
      preheader: `Sign-in alert for ${p.email} at ${p.whenIST}`,
      bodyHtml,
    }),
    templateParams: {
      // Matching 1_login_alert.html
      clinic_name: CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic",
      clinic_tagline: CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care",
      clinic_address: address,
      clinic_phone: CLINIC_CONFIG.phone || "",
      to_name: p.name,
      to_email: p.email,
      account_email: p.email,
      user_role: p.role,
      login_time: p.whenIST,
      device_session: "Authorized Web Portal",
      security_status: "Successful Authentication",
      // Master template fallbacks
      subject,
      title,
      header_badge: badge,
      greeting_and_intro: `Hi ${p.name}, your clinic staff account was just used to sign in to the portal.`,
      highlight_box: "",
      details_table: details,
      items_table: "",
      warning_notice: warning,
      footer_note: "If this was not you, change your password immediately.",
    },
  };
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
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Welcome to <b>${esc(CLINIC_CONFIG.fullName)}</b>, ${esc(p.name)}! Use the 6-digit verification code below to verify your email address and submit your staff registration for review.</p>`;
  const highlight = renderHighlightBox({
    code: p.code,
    badge: "Registration OTP",
    subtitle: `Expires in ${minutes} minutes · One-time verification code`,
  });
  const details = renderDetailsTable([
    ["Email Address", p.email],
    ["Purpose", "Staff Portal Self-Registration"],
    ["Validity", `${minutes} minutes`],
  ]);
  const notice = renderNoticeBox({
    variant: "info",
    text: "Once verified, your account will be reviewed by the clinic administrator before full access is granted.",
  });

  const bodyHtml = `${intro}${highlight}${details}${notice}`;
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
      details_table: details,
      items_table: "",
      warning_notice: notice,
      footer_note: `This code expires in ${minutes} minutes.`,
    },
  };
}

// ─── 3. Password Reset Code ────────────────────────────────────────────────

export interface PasswordResetProps {
  name: string;
  code: string;
  minutes?: number;
}

export function passwordResetEmail(p: PasswordResetProps): EmailTemplateResult {
  const queryType: EmailQueryType = "passwordReset";
  const templateId = resolveTemplateId(queryType);
  const minutes = p.minutes || 10;
  const subject = `Your Password Reset Code: ${p.code}`;
  const badge = "PASSWORD RESET";
  const title = "Reset Your Password";
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Hi <b>${esc(p.name)}</b>, we received a request to reset your password. Use the security code below to establish a new password:</p>`;
  const highlight = renderHighlightBox({
    code: p.code,
    badge: "One-Time Reset Code",
    subtitle: `Expires in ${minutes} minutes · Works only once`,
  });
  const warning = renderNoticeBox({
    variant: "warning",
    text: `The code expires in ${minutes} minutes. If you did not request a password reset, you can safely disregard this email — your account remains protected.`,
  });

  const bodyHtml = `${intro}${highlight}${warning}`;
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();

  return {
    subject,
    queryType,
    templateId,
    html: renderEmailLayout({
      title,
      badge,
      preheader: `Your reset code is ${p.code} (expires in ${minutes} mins)`,
      bodyHtml,
    }),
    templateParams: {
      // Matching 3_password_reset.html
      clinic_name: CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic",
      clinic_tagline: CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care",
      clinic_address: address,
      clinic_phone: CLINIC_CONFIG.phone || "",
      to_name: p.name,
      reset_code: p.code,
      expiry_minutes: String(minutes),
      account_email: p.name,
      // Master template fallbacks
      subject,
      title,
      header_badge: badge,
      greeting_and_intro: `Hi ${p.name}, use this code to reset your password.`,
      highlight_box: highlight,
      details_table: "",
      items_table: "",
      warning_notice: warning,
      footer_note: "If you did not request this, ignore this email.",
    },
  };
}

// ─── 4. Appointment Confirmation ───────────────────────────────────────────

export interface AppointmentEmailProps {
  ownerName: string;
  petName: string;
  date: string;
  time?: string;
  doctor?: string;
  token?: string | number;
  reason?: string;
}

export function appointmentEmail(p: AppointmentEmailProps): EmailTemplateResult {
  const queryType: EmailQueryType = "appointment";
  const templateId = resolveTemplateId(queryType);
  const subject = `Appointment Confirmed for ${p.petName} — ${p.date}`;
  const badge = "APPOINTMENT";
  const title = "Your Appointment is Confirmed!";
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Dear <b>${esc(p.ownerName)}</b>, a veterinary consultation has been scheduled for <b>${esc(p.petName)}</b>. Here are the booking details:</p>`;
  const details = renderDetailsTable([
    ["Patient (Pet)", p.petName],
    ["Appointment Date", p.date],
    ["Time Slot", p.time || "Regular Clinic Hours"],
    ["Consulting Doctor", p.doctor || CLINIC_CONFIG.doctorName],
    ["Queue Token #", p.token != null ? String(p.token) : undefined],
    ["Reason for Visit", p.reason],
  ]);
  const tips = renderNoticeBox({
    variant: "info",
    text: "Please arrive 10 minutes prior to your slot and bring previous medical records or vaccination cards. To reschedule or cancel, please call the clinic desk.",
  });

  const bodyHtml = `${intro}${details}${tips}`;
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();

  return {
    subject,
    queryType,
    templateId,
    html: renderEmailLayout({
      title,
      badge,
      preheader: `Confirmed appointment for ${p.petName} on ${p.date}`,
      bodyHtml,
    }),
    templateParams: {
      // Matching 4_appointment_confirmation.html
      clinic_name: CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic",
      clinic_tagline: CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care",
      clinic_address: address,
      clinic_phone: CLINIC_CONFIG.phone || "",
      owner_name: p.ownerName,
      to_name: p.ownerName,
      pet_name: p.petName,
      appointment_date: p.date,
      appointment_time: p.time || "Regular Clinic Hours",
      doctor_name: p.doctor || CLINIC_CONFIG.doctorName,
      queue_token: p.token != null ? String(p.token) : "Walk-in",
      reason_for_visit: p.reason || "General Veterinary Consultation",
      // Master template fallbacks
      subject,
      title,
      header_badge: badge,
      greeting_and_intro: `Dear ${p.ownerName}, your appointment for ${p.petName} is confirmed.`,
      highlight_box: "",
      details_table: details,
      items_table: "",
      warning_notice: tips,
      footer_note: `To reschedule, call ${CLINIC_CONFIG.phone || "the clinic"}.`,
    },
  };
}

// ─── 5. Payment Due Reminder ───────────────────────────────────────────────

export interface PaymentDueProps {
  ownerName: string;
  petName: string;
  amount: number;
  dueDate: string;
  invoiceNo?: string;
  reminderType: string;
}

export function paymentDueEmail(p: PaymentDueProps): EmailTemplateResult {
  const queryType: EmailQueryType = "paymentDue";
  const templateId = resolveTemplateId(queryType);
  const formattedAmt = inr(p.amount);
  const subject = `Payment Reminder: ${formattedAmt} Due for ${p.petName}`;
  const badge = "PAYMENT REMINDER";
  const title = "Payment Due Reminder";
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Dear <b>${esc(p.ownerName)}</b>, this is a courteous reminder that an outstanding payment for <b>${esc(p.petName)}</b> is pending.</p>`;
  const highlight = renderHighlightBox({
    code: formattedAmt,
    badge: "Outstanding Balance",
    subtitle: `Due Date: ${p.dueDate}`,
    bg: "#fffbeb",
    color: "#b45309",
  });
  const details = renderDetailsTable([
    ["Patient (Pet)", p.petName],
    ["Amount Due", formattedAmt],
    ["Due Date", p.dueDate],
    ["Invoice Number", p.invoiceNo],
    ["Regarding", p.reminderType],
  ]);
  const instructions = renderNoticeBox({
    variant: "info",
    text: "Please settle this at the hospital counter. If you have already made this payment, please disregard this reminder.",
  });

  const bodyHtml = `${intro}${highlight}${details}${instructions}`;
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();

  return {
    subject,
    queryType,
    templateId,
    html: renderEmailLayout({
      title,
      badge,
      preheader: `Payment reminder: ${formattedAmt} due on ${p.dueDate}`,
      bodyHtml,
    }),
    templateParams: {
      // Matching 5_payment_reminder.html
      clinic_name: CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic",
      clinic_tagline: CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care",
      clinic_address: address,
      clinic_phone: CLINIC_CONFIG.phone || "",
      owner_name: p.ownerName,
      to_name: p.ownerName,
      pet_name: p.petName,
      amount_due: formattedAmt,
      due_date: p.dueDate,
      invoice_no: p.invoiceNo || "N/A",
      reminder_type: p.reminderType,
      // Master template fallbacks
      subject,
      title,
      header_badge: badge,
      greeting_and_intro: `Dear ${p.ownerName}, reminder for payment regarding ${p.petName}.`,
      highlight_box: highlight,
      details_table: details,
      items_table: "",
      warning_notice: instructions,
      footer_note: "Please contact our billing desk for any clarifications.",
    },
  };
}

// ─── 6. Clinical Visit Summary & Bill / Prescription ───────────────────────

export interface VisitEmailLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  dosageInstructions?: string | undefined;
}

export interface VisitSummaryProps {
  ownerName: string;
  petName: string;
  date: string;
  doctor?: string;
  invoiceNo: string;
  prescriptionNo: string;
  diagnosis?: string;
  notes?: string;
  nextVisitDate?: string;
  lines: VisitEmailLine[];
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
}

export function visitSummaryEmail(p: VisitSummaryProps): EmailTemplateResult {
  const queryType: EmailQueryType = "visitSummary";
  const templateId = resolveTemplateId(queryType);
  const subject = `Treatment Summary & Invoice ${p.invoiceNo} for ${p.petName}`;
  const badge = "CLINICAL & BILL";
  const title = `Treatment Summary & Medical Invoice`;
  const intro = `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${STYLES.slate700};">Dear <b>${esc(p.ownerName)}</b>, thank you for trusting us with <b>${esc(p.petName)}</b>'s health today. Below is the clinical summary and itemized billing statement:</p>`;

  const details = renderDetailsTable([
    ["Visit Date", p.date],
    ["Attending Doctor", p.doctor || CLINIC_CONFIG.doctorName],
    ["Invoice No.", p.invoiceNo],
    ["Prescription No.", p.prescriptionNo],
    ["Clinical Diagnosis", p.diagnosis],
    ["Doctor's Advice", p.notes],
    ["Next Review Visit", p.nextVisitDate],
  ]);

  // Itemized table for prescription & billing
  const thStyle = `style="text-align: left; padding: 10px 12px; background-color: ${STYLES.slate100}; font-size: 12px; font-weight: 700; color: ${STYLES.slate600}; border-bottom: 2px solid ${STYLES.border};"`;
  const tdStyle = `style="padding: 10px 12px; border-bottom: 1px solid ${STYLES.border}; font-size: 13px; color: ${STYLES.slate900}; vertical-align: top;"`;

  const rowsHtml = (p.lines || [])
    .map(
      (l) => `
      <tr>
        <td ${tdStyle}>
          <b>${esc(l.name)}</b>
          ${l.dosageInstructions ? `<div style="color: ${STYLES.slate500}; font-size: 12px; margin-top: 3px;">Dosage: ${esc(l.dosageInstructions)}</div>` : ""}
        </td>
        <td ${tdStyle} align="center">${esc(l.quantity)}</td>
        <td ${tdStyle} align="right">${inr(l.lineTotal)}</td>
      </tr>`
    )
    .join("");

  const itemsTable = `
    <div style="margin: 20px 0;">
      <div style="font-size: 14px; font-weight: 700; color: ${STYLES.slate900}; margin-bottom: 8px;">
        Prescription &amp; Billing Statement
      </div>
      <table role="presentation" width="100%" style="border-collapse: collapse; border: 1px solid ${STYLES.border}; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr>
            <th ${thStyle}>Item / Medication</th>
            <th ${thStyle} align="center" style="width: 15%;">Qty</th>
            <th ${thStyle} align="right" style="width: 25%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="3" ${tdStyle} align="center" style="color: ${STYLES.slate500};">Consultation &amp; General Examination</td></tr>`}
          <tr>
            <td ${tdStyle} colspan="2" align="right"><b>Total Amount:</b></td>
            <td ${tdStyle} align="right"><b>${inr(p.totalAmount)}</b></td>
          </tr>
          <tr>
            <td ${tdStyle} colspan="2" align="right">Amount Paid:</td>
            <td ${tdStyle} align="right" style="color: ${STYLES.success}; font-weight: 600;">${inr(p.amountPaid)}</td>
          </tr>
          <tr>
            <td ${tdStyle} colspan="2" align="right"><b>Balance Due:</b></td>
            <td ${tdStyle} align="right"><b style="color: ${p.balanceDue > 0 ? STYLES.danger : STYLES.success};">${inr(p.balanceDue)}</b></td>
          </tr>
        </tbody>
      </table>
    </div>`;

  const bodyHtml = `${intro}${details}${itemsTable}`;
  const address = `${CLINIC_CONFIG.addressLine1 || ""}, ${CLINIC_CONFIG.addressLine2 || ""}`.trim();

  return {
    subject,
    queryType,
    templateId,
    html: renderEmailLayout({
      title,
      badge,
      preheader: `Visit summary and invoice ${p.invoiceNo} for ${p.petName}`,
      bodyHtml,
    }),
    templateParams: {
      // Matching 6_visit_summary_bill.html
      clinic_name: CLINIC_CONFIG.fullName || "Real Care Small Animal Clinic",
      clinic_tagline: CLINIC_CONFIG.tagline || "Comprehensive Veterinary & Surgical Care",
      clinic_address: address,
      clinic_phone: CLINIC_CONFIG.phone || "",
      owner_name: p.ownerName,
      to_name: p.ownerName,
      pet_name: p.petName,
      visit_date: p.date,
      doctor_name: p.doctor || CLINIC_CONFIG.doctorName,
      invoice_no: p.invoiceNo,
      prescription_no: p.prescriptionNo,
      diagnosis: p.diagnosis || "General Health Examination",
      doctor_advice: p.notes || "Follow prescribed instructions.",
      next_visit_date: p.nextVisitDate || "As needed",
      itemized_table_rows: rowsHtml,
      total_amount: inr(p.totalAmount),
      amount_paid: inr(p.amountPaid),
      balance_due: inr(p.balanceDue),
      balance_due_color: p.balanceDue > 0 ? "#dc2626" : "#16a34a",
      // Master template fallbacks
      subject,
      title,
      header_badge: badge,
      greeting_and_intro: `Dear ${p.ownerName}, here is the treatment summary for ${p.petName}.`,
      highlight_box: "",
      details_table: details,
      items_table: itemsTable,
      warning_notice: "",
      footer_note: "Wishing your pet a swift and healthy recovery!",
    },
  };
}
