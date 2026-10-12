import { useId, type KeyboardEvent } from "react";
import { fmtDate } from "@/lib/doctor/format";
import {
  ZONE_COLOR,
  ZONE_TEXT,
  ZONE_WORD,
  valFmt,
  valUnit,
  type Metric,
  type Point,
  type Zone,
  type ZoneInfo,
} from "@/lib/doctor/graphs";

const NEUTRAL = "#0A4174";
const BUBBLE_TEXT: Record<Zone, string> = { g: "#fff", y: "#2b1d00", r: "#fff" };

interface LineChartProps {
  metric: Metric;
  points: Point[];
  zones: ZoneInfo[];
  big: boolean;
  selected: number;
  selectedZone: Zone | null;
  onSelect: (i: number) => void;
}

/**
 * SVG chart drawn like the reference: straight line pieces, evenly spaced points, a soft gradient
 * under each piece, a thin vertical line per date, dashed normal-range lines, a value bubble over
 * the chosen dot. Each piece takes the colour of the dot it starts from.
 */
export function LineChart({
  metric: m,
  points: pts,
  zones: zs,
  big,
  selected: selI,
  selectedZone: selZ,
  onSelect,
}: LineChartProps) {
  const uid = useId().replace(/:/g, "");
  const k = big ? 1.25 : 1;
  const status = m.special === "status";
  const W = big ? 980 : 440;
  const H = big ? 440 : 284;
  const L = big ? (status ? 98 : 74) : status ? 74 : 50;
  const R = big ? 28 : 14;
  const T = big ? 82 : 58;
  const B = big ? 70 : 54;
  const base = H - B;
  const vals = pts.map((q) => q.v);
  const ranged = !status && m.lo != null && m.hi != null;
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (ranged) {
    lo = Math.min(lo, m.lo!);
    hi = Math.max(hi, m.hi!);
  }
  const pad = status ? 0 : (hi - lo || Math.abs(hi) * 0.2 || 1) * 0.2;
  let y0 = lo - pad;
  let y1 = hi + pad;
  if (status) [y0, y1] = [-0.5, 2.5];
  else if (lo >= 0 && y0 < 0) y0 = 0;
  const span = y1 - y0;
  const X0 = L + 26;
  const X1 = W - R - 26;
  const Y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (base - T);
  const tick =
    m.fmt ??
    ((v: number) => (span >= 20 ? String(Math.round(v)) : span >= 2 ? v.toFixed(1) : v.toFixed(2)));
  // Evenly spaced: same distance between reports, not calendar time.
  const P = pts.map((q, i) => ({
    x: pts.length === 1 ? (X0 + X1) / 2 : X0 + (i / (pts.length - 1)) * (X1 - X0),
    y: Y(q.v),
  }));
  const f = (n: number) => n.toFixed(1);
  const zc = (z: Zone | null) => (z ? ZONE_COLOR[z] : NEUTRAL);
  const id = (name: string) => `${name}-${uid}`;

  const onKey = (i: number) => (e: KeyboardEvent<SVGCircleElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(i);
    }
  };

  // Value bubble above the chosen dot
  const q = pts[selI]!;
  const zSel = zs[selI]?.z ?? null;
  const bubbleText = status
    ? ZONE_WORD[zSel ?? "g"]
    : valFmt(m, q.v) + (m.unit && !m.fmt && m.unit.length < 6 ? ` ${m.unit}` : "");
  const bh = 30 * k;
  const bw = Math.max(54 * k, bubbleText.length * 8.2 * k + 24 * k);
  const bx = Math.min(Math.max(P[selI]!.x, L + bw / 2), W - R - bw / 2);
  const by = P[selI]!.y - 20 * k - bh;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.name} over time`}>
      <defs>
        {(["g", "y", "r", "n"] as const).map((z) => {
          const c = z === "n" ? NEUTRAL : ZONE_COLOR[z];
          return (
            <linearGradient key={z} id={id(`af-${z}`)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c} stopOpacity=".42" />
              <stop offset=".75" stopColor={c} stopOpacity=".07" />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </linearGradient>
          );
        })}
        <linearGradient
          id={id("vl")}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={T - 8}
          x2="0"
          y2={base}
        >
          <stop offset="0" stopColor="#08233f" stopOpacity="0" />
          <stop offset=".35" stopColor="#08233f" stopOpacity=".16" />
          <stop offset="1" stopColor="#08233f" stopOpacity=".03" />
        </linearGradient>
        <filter id={id("sh")} x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#08233f" floodOpacity=".28" />
        </filter>
      </defs>

      {/* thin vertical line at every date */}
      {P.map(({ x }, i) => {
        const on = i === selI;
        const z = zs[i]?.z ?? null;
        return (
          <line
            key={`v${i}`}
            x1={f(x)}
            x2={f(x)}
            y1={T - 8}
            y2={base}
            stroke={on && z ? ZONE_COLOR[z] : `url(#${id("vl")})`}
            strokeWidth={on ? 1.8 : 1.2}
            strokeOpacity={on ? 0.55 : 1}
          />
        );
      })}

      {/* y-axis: lane words for overall status, numbers (and dashed normal range) otherwise */}
      {status
        ? (["r", "y", "g"] as const).map((z, n) => {
            const y = Y(2 - n);
            return (
              <g key={z}>
                <line
                  x1={L}
                  x2={W - R}
                  y1={y}
                  y2={y}
                  stroke="#08233f"
                  strokeOpacity=".08"
                  strokeDasharray="2 5"
                />
                <text
                  x={L - 12}
                  y={y + 4.5}
                  textAnchor="end"
                  fontSize={12.5 * k}
                  fontWeight="800"
                  fill={ZONE_TEXT[z]}
                >
                  {ZONE_WORD[z]}
                </text>
              </g>
            );
          })
        : [0, 1, 2, 3].map((i) => {
            const v = y0 + (span * i) / 3;
            return (
              <text
                key={`t${i}`}
                x={L - 10}
                y={Y(v) + 4}
                textAnchor="end"
                fontSize={11.5 * k}
                fill="#6f88a1"
              >
                {tick(v)}
              </text>
            );
          })}
      {ranged && (
        <>
          {[m.hi!, m.lo!].map((v) => (
            <line
              key={v}
              x1={L}
              x2={W - R}
              y1={Y(v)}
              y2={Y(v)}
              stroke="#4d6a86"
              strokeOpacity=".5"
              strokeWidth="1.2"
              strokeDasharray="6 6"
            />
          ))}
          <text
            x={W - R - 2}
            y={Y(m.hi!) - 7}
            textAnchor="end"
            fontSize={10.5 * k}
            fill="#4d6a86"
            fontWeight="600"
            pointerEvents="none"
          >
            {m.rangeText}
          </text>
        </>
      )}
      {!status && m.unit && (
        <text x={L - 10} y={T - 22} textAnchor="end" fontSize={10.5 * k} fill="#6f88a1">
          {m.unit}
        </text>
      )}

      {/* coloured area + straight line; each piece takes the colour of the point it starts from */}
      {P.slice(0, -1).map((p, i) => {
        const n = P[i + 1]!;
        const z = zs[i]?.z ?? null;
        const dim = selZ && z !== selZ ? 0.28 : 1;
        return (
          <g key={`s${i}`} opacity={dim} pointerEvents="none">
            <path
              d={`M${f(p.x)} ${f(p.y)} L${f(n.x)} ${f(n.y)} L${f(n.x)} ${base} L${f(p.x)} ${base}Z`}
              fill={`url(#${id(`af-${z ?? "n"}`)})`}
            />
            <path
              d={`M${f(p.x)} ${f(p.y)} L${f(n.x)} ${f(n.y)}`}
              fill="none"
              stroke={zc(z)}
              strokeWidth={3.4 * k}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* dots */}
      {pts.map((pt, i) => {
        const { x, y } = P[i]!;
        const z = zs[i]?.z ?? null;
        const on = i === selI;
        const dim = selZ && z !== selZ;
        const label = `${fmtDate(pt.date)}: ${valUnit(m, pt.v, pt)}`;
        return (
          <g key={`d${i}`}>
            {on && (
              <circle
                cx={f(x)}
                cy={f(y)}
                r={13 * k}
                fill="#fff"
                filter={`url(#${id("sh")})`}
                pointerEvents="none"
              />
            )}
            <circle
              data-pt=""
              cx={f(x)}
              cy={f(y)}
              r={(on ? 8.5 : 6) * k}
              fill={zc(z)}
              fillOpacity={dim ? 0.3 : 1}
              stroke="#fff"
              strokeWidth={on ? 0 : 2.4}
              tabIndex={0}
              role="button"
              aria-label={label}
              onClick={() => onSelect(i)}
              onKeyDown={onKey(i)}
            >
              <title>{`${label}${z && !status ? ` (${ZONE_WORD[z]})` : ""}. Tap for details.`}</title>
            </circle>
          </g>
        );
      })}

      {/* floating value bubble above the chosen dot */}
      <g pointerEvents="none" filter={`url(#${id("sh")})`}>
        <rect x={f(bx - bw / 2)} y={f(by)} width={f(bw)} height={bh} rx={bh / 2} fill={zc(zSel)} />
        <path
          d={`M${f(P[selI]!.x - 7 * k)} ${f(by + bh - 1)} L${f(P[selI]!.x)} ${f(by + bh + 8 * k)} L${f(P[selI]!.x + 7 * k)} ${f(by + bh - 1)}Z`}
          fill={zc(zSel)}
        />
      </g>
      <text
        x={f(bx)}
        y={f(by + bh / 2 + 5 * k)}
        textAnchor="middle"
        fontSize={14 * k}
        fontWeight="800"
        fill={zSel ? BUBBLE_TEXT[zSel] : "#fff"}
        pointerEvents="none"
      >
        {bubbleText}
      </text>

      {/* date labels: day + month on top, year below, chosen date in bold */}
      {pts.map((pt, i) => {
        const x = P[i]!.x;
        const on = i === selI;
        const z = zs[i]?.z ?? null;
        const c = on && z ? ZONE_TEXT[z] : on ? "#08233f" : "#5f7893";
        return (
          <g key={`l${i}`} pointerEvents="none">
            <text
              x={f(x)}
              y={base + 22 * k}
              textAnchor="middle"
              fontSize={12 * k}
              fontWeight={on ? 800 : 500}
              fill={c}
            >
              {pt.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </text>
            <text
              x={f(x)}
              y={base + 37 * k}
              textAnchor="middle"
              fontSize={11 * k}
              fontWeight={on ? 700 : 400}
              fill={on ? c : "#7a93ab"}
            >
              {pt.date.getFullYear()}
            </text>
            {on && <circle cx={f(x)} cy={base + 49 * k} r={3 * k} fill={zc(z)} />}
          </g>
        );
      })}
    </svg>
  );
}
