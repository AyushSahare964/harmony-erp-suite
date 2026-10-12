import { Fragment, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { GraphData } from "@/lib/doctor/graphs";
import { ChartCard, type ChartSelection } from "./ChartCard";

interface GraphPanelProps {
  data: GraphData;
  metricKey: string;
  onMetric: (key: string) => void;
  selection: ChartSelection;
  onSelection: (s: ChartSelection) => void;
  onBigView: () => void;
}

/** Sticky "Graph report" panel: single-select picker (one graph at a time) and the chosen chart. */
export function GraphPanel({
  data,
  metricKey,
  onMetric,
  selection,
  onSelection,
  onBigView,
}: GraphPanelProps) {
  const [open, setOpen] = useState(false);
  const pickRef = useRef<HTMLDivElement>(null);
  const m = data.metrics.find((x) => x.key === metricKey) ?? data.metrics[0]!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!pickRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <aside className="card g-panel" aria-label="Graph report">
      <div className="g-head">
        <h3>{data.title}</h3>
      </div>
      <div className="g-pick" ref={pickRef}>
        <button
          className="g-btn"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span>
            {m.name}
            {m.hint && <small> · {m.hint}</small>}
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
        {open && (
          <div className="g-menu" role="listbox" aria-label="Choose a graph">
            {data.metrics.map((x) => (
              <Fragment key={x.key}>
                <button
                  type="button"
                  role="option"
                  className="g-opt"
                  aria-selected={x.key === m.key}
                  onClick={() => {
                    onMetric(x.key);
                    setOpen(false);
                  }}
                >
                  <span className="chk">{x.key === m.key && <Check aria-hidden="true" />}</span>
                  {x.name}
                  <small>{x.hint ?? x.unit}</small>
                </button>
                {x.special && <div className="g-sep" />}
              </Fragment>
            ))}
          </div>
        )}
      </div>
      <div className="g-charts">
        <ChartCard
          metric={m}
          selection={selection}
          onSelection={onSelection}
          onBigView={onBigView}
        />
      </div>
    </aside>
  );
}
