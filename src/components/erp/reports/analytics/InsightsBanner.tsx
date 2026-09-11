import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  id: string;
  tone: "info" | "warning" | "success" | "neutral";
  title: string;
  description: string;
}

interface Props {
  insights: Insight[];
}

export function InsightsBanner({ insights }: Props) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <Sparkles className="size-4 text-amber-500 animate-pulse" />
        <span className="uppercase tracking-wider">Dynamic Clinic Intelligence &amp; Live Insights</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((ins) => {
          const isWarning = ins.tone === "warning";
          const isSuccess = ins.tone === "success";
          const isInfo = ins.tone === "info";

          return (
            <div
              key={ins.id}
              className={cn(
                "p-3 rounded-xl border transition-all shadow-2xs flex items-start gap-2.5",
                isWarning
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                  : isSuccess
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                  : isInfo
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-900 dark:text-sky-200"
                  : "bg-muted/30 border-border text-foreground"
              )}
            >
              <div className="mt-0.5">
                {isWarning && <AlertTriangle className="size-4 text-amber-600 shrink-0" />}
                {isSuccess && <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />}
                {isInfo && <TrendingUp className="size-4 text-sky-600 shrink-0" />}
                {!isWarning && !isSuccess && !isInfo && <Info className="size-4 text-muted-foreground shrink-0" />}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold leading-snug">{ins.title}</p>
                <p className="text-[11px] opacity-90 leading-normal">{ins.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
