import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";

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

export const DEFAULT_RX_JUMP_SECTIONS: SectionJumpItem[] = [
  { id: "sec-history", label: "1. History" },
  { id: "sec-symptoms", label: "2. Symptoms" },
  { id: "sec-findings", label: "3. Findings" },
  { id: "sec-treatment", label: "4. Treatment" },
  { id: "sec-fee", label: "5. Fee" },
  { id: "sec-followup", label: "6. Follow-up" },
  { id: "sec-laboratory", label: "7. Laboratory" },
  { id: "sec-animal-food", label: "8. Animal Food" },
  { id: "sec-prescribed-food", label: "9. Prescribed Food" },
  { id: "sec-accessories", label: "10. Accessories" },
];

export function SectionJumpBar({
  sections,
  activeSection,
  onSelectSection,
  className,
}: SectionJumpBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [internalActive, setInternalActive] = useState<string>(activeSection || sections[0]?.id || "");
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sync external activeSection if provided
  useEffect(() => {
    if (activeSection) {
      setInternalActive(activeSection);
    }
  }, [activeSection]);

  // Check horizontal overflow
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [sections]);

  const handleScrollBy = (amount: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const scrollTo = (id: string) => {
    setInternalActive(id);
    onSelectSection?.(id);
    const target = document.getElementById(id);
    if (!target) return;

    const scrollParent = target.closest(".overflow-y-auto");
    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = 16;
      const targetScrollTop = scrollParent.scrollTop + (targetRect.top - parentRect.top) - offset;
      scrollParent.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Auto-track active section on vertical scroll
  useEffect(() => {
    if (!sections.length) return;
    const firstEl = document.getElementById(sections[0]?.id || "");
    const scrollParent = firstEl?.closest(".overflow-y-auto");
    if (!scrollParent) return;

    let timeoutId: any = null;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        const parentRect = scrollParent.getBoundingClientRect();
        const offset = 80;
        for (let i = sections.length - 1; i >= 0; i--) {
          const sec = sections[i];
          if (!sec) continue;
          const target = document.getElementById(sec.id);
          if (target) {
            const rect = target.getBoundingClientRect();
            if (rect.top - parentRect.top <= offset) {
              setInternalActive(sec.id);
              break;
            }
          }
        }
      }, 50);
    };

    scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollParent.removeEventListener("scroll", handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sections]);

  // Scroll active pill into view within horizontal bar
  useEffect(() => {
    if (!internalActive || !scrollContainerRef.current) return;
    const activeButton = scrollContainerRef.current.querySelector(
      `[data-section-id="${internalActive}"]`
    ) as HTMLElement;
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [internalActive]);

  return (
    <div className={cn("z-20 border-b border-border bg-card px-6 py-2 transition-all shrink-0", className)}>
      <div className="flex items-center gap-2">
        {/* Jump To Label */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1 shrink-0 select-none">
          <ListFilter className="size-3.5 text-primary" />
          <span>Jump to:</span>
        </div>

        <span className="h-4 w-px bg-border/80 shrink-0" />

        {/* Scroll Left Arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScrollBy(-140)}
            className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            title="Scroll left"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        )}

        {/* Scrollable Pills Track */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar flex-1 py-0.5 scroll-smooth"
        >
          {sections.map((sec) => {
            const isActive = internalActive === sec.id;
            return (
              <button
                key={sec.id}
                data-section-id={sec.id}
                type="button"
                onClick={() => scrollTo(sec.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                    : "bg-muted/50 text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground",
                  sec.isDirty && !isActive && "border-amber-400/90 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold"
                )}
              >
                {sec.isDirty && (
                  <span className="size-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                )}
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scroll Right Arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScrollBy(140)}
            className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            title="Scroll right"
          >
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
