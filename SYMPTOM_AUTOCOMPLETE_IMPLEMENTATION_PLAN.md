# Symptoms Autocomplete + Triage — Implementation Plan

**Scope:** Prescription → Section "2. Symptoms" ([PrescriptionWorkflow.tsx](src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx)).
**Sources:** pasted intake catalogue (24 sections, ~1,000 lines) + [VetOS_Symptom_Triage_Master.xlsx](VetOS_Symptom_Triage_Master.xlsx).

---

## 0. Status (2026-10-11)

Phases 1-4 implemented; phase 5 (e2e) deliberately **not run** because the app points at the live clinic database. Verified by vitest (10 tests) and `tsc` only.
Deviations from the plan below: build script is Python (`scripts/build_symptom_catalogue.py`, stdlib only); synonyms handled by `normalizeSymptom()` + a small alias map instead of a per-entry alias list; the triage action text is a constant per level (`TRIAGE_ACTION`) instead of per entry.
**Manual input (added):** any text not in the catalogue can be added with a doctor-chosen level (Routine / Urgent / Emergency); stored as `prescriptionData.manualSymptoms` and counted in the banner and `symptomTriage`.

## 1. Current state (verified)

| Item | Today |
|---|---|
| Options | `DEFAULT_SYMPTOMS_OPTIONS` — 23 hardcoded strings (line 93) |
| Search | `.includes()` substring filter, shown as a 2-col grid dropdown (line 1268, 1790) |
| Storage | `symptomTags: string[]` + `symptomsText: string` on `prescriptionData` ([ClinicalVisit.ts:148](src/lib/mongodb/models/ClinicalVisit.ts#L148)), saved by `SYMPTOMS` case in `savePrescriptionSectionFn` ([clinical.ts:623](src/lib/mongodb/serverFns/clinical.ts#L623)) |
| Triage | none |
| Custom entry | already supported (`handleAddCustomSymptom`) |

Keyboard flow (↑↓ / Enter / Esc / Enter-to-advance) already works — **keep it**.

## 2. What the xlsx actually contains

- Sheet `Symptom Triage Master`: **347 rows**, 4 cols: `Category | Symptom | Default triage | Action rule`. 339 unique names, 6 duplicates.
- Triage: **E** (Emergency) 74 · **C** (Critical/Urgent) 115 · **N** (Routine if stable) 158.
- 24 messy categories (e.g. `Eye` vs `Eyes`, `Skin/Ears`, `Musculoskeletal/Neurological`) and species groups (`Birds`, `Cat`, `Rabbit`, `Reptiles`, `Small mammals`).
- Sheet `Triage Legend`: label definitions + the safety note that *breathing difficulty, collapse, seizure, major bleeding, poisoning, inability to urinate, severe pain, heatstroke, trauma override the default label*.
- Names are lowercase and worded differently from the pasted list ("bird not eating" vs "Loss of appetite"), so a **name-join will only partly match**. This is why the two sources are merged by normalized name and the rest kept as separate entries (see §4).

**Decision:** the xlsx gives *triage*; the pasted list gives *breadth of wording*. Neither alone is the catalogue.

## 3. Target behaviour

1. Doctor types in the existing search input → ranked suggestions appear **immediately below** (existing dropdown, now ranked instead of just filtered).
2. **Inline ghost-text autocomplete:** top suggestion's remainder shown greyed after the caret; `Tab` accepts and adds the tag. (This is the "auto-write as you type".)
3. Ranking: prefix match > word-prefix match > substring > fuzzy/typo; ties by usage count (doctor's recent picks), then catalogue order.
4. Suggestions filtered/boosted by **patient species** (dog/cat/rabbit/bird/reptile/small mammal) read from the patient already loaded in the prescription.
5. Each suggestion and each selected chip shows a **triage badge**: red `E`, amber `C`, none for `N`.
6. Selecting any `E` symptom → red alert banner at the top of the Symptoms card (action text from the xlsx). Not just a stored tag.
7. Unknown text still falls through to "Add custom symptom" (unchanged).
8. Section 18 items (vaccination, deworming, follow-up…) are **Visit Reasons**, not symptoms — excluded from this dropdown (see §8).

## 4. Data design

One generated, static, versioned catalogue — **no new Mongo collection, no per-keystroke server call** (≈1,200 short strings ≈ 60 KB; client filtering is instant and works offline).

```ts
// src/lib/clinical/symptomCatalogue.ts  (generated file, committed)
export type Triage = "E" | "C" | "N";
export interface SymptomEntry {
  id: string;            // slug of normalized name, stable → stored on the visit
  label: string;         // Title-cased display text
  group: string;         // one of ~12 clean groups (see below)
  species?: ("dog"|"cat"|"rabbit"|"smallMammal"|"bird"|"reptile")[]; // omitted = all
  triage?: Triage;       // from xlsx when matched/derived
  action?: string;       // xlsx "Action / escalation rule" (E and C only)
  aliases?: string[];    // e.g. "hairfall" ↔ "hair loss", "diarrhea" ↔ "diarrhoea"
}
```

**Clean groups** (collapse the xlsx's 24 + pasted 24 into one list): General/Behaviour, GI, Urinary, Reproductive, Skin/Coat, Ear, Eye, Oral/Nose, Respiratory, Cardiovascular, Musculoskeletal, Neurological, Pain, Bleeding, Fluid/Temperature, Trauma/Toxins, Neonatal. Species-specific sections (19–24) become `species` tags on entries, not separate groups.

**Build script** `scripts/build-symptom-catalogue.mjs` (one-off + rerunnable):
1. Parse pasted text (saved as `scripts/data/symptom-intake.txt`) → section → group/species map; strip section 18 into a separate `visitReasons` export.
2. Parse xlsx (SheetJS via `npx`/dev-only; not added to app bundle).
3. Normalize (`lowercase`, strip punctuation, `diarrhoea→diarrhea`, `faeces→feces`, `oestrus→estrus`, etc.) and **dedupe** — the pasted list repeats many items across sections (e.g. "Vomiting blood", "Head tilt", "Exercise intolerance").
4. Join xlsx → catalogue on normalized name, then on alias; matched entries get `triage` + `action`.
5. xlsx rows that don't match are **added as their own entries** (they're valid symptoms with triage).
6. Pasted items with no xlsx match: `triage` left unset, then assigned by the **keyword rule table** below, then flagged in a generated `unmatched-report.md` for the vet to review.
7. Emit `symptomCatalogue.ts` + report (counts, unmatched, dupes).

**Keyword fallback for unmatched items** (so nothing silently defaults to "routine"): any label containing *collapse, seizure, blue/purple gums, laboured/difficulty breathing, open-mouth breathing, poison/toxin/ingestion of (chocolate, xylitol, grapes, rodenticide…), heatstroke, paralysis, cannot/no urine, prolonged labour, snake, electrical, burn, road traffic* → `E`; *blood, bleeding, vomiting repeated, severe pain, not eating, straining* → `C`; else unset. The vet confirms from the report before release.

## 5. Safety overrides (code, not data)

Data-only triage is not enough — the xlsx legend says context overrides the label. Add `src/lib/clinical/triageRules.ts`:

| Rule | Trigger | Result |
|---|---|---|
| Urinary obstruction | species = cat **and** (straining to urinate / unproductive attempts / no urine / straining in litter tray) | force `E`, banner "Possible urethral obstruction — urgent" (sheet 1 §3 clinical safety note: strongest for male cats) |
| Neonate | patient age < ~8 wks **and** any `C` symptom | upgrade to `E` |
| Exotics persistence | species bird/rabbit/small mammal/reptile **and** `N` + reduced appetite/activity also selected | upgrade to `C` (xlsx "Species caution") |
| Multiple C | ≥ 3 `C` symptoms selected | upgrade banner to "Review for escalation" |

Pure function `computeTriage(selected, patient) → { level, reasons[] }` — the single place the banner reads from. One small test file covers the four rules + a matched/unmatched catalogue lookup.

> Triage output is a **decision aid, not a diagnosis**; show the legend's disclaimer in a tooltip on the banner. The vet's override (dismiss with reason) must be possible — see §6.

## 6. Persistence

Minimal, backward-compatible change to `prescriptionData`:

- `symptomTags: string[]` — **unchanged** (labels), so print view, Patient 360 and old visits keep working ([PrescriptionPrintView.tsx](src/components/erp/clinical/PrescriptionPrintView.tsx), [Patient360Profile.tsx](src/components/erp/crm/Patient360Profile.tsx), [VisitWorkspaceModal.tsx](src/components/erp/clinical/VisitWorkspaceModal.tsx)).
- add `symptomTriage?: "E"|"C"|"N"` — the computed overall level at save time (for dashboards/queue sorting later).
- add `symptomTriageOverride?: { level; reason; by; at }` — only if the doctor dismisses/changes the alert (audit trail).
- Touch points: `ClinicalVisit.ts` schema (2 optional fields), `SYMPTOMS` case in `savePrescriptionSectionFn` (accept + store), `serializeSectionState` dirty check (include new fields).
- Existing tags not in the catalogue (old custom entries) stay valid; they just show no badge.

## 7. UI changes (all inside the Symptoms `SectionCard`)

- New `useSymptomSearch(query, species)` hook in `src/lib/clinical/` — returns ranked `SymptomEntry[]` (max ~30). Replaces `filteredSymptomOptions`; `DEFAULT_SYMPTOMS_OPTIONS` deleted.
- New tiny `SymptomChip`/`TriageBadge` (reused in dropdown rows and selected chips). Reuse existing `Badge` ([badge.tsx](src/components/ui/badge.tsx)); colours via existing semantic tokens (`destructive` for E, amber for C).
- Dropdown: group header + label + badge per row; empty query shows **"Common for <species>"** (top ~12 by usage/default list) instead of the entire catalogue.
- Ghost text: absolutely-positioned span behind the input, same font; `Tab` = accept, `→` at end of text = accept.
- Alert banner above the chips when `computeTriage().level === "E"` (or `C`, softer).
- **Usage boost:** `localStorage` counter per symptom id per doctor (per-viewer convenience only; fail-safe on throw). Server-side aggregation is deferred.
- No change to `symptomsText` behaviour or the Enter/advance keyboard flow.

## 8. Out of scope / decisions to confirm

1. **Visit reasons (section 18)** — stored separately as a `visitReason` in a later change; for now exported but not shown in Symptoms. *Confirm: do you want a Visit Reason field in the prescription header now?*
2. **"Backend autowrite"** — I read this as "suggest while typing from a stored catalogue". If you instead mean *the backend should save a symptom the doctor types a new free-text for so it appears for everyone next time*, that needs a `SymptomCatalogue` Mongo collection + admin review screen. Deferred; client catalogue is built so it can swap to a server source later.
3. Triage labels are **suggestions**; the clinic's vet should sign off the keyword-derived ones in `unmatched-report.md` before go-live.
4. Localisation: British spellings in the intake list (diarrhoea, faeces, oestrus) are kept as `label`; American forms are `aliases`, so both spellings find the entry.

## 9. Phases

| # | Work | Files | Done when |
|---|---|---|---|
| 1 | Save pasted list as `scripts/data/symptom-intake.txt`; write build script; generate catalogue + `unmatched-report.md` | `scripts/build-symptom-catalogue.mjs`, `src/lib/clinical/symptomCatalogue.ts` | counts printed: total, matched-to-xlsx, unmatched, dupes removed; vet reviews report |
| 2 | `useSymptomSearch` (rank + species + aliases) and `triageRules.ts` + one vitest file | `src/lib/clinical/*`, `tests/` | "hairf" → Hairfall first; "diarr" finds Diarrhoea; cat + "straining to urinate" → `E` |
| 3 | Wire into Symptoms section: dropdown rows, badges, ghost text, banner; delete `DEFAULT_SYMPTOMS_OPTIONS` | `PrescriptionWorkflow.tsx` | keyboard flow unchanged; Tab accepts ghost text |
| 4 | Persist `symptomTriage` / override; print view shows nothing new unless E | `ClinicalVisit.ts`, `clinical.ts`, `PrescriptionPrintView.tsx` | reload visit → badges & triage restored; old visits open fine |
| 5 | Update e2e (`e2e/clinical-prescription.spec.ts`, run `--headed`) | `e2e/` | type "vomit" → pick → chip with badge; cat straining → red banner |

## 10. Risks

- **Mislabelled triage** is the real risk (a missing `E` is worse than a false one). Mitigation: keyword fallback errs upward; vet signs off; overrides audited.
- **Catalogue drift** if someone edits the xlsx later → re-run the script; the generated file is never hand-edited.
- **Bundle size** ~60 KB → lazy `import()` the catalogue when the Symptoms section mounts.
- **Species unknown** on some patients → no filtering, show all (never hide a symptom).
