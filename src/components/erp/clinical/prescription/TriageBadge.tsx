import { cn } from "@/lib/utils";
import { TRIAGE_LABEL } from "@/lib/clinical/triageRules";
import type { Triage } from "@/lib/clinical/symptomTypes";

/** E / C badge; routine (N) renders nothing so the common case stays quiet. */
export function TriageBadge({ level, className }: { level?: Triage | undefined; className?: string }) {
  if (!level || level === "N") return null;
  return (
    <span
      title={TRIAGE_LABEL[level]}
      className={cn(
        "inline-flex items-center justify-center rounded px-1 text-[9px] font-black leading-4 shrink-0",
        level === "E" ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950",
        className,
      )}
    >
      {level}
    </span>
  );
}
