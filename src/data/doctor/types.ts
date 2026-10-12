// Shared types for the doctor UI sample data.
// Dates are stored as "YYYY-MM-DD" strings so the data can later be swapped
// for JSON from the real ERP without changing shape.

export type IsoDate = string;

export type Section = "medical" | "lab" | "purchase" | "vaccine" | "deworm";

export const SECTIONS: readonly Section[] = ["medical", "lab", "purchase", "vaccine", "deworm"];

export interface DoseStatus {
  /** Vaccine or deworming medicine given last time. */
  name: string;
  last: IsoDate;
  due: IsoDate;
}

export interface Pet {
  id: string;
  name: string;
  breed: string;
  age: string;
  sex: "Male" | "Female";
  owner: string;
  phone: string;
  vaccine: DoseStatus;
  deworm: DoseStatus;
}

export interface ClinicStats {
  newPatients: number;
  revenueUpPct: number;
  hoursSavedPerWeek: number;
  reminderReturnPct: number;
  followUps: number;
  billingFasterPct: number;
}

export interface Clinic {
  name: string;
  /** Wide logo with a transparent background, shown on the home dashboard. */
  logoUrl: string;
  /** Round emblem used on receipts. */
  emblemUrl: string;
  stats: ClinicStats;
}

/** A record that the Fetch search can find (lab report, invoice, vaccine, visit). */
export interface SearchRecord {
  petId: string;
  section: Section;
  title: string;
  sub: string;
  tag: string;
}
