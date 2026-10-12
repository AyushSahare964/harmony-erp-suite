import { useEffect, useRef } from "react";
import type { Metric } from "@/lib/doctor/graphs";
import { ChartCard, type ChartSelection } from "./ChartCard";

interface BigViewProps {
  metric: Metric;
  selection: ChartSelection;
  onSelection: (s: ChartSelection) => void;
  onClose: () => void;
}

/** The same chart, large, in an overlay with a Full screen button. */
export function BigView({ metric, selection, onSelection, onClose }: BigViewProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const toggleFullScreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else layerRef.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div
      className="big-layer"
      ref={layerRef}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="big-box"
        role="dialog"
        aria-modal="true"
        aria-label={`${metric.name}, big graph`}
      >
        <ChartCard
          metric={metric}
          big
          selection={selection}
          onSelection={onSelection}
          onFullScreen={toggleFullScreen}
          onClose={close}
        />
      </div>
    </div>
  );
}
