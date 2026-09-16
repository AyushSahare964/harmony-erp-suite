import { useState, useMemo, useEffect } from "react";
import { Calculator, Copy, Check, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeQuick, type QuickTaxResult } from "@/lib/finance/taxEngine";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GstCalculatorPopoverProps {
  onUseInInvoice?: (breakup: {
    amount: number;
    gstRate: number;
    inclusive: boolean;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }) => void;
  className?: string;
}

const COMMON_RATES = [0, 5, 12, 18, 28];

export function GstCalculatorPopover({
  onUseInInvoice,
  className,
}: GstCalculatorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(1000);
  const [gstRate, setGstRate] = useState<number>(18);
  const [cessRate, setCessRate] = useState<number>(0);
  const [inclusive, setInclusive] = useState<boolean>(false);
  const [interstate, setInterstate] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  // Restore stored preferences
  useEffect(() => {
    try {
      const savedRate = localStorage.getItem("vetos_gst_rate");
      if (savedRate) setGstRate(Number(savedRate));
      const savedInclusive = localStorage.getItem("vetos_gst_inclusive");
      if (savedInclusive !== null) setInclusive(savedInclusive === "true");
    } catch {}
  }, []);

  const handleRateSelect = (rate: number) => {
    setGstRate(rate);
    try {
      localStorage.setItem("vetos_gst_rate", String(rate));
    } catch {}
  };

  const handleInclusiveToggle = (val: boolean) => {
    setInclusive(val);
    try {
      localStorage.setItem("vetos_gst_inclusive", String(val));
    } catch {}
  };

  // Keyboard shortcut Alt+G to open
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const calcResult: QuickTaxResult = useMemo(() => {
    return computeQuick({
      amount: Math.max(0, amount || 0),
      gstRate: Math.max(0, gstRate || 0),
      cessRate: cessRate > 0 ? cessRate : 0,
      inclusive,
      interstate,
    });
  }, [amount, gstRate, cessRate, inclusive, interstate]);

  const copyBreakup = () => {
    const text = `Base Taxable: ₹${calcResult.taxable.toFixed(2)}
${
  interstate
    ? `IGST (${gstRate}%): ₹${calcResult.igst.toFixed(2)}`
    : `CGST (${gstRate / 2}%): ₹${calcResult.cgst.toFixed(2)}
SGST (${gstRate / 2}%): ₹${calcResult.sgst.toFixed(2)}`
}
${cessRate > 0 ? `Cess: ₹${calcResult.cess.toFixed(2)}\n` : ""}Round Off: ₹${calcResult.roundOff.toFixed(2)}
Final Total: ₹${calcResult.roundedTotal.toFixed(2)}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("GST breakup copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          title="GST Calculator (Alt+G)"
          className={cn(
            "size-8 text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm relative",
            open && "text-primary border-primary",
            className
          )}
        >
          <Calculator className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[330px] p-4 bg-card text-card-foreground border-border shadow-2xl rounded-2xl animate-in fade-in-50 zoom-in-95"
      >
        <div className="space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calculator className="size-4" />
              </div>
              <h4 className="text-xs font-bold text-foreground">GST Quick Calculator</h4>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Alt+G
            </span>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Amount (₹)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                type="number"
                min="0"
                step="any"
                value={amount === 0 ? "" : amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="Enter amount..."
                className="h-8 pl-7 text-xs font-mono font-bold bg-background"
                autoFocus
              />
            </div>
          </div>

          {/* GST Rate Chips */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">GST Rate (%)</Label>
            <div className="grid grid-cols-5 gap-1">
              {COMMON_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRateSelect(r)}
                  className={cn(
                    "h-7 rounded-md text-[11px] font-bold transition-colors border",
                    gstRate === r
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-foreground border-border"
                  )}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          {/* Toggles: Tax Mode & State */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Exclusive vs Inclusive */}
            <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => handleInclusiveToggle(false)}
                className={cn(
                  "flex-1 py-1 rounded-md font-semibold text-center transition-all",
                  !inclusive
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                + Exclusive
              </button>
              <button
                type="button"
                onClick={() => handleInclusiveToggle(true)}
                className={cn(
                  "flex-1 py-1 rounded-md font-semibold text-center transition-all",
                  inclusive
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Incl. (MRP)
              </button>
            </div>

            {/* Intra vs Inter-state */}
            <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setInterstate(false)}
                className={cn(
                  "flex-1 py-1 rounded-md font-semibold text-center transition-all",
                  !interstate
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Intra (CG+SG)
              </button>
              <button
                type="button"
                onClick={() => setInterstate(true)}
                className={cn(
                  "flex-1 py-1 rounded-md font-semibold text-center transition-all",
                  interstate
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Inter (IGST)
              </button>
            </div>
          </div>

          {/* Results Card */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Taxable Value:</span>
              <span className="text-foreground font-semibold">₹{calcResult.taxable.toFixed(2)}</span>
            </div>

            {!interstate ? (
              <>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>CGST ({gstRate / 2}%):</span>
                  <span className="text-foreground font-semibold">₹{calcResult.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>SGST ({gstRate / 2}%):</span>
                  <span className="text-foreground font-semibold">₹{calcResult.sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-muted-foreground text-[11px]">
                <span>IGST ({gstRate}%):</span>
                <span className="text-foreground font-semibold">₹{calcResult.igst.toFixed(2)}</span>
              </div>
            )}

            {calcResult.cess > 0 && (
              <div className="flex justify-between text-muted-foreground text-[11px]">
                <span>Cess ({cessRate}%):</span>
                <span className="text-foreground font-semibold">₹{calcResult.cess.toFixed(2)}</span>
              </div>
            )}

            {calcResult.roundOff !== 0 && (
              <div className="flex justify-between text-muted-foreground text-[10px]">
                <span>Round Off:</span>
                <span>{calcResult.roundOff > 0 ? `+₹${calcResult.roundOff.toFixed(2)}` : `-₹${Math.abs(calcResult.roundOff).toFixed(2)}`}</span>
              </div>
            )}

            <div className="border-t border-border pt-1.5 flex justify-between items-center text-sm font-bold text-foreground">
              <span>Final Total:</span>
              <span className="text-primary text-base font-black">
                ₹{calcResult.roundedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyBreakup}
              className="flex-1 h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
              <span>{copied ? "Copied" : "Copy Breakup"}</span>
            </Button>

            {onUseInInvoice && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onUseInInvoice({
                    amount: calcResult.roundedTotal,
                    gstRate,
                    inclusive,
                    taxable: calcResult.taxable,
                    cgst: calcResult.cgst,
                    sgst: calcResult.sgst,
                    igst: calcResult.igst,
                    total: calcResult.roundedTotal,
                  });
                  setOpen(false);
                }}
                className="flex-1 h-7 text-[11px] gap-1 bg-primary text-primary-foreground"
              >
                <span>Use in Invoice</span>
                <ArrowRight className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
