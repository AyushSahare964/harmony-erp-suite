/**
 * EmailJS sender (server-side, via the REST API). Never throws — email must not break a clinical flow.
 * Two email types are sent: staff-registration verification codes and password-reset links.
 * Setup + dashboard templates: docs/email/EMAILJS_SETUP.md and email-templates/
 */
const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export type EmailQueryType = "registrationOTP" | "passwordReset";

const TEMPLATE_ENV: Record<EmailQueryType, string> = {
  registrationOTP: "EMAILJS_TEMPLATE_REGISTRATION_OTP",
  passwordReset: "EMAILJS_TEMPLATE_PASSWORD_RESET",
};

// Template IDs are not secrets. They match the two templates in the clinic's EmailJS account
// (email-templates/2_registration_otp.html and 3_password_reset.html); env vars override them.
const DEFAULT_TEMPLATE_ID: Record<EmailQueryType, string> = {
  registrationOTP: "template_zo51h1i",
  passwordReset: "template_rep7mlc",
};

/** .env is only read at server start (and by the DB client); re-read it so EmailJS keys added later are picked up. */
function ensureEnv() {
  if (process.env["EMAILJS_PRIVATE_KEY"]) return;
  try {
    (process as unknown as { loadEnvFile?: () => void }).loadEnvFile?.();
  } catch {
    /* no .env (e.g. deployed host) — real env vars are used */
  }
}

/** Public base URL of the app, used in email links. From env/config only — never from request headers (host-header poisoning). */
export function appUrl(): string {
  ensureEnv();
  const url = process.env["APP_URL"] || (process.env["NODE_ENV"] === "production" ? "https://harmony-erp-suite-g28j.vercel.app" : "http://localhost:8080");
  return url.replace(/\/$/, "");
}

/** Absolute URL of the clinic logo for emails (must be publicly reachable; override with EMAIL_LOGO_URL). */
export function logoUrl(path: string): string {
  ensureEnv();
  return process.env["EMAIL_LOGO_URL"] || `${appUrl()}${path}`;
}

export const resolveTemplateId = (type: EmailQueryType): string => (ensureEnv(), process.env[TEMPLATE_ENV[type]] || DEFAULT_TEMPLATE_ID[type]);

const cfg = () => (ensureEnv(), {
  serviceId: process.env["EMAILJS_SERVICE_ID"] || "service_1tmhrq1",
  publicKey: process.env["EMAILJS_PUBLIC_KEY"] || "LyZojrjx5u929g6eU",
  privateKey: process.env["EMAILJS_PRIVATE_KEY"] || "",
});

export interface SendEmailInput {
  to: string;
  toName?: string;
  subject: string;
  /** Email type: routes to the matching EmailJS template ID */
  queryType: EmailQueryType;
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
  const activeTemplateId = input.templateId || resolveTemplateId(input.queryType);

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
