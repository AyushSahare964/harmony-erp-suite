import { useEffect, useRef } from "react";
import {
  Clock,
  FlaskConical,
  PawPrint,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import { Highlight } from "./Highlight";
import { optionId, type ResultGroup, type ResultIcon, type SearchResult } from "./searchResults";

const ICONS: Record<ResultIcon, LucideIcon> = {
  paw: PawPrint,
  clock: Clock,
  lab: FlaskConical,
  purchase: Receipt,
  vaccine: Syringe,
  medical: Stethoscope,
  deworm: ShieldCheck,
};

interface SuggestListProps {
  id: string;
  groups: ResultGroup[];
  query: string;
  activeIndex: number;
  onChoose: (item: SearchResult) => void;
}

export function SuggestList({ id, groups, query, activeIndex, onChoose }: SuggestListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the keyboard-selected row in view.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(optionId(id, activeIndex))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [id, activeIndex]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  let flatIndex = -1;

  return (
    <div className="vd-suggest" id={id} role="listbox" aria-label="Search results" ref={listRef}>
      {total === 0 ? (
        <div className="vd-sg-empty">
          No match for "{query.trim()}". Try a pet name, owner name or phone number.
        </div>
      ) : (
        groups.map((group) => (
          <div role="group" aria-label={group.heading} key={group.heading}>
            <div className="vd-sg-head" aria-hidden="true">
              {group.heading}
            </div>
            {group.items.map((item) => {
              const i = ++flatIndex;
              const Icon = ICONS[item.icon];
              return (
                <div
                  key={item.key}
                  id={optionId(id, i)}
                  className="vd-sg-item"
                  role="option"
                  aria-selected={i === activeIndex}
                  // mousedown (not click) so the input keeps focus until we navigate
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChoose(item);
                  }}
                >
                  <span className="vd-sg-ico">
                    <Icon strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="vd-sg-main">
                    <div className="vd-sg-title">
                      <Highlight text={item.title} query={query} />
                    </div>
                    <div className="vd-sg-sub">{item.sub}</div>
                  </span>
                  <span className="vd-sg-tag">{item.tag}</span>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
