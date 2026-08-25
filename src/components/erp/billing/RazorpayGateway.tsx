import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Link2, Send, Shield, CreditCard, Smartphone, Globe,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────────────────── */
type GatewayStatus = "created" | "captured" | "failed" | "refunded";

interface GatewayPayment {
  id: string;
  invoiceNo: string;
  ownerName: string;
  amount: number;
  orderId: string;
  paymentId: string | null;
  signature: string | null;
  gatewayStatus: GatewayStatus;
  method: string;
  createdAt: string;
  capturedAt: string | null;
}

/* ─── Seed data ───────────────────────────────────────────────────── */
const SEED: GatewayPayment[] = [
  {
    id: "gw1", invoiceNo: "INV-20481", ownerName: "Tariq Hussain",
    amount: 850, orderId: "order_RZP_9A4F", paymentId: "pay_RZP_Jk2mNp",
    signature: "sha256_verified", gatewayStatus: "captured",
    method: "UPI", createdAt: "16/08 11:42", capturedAt: "16/08 11:42",
  },
  {
    id: "gw2", invoiceNo: "INV-20482", ownerName: "Nalini Prasad",
    amount: 3200, orderId: "order_RZP_9B7G", paymentId: "pay_RZP_Wq8xLt",
    signature: "sha256_verified", gatewayStatus: "captured",
    method: "Card", createdAt: "16/08 10:15", capturedAt: "16/08 10:16",
  },
  {
    id: "gw3", invoiceNo: "INV-20483", ownerName: "Deepika Iyer",
    amount: 1650, orderId: "order_RZP_9C2H", paymentId: null,
    signature: null, gatewayStatus: "created",
    method: "—", createdAt: "16/08 09:30", capturedAt: null,
  },
  {
    id: "gw4", invoiceNo: "INV-20480", ownerName: "Priya Rajan",
    amount: 2200, orderId: "order_RZP_9D1J", paymentId: "pay_RZP_Xp9yMu",
    signature: "sha256_invalid", gatewayStatus: "failed",
    method: "Netbanking", createdAt: "15/08 17:20", capturedAt: null,
  },
  {
    id: "gw5", invoiceNo: "INV-20478", ownerName: "Vikram Shetty",
    amount: 4500, orderId: "order_RZP_8E5K", paymentId: "pay_RZP_Yz0zNv",
    signature: "sha256_verified", gatewayStatus: "refunded",
    method: "UPI", createdAt: "14/08 14:05", capturedAt: "14/08 14:06",
  },
];

const PENDING_INVOICES = [
  { no: "INV-20484", owner: "Rajan Kumar",    amount: 600  },
  { no: "INV-20486", owner: "Ananya Sharma",  amount: 650  },
];

const METHOD_ICONS: Record<string, React.FC<{ className?: string }>> = {
  UPI: Smartphone,
  Card: CreditCard,
  Netbanking: Globe,
  Wallet: Wallet,
};

function money(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

function statusColor(s: GatewayStatus) {
  return {
    created: "text-amber-600",
    captured: "text-emerald-600",
    failed: "text-rose-500",
    refunded: "text-blue-500",
  }[s];
}

function statusIcon(s: GatewayStatus) {
  return {
    created: <AlertCircle className="size-4" />,
    captured: <CheckCircle2 className="size-4" />,
    failed: <XCircle className="size-4" />,
    refunded: <RefreshCw className="size-4" />,
  }[s];
}

/* ─── Checkout Modal ──────────────────────────────────────────────── */
function CheckoutModal({
  invoice,
  onClose,
  onSuccess,
  onFail,
}: {
  invoice: { no: string; owner: string; amount: number };
  onClose: () => void;
  onSuccess: (method: string) => void;
  onFail: () => void;
}) {
  const [step, setStep] = useState<"select" | "processing" | "done" | "fail">("select");
  const [method, setMethod] = useState("UPI");
  const [upiId, setUpiId] = useState("");

  const pay = () => {
    setStep("processing");
    setTimeout(() => {
      const succeed = Math.random() > 0.2; // 80% success rate
      setStep(succeed ? "done" : "fail");
    }, 2200);
  };

  const METHODS = [
    { label: "UPI", Icon: Smartphone },
    { label: "Card", Icon: CreditCard },
    { label: "Netbanking", Icon: Globe },
    { label: "Wallet", Icon: Wallet },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            Razorpay Checkout
          </DialogTitle>
          <DialogDescription>
            {invoice.no} · {invoice.owner} · <strong>{money(invoice.amount)}</strong>
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4 py-2"
            >
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => setMethod(m.label)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                      method === m.label
                        ? "border-primary bg-primary-soft/50 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <m.Icon className="size-4" /> {m.label}
                  </button>
                ))}
              </div>
              {method === "UPI" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">UPI ID</Label>
                  <Input
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="name@paytm / name@upi"
                    className="text-sm"
                  />
                </div>
              )}
              {method === "Card" && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Card Number</Label>
                    <Input placeholder="•••• •••• •••• ••••" className="text-sm tracking-widest" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expiry</Label>
                      <Input placeholder="MM / YY" className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CVV</Label>
                      <Input placeholder="•••" className="text-sm" />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="size-3" /> Secured by Razorpay · VetOS never sees card details
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-10 text-center space-y-3"
            >
              <div className="mx-auto size-14 rounded-full bg-primary-soft flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <RefreshCw className="size-6 text-primary" />
                </motion.div>
              </div>
              <p className="font-semibold">Processing payment…</p>
              <p className="text-xs text-muted-foreground">Do not close this window</p>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-10 text-center space-y-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="mx-auto size-14 rounded-full bg-emerald-500/10 flex items-center justify-center"
              >
                <CheckCircle2 className="size-8 text-emerald-500" />
              </motion.div>
              <p className="font-bold text-lg">Payment Captured!</p>
              <p className="text-xs text-muted-foreground">Webhook confirmed · Invoice marked Paid</p>
            </motion.div>
          )}

          {step === "fail" && (
            <motion.div
              key="fail"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-10 text-center space-y-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="mx-auto size-14 rounded-full bg-rose-500/10 flex items-center justify-center"
              >
                <XCircle className="size-8 text-rose-500" />
              </motion.div>
              <p className="font-bold text-lg">Payment Failed</p>
              <p className="text-xs text-muted-foreground">Invoice unchanged · You can retry or use another method</p>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter>
          {step === "select" && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={pay} className="bg-primary gap-2">
                <Zap className="size-4" /> Pay {money(invoice.amount)}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { onSuccess(method); onClose(); }} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Done
            </Button>
          )}
          {step === "fail" && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
              <Button onClick={() => setStep("select")} className="flex-1">Retry</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */
export function RazorpayGateway() {
  const [payments, setPayments] = useState<GatewayPayment[]>(SEED);
  const [checkout, setCheckout] = useState<typeof PENDING_INVOICES[0] | null>(null);

  const captured = payments.filter(p => p.gatewayStatus === "captured");
  const failed   = payments.filter(p => p.gatewayStatus === "failed");
  const created  = payments.filter(p => p.gatewayStatus === "created");
  const successRate = payments.length
    ? ((captured.length / payments.filter(p => p.gatewayStatus !== "created").length) * 100).toFixed(1)
    : "—";

  const handleSuccess = (invoiceNo: string, owner: string, amount: number, method: string) => {
    const orderId = `order_RZP_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const paymentId = `pay_RZP_${Math.random().toString(36).slice(2, 10)}`;
    const newPayment: GatewayPayment = {
      id: crypto.randomUUID(),
      invoiceNo, ownerName: owner, amount, orderId, paymentId,
      signature: "sha256_verified", gatewayStatus: "captured",
      method, createdAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      capturedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };
    setPayments(prev => [newPayment, ...prev]);
    toast.success(`${invoiceNo} paid via Razorpay — webhook confirmed`);
  };

  const handleFail = () => {
    toast.error("Razorpay: payment failed — invoice unchanged");
  };

  const refundPayment = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, gatewayStatus: "refunded" as const } : p));
    toast.success("Refund initiated via Razorpay Refund API");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Razorpay Payment Gateway</h2>
          <p className="text-sm text-muted-foreground">
            Collect card · UPI · netbanking · wallet payments directly in-portal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
            <Zap className="size-3.5" /> Gateway Connected
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Captured (MTD)", value: money(captured.reduce((s, p) => s + p.amount, 0)) },
          { label: "Success rate", value: `${successRate}%` },
          { label: "Failed transactions", value: String(failed.length), warn: true },
          { label: "Pending auth", value: String(created.length), warn: created.length > 0 },
        ].map((k) => (
          <div key={k.label} className="erp-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.warn ? "text-amber-600" : ""}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Pending invoices to pay */}
      <div className="erp-card p-5">
        <p className="section-label mb-4">Invoices awaiting Razorpay payment</p>
        <div className="space-y-2">
          {PENDING_INVOICES.map((inv) => (
            <div key={inv.no} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <div>
                <p className="font-semibold text-sm font-mono text-primary">{inv.no}</p>
                <p className="text-xs text-muted-foreground">{inv.owner}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">{money(inv.amount)}</span>
                <Button
                  size="sm"
                  onClick={() => setCheckout(inv)}
                  className="h-8 text-xs bg-primary gap-1.5 active:scale-95 transition-all"
                >
                  <Zap className="size-3.5" /> Pay via Razorpay
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gateway reconciliation table */}
      <div className="erp-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link2 className="size-4 text-primary" />
          <p className="font-semibold text-sm">Gateway Transaction Log</p>
          <span className="ml-auto text-xs text-muted-foreground">{payments.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                {["Invoice", "Owner", "Amount", "Order ID", "Payment ID", "Method", "Status", "Captured At", ""].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-bold uppercase tracking-wide ${h === "Amount" ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence>
                {payments.map((p) => {
                  const Icon = METHOD_ICONS[p.method];
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-primary-soft/25 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{p.invoiceNo}</td>
                      <td className="px-4 py-3">{p.ownerName}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(p.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.orderId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.paymentId ?? "—"}</td>
                      <td className="px-4 py-3">
                        {Icon ? (
                          <div className="flex items-center gap-1.5">
                            <Icon className="size-3.5 text-muted-foreground" />
                            {p.method}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1.5 font-medium ${statusColor(p.gatewayStatus)}`}>
                          {statusIcon(p.gatewayStatus)}
                          <span className="capitalize">{p.gatewayStatus}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.capturedAt ?? "—"}</td>
                      <td className="px-4 py-3">
                        {p.gatewayStatus === "captured" && (
                          <button
                            onClick={() => refundPayment(p.id)}
                            className="text-xs px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-medium transition-colors"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <Shield className="size-4 shrink-0 text-emerald-500 mt-0.5" />
        <span>
          <strong className="text-foreground">PCI Compliance:</strong> Card details never touch VetOS servers. Razorpay Checkout handles all card capture. 
          API keys stored encrypted in Integration Hub (Module 20) — never exposed to the browser. 
          All webhook payloads are HMAC-verified before trusting status changes.
        </span>
      </div>

      {/* Checkout modal */}
      {checkout && (
        <CheckoutModal
          invoice={checkout}
          onClose={() => setCheckout(null)}
          onSuccess={(method) => handleSuccess(checkout.no, checkout.owner, checkout.amount, method)}
          onFail={handleFail}
        />
      )}
    </motion.div>
  );
}
