import { pets, recentPetIds } from "@/data/doctor/pets";
import { searchRecords } from "@/data/doctor/searchRecords";
import type { Pet, Section } from "@/data/doctor/types";

export type ResultIcon = "paw" | "clock" | Section;

export interface SearchResult {
  key: string;
  petId: string;
  /** Set for records; opens that history page instead of the patient page. */
  section?: Section;
  icon: ResultIcon;
  title: string;
  sub: string;
  tag: string;
}

/** DOM id of a result row, for aria-activedescendant. */
export const optionId = (listId: string, index: number) => `${listId}-opt-${index}`;

export interface ResultGroup {
  heading: string;
  items: SearchResult[];
}

const petResult = (p: Pet, icon: ResultIcon = "paw"): SearchResult => ({
  key: `pet-${p.id}`,
  petId: p.id,
  icon,
  title: p.name,
  sub: `${p.breed} · ${p.age} · Owner ${p.owner}`,
  tag: "Pet",
});

/** 0 = name starts with, 1 = name contains, 2 = owner / breed / phone, null = no match. */
function petScore(p: Pet, q: string): number | null {
  const name = p.name.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.includes(q)) return 1;
  const digits = q.replace(/\s/g, "");
  if (
    p.owner.toLowerCase().includes(q) ||
    p.breed.toLowerCase().includes(q) ||
    (digits !== "" && p.phone.replace(/\s/g, "").includes(digits))
  )
    return 2;
  return null;
}

export function buildResults(raw: string): ResultGroup[] {
  const q = raw.trim().toLowerCase();

  if (!q) {
    const recent = recentPetIds
      .map((id) => pets.find((p) => p.id === id))
      .filter((p): p is Pet => !!p)
      .map((p) => petResult(p, "clock"));
    return [{ heading: "Recent searches", items: recent }];
  }

  const scores = new Map<string, number>();
  const scored: { pet: Pet; score: number }[] = [];
  for (const pet of pets) {
    const score = petScore(pet, q);
    if (score === null) continue;
    scores.set(pet.id, score);
    scored.push({ pet, score });
  }
  scored.sort((a, b) => a.score - b.score);

  const records = searchRecords
    .filter((r) => r.title.toLowerCase().includes(q))
    .map((r) => ({ r, score: scores.get(r.petId) ?? 5 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map(({ r }): SearchResult => ({
      key: `rec-${r.petId}-${r.section}`,
      petId: r.petId,
      section: r.section,
      icon: r.section,
      title: r.title,
      sub: r.sub,
      tag: r.tag,
    }));

  const groups: ResultGroup[] = [];
  if (scored.length)
    groups.push({
      heading: "Pets and owners",
      items: scored.slice(0, 4).map((x) => petResult(x.pet)),
    });
  if (records.length) groups.push({ heading: "Records", items: records });
  return groups;
}
