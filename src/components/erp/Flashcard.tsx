import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Flashcard as FlashcardData } from "@/lib/erp/config";
import { getIcon } from "./icon";

const ACCENT = {
  blue: "bg-primary-soft text-primary",
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  red: "bg-danger-soft text-destructive",
} as const;

const BADGE = {
  blue: "bg-primary-soft text-primary",
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  red: "bg-danger-soft text-destructive",
} as const;

export function ModuleFlashcard({ card }: { card: FlashcardData }) {
  const Icon = getIcon(card.icon);
  const accent = card.accent ?? "blue";
  const TrendIcon = card.trendTone === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <Link
      to="/m/$moduleId"
      params={{ moduleId: card.module }}
      className="erp-card group flex h-full flex-col p-5 transition-all hover:border-primary hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-lg", ACCENT[accent])}>
          <Icon className="size-5" />
        </span>
        {card.badge && (
          <span className={cn("rounded-full px-2 py-0.5 text-[0.68rem] font-semibold", BADGE[accent])}>
            {card.badge}
          </span>
        )}
      </div>

      <h3 className="mt-4 text-[0.95rem] font-bold leading-snug">{card.title}</h3>
      <p className="mt-1 line-clamp-2 text-[0.8rem] leading-relaxed text-muted-foreground">
        {card.subtitle}
      </p>

      <div className="mt-auto flex items-end justify-between pt-5">
        <div>
          <p className="section-label">{card.metricLabel}</p>
          <p className="mt-1 text-[1.4rem] font-bold leading-none text-primary">{card.metricValue}</p>
          {card.trend && (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 text-[0.72rem] font-medium",
                card.trendTone === "down" ? "text-destructive" : "text-success",
              )}
            >
              <TrendIcon className="size-3" />
              {card.trend}
            </p>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}
