import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { getIcon } from "@/components/erp/icon";
import barCss from "./floating-bar.css?url";
import type { BarItem } from "./barItems";

// Bar outline: flat on the screen edge, S-curved neck at the top and bottom, rounded inner side.
const W = 64;
const shapePath = (H: number) =>
  `M0 0 C18 0 26 14 36 28 C46 42 ${W} 46 ${W} 62 L${W} ${H - 62} ` +
  `C${W} ${H - 46} 46 ${H - 42} 36 ${H - 28} C26 ${H - 14} 18 ${H} 0 ${H} Z`;

// Glowing pocket, drawn around y = 0 and moved to the hovered icon with a CSS transform.
const E = 56;
const X0 = 7;
const H2 = 30;
const T = 22;
const R = 16;
const POCKET =
  `M${E} ${-(H2 + T)} C${E} ${-H2 - 6} ${E - 10} ${-H2} ${E - 22} ${-H2} ` +
  `L${X0 + R} ${-H2} Q${X0} ${-H2} ${X0} ${-H2 + R} L${X0} ${H2 - R} Q${X0} ${H2} ${X0 + R} ${H2} ` +
  `L${E - 22} ${H2} C${E - 10} ${H2} ${E} ${H2 + 6} ${E} ${H2 + T}`;
const POCKET_FILL = `${POCKET} L${W + 6} ${H2 + T} L${W + 6} ${-(H2 + T)} Z`;

/** Height used before the bar is measured (server render / first paint). */
const DEFAULT_HEIGHT = 480;

interface FloatingBarProps {
  side: "left" | "right";
  label: string;
  badge: ReactNode;
  badgeClass?: string;
  items: BarItem[];
}

const isCurrent = (item: BarItem, pathname: string) =>
  item.to === "/" || item.to === "/clinic"
    ? pathname === item.to
    : pathname === `/m/${item.to.moduleId}`;

/**
 * Slim side bar, flush with the screen edge. Plain at rest (the current page has a small dot).
 * Hovering or focusing an icon slides the glowing pocket to it and shows its short name underneath.
 */
export function FloatingBar({ side, label, badge, badgeClass = "", items }: FloatingBarProps) {
  const uid = useId().replace(/:/g, "");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [lit, setLit] = useState<number | null>(null);
  // Last pocket position is kept while hidden, so the next hover slides from there.
  const [pocketY, setPocketY] = useState<number | null>(null);

  // The outline depends on the bar's height: recompute whenever it changes.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const measure = () => setHeight(pill.offsetHeight || DEFAULT_HEIGHT);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pill);
    return () => ro.disconnect();
  }, []);

  const light = (i: number) => {
    const pill = pillRef.current;
    const el = itemRefs.current[i];
    if (!pill || !el) return;
    const pr = pill.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    setPocketY(br.top - pr.top + br.height / 2);
    setLit(i);
  };
  const rest = () => setLit(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const cur = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (cur < 0) return;
    e.preventDefault();
    itemRefs.current[(cur + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };

  const shape = shapePath(height);

  return (
    <nav className={`vd-dock vd-dock-${side}`} aria-label={label}>
      <link rel="stylesheet" href={barCss} precedence="default" />
      <div
        className="vd-pill"
        ref={pillRef}
        onMouseLeave={rest}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) rest();
        }}
        onKeyDown={onKeyDown}
      >
        <svg className="vd-pill-shape" viewBox={`0 0 ${W} ${height}`} aria-hidden="true">
          <defs>
            <linearGradient id={`vd-bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#00305c" />
              <stop offset=".38" stopColor="#001D39" />
              <stop offset="1" stopColor="#00152b" />
            </linearGradient>
            <linearGradient id={`vd-pf-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0d4c85" />
              <stop offset="1" stopColor="#06335f" />
            </linearGradient>
            <clipPath id={`vd-clip-${uid}`}>
              <path d={shape} />
            </clipPath>
          </defs>
          <path
            className="vd-pill-body"
            d={shape}
            fill={`url(#vd-bg-${uid})`}
            stroke="rgba(189,216,233,.22)"
            strokeWidth="1"
          />
          <g clipPath={`url(#vd-clip-${uid})`}>
            <line className="vd-spine" x1={E} x2={E} y1={40} y2={Math.max(height - 40, 41)} />
            <g
              className={`vd-pk${lit !== null ? " is-on" : ""}`}
              style={
                pocketY === null ? undefined : { transform: `translateY(${pocketY.toFixed(1)}px)` }
              }
            >
              <path d={POCKET_FILL} fill={`url(#vd-pf-${uid})`} />
              <path className="vd-glow" d={POCKET} />
            </g>
          </g>
        </svg>

        <div className={`vd-badge ${badgeClass}`}>{badge}</div>

        <div className="vd-items">
          {items.map((item, i) => {
            const Icon = getIcon(item.icon);
            const current = isCurrent(item, pathname);
            const props = {
              ref: (el: HTMLAnchorElement | null) => {
                itemRefs.current[i] = el;
              },
              className: `vd-it${lit === i ? " is-lit" : ""}${current ? " is-current" : ""}`,
              "aria-label": item.name,
              "aria-current": current ? ("page" as const) : undefined,
              onMouseEnter: () => light(i),
              onFocus: () => light(i),
            };
            const inner = (
              <>
                <Icon strokeWidth={1.8} aria-hidden="true" />
                <span className="vd-lb" aria-hidden="true">
                  {item.short}
                </span>
              </>
            );
            if (typeof item.to === "object")
              return (
                <Link
                  key={item.key}
                  {...props}
                  to="/m/$moduleId"
                  params={{ moduleId: item.to.moduleId }}
                >
                  {inner}
                </Link>
              );
            return (
              <Link key={item.key} {...props} to={item.to}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
