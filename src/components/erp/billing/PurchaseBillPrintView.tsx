import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, CheckCircle2, Building2, Calendar, FileText, CreditCard, Trash2 } from "lucide-react";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { type PurchaseBillRow } from "@/lib/mongodb/serverFns/purchaseBills";
import { cn } from "@/lib/utils";

interface PurchaseBillPrintViewProps {
  bill: PurchaseBillRow | null;
  open: boolean;
  onClose: () => void;
  onMarkPaid?: (billId: string) => void;
  onDelete?: (billId: string, billRef?: string) => void;
}

export function PurchaseBillPrintView({
  bill,
  open,
  onClose,
  onMarkPaid,
  onDelete,
}: PurchaseBillPrintViewProps) {
  if (!bill) return null;

  const handlePrint = () => {
    const cleanNo = (bill.internalRef || bill.billNumber || "PurchaseBill").replace(/[\/\\]/g, "_");
    printOrSaveDocumentAsPdf("purchase-bill-printable-area", `PurchaseBill_${cleanNo}`);
  };

  const handleDownload = () => {
    const cleanNo = (bill.internalRef || bill.billNumber || "PurchaseBill").replace(/[\/\\]/g, "_");
    printOrSaveDocumentAsPdf("purchase-bill-printable-area", `PurchaseBill_${cleanNo}`);
  };

  const due = Math.max(0, bill.grandTotal - (bill.amountPaid || 0));
  const isPaid = bill.status === "PAID" || due === 0;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">
          Purchase Bill {bill.internalRef || bill.billNumber}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detailed printable purchase bill and inward goods receipt
        </DialogDescription>

        {/* Top Controls Bar */}
        <div className="border-b border-border bg-muted/40 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
              PUR {bill.internalRef}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold",
                isPaid
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
              )}
            >
              {isPaid ? <CheckCircle2 className="size-3" /> : null}
              {isPaid ? "PAID" : "UNPAID"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isPaid && onMarkPaid && (
              <Button
                size="sm"
                onClick={() => onMarkPaid(bill._id)}
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              >
                <CreditCard className="size-3.5" />
                <span>Mark as Paid</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 text-xs font-semibold gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <Download className="size-3.5" />
              <span>Download PDF</span>
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-semibold bg-[#1976d2] hover:bg-[#1565c0] text-white gap-1.5 shadow-sm"
            >
              <Printer className="size-3.5" />
              <span>Print Bill</span>
            </Button>

            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(bill._id, bill.internalRef || bill.billNumber)}
                className="h-8 text-xs font-semibold gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/50"
                title="Delete Purchase Bill"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Purchase Bill Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-950">
          <div
            id="purchase-bill-printable-area"
            className="print-paper-card max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-md text-slate-900 dark:text-slate-100 space-y-6"
          >
            {/* Header with Hospital Letterhead */}
            <div className="border-b-2 border-[#1976d2] pb-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <img
                  src={CLINIC_CONFIG.logoPath}
                  alt={CLINIC_CONFIG.fullName}
                  className="h-14 w-auto object-contain flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div>
                  <h1 className="text-lg font-black tracking-tight text-[#1976d2] dark:text-sky-400">
                    {CLINIC_CONFIG.fullName}
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {CLINIC_CONFIG.subName}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                    {CLINIC_CONFIG.doctorName} · {CLINIC_CONFIG.doctorQualifications}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Phone: {CLINIC_CONFIG.phone} · {CLINIC_CONFIG.website}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block px-3 py-1 rounded bg-[#1976d2] text-white text-xs font-black uppercase tracking-wider">
                  Purchase Bill / Inward Voucher
                </div>
                <div className="mt-2 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                  {bill.internalRef}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Bill Date: {formatDisplayDate(bill.billDate)}
                </div>
              </div>
            </div>

            {/* Vendor & Invoice Meta Section */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Supplier (Vendor) Details
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {bill.supplierName}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Supplier ID: <span className="font-mono">{bill.supplierId || "—"}</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Tax Type: <span className="font-semibold">{bill.taxType}</span>
                </p>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Bill &amp; Payment Status
                </span>
                <p className="text-slate-700 dark:text-slate-300">
                  Vendor Invoice No: <span className="font-mono font-bold">{bill.billNumber || "—"}</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Due Date: <span>{bill.dueDate ? formatDisplayDate(bill.dueDate) : "On Receipt"}</span>
                </p>
                <p className="font-semibold">
                  Status:{" "}
                  <span className={cn("font-bold", isPaid ? "text-emerald-600" : "text-amber-600")}>
                    {isPaid ? "PAID IN FULL" : "UNPAID (DUE)"}
                  </span>
                </p>
              </div>
            </div>

            {/* Particulars Table */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1976d2] text-white font-bold text-xs select-none">
                    <th className="py-2.5 px-3 w-12 text-center border-r border-blue-400/30">#</th>
                    <th className="py-2.5 px-4 border-r border-blue-400/30">Item Description</th>
                    <th className="py-2.5 px-3 w-20 text-center border-r border-blue-400/30">HSN</th>
                    <th className="py-2.5 px-3 w-20 text-center border-r border-blue-400/30">Qty</th>
                    <th className="py-2.5 px-3 w-20 text-center border-r border-blue-400/30">Unit</th>
                    <th className="py-2.5 px-3 w-24 text-right border-r border-blue-400/30">Rate (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {bill.items && bill.items.length > 0 ? (
                    bill.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono border-r border-slate-200 dark:border-slate-800">
                          {item.lineNo || idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                          {item.description}
                          {item.batchNo && (
                            <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                              (Batch: {item.batchNo})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {item.hsnCode || "3004"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                          {item.qty}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {item.unit || "PCS"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          ₹{item.purchaseRate.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{item.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No item breakdown recorded. Total amount: ₹{bill.grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
              <div className="space-y-3">
                {bill.remarks && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Notes &amp; Remarks
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 italic">{bill.remarks}</p>
                  </div>
                )}

                <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300">
                  <span className="font-bold block">Inward Verification Certification:</span>
                  <span>
                    Received materials in good condition, inspected against vendor invoice and posted to inventory ledger.
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs bg-white dark:bg-slate-900 shadow-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{bill.subtotal.toFixed(2)}</span>
                </div>

                {bill.otherCharges > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Shipping &amp; Packaging</span>
                    <span className="font-mono">₹{bill.otherCharges.toFixed(2)}</span>
                  </div>
                )}

                {(bill.cgstTotal > 0 || bill.sgstTotal > 0 || bill.igstTotal > 0) && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Taxes (GST)</span>
                    <span className="font-mono">
                      ₹{(bill.cgstTotal + bill.sgstTotal + bill.igstTotal).toFixed(2)}
                    </span>
                  </div>
                )}

                {bill.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-mono">-₹{bill.discountTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t-2 border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-center text-slate-900 dark:text-white">
                  <span className="font-black uppercase tracking-wider text-xs">Total Bill Amount</span>
                  <span className="font-mono font-black text-lg text-[#1976d2] dark:text-sky-400">
                    ₹{bill.grandTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-dashed">
                  <span>Amount Paid</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    ₹{bill.amountPaid.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-900 dark:text-white font-bold">
                  <span>Balance Due</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      due > 0 ? "text-rose-600" : "text-slate-500"
                    )}
                  >
                    ₹{due.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
              <div>
                <div className="border-b border-slate-300 dark:border-slate-700 w-40 mx-auto mb-1.5 h-8"></div>
                <span>Receiver / Store In-Charge</span>
              </div>
              <div>
                <div className="border-b border-slate-300 dark:border-slate-700 w-40 mx-auto mb-1.5 h-8"></div>
                <span>Authorized Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
