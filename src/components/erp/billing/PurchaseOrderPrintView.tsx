import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Download,
  CheckCircle2,
  Building2,
  Calendar,
  FileText,
  ThermometerSnowflake,
  Trash2,
  X,
  Truck,
} from "lucide-react";
import { printOrSaveDocumentAsPdf } from "@/lib/utils/pdfExport";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { type ClinicPurchaseOrderRecord } from "./PurchaseOrderModal";
import { cn } from "@/lib/utils";

interface PurchaseOrderPrintViewProps {
  order: ClinicPurchaseOrderRecord | null;
  open: boolean;
  onClose: () => void;
  onMarkReceived?: (orderId: string) => void;
  onDelete?: (orderId: string, poNo?: string) => void;
}

export function PurchaseOrderPrintView({
  order,
  open,
  onClose,
  onMarkReceived,
  onDelete,
}: PurchaseOrderPrintViewProps) {
  if (!order) return null;

  const handlePrint = () => {
    const cleanNo = (order.poNumber || "PurchaseOrder").replace(/[\/\\]/g, "_");
    printOrSaveDocumentAsPdf("purchase-order-printable-area", `PurchaseOrder_${cleanNo}`);
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
    ISSUED: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300",
    PENDING_DELIVERY: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300",
    RECEIVED: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300",
    CANCELLED: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-300",
  };

  const hasColdChain = order.items?.some((i) => i.storageCondition?.includes("Cold"));

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl max-h-[94vh] flex flex-col p-0 overflow-hidden shadow-2xl border border-slate-300 dark:border-slate-800">
        <DialogTitle className="sr-only">
          Purchase Order {order.poNumber}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Clinic Purchase Order voucher and formal vendor procurement order
        </DialogDescription>

        {/* Top Controls Bar */}
        <div className="border-b border-border bg-muted/40 px-5 py-3 flex flex-wrap items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-black bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
              PO #{order.poNumber}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                statusColors[order.status] || statusColors.DRAFT
              )}
            >
              {order.status === "RECEIVED" && <CheckCircle2 className="size-3" />}
              {order.status.replace("_", " ")}
            </span>
            {hasColdChain && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300">
                <ThermometerSnowflake className="size-3" />
                Cold Chain (2-8°C)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {order.status !== "RECEIVED" && order.status !== "CANCELLED" && onMarkReceived && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarkReceived(order.id)}
                className="h-8 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Mark Received</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-bold bg-[#1976d2] hover:bg-[#1565c0] text-white gap-1.5 shadow-xs"
            >
              <Printer className="size-3.5" />
              <span>Print / Download PDF</span>
            </Button>

            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(order.id, order.poNumber)}
                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                title="Delete PO"
              >
                <Trash2 className="size-4" />
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Printable Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 dark:bg-slate-950">
          <div
            id="purchase-order-printable-area"
            className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-8 shadow-sm text-slate-800 dark:text-slate-200 text-xs"
          >
            {/* Header / Clinic Info */}
            <div className="border-b-2 border-[#1976d2] pb-4 mb-5">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {CLINIC_CONFIG.clinicName || "HARMONY VETERINARY HOSPITAL & ANIMAL HEALTHCARE"}
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md">
                    {CLINIC_CONFIG.address || "89 Animal Care Boulevard, Shivajinagar, Pune, Maharashtra 411005"}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 font-medium">
                    <span>Phone: {CLINIC_CONFIG.phone || "+91 98765 43210"}</span>
                    <span>Email: {CLINIC_CONFIG.email || "pharmacy@harmonyvet.in"}</span>
                    <span>GSTIN: <strong className="font-mono text-slate-800 dark:text-slate-200">{CLINIC_CONFIG.gstin || "27AABCH1234F1Z8"}</strong></span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-[#1976d2] text-white px-3 py-1 rounded text-sm font-black tracking-wider uppercase shadow-xs">
                    PURCHASE ORDER
                  </div>
                  <div className="mt-2 text-right space-y-0.5">
                    <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {order.poNumber}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Date: <strong className="text-slate-700 dark:text-slate-300">{formatDisplayDate(order.poDate)}</strong>
                    </div>
                    {order.deliveryDate && (
                      <div className="text-slate-500 text-[11px]">
                        Required By: <strong className="text-slate-700 dark:text-slate-300">{formatDisplayDate(order.deliveryDate)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor & Ship-To Blocks */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Vendor Box */}
              <div className="border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                  <Building2 className="size-3 text-[#1976d2]" />
                  <span>VENDOR / SUPPLIER DETAILS</span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {order.supplierName}
                </div>
                {order.supplierAddress && (
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                    {order.supplierAddress}
                  </p>
                )}
                {order.supplierPhone && (
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                    Tel: {order.supplierPhone}
                  </p>
                )}
                {order.supplierGstin && (
                  <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-semibold mt-1">
                    GSTIN: {order.supplierGstin}
                  </p>
                )}
              </div>

              {/* Ship To Box */}
              <div className="border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                  <Truck className="size-3 text-emerald-600" />
                  <span>SHIP TO / DELIVERY DESTINATION</span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  Harmony Veterinary Hospital
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                  {order.deliveryLocation || "Central Pharmacy Inward Bay, Ground Floor"}
                </p>
                <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  <span>Ship Via: {order.transportMode || "Direct Courier"}</span>
                  <span>Place of Supply: {order.placeOfSupply || "Maharashtra"}</span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-300 dark:border-slate-700 rounded overflow-hidden mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1976d2] text-white font-bold">
                    <th className="py-2 px-3 w-8 text-center">#</th>
                    <th className="py-2 px-3">Item Particulars &amp; Veterinary Specifications</th>
                    <th className="py-2 px-3 w-16 text-center">Unit</th>
                    <th className="py-2 px-3 w-16 text-center">Qty</th>
                    <th className="py-2 px-3 w-20 text-right">Rate (₹)</th>
                    <th className="py-2 px-3 w-14 text-center">GST</th>
                    <th className="py-2 px-3 w-24 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {order.items?.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-center font-semibold text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">{it.productName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {it.genericName || it.category}
                          {it.packSpecs && ` • ${it.packSpecs}`}
                          {it.brand && ` • ${it.brand}`}
                          {it.targetSpecies && ` • Species: ${it.targetSpecies}`}
                        </div>
                        {it.storageCondition?.includes("Cold") && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-sky-700 dark:text-sky-400 font-bold mt-0.5">
                            <ThermometerSnowflake className="size-2.5" />
                            <span>Biological: Maintain 2-8°C cold chain</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700 dark:text-slate-300 font-semibold">{it.uom}</td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">{it.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {it.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                        {it.gstPct}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₹{(it.lineTotal || it.taxableAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Terms & Totals Summary */}
            <div className="grid grid-cols-2 gap-6 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Standard Purchase Instructions
                  </div>
                  <p>1. Please attach Manufacturer Batch Test Certificate with dispatch.</p>
                  <p>2. Vaccines & biologicals must be accompanied by temperature logger / cold indicator.</p>
                  <p>3. Medicines expiring within 18 months of delivery will not be accepted.</p>
                  <p>4. Delivery timings: Monday to Saturday, 9:00 AM to 6:00 PM.</p>
                </div>
                {order.remarks && (
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded border border-amber-200 dark:border-amber-800">
                    <strong className="text-amber-800 dark:text-amber-400">Order Note: </strong>
                    {order.remarks}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 font-medium">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono">₹{(order.subTotal || 0).toFixed(2)}</span>
                  </div>
                  {order.cgstTotal > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>CGST:</span>
                      <span className="font-mono">₹{order.cgstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {order.sgstTotal > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>SGST:</span>
                      <span className="font-mono">₹{order.sgstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {order.igstTotal > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>IGST:</span>
                      <span className="font-mono">₹{order.igstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {order.shippingCost > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Shipping / Courier:</span>
                      <span className="font-mono">₹{order.shippingCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-black text-sm text-[#1976d2] dark:text-blue-400">
                    <span>TOTAL PO AMOUNT:</span>
                    <span className="font-mono text-base">₹{(order.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-6 text-center">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    For {CLINIC_CONFIG.clinicName || "Harmony Veterinary Hospital"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-6">
                    Authorized Signatory / Medical Superintendent
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
