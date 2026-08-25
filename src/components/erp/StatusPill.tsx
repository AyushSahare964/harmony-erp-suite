import { cn } from "@/lib/utils";

const GREEN = ["active", "paid", "connected", "completed", "delivered", "read", "reported", "approved", "present", "in stock", "growing", "shared", "checked-out", "billed", "credit", "scheduled", "matched", "reconciled", "within budget"];
const AMBER = ["trial", "due", "pending", "waiting", "unpaid", "review", "review due", "low stock", "expiring", "warning", "in process", "in transit", "unbilled", "reserved", "partially paid", "unreconciled", "hold", "late", "draft", "running", "booked", "pending signature", "on leave", "stable", "liability", "open", "invited", "in session", "in consultation", "checked-in", "staying", "pending clearance", "near limit", "inactive"];
const RED = ["suspended", "overdue", "failed", "critical", "urgent", "declining", "locked", "dormant", "absent", "disabled", "no-show", "cancelled", "refunded", "unread", "debit", "unmatched", "over budget"];


export function statusTone(value?: string | number | null): "green" | "amber" | "red" | "gray" {
  if (value == null) return "gray";
  const v = String(value).toLowerCase().trim();
  if (!v) return "gray";
  if (GREEN.includes(v)) return "green";
  if (AMBER.includes(v)) return "amber";
  if (RED.includes(v)) return "red";
  return "gray";
}

export function StatusPill({ value }: { value?: string | number | null }) {
  const displayValue = value != null && String(value).trim() !== "" ? String(value) : "—";
  const tone = statusTone(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "green" && "bg-success-soft text-success",
        tone === "amber" && "bg-warning-soft text-warning",
        tone === "red" && "bg-danger-soft text-destructive",
        tone === "gray" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "green" && "bg-success",
          tone === "amber" && "bg-warning",
          tone === "red" && "bg-destructive",
          tone === "gray" && "bg-muted-foreground",
        )}
      />
      {displayValue}
    </span>
  );
}

