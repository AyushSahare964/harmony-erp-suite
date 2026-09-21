import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Download } from "lucide-react";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";

interface Props {
  quotation: any;
  open: boolean;
  onClose: () => void;
}

/**
 * Formatted print/PDF view for a quotation, mirroring InvoicePrintView's structure and the
 * shared printOrSaveDocumentAsPdf mechanism — QuotationModal previously called raw window.print()
 * on its own live data-entry form instead of a document like this.
 */
export function QuotationPrintView({ quotation, open, onClose }: Props) {
  const isGst = quotation?.quotationType === "GST" || quotation?.quotationType === undefined;

  const handlePrint = () => {
    printOrSaveDocumentAsPdf("quotation-printable-area", `Quotation_${quotation?.quotationNo || "Draft"}`);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span className="text-sm font-bold text-navy">Quotation — {quotation?.quotationNo}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1">
              <Download className="size-3.5" /> Download PDF
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs">
              <Printer className="mr-1.5 size-3.5" /> Print Quotation
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        <div id="quotation-printable-area" className="flex-1 overflow-y-auto p-8 bg-white text-black space-y-6 print:p-0">
          <div className="border-b-2 border-blue-900 pb-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <img
                src={CLINIC_CONFIG.logoPath}
                alt={CLINIC_CONFIG.fullName}
                className="h-16 w-auto object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div>
                <h1 className="text-xl font-black tracking-tight text-blue-900">{CLINIC_CONFIG.fullName}</h1>
                <p className="text-[11px] font-semibold text-blue-800">{CLINIC_CONFIG.subName}</p>
                <p className="text-xs text-gray-700 font-semibold mt-0.5">{CLINIC_CONFIG.doctorName}</p>
                <p className="text-xs text-gray-600">Phone: {CLINIC_CONFIG.phone} · {CLINIC_CONFIG.website}</p>
                {isGst && CLINIC_CONFIG.gstin && <p className="text-xs font-mono font-bold text-gray-800">GSTIN: {CLINIC_CONFIG.gstin}</p>}
                <p className="text-xs text-gray-600">{CLINIC_CONFIG.addressLine2}</p>
              </div>
            </div>
            <div className="text-right text-xs space-y-1">
              <span className="inline-block bg-blue-900 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                Quotation
              </span>
              <p className="font-mono font-bold text-sm text-gray-900">{quotation?.quotationNo}</p>
              <p className="text-gray-600">Date: {quotation?.date}</p>
              {quotation?.validUntil && <p className="text-gray-600">Valid Until: {quotation.validUntil}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-300 p-3.5 text-xs bg-gray-50">
            <div>
              <p className="text-gray-500 font-bold uppercase text-[10px]">Quoted To (Client)</p>
              <p className="font-bold text-sm text-gray-900">{quotation?.ownerName}</p>
              <p className="text-gray-600">Phone: {quotation?.ownerPhone || "—"}</p>
              {quotation?.address && <p className="text-gray-600">{quotation.address}</p>}
            </div>
            <div>
              <p className="text-gray-500 font-bold uppercase text-[10px]">Patient / Reference</p>
              <p className="font-bold text-sm text-gray-900">{quotation?.petName || "—"}</p>
              <p className="text-gray-600">{quotation?.species || ""}</p>
              {quotation?.quotationReference && (
                <p className="text-gray-600">Ref: <span className="font-mono">{quotation.quotationReference}</span></p>
              )}
            </div>
          </div>

          <table className="w-full text-xs border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 text-left font-bold text-gray-700">
                <th className="p-2 w-8">#</th>
                <th className="p-2">Description / Category</th>
                <th className="p-2 text-center">Qty</th>
                <th className="p-2 text-right">Rate (₹)</th>
                <th className="p-2 text-center">Disc (%)</th>
                {isGst && <th className="p-2 text-center">GST</th>}
                <th className="p-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(quotation?.items || []).map((item: any, idx: number) => (
                <tr key={item.id || idx}>
                  <td className="p-2 text-gray-500">{idx + 1}</td>
                  <td className="p-2">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <span className="text-[10px] text-gray-500">{item.category}</span>
                  </td>
                  <td className="p-2 text-center font-medium">{item.quantity}</td>
                  <td className="p-2 text-right">{Number(item.rate || 0).toFixed(2)}</td>
                  <td className="p-2 text-center">{item.discountPercent || 0}%</td>
                  {isGst && <td className="p-2 text-center">{item.gstRate || 0}%</td>}
                  <td className="p-2 text-right font-bold">{Number(item.lineTotal || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 space-y-1.5 text-xs text-right border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>₹{Number(quotation?.subtotal || 0).toFixed(2)}</span>
              </div>
              {isGst && (
                <div className="flex justify-between text-gray-600">
                  <span>GST Amount:</span>
                  <span>+₹{Number(quotation?.totalGst || 0).toFixed(2)}</span>
                </div>
              )}
              {Number(quotation?.shippingCosts || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Shipping:</span>
                  <span>+₹{Number(quotation.shippingCosts).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-base pt-2 border-t-2 border-black text-gray-900">
                <span>Grand Total:</span>
                <span>₹{Number(quotation?.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {(quotation?.deliveryTerms || quotation?.remarks) && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 space-y-1">
              {quotation?.deliveryTerms && <p><strong>Delivery Terms:</strong> {quotation.deliveryTerms}</p>}
              {quotation?.remarks && <p><strong>Remarks:</strong> {quotation.remarks}</p>}
            </div>
          )}

          <div className="pt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
            <div>
              <p>• This quotation is an estimate and not a tax invoice.</p>
              <p>• Prices are subject to change after the validity period.</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-700">For Real Care Small Animal Clinic</p>
              <p className="pt-6 text-gray-400">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
