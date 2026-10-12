import type { ReactNode } from "react";
import { Maximize2, TrendingDown, TrendingUp, X } from "lucide-react";
import { fmtDate } from "@/lib/doctor/format";
import {
  ZONE_HEAD,
  ZONE_TEXT,
  ZONE_WORD,
  sortedPoints,
  valFmt,
  valUnit,
  zonesFor,
  type Metric,
  type Zone,
} from "@/lib/doctor/graphs";
import { LineChart } from "./LineChart";

export interface ChartSelection {
  /** Index of the chosen dot; null = newest. */
  point: number | null;
  /** Colour chip whose reasons are listed; null = none. */
  zone: Zone | null;
}

interface ChartCardProps {
  metric: Metric;
  big?: boolean;
  selection: ChartSelection;
  onSelection: (s: ChartSelection) => void;
  onBigView?: () => void;
  onFullScreen?: () => void;
  onClose?: () => void;
}

/** One graph: big readout, change pill, legend chips, the chart, and reasons for a chosen colour. */
export function ChartCard({
  metric: m,
  big = false,
  selection,
  onSelection,
  onBigView,
  onFullScreen,
  onClose,
}: ChartCardProps) {
  const pts = sortedPoints(m.points);
  const zs = zonesFor(m, pts);
  const hasZones = zs.some((x) => x.z);
  const selZ = hasZones ? selection.zone : null;
  const selI = selection.point != null && pts[selection.point] ? selection.point : pts.length - 1;
  const q = pts[selI]!;
  const z = zs[selI]?.z ?? null;
  const prev = selI > 0 ? pts[selI - 1]! : null;
  const count = { g: 0, y: 0, r: 0 };
  zs.forEach((x) => x.z && count[x.z]++);

  const pickPoint = (i: number) =>
    onSelection({ ...selection, point: selection.point === i ? null : i });
  const pickZone = (c: Zone) =>
    onSelection({ ...selection, zone: selection.zone === c ? null : c });

  let pill: ReactNode = "First record";
  if (m.special) pill = q.text;
  else if (prev) {
    const up = q.v >= prev.v;
    const Arrow = up ? TrendingUp : TrendingDown;
    pill = (
      <>
        <Arrow aria-hidden="true" />
        {up ? "+" : "−"}
        {valFmt(m, Math.abs(q.v - prev.v))}
        {m.unit && !m.fmt ? ` ${m.unit}` : ""} since the last one
      </>
    );
  }

  return (
    <div className={`g-chart${big ? " big" : ""}`}>
      <div className="gc-top">
        <div className="gc-main">
          <div className="gc-name">{m.name}</div>
          <div className="gc-big">
            {m.special ? (
              <span style={{ color: ZONE_TEXT[z ?? "g"] }}>{ZONE_WORD[z ?? "g"]}</span>
            ) : (
              <>
                {valFmt(m, q.v)}
                {m.unit && !m.fmt && <small>{m.unit}</small>}
              </>
            )}
          </div>
          <div className="gc-meta">
            <div className="gc-pill">{pill}</div>
            <div className="gc-date">
              {fmtDate(q.date)} · {q.sub}
            </div>
          </div>
        </div>
        <div className="gc-side">
          {z && <span className={`chip zc-${z}`}>{ZONE_WORD[z]}</span>}
          {big ? (
            <>
              <button className="g-icon" type="button" onClick={onFullScreen}>
                <Maximize2 aria-hidden="true" /> Full screen
              </button>
              <button className="g-icon" type="button" onClick={onClose}>
                <X aria-hidden="true" /> Close
              </button>
            </>
          ) : (
            <button className="g-icon" type="button" onClick={onBigView}>
              <Maximize2 aria-hidden="true" /> Big view
            </button>
          )}
        </div>
      </div>

      {hasZones && (
        <div className="zlegend">
          {(["g", "y", "r"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`zchip z-${c}${selZ === c ? " on" : ""}`}
              aria-pressed={selZ === c}
              onClick={() => pickZone(c)}
            >
              <i />
              {ZONE_WORD[c]} <b>{count[c]}</b>
            </button>
          ))}
          <span className="zhint">Tap a colour to see why</span>
        </div>
      )}

      <LineChart
        metric={m}
        points={pts}
        zones={zs}
        big={big}
        selected={selI}
        selectedZone={selZ}
        onSelect={pickPoint}
      />
      <p className="g-tip">Tap any dot to see that day.</p>

      {selZ && (
        <div className={`g-why zc-${selZ}`}>
          <h5>{ZONE_HEAD[selZ]}</h5>
          {zs.some((x) => x.z === selZ) ? (
            <ul>
              {pts.map((pt, i) =>
                zs[i]?.z === selZ ? (
                  <li key={i}>
                    <b>{fmtDate(pt.date)}</b>
                    {m.special ? "" : ` · ${valUnit(m, pt.v, pt)}`}
                    <span>{zs[i]?.why}</span>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <p>No readings in this colour.</p>
          )}
        </div>
      )}
    </div>
  );
}
