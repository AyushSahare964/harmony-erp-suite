import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
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

export function ModuleFlashcard({ card, index = 0 }: { card: FlashcardData; index?: number }) {
  const Icon = getIcon(card.icon);
  const accent = card.accent ?? "blue";
  const TrendIcon = card.trendTone === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
      whileTap={{ scale: 0.985 }}
      className="h-full"
    >
      <Link
        to="/m/$moduleId"
        params={{ moduleId: card.module }}
        className="erp-card group flex h-full flex-col p-5 transition-all duration-300 hover:border-primary hover:shadow-[var(--shadow-card-hover)]"
      >
        <div className="flex items-start justify-between gap-3">
          <motion.span
            whileHover={{ scale: 1.1, rotate: 3 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={cn("flex size-10 items-center justify-center rounded-lg", ACCENT[accent])}
          >
            <Icon className="size-5" />
          </motion.span>
          {card.badge && (
            <span className={cn("rounded-full px-2 py-0.5 text-[0.68rem] font-semibold", BADGE[accent])}>
              {card.badge}
            </span>
          )}
        </div>

        <h3 className="mt-4 text-[0.95rem] font-bold leading-snug text-navy group-hover:text-primary transition-colors">
          {card.title}
        </h3>
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
          <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
        </div>
      </Link>
    </motion.div>
  );
}
