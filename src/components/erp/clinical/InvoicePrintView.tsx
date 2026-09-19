import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Receipt, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";

import { cn } from "@/lib/utils";

interface Props {
  visit: any;
  open: boolean;
  onClose: () => void;
}

export function InvoicePrintView({ visit, open, onClose }: Props) {
  const handlePrint = () => {
    const cleanInvoiceNo = visit?.invoiceNo?.replace(/[\/\\]/g, "_") || "TaxInvoice";
    printOrSaveDocumentAsPdf("invoice-printable-area", `Invoice_${cleanInvoiceNo}`);
  };

  const handleDownload = () => {
    const cleanInvoiceNo = visit?.invoiceNo?.replace(/[\/\\]/g, "_") || "TaxInvoice";
    printOrSaveDocumentAsPdf("invoice-printable-area", `Invoice_${cleanInvoiceNo}`);
  };

  const isGst = visit?.billType === "GST";

  const payments: any[] =
    visit?.payments && visit.payments.length > 0
      ? visit.payments
      : visit?.amountPaid > 0
      ? [
          {
            mode: visit?.paymentMode || "UPI",
            amount: visit?.amountPaid,
            timestamp: visit?.date,
            recordedBy: visit?.doctorName || "Cashier",
            trxRef: visit?.trxRef,
          },
        ]
      : [];

  const totalPaid =
    visit?.amountPaid !== undefined
      ? visit.amountPaid
      : payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const balanceDue =
    visit?.balanceDue !== undefined
      ? visit.balanceDue
      : Math.max(0, (visit?.totalAmount || 0) - totalPaid);

  const isMultiPayment = payments.length > 1 || (balanceDue > 0 && payments.length > 0);
  const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;
  const currentPaymentAmount = latestPayment ? latestPayment.amount : totalPaid;
  const previousPaidAmount = isMultiPayment ? Math.max(0, totalPaid - currentPaymentAmount) : 0;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Top Controls */}
        <div className="border-b border-border bg-muted/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            <span className="text-sm font-bold text-navy">
              {isGst ? "Tax Invoice (GST)" : "Commercial Receipt"} — {visit?.invoiceNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs gap-1">
              <Download className="size-3.5" /> Download PDF
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs">
              <Printer className="mr-1.5 size-3.5" /> Print Invoice
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Invoice Page */}
        <div id="invoice-printable-area" className="flex-1 overflow-y-auto p-8 bg-white text-black space-y-6 print:p-0">
          {/* Header */}
          <div className="border-b-2 border-black pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">Real Care Small Animal Clinic</h1>
              <p className="text-xs text-gray-600">Plot 42, Central Avenue, Near Medical Square, Nagpur - 440009</p>
              <p className="text-xs text-gray-600">Phone: +91 712 2548899 · Reg: MH/VET/2019/8821</p>
              {isGst && <p className="text-xs font-mono font-bold text-gray-800">GSTIN: 27AABCV1234F1Z5</p>}
              <p className="text-xs text-gray-600">Branch: {visit?.branch || "Central Avenue, Nagpur"}</p>
            </div>
            <div className="text-right text-xs space-y-1">
              <span className="inline-block bg-black text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                {isGst ? "TAX INVOICE" : "BILL OF SUPPLY"}
              </span>
              <p className="font-mono font-bold text-sm text-gray-900">{visit?.invoiceNo}</p>
              <p className="text-gray-600">Date: {visit?.date}</p>
            </div>
          </div>

          {/* Billed To / Patient Info */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-300 p-3.5 text-xs bg-gray-50">
            <div>
              <p className="text-gray-500 font-bold uppercase text-[10px]">Billed To (Client)</p>
              <p className="font-bold text-sm text-gray-900">{visit?.ownerName}</p>
              <p className="text-gray-600">Phone: {visit?.ownerPhone}</p>
              <p className="text-gray-600">Owner ID: <span className="font-mono">{visit?.ownerId}</span></p>
            </div>
            <div>
              <p className="text-gray-500 font-bold uppercase text-[10px]">Patient Details</p>
              <p className="font-bold text-sm text-gray-900">{visit?.petName}</p>
              <p className="text-gray-600">{visit?.species} · {visit?.breed}</p>
              <p className="text-gray-600">Patient UID: <span className="font-mono">{visit?.petId}</span></p>
            </div>
          </div>

          {/* Itemized Table */}
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
              {(visit?.items || []).map((item: any, idx: number) => {
                const gross = item.quantity * item.unitPrice;
                const disc = (gross * (item.discountPercent || 0)) / 100;
                const lineNet = gross - disc;
                return (
                  <tr key={idx}>
                    <td className="p-2 text-gray-500">{idx + 1}</td>
                    <td className="p-2">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <span className="text-[10px] text-gray-500">{item.lineType}</span>
                    </td>
                    <td className="p-2 text-center font-medium">{item.quantity}</td>
                    <td className="p-2 text-right">{item.unitPrice.toFixed(2)}</td>
                    <td className="p-2 text-center">{item.discountPercent || 0}%</td>
                    {isGst && <td className="p-2 text-center">{item.gstRate || 0}%</td>}
                    <td className="p-2 text-right font-bold">{lineNet.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Financial Summary & Split Settlement (§4.4) */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-2">
            {/* Left: Payment History Sub-Table (§4.4) */}
            <div className="flex-1 w-full space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-700 uppercase text-[10px]">Payment History / Installments</p>
                {/* Status Watermark / Badge (§4.4) */}
                <span
                  className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded border",
                    balanceDue === 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  )}
                >
                  {balanceDue === 0 ? "PAID IN FULL ✓" : `PARTIAL PAYMENT — BALANCE DUE: ₹${balanceDue.toFixed(2)}`}
                </span>
              </div>

              {payments.length > 0 ? (
                <table className="w-full text-[11px] border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 border-b border-gray-200 text-left font-semibold">
                      <th className="p-1.5">Date</th>
                      <th className="p-1.5">Mode</th>
                      <th className="p-1.5">Ref / Notes</th>
                      <th className="p-1.5">Recorded By</th>
                      <th className="p-1.5 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((p: any, idx: number) => {
                      const dateStr = p.timestamp ? new Date(p.timestamp).toLocaleDateString("en-GB") : visit?.date || "-";
                      return (
                        <tr key={idx}>
                          <td className="p-1.5 text-gray-700">{dateStr}</td>
                          <td className="p-1.5 font-bold uppercase text-[10px] text-gray-800">{p.mode || "UPI"}</td>
                          <td className="p-1.5 text-gray-600">{p.trxRef || p.notes || "—"}</td>
                          <td className="p-1.5 text-gray-600">{p.recordedBy || "Cashier"}</td>
                          <td className="p-1.5 text-right font-mono font-bold text-gray-900">₹{Number(p.amount).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-gray-400 italic">No payments recorded.</p>
              )}
            </div>

            {/* Right: Detailed Summary (§4.4) */}
            <div className="w-72 space-y-1.5 text-xs text-right border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>₹{(visit?.subtotal || 0).toFixed(2)}</span>
              </div>
              {isGst && (
                <div className="flex justify-between text-gray-600">
                  <span>GST Amount:</span>
                  <span>+₹{(visit?.gstAmount || 0).toFixed(2)}</span>
                </div>
              )}
              {visit?.roundOff !== 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Round-off:</span>
                  <span>{visit?.roundOff >= 0 ? `+₹${visit.roundOff.toFixed(2)}` : `-₹${Math.abs(visit.roundOff).toFixed(2)}`}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-base pt-2 border-t-2 border-black text-gray-900">
                <span>Total Bill:</span>
                <span>₹{(visit?.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>

              {isMultiPayment && (
                <>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Previous Paid:</span>
                    <span>₹{previousPaidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-gray-800">
                    <span>Current Payment:</span>
                    <span>₹{Number(currentPaymentAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-xs font-semibold text-gray-800 border-t border-gray-200 pt-1">
                <span>Total Paid:</span>
                <span>₹{Number(totalPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>

              <div
                className={cn(
                  "flex justify-between text-xs font-bold pt-1 border-t border-gray-200",
                  balanceDue > 0 ? "text-red-600" : "text-emerald-700"
                )}
              >
                <span>Balance Due:</span>
                <span>₹{Number(balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Follow-up Reminder Note */}
          {(visit?.nextVaccineDate || visit?.nextDewormingDate || visit?.nextVisitDate) && (
            <div className="rounded-lg bg-yellow-50/80 border border-yellow-200 p-2.5 text-xs text-yellow-900 flex items-center justify-between">
              <span><strong>Next Clinical Reminders:</strong></span>
              <span>{visit.nextVaccineDate && `Vaccine: ${visit.nextVaccineDate} · `}{visit.nextDewormingDate && `Deworming: ${visit.nextDewormingDate} · `}{visit.nextVisitDate && `Follow-up: ${visit.nextVisitDate}`}</span>
            </div>
          )}

          {/* Footer Terms */}
          <div className="pt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
            <div>
              <p>• Goods once sold are not returnable after cold chain break.</p>
              <p>• This is a computer-generated tax invoice.</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-700">For Vetcare Specialty Pet Hospital</p>
              <p className="pt-6 text-gray-400">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
