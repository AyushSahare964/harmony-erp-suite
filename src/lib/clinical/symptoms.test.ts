import { describe, expect, it } from "vitest";
import { ghostText, searchSymptoms, toCatalogueSpecies } from "./symptomSearch";
import { computeTriage } from "./triageRules";

describe("symptom search", () => {
  it("ranks prefix matches first and spells both ways", () => {
    expect(searchSymptoms("hairf")[0]?.label).toBe("Hairfall");
    expect(searchSymptoms("diarr").some((e) => /diarrhoea/i.test(e.label))).toBe(true);
    expect(searchSymptoms("diarrhea").some((e) => /diarrhoea/i.test(e.label))).toBe(true);
  });
  it("matches aliases and tolerates a typo", () => {
    expect(searchSymptoms("pruritus")[0]?.label).toBe("Itching");
    expect(searchSymptoms("vomitting").some((e) => e.label === "Vomiting")).toBe(true);
  });
  it("hides other species' entries but never hides general ones", () => {
    expect(searchSymptoms("spraying urine", "dog").length).toBe(0);
    expect(searchSymptoms("spraying urine", "cat").length).toBeGreaterThan(0);
    expect(searchSymptoms("vomiting", "dog").length).toBeGreaterThan(0);
  });
  it("empty query returns the common list; ghost text completes the prefix", () => {
    expect(searchSymptoms("").length).toBeGreaterThan(10);
    expect(ghostText("hairf", searchSymptoms("hairf"))).toBe("all");
  });
  it("maps pet species", () => {
    expect(toCatalogueSpecies("Feline")).toBe("cat");
    expect(toCatalogueSpecies("Exotic")).toBeUndefined();
  });
});

describe("triage rules", () => {
  it("takes the highest catalogue level", () => {
    expect(computeTriage(["Seizure"]).level).toBe("E");
    expect(computeTriage(["Hairfall"]).level).toBe("N");
  });
  it("cat straining to urinate is an emergency; the same for a dog is not forced", () => {
    expect(computeTriage(["Straining to urinate"], { species: "cat" }).level).toBe("E");
    expect(computeTriage(["Straining to urinate"], { species: "dog" }).reasons.length).toBe(0);
  });
  it("neonate with an urgent symptom is upgraded", () => {
    expect(computeTriage(["Repeated vomiting"], { ageMonths: 1 }).level).toBe("E");
  });
  it("exotic with reduced appetite plus another symptom is at least urgent", () => {
    expect(computeTriage(["Reduced appetite", "Hairfall"], { species: "rabbit" }).level).not.toBe("N");
  });
  it("manual symptom uses the triage the doctor chose", () => {
    const r = computeTriage(["Weird thing"], { manual: [{ label: "Weird thing", triage: "E" }] });
    expect(r.level).toBe("E");
    expect(r.emergencyLabels).toEqual(["Weird thing"]);
  });
});
