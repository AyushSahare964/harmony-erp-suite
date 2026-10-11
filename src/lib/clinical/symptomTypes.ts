export type Triage = "E" | "C" | "N";
export type Species = "dog" | "cat" | "rabbit" | "smallMammal" | "bird" | "reptile";

export interface SymptomEntry {
  id: string;
  label: string;
  group: string;
  /** omitted = applies to every species */
  species?: Species[];
  /** omitted = N (routine if stable) */
  triage?: Triage;
  aliases?: string[];
}
