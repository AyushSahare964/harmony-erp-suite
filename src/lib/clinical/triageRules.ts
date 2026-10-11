import { findSymptom, normalizeSymptom } from "./symptomSearch";
import type { Species, Triage } from "./symptomTypes";

export const TRIAGE_LABEL: Record<Triage, string> = {
  E: "Emergency",
  C: "Critical / Urgent",
  N: "Routine if stable",
};

// From the "Action / escalation rule" column of VetOS_Symptom_Triage_Master.xlsx
export const TRIAGE_ACTION: Record<Triage, string> = {
  E: "Immediate veterinary triage; alert clinician now. Do not leave in routine queue.",
  C: "Prompt assessment, generally same day or sooner; escalate immediately if unstable or worsening.",
  N: "Routine only if mild and stable with no red flags. Upgrade for sudden onset, severe/persistent signs, pain, weakness or abnormal vital signs.",
};

/** Doctor-typed symptom that isn't in the catalogue, with the triage level the doctor chose. */
export interface ManualSymptom { label: string; triage: Triage }

export interface TriageContext {
  species?: Species | undefined;
  ageMonths?: number | undefined; // total months, if known
  manual?: ManualSymptom[] | undefined;
}

export interface TriageResult {
  level: Triage;
  reasons: string[];
  /** labels that drove an E result */
  emergencyLabels: string[];
}

const RANK: Record<Triage, number> = { N: 0, C: 1, E: 2 };
const URINARY_OBSTRUCTION = [
  "straining to urinate", "unproductive attempts to urinate", "repeated attempts to urinate",
  "no urine observed", "straining in litter tray", "suspected urinary blockage",
];
const EXOTIC: Species[] = ["bird", "rabbit", "smallMammal", "reptile"];
const APPETITE_ACTIVITY = ["reduced appetite", "loss of appetite", "food refusal", "reduced activity", "lethargy"];

export function symptomTriage(label: string, manual: ManualSymptom[] = []): Triage {
  const m = manual.find((x) => normalizeSymptom(x.label) === normalizeSymptom(label));
  return m?.triage ?? findSymptom(label)?.triage ?? "N";
}

/** Pure: catalogue triage + the clinical overrides the triage legend calls for. */
export function computeTriage(tags: string[], ctx: TriageContext = {}): TriageResult {
  const levels = tags.map((t) => ({ t, n: normalizeSymptom(t), l: symptomTriage(t, ctx.manual) }));
  let level: Triage = levels.reduce<Triage>((acc, x) => (RANK[x.l] > RANK[acc] ? x.l : acc), "N");
  const reasons: string[] = [];
  const raise = (to: Triage, why: string) => {
    if (RANK[to] > RANK[level]) level = to;
    reasons.push(why);
  };

  if (ctx.species === "cat" && levels.some((x) => URINARY_OBSTRUCTION.includes(x.n))) {
    raise("E", "Cat straining to urinate with little/no urine: possible urethral obstruction (most urgent in male cats).");
  }
  if (ctx.ageMonths !== undefined && ctx.ageMonths < 2 && level === "C") {
    raise("E", "Neonate/very young patient with an urgent symptom: treat as emergency.");
  }
  if (
    ctx.species && EXOTIC.includes(ctx.species) && level === "N" && levels.length >= 2 &&
    levels.some((x) => APPETITE_ACTIVITY.some((k) => x.n.includes(k)))
  ) {
    raise("C", "Exotic species with reduced appetite/activity can deteriorate quickly: prompt assessment.");
  }
  if (levels.filter((x) => x.l === "C").length >= 3 && level === "C") {
    reasons.push("Three or more urgent symptoms together: review for escalation.");
  }

  const emergencyLabels = levels.filter((x) => x.l === "E").map((x) => x.t);
  return { level, reasons, emergencyLabels };
}
