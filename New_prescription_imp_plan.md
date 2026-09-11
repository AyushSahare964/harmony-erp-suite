# Prescription Section — Implementation Plan

**Document version:** 1.0
**Date:** 06/09/2026
**Scope:** Redesign of the Prescription module from free-text fields into a structured, sectioned clinical workflow.

---

## 1. Objective

Convert the current single free-text prescription form into a **structured, section-based clinical workflow** that is:

- Fast for the doctor to fill during a consultation
- Structured enough to support search, analytics, and reminders later
- Easy to review on future visits
- Flexible enough to allow manual/custom entries where clinical judgment varies case to case

---

## 2. Final Section Order

```
1. Patient Details
2. Previous History
3. Symptoms
4. Clinical Findings
5. Clinical Treatment
     A. Prescribed
        - Immediate Medicine Provided
        - Prescribed Medicine
     B. Injectable
6. Clinical Follow-up
     - Follow-up Required? (Yes/No)
     - Next Treatment Date
     - Next Vaccine Date (+ Quick Date buttons)
     - Deworming
     - Other Follow-up
7. Food Items
     - Animal Food
     - Prescribed Food
8. Accessories (optional, if retained)
9. Save Prescription
```

Each top-level section should render as a **collapsible card**, not one long form.

---

## 3. Section 1 — Patient Details (UPDATED PER YOUR REQUEST)

> ⚠️ This overrides the original spec. Owner Name, Animal Name, Species, Breed, Age, Gender, and Contact Number are **removed** from this section (they can still live in the Patient/Reception record and be displayed read-only elsewhere if needed, but they are **not part of this section**).

### Fields in this section only:

| Field | Type | Behavior |
|---|---|---|
| Patient Name | Read-only, auto-fetched | Pulled from existing patient record |
| Patient ID / Registration ID | Read-only, auto-fetched | Pulled from existing patient record |
| Date of Visit | Date picker, auto-filled with current date | Editable by doctor if permitted |
| Weight | Numeric input + unit (kg / lb) | Manually entered at each visit (weight changes per visit) |
| Body Temperature | Numeric input + unit (°C / °F) | Manually entered at each visit |

### Notes
- Patient Name and Patient ID must **not** be re-typed — they should be fetched from the patient's existing record and displayed read-only (or locked) at the top of the prescription.
- Weight and Body Temperature are **visit-specific vitals**, so they must be stored against the specific Visit/Prescription ID, not against the patient's master record — this allows tracking weight/temperature trends across visits later (useful for future analytics/growth charts).
- Unit for weight and temperature should be configurable per clinic (default kg / °C, override to lb / °F if needed).

---

## 4. Section 2 — Previous History

- Single large multiline text box.
- Manually entered by the doctor.
- **Visit-specific**: saved against the current visit, while past visits' history remains viewable when browsing the patient's history timeline.

---

## 5. Section 3 — Symptoms

- Multiline text box for manual entry (mandatory support).
- Optional enhancement: **+ Add Symptom** button to enter symptoms as discrete tags/list items (improves searchability), while keeping the free-text box available as a fallback.

---

## 6. Section 4 — Clinical Findings

- Multi-select checklist (not a single-select dropdown), with the following options:
  1. Hairfall
  2. Rashes on Skin
  3. Blood in Urine
  4. Lump on Body / Growth
  5. Itching
  6. Limping
  7. Constipation
  8. Urine Incontinence
  9. Vomiting
  10. Listlessness
  11. **Other**

- Selecting **Other** reveals a text field for a custom finding. If Other is not selected, this field stays hidden.

---

## 7. Section 5 — Clinical Treatment

### 5A. Prescribed

**5A.1 Immediate Medicine Provided** (given during this visit)

| Field | Type |
|---|---|
| Medicine Name | Searchable dropdown |
| Quantity | Numeric |
| Unit | Dropdown (see §7.3) |
| Dosage | Text/numeric |
| Instructions | Text |
| Remarks | Text (optional) |

**5A.2 Prescribed Medicine** (for use after the visit — supports multiple rows via **+ Add Medicine**)

| Field | Type |
|---|---|
| Medicine Name | Searchable dropdown |
| Quantity | Numeric |
| Unit | Dropdown (see §7.3) |
| Dosage | Text |
| Frequency | Text/dropdown |
| Duration | Text/numeric + unit (days/weeks) |
| Route | Dropdown (Oral, Topical, etc.) |
| Instructions | Text |
| Remarks | Text (optional) |

### 7.3 Dynamic Quantity Unit (applies to all medicine fields)

Do not hard-code "tablets." Provide a Unit dropdown:
Tablet, Capsule, Strip, Bottle, ml, mg, g, Drops, Sachet, Tube, Piece, Other (with manual entry if "Other" selected).

### 5B. Injectable (kept separate from Prescribed Medicine)

Supports multiple entries via **+ Add Injectable**.

| Field | Type |
|---|---|
| Injectable/Medicine Name | Searchable dropdown |
| Dose | Numeric |
| Dose Unit | Dropdown |
| Route | Dropdown (IM, IV, SC, etc.) |
| Quantity | Numeric |
| Frequency | Text/dropdown (optional) |
| Date/Time Administered | Date-time picker |
| Instructions | Text |
| Remarks | Text (optional) |

> Immediate Medicine, Prescribed Medicine, and Injectable must remain three clearly distinct data groups — never merged into one generic "medicine" table without a type flag.

---

## 8. Section 6 — Clinical Follow-up

**8.1 Follow-up Required?** — Yes / No toggle
- If **No** → hide all date fields below, save as "No follow-up".
- If **Yes** → reveal the fields below.

**8.2 Next Treatment Date** — simple date picker.

**8.3 Next Vaccine Date** — date picker + Quick Date buttons:
`+1 Month` `+3 Months` `+6 Months` `+1 Year` `Custom Date`
- Quick Date buttons auto-calculate from the current Date of Visit; doctor can still override manually.

**8.4 Deworming** — same Quick Date pattern as vaccine (1/3/6 months, 1 year, custom). Intervals should be **admin-configurable**, not hard-coded.

**8.5 Other Follow-up**
- Follow-up Type dropdown: Treatment, Vaccine, Consultation, Deworming, Recheck, Other
- Follow-up Date: date picker
- If "Other" selected as type → free-text field for custom follow-up type.

---

## 9. Section 7 — Food Items

**9.1 Animal Food** (from existing food/product catalog)
- Fields: Food Name, Quantity, Unit, Frequency, Instructions, Remarks
- Supports multiple entries via **+ Add Animal Food**

**9.2 Prescribed Food** (diet plan, not necessarily from catalog)
- Fields: Food Name/Description (manual text allowed), Quantity, Unit, Frequency, Instructions, Duration, Remarks

---

## 10. Section 8 — Accessories (optional)

- Checklist (Collar, Leash, Bandage, Other) + quantity.
- If accessories are primarily a billing concern, link this section's data to the billing module rather than duplicating logic in the clinical record.

---

## 11. Data Model / Database Considerations

Every prescription record must be linked hierarchically:

```
Patient ID
   └── Visit ID
         └── Prescription ID
               ├── Vitals (Weight, Temperature, Date of Visit)
               ├── Previous History (text)
               ├── Symptoms (text / tags)
               ├── Clinical Findings (multi-select + other)
               ├── Clinical Treatment
               │     ├── Immediate Medicine (rows)
               │     ├── Prescribed Medicine (rows)
               │     └── Injectable (rows)
               ├── Clinical Follow-up (structured record)
               ├── Food Items
               │     ├── Animal Food (rows)
               │     └── Prescribed Food (rows)
               └── Accessories (rows, optional)
```

### Key design rules
1. Patient Name / Patient ID are **references** to the master Patient table — never duplicated as editable text in the prescription.
2. Weight and Body Temperature are stored **per visit**, enabling a vitals trend view later.
3. Medicine/food/injectable/accessory sections are all **one-to-many** child tables against Prescription ID (not comma-separated strings).
4. Quantity + Unit are always stored as two separate columns (never concatenated) to keep the data queryable.
5. Follow-up records should be queryable independently (e.g., "list all patients due for vaccine follow-up this week") — this argues for a dedicated `follow_ups` table keyed by Prescription ID and Patient ID.

---

## 12. UI/UX Requirements

- Use **collapsible cards** per section, not one long scrolling form.
- Conditional/dynamic rendering:
  - "Other" in Clinical Findings → reveal text field only when selected.
  - Follow-up "No" → hide all follow-up date fields.
  - Quick Date buttons auto-fill the date picker but remain editable.
- Searchable dropdowns for Medicine Name and Food Name (avoid full manual typing every time).
- Mobile/tablet-friendly layout, since doctors may fill this during consultation on a tablet.

---

## 13. Functional Requirement Checklist (Acceptance Criteria)

- [ ] Patient Name & Patient ID auto-populate and are read-only.
- [ ] Date of Visit auto-fills to today, editable with permission.
- [ ] Weight and Body Temperature captured per visit with unit selector.
- [ ] Previous History and Symptoms support free text, saved per visit.
- [ ] Clinical Findings support multi-select + "Other" with conditional text field.
- [ ] Immediate Medicine, Prescribed Medicine, and Injectable are stored as distinct, independently addable rows.
- [ ] Quantity and Unit are decoupled, dropdown-based, with "Other" manual override.
- [ ] Follow-up Yes/No toggle correctly shows/hides dependent fields.
- [ ] Vaccine and Deworming Quick Date buttons calculate correctly from Date of Visit.
- [ ] Other Follow-up supports custom type entry.
- [ ] Animal Food and Prescribed Food are separate, both support multiple rows.
- [ ] Accessories (if kept) don't duplicate billing logic.
- [ ] All sections save under one Prescription ID linked to Visit ID and Patient ID.
- [ ] Previous prescriptions are viewable in a patient history/timeline view.

---

## 14. Suggested Implementation Phases

**Phase 1 — Data Model**
- Design/migrate database schema per §11 (patient vitals, findings, treatment, follow-up, food, accessories as child tables).

**Phase 2 — Core Form UI**
- Build collapsible section shell (Patient Details → Accessories).
- Implement Patient Details (read-only fetch + Weight/Temperature/Date of Visit).

**Phase 3 — Clinical Data Entry**
- Previous History, Symptoms, Clinical Findings (multi-select + Other).

**Phase 4 — Treatment Module**
- Immediate Medicine, Prescribed Medicine (multi-row), Injectable (multi-row), dynamic unit dropdowns, medicine search.

**Phase 5 — Follow-up Module**
- Yes/No toggle, date pickers, Quick Date logic for Vaccine and Deworming, Other Follow-up type.

**Phase 6 — Food & Accessories**
- Animal Food and Prescribed Food (multi-row), Accessories (optional, linked to billing).

**Phase 7 — History & Review**
- Patient visit history/timeline view showing past prescriptions (date, findings, treatment, follow-up summary).

**Phase 8 — Testing & Rollout**
- Validate against the acceptance checklist (§13), UAT with doctors, then rollout.

---

## 15. Future-Ready Notes

This structure lays the foundation for:
- Weight/temperature trend charts per patient
- Automated follow-up/vaccine/deworming reminders
- Medicine usage analytics
- AI-assisted clinical summaries in later phases