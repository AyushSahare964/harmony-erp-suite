import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, ShoppingBag, Receipt, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  sale: any;
}

export function RetailReceiptModal({ open, onClose, sale }: Props) {
  if (!sale) return null;

  const handlePrint = () => {
    toast.info("Opening thermal receipt print dialog...");
    window.print();
  };

  const items = sale.items || [
    { name: sale.item, quantity: sale.qty || 1, unitPrice: sale.amount || 450, gstRate: 18 },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md border-border bg-card shadow-2xl p-0 gap-0">
        {/* Top Controls */}
        <div className="border-b border-border bg-muted/40 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Retail POS Receipt — {sale.bill}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Printer className="mr-1 size-3" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
              Close
            </Button>
          </div>
        </div>

        {/* Printable Thermal Receipt Canvas */}
        <div className="p-6 bg-white text-slate-900 font-mono text-xs space-y-4">
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
            <h3 className="font-bold text-sm tracking-tight text-slate-900">🐾 Harmony Pet Pharmacy &amp; Retail</h3>
            <p className="text-[10px] text-slate-500">Koramangala, Bengaluru · GSTIN: 29AABCU9603R1ZM</p>
            <p className="text-[10px] text-slate-400">Tel: +91 80 4920 1100 · Counter Bill</p>
          </div>

          <div className="flex justify-between text-[11px] border-b border-dashed border-slate-300 pb-2">
            <div>
              <p><span className="text-slate-400">Bill:</span> <strong>{sale.bill}</strong></p>
              <p><span className="text-slate-400">Date:</span> {sale.date || new Date().toISOString().slice(0, 10)}</p>
            </div>
            <div className="text-right">
              <p><span className="text-slate-400">Customer:</span> {sale.customer || "Walk-in"}</p>
              <p><span className="text-slate-400">Mode:</span> {sale.payment || "UPI"}</p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase">
              <span>Item Description</span>
              <span>Qty x Price = Total</span>
            </div>
            {items.map((it: any, i: number) => (
              <div key={i} className="flex justify-between text-slate-800">
                <span className="truncate max-w-[180px]">{it.name}</span>
                <span className="font-bold">
                  {it.quantity} x ₹{it.unitPrice} = ₹{(it.quantity * it.unitPrice).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-right text-xs">
            <p className="text-slate-600">Subtotal: ₹{Number(sale.subtotal || sale.amount * 0.85).toFixed(2)}</p>
            <p className="text-slate-600">GST (CGST + SGST): ₹{Number(sale.gst || sale.amount * 0.15).toFixed(2)}</p>
            <p className="text-sm font-bold text-slate-900 border-t border-dashed border-slate-300 pt-1">
              PAID TOTAL: ₹{Number(sale.amount).toFixed(2)}
            </p>
          </div>

          <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-200">
            Thank you for visiting Harmony Pet Hospital! 🐶🐱
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
