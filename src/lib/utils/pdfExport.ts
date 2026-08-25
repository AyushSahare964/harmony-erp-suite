import { toast } from "sonner";

/**
 * Opens an isolated print/Save-as-PDF window for an individual document.
 * This utilizes the browser's native PDF engine to generate a crystal-clear,
 * vector-sharp A4 PDF with exact hospital styling.
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

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${docTitle}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            padding: 20px;
            font-size: 12px;
            line-height: 1.4;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 11px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            font-weight: 700;
            color: #334155;
          }
          .border-b-2 { border-bottom: 2px solid #0f172a; }
          .border-t-2 { border-top: 2px solid #0f172a; }
          .border { border: 1px solid #cbd5e1; }
          .rounded-xl, .rounded-2xl, .rounded-lg { border-radius: 8px; }
          .bg-slate-50, .bg-gray-50 { background-color: #f8fafc; }
          .bg-blue-50 { background-color: #eff6ff; }
          .text-blue-900 { color: #1e3a8a; }
          .text-slate-900 { color: #0f172a; }
          .text-slate-700 { color: #334155; }
          .text-slate-600 { color: #475569; }
          .text-slate-500 { color: #64748b; }
          .text-slate-400 { color: #94a3b8; }
          .text-emerald-700 { color: #047857; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .font-black { font-weight: 900; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .p-3 { padding: 12px; }
          .p-6 { padding: 24px; }
          .pt-3 { padding-top: 12px; }
          .pt-4 { padding-top: 16px; }
          .pb-3 { padding-bottom: 12px; }
          .space-y-5 > * + * { margin-top: 18px; }
          .space-y-1 > * + * { margin-top: 4px; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .gap-2 { gap: 8px; }
          .gap-3 { gap: 12px; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .items-end { align-items: flex-end; }
          .items-start { align-items: flex-start; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .uppercase { text-transform: uppercase; }
          .italic { font-style: italic; }

          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${sourceEl.innerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
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
