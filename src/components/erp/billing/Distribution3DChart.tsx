import { useMemo, useState } from "react";

interface Props {
  saleAmount?: number;
  purchaseAmount?: number;
  className?: string;
}

export function Distribution3DChart({
  saleAmount = 780,
  purchaseAmount = 260,
  className = "",
}: Props) {
  const [hoveredSlice, setHoveredSlice] = useState<"sale" | "purchase" | null>(null);

  const { salePct, purchasePct } = useMemo(() => {
    const total = (saleAmount || 0) + (purchaseAmount || 0);
    if (total <= 0) return { salePct: 75, purchasePct: 25 };
    const s = Math.round(((saleAmount || 0) / total) * 100);
    const p = 100 - s;
    return { salePct: Math.max(15, Math.min(85, s)), purchasePct: Math.max(15, Math.min(85, p)) };
  }, [saleAmount, purchaseAmount]);

  // Geometry calculations for 3D Isometric / Tilted Donut
  // Center & Radii
  const cx = 150;
  const cy = 110;
  const rx = 100;
  const ry = 52;
  const irx = 42;
  const iry = 22;
  const depth = 16;

  // Split angle: Purchase starts at ~315 deg (-45) and sweeps purchasePct * 3.6 deg
  const purchaseAngleSpan = (purchasePct / 100) * 360;
  const startAngleDeg = 320 - purchaseAngleSpan / 2; // centered around ~340 deg (top right)
  const endAngleDeg = startAngleDeg + purchaseAngleSpan;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Parametric helper for outer & inner ellipse points
  const getOuterPoint = (deg: number, yOffset = 0) => ({
    x: cx + rx * Math.cos(toRad(deg)),
    y: cy + ry * Math.sin(toRad(deg)) + yOffset,
  });

  const getInnerPoint = (deg: number, yOffset = 0) => ({
    x: cx + irx * Math.cos(toRad(deg)),
    y: cy + iry * Math.sin(toRad(deg)) + yOffset,
  });

  // SVG Elliptical Arc Path Builder
  const makeDonutTopPath = (startDeg: number, endDeg: number) => {
    const p1 = getOuterPoint(startDeg);
    const p2 = getOuterPoint(endDeg);
    const ip2 = getInnerPoint(endDeg);
    const ip1 = getInnerPoint(startDeg);
    const span = (endDeg - startDeg + 360) % 360;
    const largeArc = span > 180 ? 1 : 0;

    return `M ${p1.x} ${p1.y} A ${rx} ${ry} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${ip2.x} ${ip2.y} A ${irx} ${iry} 0 ${largeArc} 0 ${ip1.x} ${ip1.y} Z`;
  };

  // Outer 3D Extruded Cylinder Wall (visible in front half: 0 to 180 deg)
  const makeOuterWallPath = (startDeg: number, endDeg: number) => {
    const s = Math.max(0, Math.min(180, startDeg));
    const e = Math.max(0, Math.min(180, endDeg));
    if (s >= e) return "";

    const pTopStart = getOuterPoint(s, 0);
    const pTopEnd = getOuterPoint(e, 0);
    const pBotEnd = getOuterPoint(e, depth);
    const pBotStart = getOuterPoint(s, depth);
    const largeArc = e - s > 180 ? 1 : 0;

    return `M ${pTopStart.x} ${pTopStart.y} A ${rx} ${ry} 0 ${largeArc} 1 ${pTopEnd.x} ${pTopEnd.y} L ${pBotEnd.x} ${pBotEnd.y} A ${rx} ${ry} 0 ${largeArc} 0 ${pBotStart.x} ${pBotStart.y} Z`;
  };

  // Inner 3D Hole Cylinder Wall (visible in back-upper half of the cutout: 180 to 360 deg)
  const makeInnerWallPath = (startDeg: number, endDeg: number) => {
    const s = Math.max(180, Math.min(360, startDeg));
    const e = Math.max(180, Math.min(360, endDeg));
    if (s >= e) return "";

    const pTopStart = getInnerPoint(s, 0);
    const pTopEnd = getInnerPoint(e, 0);
    const pBotEnd = getInnerPoint(e, depth);
    const pBotStart = getInnerPoint(s, depth);
    const largeArc = e - s > 180 ? 1 : 0;

    return `M ${pTopStart.x} ${pTopStart.y} A ${irx} ${iry} 0 ${largeArc} 1 ${pTopEnd.x} ${pTopEnd.y} L ${pBotEnd.x} ${pBotEnd.y} A ${irx} ${iry} 0 ${largeArc} 0 ${pBotStart.x} ${pBotStart.y} Z`;
  };

  // Radial slice cut wall (between Sale & Purchase at startAngleDeg and endAngleDeg)
  const makeCutWallPath = (deg: number) => {
    const pTopOuter = getOuterPoint(deg, 0);
    const pTopInner = getInnerPoint(deg, 0);
    const pBotInner = getInnerPoint(deg, depth);
    const pBotOuter = getOuterPoint(deg, depth);
    return `M ${pTopOuter.x} ${pTopOuter.y} L ${pTopInner.x} ${pTopInner.y} L ${pBotInner.x} ${pBotInner.y} L ${pBotOuter.x} ${pBotOuter.y} Z`;
  };


  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 300 205"
        className="w-full max-w-[290px] h-auto drop-shadow-xs select-none"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Subtle Drop Shadow for entire 3D cylinder */}
          <radialGradient id="donutGroundShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* Sale Top Gradient (Rich blue matching screenshot) */}
          <linearGradient id="saleTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="60%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          {/* Sale Side Wall Gradient (Darker blue 3D shadow) */}
          <linearGradient id="saleSideGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>

          {/* Sale Inner Cutout Hole Shadow */}
          <linearGradient id="saleInnerWallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Purchase Top Gradient (Warm amber/orange matching screenshot) */}
          <linearGradient id="purchaseTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Purchase Side Wall Gradient (Darker amber 3D shadow) */}
          <linearGradient id="purchaseSideGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Purchase Cut Face Wall */}
          <linearGradient id="purchaseCutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#92400e" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        {/* ── 1. GROUND DROP SHADOW UNDER 3D DONUT ── */}
        <ellipse
          cx={cx + 2}
          cy={cy + depth + 14}
          rx={rx + 10}
          ry={ry + 8}
          fill="url(#donutGroundShadow)"
        />

        {/* ── 2. INNER HOLE 3D CYLINDER WALL (Back rim of hole) ── */}
        <path
          d={`M ${getInnerPoint(180, 0).x} ${getInnerPoint(180, 0).y} 
              A ${irx} ${iry} 0 0 1 ${getInnerPoint(360, 0).x} ${getInnerPoint(360, 0).y} 
              L ${getInnerPoint(360, depth).x} ${getInnerPoint(360, depth).y} 
              A ${irx} ${iry} 0 0 0 ${getInnerPoint(180, depth).x} ${getInnerPoint(180, depth).y} Z`}
          fill="#172554"
          opacity={0.88}
        />

        {/* ── 3. 3D SIDE WALLS (Extruded Cylinder Depth) ── */}
        {/* Full front outer rim wall (0 deg to 180 deg) */}
        <path
          d={`M ${getOuterPoint(0, 0).x} ${getOuterPoint(0, 0).y} 
              A ${rx} ${ry} 0 0 1 ${getOuterPoint(180, 0).x} ${getOuterPoint(180, 0).y} 
              L ${getOuterPoint(180, depth).x} ${getOuterPoint(180, depth).y} 
              A ${rx} ${ry} 0 0 0 ${getOuterPoint(0, depth).x} ${getOuterPoint(0, depth).y} Z`}
          fill="url(#saleSideGrad)"
          className="transition-opacity hover:opacity-90"
        />

        {/* Orange front side wall segment for Purchase wedge (from 0 to endAngleDeg) */}
        {endAngleDeg > 0 && (
          <path
            d={`M ${getOuterPoint(0, 0).x} ${getOuterPoint(0, 0).y} 
                A ${rx} ${ry} 0 0 1 ${getOuterPoint(Math.min(endAngleDeg, 180), 0).x} ${getOuterPoint(Math.min(endAngleDeg, 180), 0).y} 
                L ${getOuterPoint(Math.min(endAngleDeg, 180), depth).x} ${getOuterPoint(Math.min(endAngleDeg, 180), depth).y} 
                A ${rx} ${ry} 0 0 0 ${getOuterPoint(0, depth).x} ${getOuterPoint(0, depth).y} Z`}
            fill="url(#purchaseSideGrad)"
          />
        )}

        {/* 3D Wedge Cut Wall at endAngleDeg (shows thickness where orange meets blue) */}
        <path
          d={makeCutWallPath(endAngleDeg)}
          fill="url(#purchaseCutGrad)"
          opacity={0.95}
        />

        {/* ── 4. TOP SURFACES ── */}
        {/* Top Surface: SALE Sector (Blue) */}
        <path
          d={makeDonutTopPath(endAngleDeg, startAngleDeg + 360)}
          fill="url(#saleTopGrad)"
          stroke="#1d4ed8"
          strokeWidth="0.75"
          className="cursor-pointer transition-all hover:brightness-105"
          onMouseEnter={() => setHoveredSlice("sale")}
          onMouseLeave={() => setHoveredSlice(null)}
        >
          <title>{`Sale: ₹${(saleAmount || 780).toLocaleString("en-IN")} (${salePct}%)`}</title>
        </path>

        {/* Top Surface: PURCHASE Sector (Orange / Amber) */}
        <path
          d={makeDonutTopPath(startAngleDeg, endAngleDeg)}
          fill="url(#purchaseTopGrad)"
          stroke="#d97706"
          strokeWidth="0.75"
          className="cursor-pointer transition-all hover:brightness-105"
          onMouseEnter={() => setHoveredSlice("purchase")}
          onMouseLeave={() => setHoveredSlice(null)}
        >
          <title>{`Purchase: ₹${(purchaseAmount || 260).toLocaleString("en-IN")} (${purchasePct}%)`}</title>
        </path>

        {/* ── 5. DIRECT TEXT LABELS (Matching Screenshot Exactly) ── */}
        {/* "Sale" label placed on the left side of the blue ring */}
        <text
          x={cx - rx * 0.65}
          y={cy + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0f172a"
          className="font-sans font-bold text-[13px] pointer-events-none select-none"
          style={{ letterSpacing: "-0.2px" }}
        >
          Sale
        </text>

        {/* "Purchase" label placed right on the orange wedge */}
        <text
          x={cx + rx * 0.52}
          y={cy - ry * 0.12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0f172a"
          className="font-sans font-bold text-[11px] pointer-events-none select-none"
          style={{ letterSpacing: "-0.2px" }}
        >
          Purchase
        </text>

        {/* Inner hole subtle highlight ring */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={irx}
          ry={iry}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="0.75"
        />
      </svg>

      {/* Hover Info Tooltip */}
      {hoveredSlice && (
        <div className="mt-1 px-3 py-0.5 rounded-full bg-muted/80 text-[11px] font-mono font-bold text-foreground border border-border shadow-xs animate-in fade-in duration-150">
          {hoveredSlice === "sale" ? (
            <span className="text-blue-600 dark:text-blue-400">
              Sale: ₹{(saleAmount || 780).toLocaleString("en-IN")} ({salePct}%)
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              Purchase: ₹{(purchaseAmount || 260).toLocaleString("en-IN")} ({purchasePct}%)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
