import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { Pet, Section } from "@/data/doctor/types";
import { graphData } from "@/lib/doctor/graphs";
import { historyRecords, petHistory } from "@/lib/doctor/records";
import { SECTION_ICON } from "../shared/sectionIcons";
import { BillReceipt } from "../receipt/BillReceipt";
import { BigView } from "./BigView";
import type { ChartSelection } from "./ChartCard";
import { GraphPanel } from "./GraphPanel";
import { RecordCard } from "./RecordCard";

const NO_SELECTION: ChartSelection = { point: null, zone: null };

/** Full history page: records on the left (newest first), sticky graph report on the right. */
export function HistoryPage({ pet, section }: { pet: Pet; section: Section }) {
  const navigate = useNavigate();
  const page = useMemo(() => historyRecords(pet, section), [pet, section]);
  const graphs = useMemo(() => graphData(pet, section), [pet, section]);
  const invoices = useMemo(() => petHistory(pet).invoices, [pet]);
  const Icon = SECTION_ICON[section];

  const [metricKey, setMetricKey] = useState(graphs.def);
  const [selections, setSelections] = useState<Record<string, ChartSelection>>({});
  const [bigKey, setBigKey] = useState<string | null>(null);
  const [bill, setBill] = useState<string | null>(null);

  const selectionOf = (key: string) => selections[key] ?? NO_SELECTION;
  const setSelectionOf = (key: string) => (s: ChartSelection) =>
    setSelections((all) => ({ ...all, [key]: s }));
  const bigMetric = bigKey ? graphs.metrics.find((m) => m.key === bigKey) : undefined;

  // Esc goes back to the patient file (overlays and the picker catch Esc first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate({ to: "/patient/$id", params: { id: pet.id } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, pet.id]);

  return (
    <section className="detail" aria-label={`${pet.name}, ${page.title}`}>
      <div className="d-bar">
        <Link to="/patient/$id" params={{ id: pet.id }} className="p-back">
          <ArrowLeft strokeWidth={1.8} aria-hidden="true" /> Back to {pet.name}&apos;s file
        </Link>
        <nav className="d-crumbs" aria-label="Breadcrumb">
          <Link to="/" className="crumb">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/patient/$id" params={{ id: pet.id }} className="crumb">
            {pet.name}
          </Link>{" "}
          / <b>{page.title}</b>
        </nav>
      </div>

      <div className="d-title">
        <span className="s-ico">
          <Icon strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h2>
            {pet.name} · {page.title}
          </h2>
          <p>
            {page.records.length} records · every detail, newest first · graph report on the side
          </p>
        </div>
      </div>

      <div className="d-body">
        <div className="d-records">
          {page.records.map((r, i) => (
            <RecordCard key={i} record={r} onViewBill={setBill} />
          ))}
          <p className="sheet-note">
            Sample records for the design. Real records will come from VetOS.
          </p>
        </div>
        <GraphPanel
          data={graphs}
          metricKey={metricKey}
          onMetric={setMetricKey}
          selection={selectionOf(metricKey)}
          onSelection={setSelectionOf(metricKey)}
          onBigView={() => setBigKey(metricKey)}
        />
      </div>

      {bigMetric && (
        <BigView
          metric={bigMetric}
          selection={selectionOf(bigMetric.key)}
          onSelection={setSelectionOf(bigMetric.key)}
          onClose={() => setBigKey(null)}
        />
      )}
      {bill && invoices[bill] && (
        <BillReceipt
          pet={pet}
          invoiceNo={bill}
          invoice={invoices[bill]}
          onClose={() => setBill(null)}
        />
      )}
    </section>
  );
}
