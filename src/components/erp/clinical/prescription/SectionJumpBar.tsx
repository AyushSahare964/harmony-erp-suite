import React from "react";
import { cn } from "@/lib/utils";

export interface SectionJumpItem {
  id: string;
  label: string;
  isDirty?: boolean;
}

export interface SectionJumpBarProps {
  sections: SectionJumpItem[];
  activeSection?: string;
  onSelectSection?: (id: string) => void;
  className?: string;
}

export function SectionJumpBar({
  sections,
  activeSection,
  onSelectSection,
  className,
}: SectionJumpBarProps) {
  const scrollTo = (id: string) => {
    onSelectSection?.(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-20 py-2 px-1 bg-card/95 backdrop-blur-xs border-b border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar",
        className
      )}
    >
      <span className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground mr-1 shrink-0">
        Jump to:
      </span>
      {sections.map((sec) => (
        <button
          key={sec.id}
          type="button"
          onClick={() => scrollTo(sec.id)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
            activeSection === sec.id
              ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
              : "bg-muted/50 text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground",
            sec.isDirty && "border-amber-400 bg-amber-50/50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700"
          )}
        >
          {sec.isDirty && (
            <span className="size-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
          )}
          <span>{sec.label}</span>
        </button>
      ))}
    </div>
  );
}
