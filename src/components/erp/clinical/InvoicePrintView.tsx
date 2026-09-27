import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Receipt, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";

import { cn } from "@/lib/utils";
import { calcLineItem, roundMoney, addMoney } from "@/lib/utils/moneyUtils";

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
                <p className="text-[10px] text-gray-500">{CLINIC_CONFIG.doctorQualifications}</p>
                <p className="text-xs text-gray-600">Phone: {CLINIC_CONFIG.phone} · {CLINIC_CONFIG.website}</p>
                {isGst && CLINIC_CONFIG.gstin && <p className="text-xs font-mono font-bold text-gray-800">GSTIN: {CLINIC_CONFIG.gstin}</p>}
                <p className="text-xs text-gray-600">{CLINIC_CONFIG.addressLine2}</p>
              </div>
            </div>
            <div className="text-right text-xs space-y-1">
              <span className="inline-block bg-blue-900 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase">
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

          {/* Itemized Table with Professional Detailed Calculation */}
          {(() => {
            const invoiceItems = (visit?.items || []).filter((item: any) => {
              if (item.rxSection === "PRESCRIBED_MED") return false;
              if (item.sourceType === "RX_ITEM" && item.rxSection === "PRESCRIBED_MED") return false;
              if (item.lineType === "Prescription") return false;
              if (Number(item.unitPrice || 0) <= 0 && Number(item.lineTotal || 0) <= 0 && item.lineType !== "Consultation") return false;
              return true;
            });

            let calculatedGross = 0;
            let calculatedDiscount = 0;
            let calculatedTaxable = 0;
            let calculatedGst = 0;

            const processedRows = invoiceItems.map((item: any, idx: number) => {
              const qty = Math.max(1, Number(item.quantity) || 1);
              const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
              const gross = roundMoney(qty * unitPrice);

              const dType = (item.discountType === "fixed" || item.discountType === "₹") ? "fixed" : "percentage";
              const rawDisc = item.discountValue !== undefined && item.discountValue !== null ? Number(item.discountValue) : (Number(item.discountPercent) || 0);
              const discVal = Math.max(0, isNaN(rawDisc) ? 0 : rawDisc);

              const isLineGst = isGst ? (item.gstApplicable !== false) : (item.gstApplicable === true);
              const rate = isLineGst ? (Number(item.gstRate) || 0) : 0;

              const lineCalc = calcLineItem({
                quantity: qty,
                unitPrice,
                discountType: dType,
                discountValue: discVal,
                gstRate: rate,
                applyGst: isLineGst,
              });

              const discPercent = dType === "percentage" ? discVal : (gross > 0 ? Math.round((lineCalc.discountAmount / gross) * 100) : 0);
              const taxableAmt = lineCalc.taxableAmount;
              const gstAmt = lineCalc.gstAmount;
              const finalAmt = lineCalc.lineTotal;

              calculatedGross = addMoney(calculatedGross, gross);
              calculatedDiscount = addMoney(calculatedDiscount, lineCalc.discountAmount);
              calculatedTaxable = addMoney(calculatedTaxable, taxableAmt);
              calculatedGst = addMoney(calculatedGst, gstAmt);

              return {
                item,
                idx,
                qty,
                unitPrice,
                discPercent,
                discountAmount: lineCalc.discountAmount,
                taxableAmt,
                gstRate: rate,
                gstAmt,
                finalAmt,
              };
            });

            return (
              <>
                <table className="w-full text-xs border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-left font-bold text-gray-700 text-[10px] uppercase tracking-wider">
                      <th className="p-2 w-8 text-center">#</th>
                      <th className="p-2">Description / Item</th>
                      <th className="p-2 text-center w-12">Qty</th>
                      <th className="p-2 text-right w-20">Rate (₹)</th>
                      <th className="p-2 text-center w-16">Disc (%)</th>
                      <th className="p-2 text-right w-24">Taxable Amt (₹)</th>
                      {isGst && <th className="p-2 text-center w-16">GST (%)</th>}
                      <th className="p-2 text-right w-24">Final Amt (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {processedRows.map(({ item, idx, qty, unitPrice, discPercent, discountAmount, taxableAmt, gstRate, gstAmt, finalAmt }) => (
                      <tr key={idx}>
                        <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                        <td className="p-2">
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-500">{item.lineType || "Service"}</span>
                            {item.batchNo && (
                              <span className="text-[9px] text-gray-400 font-mono">Batch: {item.batchNo}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center font-medium">{qty}</td>
                        <td className="p-2 text-right font-mono">{unitPrice.toFixed(2)}</td>
                        <td className="p-2 text-center font-mono">
                          {discPercent > 0 ? (
                            <div>
                              <span className="font-bold text-emerald-700">{discPercent}%</span>
                              <div className="text-[9px] text-emerald-600">-₹{discountAmount.toFixed(2)}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">0%</span>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-gray-800">{taxableAmt.toFixed(2)}</td>
                        {isGst && (
                          <td className="p-2 text-center font-mono">
                            {gstRate > 0 ? (
                              <div>
                                <span className="font-bold text-gray-700">{gstRate}%</span>
                                <div className="text-[9px] text-gray-500">+₹{gstAmt.toFixed(2)}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">0%</span>
                            )}
                          </td>
                        )}
                        <td className="p-2 text-right font-bold font-mono text-gray-900">{finalAmt.toFixed(2)}</td>
                      </tr>
                    ))}
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
                      <span>Subtotal (Gross):</span>
                      <span className="font-mono">₹{(visit?.subtotal || calculatedGross).toFixed(2)}</span>
                    </div>
                    {(visit?.billDiscount || calculatedDiscount) > 0 && (
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Total Discount:</span>
                        <span className="font-mono">-₹{(visit?.billDiscount || calculatedDiscount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-700 font-semibold pt-0.5 border-t border-gray-200">
                      <span>Taxable Amount:</span>
                      <span className="font-mono">₹{(visit?.taxableAmount || calculatedTaxable).toFixed(2)}</span>
                    </div>
                    {isGst && (
                      <div className="flex justify-between text-gray-600">
                        <span>GST Amount:</span>
                        <span className="font-mono">+₹{(visit?.gstAmount || calculatedGst).toFixed(2)}</span>
                      </div>
                    )}
                    {visit?.roundOff !== 0 && visit?.roundOff !== undefined && (
                      <div className="flex justify-between text-gray-600">
                        <span>Round-off:</span>
                        <span className="font-mono">{visit?.roundOff >= 0 ? `+₹${visit.roundOff.toFixed(2)}` : `-₹${Math.abs(visit.roundOff).toFixed(2)}`}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-base pt-2 border-t-2 border-black text-gray-900">
                      <span>Total Bill:</span>
                      <span className="font-mono">₹{(visit?.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>

                    {isMultiPayment && (
                      <>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Previous Paid:</span>
                          <span className="font-mono">₹{previousPaidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-gray-800">
                          <span>Current Payment:</span>
                          <span className="font-mono">₹{Number(currentPaymentAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

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
              <p className="font-bold text-gray-700">For Real Care Small Animal Clinic</p>
              <p className="pt-6 text-gray-400">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
