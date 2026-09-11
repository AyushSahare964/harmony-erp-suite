import { useEffect } from "react";
import { Plus, X, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CHEQUE";

export interface PaymentLine {
  id: string;
  mode: PaymentMode;
  accountId: string;  // "cash" for Cash, bank account _id otherwise
  amount: number;
  referenceNo: string;
  chequeDate: string; // ISO, only for CHEQUE
}

export interface PaymentAccount {
  _id: string;
  name: string;
  type: "CASH" | "BANK";
  isDefault: boolean;
}

interface SplitPaymentInputProps {
  total: number;
  lines: PaymentLine[];
  onChange: (lines: PaymentLine[]) => void;
  accounts: PaymentAccount[];
  /** If true, total must exactly equal sum of lines to allow save */
  requireExactMatch?: boolean;
  defaultMode?: PaymentMode;
}

const MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
};

function newLine(mode: PaymentMode, accountId: string, amount = 0): PaymentLine {
  return {
    id: Math.random().toString(36).slice(2),
    mode,
    accountId,
    amount,
    referenceNo: "",
    chequeDate: "",
  };
}

export function SplitPaymentInput({
  total,
  lines,
  onChange,
  accounts,
  requireExactMatch = false,
  defaultMode = "CASH",
}: SplitPaymentInputProps) {
  const cashAccount = accounts.find((a) => a.type === "CASH");
  const defaultBank = accounts.find((a) => a.type === "BANK" && a.isDefault) ?? accounts.find((a) => a.type === "BANK");
  const multipleBanks = accounts.filter((a) => a.type === "BANK").length > 1;

  // Initialise with one line if empty
  useEffect(() => {
    if (lines.length === 0 && cashAccount) {
      onChange([newLine("CASH", cashAccount._id, total)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When total changes and there is only one line, update its amount
  useEffect(() => {
    if (lines.length === 1) {
      const l = lines[0]!;
      if (l.amount !== total) {
        onChange([{ ...l, amount: total }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const entered = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const difference = Math.round((total - entered) * 100) / 100;
  const balanced = Math.abs(difference) < 0.01;

  const update = (id: string, patch: Partial<PaymentLine>) => {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const remove = (id: string) => {
    onChange(lines.filter((l) => l.id !== id));
  };

  const addLine = () => {
    const accountId = defaultMode === "CASH" ? (cashAccount?._id ?? "") : (defaultBank?._id ?? "");
    onChange([...lines, newLine(defaultMode, accountId, 0)]);
  };

  const fillBalance = (id: string) => {
    const otherSum = lines.filter((l) => l.id !== id).reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const bal = Math.max(0, Math.round((total - otherSum) * 100) / 100);
    update(id, { amount: bal });
  };

  const getAccountForMode = (mode: PaymentMode): string => {
    if (mode === "CASH") return cashAccount?._id ?? "";
    return defaultBank?._id ?? "";
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        Payment Details
        <span className="ml-2 font-normal normal-case">Total: ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </p>

      {/* Lines table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[120px_1fr_100px_1fr_28px] gap-0 bg-muted/40 border-b border-border">
          {["Mode", "Account", "Amount (₹)", "Ref / Cheque No.", ""].map((h) => (
            <div key={h} className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {lines.map((line) => {
          const showAccount = line.mode !== "CASH" && multipleBanks;
          const showRef = line.mode !== "CASH";
          const refLabel = line.mode === "CHEQUE" ? "Cheque No. *" : line.mode === "UPI" ? "UPI Ref (opt.)" : line.mode === "CARD" ? "Last 4 / Appr." : "UTR (opt.)";
          return (
            <div key={line.id} className="grid grid-cols-[120px_1fr_100px_1fr_28px] gap-0 border-b border-border/60 last:border-0 items-center">
              {/* Mode */}
              <div className="px-2 py-1.5">
                <Select value={line.mode} onValueChange={(v) => update(line.id, { mode: v as PaymentMode, accountId: getAccountForMode(v as PaymentMode), referenceNo: "", chequeDate: "" })}>
                  <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none focus:ring-0 p-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MODE_LABELS) as PaymentMode[]).map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">{MODE_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account */}
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {showAccount ? (
                  <Select value={line.accountId} onValueChange={(v) => update(line.id, { accountId: v })}>
                    <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none focus:ring-0 p-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => a.type === "BANK").map((a) => (
                        <SelectItem key={a._id} value={a._id} className="text-xs">{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-[11px]">{accounts.find((a) => a._id === line.accountId)?.name ?? (line.mode === "CASH" ? "Cash in Hand" : "—")}</span>
                )}
              </div>

              {/* Amount */}
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.amount || ""}
                    onChange={(e) => update(line.id, { amount: parseFloat(e.target.value) || 0 })}
                    className="h-7 w-full rounded border border-input bg-card px-1.5 text-xs font-mono outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    title="Fill balance"
                    onClick={() => fillBalance(line.id)}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <ChevronsRight className="size-3" />
                  </button>
                </div>
              </div>

              {/* Ref */}
              <div className="px-2 py-1.5">
                {showRef ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder={refLabel}
                      value={line.referenceNo}
                      onChange={(e) => update(line.id, { referenceNo: e.target.value })}
                      className="h-7 w-full rounded border border-input bg-card px-1.5 text-xs outline-none focus:border-primary"
                    />
                    {line.mode === "CHEQUE" && (
                      <input
                        type="date"
                        value={line.chequeDate}
                        onChange={(e) => update(line.id, { chequeDate: e.target.value })}
                        className="h-7 w-full rounded border border-input bg-card px-1.5 text-xs outline-none focus:border-primary"
                        required
                      />
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </div>

              {/* Remove */}
              <div className="flex items-center justify-center">
                {lines.length > 1 && (
                  <button type="button" onClick={() => remove(line.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-7 text-xs gap-1">
          <Plus className="size-3" /> Add payment mode
        </Button>
        <div className={cn("text-xs font-mono", !balanced && requireExactMatch ? "text-destructive font-bold" : "text-muted-foreground")}>
          Entered ₹{entered.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          {" · "}
          {balanced ? (
            <span className="text-emerald-600 font-semibold">Balanced ✓</span>
          ) : (
            <span className={requireExactMatch ? "text-destructive" : "text-amber-600"}>
              Difference ₹{Math.abs(difference).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              {requireExactMatch && " — must be ₹0 to save"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
