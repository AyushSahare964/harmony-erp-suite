import { useMemo, useState } from "react";

interface Props {
  saleAmount?: number;
  purchaseAmount?: number;
  className?: string;
}

export function Distribution3DChart({
  saleAmount = 0,
  purchaseAmount = 0,
  className = "",
}: Props) {
  const [hoveredSlice, setHoveredSlice] = useState<"sale" | "purchase" | null>(null);

  const total = (saleAmount || 0) + (purchaseAmount || 0);
  const hasData = total > 0;

  const { salePct, purchasePct } = useMemo(() => {
    if (!hasData) return { salePct: 0, purchasePct: 0 };
    if (purchaseAmount <= 0) return { salePct: 100, purchasePct: 0 };
    if (saleAmount <= 0) return { salePct: 0, purchasePct: 100 };
    const s = Math.round((saleAmount / total) * 100);
    return { salePct: s, purchasePct: 100 - s };
  }, [saleAmount, purchaseAmount, total, hasData]);

  // Geometry calculations for 3D Isometric / Tilted Donut
  const cx = 150;
  const cy = 72;
  const rx = 88;
  const ry = 40;
  const irx = 38;
  const iry = 17;
  const depth = 13;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Parametric helpers
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

  // Radial slice cut wall
  const makeCutWallPath = (deg: number) => {
    const pTopOuter = getOuterPoint(deg, 0);
    const pTopInner = getInnerPoint(deg, 0);
    const pBotInner = getInnerPoint(deg, depth);
    const pBotOuter = getOuterPoint(deg, depth);
    return `M ${pTopOuter.x} ${pTopOuter.y} L ${pTopInner.x} ${pTopInner.y} L ${pBotInner.x} ${pBotInner.y} L ${pBotOuter.x} ${pBotOuter.y} Z`;
  };

  // Angles for split
  const purchaseAngleSpan = hasData ? (purchasePct / 100) * 360 : 0;
  const startAngleDeg = 320 - purchaseAngleSpan / 2;
  const endAngleDeg = startAngleDeg + purchaseAngleSpan;

  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 300 160"
        className="w-full max-w-[270px] h-auto select-none"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Ground Drop Shadow */}
          <radialGradient id="donutGroundShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* Neutral Empty State Gradients */}
          <linearGradient id="neutralTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="neutralSideGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Sale Top Gradient */}
          <linearGradient id="saleTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="60%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          {/* Sale Side Wall Gradient */}
          <linearGradient id="saleSideGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>

          {/* Purchase Top Gradient */}
          <linearGradient id="purchaseTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Purchase Side Wall Gradient */}
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

        {/* ── 1. GROUND DROP SHADOW ── */}
        <ellipse
          cx={cx}
          cy={cy + depth + 10}
          rx={rx + 8}
          ry={ry + 6}
          fill="url(#donutGroundShadow)"
        />

        {/* ── 2. CASE A: NO DATA IN LAST 30 DAYS ── */}
        {!hasData && (
          <g>
            {/* Inner hole back wall */}
            <path
              d={`M ${getInnerPoint(180, 0).x} ${getInnerPoint(180, 0).y} 
                  A ${irx} ${iry} 0 0 1 ${getInnerPoint(360, 0).x} ${getInnerPoint(360, 0).y} 
                  L ${getInnerPoint(360, depth).x} ${getInnerPoint(360, depth).y} 
                  A ${irx} ${iry} 0 0 0 ${getInnerPoint(180, depth).x} ${getInnerPoint(180, depth).y} Z`}
              fill="#1e293b"
              opacity={0.8}
            />
            {/* Full front outer rim wall */}
            <path
              d={`M ${getOuterPoint(0, 0).x} ${getOuterPoint(0, 0).y} 
                  A ${rx} ${ry} 0 0 1 ${getOuterPoint(180, 0).x} ${getOuterPoint(180, 0).y} 
                  L ${getOuterPoint(180, depth).x} ${getOuterPoint(180, depth).y} 
                  A ${rx} ${ry} 0 0 0 ${getOuterPoint(0, depth).x} ${getOuterPoint(0, depth).y} Z`}
              fill="url(#neutralSideGrad)"
            />
            {/* Full top donut face */}
            <path
              d={`M ${getOuterPoint(0).x} ${getOuterPoint(0).y}
                  A ${rx} ${ry} 0 1 1 ${getOuterPoint(180).x} ${getOuterPoint(180).y}
                  A ${rx} ${ry} 0 1 1 ${getOuterPoint(0).x} ${getOuterPoint(0).y}
                  M ${getInnerPoint(0).x} ${getInnerPoint(0).y}
                  A ${irx} ${iry} 0 1 0 ${getInnerPoint(180).x} ${getInnerPoint(180).y}
                  A ${irx} ${iry} 0 1 0 ${getInnerPoint(0).x} ${getInnerPoint(0).y} Z`}
              fill="url(#neutralTopGrad)"
              stroke="#475569"
              strokeWidth="0.75"
              fillRule="evenodd"
            />
            <text
              x={cx}
              y={cy + 3}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              className="font-sans font-bold text-[11px] pointer-events-none select-none"
            >
              ₹0 in 30 Days
            </text>
          </g>
        )}

        {/* ── 3. CASE B: HAS REAL TRANSACTIONS ── */}
        {hasData && (
          <g>
            {/* Inner hole back wall */}
            <path
              d={`M ${getInnerPoint(180, 0).x} ${getInnerPoint(180, 0).y} 
                  A ${irx} ${iry} 0 0 1 ${getInnerPoint(360, 0).x} ${getInnerPoint(360, 0).y} 
                  L ${getInnerPoint(360, depth).x} ${getInnerPoint(360, depth).y} 
                  A ${irx} ${iry} 0 0 0 ${getInnerPoint(180, depth).x} ${getInnerPoint(180, depth).y} Z`}
              fill="#172554"
              opacity={0.88}
            />

            {/* Outer front cylinder wall (0 to 180 deg) */}
            <path
              d={`M ${getOuterPoint(0, 0).x} ${getOuterPoint(0, 0).y} 
                  A ${rx} ${ry} 0 0 1 ${getOuterPoint(180, 0).x} ${getOuterPoint(180, 0).y} 
                  L ${getOuterPoint(180, depth).x} ${getOuterPoint(180, depth).y} 
                  A ${rx} ${ry} 0 0 0 ${getOuterPoint(0, depth).x} ${getOuterPoint(0, depth).y} Z`}
              fill={salePct === 0 ? "url(#purchaseSideGrad)" : "url(#saleSideGrad)"}
            />

            {/* If Purchase has a slice in the front half (0 to 180 deg) */}
            {purchasePct > 0 && purchasePct < 100 && endAngleDeg > 0 && (
              <path
                d={`M ${getOuterPoint(0, 0).x} ${getOuterPoint(0, 0).y} 
                    A ${rx} ${ry} 0 0 1 ${getOuterPoint(Math.min(endAngleDeg, 180), 0).x} ${getOuterPoint(Math.min(endAngleDeg, 180), 0).y} 
                    L ${getOuterPoint(Math.min(endAngleDeg, 180), depth).x} ${getOuterPoint(Math.min(endAngleDeg, 180), depth).y} 
                    A ${rx} ${ry} 0 0 0 ${getOuterPoint(0, depth).x} ${getOuterPoint(0, depth).y} Z`}
                fill="url(#purchaseSideGrad)"
              />
            )}

            {/* Cut face wall where purchase meets sale */}
            {purchasePct > 0 && purchasePct < 100 && (
              <path
                d={makeCutWallPath(endAngleDeg)}
                fill="url(#purchaseCutGrad)"
                opacity={0.95}
              />
            )}

            {/* TOP SURFACES */}
            {/* If 100% Sale */}
            {salePct === 100 && (
              <path
                d={`M ${getOuterPoint(0).x} ${getOuterPoint(0).y}
                    A ${rx} ${ry} 0 1 1 ${getOuterPoint(180).x} ${getOuterPoint(180).y}
                    A ${rx} ${ry} 0 1 1 ${getOuterPoint(0).x} ${getOuterPoint(0).y}
                    M ${getInnerPoint(0).x} ${getInnerPoint(0).y}
                    A ${irx} ${iry} 0 1 0 ${getInnerPoint(180).x} ${getInnerPoint(180).y}
                    A ${irx} ${iry} 0 1 0 ${getInnerPoint(0).x} ${getInnerPoint(0).y} Z`}
                fill="url(#saleTopGrad)"
                stroke="#1d4ed8"
                strokeWidth="0.75"
                fillRule="evenodd"
                className="cursor-pointer transition-all hover:brightness-105"
                onMouseEnter={() => setHoveredSlice("sale")}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <title>{`Sale: ₹${saleAmount.toLocaleString("en-IN")} (100%)`}</title>
              </path>
            )}

            {/* If 100% Purchase */}
            {purchasePct === 100 && (
              <path
                d={`M ${getOuterPoint(0).x} ${getOuterPoint(0).y}
                    A ${rx} ${ry} 0 1 1 ${getOuterPoint(180).x} ${getOuterPoint(180).y}
                    A ${rx} ${ry} 0 1 1 ${getOuterPoint(0).x} ${getOuterPoint(0).y}
                    M ${getInnerPoint(0).x} ${getInnerPoint(0).y}
                    A ${irx} ${iry} 0 1 0 ${getInnerPoint(180).x} ${getInnerPoint(180).y}
                    A ${irx} ${iry} 0 1 0 ${getInnerPoint(0).x} ${getInnerPoint(0).y} Z`}
                fill="url(#purchaseTopGrad)"
                stroke="#d97706"
                strokeWidth="0.75"
                fillRule="evenodd"
                className="cursor-pointer transition-all hover:brightness-105"
                onMouseEnter={() => setHoveredSlice("purchase")}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <title>{`Purchase: ₹${purchaseAmount.toLocaleString("en-IN")} (100%)`}</title>
              </path>
            )}

            {/* If Split Between Sale & Purchase */}
            {salePct > 0 && purchasePct > 0 && (
              <>
                {/* Sale Sector */}
                <path
                  d={makeDonutTopPath(endAngleDeg, startAngleDeg + 360)}
                  fill="url(#saleTopGrad)"
                  stroke="#1d4ed8"
                  strokeWidth="0.75"
                  className="cursor-pointer transition-all hover:brightness-105"
                  onMouseEnter={() => setHoveredSlice("sale")}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  <title>{`Sale: ₹${saleAmount.toLocaleString("en-IN")} (${salePct}%)`}</title>
                </path>

                {/* Purchase Sector */}
                <path
                  d={makeDonutTopPath(startAngleDeg, endAngleDeg)}
                  fill="url(#purchaseTopGrad)"
                  stroke="#d97706"
                  strokeWidth="0.75"
                  className="cursor-pointer transition-all hover:brightness-105"
                  onMouseEnter={() => setHoveredSlice("purchase")}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  <title>{`Purchase: ₹${purchaseAmount.toLocaleString("en-IN")} (${purchasePct}%)`}</title>
                </path>
              </>
            )}

            {/* Text Labels on Donut */}
            {salePct >= 20 && (
              <text
                x={cx - rx * 0.6}
                y={cy + 3}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                className="font-sans font-bold text-[11px] pointer-events-none select-none drop-shadow-xs"
              >
                Sale {salePct}%
              </text>
            )}

            {purchasePct >= 20 && (
              <text
                x={cx + rx * 0.52}
                y={cy - ry * 0.15}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                className="font-sans font-bold text-[11px] pointer-events-none select-none drop-shadow-xs"
              >
                Buy {purchasePct}%
              </text>
            )}
          </g>
        )}

        {/* Inner hole highlight ring */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={irx}
          ry={iry}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.4"
          strokeWidth="0.75"
        />
      </svg>

      {/* Numerical Figures Breakdown beneath chart */}
      <div className="w-full pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#2563eb]" />
          <span className="text-muted-foreground">Sale:</span>
          <span className="font-bold text-foreground">₹{saleAmount.toLocaleString("en-IN")}</span>
          <span className="text-muted-foreground text-[10px]">({hasData ? `${salePct}%` : "0%"})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#f59e0b]" />
          <span className="text-muted-foreground">Purchase:</span>
          <span className="font-bold text-foreground">₹{purchaseAmount.toLocaleString("en-IN")}</span>
          <span className="text-muted-foreground text-[10px]">({hasData ? `${purchasePct}%` : "0%"})</span>
        </div>
      </div>
    </div>
  );
}
