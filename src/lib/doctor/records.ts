// Builds the record cards for each history page from the sample data.
import {
  DEWORM_BILLS,
  LAB_PARAMS,
  LAB_REPORTS,
  MEDICAL_RECORDS,
  PURCHASE_INVOICES,
  VACCINE_BILLS,
  dewormDoses,
  invoiceTotal,
  invoicesFor,
  labFlag,
  vaccineDoses,
  type Field,
  type Invoice,
} from "@/data/doctor/history";
import type { Pet, Section } from "@/data/doctor/types";
import { parseDate } from "./dates";
import { dueState, fmtDate, rupee, type Tone } from "./format";

export interface HistoryRecord {
  date: Date;
  title: string;
  bill?: string | undefined;
  tag: string;
  tone: Tone;
  fields: Field[];
  table?: { cols: string[]; rows: string[][] };
  note?: string;
}

export interface HistoryPageData {
  title: string;
  records: HistoryRecord[];
}

export const SECTION_TITLES: Record<Section, string> = {
  medical: "Medical",
  lab: "Laboratory",
  purchase: "Purchase",
  vaccine: "Vaccine history",
  deworm: "Deworming history",
};

/** Pet-specific sample data shared by records, graphs and the bill receipt. */
export function petHistory(p: Pet) {
  const vLast = parseDate(p.vaccine.last);
  const wLast = parseDate(p.deworm.last);
  return {
    vLast,
    wLast,
    invoices: invoicesFor(p, vLast, wLast) as Record<string, Invoice>,
    vaccines: vaccineDoses(p, vLast, fmtDate(parseDate(p.vaccine.due))),
    deworms: dewormDoses(wLast),
  };
}

const F = (label: string, value: string, wide = false): Field => [label, value, wide];

export function historyRecords(p: Pet, section: Section): HistoryPageData {
  const h = petHistory(p);
  const title = SECTION_TITLES[section];

  if (section === "medical") return { title, records: MEDICAL_RECORDS };

  if (section === "lab")
    return {
      title,
      records: LAB_REPORTS.map((r) => {
        const bad = LAB_PARAMS.filter((pm, i) => labFlag(pm, r.values[i] ?? 0) !== "Normal").length;
        return {
          date: r.date,
          title: r.title,
          bill: r.bill,
          tag: bad ? `${bad} value${bad > 1 ? "s" : ""} out of range` : "All normal",
          tone: bad ? "late" : "ok",
          fields: [
            F("Requested by", r.by),
            F("Sample", "Blood (EDTA and serum tubes)"),
            F("Collected", `${fmtDate(r.date)}, ${r.collected}`),
            F("Lab technician", r.tech),
            F("Report ready", `${fmtDate(r.date)}, ${r.ready}`),
            F("Report status", "Final"),
            F("Cost", `${r.cost} (${r.bill})`),
          ],
          table: {
            cols: ["Test", "Result", "Normal range", "Flag"],
            rows: LAB_PARAMS.map((pm, i) => {
              const v = r.values[i] ?? 0;
              return [pm.name, `${v} ${pm.unit}`, `${pm.lo} to ${pm.hi}`, labFlag(pm, v)];
            }),
          },
          note: `Remarks: ${r.note}`,
        };
      }),
    };

  if (section === "purchase")
    return {
      title,
      records: PURCHASE_INVOICES.map((no) => {
        const v = h.invoices[no]!;
        return {
          date: v.date,
          title: `Invoice ${no}`,
          bill: no,
          tag: "Paid",
          tone: "ok",
          fields: [
            F("Invoice number", no),
            F("Billed by", v.by),
            F("Payment mode", v.mode),
            F("Payment status", "Paid"),
            F("Discount", "None"),
            F("Total", `${rupee(invoiceTotal(v))} (taxes included)`),
          ],
          table: {
            cols: ["Item", "Qty", "Rate", "Amount"],
            rows: v.items.map(([name, qty, rate]) => [
              name,
              String(qty),
              rupee(rate),
              rupee(qty * rate),
            ]),
          },
        };
      }),
    };

  if (section === "vaccine")
    return {
      title,
      records: h.vaccines.map((r, i) => {
        const st =
          i === 0 ? dueState(p.vaccine.due) : { tone: "ok" as const, label: "Given on time" };
        const next = i === 0 ? fmtDate(parseDate(p.vaccine.due)) : fmtDate(h.vaccines[i - 1]!.date);
        return {
          date: r.date,
          title: r.name,
          bill: VACCINE_BILLS[i],
          tag: st.label,
          tone: st.tone,
          fields: [
            F("Vaccine", r.name),
            F("Brand", r.brand),
            F("Batch number", r.batch),
            F("Expiry", r.expiry),
            F("Dose", r.dose),
            F("How it was given", "Under the skin, right shoulder"),
            F("Given by", r.by),
            F("Weight on the day", `${r.weight} kg`),
            F("Next dose due", next),
            F("Cost", r.cost),
            F("Reaction", "None seen"),
            F("Notes", r.note, true),
          ],
        };
      }),
    };

  // deworm
  return {
    title,
    records: h.deworms.map((r, i) => {
      const st =
        i === 0
          ? dueState(p.deworm.due)
          : r.late
            ? { tone: "soon" as const, label: "2 days late" }
            : { tone: "ok" as const, label: "Given on time" };
      const next = i === 0 ? fmtDate(parseDate(p.deworm.due)) : fmtDate(h.deworms[i - 1]!.date);
      return {
        date: r.date,
        title: p.deworm.name,
        bill: DEWORM_BILLS[i],
        tag: st.label,
        tone: st.tone,
        fields: [
          F("Medicine", p.deworm.name),
          F("Active ingredients", "Praziquantel, Pyrantel, Febantel"),
          F("Dose", "3 tablets (1 tablet for every 10 kg)"),
          F("Weight on the day", `${r.weight} kg`),
          F("How it was given", "By mouth"),
          F("Batch number", r.batch),
          F("Expiry", r.expiry),
          F("Given by", r.by),
          F("Next dose due", next),
          F("Cost", "₹180"),
          F("Reaction", "None seen"),
          F("Notes", r.note, true),
        ],
      };
    }),
  };
}
