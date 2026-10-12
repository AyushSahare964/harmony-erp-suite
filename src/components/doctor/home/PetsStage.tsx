import { clinic } from "@/data/doctor/clinic";
import { runningMessages } from "./messages";
import { RunningScreen } from "./RunningScreen";

/**
 * Kitten at bottom left holding board's top-left corner:
 * Tail layer BEHIND the board, body layer IN FRONT.
 * Head and paws stay still; tail swishes and body sways gently.
 */
export function PetsStage() {
  return (
    <section className="stage vd-stage" aria-label="Good news from VetOS">
      <div className="kitten" aria-hidden="true">
        <div className="k-sway">
          <i className="k-tail" />
        </div>
      </div>
      <RunningScreen messages={runningMessages(clinic.stats)} />
      <div className="kitten" aria-hidden="true">
        <div className="k-sway">
          <i className="k-body" />
        </div>
      </div>
    </section>
  );
}
