import { toast } from "sonner";

/**
 * Opens an isolated print/Save-as-PDF window for an individual document.
 * This utilizes the browser's native PDF engine to generate a crystal-clear,
 * vector-sharp A4 PDF with exact hospital styling and high-fidelity rendering.
 */
export function printOrSaveDocumentAsPdf(elementId: string, docTitle: string) {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    toast.error("Document element could not be found.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (!printWindow) {
    toast.error("Please allow popups to download/print PDF.");
    return;
  }

  // Extract all stylesheets and custom CSS injected by Tailwind / Vite into parent head
  const parentStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
    .map((el) => el.outerHTML)
    .join("\n");

  // Format real-time dynamic Indian Standard Time (IST) timestamp
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const timestampIST = `${dateStr}, ${timeStr}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${docTitle}</title>
        ${parentStyles}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
          }
          body {
            padding: 12px;
          }
          .print-paper-card {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            background: #ffffff !important;
          }
          
          /* Display & Layout */
          .block { display: block !important; }
          .inline-block { display: inline-block !important; }
          .inline-flex { display: inline-flex !important; }
          .flex { display: flex !important; }
          .flex-col { flex-direction: column !important; }
          .flex-1 { flex: 1 1 0% !important; }
          .shrink-0 { flex-shrink: 0 !important; }
          .items-center { align-items: center !important; }
          .items-start { align-items: flex-start !important; }
          .items-end { align-items: flex-end !important; }
          .justify-between { justify-content: space-between !important; }
          .justify-center { justify-content: center !important; }
          
          /* Grid */
          .grid { display: grid !important; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .col-span-2 { grid-column: span 2 / span 2 !important; }
          .col-span-3 { grid-column: span 3 / span 3 !important; }
          
          /* Gaps */
          .gap-1 { gap: 4px !important; }
          .gap-1\.5 { gap: 6px !important; }
          .gap-2 { gap: 8px !important; }
          .gap-2\.5 { gap: 10px !important; }
          .gap-3 { gap: 12px !important; }
          .gap-4 { gap: 16px !important; }
          .gap-6 { gap: 24px !important; }
          
          /* Typography */
          .text-\[9px\] { font-size: 9px !important; line-height: 12px !important; }
          .text-\[10px\] { font-size: 10px !important; line-height: 14px !important; }
          .text-\[11px\] { font-size: 11px !important; line-height: 15px !important; }
          .text-xs { font-size: 12px !important; line-height: 16px !important; }
          .text-sm { font-size: 14px !important; line-height: 20px !important; }
          .text-base { font-size: 16px !important; line-height: 22px !important; }
          .text-lg { font-size: 18px !important; line-height: 26px !important; }
          .font-black { font-weight: 900 !important; }
          .font-extrabold { font-weight: 800 !important; }
          .font-bold { font-weight: 700 !important; }
          .font-semibold { font-weight: 600 !important; }
          .font-medium { font-weight: 500 !important; }
          .font-normal { font-weight: 400 !important; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
          .font-serif { font-family: Georgia, Cambria, "Times New Roman", Times, serif !important; }
          .uppercase { text-transform: uppercase !important; }
          .italic { font-style: italic !important; }
          .tracking-tight { letter-spacing: -0.025em !important; }
          .tracking-wide { letter-spacing: 0.025em !important; }
          .tracking-wider { letter-spacing: 0.05em !important; }
          .text-left { text-align: left !important; }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .leading-none { line-height: 1 !important; }
          .leading-tight { line-height: 1.25 !important; }
          
          /* Colors */
          .text-blue-900 { color: #1e3a8a !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
          .text-blue-600 { color: #2563eb !important; }
          .text-slate-900 { color: #0f172a !important; }
          .text-slate-800 { color: #1e293b !important; }
          .text-slate-700 { color: #334155 !important; }
          .text-slate-600 { color: #475569 !important; }
          .text-slate-500 { color: #64748b !important; }
          .text-slate-400 { color: #94a3b8 !important; }
          .text-emerald-700 { color: #047857 !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-amber-900 { color: #78350f !important; }
          .text-amber-700 { color: #b45309 !important; }
          .text-purple-900 { color: #581c87 !important; }
          .text-rose-900 { color: #881337 !important; }
          
          /* Backgrounds */
          .bg-white { background-color: #ffffff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
          .bg-slate-900 { background-color: #0f172a !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-blue-100 { background-color: #dbeafe !important; }
          .bg-blue-600 { background-color: #2563eb !important; }
          .bg-blue-700 { background-color: #1d4ed8 !important; }
          .bg-blue-900 { background-color: #1e3a8a !important; }
          .bg-amber-50 { background-color: #fffbeb !important; }
          .bg-purple-50 { background-color: #faf5ff !important; }
          .bg-rose-100 { background-color: #ffe4e6 !important; }
          
          /* Borders */
          .border { border: 1px solid #cbd5e1 !important; }
          .border-b { border-bottom: 1px solid #cbd5e1 !important; }
          .border-b-2 { border-bottom: 2px solid #0f172a !important; }
          .border-t { border-top: 1px solid #cbd5e1 !important; }
          .border-t-2 { border-top: 2px solid #0f172a !important; }
          .border-l-2 { border-left: 2px solid #2563eb !important; }
          .border-l-4 { border-left: 4px solid #2563eb !important; }
          .border-dashed { border-style: dashed !important; }
          .border-slate-100 { border-color: #f1f5f9 !important; }
          .border-slate-200 { border-color: #e2e8f0 !important; }
          .border-slate-300 { border-color: #cbd5e1 !important; }
          .border-slate-400 { border-color: #94a3b8 !important; }
          .border-blue-100 { border-color: #dbeafe !important; }
          .border-blue-200 { border-color: #bfdbfe !important; }
          .border-blue-600 { border-color: #2563eb !important; }
          .border-amber-200 { border-color: #fde68a !important; }
          .border-purple-200 { border-color: #e9d5ff !important; }
          
          /* Rounded Corners */
          .rounded { border-radius: 4px !important; }
          .rounded-md { border-radius: 6px !important; }
          .rounded-lg { border-radius: 8px !important; }
          .rounded-xl { border-radius: 12px !important; }
          .rounded-2xl { border-radius: 16px !important; }
          .rounded-full { border-radius: 9999px !important; }
          
          /* Spacing & Sizes */
          .p-1 { padding: 4px !important; }
          .p-1\.5 { padding: 6px !important; }
          .p-2 { padding: 8px !important; }
          .p-2\.5 { padding: 10px !important; }
          .p-3 { padding: 12px !important; }
          .p-3\.5 { padding: 14px !important; }
          .p-4 { padding: 16px !important; }
          .p-5 { padding: 20px !important; }
          .p-6 { padding: 24px !important; }
          .px-1\.5 { padding-left: 6px !important; padding-right: 6px !important; }
          .px-2 { padding-left: 8px !important; padding-right: 8px !important; }
          .px-2\.5 { padding-left: 10px !important; padding-right: 10px !important; }
          .py-0\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }
          .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .pt-1 { padding-top: 4px !important; }
          .pt-2 { padding-top: 8px !important; }
          .pt-3 { padding-top: 12px !important; }
          .pt-4 { padding-top: 16px !important; }
          .pt-6 { padding-top: 24px !important; }
          .pb-1 { padding-bottom: 4px !important; }
          .pb-2 { padding-bottom: 8px !important; }
          .pb-3 { padding-bottom: 12px !important; }
          .pb-3\.5 { padding-bottom: 14px !important; }
          .pb-4 { padding-bottom: 16px !important; }
          .pb-6 { padding-bottom: 24px !important; }
          .mt-0\.5 { margin-top: 2px !important; }
          .mt-1 { margin-top: 4px !important; }
          .mt-2 { margin-top: 8px !important; }
          .mt-3 { margin-top: 12px !important; }
          .mt-4 { margin-top: 16px !important; }
          .mt-5 { margin-top: 20px !important; }
          .space-y-0\.5 > * + * { margin-top: 2px !important; }
          .space-y-1 > * + * { margin-top: 4px !important; }
          .space-y-1\.5 > * + * { margin-top: 6px !important; }
          .space-y-2 > * + * { margin-top: 8px !important; }
          .space-y-3 > * + * { margin-top: 12px !important; }
          .space-y-4 > * + * { margin-top: 16px !important; }
          .space-y-5 > * + * { margin-top: 20px !important; }
          
          .w-6 { width: 24px !important; }
          .w-8 { width: 32px !important; }
          .w-10 { width: 40px !important; }
          .w-12 { width: 48px !important; }
          .w-14 { width: 56px !important; }
          .w-16 { width: 64px !important; }
          .w-44 { width: 176px !important; }
          .w-52 { width: 208px !important; }
          .w-full { width: 100% !important; }
          .w-auto { width: auto !important; }
          .h-auto { height: auto !important; }
          .h-12 { height: 48px !important; }
          .min-w-\[150px\] { min-width: 150px !important; }
          .min-w-\[180px\] { min-width: 180px !important; }
          .min-w-\[200px\] { min-width: 200px !important; }
          
          /* Tables */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid #e2e8f0;
            padding: 5px 8px;
          }
          /* Specific template classes */
          .bg-\[\#f8faff\] { background-color: #f8faff !important; }
          .border-blue-200 { border-color: #bfdbfe !important; }
          .border-blue-300 { border-color: #93c5fd !important; }
          .border-blue-600 { border-color: #2563eb !important; }
          .border-blue-900 { border-color: #1e3a8a !important; }
          .border-slate-900 { border-color: #0f172a !important; }
          .border-l-4 { border-left-width: 4px !important; border-left-style: solid !important; }
          
          @media screen {
            body {
              background-color: #f1f5f9 !important;
              padding: 24px 16px !important;
              display: flex !important;
              justify-content: center !important;
            }
            .print-paper-card {
              background-color: #ffffff !important;
              max-width: 820px !important;
              width: 100% !important;
              padding: 0 !important;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
              border-radius: 16px !important;
              overflow: hidden !important;
            }
          }

          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 12mm 10mm 12mm;
            }
            html, body {
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              width: 100% !important;
              height: 100% !important;
            }
            .no-print {
              display: none !important;
            }
            .print-paper-card,
            #prescription-preview-card,
            #invoice-preview-card,
            #prescription-printable-area,
            #invoice-printable-area,
            #quotation-printable-area {
              /* These are letterhead "cards" split into a .*-content-body
                 (grows) + .*-footer-pinned (sticks to the bottom) pair, so
                 stretching them to a full page with flex + space-between is
                 what pins the signature block to the bottom of the sheet. */
              min-height: 274mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              box-sizing: border-box !important;
              border: none !important;
              box-shadow: none !important;
              /* Breathing room from the @page margin so text doesn't sit
                 flush against the printable-area edge (box-sizing:border-box
                 keeps this inside the 186mm width clamp, no overflow risk). */
              padding: 8mm !important;
              margin: 0 !important;
              /* Explicit physical width (A4 = 210mm minus the @page's 12mm+12mm
                 side margins) instead of a percentage, so the card can never
                 render wider than the physically printable page area and get
                 cropped in the exported PDF. */
              width: 186mm !important;
              max-width: 186mm !important;
              border-radius: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
            }
            .print-paper-card * {
              max-width: 100% !important;
            }
            /* These are a flat top-to-bottom stack of sections (no pinned
               footer), so they get the same safe width/padding but WITHOUT
               flex + min-height:274mm — that combination stretches a flat
               stack across the full page and space-between then spreads the
               leftover height as huge gaps between every section. */
            #lab-report-printable-area,
            #report-printable-area {
              box-sizing: border-box !important;
              border: none !important;
              box-shadow: none !important;
              padding: 8mm !important;
              margin: 0 !important;
              width: 186mm !important;
              max-width: 186mm !important;
              border-radius: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
            }
            #lab-report-printable-area *,
            #report-printable-area * {
              max-width: 100% !important;
            }
            .prescription-content-body,
            .invoice-content-body {
              flex: 1 0 auto !important;
            }
            .prescription-footer-pinned,
            .invoice-footer-pinned {
              margin-top: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .page-break-inside-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-paper-card">
          ${sourceEl.outerHTML}
        </div>
        
        <script>
          window.onload = function() {
            // Ensure all images (e.g. clinic logo) finish loading before opening print dialog
            const images = Array.from(document.images);
            Promise.all(
              images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = img.onerror = resolve;
                });
              })
            ).then(() => {
              setTimeout(() => {
                window.print();
              }, 300);
            });
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  toast.success(`Prepared ${docTitle} — Choose "Save as PDF" in the print dialog.`);
}
