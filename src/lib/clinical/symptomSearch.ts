import { SYMPTOM_CATALOGUE } from "./symptomCatalogue";
import type { Species, SymptomEntry } from "./symptomTypes";

// Keep in sync with SPELL in scripts/build_symptom_catalogue.py
const SPELL: [string, string][] = [
  ["diarrhoea", "diarrhea"], ["faec", "fec"], ["oestrus", "estrus"], ["colour", "color"],
  ["behaviour", "behavior"], ["odour", "odor"], ["labour", "labor"], ["isation", "ization"],
  ["generalised", "generalized"], ["discolouration", "discoloration"], ["discoloured", "discolored"],
  ["grey", "gray"], ["haem", "hem"], ["oedema", "edema"],
];

export function normalizeSymptom(s: string): string {
  let out = s.toLowerCase();
  for (const [a, b] of SPELL) out = out.split(a).join(b);
  return out.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Pet.species ("Canine"…) → catalogue species. Exotic/Other/unknown → undefined = no filtering. */
export function toCatalogueSpecies(petSpecies?: string): Species | undefined {
  switch ((petSpecies || "").toLowerCase()) {
    case "canine": case "dog": return "dog";
    case "feline": case "cat": return "cat";
    case "avian": case "bird": return "bird";
    case "rabbit": return "rabbit";
    default: return undefined;
  }
}

const BY_NORM = new Map<string, SymptomEntry>(
  SYMPTOM_CATALOGUE.map((e) => [normalizeSymptom(e.label), e]),
);
const SEARCH_KEYS = SYMPTOM_CATALOGUE.map((e) => ({
  e,
  keys: [e.label, ...(e.aliases ?? [])].map(normalizeSymptom),
}));

export function findSymptom(label: string): SymptomEntry | undefined {
  return BY_NORM.get(normalizeSymptom(label));
}

// Shown when the box is empty, before the doctor has typed anything
const COMMON = [
  "loss of appetite", "vomiting", "diarrhea", "lethargy", "itching", "hairfall", "coughing", "sneezing",
  "limping", "fever reported", "weight loss", "ear discharge", "eye discharge", "blood in urine",
  "blood in stool", "constipation", "increased thirst", "skin rash",
];

function editDistanceLE1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** 0 = best. null = no match. All query tokens must match somewhere in the key. */
function scoreKey(key: string, q: string, tokens: string[]): number | null {
  if (key.startsWith(q)) return 0;
  const words = key.split(" ");
  const first = tokens[0] ?? q;
  if (words.some((w) => w.startsWith(first)) && tokens.every((t) => words.some((w) => w.startsWith(t)))) return 1;
  if (key.includes(q)) return 2;
  // ponytail: ≤1 typo per token, O(n·tokens) over ~1.1k keys; fine until the catalogue is 10× bigger
  if (tokens.every((t) => words.some((w) => w.startsWith(t) || (t.length >= 4 && editDistanceLE1(t, w.slice(0, t.length)))))) return 3;
  return null;
}

export function searchSymptoms(query: string, species?: Species, limit = 30): SymptomEntry[] {
  const allowed = (e: SymptomEntry) => !species || !e.species || e.species.includes(species);
  const q = normalizeSymptom(query);
  if (!q) {
    return COMMON.map((c) => BY_NORM.get(c)).filter((e): e is SymptomEntry => !!e && allowed(e));
  }
  const tokens = q.split(" ");
  const scored: { e: SymptomEntry; s: number }[] = [];
  for (const { e, keys } of SEARCH_KEYS) {
    if (!allowed(e)) continue;
    let best: number | null = null;
    for (const k of keys) {
      const s = scoreKey(k, q, tokens);
      if (s !== null && (best === null || s < best)) best = s;
    }
    if (best === null) continue;
    // species-specific entries for this patient's species edge ahead of equal matches
    scored.push({ e, s: best - (species && e.species ? 0.5 : 0) });
  }
  scored.sort((a, b) => a.s - b.s || a.e.label.length - b.e.label.length);
  return scored.slice(0, limit).map((x) => x.e);
}

/** Greyed-out remainder the doctor can accept with Tab. */
export function ghostText(query: string, results: SymptomEntry[]): string {
  const q = query.toLowerCase();
  if (!q.trim()) return "";
  const hit = results.find((r) => r.label.toLowerCase().startsWith(q) && r.label.length > q.length);
  return hit ? hit.label.slice(query.length) : "";
}
