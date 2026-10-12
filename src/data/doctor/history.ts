// Sample history data behind the patient history pages and graphs
// (copied from reference/vetos-dashboard-v3.html). Swap with real ERP data later.
import type { Pet } from "./types";

/** Local date from year, month (1-12), day. */
export const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);
export const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

// ---------------------------------------------------------------- invoices
export type InvoiceLine = [name: string, qty: number, rate: number];
export interface Invoice {
  date: Date;
  by: string;
  mode: "UPI" | "Cash" | "Card";
  items: InvoiceLine[];
}

export const invoiceTotal = (v: Invoice) => v.items.reduce((s, [, qty, rate]) => s + qty * rate, 0);

/** Invoices listed on the Purchase page, newest first. */
export const PURCHASE_INVOICES = [
  "INV-1042",
  "INV-1043",
  "INV-0987",
  "INV-0850",
  "INV-0911",
  "INV-0621",
  "INV-0620",
  "INV-0416",
  "INV-0415",
];

export function invoicesFor(p: Pet, vaccineLast: Date, dewormLast: Date): Record<string, Invoice> {
  const vd = (i: number) =>
    D(vaccineLast.getFullYear() - i, vaccineLast.getMonth() + 1, vaccineLast.getDate());
  const wd = (i: number) => addMonths(dewormLast, -3 * i);
  const R = "Reception, Rahul";
  const M = "Reception, Meena";
  const vName = p.vaccine.name;
  const wName = p.deworm.name;
  return {
    "INV-1042": {
      date: D(2026, 10, 2),
      by: M,
      mode: "UPI",
      items: [
        ["Consultation", 1, 500],
        ["Medicated bath", 1, 350],
        ["Antihistamine injection", 1, 250],
        ["Cetirizine 10 mg tablet", 7, 10],
        ["Anti-allergy shampoo 200 ml", 1, 450],
        ["Skin check under microscope", 1, 230],
      ],
    },
    "INV-1043": { date: D(2026, 10, 2), by: M, mode: "UPI", items: [["CBC blood test", 1, 600]] },
    "INV-0987": {
      date: D(2026, 8, 14),
      by: R,
      mode: "Cash",
      items: [
        ["Annual health check", 1, 500],
        ["Blood sugar and kidney profile", 1, 300],
      ],
    },
    "INV-0850": {
      date: D(2026, 7, 10),
      by: M,
      mode: "Cash",
      items: [
        ["Chew bone (large)", 1, 180],
        ["Calcium supplement 60 tablets", 1, 620],
      ],
    },
    "INV-0911": {
      date: D(2026, 5, 3),
      by: R,
      mode: "Card",
      items: [
        ["Consultation", 1, 500],
        ["CBC blood test", 1, 300],
        ["Ear drops 10 ml", 1, 280],
      ],
    },
    "INV-0621": { date: D(2026, 1, 19), by: M, mode: "Cash", items: [["CBC blood test", 1, 600]] },
    "INV-0620": {
      date: D(2026, 1, 19),
      by: M,
      mode: "UPI",
      items: [
        ["Consultation", 1, 500],
        ["X-ray (1 view)", 1, 600],
        ["Pain relief injection", 1, 200],
        ["Bandage", 1, 100],
      ],
    },
    "INV-0416": {
      date: D(2025, 11, 10),
      by: R,
      mode: "Cash",
      items: [["CBC and kidney profile", 1, 800]],
    },
    "INV-0415": {
      date: D(2025, 11, 10),
      by: R,
      mode: "Cash",
      items: [
        ["Consultation", 1, 500],
        ["IV fluids", 1, 450],
        ["Anti-vomiting injection", 1, 200],
      ],
    },
    "INV-0701": { date: vd(0), by: R, mode: "UPI", items: [[`${vName} vaccine`, 1, 650]] },
    "INV-0602": { date: vd(1), by: R, mode: "Cash", items: [[`${vName} vaccine`, 1, 600]] },
    "INV-0501": {
      date: vd(2),
      by: M,
      mode: "Cash",
      items: [["DHPPi + Leptospirosis booster", 1, 550]],
    },
    "INV-0402": { date: vd(3), by: M, mode: "Cash", items: [["First vaccine (DHPPi)", 1, 500]] },
    "INV-0988": { date: wd(0), by: R, mode: "UPI", items: [[`${wName} tablet`, 3, 60]] },
    "INV-0831": { date: wd(1), by: R, mode: "Cash", items: [[`${wName} tablet`, 3, 60]] },
    "INV-0702": { date: wd(2), by: M, mode: "Cash", items: [[`${wName} tablet`, 3, 60]] },
    "INV-0580": { date: wd(3), by: M, mode: "Cash", items: [[`${wName} tablet`, 3, 60]] },
    "INV-0431": { date: wd(4), by: R, mode: "Cash", items: [[`${wName} tablet`, 3, 60]] },
  };
}

// ---------------------------------------------------------------- blood tests
export interface LabParam {
  key: string;
  name: string;
  unit: string;
  lo: number;
  hi: number;
}
export const LAB_PARAMS: LabParam[] = [
  { key: "hb", name: "Hemoglobin", unit: "g/dL", lo: 12, hi: 18 },
  { key: "rbc", name: "Red blood cells", unit: "×10⁶/µL", lo: 5.5, hi: 8.5 },
  { key: "pcv", name: "PCV", unit: "%", lo: 37, hi: 55 },
  { key: "wbc", name: "White blood cells", unit: "×10³/µL", lo: 6, hi: 17 },
  { key: "plt", name: "Platelets", unit: "×10³/µL", lo: 200, hi: 500 },
  { key: "glu", name: "Glucose", unit: "mg/dL", lo: 70, hi: 120 },
  { key: "cre", name: "Creatinine", unit: "mg/dL", lo: 0.5, hi: 1.5 },
  { key: "bun", name: "BUN", unit: "mg/dL", lo: 7, hi: 27 },
  { key: "alt", name: "ALT", unit: "U/L", lo: 10, hi: 100 },
];

export interface LabReport {
  date: Date;
  title: string;
  by: string;
  bill: string;
  collected: string;
  ready: string;
  tech: string;
  cost: string;
  /** One value per LAB_PARAMS entry, same order. */
  values: number[];
  note: string;
}
export const LAB_REPORTS: LabReport[] = [
  {
    date: D(2026, 10, 2),
    title: "CBC blood test",
    by: "Dr. Sharma",
    bill: "INV-1043",
    collected: "11:20 am",
    ready: "3:10 pm",
    tech: "Neha K.",
    cost: "₹600",
    values: [15.2, 6.9, 44, 11.4, 280, 92, 1.0, 18, 48],
    note: "All values are normal.",
  },
  {
    date: D(2026, 8, 14),
    title: "Blood profile (CBC, sugar and kidney)",
    by: "Dr. Sharma",
    bill: "INV-0987",
    collected: "10:40 am",
    ready: "2:00 pm",
    tech: "Rohit S.",
    cost: "₹300",
    values: [14.8, 6.7, 43, 10.2, 295, 92, 1.0, 18, 48],
    note: "Kidney and liver values are healthy.",
  },
  {
    date: D(2026, 5, 3),
    title: "CBC blood test",
    by: "Dr. Iyer",
    bill: "INV-0911",
    collected: "4:15 pm",
    ready: "5:30 pm",
    tech: "Neha K.",
    cost: "₹300",
    values: [14.1, 6.5, 42, 18.6, 310, 98, 1.1, 20, 52],
    note: "White blood cells are a little high. This matches the ear infection.",
  },
  {
    date: D(2026, 1, 19),
    title: "CBC blood test",
    by: "Dr. Sharma",
    bill: "INV-0621",
    collected: "12:05 pm",
    ready: "2:20 pm",
    tech: "Rohit S.",
    cost: "₹600",
    values: [14.6, 6.6, 43, 9.8, 270, 95, 0.9, 16, 45],
    note: "All values are normal.",
  },
  {
    date: D(2025, 11, 10),
    title: "CBC and kidney profile",
    by: "Dr. Iyer",
    bill: "INV-0416",
    collected: "2:30 pm",
    ready: "5:00 pm",
    tech: "Neha K.",
    cost: "₹800",
    values: [17.6, 8.2, 53, 21.3, 350, 130, 1.6, 32, 70],
    note: "Signs of dehydration. White blood cells, glucose, creatinine and BUN are high.",
  },
];
export const labFlag = (pm: LabParam, v: number) =>
  v < pm.lo ? "Low" : v > pm.hi ? "High" : "Normal";

// ---------------------------------------------------------------- visits
export interface VisitVitals {
  date: Date;
  weight: number;
  temp: number;
  heart: number;
  bill: number;
  title: string;
  by: string;
}
export const VISITS: VisitVitals[] = [
  {
    date: D(2026, 10, 2),
    weight: 31.4,
    temp: 101.8,
    heart: 96,
    bill: 1850,
    title: "Skin allergy",
    by: "Dr. Sharma",
  },
  {
    date: D(2026, 8, 14),
    weight: 30.8,
    temp: 101.4,
    heart: 92,
    bill: 800,
    title: "Annual health check",
    by: "Dr. Sharma",
  },
  {
    date: D(2026, 5, 3),
    weight: 30.5,
    temp: 102.1,
    heart: 100,
    bill: 1080,
    title: "Ear infection",
    by: "Dr. Iyer",
  },
  {
    date: D(2026, 1, 19),
    weight: 30.2,
    temp: 101.6,
    heart: 94,
    bill: 1400,
    title: "Limping on front left paw",
    by: "Dr. Sharma",
  },
  {
    date: D(2025, 11, 10),
    weight: 29.9,
    temp: 102.4,
    heart: 104,
    bill: 1150,
    title: "Loose motions",
    by: "Dr. Iyer",
  },
];

/** Labelled fields of each visit record: [label, value, wide?]. */
export type Field = [label: string, value: string, wide?: boolean];
export interface MedicalRecord {
  date: Date;
  title: string;
  bill: string;
  tag: string;
  tone: "ok" | "soon" | "late";
  fields: Field[];
}
const F = (label: string, value: string, wide = false): Field => [label, value, wide];
export const MEDICAL_RECORDS: MedicalRecord[] = [
  {
    date: D(2026, 10, 2),
    title: "Skin allergy",
    bill: "INV-1042",
    tag: "Follow-up on 16 Oct 2026",
    tone: "soon",
    fields: [
      F("Doctor", "Dr. Sharma"),
      F("Visit type", "Consultation"),
      F("Weight", "31.4 kg"),
      F("Temperature", "101.8 °F"),
      F("Heart rate", "96 per minute"),
      F("Lab tests", "CBC blood test"),
      F("Reason for visit", "Itching and redness on the back for 5 days", true),
      F("Diagnosis", "Allergic dermatitis", true),
      F("Treatment given", "Medicated bath and antihistamine injection", true),
      F(
        "Prescription",
        "Cetirizine 10 mg, 1 tablet once a day for 7 days. Anti-allergy shampoo, twice a week for 3 weeks.",
        true,
      ),
      F("Advice", "Avoid chicken in food. Keep the skin dry.", true),
      F("Follow-up", "16 Oct 2026"),
      F("Bill", "₹1,850 (INV-1042, paid)"),
    ],
  },
  {
    date: D(2026, 8, 14),
    title: "Annual health check",
    bill: "INV-0987",
    tag: "Completed",
    tone: "ok",
    fields: [
      F("Doctor", "Dr. Sharma"),
      F("Visit type", "Routine check"),
      F("Weight", "30.8 kg"),
      F("Temperature", "101.4 °F"),
      F("Heart rate", "92 per minute"),
      F("Lab tests", "Blood sugar and kidney profile"),
      F("Findings", "Healthy. Mild tartar on teeth.", true),
      F("Treatment given", "General check, teeth cleaning advice", true),
      F("Prescription", "None", true),
      F("Advice", "Brush teeth 3 times a week. Come for a check-up every year.", true),
      F("Follow-up", "Next year"),
      F("Bill", "₹800 (INV-0987, paid)"),
    ],
  },
  {
    date: D(2026, 5, 3),
    title: "Ear infection",
    bill: "INV-0911",
    tag: "Recovered",
    tone: "ok",
    fields: [
      F("Doctor", "Dr. Iyer"),
      F("Visit type", "Consultation"),
      F("Weight", "30.5 kg"),
      F("Temperature", "102.1 °F"),
      F("Heart rate", "100 per minute"),
      F("Lab tests", "CBC blood test"),
      F("Reason for visit", "Head shaking and bad smell from the left ear for 3 days", true),
      F("Diagnosis", "Yeast infection in the left ear", true),
      F("Treatment given", "Ear cleaning", true),
      F("Prescription", "Ear drops, 4 drops twice a day for 10 days", true),
      F("Advice", "Dry the ears after every bath", true),
      F("Follow-up", "Not needed"),
      F("Bill", "₹1,080 (INV-0911, paid)"),
    ],
  },
  {
    date: D(2026, 1, 19),
    title: "Limping on front left paw",
    bill: "INV-0620",
    tag: "Recovered",
    tone: "ok",
    fields: [
      F("Doctor", "Dr. Sharma"),
      F("Visit type", "Consultation and X-ray"),
      F("Weight", "30.2 kg"),
      F("Temperature", "101.6 °F"),
      F("Heart rate", "94 per minute"),
      F("Lab tests", "CBC blood test"),
      F("Reason for visit", "Limping after a long walk", true),
      F("Diagnosis", "Mild sprain. X-ray shows no fracture.", true),
      F("Treatment given", "Pain relief injection and bandage", true),
      F("Prescription", "Meloxicam, 1 tablet once a day for 5 days, with food", true),
      F("Advice", "Rest for 7 days. No stairs or running.", true),
      F("Follow-up", "Not needed"),
      F("Bill", "₹1,400 (INV-0620, paid)"),
    ],
  },
  {
    date: D(2025, 11, 10),
    title: "Loose motions",
    bill: "INV-0415",
    tag: "Recovered",
    tone: "ok",
    fields: [
      F("Doctor", "Dr. Iyer"),
      F("Visit type", "Consultation"),
      F("Weight", "29.9 kg"),
      F("Temperature", "102.4 °F"),
      F("Heart rate", "104 per minute"),
      F("Lab tests", "CBC and kidney profile"),
      F("Reason for visit", "Loose motions and low appetite for 2 days", true),
      F("Diagnosis", "Gastroenteritis", true),
      F("Treatment given", "IV fluids and anti-vomiting injection", true),
      F("Prescription", "Probiotic sachet once a day for 5 days. Soft diet of boiled rice.", true),
      F("Advice", "Give plenty of water. Come back if it continues after 2 days.", true),
      F("Follow-up", "Not needed"),
      F("Bill", "₹1,150 (INV-0415, paid)"),
    ],
  },
];

/** The problem the pet had on each visit date (used in "why" explanations). */
export const PROBLEM_ON: Record<number, string> = {
  [D(2025, 11, 10).getTime()]: "gastroenteritis (loose motions) with dehydration",
  [D(2026, 1, 19).getTime()]: "limping from a mild sprain",
  [D(2026, 5, 3).getTime()]: "an ear infection",
  [D(2026, 8, 14).getTime()]: "a yearly health check, no problem",
  [D(2026, 10, 2).getTime()]: "a skin allergy",
};

// ---------------------------------------------------------------- vaccines and deworming
export interface VaccineDose {
  date: Date;
  name: string;
  brand: string;
  batch: string;
  expiry: string;
  dose: string;
  by: string;
  weight: number;
  cost: string;
  note: string;
}
export const VACCINE_BILLS = ["INV-0701", "INV-0602", "INV-0501", "INV-0402"];
export function vaccineDoses(p: Pet, last: Date, dueText: string): VaccineDose[] {
  const Y = (n: number) => D(last.getFullYear() - n, last.getMonth() + 1, last.getDate());
  return [
    {
      date: last,
      name: p.vaccine.name,
      brand: "Nobivac",
      batch: "A2031-17",
      expiry: "Mar 2027",
      dose: "1 ml",
      by: "Dr. Sharma",
      weight: 29.6,
      cost: "₹650",
      note: `Yearly vaccine. Next dose was due on ${dueText}.`,
    },
    {
      date: Y(1),
      name: p.vaccine.name,
      brand: "Nobivac",
      batch: "A1894-09",
      expiry: "Jan 2026",
      dose: "1 ml",
      by: "Dr. Sharma",
      weight: 28.9,
      cost: "₹600",
      note: "Yearly vaccine given on the due date.",
    },
    {
      date: Y(2),
      name: "DHPPi + Leptospirosis booster",
      brand: "Vanguard Plus",
      batch: "A1566-22",
      expiry: "Nov 2025",
      dose: "1 ml",
      by: "Dr. Iyer",
      weight: 25.2,
      cost: "₹550",
      note: "Booster dose.",
    },
    {
      date: Y(3),
      name: "First vaccine (DHPPi)",
      brand: "Vanguard Plus",
      batch: "A1102-31",
      expiry: "Aug 2023",
      dose: "0.5 ml",
      by: "Dr. Sharma",
      weight: 6.1,
      cost: "₹500",
      note: "First dose of the puppy series.",
    },
  ];
}

export interface DewormDose {
  date: Date;
  weight: number;
  batch: string;
  expiry: string;
  by: string;
  late: boolean;
  note: string;
}
export const DEWORM_BILLS = ["INV-0988", "INV-0831", "INV-0702", "INV-0580", "INV-0431"];
export function dewormDoses(last: Date): DewormDose[] {
  return [
    {
      date: last,
      weight: 31.4,
      batch: "DW-4421",
      expiry: "Feb 2028",
      by: "Dr. Iyer",
      late: false,
      note: "Regular deworming.",
    },
    {
      date: addMonths(last, -3),
      weight: 30.9,
      batch: "DW-4310",
      expiry: "Dec 2027",
      by: "Dr. Iyer",
      late: false,
      note: "Regular deworming.",
    },
    {
      date: addMonths(last, -6),
      weight: 30.5,
      batch: "DW-4188",
      expiry: "Sep 2027",
      by: "Dr. Sharma",
      late: false,
      note: "Regular deworming.",
    },
    {
      date: addMonths(last, -9),
      weight: 30.1,
      batch: "DW-4052",
      expiry: "Jun 2027",
      by: "Dr. Sharma",
      late: true,
      note: "Given 2 days after the due date.",
    },
    {
      date: addMonths(last, -12),
      weight: 29.7,
      batch: "DW-3917",
      expiry: "Mar 2027",
      by: "Dr. Iyer",
      late: false,
      note: "Regular deworming.",
    },
  ];
}
