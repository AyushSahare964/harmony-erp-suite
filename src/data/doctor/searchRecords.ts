import { formatDate } from "@/lib/doctor/dates";
import { pets } from "./pets";
import type { Pet, SearchRecord } from "./types";

// Sample records the Fetch search can find: one lab report, invoice,
// vaccine and visit per pet (same as the reference HTML).
const recordsFor = (p: Pet, idx: number): SearchRecord[] => [
  {
    petId: p.id,
    section: "lab",
    title: `${p.name} · CBC blood test`,
    sub: "Lab report · 02 Oct 2026",
    tag: "Laboratory",
  },
  {
    petId: p.id,
    section: "purchase",
    title: `${p.name} · Invoice INV-${1042 + idx * 7}`,
    sub: "₹1,850 · 02 Oct 2026",
    tag: "Purchase",
  },
  {
    petId: p.id,
    section: "vaccine",
    title: `${p.name} · Rabies vaccine`,
    sub: `Given ${formatDate(p.vaccine.last)}`,
    tag: "Vaccine",
  },
  {
    petId: p.id,
    section: "medical",
    title: `${p.name} · Skin allergy visit`,
    sub: "Consultation · 02 Oct 2026",
    tag: "Medical",
  },
];

export const searchRecords: SearchRecord[] = pets.flatMap(recordsFor);
