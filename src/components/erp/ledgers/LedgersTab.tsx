import { useState } from "react";
import { Users, Truck, UserCog, Banknote } from "lucide-react";
import type { LedgerType } from "@/lib/mongodb/serverFns/ledgers";
import { LedgerReportDialog } from "./LedgerReportDialog";

const TILES: { type: LedgerType; label: string; hint: string; Icon: React.FC<{ className?: string }> }[] = [
  { type: "customer", label: "Customer Ledger", hint: "Invoices, receipts, credit notes", Icon: Users },
  { type: "supplier", label: "Supplier Ledger", hint: "Purchase bills and payments", Icon: Truck },
  { type: "staff", label: "Staff Ledger", hint: "Salary, advances, reimbursements", Icon: UserCog },
  { type: "cash", label: "Cash Ledger", hint: "Cash in hand — day by day", Icon: Banknote },
];

export function LedgersTab() {
  const [open, setOpen] = useState<LedgerType | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <h2 className="text-base font-semibold">Select Ledger Type</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {TILES.map(({ type, label, hint, Icon }) => (
          <button
            key={type}
            id={`ledger-tile-${type}`}
            onClick={() => setOpen(type)}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-xs transition-all hover:border-primary hover:bg-primary-soft"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-6" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      <LedgerReportDialog type={open} onClose={() => setOpen(null)} />
    </div>
  );
}
