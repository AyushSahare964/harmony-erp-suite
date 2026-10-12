import type { LucideIcon } from "lucide-react";
import type { DoseStatus } from "@/data/doctor/types";
import { parseDate } from "@/lib/doctor/dates";
import { dueState, fmtDate } from "@/lib/doctor/format";

interface StatusCardProps {
  icon: LucideIcon;
  title: "Vaccine" | "Deworming";
  dose: DoseStatus;
}

/** Look-only card: what was given last, when, when it is due next, and a coloured due tag. */
export function StatusCard({ icon: Icon, title, dose }: StatusCardProps) {
  const s = dueState(dose.due);
  return (
    <div className={`card s-card ${s.tone}`}>
      <div className="s-top">
        <span className="s-ico">
          <Icon strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="s-title">{title}</div>
        <span className={`chip ${s.tone}`}>{s.label}</span>
      </div>
      <div className="s-facts">
        <div>
          <span>{title === "Vaccine" ? "Vaccine taken" : "Medicine given"}</span>
          <b>{dose.name}</b>
        </div>
        <div>
          <span>Last given</span>
          <b>{fmtDate(parseDate(dose.last))}</b>
        </div>
        <div>
          <span>Next due</span>
          <b>{fmtDate(parseDate(dose.due))}</b>
        </div>
      </div>
    </div>
  );
}
