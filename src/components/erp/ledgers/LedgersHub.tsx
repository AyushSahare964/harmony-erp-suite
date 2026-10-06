import { BookOpen } from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { LedgersTab } from "./LedgersTab";

export function LedgersHub() {
  return (
    <Shell title="Ledgers">
      <div className="mx-auto max-w-[1100px] space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs">
            <BookOpen className="size-5" />
          </span>
          <div>
            <h1 className="page-title">Ledgers</h1>
            <p className="mt-1 text-sm text-muted-foreground">Customer · Supplier · Staff · Cash</p>
          </div>
        </div>
        <LedgersTab />
      </div>
    </Shell>
  );
}
