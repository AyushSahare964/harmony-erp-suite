import { ChevronRight, BookOpen } from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import type { LedgerType } from "@/lib/mongodb/serverFns/ledgers";
import { LedgersTab } from "./LedgersTab";

export function LedgersHub({
  ledger,
  onClear,
}: {
  ledger?: LedgerType | undefined;
  onClear?: (() => void) | undefined;
}) {
  return (
    <Shell title="Ledgers">
      <div className="mx-auto max-w-[1100px] space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="size-3.5 text-primary" />
          <span>Ledgers</span>
          <ChevronRight className="size-3" />
          <span className="font-semibold text-foreground">Customer · Supplier · Staff · Cash</span>
        </nav>
        <LedgersTab selected={ledger} onClear={onClear} />
      </div>
    </Shell>
  );
}
