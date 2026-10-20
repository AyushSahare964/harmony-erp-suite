/**
 * Emails a finished visit's bill and prescription PDFs through EmailJS (browser-side, public key only).
 * Template variable attachments: `bill_pdf` and `prescription_pdf`. Nothing is stored or made public.
 */
import { elementToPdfBase64 } from "@/lib/utils/pdfExport";
import { getVisitEmailTargetFn, markVisitEmailedFn } from "@/lib/mongodb/serverFns/visitEmail";

// Service/template IDs and the public key are not secrets (EmailJS designs the public key for browsers).
const env = import.meta.env as Record<string, string | undefined>;
const SERVICE_ID = env["VITE_EMAILJS_DOCS_SERVICE_ID"] || "service_bxqqzum";
const TEMPLATE_ID = env["VITE_EMAILJS_DOCS_TEMPLATE_ID"] || "template_yikjq7b";
const PUBLIC_KEY = env["VITE_EMAILJS_DOCS_PUBLIC_KEY"] || "WeGjDfivGGj9_LXGK";
const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

// While set (e.g. in .env.local during development), every send goes here instead of to the client.
const TEST_RECIPIENT = env["VITE_EMAILJS_DOCS_TEST_RECIPIENT"] || "";

const BILL_EL = "invoice-preview-card";
const RX_EL = "prescription-preview-card";

/**
 * @returns the address it was sent to. Throws (with a user-safe message) on any failure.
 */
export async function sendVisitDocsEmail(visitId: string): Promise<string> {
  const testRecipient = TEST_RECIPIENT;
  const t = await getVisitEmailTargetFn({ data: { visitId } });
  const to = (testRecipient || t.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("No valid email address on file for this client.");

  const [bill, rx] = await Promise.all([elementToPdfBase64(BILL_EL), elementToPdfBase64(RX_EL)]);
  if (!bill || !rx) throw new Error("Bill or prescription is not ready yet; open the completed visit and try again.");

  // Both pages must show this visit's own numbers, or we'd be mailing someone else's document.
  const text = (id: string) => document.getElementById(id)?.textContent ?? "";
  if (!text(BILL_EL).includes(t.invoiceNo) || !text(RX_EL).includes(t.visitId)) {
    throw new Error("The bill and prescription on screen do not match this visit; not sending.");
  }

  // The template names the files Bill_{{client_name}}.pdf / Prescription_{{client_name}}.pdf, so keep the
  // real name but drop characters that are illegal in filenames.
  const clientName = t.ownerName.replace(/[\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim() || "Client";
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: {
        to_email: to,
        to_name: t.ownerName,
        client_name: clientName,
        pet_name: t.petName,
        visit_id: t.visitId,
        invoice_no: t.invoiceNo,
        prescription_no: t.prescriptionNo,
        bill_pdf: bill,
        prescription_pdf: rx,
      },
    }),
  });
  if (!res.ok) {
    // EmailJS answers with a short reason (e.g. size limit); the PDFs are never logged.
    throw new Error(`EmailJS did not send it (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  if (!testRecipient) await markVisitEmailedFn({ data: { visitId } });
  return to;
}
