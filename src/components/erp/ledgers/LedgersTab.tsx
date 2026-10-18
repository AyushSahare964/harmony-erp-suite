import { useEffect, useState } from "react";
import { Users, Truck, UserCog, Banknote } from "lucide-react";
import type { LedgerType } from "@/lib/mongodb/serverFns/ledgers";
import { LedgerReportDialog } from "./LedgerReportDialog";
import { LEDGER_TYPES } from "./ledgerTypes";

const ICONS: Record<LedgerType, React.FC<{ className?: string }>> = {
  customer: Users,
  supplier: Truck,
  staff: UserCog,
  cash: Banknote,
};
const TILES = LEDGER_TYPES.map((t) => ({ type: t.id, label: t.label, hint: t.hint, Icon: ICONS[t.id] }));

/** `selected` comes from the sidebar flyout (?l=); leaving the ledger calls `onClear` to drop it from the URL. */
export function LedgersTab({
  selected,
  onClear,
}: {
  selected?: LedgerType | undefined;
  onClear?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState<LedgerType | null>(selected ?? null);
  useEffect(() => setOpen(selected ?? null), [selected]);

  // A chosen ledger takes over the page as a section; "All ledgers" brings the tiles back.
  if (open) {
    return (
      <LedgerReportDialog
        type={open}
        onClose={() => {
          setOpen(null);
          onClear?.();
        }}
      />
    );
  }

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
    </div>
  );
}
