/**
 * EmailJS sender (server-side, via the REST API). Never throws — email must not break a clinical flow.
 * Supports query-specific template routing and per-environment overrides.
 * Setup + dashboard templates: docs/email/EMAILJS_SETUP.md and email-templates/
 */
const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export type EmailQueryType =
  | "loginAlert"
  | "registrationOTP"
  | "passwordReset"
  | "appointment"
  | "paymentDue"
  | "visitSummary";

export const QUERY_TEMPLATE_ENV_MAP: Record<EmailQueryType, string> = {
  loginAlert: "EMAILJS_TEMPLATE_LOGIN_ALERT",
  registrationOTP: "EMAILJS_TEMPLATE_REGISTRATION_OTP",
  passwordReset: "EMAILJS_TEMPLATE_PASSWORD_RESET",
  appointment: "EMAILJS_TEMPLATE_APPOINTMENT",
  paymentDue: "EMAILJS_TEMPLATE_PAYMENT_REMINDER",
  visitSummary: "EMAILJS_TEMPLATE_VISIT_SUMMARY",
};

export const DEFAULT_QUERY_TEMPLATE_IDS: Record<EmailQueryType, string> = {
  loginAlert: "template_login_alert",
  registrationOTP: "template_registration_otp",
  passwordReset: "template_password_reset",
  appointment: "template_appointment",
  paymentDue: "template_payment_reminder",
  visitSummary: "template_visit_summary",
};

export function resolveTemplateId(queryType?: EmailQueryType, explicitTemplateId?: string): string {
  if (explicitTemplateId) return explicitTemplateId;
  if (queryType) {
    const envVar = QUERY_TEMPLATE_ENV_MAP[queryType];
    if (process.env[envVar]) return process.env[envVar]!;
    
    // If single template mode is explicitly requested, fall back to global template
    if (process.env["EMAILJS_USE_SINGLE_TEMPLATE"] === "true") {
      return process.env["EMAILJS_TEMPLATE_ID"] || "template_zo51h1i";
    }

    return DEFAULT_QUERY_TEMPLATE_IDS[queryType] || process.env["EMAILJS_TEMPLATE_ID"] || "template_zo51h1i";
  }
  return process.env["EMAILJS_TEMPLATE_ID"] || "template_zo51h1i";
}

const cfg = () => ({
  serviceId: process.env["EMAILJS_SERVICE_ID"] || "service_1tmhrq1",
  templateId: process.env["EMAILJS_TEMPLATE_ID"] || "template_zo51h1i",
  publicKey: process.env["EMAILJS_PUBLIC_KEY"] || "LyZojrjx5u929g6eU",
  privateKey: process.env["EMAILJS_PRIVATE_KEY"] || "",
});

export interface SendEmailInput {
  to: string;
  toName?: string;
  subject: string;
  /** Query / event type: automatically routes to the appropriate EmailJS template ID */
  queryType?: EmailQueryType;
  /** Explicit template ID override if needed */
  templateId?: string;
  /** Full HTML body. Rendered into {{{html_body}}} of the EmailJS template. */
  html?: string;
  /** Optional structured parameters passed directly to the EmailJS dashboard template */
  templateParams?: Record<string, unknown>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const to = (input.to || "").trim();
  if (!EMAIL_RE.test(to)) return false; // no / invalid address on file — silently skip
  const c = cfg();
  const activeTemplateId = resolveTemplateId(input.queryType, input.templateId);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: c.serviceId,
        template_id: activeTemplateId,
        user_id: c.publicKey,
        ...(c.privateKey ? { accessToken: c.privateKey } : {}),
        template_params: {
          to_email: to,
          to_name: input.toName || to,
          subject: input.subject,
          html_body: input.html || "",
          ...(input.templateParams || {}),
        },
      }),
    });
    if (!res.ok) {
      console.warn(`[email] EmailJS rejected "${input.subject}" [Template: ${activeTemplateId}] → ${to}: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[email] send failed [Template: ${activeTemplateId}]:`, e);
    return false;
  }
}
